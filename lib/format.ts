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

// gives every h2/h3 an id and returns the list, for the "in this article" box
export function withToc(html: string) {
  const toc: { id: string; text: string }[] = []
  const out = html.replace(/<(h[23])(\s[^>]*)?>([\s\S]*?)<\/\1>/gi, (m, tag: string, attrs: string | undefined, inner: string) => {
    const t = text(inner)
    if (!t) return m
    const id = `s${toc.length + 1}`
    toc.push({ id, text: t })
    return `<${tag}${(attrs ?? '').replace(/\sid="[^"]*"/i, '')} id="${id}">${inner}</${tag}>`
  })
  return { html: out, toc }
}
