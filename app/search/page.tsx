import type { Metadata } from 'next'
import { Suspense } from 'react'
import SearchResults from '@/components/SearchResults'

export const metadata: Metadata = { title: 'തിരയൽ', robots: { index: false } }

// The site is static, so the results are fetched in the browser from the Worker (/api/search).
export default function Search() {
  return (
    <Suspense fallback={<div className="wrap"><header className="page-head"><h1>തിരയൽ</h1></header></div>}>
      <SearchResults />
    </Suspense>
  )
}
