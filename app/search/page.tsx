import type { Metadata } from 'next'
import Link from 'next/link'
import PostCard from '@/components/PostCard'
import Pagination from '@/components/Pagination'
import { searchPage } from '@/lib/content'

type Props = { searchParams: Promise<{ q?: string; page?: string }> }

export const metadata: Metadata = { title: 'തിരയൽ', robots: { index: false } }

// rendered per request: the results depend on what was typed
export default async function Search({ searchParams }: Props) {
  const sp = await searchParams
  const q = (sp.q ?? '').trim().slice(0, 200)
  const page = Math.min(1000, Math.max(1, Number(sp.page) || 1))
  const { data, total, pages } = await searchPage(q, page)
  return (
    <div className="wrap">
      <header className="page-head">
        <h1>{q ? `തിരയൽ: ${q}` : 'തിരയൽ'}</h1>
        {/* no autofocus: on a phone it would open the keyboard before anyone asked to type */}
        <form action="/search" className="search-form search-form--page">
          <input type="search" name="q" defaultValue={q} placeholder="ലേഖനങ്ങൾ തിരയുക…" aria-label="തിരയുക" />
          <button type="submit">തിരയുക</button>
        </form>
        {q && total > 0 && <p>{total} ഫലങ്ങൾ</p>}
      </header>
      {q && total === 0 && (
        <p className="search-empty">
          “{q}” എന്നതിന് ഫലങ്ങളൊന്നും കണ്ടില്ല. വാക്കുകളുടെ എണ്ണം കുറച്ചോ മറ്റൊരു വാക്ക് ഉപയോഗിച്ചോ വീണ്ടും തിരയുക, അല്ലെങ്കിൽ <Link href="/">ഹോം പേജിലെ വിഭാഗങ്ങൾ</Link> നോക്കുക.
        </p>
      )}
      <div className="grid grid--3">
        {data.map((p) => (
          <PostCard key={p.id} p={p} excerpt />
        ))}
      </div>
      <Pagination page={page} pages={pages} base={`/search?q=${encodeURIComponent(q)}`} />
    </div>
  )
}
