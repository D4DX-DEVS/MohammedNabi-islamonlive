// Wraps the OpenNext worker with a short edge cache so pages read from D1 once per few minutes, not on every hit.
// The Cache API only stores on custom domains (not *.workers.dev), where this is simply a pass-through.
// @ts-ignore .open-next/ only exists after `opennextjs-cloudflare build`, so this must compile with and without it
import handler from './.open-next/worker.js'

const PAGE_TTL = 300 // seconds a rendered page may be served from the edge before re-reading D1

export default {
  async fetch(request: Request, env: CloudflareEnv, ctx: ExecutionContext): Promise<Response> {
    const { pathname } = new URL(request.url)
    // search results are unique per query, so caching them would only fill the cache
    if (request.method !== 'GET' || pathname.startsWith('/search')) return handler.fetch(request, env, ctx)

    const cache = (caches as unknown as { default: Cache }).default
    // keyed by deployment: HTML cached from an older deploy would point at JS files that no longer exist
    const key = new Request(`${request.url}${request.url.includes('?') ? '&' : '?'}__v=${env.CF_VERSION_METADATA?.id ?? 'dev'}`)
    const hit = await cache.match(key)
    if (hit) return hit

    const res: Response = await handler.fetch(request, env, ctx)
    if (res.status !== 200) return res
    const out = new Response(res.body, res)
    const type = out.headers.get('content-type') ?? ''
    if (/text\/html|xml|text\/plain/.test(type)) {
      // browsers always revalidate, the edge keeps it for PAGE_TTL
      out.headers.set('Cache-Control', `public, max-age=0, s-maxage=${PAGE_TTL}`)
    } else if (!/public/.test(out.headers.get('cache-control') ?? '')) {
      return out
    }
    ctx.waitUntil(cache.put(key, out.clone()))
    return out
  },
}
