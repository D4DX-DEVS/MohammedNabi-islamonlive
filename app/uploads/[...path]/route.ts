import { getCloudflareContext } from '@opennextjs/cloudflare'

const TYPES: Record<string, string> = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp', svg: 'image/svg+xml' }

// Photos live in the R2 bucket under the same /uploads/... path they had before.
export async function GET(_req: Request, { params }: { params: Promise<{ path: string[] }> }) {
  const parts = (await params).path.map((s) => {
    try { return decodeURIComponent(s) } catch { return s }
  })
  let bucket: R2Bucket | undefined
  try { bucket = getCloudflareContext().env.UPLOADS } catch {} // not running in the Worker (plain `next dev`)
  const obj = await bucket?.get(`uploads/${parts.join('/')}`)
  if (!obj) return new Response('Not found', { status: 404 })
  const headers = new Headers()
  obj.writeHttpMetadata(headers)
  if (!headers.get('content-type')) headers.set('content-type', TYPES[parts.at(-1)!.split('.').pop()!.toLowerCase()] ?? 'application/octet-stream')
  headers.set('etag', obj.httpEtag)
  headers.set('Cache-Control', 'public, max-age=604800')
  return new Response(obj.body, { headers })
}
