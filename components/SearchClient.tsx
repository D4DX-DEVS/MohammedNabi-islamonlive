'use client'

import { useSearchParams } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'
import Pagination from './Pagination'
import PostCard from './PostCard'
import type { Post } from '@/lib/format'

type Entry = Post & { s: string } // s: lowercase plain text of the whole post
const PER_PAGE = 12

// The index is a static file (/search-index.json); fetch it once, and only when someone actually searches.
let index: Promise<Entry[]> | undefined
const loadIndex = () => (index ??= fetch('/search-index.json').then((r) => r.json()))

export default function SearchClient() {
  const params = useSearchParams()
  const q = (params.get('q') ?? '').trim()
  const page = Math.max(1, Number(params.get('page')) || 1)
  const [entries, setEntries] = useState<Entry[] | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    if (!q) return
    loadIndex().then(setEntries, () => {
      index = undefined // let the next search retry
      setFailed(true)
    })
  }, [q])

  // every word must appear somewhere in the post
  const results = useMemo(() => {
    const terms = q.toLowerCase().split(/\s+/).filter(Boolean).slice(0, 5)
    return entries && terms.length ? entries.filter((e) => terms.every((t) => e.s.includes(t))) : []
  }, [entries, q])
  const pages = Math.max(1, Math.ceil(results.length / PER_PAGE))
  const shown = results.slice((page - 1) * PER_PAGE, page * PER_PAGE)

  return (
    <div className="wrap">
      <header className="page-head">
        <h1>{q ? `Search: ${q}` : 'Search'}</h1>
        <form action="/search" className="search-form search-form--page">
          <input type="search" name="q" defaultValue={q} placeholder="Search articles…" aria-label="Search" autoFocus />
          <button type="submit">Search</button>
        </form>
        {q && failed && <p>Search is unavailable right now. Please try again.</p>}
        {q && !failed && !entries && <p>Searching…</p>}
        {q && entries && <p>{results.length} result{results.length === 1 ? '' : 's'}</p>}
      </header>
      <div className="grid grid--3">
        {shown.map((p) => (
          <PostCard key={p.id} p={p} excerpt />
        ))}
      </div>
      <Pagination page={page} pages={pages} base={`/search?q=${encodeURIComponent(q)}`} />
    </div>
  )
}
