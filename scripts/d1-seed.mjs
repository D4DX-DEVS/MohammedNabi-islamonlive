// Loads db/schema.sql and content/*.json into the D1 database "muhammednabi".
//   node scripts/d1-seed.mjs --remote   (needs CLOUDFLARE_API_TOKEN / CLOUDFLARE_ACCOUNT_ID in .env)
//   node scripts/d1-seed.mjs --local    (wrangler's local simulation, used for `npm run preview`)
// Re-running replaces rows with the same id (INSERT OR REPLACE), it never drops tables.
import { execFileSync } from 'node:child_process'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'

const DB = 'muhammednabi' // only ever this database; the account has others
const target = process.argv.includes('--remote') ? '--remote' : '--local'
const posts = JSON.parse(readFileSync('content/posts.json', 'utf8'))
const cats = JSON.parse(readFileSync('content/categories.json', 'utf8'))

const q = (s) => (s == null ? 'NULL' : `'${String(s).replaceAll("'", "''")}'`)
const row = (p) =>
  `INSERT OR REPLACE INTO posts (id, slug, path, date, title, excerpt, content, image, categories, author, author_slug) VALUES (${p.id}, ${q(p.slug)}, ${q(p.path)}, ${q(p.date)}, ${q(p.title)}, ${q(p.excerpt)}, ${q(p.content)}, ${q(p.image)}, ${q(JSON.stringify(p.categories))}, ${q(p.author)}, ${q(p.authorSlug)});`

// D1 caps a statement at 100 KB; fail loudly instead of half-importing
for (const p of posts) if (Buffer.byteLength(row(p)) > 100_000) throw new Error(`post ${p.id} exceeds the D1 statement limit`)

mkdirSync('.wrangler/seed', { recursive: true })
const files = []
const add = (name, statements) => {
  const f = `.wrangler/seed/${name}.sql`
  writeFileSync(f, statements.join('\n') + '\n')
  files.push(f)
}
add('0-schema', [readFileSync('db/schema.sql', 'utf8')])
add('1-categories', cats.map((c) => `INSERT OR REPLACE INTO categories (id, slug, name) VALUES (${c.id}, ${q(c.slug)}, ${q(c.name)});`))
// ~800 KB per file keeps each import request small
let batch = [], size = 0, n = 0
for (const p of posts) {
  const s = row(p)
  if (size + s.length > 800_000) { add(`2-posts-${++n}`, batch); batch = []; size = 0 }
  batch.push(s); size += s.length
}
if (batch.length) add(`2-posts-${++n}`, batch)

for (const f of files) {
  console.log('executing', f)
  execFileSync('npx', ['wrangler', 'd1', 'execute', DB, target, '--file', f], { stdio: 'inherit', shell: true })
}
console.log(`done: ${cats.length} categories, ${posts.length} posts -> ${DB} (${target.slice(2)})`)
