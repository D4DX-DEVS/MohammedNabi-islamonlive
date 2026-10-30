import type { Metadata } from 'next'
import { notFound, permanentRedirect } from 'next/navigation'
import { cache } from 'react'
import Breadcrumbs from '@/components/Breadcrumbs'
import JsonLd from '@/components/JsonLd'
import Listing from '@/components/Listing'
import { getAuthorPage } from '@/lib/content'
import { pageMeta } from '@/lib/seo'
import { SITE_URL } from '@/lib/site'

// /author/x is page 1, /author/x/page/2 is page 2
type Props = { params: Promise<{ slug: string; page?: string[] }> }

export const revalidate = 86400
export const generateStaticParams = () => []

// one lookup serves both the metadata and the page; an empty page means unknown author or a page past the end
const resolve = cache(async (params: Props['params']) => {
  const { slug, page } = await params
  if (page && !(page.length === 2 && page[0] === 'page' && /^[1-9]\d{0,3}$/.test(page[1]))) notFound()
  const s = decodeURIComponent(slug)
  const base = `/author/${encodeURIComponent(s)}`
  const n = page ? Number(page[1]) : 1
  if (n === 1 && page) permanentRedirect(base) // /page/1 is the same page as the author itself
  const r = await getAuthorPage(s, n)
  if (!r.data.length) notFound()
  return { s, n, base, name: r.data[0].author, ...r }
})

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { name, n, base, total } = await resolve(params)
  return pageMeta({
    title: n > 1 ? `${name} - Page ${n}` : name,
    description: `${name} എഴുതിയ ${total} പോസ്റ്റുകൾ${n > 1 ? ` (പേജ് ${n})` : ''} - Mohammed Nabi.`,
    path: n > 1 ? `${base}/page/${n}` : base,
  })
}

export default async function Author({ params }: Props) {
  const { n, base, name, data, total, pages } = await resolve(params)
  return (
    <>
      <div className="wrap"><Breadcrumbs trail={[{ name: 'ഹോം', path: '/' }, { name, path: base }]} /></div>
      <Listing title={name} total={total} posts={data} page={n} pages={pages} base={base} />
      <JsonLd data={{
        '@context': 'https://schema.org', '@type': 'ProfilePage', url: `${SITE_URL}${base}`, inLanguage: 'ml',
        mainEntity: { '@type': 'Person', name, url: `${SITE_URL}${base}` },
      }} />
    </>
  )
}
