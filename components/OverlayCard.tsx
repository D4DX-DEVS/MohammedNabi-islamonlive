import type { CSSProperties } from 'react'
import Link from 'next/link'
import { type Post, cat, date, decode, href, text } from '@/lib/format'
import { catColor } from '@/lib/theme'
import Thumb from './Thumb'

export default function OverlayCard({ p, big, priority }: { p: Post; big?: boolean; priority?: boolean }) {
  const c = cat(p)
  const title = text(p.title)
  return (
    <article className={`overlay${big ? ' overlay--big' : ''}`} style={{ '--c': catColor(c) } as CSSProperties}>
      <Thumb
        src={p.image}
        alt=""
        priority={priority}
        sizes={big ? '(max-width: 700px) 100vw, 600px' : '(max-width: 700px) 50vw, 300px'}
      />
      <div className="overlay__body">
        {c && (
          <Link className="badge" href={`/category/${c.slug}`}>
            {decode(c.name)}
          </Link>
        )}
        <h3 className="overlay__title">{title}</h3>
        <time dateTime={p.date}>{date(p)}</time>
      </div>
      <Link href={href(p)} className="overlay__link" aria-label={title} />
    </article>
  )
}
