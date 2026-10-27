// Uploads everything under public/uploads to the R2 bucket as uploads/<same path>, using the S3 API keys in .env.
//   node scripts/r2-upload.mjs
import { createHash, createHmac } from 'node:crypto'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

const { R2_ACCESS_KEY_ID: id, R2_SECRET_ACCESS_KEY: secret, R2_BUCKET_NAME: bucket, R2_ENDPOINT: endpoint } = process.env
if (!id || !secret || !bucket || !endpoint) throw new Error('Set R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME, R2_ENDPOINT in .env')

const TYPES = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp', svg: 'image/svg+xml' }
const hmac = (k, d) => createHmac('sha256', k).update(d).digest()
const sha = (d) => createHash('sha256').update(d).digest('hex')
const enc = (key) => key.split('/').map((s) => encodeURIComponent(s).replace(/[!'()*]/g, (c) => '%' + c.charCodeAt(0).toString(16).toUpperCase())).join('/')

async function put(key, body, contentType) {
  const host = new URL(endpoint).host
  const amz = new Date().toISOString().replace(/[:-]|\.\d{3}/g, '')
  const date = amz.slice(0, 8)
  const path = `/${bucket}/${enc(key)}`
  const payload = sha(body)
  const headers = `content-type:${contentType}\nhost:${host}\nx-amz-content-sha256:${payload}\nx-amz-date:${amz}\n`
  const signed = 'content-type;host;x-amz-content-sha256;x-amz-date'
  const canonical = ['PUT', path, '', headers, signed, payload].join('\n')
  const scope = `${date}/auto/s3/aws4_request`
  const sts = ['AWS4-HMAC-SHA256', amz, scope, sha(canonical)].join('\n')
  const signKey = hmac(hmac(hmac(hmac('AWS4' + secret, date), 'auto'), 's3'), 'aws4_request')
  const signature = createHmac('sha256', signKey).update(sts).digest('hex')
  const res = await fetch(endpoint + path, {
    method: 'PUT',
    body,
    headers: {
      'content-type': contentType,
      'x-amz-content-sha256': payload,
      'x-amz-date': amz,
      authorization: `AWS4-HMAC-SHA256 Credential=${id}/${scope}, SignedHeaders=${signed}, Signature=${signature}`,
    },
  })
  if (!res.ok) throw new Error(`${res.status} ${key}: ${(await res.text()).slice(0, 200)}`)
}

const walk = (d) => readdirSync(d).flatMap((n) => (statSync(join(d, n)).isDirectory() ? walk(join(d, n)) : [join(d, n)]))
let ok = 0
for (const f of walk('public/uploads')) {
  const key = 'uploads/' + relative('public/uploads', f).replaceAll('\\', '/')
  await put(key, readFileSync(f), TYPES[f.split('.').pop().toLowerCase()] ?? 'application/octet-stream')
  ok++
}
console.log(`uploaded ${ok} files to ${bucket}`)
