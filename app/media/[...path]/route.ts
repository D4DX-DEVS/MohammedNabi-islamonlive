import { r2Get } from '@/lib/r2'

// Photos uploaded in the admin live in the R2 bucket; this serves them. File names carry a random part and never change,
// so browsers and Vercel's CDN may keep them for a year.
export async function GET(_req: Request, { params }: { params: Promise<{ path: string[] }> }) {
  const parts = (await params).path.map((s) => {
    try { return decodeURIComponent(s) } catch { return s }
  })
  const key = `media/${parts.join('/')}`
  if (!/^media\/[a-z0-9/_.-]+$/.test(key) || key.includes('..')) return new Response('Not found', { status: 404 })

  const res = await r2Get(key).catch(() => null)
  if (!res) return new Response('Not found', { status: 404 })
  return new Response(res.body, {
    headers: {
      'Content-Type': res.headers.get('Content-Type') ?? 'application/octet-stream',
      'Cache-Control': 'public, max-age=31536000, s-maxage=31536000, immutable',
      'X-Content-Type-Options': 'nosniff',
      // an image can never run anything even if opened directly
      'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; sandbox",
    },
  })
}
