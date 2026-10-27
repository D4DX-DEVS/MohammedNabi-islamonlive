import type { MetadataRoute } from 'next'
import index from '@/content/sitemap-index.json'
import { SITE_URL } from '@/lib/site'

export default function sitemap(): MetadataRoute.Sitemap {
  const abs = (p: string) => `${SITE_URL}${p}`
  return [
    { url: abs('/') },
    ...index.categories.map((slug) => ({ url: abs(`/category/${slug}`) })),
    ...index.authors.map((slug) => ({ url: abs(`/author/${slug}`) })),
    ...index.posts.map((p) => ({ url: abs(encodeURI(p.path)), lastModified: p.date })),
  ]
}
