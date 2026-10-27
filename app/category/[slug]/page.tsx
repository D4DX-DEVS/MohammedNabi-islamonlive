import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import PostCard from '@/components/PostCard'
import Pagination from '@/components/Pagination'
import { decode, getCategories, getCategoryPage } from '@/lib/content'

type Props = { params: Promise<{ slug: string }>; searchParams: Promise<{ page?: string }> }

const find = async (params: Props['params']) => {
  const slug = decodeURIComponent((await params).slug)
  return (await getCategories()).find((x) => x.slug === slug)
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const c = await find(params)
  return c ? { title: decode(c.name) } : {}
}

export default async function Category({ params, searchParams }: Props) {
  const c = await find(params)
  if (!c) notFound()
  const page = Math.max(1, Number((await searchParams).page) || 1)
  const { data, total, pages } = await getCategoryPage(c.id, page)
  return (
    <div className="wrap">
      <header className="page-head">
        <h1>{decode(c.name)}</h1>
        <p>{total} posts</p>
      </header>
      <div className="grid grid--3">
        {data.map((p) => (
          <PostCard key={p.id} p={p} />
        ))}
      </div>
      <Pagination page={page} pages={pages} base={`/category/${c.slug}`} />
    </div>
  )
}
