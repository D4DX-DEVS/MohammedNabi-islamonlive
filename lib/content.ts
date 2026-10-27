import rawPosts from '@/content/posts.json'
import rawCats from '@/content/categories.json'

export const PER_PAGE = 12

export type Cat = { id: number; slug: string; name: string; count: number }
export type Post = {
  id: number
  slug: string
  path: string
  date: string
  title: string
  excerpt: string
  content: string
  image: string | null
  categories: number[]
  author: string
  authorSlug: string
}

const cats = rawCats as Cat[]
// newest first
const posts = (rawPosts as Post[]).slice().sort((a, b) => b.date.localeCompare(a.date))

export const getCategories = () => cats
export const getAllPosts = () => posts
export const getPosts = (catId?: number, limit = 5) =>
  (catId ? posts.filter((p) => p.categories.includes(catId)) : posts).slice(0, limit)
export const getCategoryPosts = (catId: number) => posts.filter((p) => p.categories.includes(catId))
export const getPost = (path: string) => posts.find((p) => p.path === path)


export function getAuthors() {
  const m = new Map<string, string>()
  for (const p of posts) if (p.authorSlug) m.set(p.authorSlug, p.author)
  return [...m].map(([slug, name]) => ({ slug, name }))
}
export const getAuthor = (slug: string) => getAuthors().find((a) => a.slug === slug)
export const paginate = <T,>(all: T[], page: number) => ({
  data: all.slice((page - 1) * PER_PAGE, page * PER_PAGE),
  pages: Math.max(1, Math.ceil(all.length / PER_PAGE)),
})
export const getAuthorPosts = (slug: string) => posts.filter((p) => p.authorSlug === slug)

// plain-text search index, built once
let index: [Post, string][] | undefined
export function search(q: string) {
  index ??= posts.map((p) => [p, text(`${p.title} ${p.excerpt} ${p.content}`).toLowerCase()])
  const terms = q.toLowerCase().split(/\s+/).filter(Boolean)
  return terms.length ? index.filter(([, t]) => terms.every((w) => t.includes(w))).map(([p]) => p) : []
}

export function getRelated(p: Post, n = 3) {
  return posts.filter((x) => x.id !== p.id && x.categories.some((c) => p.categories.includes(c))).slice(0, n)
}
// posts is newest-first, so "prev" is the older neighbour
export function getAdjacent(p: Post) {
  const i = posts.findIndex((x) => x.id === p.id)
  return { newer: posts[i - 1], older: posts[i + 1] }
}

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
export const cat = (p: Post) => cats.find((c) => c.id === p.categories[0])
export const href = (p: Post) => encodeURI(p.path)
export const date = (p: Post) =>
  new Date(p.date).toLocaleDateString('ml-IN', { year: 'numeric', month: 'short', day: 'numeric' })
