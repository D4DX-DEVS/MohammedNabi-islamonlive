import Link from 'next/link'

// base with a query string (search) pages as ?page=N; a plain path pages as /page/N, the original WordPress style
export default function Pagination({ page, pages, base }: { page: number; pages: number; base: string }) {
  if (pages <= 1) return null
  const to = (n: number) => (base.includes('?') ? `${base}&page=${n}` : n === 1 ? base : `${base}/page/${n}`)
  const nums = Array.from({ length: pages }, (_, i) => i + 1).filter(
    (n) => n === 1 || n === pages || Math.abs(n - page) <= 2,
  )
  return (
    <nav className="pager" aria-label="Pagination">
      {page > 1 && <Link href={to(page - 1)}>‹ മുമ്പത്തേത്</Link>}
      {nums.map((n, i) => (
        <span key={n}>
          {i > 0 && n - nums[i - 1] > 1 && <span className="pager__gap">…</span>}
          {n === page ? <b aria-current="page">{n}</b> : <Link href={to(n)}>{n}</Link>}
        </span>
      ))}
      {page < pages && <Link href={to(page + 1)}>അടുത്തത് ›</Link>}
    </nav>
  )
}
