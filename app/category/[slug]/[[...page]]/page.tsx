import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import Listing from '@/components/Listing'
import { getCategories, getCategoryPage, PER_PAGE, getAllPosts } from '@/lib/content'
import { decode } from '@/lib/format'

// /category/x is page 1, /category/x/page/2 is page 2 (the original WordPress addresses)
type Props = { params: Promise<{ slug: string; page?: string[] }> }

export async function generateStaticParams() {
  const [cats, posts] = await Promise.all([getCategories(), getAllPosts()])
  return cats.flatMap((c) => {
    const pages = Math.max(1, Math.ceil(posts.filter((p) => p.categories.includes(c.id)).length / PER_PAGE))
    return [{ slug: c.slug, page: [] as string[] }, ...Array.from({ length: pages - 1 }, (_, i) => ({ slug: c.slug, page: ['page', String(i + 2)] }))]
  })
}

async function resolve(params: Props['params']) {
  const { slug, page } = await params
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
  return <Listing title={decode(c.name)} total={total} posts={data} page={n} pages={pages} base={`/category/${c.slug}`} />
}
