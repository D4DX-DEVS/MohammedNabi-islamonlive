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
          <h1>Posts <span className="adm-count">{loading ? '' : `(${filtered.length === posts.length ? posts.length : `${filtered.length} of ${posts.length}`})`}</span></h1>
          <p className="adm-help">Changes go live as soon as you save.</p>
        </div>
        <button className="adm-btn adm-btn--outline" onClick={onNew}>
          <Icon name="plus" /> New post
        </button>
      </header>

      <div className="adm-filters">
        <label className="adm-search">
          <Icon name="search" />
          <input type="search" placeholder="Search title or author…" value={q} onChange={(e) => { setQ(e.target.value); setShown(25) }} aria-label="Search posts" />
        </label>
        <select className="adm-select" value={cat} onChange={(e) => { setCat(Number(e.target.value)); setShown(25) }} aria-label="Filter by category">
          <option value={0}>All categories</option>
          {meta?.categories.map((c) => <option key={c.id} value={c.id}>{decode(c.name)}</option>)}
        </select>
        {(q || cat > 0) && <button className="adm-btn adm-btn--ghost" onClick={() => { setQ(''); setCat(0); setShown(25) }}>Clear</button>}
      </div>

      {loading ? (
        <div className="adm-table" aria-busy="true">
          {Array.from({ length: 6 }, (_, i) => (
            <div key={i} className="adm-tr adm-skeleton"><div className="adm-sk adm-sk--line" /></div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="adm-empty">
          <p>{posts.length === 0 ? 'No posts yet.' : 'No posts match your search.'}</p>
        </div>
      ) : (
        <>
          <div className="adm-table" role="table" aria-label="Posts">
            <div className="adm-tr adm-th" role="row">
              <span role="columnheader">Title</span>
              <span role="columnheader">Category</span>
              <span role="columnheader">Date</span>
              <span role="columnheader" className="adm-th__act">Actions</span>
            </div>
            {filtered.slice(0, shown).map((p) => (
              <div key={p.id} className="adm-tr" role="row">
                <a className="adm-td adm-td--title" role="cell" href={`#edit/${p.id}`}>
                  {p.image ? (
                    <Image className="adm-row__thumb" src={p.image} alt="" width={56} height={42} />
                  ) : (
                    <span className="adm-row__thumb adm-row__thumb--empty" aria-hidden><Icon name="edit" size={16} /></span>
                  )}
                  <span className="adm-td__text">
                    <strong>{decode(p.title)}</strong>
                    {p.author && <small>{p.author}</small>}
                  </span>
                </a>
                <span className="adm-td adm-td--cat" role="cell"><span className="adm-tag">{catName(p.categories[0])}</span></span>
                <span className="adm-td adm-td--date" role="cell">{fmtDate(p.date)}</span>
                <span className="adm-td adm-td--act" role="cell">
                  <a className="adm-btn adm-btn--ghost adm-btn--small" href={`#edit/${p.id}`}>Edit</a>
                  <a className="adm-btn adm-btn--ghost adm-btn--small" href={p.path} target="_blank" rel="noopener noreferrer" aria-label={`View ${decode(p.title)} on the site`}>View</a>
                </span>
              </div>
            ))}
          </div>
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
