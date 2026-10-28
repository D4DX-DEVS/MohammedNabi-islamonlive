import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import Listing from '@/components/Listing'
import { getCategories, getCategoryPage } from '@/lib/content'
import { decode } from '@/lib/format'

// /category/x is page 1, /category/x/page/2 is page 2 (the original WordPress addresses)
type Props = { params: Promise<{ slug: string; page?: string[] }> }

export const revalidate = 3600
export const generateStaticParams = () => [] // built on first visit, then cached; the admin refreshes the cache on every edit

async function resolve(params: Props['params']) {
  const { slug, page } = await params
  if (page && !(page.length === 2 && page[0] === 'page' && /^[1-9]\d{0,3}$/.test(page[1]))) notFound()
  const c = (await getCategories()).find((x) => x.slug === decodeURIComponent(slug))
  return { c, n: page ? Number(page[1]) : 1 }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { c } = await resolve(params)
  return c ? { title: decode(c.name) } : {}
}

export default async function Category({ params }: Props) {
  const { c, n } = await resolve(params)
  if (!c) notFound()
  const { data, total, pages } = await getCategoryPage(c.id, n)
  if (n > pages) notFound()
  return <Listing title={decode(c.name)} total={total} posts={data} page={n} pages={pages} base={`/category/${c.slug}`} />
}
