import type { CSSProperties } from 'react'
import Link from 'next/link'
import { type Post, cat, date, href, text } from '@/lib/format'
import { catColor } from '@/lib/theme'
import Thumb from './Thumb'

// compact horizontal row: small photo when there is one, otherwise a coloured marker
export default function PostRow({ p }: { p: Post }) {
  return (
    <article className="row" style={{ '--c': catColor(cat(p)) } as CSSProperties}>
      {p.image ? (
        <Link href={href(p)} className="row__thumb" tabIndex={-1} aria-hidden>
          <Thumb src={p.image} alt="" sizes="96px" />
        </Link>
      ) : (
        <span className="row__dot" aria-hidden />
      )}
      <div>
        <h3 className="row__title">
          <Link href={href(p)}>{text(p.title)}</Link>
        </h3>
        <time className="meta" dateTime={p.date}>
          {date(p)}
        </time>
      </div>
    </article>
  )
}
