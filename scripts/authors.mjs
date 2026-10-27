// One-off: the REST API hides authors, so read them from each original post page and merge into content/posts.json.
import { readFile, writeFile } from 'node:fs/promises'

const SITE = 'https://mohammednabi.islamonlive.in'
const posts = JSON.parse(await readFile('content/posts.json', 'utf8'))

const entities = { amp: '&', quot: '"', lt: '<', gt: '>' }
const dec = (s) => s.replace(/&(#\d+|\w+);/g, (m, e) => (e[0] === '#' ? String.fromCodePoint(+e.slice(1)) : entities[e] ?? m))

async function authorOf(p) {
  for (let i = 0; i < 5; i++) {
    try {
      const r = await fetch(SITE + encodeURI(p.path) + '/')
      if (!r.ok) throw new Error(r.status)
      const m = /<a class="entry-author__name"[^>]*rel="author"[^>]*href="[^"]*\/author\/([^"/]+)\/?"[^>]*>([^<]+)</.exec(await r.text())
      return m ? { authorSlug: decodeURIComponent(m[1]), author: dec(m[2]).trim() } : { authorSlug: '', author: '' }
    } catch {
      await new Promise((res) => setTimeout(res, 2000 * (i + 1)))
    }
  }
  console.log('failed', p.path)
  return { authorSlug: '', author: '' }
}

const queue = [...posts]
await Promise.all(Array.from({ length: 4 }, async () => {
  for (let p; (p = queue.pop()); ) Object.assign(p, await authorOf(p))
}))

await writeFile('content/posts.json', JSON.stringify(posts))
const names = new Map(posts.map((p) => [p.authorSlug, p.author]))
console.log(`${names.size} authors`, [...names].slice(0, 5))
