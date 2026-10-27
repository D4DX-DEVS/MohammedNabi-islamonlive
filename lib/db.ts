type Row = Record<string, unknown>

// The site is built once and served as static files, so D1 is only read at build time (and by `next dev`),
// through Cloudflare's REST API. D1_API_TOKEN is deliberately not called CLOUDFLARE_API_TOKEN: wrangler would
// pick that name up and use this database-only token for deploys.
export async function query<T = Row>(sql: string, params: unknown[] = []): Promise<T[]> {
  // D1_ACCOUNT_ID (not CLOUDFLARE_ACCOUNT_ID) because wrangler deploys to that one, and the site may be hosted in another account
  const account = process.env.D1_ACCOUNT_ID ?? process.env.CLOUDFLARE_ACCOUNT_ID
  const database = process.env.D1_DATABASE_ID
  const token = process.env.D1_API_TOKEN ?? process.env.CLOUDFLARE_API_TOKEN
  if (!account || !token || !database) {
    throw new Error('Set D1_ACCOUNT_ID, D1_API_TOKEN and D1_DATABASE_ID (see .env.example) to build the site')
  }
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(`https://api.cloudflare.com/client/v4/accounts/${account}/d1/database/${database}/query`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ sql, params }),
    })
    const json = (await res.json().catch(() => null)) as {
      success: boolean
      errors?: { message: string }[]
      result?: { results: T[] }[]
    } | null
    if (json?.success && json.result) return json.result[0].results
    // rate limits and 5xx are worth a retry; anything else (bad token, bad SQL) is not
    if (attempt < 3 && (res.status === 429 || res.status >= 500)) {
      await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)))
      continue
    }
    throw new Error(`D1 query failed: ${json?.errors?.[0]?.message ?? res.status}`)
  }
}
