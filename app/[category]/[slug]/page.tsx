import type { CSSProperties } from 'react'
import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import Meta from '@/components/Meta'
import PostCard from '@/components/PostCard'
import ReadingSize from '@/components/ReadingSize'
import ShareButtons from '@/components/ShareButtons'
import {
  cat, cleanContent, decode, getAdjacent, getAllPosts, getPost, getRelated, href, readingMinutes, text,
} from '@/lib/content'
import { SITE_URL } from '@/lib/site'
import { catColor } from '@/lib/theme'

type Params = Promise<{ category: string; slug: string }>

const load = async (params: Params) => {
  const { category, slug } = await params
  return getPost(`/${decodeURIComponent(category)}/${decodeURIComponent(slug)}`)
}

export const generateStaticParams = () =>
  getAllPosts().map((p) => {
    const [, category, slug] = p.path.split('/')
    return { category, slug }
  })

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const p = await load(params)
  if (!p) return {}
  const title = text(p.title)
  const description = text(p.excerpt).slice(0, 160)
  return {
    title,
    description,
    alternates: { canonical: href(p) },
    openGraph: {
      type: 'article',
      title,
      description,
      url: href(p),
      publishedTime: p.date,
      authors: p.author ? [p.author] : undefined,
      images: p.image ? [new URL(p.image, SITE_URL).toString()] : undefined,
    },
  }
}

export default async function PostPage({ params }: { params: Params }) {
  const p = await load(params)
  if (!p) notFound()
  const c = cat(p)
  const { newer, older } = getAdjacent(p)
  const related = getRelated(p)
  const title = text(p.title)
  return (
    <div className="wrap">
      <article className="post" style={{ '--c': catColor(c) } as CSSProperties}>
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

        {p.image && <img className="post__img" src={p.image} alt="" decoding="async" />}

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
          <Link href={href(older)} className="post-nav__prev">
            <small>‹ Previous</small>
            <span>{text(older.title)}</span>
          </Link>
        ) : <span />}
        {newer && (
          <Link href={href(newer)} className="post-nav__next">
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
