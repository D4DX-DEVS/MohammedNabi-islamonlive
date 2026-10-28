// Minimal client for Cloudflare R2's S3-compatible API (AWS Signature V4), so the Vercel-hosted site can use the bucket.
const enc = new TextEncoder()
const toHex = (b: ArrayBuffer) => Array.from(new Uint8Array(b), (x) => x.toString(16).padStart(2, '0')).join('')
const sha256 = async (d: string | Uint8Array) => toHex(await crypto.subtle.digest('SHA-256', typeof d === 'string' ? enc.encode(d) : (d as BufferSource)))
const rfc3986 = (s: string) => encodeURIComponent(s).replace(/[!'()*]/g, (c) => '%' + c.charCodeAt(0).toString(16).toUpperCase())

async function hmac(key: ArrayBuffer | string, data: string) {
  const raw = typeof key === 'string' ? enc.encode(key) : key
  const k = await crypto.subtle.importKey('raw', raw, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  return crypto.subtle.sign('HMAC', k, enc.encode(data))
}

async function request(method: 'GET' | 'PUT' | 'DELETE', key: string, body?: Uint8Array, contentType?: string) {
  const { R2_ENDPOINT: endpoint, R2_BUCKET_NAME: bucket, R2_ACCESS_KEY_ID: id, R2_SECRET_ACCESS_KEY: secret } = process.env
  if (!endpoint || !bucket || !id || !secret) throw new Error('Set R2_ENDPOINT, R2_BUCKET_NAME, R2_ACCESS_KEY_ID and R2_SECRET_ACCESS_KEY')

  const host = new URL(endpoint).host
  const amz = new Date().toISOString().replace(/[:-]|\.\d{3}/g, '')
  const date = amz.slice(0, 8)
  const path = `/${bucket}/${key.split('/').map(rfc3986).join('/')}`
  const payload = await sha256(body ?? '')

  const headers: Record<string, string> = { host, 'x-amz-content-sha256': payload, 'x-amz-date': amz }
  if (contentType) headers['content-type'] = contentType
  const names = Object.keys(headers).sort()
  const canonical = [method, path, '', ...names.map((n) => `${n}:${headers[n]}`), '', names.join(';'), payload].join('\n')
  const scope = `${date}/auto/s3/aws4_request`
  const toSign = ['AWS4-HMAC-SHA256', amz, scope, await sha256(canonical)].join('\n')
  const signingKey = await hmac(await hmac(await hmac(await hmac('AWS4' + secret, date), 'auto'), 's3'), 'aws4_request')
  const signature = toHex(await hmac(signingKey, toSign))

  const { host: _host, ...sendHeaders } = headers // fetch sets Host itself
  void _host
  return fetch(endpoint + path, {
    method,
    body: body as unknown as BodyInit | undefined,
    cache: 'no-store',
    headers: {
      ...sendHeaders,
      Authorization: `AWS4-HMAC-SHA256 Credential=${id}/${scope}, SignedHeaders=${names.join(';')}, Signature=${signature}`,
    },
  })
}

export async function r2Put(key: string, body: Uint8Array, contentType: string) {
  const res = await request('PUT', key, body, contentType)
  if (!res.ok) throw new Error(`R2 upload failed (${res.status})`)
}

export async function r2Get(key: string) {
  const res = await request('GET', key)
  return res.ok ? res : null
}

export async function r2Delete(key: string) {
  const res = await request('DELETE', key)
  if (!res.ok && res.status !== 404) throw new Error(`R2 delete failed (${res.status})`)
}
