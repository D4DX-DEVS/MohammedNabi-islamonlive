import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import PostCard from '@/components/PostCard'
import Pagination from '@/components/Pagination'
import { getAuthor, getAuthorPosts, getAuthors, paginate } from '@/lib/content'

type Props = { params: Promise<{ slug: string }>; searchParams: Promise<{ page?: string }> }

export const generateStaticParams = () => getAuthors().map((a) => ({ slug: a.slug }))

const find = async (params: Props['params']) => getAuthor(decodeURIComponent((await params).slug))

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const a = await find(params)
  return a ? { title: a.name } : {}
}

export default async function Author({ params, searchParams }: Props) {
  const a = await find(params)
  if (!a) notFound()
  const page = Math.max(1, Number((await searchParams).page) || 1)
  const all = getAuthorPosts(a.slug)
  const { data, pages } = paginate(all, page)
  return (
    <div className="wrap">
      <header className="page-head">
        <h1>{a.name}</h1>
        <p>{all.length} posts</p>
      </header>
      <div className="grid grid--3">
        {data.map((p) => (
          <PostCard key={p.id} p={p} />
        ))}
      </div>
      <Pagination page={page} pages={pages} base={`/author/${a.slug}`} />
    </div>
  )
}
