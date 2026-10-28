'use client'

import { usePathname } from 'next/navigation'
import type { ReactNode } from 'react'

// The public header and footer are not shown on /admin, which has its own frame.
export default function SiteChrome({ header, footer, children }: { header: ReactNode; footer: ReactNode; children: ReactNode }) {
  const admin = (usePathname() ?? '').startsWith('/admin')
  return (
    <>
      {!admin && header}
      <main id="main">{children}</main>
      {!admin && footer}
    </>
  )
}
