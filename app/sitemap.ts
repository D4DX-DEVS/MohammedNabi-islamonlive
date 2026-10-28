import type { MetadataRoute } from 'next'
import { getCategories, getSitemapEntries } from '@/lib/content'
import { SITE_URL } from '@/lib/site'

// built per request (from cached data) so a new post appears the moment the admin saves it
export const dynamic = 'force-dynamic'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const abs = (p: string) => `${SITE_URL}${p}`
  const [cats, { posts, authors }] = await Promise.all([getCategories(), getSitemapEntries()])
  return [
    { url: abs('/') },
    ...cats.map((c) => ({ url: abs(`/category/${c.slug}`) })),
    ...authors.map((slug) => ({ url: abs(`/author/${slug}`) })),
    ...posts.map((p) => ({ url: abs(encodeURI(p.path)), lastModified: p.date })),
  ]
}
