import type { MetadataRoute } from 'next'
import { getAllPosts, getAuthors, getCategories } from '@/lib/content'
import { SITE_URL } from '@/lib/site'

export const dynamic = 'force-static'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const abs = (p: string) => `${SITE_URL}${p}`
  const [cats, authors, posts] = await Promise.all([getCategories(), getAuthors(), getAllPosts()])
  return [
    { url: abs('/') },
    ...cats.map((c) => ({ url: abs(`/category/${c.slug}`) })),
    ...authors.map((a) => ({ url: abs(`/author/${a.slug}`) })),
    ...posts.map((p) => ({ url: abs(encodeURI(p.path)), lastModified: p.date })),
  ]
}
