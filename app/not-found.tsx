import Link from 'next/link'

export default function NotFound() {
  return (
    <div className="wrap notfound">
      <h1>404</h1>
      <p>This page could not be found.</p>
      <p>
        <Link href="/">Back to home</Link> · <Link href="/search">Search</Link>
      </p>
    </div>
  )
}
