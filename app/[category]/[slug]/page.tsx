import { cache, type CSSProperties } from 'react'
import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import Meta from '@/components/Meta'
import PostCard from '@/components/PostCard'
import ReadingSize from '@/components/ReadingSize'
import ShareButtons from '@/components/ShareButtons'
import { getAdjacent, getPost, getRelated, getRoutes } from '@/lib/content'
import PostRow from '@/components/PostRow'
import Thumb from '@/components/Thumb'
import { cat, cleanContent, decode, href, readingMinutes, text, withToc } from '@/lib/format'
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

// every post is written to a file at build time; any other address is a 404
export const dynamicParams = false
export const generateStaticParams = async () => (await getRoutes()).posts

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
  const [{ newer, older }, related] = await Promise.all([getAdjacent(p.date), getRelated(p.id, p.categories, 7)])
  const title = text(p.title)
  const { html, toc } = withToc(cleanContent(p.content))
  const side = related.slice(0, 4) // the rest go in the "You may also like" row below
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
      <div className="post-layout">
        <div className="post-main">
          <article className="post" style={{ '--c': catColor(c) } as CSSProperties}>
            <Breadcrumbs trail={[{ name: 'ഹോം', path: '/' }, ...(c ? [{ name: decode(c.name), path: `/category/${encodeURIComponent(c.slug)}` }] : []), { name: title, path: href(p) }]} />
            <header className="post__head">
              {c && (
                <Link className="badge" href={`/category/${c.slug}`}>
                  {decode(c.name)}
                </Link>
              )}
              <h1>{title}</h1>
              <div className="post__meta">
                {p.author && <span className="avatar" aria-hidden>{[...p.author][0]}</span>}
                <Meta p={p} />
                <span className="meta">{readingMinutes(p)} മിനിറ്റ് വായന</span>
                <ShareButtons title={title} />
              </div>
            </header>

            {p.image ? <img className="post__img" src={p.image} alt={title} fetchPriority="high" /> : <div className="post__ph"><Thumb src={null} alt="" sizes="780px" /></div>}

            <div className="post__tools">
              <ReadingSize />
            </div>

            <div className="prose" dangerouslySetInnerHTML={{ __html: html }} />

            <div className="post__tools">
              <ShareButtons title={title} />
            </div>
          </article>

          <nav className="post-nav" aria-label="More posts">
            {older ? (
              <Link prefetch={false} href={href(older)} className="post-nav__prev">
                <small>‹ മുമ്പത്തേത്</small>
                <span>{text(older.title)}</span>
              </Link>
            ) : <span />}
            {newer && (
              <Link prefetch={false} href={href(newer)} className="post-nav__next">
                <small>അടുത്തത് ›</small>
                <span>{text(newer.title)}</span>
              </Link>
            )}
          </nav>
        </div>

        <aside className="post-side" style={{ '--c': catColor(c) } as CSSProperties} aria-label="Around this article">
          {toc.length > 1 && (
            <nav className="side-card toc" aria-label="In this article">
              <h2>ഈ ലേഖനത്തിലെ വിഷയങ്ങൾ</h2>
              <ol>
                {toc.map((t, i) => (
                  <li key={t.id}><a href={`#${t.id}`}><b>{String(i + 1).padStart(2, '0')}</b>{t.text}</a></li>
                ))}
              </ol>
            </nav>
          )}
          {side.length > 0 && (
            <section className="side-card">
              <h2>ബന്ധപ്പെട്ട ലേഖനങ്ങൾ</h2>
              <div className="side-list">
                {side.map((r) => <PostRow key={r.id} p={r} />)}
              </div>
            </section>
          )}
          {c && (
            <Link className="side-promo" href={`/category/${encodeURIComponent(c.slug)}`}>
              <strong>{decode(c.name)}</strong>
              <span>ഈ വിഭാഗത്തിലെ എല്ലാ പോസ്റ്റുകളും വായിക്കുക</span>
              <em>എല്ലാം കാണുക →</em>
            </Link>
          )}
        </aside>
      </div>

      {related.length > 4 && (
        <section className="section" style={{ '--c': catColor(c) } as CSSProperties}>
          <div className="section__head">
            <h2 className="section__title">ഇതും വായിക്കുക</h2>
          </div>
          <div className="grid grid--3">
            {related.slice(4).map((r) => (
              <PostCard key={r.id} p={r} />
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
