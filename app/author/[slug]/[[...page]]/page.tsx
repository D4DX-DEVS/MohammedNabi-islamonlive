import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import Listing from '@/components/Listing'
import { getAllPosts, getAuthor, getAuthorPage, getAuthors, PER_PAGE } from '@/lib/content'

// /author/x is page 1, /author/x/page/2 is page 2
type Props = { params: Promise<{ slug: string; page?: string[] }> }

export async function generateStaticParams() {
  const [authors, posts] = await Promise.all([getAuthors(), getAllPosts()])
  return authors.flatMap((a) => {
    const pages = Math.max(1, Math.ceil(posts.filter((p) => p.authorSlug === a.slug).length / PER_PAGE))
    return [{ slug: a.slug, page: [] as string[] }, ...Array.from({ length: pages - 1 }, (_, i) => ({ slug: a.slug, page: ['page', String(i + 2)] }))]
  })
}

async function resolve(params: Props['params']) {
  const { slug, page } = await params
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
  return <Listing title={a.name} total={total} posts={data} page={n} pages={pages} base={`/author/${a.slug}`} />
}
