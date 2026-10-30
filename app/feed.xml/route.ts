import { getPosts } from '@/lib/content'
import { decode, href, text } from '@/lib/format'
import { SITE_DESC, SITE_NAME } from '@/lib/seo'
import { SITE_URL } from '@/lib/site'

// rendered per request from the database (the Worker stores the result until the next edit)
export const dynamic = 'force-dynamic'

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

export async function GET() {
  const posts = await getPosts(null, 20)
  const items = posts.map((p) => {
    const url = `${SITE_URL}${href(p)}`
    return `<item>
<title>${esc(text(p.title))}</title>
<link>${esc(url)}</link>
<guid isPermaLink="true">${esc(url)}</guid>
<pubDate>${new Date(p.date).toUTCString()}</pubDate>${p.author ? `\n<dc:creator>${esc(p.author)}</dc:creator>` : ''}${p.category ? `\n<category>${esc(decode(p.category.name))}</category>` : ''}
<description>${esc(text(p.excerpt))}</description>
</item>`
  })
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:atom="http://www.w3.org/2005/Atom">
<channel>
<title>${esc(SITE_NAME)}</title>
<link>${esc(SITE_URL)}</link>
<atom:link href="${esc(SITE_URL)}/feed.xml" rel="self" type="application/rss+xml"/>
<description>${esc(SITE_DESC)}</description>
<language>ml</language>
${items.join('\n')}
</channel>
</rss>
`
  return new Response(xml, { headers: { 'Content-Type': 'application/rss+xml; charset=utf-8' } })
}
