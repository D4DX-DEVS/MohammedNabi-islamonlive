import { unstable_cache } from 'next/cache'
import { query } from './db'
import type { Cat, Post } from './format'

export const PER_PAGE = 12
export const CONTENT_TAG = 'content' // expired by the admin API after every edit, so changes show up straight away

// Every read goes to D1 once, then is served from Next's cache. The day is only a safety net:
// editing in the admin expires the tag immediately.
const cached = <A extends unknown[], R>(key: string, fn: (...args: A) => Promise<R>) =>
  unstable_cache(fn, [key], { revalidate: 86400, tags: [CONTENT_TAG] })

// list queries leave out the post body; the primary category is joined in so cards need no second lookup
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

export const getCategories = cached('categories', () => query<Cat>('SELECT id, slug, name FROM categories ORDER BY name'))

export const getPosts = cached('posts', async (catId: number | null, limit: number) => {
  const rows = catId
    ? await query(`SELECT ${COLS} ${FROM} WHERE ${inCat(1)} ORDER BY p.date DESC LIMIT ?2`, [catId, limit])
    : await query(`SELECT ${COLS} ${FROM} ORDER BY p.date DESC LIMIT ?1`, [limit])
  return rows.map(toPost)
})

// `where` uses ?1..?n for its own params; limit and offset take the next two numbers
async function pagePosts(where: string, params: unknown[], page: number) {
  const n = params.length
  const rows = await query(
    `SELECT ${COLS}, count(*) OVER () AS total ${FROM} ${where} ORDER BY p.date DESC LIMIT ?${n + 1} OFFSET ?${n + 2}`,
    [...params, PER_PAGE, (page - 1) * PER_PAGE],
  )
  // an empty page (past the end, or no matches) carries no count; callers 404 past the end
  const total = rows.length ? (rows[0].total as number) : 0
  return { data: rows.map(toPost), total, pages: Math.max(1, Math.ceil(total / PER_PAGE)) }
}
export const getCategoryPage = cached('category-page', (catId: number, page: number) => pagePosts(`WHERE ${inCat(1)}`, [catId], page))
export const getAuthorPage = cached('author-page', (slug: string, page: number) => pagePosts('WHERE p.author_slug = ?1', [slug], page))

export const getPost = cached('post', async (path: string) => {
  const rows = await query(`SELECT ${COLS}, p.content ${FROM} WHERE p.path = ?1`, [path])
  return rows[0] ? toPost(rows[0]) : null
})

export const getRelated = cached('related', async (id: number, categories: number[], n: number) => {
  const rows = await query(
    `SELECT ${COLS} ${FROM} WHERE p.id != ?1 AND EXISTS (SELECT 1 FROM json_each(p.categories) a, json_each(?2) b WHERE a.value = b.value)
     ORDER BY p.date DESC LIMIT ?3`,
    [id, JSON.stringify(categories), n],
  )
  return rows.map(toPost)
})

export const getAdjacent = cached('adjacent', async (date: string) => {
  const rows = await query(
    `SELECT * FROM (SELECT ${COLS} ${FROM} WHERE p.date > ?1 ORDER BY p.date ASC LIMIT 1)
     UNION ALL SELECT * FROM (SELECT ${COLS} ${FROM} WHERE p.date < ?1 ORDER BY p.date DESC LIMIT 1)`,
    [date],
  )
  const posts = rows.map(toPost)
  return { newer: posts.find((p) => p.date > date) ?? null, older: posts.find((p) => p.date < date) ?? null }
})

export const getSitemapEntries = cached('sitemap', async () => {
  const [posts, authors] = await Promise.all([
    query<{ path: string; date: string }>('SELECT path, date FROM posts'),
    query<{ author_slug: string }>("SELECT DISTINCT author_slug FROM posts WHERE author_slug != ''"),
  ])
  return { posts, authors: authors.map((a) => a.author_slug) }
})

// every word must appear in the title, summary or body; cached per query, and expired with the rest after an edit
export const searchPage = cached('search', (q: string, page: number) => {
  const terms = q.trim().split(/\s+/).filter(Boolean).slice(0, 5)
  if (!terms.length) return Promise.resolve({ data: [] as Post[], total: 0, pages: 1 })
  const like = (t: string) => `%${t.slice(0, 60).replace(/[\\%_]/g, '\\$&')}%`
  const match = (n: number) => `(p.title LIKE ?${n} ESCAPE '\\' OR p.excerpt LIKE ?${n} ESCAPE '\\' OR p.content LIKE ?${n} ESCAPE '\\')`
  return pagePosts('WHERE ' + terms.map((_, i) => match(i + 1)).join(' AND '), terms.map(like), page)
})
