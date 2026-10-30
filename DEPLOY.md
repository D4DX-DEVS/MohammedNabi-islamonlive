# Hosting: Cloudflare Worker (Next.js via OpenNext) + D1 + R2

```
visitors -> Worker (worker/index.ts) -> stored page (edge cache / R2)  or  renders it with Next.js from D1
you      -> /admin -> Worker (worker/api.ts, /api/*) -> D1 / R2         the stored pages are dropped, the change is live
```

- **Pages render from D1 on request**, then the Worker stores the result (edge cache + R2 `cache/pages/...`). A stored
  page is valid until the next save in the admin (`cache/purged` in R2 moves forward) or 7 days. Nothing to publish:
  a saved post shows up on its next visit. A Cron Trigger (every 5 minutes) renders a few pages nobody has asked for.
- **Why the store:** the free plan cuts a request off after 10 ms of CPU and D1 allows 5M row reads a day. Stored pages
  cost about 3 ms. A fresh render runs in a separate invocation (the Worker calls itself) and is retried if cut off.
  If D1 fails, the old stored copy is served. (Same design as the fatwa site.)
- **Photos:** the original 27 are files in `public/uploads`; photos uploaded in the admin go to R2 (`media/...`),
  served by the Worker at `/media/...`.
- **Search** runs in the Worker against D1 (`/api/search`); the search page fetches it.
- **Search engines:** only the address in `SITE_URL` (wrangler.jsonc `vars`) is indexed. Every other address serving the
  Worker (workers.dev after the domain switch) answers `robots.txt` with "disallow all" and sends `noindex`.

## Deploy

```
npm run deploy
```
Builds with OpenNext, strips secrets from the bundle (`scripts/strip-env.mjs`) and runs `wrangler deploy`. Run it after
every code change. **Always use `npm run deploy`**, not `wrangler deploy` alone: the build copies `.env` into the bundle.
It needs `wrangler login` (or `CLOUDFLARE_API_TOKEN`) for the Cloudflare account that holds D1 and R2.

## One-time setup (done)

- Worker secrets: `ADMIN_PASSWORD`, `SESSION_SECRET` (`npx wrangler secret put NAME --name muhammad-nabi`).
- D1 database `muhammednabi` and R2 bucket `muhammednabi` are bound in `wrangler.jsonc` (`DB`, `MEDIA`).
- **Own domain:** Workers & Pages > muhammad-nabi > Settings > Domains & Routes > Add > Custom domain (the domain's DNS
  must be on Cloudflare). Then set `NEXT_PUBLIC_SITE_URL` in `.env` (and remove it from `.env.local`) **and** `SITE_URL`
  in `wrangler.jsonc` to the domain, and run `npm run deploy`. If a forwarder sits in front of the Worker, it must send
  `x-forwarded-host`.

## Things to know

- **Changing a slug or the main category changes the post's link.** Old links stop working.
- **Post HTML is published as typed.** Only give the admin password to people you trust with the whole site.
- **`npm run db:seed`** refuses to run on a database that already has posts. Use `--force` only if you really want to
  overwrite admin edits with the original export.
- `npm run dev` reads the real database over the REST API and has no admin (the API lives in the Worker).
