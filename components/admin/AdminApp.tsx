'use client'

import { useCallback, useEffect, useState } from 'react'
import { api, ApiError, type Meta, type Row } from './api'
import Login from './Login'
import PostEditor from './PostEditor'
import PostList from './PostList'
import PublishButton from './PublishButton'
import { Icon, ToastProvider, useToast } from './ui'
import './admin.css'

// Screens are driven by the address hash, so the browser's Back button and a page refresh behave as expected:
//   /admin  = list,  /admin#new = new post,  /admin#edit/12 = edit post 12
type Route = { kind: 'list' } | { kind: 'new' } | { kind: 'edit'; id: number }
const parse = (hash: string): Route => {
  if (hash === '#new') return { kind: 'new' }
  const m = /^#edit\/(\d+)$/.exec(hash)
  return m ? { kind: 'edit', id: Number(m[1]) } : { kind: 'list' }
}

export default function AdminApp() {
  return (
    <ToastProvider>
      <Shell />
    </ToastProvider>
  )
}

function Shell() {
  const toast = useToast()
  const [authed, setAuthed] = useState<boolean | null>(null)
  const [meta, setMeta] = useState<Meta | null>(null)
  const [posts, setPosts] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)
  const [route, setRoute] = useState<Route>({ kind: 'list' })

  useEffect(() => {
    const read = () => setRoute(parse(window.location.hash))
    read()
    window.addEventListener('hashchange', read)
    return () => window.removeEventListener('hashchange', read)
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [m, p] = await Promise.all([api<Meta>('meta'), api<{ posts: Row[] }>('posts')])
      setMeta(m)
      setPosts(p.posts)
      setAuthed(true)
    } catch (e) {
      setAuthed(false)
      if (!(e instanceof ApiError && e.status === 401)) toast.err(e instanceof Error ? e.message : 'Could not load the admin')
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => {
    void load()
  }, [load])

  const toList = useCallback((message?: string) => {
    window.history.pushState(null, '', window.location.pathname)
    setRoute({ kind: 'list' })
    if (message) toast.ok(message)
    void load()
  }, [load, toast])

  if (authed === null) return <div className="adm adm-center"><span className="adm-spinner" aria-label="Loading" /></div>
  if (!authed) return <div className="adm"><Login onDone={() => void load()} /></div>

  return (
    <div className="adm">
      <header className="adm-top">
        <a className="adm-top__brand" href="/admin" onClick={(e) => { e.preventDefault(); toList() }}>
          <img src="/uploads/2018/10/logo-nabi1.png" alt="" />
          <span>Admin</span>
        </a>
        <nav className="adm-top__nav">
          {meta?.publishConfigured && <PublishButton />}
          <a className="adm-btn adm-btn--ghost adm-btn--small" href="/" target="_blank" rel="noopener noreferrer">
            View site <Icon name="external" size={14} />
          </a>
          <button className="adm-icon" title="Log out" aria-label="Log out" onClick={() => api('logout', 'POST').finally(() => setAuthed(false))}>
            <Icon name="logout" />
          </button>
        </nav>
      </header>

      <div className="adm-page">
        {route.kind === 'list' ? (
          <PostList posts={posts} meta={meta} loading={loading} onNew={() => { window.location.hash = 'new' }} />
        ) : meta ? (
          <PostEditor key={route.kind === 'edit' ? route.id : 'new'} id={route.kind === 'edit' ? route.id : null} meta={meta} onClose={toList} onUnauthorized={() => setAuthed(false)} />
        ) : null}
      </div>
    </div>
  )
}
