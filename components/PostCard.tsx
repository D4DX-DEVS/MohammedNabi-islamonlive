import type { CSSProperties } from 'react'
import Link from 'next/link'
import { type Post, cat, decode, href, text } from '@/lib/format'
import { catColor } from '@/lib/theme'
import Meta from './Meta'
import Thumb from './Thumb'

// Cards with a photo show it on top; posts without one become a text card instead of an empty placeholder.
export default function PostCard({ p, excerpt = false }: { p: Post; excerpt?: boolean }) {
  const c = cat(p)
  const title = text(p.title)
  return (
    <article className={`card${p.image ? '' : ' card--text'}`} style={{ '--c': catColor(c) } as CSSProperties}>
      {p.image && (
        <Link href={href(p)} className="card__thumb" tabIndex={-1} aria-hidden>
          <Thumb src={p.image} alt="" sizes="(max-width: 700px) 100vw, (max-width: 1100px) 50vw, 285px" />
        </Link>
      )}
      <div className="card__body">
        {c && (
          <Link className="badge" href={`/category/${c.slug}`}>
            {decode(c.name)}
          </Link>
        )}
        <h3 className="card__title">
          <Link href={href(p)}>{title}</Link>
        </h3>
        {(excerpt || !p.image) && <p className="card__excerpt">{text(p.excerpt)}</p>}
        <Meta p={p} />
      </div>
    </article>
  )
}
