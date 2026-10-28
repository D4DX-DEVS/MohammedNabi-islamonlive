type Row = Record<string, unknown>
export type Rows<T> = T[] & { lastId?: number } // lastId: the new row's id after an INSERT

// D1 lives on Cloudflare, the site on Vercel, so every query goes through Cloudflare's REST API.
// Two tokens on purpose: pages use the read-only D1_API_TOKEN; only the admin API (write: true) gets the D1 Edit token.
export async function query<T = Row>(sql: string, params: unknown[] = [], opts: { write?: boolean } = {}): Promise<Rows<T>> {
  const account = process.env.D1_ACCOUNT_ID
  const database = process.env.D1_DATABASE_ID
  const token = opts.write ? process.env.D1_ADMIN_API_TOKEN : process.env.D1_API_TOKEN
  if (!account || !database || !token) {
    throw new Error(`Set D1_ACCOUNT_ID, D1_DATABASE_ID and ${opts.write ? 'D1_ADMIN_API_TOKEN' : 'D1_API_TOKEN'} (see .env.example)`)
  }
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(`https://api.cloudflare.com/client/v4/accounts/${account}/d1/database/${database}/query`, {
      method: 'POST',
      cache: 'no-store', // Next's own cache sits above this (see lib/content.ts)
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
    // rate limits and 5xx are worth a retry; anything else (bad token, bad SQL, UNIQUE) is not
    if (attempt < 3 && (res.status === 429 || res.status >= 500)) {
      await new Promise((r) => setTimeout(r, 500 * (attempt + 1)))
      continue
    }
    throw new DbError(json?.errors?.[0]?.message ?? `D1 request failed (${res.status})`)
  }
}

export class DbError extends Error {}
