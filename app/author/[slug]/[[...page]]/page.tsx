import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import Listing from '@/components/Listing'
import { getAuthor, getAuthorPage } from '@/lib/content'

// /author/x is page 1, /author/x/page/2 is page 2
type Props = { params: Promise<{ slug: string; page?: string[] }> }

export const revalidate = 3600
export const generateStaticParams = () => []

async function resolve(params: Props['params']) {
  const { slug, page } = await params
  if (page && !(page.length === 2 && page[0] === 'page' && /^[1-9]\d{0,3}$/.test(page[1]))) notFound()
  return { a: await getAuthor(decodeURIComponent(slug)), n: page ? Number(page[1]) : 1 }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { a } = await resolve(params)
  return a ? { title: a.name } : {}
}

export default async function Author({ params }: Props) {
  const { a, n } = await resolve(params)
  if (!a) notFound()
  const { data, total, pages } = await getAuthorPage(a.slug, n)
  if (n > pages) notFound()
  return <Listing title={a.name} total={total} posts={data} page={n} pages={pages} base={`/author/${a.slug}`} />
}
