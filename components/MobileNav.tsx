'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import type { MenuItem } from '@/lib/menu'

export default function MobileNav({ menu }: { menu: MenuItem[] }) {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : ''
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = ''
      window.removeEventListener('keydown', onKey)
    }
  }, [open])

  const close = () => setOpen(false)
  const link = (m: MenuItem) => (
    <Link href={m.href!} onClick={close}>
      {m.label}
    </Link>
  )

  return (
    <>
      <button className="icon-btn nav-toggle" aria-label="Menu" aria-expanded={open} onClick={() => setOpen(true)}>
        <span /><span /><span />
      </button>
      <div className={`mobile-nav${open ? ' is-open' : ''}`} aria-hidden={!open}>
        <div className="mobile-nav__backdrop" onClick={close} />
        <aside className="mobile-nav__panel">
          <button className="mobile-nav__close" aria-label="Close menu" onClick={close}>×</button>
          <form action="/search" className="search-form" onSubmit={close}>
            <input type="search" name="q" placeholder="തിരയുക…" aria-label="Search" />
          </form>
          <ul>
            {menu.map((m) => (
              <li key={m.label}>
                {m.href ? link(m) : <span className="mobile-nav__group">{m.label}</span>}
                {m.children && (
                  <ul>
                    {m.children.map((c) => (
                      <li key={c.href}>{link(c)}</li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ul>
        </aside>
      </div>
    </>
  )
}
