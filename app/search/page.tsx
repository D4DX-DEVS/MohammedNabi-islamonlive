import type { Metadata } from 'next'
import PostCard from '@/components/PostCard'
import Pagination from '@/components/Pagination'
import { searchPage } from '@/lib/content'

type Props = { searchParams: Promise<{ q?: string; page?: string }> }

export const metadata: Metadata = { title: 'Search', robots: { index: false } }

export default async function Search({ searchParams }: Props) {
  const sp = await searchParams
  const q = (sp.q ?? '').trim()
  const page = Math.max(1, Number(sp.page) || 1)
  const { data, total, pages } = await searchPage(q, page)
  return (
    <div className="wrap">
      <header className="page-head">
        <h1>{q ? `Search: ${q}` : 'Search'}</h1>
        <form action="/search" className="search-form search-form--page">
          <input type="search" name="q" defaultValue={q} placeholder="Search articles…" aria-label="Search" autoFocus />
          <button type="submit">Search</button>
        </form>
        {q && <p>{total} result{total === 1 ? '' : 's'}</p>}
      </header>
      <div className="grid grid--3">
        {data.map((p) => (
          <PostCard key={p.id} p={p} excerpt />
        ))}
      </div>
      <Pagination page={page} pages={pages} base={`/search?q=${encodeURIComponent(q)}`} />
    </div>
  )
}
