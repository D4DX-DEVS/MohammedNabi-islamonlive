// Types and helpers shared by the admin screens.
export type Cat = { id: number; slug: string; name: string }
export type Author = { name: string; slug: string }
export type Meta = { categories: Cat[]; authors: Author[]; publishConfigured?: boolean }
export type Row = { id: number; path: string; date: string; title: string; categories: number[]; author: string; image: string | null }
export type Post = Row & { slug: string; excerpt: string; authorSlug: string; content: string }

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message)
  }
}

export async function api<T = Record<string, unknown>>(path: string, method = 'GET', body?: unknown): Promise<T> {
  const res = await fetch(`/api/${path}`, {
    method,
    credentials: 'same-origin',
    headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  const data = (await res.json().catch(() => ({}))) as { error?: string }
  if (!res.ok) throw new ApiError(res.status, data.error ?? `Request failed (${res.status})`)
  return data as T
}

// Photos are shrunk to WebP (max 1600 px wide) in the browser before upload: smaller files, faster pages.
// GIFs and anything that does not get smaller are sent as they are.
async function preparePhoto(file: File): Promise<Blob> {
  if (!/^image\/(jpeg|png|webp)$/.test(file.type)) return file
  try {
    const bmp = await createImageBitmap(file)
    const scale = Math.min(1, 1600 / bmp.width)
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(bmp.width * scale)
    canvas.height = Math.round(bmp.height * scale)
    canvas.getContext('2d')!.drawImage(bmp, 0, 0, canvas.width, canvas.height)
    const webp = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/webp', 0.82))
    return webp && webp.size < file.size ? webp : file
  } catch {
    return file
  }
}

export async function uploadPhoto(file: File): Promise<string> {
  const blob = await preparePhoto(file)
  const res = await fetch('/api/upload', {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'Content-Type': blob.type || 'application/octet-stream', 'X-File-Name': encodeURIComponent(file.name) },
    body: blob,
  })
  const data = (await res.json().catch(() => ({}))) as { path?: string; error?: string }
  if (!res.ok || !data.path) throw new ApiError(res.status, data.error ?? 'Upload failed')
  return data.path
}

// ---- small helpers so editors never have to type technical fields ----
export const plainText = (html: string) =>
  html.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim()

export const slugify = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
// Latin titles give a readable address; Malayalam titles get a short unique one
export const autoSlug = (title: string) => slugify(title) || `post-${Date.now().toString(36)}`
export const autoAuthorSlug = (name: string) => (name.trim() ? slugify(name) || `author-${Math.abs([...name].reduce((h, c) => (h * 31 + c.charCodeAt(0)) | 0, 7)).toString(36)}` : '')
export const summaryOf = (html: string) => {
  const t = plainText(html)
  return t.length > 220 ? t.slice(0, 217).trimEnd() + '…' : t
}

export const nowLocal = () => new Date().toISOString().slice(0, 16)
export const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })
