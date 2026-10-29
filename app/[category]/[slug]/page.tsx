import { cache, type CSSProperties } from 'react'
import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import Meta from '@/components/Meta'
import PostCard from '@/components/PostCard'
import ReadingSize from '@/components/ReadingSize'
import ShareButtons from '@/components/ShareButtons'
import { getAdjacent, getPost, getRelated } from '@/lib/content'
import { cat, cleanContent, decode, href, readingMinutes, text } from '@/lib/format'
import Breadcrumbs from '@/components/Breadcrumbs'
import JsonLd from '@/components/JsonLd'
import { LOGO, SITE_NAME, pageMeta } from '@/lib/seo'
import { SITE_URL } from '@/lib/site'
import { catColor } from '@/lib/theme'

type Params = Promise<{ category: string; slug: string }>

// shared by generateMetadata and the page so the post is looked up once
const load = cache(async (params: Params) => {
  const { category, slug } = await params
  return getPost(`/${decodeURIComponent(category)}/${decodeURIComponent(slug)}`)
})

export const revalidate = 86400
export const generateStaticParams = () => [] // built on first visit, then cached; the admin refreshes the cache on every edit

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const p = await load(params)
  if (!p) return {}
  return pageMeta({
    title: text(p.title),
    description: text(p.excerpt).slice(0, 160) || text(p.content).slice(0, 160),
    path: href(p),
    image: p.image,
    type: 'article',
    published: p.date,
    author: p.author || undefined,
  })
}

export default async function PostPage({ params }: { params: Params }) {
  const p = await load(params)
  if (!p) notFound()
  const c = cat(p)
  const [{ newer, older }, related] = await Promise.all([getAdjacent(p.date), getRelated(p.id, p.categories, 3)])
  const title = text(p.title)
  return (
    <div className="wrap">
      <JsonLd data={{
        '@context': 'https://schema.org', '@type': 'BlogPosting', headline: title, inLanguage: 'ml',
        mainEntityOfPage: `${SITE_URL}${href(p)}`, datePublished: p.date,
        ...(p.image ? { image: new URL(p.image, SITE_URL).toString() } : {}),
        ...(p.author ? { author: { '@type': 'Person', name: p.author, url: `${SITE_URL}/author/${encodeURIComponent(p.authorSlug)}` } } : {}),
        ...(c ? { articleSection: decode(c.name) } : {}),
        publisher: { '@type': 'Organization', name: SITE_NAME, logo: { '@type': 'ImageObject', url: `${SITE_URL}${LOGO}` } },
      }} />
      <article className="post" style={{ '--c': catColor(c) } as CSSProperties}>
        <Breadcrumbs trail={[{ name: 'Home', path: '/' }, ...(c ? [{ name: decode(c.name), path: `/category/${encodeURIComponent(c.slug)}` }] : []), { name: title, path: href(p) }]} />
        <header className="post__head">
          {c && (
            <Link className="badge" href={`/category/${c.slug}`}>
              {decode(c.name)}
            </Link>
          )}
          <h1>{title}</h1>
          <div className="post__meta">
            <Meta p={p} />
            <span className="meta">{readingMinutes(p)} min read</span>
          </div>
        </header>

        {p.image && <img className="post__img" src={p.image} alt={title} fetchPriority="high" />}

        <div className="post__tools">
          <ShareButtons title={title} />
          <ReadingSize />
        </div>

        <div className="prose" dangerouslySetInnerHTML={{ __html: cleanContent(p.content) }} />

        <div className="post__tools">
          <ShareButtons title={title} />
        </div>
      </article>

      <nav className="post-nav" aria-label="More posts">
        {older ? (
          <Link prefetch={false} href={href(older)} className="post-nav__prev">
            <small>‹ Previous</small>
            <span>{text(older.title)}</span>
          </Link>
        ) : <span />}
        {newer && (
          <Link prefetch={false} href={href(newer)} className="post-nav__next">
            <small>Next ›</small>
            <span>{text(newer.title)}</span>
          </Link>
        )}
      </nav>

      {related.length > 0 && (
        <section className="section" style={{ '--c': catColor(c) } as CSSProperties}>
          <div className="section__head">
            <h2 className="section__title">You may also like</h2>
          </div>
          <div className="grid grid--3">
            {related.map((r) => (
              <PostCard key={r.id} p={r} />
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
