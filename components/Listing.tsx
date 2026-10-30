import PostCard from './PostCard'
import Pagination from './Pagination'
import type { Post } from '@/lib/format'

// shared by the category and author pages
export default function Listing({
  title, total, posts, page, pages, base,
}: { title: string; total: number; posts: Post[]; page: number; pages: number; base: string }) {
  return (
    <div className="wrap">
      <header className="page-head">
        <h1>{title}</h1>
        <p>{total} പോസ്റ്റുകൾ</p>
      </header>
      <div className="grid grid--3">
        {posts.map((p) => (
          <PostCard key={p.id} p={p} />
        ))}
      </div>
      <Pagination page={page} pages={pages} base={base} />
    </div>
  )
}
