'use client'

import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { useEffect, useState } from 'react'
import type { Post } from '@/lib/format'
import Pagination from './Pagination'
import PostCard from './PostCard'

type Result = { data: Post[]; total: number; pages: number }

export default function SearchResults() {
  const sp = useSearchParams()
  const q = (sp.get('q') ?? '').trim().slice(0, 200)
  const page = Math.min(1000, Math.max(1, Number(sp.get('page')) || 1))
  const [res, setRes] = useState<(Result & { key: string }) | null>(null)
  const [failed, setFailed] = useState(false)
  const key = `${q}|${page}`

  useEffect(() => {
    if (!q) return
    const ctl = new AbortController()
    setFailed(false)
    fetch(`/api/search?q=${encodeURIComponent(q)}&page=${page}`, { signal: ctl.signal })
      .then((r) => (r.ok ? (r.json() as Promise<Result>) : Promise.reject(new Error(String(r.status)))))
      .then((r) => setRes({ ...r, key }))
      .catch((e) => { if (e.name !== 'AbortError') setFailed(true) })
    return () => ctl.abort()
  }, [q, page, key])

  const done = res?.key === key ? res : null
  return (
    <div className="wrap">
      <header className="page-head">
        <h1>{q ? `തിരയൽ: ${q}` : 'തിരയൽ'}</h1>
        {/* no autofocus: on a phone it would open the keyboard before anyone asked to type */}
        <form action="/search" className="search-form search-form--page">
          <input type="search" name="q" defaultValue={q} placeholder="ലേഖനങ്ങൾ തിരയുക…" aria-label="തിരയുക" />
          <button type="submit">തിരയുക</button>
        </form>
        {done && done.total > 0 && <p>{done.total} ഫലങ്ങൾ</p>}
      </header>
      {failed && <p className="search-empty">തിരയൽ ഇപ്പോൾ ലഭ്യമല്ല. അൽപ്പസമയം കഴിഞ്ഞ് വീണ്ടും ശ്രമിക്കുക.</p>}
      {q && done && done.total === 0 && (
        <p className="search-empty">
          “{q}” എന്നതിന് ഫലങ്ങളൊന്നും കണ്ടില്ല. വാക്കുകളുടെ എണ്ണം കുറച്ചോ മറ്റൊരു വാക്ക് ഉപയോഗിച്ചോ വീണ്ടും തിരയുക, അല്ലെങ്കിൽ <Link href="/">ഹോം പേജിലെ വിഭാഗങ്ങൾ</Link> നോക്കുക.
        </p>
      )}
      <div className="grid grid--3">
        {done?.data.map((p) => <PostCard key={p.id} p={p} excerpt />)}
      </div>
      {done && <Pagination page={page} pages={done.pages} base={`/search?q=${encodeURIComponent(q)}`} />}
    </div>
  )
}
