import { cache } from 'react'
import { query } from './db'

export const PER_PAGE = 12

export type Cat = { id: number; slug: string; name: string }
export type Post = {
  id: number
  slug: string
  path: string
  date: string
  title: string
  excerpt: string
  content: string // only filled by getPost
  image: string | null
  categories: number[]
  category?: Cat // primary category
  author: string
  authorSlug: string
}

// ---------- queries (D1) ----------
// list queries leave out the post body; join in the primary category so cards don't need a second lookup
const COLS = `p.id, p.slug, p.path, p.date, p.title, p.excerpt, p.image, p.categories, p.author, p.author_slug,
  c.id AS cat_id, c.slug AS cat_slug, c.name AS cat_name`
const FROM = `FROM posts p LEFT JOIN categories c ON c.id = json_extract(p.categories, '$[0]')`
const inCat = (n: number) => `EXISTS (SELECT 1 FROM json_each(p.categories) WHERE value = ?${n})`

type Row = Record<string, unknown>
const toPost = (r: Row): Post => ({
  id: r.id as number,
  slug: r.slug as string,
  path: r.path as string,
  date: r.date as string,
  title: r.title as string,
  excerpt: r.excerpt as string,
  content: (r.content as string) ?? '',
  image: (r.image as string | null) ?? null,
  categories: JSON.parse(r.categories as string),
  category: r.cat_id == null ? undefined : { id: r.cat_id as number, slug: r.cat_slug as string, name: r.cat_name as string },
  author: r.author as string,
  authorSlug: r.author_slug as string,
})

export const getCategories = cache(() => query<Cat>('SELECT id, slug, name FROM categories ORDER BY name'))

export async function getPosts(catId?: number, limit = 5) {
  const rows = catId
    ? await query(`SELECT ${COLS} ${FROM} WHERE ${inCat(1)} ORDER BY p.date DESC LIMIT ?2`, [catId, limit])
    : await query(`SELECT ${COLS} ${FROM} ORDER BY p.date DESC LIMIT ?1`, [limit])
  return rows.map(toPost)
}

// `where` uses ?1..?n for its own params; limit and offset take the next two numbers
async function pagePosts(where: string, params: unknown[], page: number) {
  const n = params.length
  const [rows, count] = await Promise.all([
    query(`SELECT ${COLS} ${FROM} ${where} ORDER BY p.date DESC LIMIT ?${n + 1} OFFSET ?${n + 2}`, [
      ...params,
      PER_PAGE,
      (page - 1) * PER_PAGE,
    ]),
    query<{ n: number }>(`SELECT count(*) AS n FROM posts p ${where}`, params),
  ])
  const total = count[0]?.n ?? 0
  return { data: rows.map(toPost), total, pages: Math.max(1, Math.ceil(total / PER_PAGE)) }
}
export const getCategoryPage = (catId: number, page: number) => pagePosts(`WHERE ${inCat(1)}`, [catId], page)
export const getAuthorPage = (slug: string, page: number) => pagePosts('WHERE p.author_slug = ?1', [slug], page)

export async function getAuthor(slug: string) {
  const rows = await query<{ slug: string; name: string }>(
    'SELECT author_slug AS slug, author AS name FROM posts WHERE author_slug = ? LIMIT 1',
    [slug],
  )
  return rows[0]
}

export async function getPost(path: string) {
  const rows = await query(`SELECT ${COLS}, p.content ${FROM} WHERE p.path = ?`, [path])
  return rows[0] ? toPost(rows[0]) : undefined
}

// every word must appear in title, excerpt or body (case-insensitive for latin text)
export function searchPage(q: string, page: number) {
  const terms = q.trim().split(/\s+/).filter(Boolean).slice(0, 5)
  if (!terms.length) return Promise.resolve({ data: [] as Post[], total: 0, pages: 1 })
  const like = (t: string) => `%${t.slice(0, 60).replace(/[\\%_]/g, '\\$&')}%`
  const match = (n: number) => `(p.title LIKE ?${n} ESCAPE '\\' OR p.excerpt LIKE ?${n} ESCAPE '\\' OR p.content LIKE ?${n} ESCAPE '\\')`
  return pagePosts('WHERE ' + terms.map((_, i) => match(i + 1)).join(' AND '), terms.map(like), page)
}

export async function getRelated(p: Post, n = 3) {
  const rows = await query(
    `SELECT ${COLS} ${FROM} WHERE p.id != ? AND EXISTS (SELECT 1 FROM json_each(p.categories) a, json_each(?) b WHERE a.value = b.value)
     ORDER BY p.date DESC LIMIT ?`,
    [p.id, JSON.stringify(p.categories), n],
  )
  return rows.map(toPost)
}

export async function getAdjacent(p: Post) {
  const [newer, older] = await Promise.all([
    query(`SELECT ${COLS} ${FROM} WHERE p.date > ? ORDER BY p.date ASC LIMIT 1`, [p.date]),
    query(`SELECT ${COLS} ${FROM} WHERE p.date < ? ORDER BY p.date DESC LIMIT 1`, [p.date]),
  ])
  return { newer: newer[0] ? toPost(newer[0]) : undefined, older: older[0] ? toPost(older[0]) : undefined }
}

export async function getSitemapEntries() {
  const [posts, authors] = await Promise.all([
    query<{ path: string; date: string }>('SELECT path, date FROM posts'),
    query<{ author_slug: string }>("SELECT DISTINCT author_slug FROM posts WHERE author_slug != ''"),
  ])
  return { posts, authors: authors.map((a) => a.author_slug) }
}

// ---------- helpers ----------
export function decode(s: string) {
  const named: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' }
  return s.replace(/&(#x?[0-9a-f]+|\w+);/gi, (m, e: string) =>
    e[0] === '#'
      ? String.fromCodePoint(e[1].toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : +e.slice(1))
      : named[e] ?? m)
}
export const text = (html: string) => decode(html.replace(/<[^>]+>/g, '')).trim()
// post bodies: lazy images, and drop inline colours so dark mode stays readable
export const cleanContent = (html: string) =>
  html
    .replace(/<img /g, '<img loading="lazy" decoding="async" ')
    .replace(/ style="([^"]*)"/g, (_, css: string) => {
      const kept = css.split(';').filter((d) => d.trim() && !/^\s*(color|background(-color)?)\s*:/i.test(d))
      return kept.length ? ` style="${kept.join(';')}"` : ''
    })
    // internal links lose the WordPress trailing slash (Next would 308 them); dead localhost links become plain text
    .replace(/href="(\/[^"?#]*?)\/"/g, 'href="$1"')
    .replace(/<a [^>]*href="http:\/\/localhost[^"]*"[^>]*>([\s\S]*?)<\/a>/g, '$1')
    // old posts embed audio over http://, which browsers block on https pages
    .replace(/(src|href)="http:\/\/(?:www\.)?thafheem\.net/g, '$1="https://thafheem.net')
    .replace(/<font [^>]*>/g, '<span>')
    .replace(/<\/font>/g, '</span>')
export const readingMinutes = (p: Post) => Math.max(1, Math.round(text(p.content).split(/\s+/).length / 150))
export const cat = (p: Post) => p.category
export const href = (p: Post) => encodeURI(p.path)
export const date = (p: Post) =>
  new Date(p.date).toLocaleDateString('ml-IN', { year: 'numeric', month: 'short', day: 'numeric' })
