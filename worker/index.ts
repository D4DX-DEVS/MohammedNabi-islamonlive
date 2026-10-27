// Admin API. Visitors never reach this Worker: wrangler.jsonc only runs it for /api/*, everything else is static files.
// Auth: one password (secret ADMIN_PASSWORD) -> signed, expiring, HttpOnly cookie. Fails closed when secrets are missing.
// Data: the same D1 database the site is built from, through Cloudflare's REST API so it works from any account.

interface D1Like {
  prepare(statement: string): {
    bind(...values: unknown[]): { all(): Promise<{ results: Row[]; meta: { last_row_id: number } }> }
  }
}

interface Env {
  ASSETS: { fetch(req: Request): Promise<Response> }
  DB?: D1Like // D1 binding; used when the Worker runs in the same Cloudflare account as the database
  ADMIN_PASSWORD?: string
  SESSION_SECRET?: string
  D1_ACCOUNT_ID?: string
  D1_DATABASE_ID?: string
  D1_API_TOKEN?: string
  GH_REPO?: string // "owner/name", with GH_DISPATCH_TOKEN enables the Publish button
  GH_DISPATCH_TOKEN?: string
  GH_WORKFLOW?: string
}

type Row = Record<string, unknown>
class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message)
  }
}

const SESSION_SECONDS = 8 * 60 * 60
const COOKIE = 'admin_session'
const enc = new TextEncoder()

// ---------- small helpers ----------
const json = (data: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
      ...headers,
    },
  })

async function hmac(secret: string, data: string) {
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const sig = new Uint8Array(await crypto.subtle.sign('HMAC', key, enc.encode(data)))
  return Array.from(sig, (b) => b.toString(16).padStart(2, '0')).join('')
}

// compares digests of both values, so length and content do not leak through timing
async function safeEqual(a: string, b: string) {
  const [x, y] = await Promise.all([
    crypto.subtle.digest('SHA-256', enc.encode(a)),
    crypto.subtle.digest('SHA-256', enc.encode(b)),
  ])
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
// Uses the binding when there is one. Otherwise goes through Cloudflare's REST API, which works from any account
// but needs D1_API_TOKEN with "D1: Edit" (the read-only token used for building the site cannot write).
async function sql<T = Row>(env: Env, statement: string, params: unknown[] = []): Promise<{ rows: T[]; lastId: number }> {
  if (env.DB) {
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
  const { D1_ACCOUNT_ID: account, D1_DATABASE_ID: db, D1_API_TOKEN: token } = env
  if (!account || !db || !token) throw new HttpError(503, 'Database is not configured')
  const res = await fetch(`https://api.cloudflare.com/client/v4/accounts/${account}/d1/database/${db}/query`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ sql: statement, params }),
  })
  const body = (await res.json().catch(() => null)) as {
    success: boolean
    errors?: { message: string }[]
    result?: { results: T[]; meta: { last_row_id: number } }[]
  } | null
  if (!body?.success || !body.result) {
    const msg = body?.errors?.[0]?.message ?? `D1 error ${res.status}`
    if (/UNIQUE/i.test(msg)) throw new HttpError(409, 'That address is already used by another post')
    console.error('D1 error:', msg)
    if (/permission/i.test(msg)) throw new HttpError(502, 'The database token cannot write. Create one with "D1: Edit" and set it as D1_API_TOKEN.')
    throw new HttpError(502, 'Database error')
  }
  return { rows: body.result[0].results, lastId: body.result[0].meta.last_row_id }
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
  if (image && !/^(\/uploads\/[^\s"'<>]+|https:\/\/[^\s"'<>]+)$/.test(image)) {
    throw new HttpError(400, 'Image must be /uploads/... or an https:// address')
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

// ---------- routes ----------
async function handle(req: Request, env: Env): Promise<Response> {
  const url = new URL(req.url)
  const route = url.pathname.replace(/^\/api\//, '').replace(/\/+$/, '')
  const [head, idPart] = route.split('/')
  const secure = url.protocol === 'https:'

  // state-changing requests must come from this site (SameSite=Strict already blocks cross-site cookies)
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    const origin = req.headers.get('Origin')
    if (origin && origin !== url.origin) throw new HttpError(403, 'Cross-site request blocked')
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
      publishConfigured: Boolean(env.GH_REPO && env.GH_DISPATCH_TOKEN),
    })
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
      const { rows } = await sql(env, 'SELECT id FROM posts WHERE id = ?1', [id])
      if (!rows[0]) throw new HttpError(404, 'Post not found')
      await sql(
        env,
        `UPDATE posts SET slug=?2, path=?3, date=?4, title=?5, excerpt=?6, content=?7, image=?8, categories=?9, author=?10, author_slug=?11
         WHERE id=?1`,
        [id, p.slug, path, p.date, p.title, p.excerpt, p.content, p.image, JSON.stringify(p.categories), p.author, p.authorSlug],
      )
      return json({ id, path })
    }
    if (req.method === 'DELETE') {
      await sql(env, 'DELETE FROM posts WHERE id = ?1', [id])
      return json({ ok: true })
    }
  }

  if (head === 'publish') {
    if (!env.GH_REPO || !env.GH_DISPATCH_TOKEN) throw new HttpError(501, 'Publishing is not set up yet')
    const workflow = env.GH_WORKFLOW ?? 'deploy.yml'
    const gh = (path: string, init?: RequestInit) =>
      fetch(`https://api.github.com/repos/${env.GH_REPO}/actions/workflows/${workflow}/${path}`, {
        ...init,
        headers: {
          Authorization: `Bearer ${env.GH_DISPATCH_TOKEN}`,
          Accept: 'application/vnd.github+json',
          'X-GitHub-Api-Version': '2022-11-28',
          'User-Agent': 'muhammad-nabi-admin',
        },
      })
    if (req.method === 'POST') {
      const res = await gh('dispatches', { method: 'POST', body: JSON.stringify({ ref: 'main' }) })
      if (res.status !== 204) throw new HttpError(502, 'Could not start the publish job')
      return json({ ok: true })
    }
    if (req.method === 'GET') {
      const res = await gh('runs?per_page=1')
      if (!res.ok) throw new HttpError(502, 'Could not read the publish status')
      const run = ((await res.json()) as { workflow_runs?: Row[] }).workflow_runs?.[0]
      return json({ run: run ? { status: run.status, conclusion: run.conclusion, createdAt: run.created_at, url: run.html_url } : null })
    }
  }

  throw new HttpError(404, 'Not found')
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    if (!new URL(req.url).pathname.startsWith('/api/')) return env.ASSETS.fetch(req)
    try {
      return await handle(req, env)
    } catch (e) {
      if (e instanceof HttpError) return json({ error: e.message }, e.status)
      console.error(e)
      return json({ error: 'Something went wrong' }, 500)
    }
  },
}
