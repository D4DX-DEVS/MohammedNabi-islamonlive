// Admin API (mounted at /api/*). Auth: one password (ADMIN_PASSWORD) -> signed, expiring, HttpOnly cookie.
// Fails closed when ADMIN_PASSWORD or SESSION_SECRET is missing. Data: D1 through the Edit token. Photos: R2.
import { revalidatePath, revalidateTag } from 'next/cache'
import { CONTENT_TAG } from './content'
import { DbError, query } from './db'
import { r2Delete, r2Put } from './r2'

type Row = Record<string, unknown>
class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message)
  }
}

const SESSION_SECONDS = 8 * 60 * 60
const COOKIE = 'admin_session'
const MAX_UPLOAD = 4_000_000 // Vercel functions accept bodies up to 4.5 MB
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

const configured = () => Boolean(process.env.ADMIN_PASSWORD && process.env.SESSION_SECRET)

async function makeSession() {
  const exp = Math.floor(Date.now() / 1000) + SESSION_SECONDS
  return `${exp}.${await hmac(process.env.SESSION_SECRET!, String(exp))}`
}

async function isAuthed(req: Request) {
  if (!configured()) return false
  const raw = /(?:^|;\s*)admin_session=([^;]+)/.exec(req.headers.get('Cookie') ?? '')?.[1]
  const [exp, sig] = (raw ?? '').split('.')
  if (!exp || !sig || !(Number(exp) > Date.now() / 1000)) return false
  return safeEqual(sig, await hmac(process.env.SESSION_SECRET!, exp))
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

// every edit expires the cache so visitors see it straight away
function refreshSite() {
  revalidateTag(CONTENT_TAG, { expire: 0 })
  revalidatePath('/', 'layout')
}

async function write<T = Row>(sql: string, params: unknown[]) {
  try {
    return await query<T>(sql, params, { write: true })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    if (/UNIQUE/i.test(msg)) throw new HttpError(409, 'That address is already used by another post')
    console.error('D1 error:', msg)
    if (/permission/i.test(msg)) throw new HttpError(502, 'The database token cannot write. Create one with "D1: Edit" and set it as D1_ADMIN_API_TOKEN.')
    throw new HttpError(502, e instanceof DbError ? 'Database error' : 'Database is not configured')
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

async function pathFor(p: PostInput) {
  const cats = await query<{ id: number; slug: string }>('SELECT id, slug FROM categories')
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

async function upload(req: Request) {
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
  await r2Put(key, bytes, kind.type)
  return `/${key}`
}

// ---------- routes ----------
export async function handleAdmin(req: Request): Promise<Response> {
  try {
    return await route(req)
  } catch (e) {
    if (e instanceof HttpError) return json({ error: e.message }, e.status)
    console.error(e)
    return json({ error: 'Something went wrong' }, 500)
  }
}

async function route(req: Request): Promise<Response> {
  const url = new URL(req.url)
  const [head, idPart] = url.pathname.replace(/^\/api\//, '').replace(/\/+$/, '').split('/')
  const secure = url.protocol === 'https:' || req.headers.get('x-forwarded-proto') === 'https'

  // state-changing requests must come from this site (SameSite=Strict already blocks cross-site cookies)
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    const origin = req.headers.get('Origin')
    if (origin && origin !== url.origin) throw new HttpError(403, 'Cross-site request blocked')
  }

  if (head === 'login' && req.method === 'POST') {
    if (!configured()) throw new HttpError(503, 'Admin is not set up yet. Set the ADMIN_PASSWORD and SESSION_SECRET environment variables.')
    const body = await readJson(req)
    const ok = typeof body.password === 'string' && (await safeEqual(body.password, process.env.ADMIN_PASSWORD!))
    if (!ok) {
      await new Promise((r) => setTimeout(r, 1000)) // slows password guessing
      throw new HttpError(401, 'Wrong password')
    }
    return json({ ok: true }, 200, { 'Set-Cookie': cookie(await makeSession(), SESSION_SECONDS, secure) })
  }
  if (head === 'logout' && req.method === 'POST') return json({ ok: true }, 200, { 'Set-Cookie': cookie('', 0, secure) })

  if (!(await isAuthed(req))) throw new HttpError(401, 'Please log in')

  if (head === 'session') return json({ ok: true })

  if (head === 'meta' && req.method === 'GET') {
    const [cats, authors] = await Promise.all([
      query('SELECT id, slug, name FROM categories ORDER BY name'),
      query("SELECT DISTINCT author, author_slug FROM posts WHERE author_slug != '' ORDER BY author"),
    ])
    return json({ categories: cats, authors: authors.map((a) => ({ name: a.author, slug: a.author_slug })) })
  }

  if (head === 'upload' && req.method === 'POST') return json({ path: await upload(req) }, 201)

  if (head === 'media' && req.method === 'DELETE') {
    const path = url.searchParams.get('path') ?? ''
    if (!/^\/media\/[a-z0-9/_.-]+$/.test(path) || path.includes('..')) throw new HttpError(400, 'Bad photo path')
    await r2Delete(path.slice(1)) // a copy cached at the edge disappears within a day (see app/media)
    return json({ ok: true })
  }

  if (head === 'posts') {
    if (!idPart && req.method === 'GET') {
      const rows = await query(`SELECT ${COLUMNS} FROM posts ORDER BY date DESC`)
      return json({ posts: rows.map((r) => publicRow(r)) })
    }
    if (!idPart && req.method === 'POST') {
      const p = parsePost(await readJson(req))
      const path = await pathFor(p)
      const rows = await write(
        `INSERT INTO posts (slug, path, date, title, excerpt, content, image, categories, author, author_slug)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)`,
        [p.slug, path, p.date, p.title, p.excerpt, p.content, p.image, JSON.stringify(p.categories), p.author, p.authorSlug],
      )
      refreshSite()
      return json({ id: rows.lastId, path }, 201)
    }
    const id = Number(idPart)
    if (!Number.isInteger(id) || id < 1) throw new HttpError(400, 'Bad post id')
    if (req.method === 'GET') {
      const rows = await query(`SELECT ${COLUMNS}, content FROM posts WHERE id = ?1`, [id])
      if (!rows[0]) throw new HttpError(404, 'Post not found')
      return json({ post: publicRow(rows[0], true) })
    }
    if (req.method === 'PUT') {
      const p = parsePost(await readJson(req))
      const path = await pathFor(p)
      if (!(await query('SELECT id FROM posts WHERE id = ?1', [id]))[0]) throw new HttpError(404, 'Post not found')
      await write(
        `UPDATE posts SET slug=?2, path=?3, date=?4, title=?5, excerpt=?6, content=?7, image=?8, categories=?9, author=?10, author_slug=?11
         WHERE id=?1`,
        [id, p.slug, path, p.date, p.title, p.excerpt, p.content, p.image, JSON.stringify(p.categories), p.author, p.authorSlug],
      )
      refreshSite()
      return json({ id, path })
    }
    if (req.method === 'DELETE') {
      await write('DELETE FROM posts WHERE id = ?1', [id])
      refreshSite()
      return json({ ok: true })
    }
  }

  throw new HttpError(404, 'Not found')
}
