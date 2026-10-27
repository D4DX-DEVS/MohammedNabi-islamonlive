// One-off: pulls everything from the old WordPress site into content/ and public/uploads/.
import { mkdir, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'

const SITE = 'https://mohammednabi.islamonlive.in'
const API = `${SITE}/wp-json/wp/v2`
const UP = `${SITE}/wp-content/uploads/`

const retry = async (fn) => {
  for (let i = 0; ; i++) {
    try { return await fn() } catch (e) {
      if (i >= 5) throw e
      await new Promise((res) => setTimeout(res, 2000 * (i + 1)))
    }
  }
}
const json = (u) => retry(async () => {
  const r = await fetch(u)
  if (!r.ok) throw new Error(`${r.status} ${u}`)
  // strict parse: origin sometimes appends a DB-error page after the JSON, which must trigger a retry
  return { data: JSON.parse(await r.text()), total: +(r.headers.get('x-wp-total') ?? 0) }
})

const files = new Set()
// rewrite upload URLs to local ones and remember them for download
const localize = (s) =>
  s.replace(/https?:\/\/mohammednabi\.islamonlive\.in\/wp-content\/uploads\/([^\s"')<>,]+)/g, (_, p) => {
    files.add(p)
    return `/uploads/${p}`
  })

const cats = (await json(`${API}/categories?per_page=100&hide_empty=true`)).data.map((c) => ({
  id: c.id, slug: c.slug, name: c.name, count: c.count,
}))

const posts = []
let total = Infinity
const STEP = 10
for (let off = 0; off < total; off += STEP) {
  const q = (n, o) => `${API}/posts?_embed&per_page=${n}&offset=${o}`
  // big batches can break the origin's DB; fall back to one post at a time
  const r = await json(q(STEP, off)).catch(async () => {
    const data = []
    for (let i = off; i < Math.min(off + STEP, total === Infinity ? off + STEP : total); i++) data.push(...(await json(q(1, i))).data)
    return { data, total }
  })
  if (r.total) total = r.total
  const page = off / STEP + 1, pages = Math.ceil(total / STEP)
  for (const p of r.data) {
    const media = p._embedded?.['wp:featuredmedia']?.[0]
    const sz = media?.media_details?.sizes
    const image = sz?.medium_large?.source_url ?? sz?.large?.source_url ?? media?.source_url ?? null
    const content = localize(p.content.rendered)
      .replace(/ (srcset|sizes)="[^"]*"/g, '')
      .replaceAll(`${SITE}/`, '/')
    posts.push({
      id: p.id,
      slug: decodeURIComponent(p.slug),
      path: decodeURIComponent(new URL(p.link).pathname).replace(/\/$/, ''),
      date: p.date,
      title: p.title.rendered,
      excerpt: p.excerpt.rendered,
      content,
      image: image && !/mhmd-dflt/.test(image) ? localize(image) : null,
      categories: p.categories,
      author: p._embedded?.author?.[0]?.name ?? '',
      authorSlug: decodeURIComponent(p._embedded?.author?.[0]?.slug ?? ''),
    })
  }
  console.log(`posts page ${page}/${pages}`)
}

// logos + default image used by the theme
for (const f of ['2018/10/logo-nabi1.png', '2018/10/logo-isl.png']) files.add(f)

await mkdir('content', { recursive: true })
await writeFile('content/categories.json', JSON.stringify(cats))
await writeFile('content/posts.json', JSON.stringify(posts))
console.log(`${posts.length} posts, ${files.size} images`)

const list = [...files]
let ok = 0, fail = []
async function worker() {
  while (list.length) {
    const f = list.pop()
    try {
      const buf = await retry(async () => {
        const r = await fetch(UP + f.split("/").map(encodeURIComponent).join("/"))
        if (!r.ok) throw new Error(r.status)
        return Buffer.from(await r.arrayBuffer())
      })
      const out = `public/uploads/${decodeURIComponent(f)}`
      await mkdir(dirname(out), { recursive: true })
      await writeFile(out, buf)
      ok++
    } catch (e) {
      fail.push(`${f} ${e.message}`)
    }
  }
}
await Promise.all(Array.from({ length: 8 }, worker))
console.log(`downloaded ${ok}, failed ${fail.length}`)
if (fail.length) await writeFile('content/failed.txt', fail.join('\n'))
