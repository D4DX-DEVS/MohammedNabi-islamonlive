import { query } from './db'
import { text, type Cat, type Post } from './format'

export const PER_PAGE = 12

// The whole database (about 5 MB) is read once per build process and everything below works on that snapshot,
// so building ~430 pages costs a handful of D1 requests instead of thousands.
type Snapshot = { cats: Cat[]; posts: Post[] } // posts newest first
let snapshot: Promise<Snapshot> | undefined
const load = () => (snapshot ??= fetchAll())

type Row = Record<string, unknown>
async function fetchAll(): Promise<Snapshot> {
  const cats = await query<Cat>('SELECT id, slug, name FROM categories ORDER BY name')
  const ids = (await query<{ id: number }>('SELECT id FROM posts')).map((r) => r.id)
  const rows: Row[] = []
  // bodies are large, so fetch them in small batches
  for (let i = 0; i < ids.length; i += 25) {
    const batch = ids.slice(i, i + 25)
    rows.push(...(await query(`SELECT * FROM posts WHERE id IN (${batch.map(() => '?').join(',')})`, batch)))
  }
  const posts = rows
    .map((r): Post => {
      const categories: number[] = JSON.parse(r.categories as string)
      return {
        id: r.id as number,
        slug: r.slug as string,
        path: r.path as string,
        date: r.date as string,
        title: r.title as string,
        excerpt: r.excerpt as string,
        content: r.content as string,
        image: (r.image as string | null) ?? null,
        categories,
        category: cats.find((c) => c.id === categories[0]),
        author: r.author as string,
        authorSlug: r.author_slug as string,
      }
    })
    .sort((a, b) => b.date.localeCompare(a.date))
  if (!posts.length) throw new Error('D1 returned no posts; run `npm run db:seed` first')
  return { cats, posts }
}

// listings never render a body, so drop it to keep the page data small
const lite = (p: Post): Post => ({ ...p, content: '' })
const page = <T>(all: T[], n: number) => ({
  data: all.slice((n - 1) * PER_PAGE, n * PER_PAGE),
  total: all.length,
  pages: Math.max(1, Math.ceil(all.length / PER_PAGE)),
})

export const getCategories = async () => (await load()).cats
export const getAllPosts = async () => (await load()).posts

export async function getPosts(catId?: number, limit = 5) {
  const { posts } = await load()
  return (catId ? posts.filter((p) => p.categories.includes(catId)) : posts).slice(0, limit).map(lite)
}

export async function getCategoryPage(catId: number, n: number) {
  const r = page((await load()).posts.filter((p) => p.categories.includes(catId)), n)
  return { ...r, data: r.data.map(lite) }
}

export async function getAuthors() {
  const names = new Map<string, string>()
  for (const p of (await load()).posts) if (p.authorSlug) names.set(p.authorSlug, p.author)
  return [...names].map(([slug, name]) => ({ slug, name }))
}
export const getAuthor = async (slug: string) => (await getAuthors()).find((a) => a.slug === slug)

export async function getAuthorPage(slug: string, n: number) {
  const r = page((await load()).posts.filter((p) => p.authorSlug === slug), n)
  return { ...r, data: r.data.map(lite) }
}

export const getPost = async (path: string) => (await load()).posts.find((p) => p.path === path)

export async function getRelated(p: Post, n = 3) {
  return (await load()).posts
    .filter((x) => x.id !== p.id && x.categories.some((c) => p.categories.includes(c)))
    .slice(0, n)
    .map(lite)
}

// posts are newest first, so "older" is the next one in the list
export async function getAdjacent(p: Post) {
  const { posts } = await load()
  const i = posts.findIndex((x) => x.id === p.id)
  return { newer: posts[i - 1] && lite(posts[i - 1]), older: posts[i + 1] && lite(posts[i + 1]) }
}

// what the browser-side search downloads: listing fields plus lowercase plain text of the whole post
export async function getSearchIndex() {
  return (await load()).posts.map((p) => ({
    ...lite(p),
    s: text(`${p.title} ${p.excerpt} ${p.content}`).toLowerCase(),
  }))
}
