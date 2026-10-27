'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { decode } from '@/lib/format'

type Cat = { id: number; slug: string; name: string }
type Author = { name: string; slug: string }
type Meta = { categories: Cat[]; authors: Author[]; publishConfigured: boolean }
type Row = { id: number; path: string; date: string; title: string; categories: number[]; author: string }
type Draft = {
  id?: number
  title: string
  slug: string
  categories: number[]
  author: string
  authorSlug: string
  excerpt: string
  content: string
  image: string
  date: string // yyyy-mm-ddThh:mm
}
type Run = { status: string; conclusion: string | null; url: string } | null

class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message)
  }
}

async function api<T = Record<string, unknown>>(path: string, method = 'GET', body?: unknown): Promise<T> {
  const res = await fetch(`/api/${path}`, {
    method,
    credentials: 'same-origin',
    headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  const data = (await res.json().catch(() => ({}))) as { error?: string }
  if (!res.ok) throw new ApiError(res.status, data.error ?? `Request failed (${res.status})`)
  return data as T
}

const nowLocal = () => new Date().toISOString().slice(0, 16)
const blank = (): Draft => ({ title: '', slug: '', categories: [], author: '', authorSlug: '', excerpt: '', content: '', image: '', date: nowLocal() })
// latin titles get a suggested address; Malayalam titles need one typed by hand
const slugify = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')

export default function AdminApp() {
  const [authed, setAuthed] = useState<boolean | null>(null)
  const [meta, setMeta] = useState<Meta | null>(null)
  const [posts, setPosts] = useState<Row[]>([])
  const [draft, setDraft] = useState<Draft | null>(null)
  const [notice, setNotice] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null)
  const [run, setRun] = useState<Run>(null)

  const fail = useCallback((e: unknown) => {
    if (e instanceof ApiError && e.status === 401) setAuthed(false)
    else setNotice({ kind: 'err', text: e instanceof Error ? e.message : 'Something went wrong' })
  }, [])

  const load = useCallback(async () => {
    try {
      const [m, p] = await Promise.all([api<Meta>('meta'), api<{ posts: Row[] }>('posts')])
      setMeta(m)
      setPosts(p.posts)
      setAuthed(true)
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) setAuthed(false)
      else {
        setAuthed(false)
        setNotice({ kind: 'err', text: e instanceof Error ? e.message : 'Could not load' })
      }
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  // after Publish, watch the deploy job until it finishes
  useEffect(() => {
    if (!run || run.status === 'completed') return
    const t = setInterval(() => api<{ run: Run }>('publish').then((r) => setRun(r.run), () => {}), 6000)
    return () => clearInterval(t)
  }, [run])

  if (authed === null) return <div className="wrap admin"><p>Loading…</p></div>
  if (!authed) return <Login onDone={load} notice={notice} />

  const publish = async () => {
    setNotice(null)
    try {
      await api('publish', 'POST')
      setRun({ status: 'queued', conclusion: null, url: '' })
      setNotice({ kind: 'ok', text: 'Publishing started. The site updates in about two minutes.' })
    } catch (e) {
      fail(e)
    }
  }

  return (
    <div className="wrap admin">
      <header className="admin__bar">
        <h1>Admin</h1>
        <div className="admin__actions">
          {!draft && <button className="btn" onClick={() => { setNotice(null); setDraft(blank()) }}>New post</button>}
          <button
            className="btn btn--ghost"
            onClick={publish}
            disabled={!meta?.publishConfigured || (run !== null && run.status !== 'completed')}
            title={meta?.publishConfigured ? 'Rebuild and update the live site' : 'Publishing is not set up yet; run npm run deploy instead'}
          >
            Publish
          </button>
          <button className="btn btn--ghost" onClick={() => api('logout', 'POST').finally(() => setAuthed(false))}>Log out</button>
        </div>
      </header>

      {run && (
        <p className="admin__note">
          Publish job: <b>{run.status === 'completed' ? (run.conclusion === 'success' ? 'done, the site is updated' : `finished: ${run.conclusion}`) : run.status}</b>
          {run.url && <> · <a href={run.url} target="_blank" rel="noopener noreferrer">details</a></>}
        </p>
      )}
      {notice && <p className={`admin__note admin__note--${notice.kind}`} role="status">{notice.text}</p>}

      {draft && meta ? (
        <Editor
          key={draft.id ?? 'new'}
          initial={draft}
          meta={meta}
          onCancel={() => setDraft(null)}
          onSaved={async (text) => {
            setDraft(null)
            setNotice({ kind: 'ok', text })
            await load()
          }}
          onError={fail}
        />
      ) : (
        <PostTable
          posts={posts}
          cats={meta?.categories ?? []}
          onEdit={async (id) => {
            setNotice(null)
            try {
              const { post } = await api<{ post: Draft & { authorSlug: string; image: string | null; date: string } }>(`posts/${id}`)
              setDraft({ ...post, image: post.image ?? '', date: post.date.slice(0, 16) })
            } catch (e) {
              fail(e)
            }
          }}
          onDelete={async (row) => {
            if (!confirm(`Delete "${decode(row.title)}"? This cannot be undone.`)) return
            try {
              await api(`posts/${row.id}`, 'DELETE')
              setNotice({ kind: 'ok', text: 'Deleted. It disappears from the site after you publish.' })
              await load()
            } catch (e) {
              fail(e)
            }
          }}
        />
      )}
    </div>
  )
}

function Login({ onDone, notice }: { onDone: () => void; notice: { kind: string; text: string } | null }) {
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  return (
    <div className="wrap admin admin--narrow">
      <h1>Admin login</h1>
      <form
        className="admin__form"
        onSubmit={async (e) => {
          e.preventDefault()
          setBusy(true)
          setError('')
          try {
            await api('login', 'POST', { password })
            onDone()
          } catch (err) {
            setError(err instanceof Error ? err.message : 'Login failed')
          } finally {
            setBusy(false)
          }
        }}
      >
        <label>
          Password
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" autoFocus required />
        </label>
        <button className="btn" disabled={busy}>{busy ? 'Checking…' : 'Log in'}</button>
        {(error || notice?.kind === 'err') && <p className="admin__note admin__note--err" role="alert">{error || notice?.text}</p>}
      </form>
    </div>
  )
}

function PostTable({ posts, cats, onEdit, onDelete }: {
  posts: Row[]
  cats: Cat[]
  onEdit: (id: number) => void
  onDelete: (r: Row) => void
}) {
  const [q, setQ] = useState('')
  const [shown, setShown] = useState(30)
  const catName = (id: number) => decode(cats.find((c) => c.id === id)?.name ?? '')
  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return needle ? posts.filter((p) => decode(p.title).toLowerCase().includes(needle) || p.author.toLowerCase().includes(needle)) : posts
  }, [posts, q])
  return (
    <>
      <input className="admin__search" type="search" placeholder={`Search ${posts.length} posts by title or author…`} value={q} onChange={(e) => { setQ(e.target.value); setShown(30) }} aria-label="Search posts" />
      <div className="admin__scroll">
        <table className="admin__table">
          <thead>
            <tr><th>Title</th><th>Category</th><th>Author</th><th>Date</th></tr>
          </thead>
          <tbody>
            {filtered.slice(0, shown).map((p) => (
              <tr key={p.id}>
                <td>
                  <a href={p.path} target="_blank" rel="noopener noreferrer">{decode(p.title)}</a>
                  <div className="admin__row-actions">
                    <button className="btn btn--small" onClick={() => onEdit(p.id)}>Edit</button>
                    <button className="btn btn--small btn--danger" onClick={() => onDelete(p)}>Delete</button>
                  </div>
                </td>
                <td>{catName(p.categories[0])}</td>
                <td>{p.author}</td>
                <td>{p.date.slice(0, 10)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {filtered.length === 0 && <p>No posts match.</p>}
      {filtered.length > shown && <button className="btn btn--ghost" onClick={() => setShown(shown + 30)}>Show more ({filtered.length - shown} left)</button>}
    </>
  )
}

function Editor({ initial, meta, onCancel, onSaved, onError }: {
  initial: Draft
  meta: Meta
  onCancel: () => void
  onSaved: (text: string) => Promise<void>
  onError: (e: unknown) => void
}) {
  const [d, setD] = useState(initial)
  const [slugTouched, setSlugTouched] = useState(Boolean(initial.id))
  const [preview, setPreview] = useState(false)
  const [busy, setBusy] = useState(false)
  const area = useRef<HTMLTextAreaElement>(null)
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setD((x) => ({ ...x, [k]: v }))

  const toggleCat = (id: number) => set('categories', d.categories.includes(id) ? d.categories.filter((c) => c !== id) : [...d.categories, id])

  // wrap the selected text in tags
  const wrap = (open: string, close: string) => {
    const el = area.current
    if (!el) return
    const { selectionStart: s, selectionEnd: e, value } = el
    set('content', value.slice(0, s) + open + (value.slice(s, e) || 'text') + close + value.slice(e))
    el.focus()
  }

  const save = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    try {
      const body = { ...d, date: `${d.date}:00`, image: d.image || null }
      const r = d.id ? await api<{ path: string }>(`posts/${d.id}`, 'PUT', body) : await api<{ path: string }>('posts', 'POST', body)
      await onSaved(`Saved at ${r.path}. Visitors see it after you publish.`)
    } catch (err) {
      onError(err)
    } finally {
      setBusy(false)
    }
  }

  return (
    <form className="admin__form" onSubmit={save}>
      <h2>{d.id ? 'Edit post' : 'New post'}</h2>
      <label>
        Title
        <input value={d.title} onChange={(e) => { set('title', e.target.value); if (!slugTouched) set('slug', slugify(e.target.value)) }} required maxLength={300} />
      </label>
      <label>
        Address (slug)
        <input value={d.slug} onChange={(e) => { setSlugTouched(true); set('slug', e.target.value.trim()) }} required maxLength={150} />
        <small>Part of the page address. Changing it later changes the post&apos;s link.</small>
      </label>
      <fieldset>
        <legend>Categories (the first one you tick is the main one)</legend>
        <div className="admin__checks">
          {meta.categories.map((c) => (
            <label key={c.id} className="admin__check">
              <input type="checkbox" checked={d.categories.includes(c.id)} onChange={() => toggleCat(c.id)} />
              {decode(c.name)}{d.categories[0] === c.id ? ' (main)' : ''}
            </label>
          ))}
        </div>
      </fieldset>
      <div className="admin__two">
        <label>
          Author
          <input list="authors" value={d.author} onChange={(e) => {
            const known = meta.authors.find((a) => a.name === e.target.value)
            setD((x) => ({ ...x, author: e.target.value, authorSlug: known ? known.slug : x.authorSlug }))
          }} maxLength={100} />
          <datalist id="authors">{meta.authors.map((a) => <option key={a.slug} value={a.name} />)}</datalist>
        </label>
        <label>
          Author slug
          <input value={d.authorSlug} onChange={(e) => set('authorSlug', e.target.value.trim())} maxLength={100} />
        </label>
      </div>
      <div className="admin__two">
        <label>
          Date
          <input type="datetime-local" value={d.date} onChange={(e) => set('date', e.target.value)} required />
        </label>
        <label>
          Photo (optional)
          <input value={d.image} onChange={(e) => set('image', e.target.value.trim())} placeholder="/uploads/2026/10/photo.jpg" maxLength={500} />
        </label>
      </div>
      <label>
        Short summary
        <textarea rows={3} value={d.excerpt} onChange={(e) => set('excerpt', e.target.value)} maxLength={2000} />
      </label>
      <div>
        <div className="admin__toolbar">
          <span>Content (HTML)</span>
          <button type="button" className="btn btn--small btn--ghost" onClick={() => wrap('<strong>', '</strong>')}>Bold</button>
          <button type="button" className="btn btn--small btn--ghost" onClick={() => wrap('<em>', '</em>')}>Italic</button>
          <button type="button" className="btn btn--small btn--ghost" onClick={() => wrap('<h2>', '</h2>')}>Heading</button>
          <button type="button" className="btn btn--small btn--ghost" onClick={() => wrap('<p>', '</p>')}>Paragraph</button>
          <button type="button" className="btn btn--small btn--ghost" onClick={() => wrap('<blockquote>', '</blockquote>')}>Quote</button>
          <button type="button" className="btn btn--small btn--ghost" onClick={() => wrap('<a href="https://">', '</a>')}>Link</button>
          <button type="button" className="btn btn--small" onClick={() => setPreview(!preview)}>{preview ? 'Edit' : 'Preview'}</button>
        </div>
        {preview ? (
          // sandboxed with no scripts: pasted HTML cannot run anything
          <iframe className="admin__preview" sandbox="" title="Preview" srcDoc={`<meta charset="utf-8"><style>body{font:18px/1.9 serif;margin:16px;color:#222}img{max-width:100%}</style>${d.content}`} />
        ) : (
          <textarea ref={area} className="admin__code" rows={18} value={d.content} onChange={(e) => set('content', e.target.value)} required />
        )}
      </div>
      <div className="admin__actions">
        <button className="btn" disabled={busy || d.categories.length === 0}>{busy ? 'Saving…' : 'Save'}</button>
        <button type="button" className="btn btn--ghost" onClick={onCancel}>Cancel</button>
        {d.categories.length === 0 && <small>Tick at least one category.</small>}
      </div>
    </form>
  )
}
