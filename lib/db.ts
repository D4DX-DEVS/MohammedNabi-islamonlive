import { getCloudflareContext } from '@opennextjs/cloudflare'

type Row = Record<string, unknown>

// In the Worker the D1 binding is used directly. Under plain `next dev` / `next start` there are no
// bindings, so the same SQL goes through Cloudflare's REST API with the credentials from .env.
export async function query<T = Row>(sql: string, params: unknown[] = []): Promise<T[]> {
  let db: D1Database | undefined
  try { db = getCloudflareContext().env.DB } catch {}
  if (db) return (await db.prepare(sql).bind(...params).all<T>()).results

  const { CLOUDFLARE_ACCOUNT_ID: account, CLOUDFLARE_API_TOKEN: token, D1_DATABASE_ID: database } = process.env
  if (!account || !token || !database) {
    throw new Error('No D1 binding and no CLOUDFLARE_ACCOUNT_ID / CLOUDFLARE_API_TOKEN / D1_DATABASE_ID in .env')
  }
  const res = await fetch(`https://api.cloudflare.com/client/v4/accounts/${account}/d1/database/${database}/query`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ sql, params }),
  })
  const json = (await res.json()) as { success: boolean; errors?: { message: string }[]; result?: { results: T[] }[] }
  if (!json.success || !json.result) throw new Error(`D1 query failed: ${json.errors?.[0]?.message ?? res.status}`)
  return json.result[0].results
}
