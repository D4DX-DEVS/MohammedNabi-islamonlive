// The admin API, search and uploaded photos (/api/* and /media/*); worker/index.ts sends every other request to the Next.js app.
// Auth: one password (secret ADMIN_PASSWORD) -> signed, expiring, HttpOnly cookie. Fails closed when secrets are missing.
// Data: the D1 database (DB) and R2 bucket (MEDIA) bound in wrangler.jsonc.

interface D1Like {
  prepare(statement: string): {
    bind(...values: unknown[]): { all(): Promise<{ results: Row[]; meta: { last_row_id: number } }> }
  }
}
export interface R2Like {
  put(key: string, value: Uint8Array | ArrayBuffer | string, opts?: { httpMetadata?: { contentType?: string }; customMetadata?: Record<string, string> }): Promise<unknown>
  get(key: string): Promise<{ body: ReadableStream; httpMetadata?: { contentType?: string }; customMetadata?: Record<string, string>; arrayBuffer(): Promise<ArrayBuffer>; text(): Promise<string> } | null>
  delete(key: string): Promise<void>
  list(opts: { prefix: string; limit: number; include?: string[] }): Promise<{ objects: { key: string; customMetadata?: Record<string, string> }[] }>
}

export interface Env {
  DB: D1Like
  MEDIA: R2Like
  ADMIN_PASSWORD?: string
  SESSION_SECRET?: string
  SITE_URL: string
}

// The address visitors typed. A forwarder on another Cloudflare account serves the site under the real domain: it may send
// x-forwarded-host; when it does not, cf-worker (the zone of the Worker that called us) says the call came from the domain's zone.
export function publicHost(req: Request, env: Env) {
  const site = new URL(env.SITE_URL).host
  const via = req.headers.get('cf-worker')
  return req.headers.get('x-forwarded-host') ?? (via && site.endsWith(`.${via}`) ? site : new URL(req.url).host)
}

// Pages the Worker has stored are valid until this moment (see worker/index.ts); every change to a post moves it forward.
export const PURGED = 'cache/purged'
async function purgePages(env: Env) {
  await env.MEDIA.put(PURGED, String(Date.now()))
  await (caches as unknown as { default: Cache }).default.delete(new Request('https://cache.internal/purged'))
}

type Row = Record<string, unknown>
class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message)
  }
}

const SESSION_SECONDS = 8 * 60 * 60
const COOKIE = 'admin_session'
const MAX_UPLOAD = 4_000_000
const PER_PAGE = 12
const enc = new TextEncoder()

// ---------- helpers ----------
const json = (data: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', ...headers },
  })

async function hmac(secret: string, data: string) {
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const sig = new Uint8Array(await crypto.subtle.sign('HMAC', key, enc.encode(data)))
  return Array.from(sig, (b) => b.toString(16).padStart(2, '0')).join('')
}

// compares digests of both values, so length and content do not leak through timing
async function safeEqual(a: string, b: string) {
  const [x, y] = await Promise.all([crypto.subtle.digest('SHA-256', enc.encode(a)), crypto.subtle.digest('SHA-256', enc.encode(b))])
  const xa = new Uint8Array(x), ya = new Uint8Array(y)
  let diff = 0
  for (let i = 0; i < xa.length; i++) diff |= xa[i] ^ ya[i]
  return diff === 0
}

const configured = (env: Env) => Boolean(env.ADMIN_PASSWORD && env.SESSION_SECRET)

async function makeSession(env: Env) {
  const exp = Math.floor(Date.now() / 1000) + SESSION_SECONDS
  return `${exp}.${await hmac(env.SESSION_SECRET!, String(exp))}`
}

async function isAuthed(req: Request, env: Env) {
  if (!configured(env)) return false
  const raw = /(?:^|;\s*)admin_session=([^;]+)/.exec(req.headers.get('Cookie') ?? '')?.[1]
  const [exp, sig] = (raw ?? '').split('.')
  if (!exp || !sig || !(Number(exp) > Date.now() / 1000)) return false
  return safeEqual(sig, await hmac(env.SESSION_SECRET!, exp))
}

const cookie = (value: string, maxAge: number, secure: boolean) =>
  `${COOKIE}=${value}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${maxAge}${secure ? '; Secure' : ''}`

async function readJson(req: Request) {
  if (!(req.headers.get('Content-Type') ?? '').includes('application/json')) throw new HttpError(415, 'Send JSON')
  const text = await req.text()
  if (text.length > 1_000_000) throw new HttpError(413, 'Request too large')
  try {
    return JSON.parse(text) as Record<string, unknown>
  } catch {
    throw new HttpError(400, 'Invalid JSON')
  }
}

// ---------- D1 ----------
async function sql<T = Row>(env: Env, statement: string, params: unknown[] = []): Promise<{ rows: T[]; lastId: number }> {
  try {
    const r = await env.DB.prepare(statement).bind(...params).all()
    return { rows: r.results as T[], lastId: r.meta.last_row_id }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    if (/UNIQUE/i.test(msg)) throw new HttpError(409, 'That address is already used by another post')
    console.error('D1 error:', msg)
    throw new HttpError(502, 'Database error')
  }
}

// ---------- validation ----------
type PostInput = {
  title: string
  slug: string
  categories: number[]
  author: string
  authorSlug: string
  excerpt: string
  content: string
  image: string | null
  date: string
}

function str(v: unknown, name: string, max: number, required = false) {
  const s = typeof v === 'string' ? v.trim() : ''
  if (required && !s) throw new HttpError(400, `${name} is required`)
  if (s.length > max) throw new HttpError(400, `${name} is too long (max ${max} characters)`)
  return s
}

function parsePost(body: Record<string, unknown>): PostInput {
  const title = str(body.title, 'Title', 300, true)
  const slug = str(body.slug, 'Slug', 150, true)
  if (!/^[^\s/?#%\\]+$/u.test(slug)) throw new HttpError(400, 'Slug cannot contain spaces or / ? # %')
  const categories = Array.isArray(body.categories) ? body.categories.map(Number) : []
  if (!categories.length || categories.length > 6 || categories.some((c) => !Number.isInteger(c) || c < 1)) {
    throw new HttpError(400, 'Choose 1 to 6 categories (the first is the main one)')
  }
  const authorSlug = str(body.authorSlug, 'Author slug', 100)
  if (authorSlug && !/^[\p{L}\p{N}_-]+$/u.test(authorSlug)) throw new HttpError(400, 'Author slug can only use letters, numbers, - and _')
  const image = str(body.image, 'Image', 500) || null
  if (image && !/^(\/(uploads|media)\/[^\s"'<>]+|https:\/\/[^\s"'<>]+)$/.test(image)) {
    throw new HttpError(400, 'Image must be /uploads/..., /media/... or an https:// address')
  }
  const date = new Date(str(body.date, 'Date', 40, true))
  if (Number.isNaN(date.getTime())) throw new HttpError(400, 'Date is not valid')
  return {
    title,
    slug,
    categories: [...new Set(categories)],
    author: str(body.author, 'Author', 100),
    authorSlug,
    excerpt: str(body.excerpt, 'Excerpt', 2000),
    content: str(body.content, 'Content', 400_000, true),
    image,
    date: date.toISOString().slice(0, 19),
  }
}

async function pathFor(env: Env, p: PostInput) {
  const cats = (await sql<{ id: number; slug: string }>(env, 'SELECT id, slug FROM categories')).rows
  const primary = cats.find((c) => c.id === p.categories[0])
  if (p.categories.some((id) => !cats.some((c) => c.id === id)) || !primary) throw new HttpError(400, 'Unknown category')
  return `/${primary.slug}/${p.slug}`
}

const COLUMNS = 'id, slug, path, date, title, excerpt, image, categories, author, author_slug'
const publicRow = (r: Row, withContent = false) => ({
  id: r.id,
  slug: r.slug,
  path: r.path,
  date: r.date,
  title: r.title,
  excerpt: r.excerpt,
  image: r.image ?? null,
  categories: JSON.parse(r.categories as string),
  author: r.author,
  authorSlug: r.author_slug,
  ...(withContent ? { content: r.content } : {}),
})

// ---------- photos ----------
// the file's own bytes decide its type; the declared type and the file name are not trusted
function sniff(b: Uint8Array): { ext: string; type: string } | null {
  const is = (...bytes: number[]) => bytes.every((v, i) => b[i] === v)
  if (is(0xff, 0xd8, 0xff)) return { ext: 'jpg', type: 'image/jpeg' }
  if (is(0x89, 0x50, 0x4e, 0x47)) return { ext: 'png', type: 'image/png' }
  if (is(0x47, 0x49, 0x46, 0x38)) return { ext: 'gif', type: 'image/gif' }
  if (is(0x52, 0x49, 0x46, 0x46) && b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50) return { ext: 'webp', type: 'image/webp' }
  return null
}

async function upload(req: Request, env: Env) {
  if (Number(req.headers.get('Content-Length') ?? 0) > MAX_UPLOAD) throw new HttpError(413, 'Photo is too large (max 4 MB)')
  const bytes = new Uint8Array(await req.arrayBuffer())
  if (!bytes.length) throw new HttpError(400, 'No file received')
  if (bytes.length > MAX_UPLOAD) throw new HttpError(413, 'Photo is too large (max 4 MB)')
  const kind = sniff(bytes)
  if (!kind) throw new HttpError(415, 'Only JPEG, PNG, WebP and GIF photos are allowed')
  let fileName = req.headers.get('X-File-Name') ?? 'photo'
  try { fileName = decodeURIComponent(fileName) } catch {}
  const label = fileName.replace(/\.[^.]*$/, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'photo'
  const now = new Date()
  const rand = Array.from(crypto.getRandomValues(new Uint8Array(4)), (x) => x.toString(16).padStart(2, '0')).join('')
  const key = `media/${now.getUTCFullYear()}/${String(now.getUTCMonth() + 1).padStart(2, '0')}/${label}-${rand}.${kind.ext}`
  await env.MEDIA.put(key, bytes, { httpMetadata: { contentType: kind.type } })
  return `/${key}`
}

const mediaKey = (path: string) => {
  let key = path.slice(1)
  try { key = decodeURIComponent(key) } catch {}
  return /^media\/[a-z0-9/_.-]+$/.test(key) && !key.includes('..') ? key : null
}

// File names carry a random part and never change, so browsers may keep them for a year.
async function serveMedia(pathname: string, env: Env) {
  const key = mediaKey(pathname)
  const obj = key ? await env.MEDIA.get(key) : null
  if (!obj) return new Response('Not found', { status: 404 })
  return new Response(obj.body, {
    headers: {
      'Content-Type': obj.httpMetadata?.contentType ?? 'application/octet-stream',
      'Cache-Control': 'public, max-age=31536000, immutable',
      'X-Content-Type-Options': 'nosniff',
      // an image can never run anything even if opened directly
      'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; sandbox",
    },
  })
}

// ---------- search ----------
// every word must appear in the title, summary or body; rows have the shape the site's cards use
async function search(env: Env, q: string, page: number) {
  const terms = q.trim().split(/\s+/).filter(Boolean).slice(0, 5)
  if (!terms.length) return { data: [], total: 0, pages: 1 }
  const like = (t: string) => `%${t.slice(0, 60).replace(/[\\%_]/g, '\\$&')}%`
  const match = (n: number) => `(p.title LIKE ?${n} ESCAPE '\\' OR p.excerpt LIKE ?${n} ESCAPE '\\' OR p.content LIKE ?${n} ESCAPE '\\')`
  const n = terms.length
  const { rows } = await sql(
    env,
    `SELECT p.id, p.slug, p.path, p.date, p.title, p.excerpt, p.image, p.categories, p.author, p.author_slug,
       c.id AS cat_id, c.slug AS cat_slug, c.name AS cat_name, count(*) OVER () AS total
     FROM posts p LEFT JOIN categories c ON c.id = json_extract(p.categories, '$[0]')
     WHERE ${terms.map((_, i) => match(i + 1)).join(' AND ')} ORDER BY p.date DESC LIMIT ?${n + 1} OFFSET ?${n + 2}`,
    [...terms.map(like), PER_PAGE, (page - 1) * PER_PAGE],
  )
  const total = rows.length ? (rows[0].total as number) : 0
  return {
    total,
    pages: Math.max(1, Math.ceil(total / PER_PAGE)),
    data: rows.map((r) => ({
      id: r.id, slug: r.slug, path: r.path, date: r.date, title: r.title, excerpt: r.excerpt, content: '', image: r.image ?? null,
      categories: JSON.parse(r.categories as string),
      category: r.cat_id == null ? undefined : { id: r.cat_id, slug: r.cat_slug, name: r.cat_name },
      author: r.author, authorSlug: r.author_slug,
    })),
  }
}

// ---------- routes ----------
async function handle(req: Request, env: Env): Promise<Response> {
  const url = new URL(req.url)
  const [head, idPart] = url.pathname.replace(/^\/api\//, '').replace(/\/+$/, '').split('/')
  const secure = url.protocol === 'https:'

  // state-changing requests must come from this site (SameSite=Strict already blocks cross-site cookies)
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    const origin = req.headers.get('Origin')
    if (origin && origin !== url.origin && origin !== `https://${publicHost(req, env)}`) throw new HttpError(403, 'Cross-site request blocked')
  }

  // public: the search page asks for results here
  if (head === 'search' && req.method === 'GET') {
    const page = Math.min(1000, Math.max(1, Number(url.searchParams.get('page')) || 1))
    const res = json(await search(env, (url.searchParams.get('q') ?? '').slice(0, 200), page))
    res.headers.set('Cache-Control', 'public, max-age=60')
    return res
  }

  if (head === 'login' && req.method === 'POST') {
    if (!configured(env)) throw new HttpError(503, 'Admin is not set up yet. Add the ADMIN_PASSWORD and SESSION_SECRET secrets.')
    const body = await readJson(req)
    const ok = typeof body.password === 'string' && (await safeEqual(body.password, env.ADMIN_PASSWORD!))
    if (!ok) {
      await new Promise((r) => setTimeout(r, 1000)) // slows password guessing
      throw new HttpError(401, 'Wrong password')
    }
    return json({ ok: true }, 200, { 'Set-Cookie': cookie(await makeSession(env), SESSION_SECONDS, secure) })
  }
  if (head === 'logout' && req.method === 'POST') return json({ ok: true }, 200, { 'Set-Cookie': cookie('', 0, secure) })

  if (!(await isAuthed(req, env))) throw new HttpError(401, 'Please log in')

  if (head === 'session') return json({ ok: true })

  if (head === 'meta' && req.method === 'GET') {
    const [cats, authors] = await Promise.all([
      sql(env, 'SELECT id, slug, name FROM categories ORDER BY name'),
      sql(env, "SELECT DISTINCT author, author_slug FROM posts WHERE author_slug != '' ORDER BY author"),
    ])
    return json({
      categories: cats.rows,
      authors: authors.rows.map((a) => ({ name: a.author, slug: a.author_slug })),
    })
  }

  if (head === 'upload' && req.method === 'POST') return json({ path: await upload(req, env) }, 201)

  if (head === 'media' && req.method === 'DELETE') {
    const path = url.searchParams.get('path') ?? ''
    const key = mediaKey(path)
    if (!key) throw new HttpError(400, 'Bad photo path')
    await env.MEDIA.delete(key)
    return json({ ok: true })
  }

  if (head === 'posts') {
    if (!idPart && req.method === 'GET') {
      const { rows } = await sql(env, `SELECT ${COLUMNS} FROM posts ORDER BY date DESC`)
      return json({ posts: rows.map((r) => publicRow(r)) })
    }
    if (!idPart && req.method === 'POST') {
      const p = parsePost(await readJson(req))
      const path = await pathFor(env, p)
      const { lastId } = await sql(
        env,
        `INSERT INTO posts (slug, path, date, title, excerpt, content, image, categories, author, author_slug)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)`,
        [p.slug, path, p.date, p.title, p.excerpt, p.content, p.image, JSON.stringify(p.categories), p.author, p.authorSlug],
      )
      await purgePages(env)
      return json({ id: lastId, path }, 201)
    }
    const id = Number(idPart)
    if (!Number.isInteger(id) || id < 1) throw new HttpError(400, 'Bad post id')
    if (req.method === 'GET') {
      const { rows } = await sql(env, `SELECT ${COLUMNS}, content FROM posts WHERE id = ?1`, [id])
      if (!rows[0]) throw new HttpError(404, 'Post not found')
      return json({ post: publicRow(rows[0], true) })
    }
    if (req.method === 'PUT') {
      const p = parsePost(await readJson(req))
      const path = await pathFor(env, p)
      if (!(await sql(env, 'SELECT id FROM posts WHERE id = ?1', [id])).rows[0]) throw new HttpError(404, 'Post not found')
      await sql(
        env,
        `UPDATE posts SET slug=?2, path=?3, date=?4, title=?5, excerpt=?6, content=?7, image=?8, categories=?9, author=?10, author_slug=?11
         WHERE id=?1`,
        [id, p.slug, path, p.date, p.title, p.excerpt, p.content, p.image, JSON.stringify(p.categories), p.author, p.authorSlug],
      )
      await purgePages(env)
      return json({ id, path })
    }
    if (req.method === 'DELETE') {
      await sql(env, 'DELETE FROM posts WHERE id = ?1', [id])
      await purgePages(env)
      return json({ ok: true })
    }
  }

  throw new HttpError(404, 'Not found')
}

export async function handleApi(req: Request, env: Env): Promise<Response> {
  const { pathname } = new URL(req.url)
  if (pathname.startsWith('/media/')) return req.method === 'GET' || req.method === 'HEAD' ? serveMedia(pathname, env) : new Response('Not found', { status: 404 })
  try {
    return await handle(req, env)
  } catch (e) {
    if (e instanceof HttpError) return json({ error: e.message }, e.status)
    console.error(e)
    return json({ error: 'Something went wrong' }, 500)
  }
}
