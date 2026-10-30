import { getCloudflareContext } from '@opennextjs/cloudflare'

type Row = Record<string, unknown>
export type Rows<T> = T[] & { lastId?: number } // lastId: the new row's id after an INSERT

type Binding = { prepare(sql: string): { bind(...v: unknown[]): { all(): Promise<{ results: Row[]; meta: { last_row_id: number } }> } } }

// On Cloudflare the database is the DB binding of the Worker. Under `next dev` there is no binding, so the same
// queries go through Cloudflare's REST API with the read-only D1_API_TOKEN (see .env.example); it reads the real database.
function binding(): Binding | undefined {
  try {
    return (getCloudflareContext().env as { DB?: Binding }).DB
  } catch {
    return undefined
  }
}

export async function query<T = Row>(sql: string, params: unknown[] = []): Promise<Rows<T>> {
  const db = binding()
  if (db) {
    try {
      const r = await db.prepare(sql).bind(...params).all()
      const rows: Rows<T> = r.results as T[]
      rows.lastId = r.meta.last_row_id
      return rows
    } catch (e) {
      throw new DbError(e instanceof Error ? e.message : 'D1 query failed')
    }
  }

  const account = process.env.D1_ACCOUNT_ID
  const database = process.env.D1_DATABASE_ID
  const token = process.env.D1_API_TOKEN
  if (!account || !database || !token) throw new Error('Set D1_ACCOUNT_ID, D1_DATABASE_ID and D1_API_TOKEN (see .env.example)')
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(`https://api.cloudflare.com/client/v4/accounts/${account}/d1/database/${database}/query`, {
      method: 'POST',
      cache: 'no-store',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ sql, params }),
    })
    const json = (await res.json().catch(() => null)) as {
      success: boolean
      errors?: { message: string }[]
      result?: { results: T[]; meta: { last_row_id: number } }[]
    } | null
    if (json?.success && json.result) {
      const rows: Rows<T> = json.result[0].results
      rows.lastId = json.result[0].meta.last_row_id
      return rows
    }
    // rate limits and 5xx are worth a retry; anything else (bad token, bad SQL) is not
    if (attempt < 3 && (res.status === 429 || res.status >= 500)) {
      await new Promise((r) => setTimeout(r, 500 * (attempt + 1)))
      continue
    }
    throw new DbError(json?.errors?.[0]?.message ?? `D1 request failed (${res.status})`)
  }
}

export class DbError extends Error {}
