// Entry point of the deployed Worker: the Next.js app (OpenNext) wrapped in a page store, plus the admin API.
//
// Pages render from D1 on request. The free plan cuts a request off after 10 ms of CPU and D1 allows 5M row reads a
// day, so every public page is rendered once and then stored:
//   1. the edge cache of the Cloudflare location serving the visitor (fastest, per location)
//   2. the R2 bucket (shared by every location: a page is rendered once for the whole world)
// A stored page stays valid until the next admin change (worker/api.ts writes `cache/purged`) or MAX_AGE, so a saved
// post shows up on its next visit. A Cron Trigger also renders a few pages nobody has asked for yet on every run.
// If D1 fails while a page is rendered, the old stored copy is served instead of an error.
// (Same design as the fatwa site.)
import { type Env as ApiEnv, PURGED, handleApi, publicHost } from './api'
// the file only exists after `opennextjs-cloudflare build`, so the type checker cannot resolve it
// @ts-ignore
import openNext from '../.open-next/worker.js'

type Env = ApiEnv & { WORKER_SELF_REFERENCE?: { fetch(req: Request): Promise<Response> } }
type Ctx = { waitUntil(p: Promise<unknown>): void }

const MAX_AGE = 7 * 86_400_000 // ms a stored page is trusted even without a change
const PAGES = 'cache/pages' // R2 prefix: one object per page path
const STAMP = 'x-cached-at'
const WARM_PER_RUN = 5 // a free-plan invocation may make 50 subrequests
const TEXT = /^(text\/(html|plain|xml|x-component)|application\/(xml|rss\+xml))/

const edge = () => (caches as unknown as { default: Cache }).default
const valid = (at: number, purged: number) => at > purged && Date.now() - at < MAX_AGE

// time of the last admin change; looked up in R2 at most every 30 s per location
async function purgedAt(env: Env, ctx: Ctx): Promise<number> {
  const k = new Request('https://cache.internal/purged')
  const hit = await edge().match(k)
  if (hit) return Number(await hit.text())
  const obj = await env.MEDIA.get(PURGED)
  const t = obj ? Number(await obj.text()) : 0
  ctx.waitUntil(edge().put(k, new Response(String(t), { headers: { 'cache-control': 'public, max-age=30' } })))
  return t
}

// what the browser gets: always ask the edge again, the edge decides what is still good
const toBrowser = (body: BodyInit | null, type: string) =>
  new Response(body, { headers: { 'content-type': type, 'cache-control': 'public, max-age=0, must-revalidate' } })

// On the free plan a fresh render can be cut off at 10 ms of CPU. A cut-off ends the whole invocation, so the render runs
// in a separate one (the Worker calling itself) that this wrapper can retry. Only calls carrying the key, which is derived
// from a secret, skip the store, so nobody outside can force renders.
const renderKey = (env: Env) => (env.ADMIN_PASSWORD ? `render:${env.ADMIN_PASSWORD}` : null)

async function render(request: Request, env: Env, ctx: Ctx): Promise<Response> {
  const key = renderKey(env)
  const self = env.WORKER_SELF_REFERENCE
  if (!key || !self) return openNext.fetch(request, env, ctx)
  const headers = new Headers(request.headers)
  headers.set('x-render', key)
  let last: Response | undefined
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      last = await self.fetch(new Request(request, { headers }))
      if (last.status < 500) return last
    } catch (e) {
      console.error('render attempt failed', attempt, e)
    }
    // after a burst of heavy renders the free plan cuts off several in a row; waiting costs no CPU and lets it recover
    if (attempt < 2) await new Promise((done) => setTimeout(done, 400 * (attempt + 1)))
  }
  return last ?? openNext.fetch(request, env, ctx)
}

async function handle(request: Request, env: Env, ctx: Ctx): Promise<Response> {
  const url = new URL(request.url)
  const rsc = url.searchParams.has('_rsc') || request.headers.has('rsc') // Next's client-side navigation
  const r2Key = !rsc && !url.searchParams.has('q') && url.pathname.length + url.search.length < 800 ? `${PAGES}${url.pathname}${url.search}` : null
  const key = new Request(url.toString())
  const purged = await purgedAt(env, ctx)
  let stale: Response | undefined // an out-of-date copy, still better than an error

  const local = await edge().match(key)
  if (local) {
    const at = Number(local.headers.get(STAMP))
    if (valid(at, purged)) return toBrowser(local.body, local.headers.get('content-type') ?? 'text/html')
    stale = local
  }

  if (!stale && r2Key) {
    const obj = await env.MEDIA.get(r2Key)
    if (obj) {
      const at = Number(obj.customMetadata?.at)
      const type = obj.httpMetadata?.contentType ?? 'text/html'
      const body = await obj.arrayBuffer()
      if (valid(at, purged)) {
        ctx.waitUntil(edge().put(key, new Response(body, { headers: { 'content-type': type, 'cache-control': 'public, s-maxage=86400', [STAMP]: String(at) } })))
        return toBrowser(body, type)
      }
      stale = toBrowser(body, type)
    }
  }

  // not stored (or out of date): render it
  let res: Response
  try {
    res = await render(request, env, ctx)
  } catch (e) {
    if (stale) return stale
    throw e
  }
  if (res.status >= 500 && stale) return stale // D1 trouble: keep serving the old copy
  const type = res.headers.get('content-type') ?? ''
  if (res.status !== 200 || res.headers.has('set-cookie') || !TEXT.test(type)) return res

  const body = await res.arrayBuffer()
  const at = Date.now()
  ctx.waitUntil(
    Promise.all([
      edge().put(key, new Response(body, { headers: { 'content-type': type, 'cache-control': 'public, s-maxage=86400', [STAMP]: String(at) } })),
      r2Key ? env.MEDIA.put(r2Key, body, { httpMetadata: { contentType: type }, customMetadata: { at: String(at) } }) : undefined,
    ]),
  )
  return toBrowser(body, type)
}

// render a few pages that are not stored yet (or went out of date), sitemap order
async function warm(env: Env, ctx: Ctx) {
  const base = env.SITE_URL
  const purged = await purgedAt(env, ctx)
  const listed = await env.MEDIA.list({ prefix: `${PAGES}/`, limit: 1000, include: ['customMetadata'] })
  const stored = new Map(listed.objects.map((o) => [o.key, Number(o.customMetadata?.at)]))

  const sitemap = await handle(new Request(`${base}/sitemap.xml`), env, ctx)
  const locs = [...(await sitemap.text()).matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => new URL(m[1]).pathname)

  let left = WARM_PER_RUN
  for (const path of locs) {
    if (left <= 0) break
    const at = stored.get(`${PAGES}${path}`)
    if (at && valid(at, purged)) continue
    left--
    try {
      await handle(new Request(`${base}${path}`), env, ctx)
    } catch (e) {
      console.error('warm: page failed', path, e) // it stays unstored and the next run tries it again
    }
  }
}

// Search engines must only index the real domain. Every other address that serves this Worker (workers.dev, a staging
// name) answers robots.txt with "disallow all" and marks pages noindex. See publicHost for how the real domain is recognised.
function offDomain(request: Request, env: Env) {
  return publicHost(request, env) !== new URL(env.SITE_URL).host
}

// behind the forwarder, redirects must stay on the public address instead of sending visitors to workers.dev
function keepOnPublicHost(res: Response, request: Request, env: Env, url: URL) {
  const loc = res.headers.get('location')
  const host = publicHost(request, env)
  if (!loc?.startsWith(url.origin) || host === url.host) return res
  const out = new Response(res.body, res)
  out.headers.set('location', `https://${host}${loc.slice(url.origin.length)}`)
  return out
}

async function route(request: Request, env: Env, ctx: Ctx, url: URL): Promise<Response> {
  // only plain page loads are stored: not the admin
  if (request.method !== 'GET' || url.pathname.startsWith('/admin')) return openNext.fetch(request, env, ctx)
  return handle(request, env, ctx)
}

export default {
  async fetch(request: Request, env: Env, ctx: Ctx): Promise<Response> {
    const key = renderKey(env)
    if (key && request.headers.get('x-render') === key) return openNext.fetch(request, env, ctx) // the internal render call
    const url = new URL(request.url)
    if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/media/')) return handleApi(request, env)
    if (!offDomain(request, env)) return keepOnPublicHost(await route(request, env, ctx, url), request, env, url)
    if (url.pathname === '/robots.txt') return new Response('User-agent: *\nDisallow: /\n', { headers: { 'content-type': 'text/plain; charset=utf-8' } })
    const original = await route(request, env, ctx, url)
    const res = new Response(original.body, original) // copy, so the headers can be changed
    res.headers.set('x-robots-tag', 'noindex, nofollow')
    return res
  },

  async scheduled(_event: unknown, env: Env, ctx: Ctx) {
    ctx.waitUntil(warm(env, ctx).catch((e) => console.error('warm failed', e)))
  },
}
