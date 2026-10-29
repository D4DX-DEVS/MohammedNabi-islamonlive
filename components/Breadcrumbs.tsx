import Link from 'next/link'
import JsonLd from './JsonLd'
import { SITE_URL } from '@/lib/site'

export type Crumb = { name: string; path: string }

// the visible trail and its BreadcrumbList data come from the same list, so they cannot disagree
export default function Breadcrumbs({ trail }: { trail: Crumb[] }) {
  return (
    <>
      <nav className="crumbs" aria-label="Breadcrumb">
        <ol>
          {trail.map((c, i) => (
            <li key={c.path}>{i < trail.length - 1 ? <Link prefetch={false} href={c.path}>{c.name}</Link> : <span aria-current="page">{c.name}</span>}</li>
          ))}
        </ol>
      </nav>
      <JsonLd data={{
        '@context': 'https://schema.org', '@type': 'BreadcrumbList',
        itemListElement: trail.map((c, i) => ({ '@type': 'ListItem', position: i + 1, name: c.name, item: `${SITE_URL}${c.path}` })),
      }} />
    </>
  )
}
