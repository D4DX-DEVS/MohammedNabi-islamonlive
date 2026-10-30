'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { decode } from '@/lib/format'
import { api, ApiError, autoAuthorSlug, autoSlug, nowLocal, plainText, summaryOf, uploadPhoto, type Meta, type Post } from './api'
import RichEditor from './RichEditor'
import { ConfirmDialog, Icon, useToast } from './ui'

type Draft = {
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
const blank = (): Draft => ({ title: '', slug: '', categories: [], author: '', authorSlug: '', excerpt: '', content: '', image: '', date: nowLocal() })

export default function PostEditor({ id, meta, onClose, onUnauthorized }: {
  id: number | null // null = new post
  meta: Meta
  onClose: (message?: string) => void
  onUnauthorized: () => void
}) {
  const toast = useToast()
  const [draft, setDraft] = useState<Draft | null>(id ? null : blank())
  const [saved, setSaved] = useState<string>(() => JSON.stringify(blank()))
  const [slugEdited, setSlugEdited] = useState(Boolean(id))
  const [busy, setBusy] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [dragging, setDragging] = useState(false)
  const [confirm, setConfirm] = useState<'delete' | 'discard' | null>(null)
  const [editorKey, setEditorKey] = useState(0)

  const fail = useCallback((e: unknown) => {
    if (e instanceof ApiError && e.status === 401) onUnauthorized()
    else toast.err(e instanceof Error ? e.message : 'Something went wrong')
  }, [onUnauthorized, toast])

  // load the post being edited
  useEffect(() => {
    if (!id) return
    let alive = true
    api<{ post: Post }>(`posts/${id}`).then(
      ({ post }) => {
        if (!alive) return
        const d: Draft = { title: post.title, slug: post.slug, categories: post.categories, author: post.author, authorSlug: post.authorSlug, excerpt: post.excerpt, content: post.content, image: post.image ?? '', date: post.date.slice(0, 16) }
        setDraft(d)
        setSaved(JSON.stringify(d))
        setEditorKey((k) => k + 1)
      },
      (e) => { fail(e); if (!(e instanceof ApiError && e.status === 401)) onClose() },
    )
    return () => { alive = false }
  }, [id, fail, onClose])

  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setDraft((d) => (d ? { ...d, [k]: v } : d))
  const dirty = draft !== null && JSON.stringify(draft) !== saved

  // warn before closing the tab with unsaved changes
  useEffect(() => {
    if (!dirty) return
    const h = (e: BeforeUnloadEvent) => { e.preventDefault() }
    window.addEventListener('beforeunload', h)
    return () => window.removeEventListener('beforeunload', h)
  }, [dirty])

  const mainCat = draft ? meta.categories.find((c) => c.id === draft.categories[0]) : undefined
  const slug = draft ? draft.slug || autoSlug(draft.title) : ''
  const hasText = draft ? plainText(draft.content).length > 0 || /<img\s/i.test(draft.content) : false
  const problem = !draft ? '' : !draft.title.trim() ? 'Add a title' : !hasText ? 'Write the post text' : draft.categories.length === 0 ? 'Choose a category' : ''

  const save = useCallback(async () => {
    if (!draft || problem || busy) return
    setBusy(true)
    try {
      const body = {
        ...draft,
        slug: draft.slug || autoSlug(draft.title),
        authorSlug: draft.authorSlug || autoAuthorSlug(draft.author),
        excerpt: draft.excerpt.trim() || summaryOf(draft.content),
        image: draft.image || null,
        date: `${draft.date}:00`,
      }
      const r = id ? await api<{ path: string }>(`posts/${id}`, 'PUT', body) : await api<{ path: string }>('posts', 'POST', body)
      setSaved(JSON.stringify(draft))
      onClose(`Saved and live at ${r.path}`)
    } catch (e) {
      fail(e)
    } finally {
      setBusy(false)
    }
  }, [draft, problem, busy, id, onClose, fail])

  // Ctrl/Cmd + S
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault()
        void save()
      }
    }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [save])

  const photo = async (file?: File) => {
    if (!file) return
    setUploading(true)
    try {
      set('image', await uploadPhoto(file))
    } catch (e) {
      fail(e)
    } finally {
      setUploading(false)
    }
  }
  const fileRef = useRef<HTMLInputElement>(null)

  const remove = async () => {
    setConfirm(null)
    try {
      await api(`posts/${id}`, 'DELETE')
      setSaved(JSON.stringify(draft)) // nothing left to lose
      onClose('Post deleted')
    } catch (e) {
      fail(e)
    }
  }

  const back = () => (dirty ? setConfirm('discard') : onClose())
  const authorOptions = useMemo(() => meta.authors.map((a) => <option key={a.slug} value={a.name} />), [meta.authors])

  if (!draft) {
    return (
      <div className="adm-editor adm-skeleton" aria-busy="true">
        <div className="adm-sk adm-sk--bar" />
        <div className="adm-sk adm-sk--title" />
        <div className="adm-sk adm-sk--body" />
      </div>
    )
  }

  return (
    <form className="adm-editor" onSubmit={(e) => { e.preventDefault(); void save() }}>
      <div className="adm-editbar">
        <button type="button" className="adm-btn adm-btn--ghost" onClick={back}>
          <Icon name="back" /> Back to posts
        </button>
        <span className={`adm-status ${dirty ? 'is-dirty' : ''}`}>{busy ? 'Saving…' : dirty ? 'Unsaved changes' : id ? 'All changes saved' : 'New post'}</span>
        <div className="adm-editbar__right">
          {id && mainCat && (
            <a className="adm-btn adm-btn--ghost" href={`/${mainCat.slug}/${draft.slug}`} target="_blank" rel="noopener noreferrer">
              View <Icon name="external" size={15} />
            </a>
          )}
          <button className="adm-btn" disabled={busy || Boolean(problem)} title={problem || 'Save (Ctrl+S)'}>
            {busy ? 'Saving…' : id ? 'Save changes' : 'Save post'}
          </button>
        </div>
      </div>

      <div className="adm-editor__grid">
        <div className="adm-editor__main">
          <input
            className="adm-title"
            placeholder="Post title"
            value={draft.title}
            maxLength={300}
            onChange={(e) => { set('title', e.target.value); if (!slugEdited) set('slug', autoSlug(e.target.value)) }}
            aria-label="Title"
            autoFocus={!id}
          />
          <RichEditor key={editorKey} initial={draft.content} onChange={(html) => set('content', html)} onPhoto={uploadPhoto} />
        </div>

        <aside className="adm-editor__side">
          <section className="adm-card">
            <h3>Categories</h3>
            <p className="adm-help">The first one you pick is the main category.</p>
            <div className="adm-chips">
              {meta.categories.map((c) => {
                const on = draft.categories.includes(c.id)
                return (
                  <button
                    type="button"
                    key={c.id}
                    className={`adm-chip ${on ? 'is-on' : ''}`}
                    aria-pressed={on}
                    onClick={() => set('categories', on ? draft.categories.filter((x) => x !== c.id) : [...draft.categories, c.id])}
                  >
                    {decode(c.name)}
                    {draft.categories[0] === c.id && <small>main</small>}
                  </button>
                )
              })}
            </div>
          </section>

          <section className="adm-card">
            <h3>Photo</h3>
            {draft.image ? (
              <div className="adm-photo">
                <img src={draft.image} alt="" />
                <div className="adm-photo__actions">
                  <button type="button" className="adm-btn adm-btn--small adm-btn--ghost" onClick={() => fileRef.current?.click()} disabled={uploading}>Replace</button>
                  <button type="button" className="adm-btn adm-btn--small adm-btn--ghost" onClick={() => set('image', '')}>Remove</button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                className={`adm-drop ${dragging ? 'is-over' : ''}`}
                onClick={() => fileRef.current?.click()}
                onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
                onDragLeave={() => setDragging(false)}
                onDrop={(e) => { e.preventDefault(); setDragging(false); void photo(e.dataTransfer.files[0]) }}
                disabled={uploading}
              >
                <Icon name="upload" size={22} />
                <span>{uploading ? 'Uploading…' : 'Click or drop a photo'}</span>
                <small>It is shrunk automatically. Max 4 MB.</small>
              </button>
            )}
            <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => { void photo(e.target.files?.[0]); e.target.value = '' }} />
          </section>

          <details className="adm-card adm-more">
            <summary>More options</summary>
            <label className="adm-field">
              Author
              <input list="adm-authors" value={draft.author} maxLength={100} onChange={(e) => {
                const known = meta.authors.find((a) => a.name === e.target.value)
                setDraft((d) => (d ? { ...d, author: e.target.value, authorSlug: known ? known.slug : '' } : d))
              }} placeholder="Optional" />
              <datalist id="adm-authors">{authorOptions}</datalist>
            </label>
            <label className="adm-field">
              Date
              <input type="datetime-local" value={draft.date} onChange={(e) => set('date', e.target.value)} required />
            </label>
            <label className="adm-field">
              Summary
              <textarea rows={3} value={draft.excerpt} maxLength={2000} onChange={(e) => set('excerpt', e.target.value)} placeholder="Left empty, it is taken from the start of the text" />
            </label>
            <label className="adm-field">
              Page address
              <input value={draft.slug} maxLength={150} onChange={(e) => { setSlugEdited(true); set('slug', e.target.value.trim()) }} placeholder={autoSlug(draft.title)} />
              <small>{mainCat ? `/${mainCat.slug}/${slug}` : 'Choose a category to see the full address'}{id ? ' · changing it breaks old links' : ''}</small>
            </label>
          </details>

          {id && (
            <button type="button" className="adm-btn adm-btn--danger" onClick={() => setConfirm('delete')}>
              <Icon name="trash" /> Delete post
            </button>
          )}
        </aside>
      </div>

      {problem && dirty && <p className="adm-hint" role="status">{problem} to save.</p>}

      <ConfirmDialog
        open={confirm === 'delete'}
        title="Delete this post?"
        body="It disappears from the site right away. This cannot be undone."
        confirmLabel="Delete"
        danger
        onConfirm={remove}
        onCancel={() => setConfirm(null)}
      />
      <ConfirmDialog
        open={confirm === 'discard'}
        title="Leave without saving?"
        body="Your changes to this post will be lost."
        confirmLabel="Leave"
        danger
        onConfirm={() => { setConfirm(null); onClose() }}
        onCancel={() => setConfirm(null)}
      />
    </form>
  )
}
