import Link from 'next/link'
import OverlayCard from '@/components/OverlayCard'
import PostCard from '@/components/PostCard'
import PostRow from '@/components/PostRow'
import Section from '@/components/Section'
import { getCategories, getPosts } from '@/lib/content'
import { decode, type Post } from '@/lib/format'
import { catColor } from '@/lib/theme'

type Layout = 'cards' | 'overlay' | 'rows'
const sections: [slug: string, layout: Layout][] = [
  ['nabi-articles', 'cards'],
  ['nabi-charithram', 'cards'],
  ['nabi-books', 'overlay'],
  ['kudumba-jeevitham', 'cards'],
  ['personality', 'cards'],
  ['nabi-hadith', 'cards'],
  ['stories-poems', 'rows'],
]

export const revalidate = 3600

export default async function Home() {
  const cats = await getCategories()
  const catOf = (slug: string) => cats.find((x) => x.slug === slug)
  // newest 40 per section is plenty to find 4 posts with photos
  const [latest, ...lists] = await Promise.all([
    getPosts(null, 5),
    ...sections.map(([slug]) => (catOf(slug) ? getPosts(catOf(slug)!.id, 40) : Promise.resolve([] as Post[]))),
  ])
  // a post may sit in several categories; show it once on this page
  const used = new Set(latest.map((p) => p.id))

  const pick = (all: Post[], n: number, photosFirst: boolean) => {
    let list = all.filter((p) => !used.has(p.id))
    if (photosFirst) list = [...list.filter((p) => p.image), ...list.filter((p) => !p.image)]
    const out = list.slice(0, n)
    out.forEach((p) => used.add(p.id))
    return out
  }

  return (
    <>
      <div className="wrap">
        <h1 className="sr-only">മുഹമ്മദ് നബി (സ)</h1>
        <div className="mosaic">
          {latest.map((p, i) => (
            <OverlayCard key={p.id} p={p} big={i === 0} priority={i < 3} />
          ))}
        </div>

        <nav className="topics" aria-label="Browse topics">
          {cats.map((c) => (
            <Link key={c.id} href={`/category/${c.slug}`} style={{ '--c': catColor(c) } as React.CSSProperties}>
              {decode(c.name)}
            </Link>
          ))}
        </nav>

        {sections.map(([slug, layout], i) => {
          const c = catOf(slug)
          if (!c) return null
          const posts = pick(lists[i], layout === 'rows' ? 9 : 4, layout !== 'rows')
          if (!posts.length) return null
          return (
            <Section key={slug} title={decode(c.name)} href={`/category/${slug}`} color={catColor(c)}>
              {layout === 'rows' ? (
                <div className="rows">
                  {posts.map((p) => (
                    <PostRow key={p.id} p={p} />
                  ))}
                </div>
              ) : (
                <div className={`grid grid--4${layout === 'overlay' ? ' grid--overlay' : ''}`}>
                  {posts.map((p) =>
                    layout === 'overlay' ? <OverlayCard key={p.id} p={p} /> : <PostCard key={p.id} p={p} />,
                  )}
                </div>
              )}
            </Section>
          )
        })}
      </div>
    </>
  )
}
