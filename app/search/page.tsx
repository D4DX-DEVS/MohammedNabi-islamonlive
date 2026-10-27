import type { Metadata } from 'next'
import { Suspense } from 'react'
import SearchClient from '@/components/SearchClient'

export const metadata: Metadata = { title: 'Search', robots: { index: false } }

// The page itself is static; SearchClient filters /search-index.json in the browser.
// The fallback is what is prebuilt into the HTML, so the heading exists before any JavaScript runs.
export default function Search() {
  return (
    <Suspense
      fallback={
        <div className="wrap">
          <header className="page-head">
            <h1>Search</h1>
          </header>
        </div>
      }
    >
      <SearchClient />
    </Suspense>
  )
}
