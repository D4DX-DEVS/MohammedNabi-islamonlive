'use client'

import { usePathname } from 'next/navigation'
import { useEffect, type ReactNode } from 'react'

// what slides in as it scrolls into view
const REVEAL = '.card, .row, .section__head, .overlay, .post-nav a, .page-head, .post__head'

// The public header and footer are not shown on /admin, which has its own frame.
export default function SiteChrome({ header, footer, children }: { header: ReactNode; footer: ReactNode; children: ReactNode }) {
  const path = usePathname() ?? ''
  const admin = path.startsWith('/admin')

  useEffect(() => {
    if (admin || matchMedia('(prefers-reduced-motion: reduce)').matches || !('IntersectionObserver' in window)) return
    const io = new IntersectionObserver(
      (entries) => entries.forEach((e) => {
        if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target) }
      }),
      { rootMargin: '0px 0px -8% 0px' },
    )
    // only what starts below the fold is hidden, so the first screen never flashes
    document.querySelectorAll<HTMLElement>(REVEAL).forEach((el, i) => {
      if (el.getBoundingClientRect().top < innerHeight) return
      el.dataset.r = ''
      el.style.setProperty('--d', `${(i % 4) * 70}ms`)
      io.observe(el)
    })
    return () => io.disconnect()
  }, [path, admin])

  return (
    <>
      {!admin && header}
      <main id="main">{children}</main>
      {!admin && footer}
    </>
  )
}
