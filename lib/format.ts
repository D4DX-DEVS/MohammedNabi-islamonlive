// Pure helpers and types, safe to import from browser code (nothing here touches the database).

export type Cat = { id: number; slug: string; name: string }
export type Post = {
  id: number
  slug: string
  path: string
  date: string
  title: string
  excerpt: string
  content: string // empty in listings
  image: string | null
  categories: number[]
  category?: Cat // primary category
  author: string
  authorSlug: string
}

// Photos are stored under /uploads in the R2 bucket; NEXT_PUBLIC_MEDIA_URL is that bucket's public address.
// Unset (plain local dev) leaves /uploads relative, which public/uploads serves.
const MEDIA = (process.env.NEXT_PUBLIC_MEDIA_URL ?? '').replace(/\/+$/, '')
export const media = (path: string) => (path.startsWith('/uploads/') ? MEDIA + path : path)

export function decode(s: string) {
  const named: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' }
  return s.replace(/&(#x?[0-9a-f]+|\w+);/gi, (m, e: string) =>
    e[0] === '#'
      ? String.fromCodePoint(e[1].toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : +e.slice(1))
      : named[e] ?? m)
}
export const text = (html: string) => decode(html.replace(/<[^>]+>/g, '')).trim()

// post bodies: lazy images, and drop inline colours so dark mode stays readable
export const cleanContent = (html: string) =>
  html
    .replace(/<img /g, '<img loading="lazy" decoding="async" ')
    .replace(/ style="([^"]*)"/g, (_, css: string) => {
      const kept = css.split(';').filter((d) => d.trim() && !/^\s*(color|background(-color)?)\s*:/i.test(d))
      return kept.length ? ` style="${kept.join(';')}"` : ''
    })
    // photos come from the media bucket
    .replace(/(["'(])\/uploads\//g, (_, q: string) => `${q}${media('/uploads/')}`)
    // internal links: drop the WordPress trailing slash and use uppercase %XX (lowercase would redirect)
    .replace(/href="(\/[^"?#]*?)\/"/g, 'href="$1"')
    .replace(/href="(\/[^"]*)"/g, (_, p: string) => `href="${p.replace(/%[0-9a-f]{2}/gi, (m) => m.toUpperCase())}"`)
    // dead localhost links become plain text
    .replace(/<a [^>]*href="http:\/\/localhost[^"]*"[^>]*>([\s\S]*?)<\/a>/g, '$1')
    // old posts embed audio over http://, which browsers block on https pages
    .replace(/(src|href)="http:\/\/(?:www\.)?thafheem\.net/g, '$1="https://thafheem.net')
    .replace(/<font [^>]*>/g, '<span>')
    .replace(/<\/font>/g, '</span>')

export const readingMinutes = (p: Post) => Math.max(1, Math.round(text(p.content).split(/\s+/).length / 150))
export const cat = (p: Post) => p.category
export const href = (p: Post) => encodeURI(p.path)
export const date = (p: Post) =>
  new Date(p.date).toLocaleDateString('ml-IN', { year: 'numeric', month: 'short', day: 'numeric' })
