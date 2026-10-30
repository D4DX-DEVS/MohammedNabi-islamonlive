'use client'

import Image from 'next/image'
import { useMemo, useState } from 'react'
import { decode } from '@/lib/format'
import { fmtDate, type Meta, type Row } from './api'
import { Icon } from './ui'

export default function PostList({ posts, meta, loading, onNew }: { posts: Row[]; meta: Meta | null; loading: boolean; onNew: () => void }) {
  const [q, setQ] = useState('')
  const [cat, setCat] = useState(0)
  const [shown, setShown] = useState(25)
  const catName = (id: number) => decode(meta?.categories.find((c) => c.id === id)?.name ?? '')

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return posts.filter(
      (p) => (!cat || p.categories.includes(cat)) && (!needle || decode(p.title).toLowerCase().includes(needle) || p.author.toLowerCase().includes(needle)),
    )
  }, [posts, q, cat])

  return (
    <section className="adm-list">
      <header className="adm-list__head">
        <div>
          <h1>Posts</h1>
          <p className="adm-help">{loading ? 'Loading…' : `${posts.length} posts. Saved changes reach the site when you press Publish.`}</p>
        </div>
        <button className="adm-btn" onClick={onNew}>
          <Icon name="plus" /> New post
        </button>
      </header>

      <div className="adm-filters">
        <label className="adm-search">
          <Icon name="search" />
          <input type="search" placeholder="Search by title or author" value={q} onChange={(e) => { setQ(e.target.value); setShown(25) }} aria-label="Search posts" />
        </label>
        <select className="adm-select" value={cat} onChange={(e) => { setCat(Number(e.target.value)); setShown(25) }} aria-label="Filter by category">
          <option value={0}>All categories</option>
          {meta?.categories.map((c) => <option key={c.id} value={c.id}>{decode(c.name)}</option>)}
        </select>
      </div>

      {loading ? (
        <ul className="adm-rows" aria-busy="true">
          {Array.from({ length: 6 }, (_, i) => (
            <li key={i} className="adm-row adm-skeleton"><div className="adm-sk adm-sk--thumb" /><div className="adm-sk adm-sk--line" /></li>
          ))}
        </ul>
      ) : filtered.length === 0 ? (
        <div className="adm-empty">
          <p>{posts.length === 0 ? 'No posts yet.' : 'No posts match your search.'}</p>
          {(q || cat) && <button className="adm-btn adm-btn--ghost" onClick={() => { setQ(''); setCat(0) }}>Clear filters</button>}
        </div>
      ) : (
        <>
          <ul className="adm-rows">
            {filtered.slice(0, shown).map((p) => (
              <li key={p.id} className="adm-row">
                <a className="adm-row__main" href={`#edit/${p.id}`}>
                  {p.image ? (
                    <Image className="adm-row__thumb" src={p.image} alt="" width={56} height={42} />
                  ) : (
                    <span className="adm-row__thumb adm-row__thumb--empty" aria-hidden><Icon name="edit" size={16} /></span>
                  )}
                  <span className="adm-row__text">
                    <strong>{decode(p.title)}</strong>
                    <span className="adm-row__meta">
                      <span className="adm-tag">{catName(p.categories[0])}</span>
                      {p.author && <span>{p.author}</span>}
                      <span>{fmtDate(p.date)}</span>
                    </span>
                  </span>
                </a>
                <a className="adm-icon" href={p.path} target="_blank" rel="noopener noreferrer" title="View on the site" aria-label={`View ${decode(p.title)} on the site`}>
                  <Icon name="external" />
                </a>
              </li>
            ))}
          </ul>
          {filtered.length > shown && (
            <button className="adm-btn adm-btn--ghost adm-more-btn" onClick={() => setShown(shown + 25)}>
              Show more ({filtered.length - shown} left)
            </button>
          )}
        </>
      )}
    </section>
  )
}
