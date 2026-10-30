import type { CSSProperties, ReactNode } from 'react'
import Link from 'next/link'

export default function Section({
  title, href, color, children,
}: { title: string; href?: string; color: string; children: ReactNode }) {
  return (
    <section className="section" style={{ '--c': color } as CSSProperties}>
      <div className="section__head">
        <h2 className="section__title">{title}</h2>
        {href && (
          <Link href={href} className="section__more" aria-label={`കൂടുതൽ ${title}`}>
            കൂടുതൽ
          </Link>
        )}
      </div>
      {children}
    </section>
  )
}
