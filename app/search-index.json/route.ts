import { getSearchIndex } from '@/lib/content'

export const dynamic = 'force-static'

// written to out/search-index.json at build time
export async function GET() {
  return Response.json(await getSearchIndex())
}
