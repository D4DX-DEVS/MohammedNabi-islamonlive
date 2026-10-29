import Link from 'next/link'
import { type Post, date } from '@/lib/format'

export default function Meta({ p, author = true }: { p: Post; author?: boolean }) {
  return (
    <div className="meta">
      {author && p.authorSlug && (
        <Link prefetch={false} className="meta__author" href={`/author/${p.authorSlug}`}>
          {p.author}
        </Link>
      )}
      <time dateTime={p.date}>{date(p)}</time>
    </div>
  )
}
