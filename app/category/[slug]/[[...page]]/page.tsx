import type { Metadata } from 'next'
import { notFound, permanentRedirect } from 'next/navigation'
import { cache } from 'react'
import Breadcrumbs from '@/components/Breadcrumbs'
import JsonLd from '@/components/JsonLd'
import Listing from '@/components/Listing'
import { getCategories, getCategoryPage } from '@/lib/content'
import { decode } from '@/lib/format'
import { pageMeta } from '@/lib/seo'
import { SITE_URL } from '@/lib/site'

// /category/x is page 1, /category/x/page/2 is page 2 (the original WordPress addresses)
type Props = { params: Promise<{ slug: string; page?: string[] }> }

export const revalidate = 86400
export const generateStaticParams = () => [] // built on first visit, then cached; the admin refreshes the cache on every edit

// one lookup serves both the metadata and the page
const resolve = cache(async (params: Props['params']) => {
  const { slug, page } = await params
  if (page && !(page.length === 2 && page[0] === 'page' && /^[1-9]\d{0,3}$/.test(page[1]))) notFound()
  const c = (await getCategories()).find((x) => x.slug === decodeURIComponent(slug))
  if (!c) notFound()
  const base = `/category/${encodeURIComponent(c.slug)}`
  const n = page ? Number(page[1]) : 1
  if (n === 1 && page) permanentRedirect(base) // /page/1 is the same page as the category itself
  const r = await getCategoryPage(c.id, n)
  if (n > r.pages) notFound()
  return { c, n, base, name: decode(c.name), ...r }
})

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { name, n, base, total } = await resolve(params)
  return pageMeta({
    title: n > 1 ? `${name} - Page ${n}` : name,
    description: `${name} വിഭാഗത്തിലെ ${total} പോസ്റ്റുകൾ${n > 1 ? ` (പേജ് ${n})` : ''} - Mohammed Nabi.`,
    path: n > 1 ? `${base}/page/${n}` : base,
  })
}

export default async function Category({ params }: Props) {
  const { n, base, name, data, total, pages } = await resolve(params)
  return (
    <>
      <div className="wrap"><Breadcrumbs trail={[{ name: 'Home', path: '/' }, { name, path: base }]} /></div>
      <Listing title={name} total={total} posts={data} page={n} pages={pages} base={base} />
      <JsonLd data={{
        '@context': 'https://schema.org', '@type': 'CollectionPage', name, url: `${SITE_URL}${base}`, inLanguage: 'ml',
        isPartOf: { '@type': 'WebSite', name: 'Mohammed Nabi', url: SITE_URL },
      }} />
    </>
  )
}
