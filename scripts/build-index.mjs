// Writes content/sitemap-index.json: just the URLs the sitemap needs, so the sitemap route never bundles post bodies.
// Runs automatically before `npm run build` (see "prebuild" in package.json).
import { readFileSync, writeFileSync } from 'node:fs'

const posts = JSON.parse(readFileSync('content/posts.json', 'utf8'))
const cats = JSON.parse(readFileSync('content/categories.json', 'utf8'))
const index = {
  posts: posts.map((p) => ({ path: p.path, date: p.date })),
  categories: cats.map((c) => c.slug),
  authors: [...new Set(posts.map((p) => p.authorSlug).filter(Boolean))],
}
writeFileSync('content/sitemap-index.json', JSON.stringify(index))
console.log(`sitemap index: ${index.posts.length} posts, ${index.categories.length} categories, ${index.authors.length} authors`)
