// Copies the production environment variables from .env into the linked Vercel project (values go to the CLI on stdin).
// It also makes the admin password and login-cookie key, and prints the password once at the end.
//   node scripts/vercel-env.mjs
// Run `npx vercel link --project muhammad-nabi --scope d4-dx2` first. Re-running adds nothing twice: it stops on the first
// variable that already exists, so remove it in the Vercel dashboard (or `npx vercel env rm NAME production`) to retry.
import { execFileSync } from 'node:child_process'
import { randomBytes } from 'node:crypto'
import { readFileSync } from 'node:fs'

const env = Object.fromEntries(
  readFileSync('.env', 'utf8').split(/\r?\n/).filter((l) => /^[A-Z0-9_]+=/.test(l)).map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1).trim()]),
)
const password = randomBytes(12).toString('base64url')
// [name, value, sensitive]; ids and the bucket name are not secret
const vars = [
  ['D1_ACCOUNT_ID', env.D1_ACCOUNT_ID, false],
  ['D1_DATABASE_ID', env.D1_DATABASE_ID, false],
  ['D1_API_TOKEN', env.D1_API_TOKEN, true],
  ['D1_ADMIN_API_TOKEN', env.D1_ADMIN_API_TOKEN, true],
  ['R2_ACCOUNT_ID', env.R2_ACCOUNT_ID, false],
  ['R2_ACCESS_KEY_ID', env.R2_ACCESS_KEY_ID, true],
  ['R2_SECRET_ACCESS_KEY', env.R2_SECRET_ACCESS_KEY, true],
  ['R2_BUCKET_NAME', env.R2_BUCKET_NAME, false],
  ['R2_ENDPOINT', env.R2_ENDPOINT, false],
  ['ADMIN_PASSWORD', password, true],
  ['SESSION_SECRET', randomBytes(32).toString('hex'), true],
]
for (const [name, value] of vars) if (!value) throw new Error(`${name} has no value in .env`)

for (const [name, value, sensitive] of vars) {
  const args = ['vercel', 'env', 'add', name, 'production', '--yes', ...(sensitive ? ['--sensitive'] : [])]
  try {
    execFileSync('npx', args, { input: value, stdio: ['pipe', 'pipe', 'pipe'], shell: true })
    console.log('set', name, sensitive ? '(sensitive)' : '')
  } catch (e) {
    console.error('FAILED', name, String(e.stderr || e.message).split('\n').filter(Boolean).slice(-2).join(' | ').slice(0, 200))
    process.exit(1)
  }
}
console.log(`\nAll set. Admin password (write it down, then change it in Vercel whenever you like): ${password}`)
