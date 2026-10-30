# Hosting: Cloudflare (static site + a small Worker)

```
visitors -> Cloudflare static files (out/)      every page, built from the database; no code runs
         -> Worker (worker/index.ts)           only /api/* (admin, search) and /media/* (photos from R2)
you      -> /admin -> Worker -> D1 / R2        edits are saved at once, then Publish rebuilds the site
Publish  -> GitHub Action -> next build (reads D1) -> wrangler deploy
```

Why static: Cloudflare's free plan allows 10 ms of CPU per request, too little to render pages on demand. Static files
cost no CPU, so the site is fast and free; the Worker only handles the few dynamic requests.

- **Editing:** a saved post is in the database immediately but visitors see it only after **Publish** in the admin
  (a rebuild, about two minutes).
- **Photos:** the original 27 are files in `public/uploads`; photos uploaded in the admin go to R2 and are served at `/media/...`.
- **Search** runs in the Worker against D1 (`/api/search`).
- `public/_headers` (security + cache headers) and `public/_redirects` (old `/feed` address) are applied by Cloudflare.

## One-time setup

1. **Worker secrets** (Cloudflare account that holds the D1 database and R2 bucket `muhammednabi`):
   `npx wrangler secret put ADMIN_PASSWORD`, `SESSION_SECRET`, `GH_REPO` (`D4DX-DEVS/MohammedNabi-islamonlive`),
   `GH_DISPATCH_TOKEN` (GitHub fine-grained token, repository access to this repo, permission Actions: read and write).
2. **GitHub repository** > Settings > Secrets and variables > Actions:
   - secrets `D1_ACCOUNT_ID`, `D1_DATABASE_ID`, `D1_API_TOKEN` (D1 read token), `CF_DEPLOY_ACCOUNT_ID`,
     `CF_DEPLOY_TOKEN` (Cloudflare token from the "Edit Cloudflare Workers" template)
   - variable `SITE_URL`: the public address, https:// and no trailing slash
3. **First deploy:** Actions tab > Deploy > Run workflow, or from this computer: `npm run deploy` (needs `.env` and `wrangler login`).
4. **Own domain:** Workers & Pages > muhammad-nabi > Settings > Domains & Routes > Add > Custom domain. The domain's DNS
   must be on Cloudflare. Then change the `SITE_URL` variable and run Deploy again.

## Things to know

- Run **Deploy** (Actions tab) after changing code; pushing to GitHub does not deploy by itself.
- **Changing a slug or the main category changes the post's link.** Old links stop working.
- **Post HTML is published as typed.** Only give the admin password to people you trust with the whole site.
- **`npm run db:seed`** refuses to run on a database that already has posts. Use `--force` only if you really want to
  overwrite admin edits with the original export.
- The admin cannot run under `next dev` (the API lives in the Worker). To try it locally: `npm run build`, copy
  `.dev.vars.example` to `.dev.vars`, then `npx wrangler dev --remote` (this uses the real database).
