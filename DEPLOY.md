# Hosting: Vercel (with Cloudflare D1 + R2)

```
visitors -> Vercel (Next.js, cached pages) -> Cloudflare D1   posts and categories
                                           -> Cloudflare R2   photos uploaded in the admin (served at /media/...)
you      -> /admin on the same site  -> edits D1/R2, the cache is expired, the change is live at once
```

- Pages are built on the first visit and then cached (ISR). Editing in `/admin` expires the cache, so a change shows up
  immediately. Nothing needs rebuilding or publishing.
- The original 27 photos are files in `public/uploads` (served by Vercel's CDN). Photos uploaded in the admin go to R2.
- Next.js resizes photos and converts them to WebP/AVIF on the fly.
- Cloudflare is only the data store. Nothing runs on Cloudflare any more.

## First deploy

1. **Vercel account**: sign up at vercel.com with GitHub.
2. **Import the project**: Add New > Project > pick `D4DX-DEVS/MohammedNabi-islamonlive`. Framework (Next.js) is detected.
   If the organization does not show, click "Adjust GitHub App Permissions" and allow the repository.
3. **Environment Variables** (before pressing Deploy): add every name from `.env.example` with its real value, for
   Production, Preview and Development. `D1_ADMIN_API_TOKEN` is the "D1: Edit" token, `D1_API_TOKEN` the read-only one.
4. **Deploy.** The build reads the database once, so the D1 variables must be set first.
5. Open the `*.vercel.app` address, check a few pages, then log in at `/admin`.
6. **Your own domain**: Project > Settings > Domains > Add. Vercel shows the DNS records to create (a CNAME, or an A
   record for a bare domain). Then set `NEXT_PUBLIC_SITE_URL` to it and redeploy.

Every push to `main` redeploys automatically.

## Things to know

- **Region:** `vercel.json` runs the functions in Mumbai (`bom1`), close to your readers. D1 itself is in Asia-Pacific.
- **Plan:** the free Hobby plan is meant for personal, non-commercial projects. If D4DX runs this commercially, Vercel
  requires the Pro plan.
- **D1 limits:** Cloudflare's API allows about 1,200 requests per 5 minutes per token. Pages are cached, so normal
  traffic is far below that. A crawler fetching every page right after an edit (which expires the whole cache) can
  briefly hit it; failed reads are retried a few times.
- **Photos:** uploaded files are named with a random suffix and cached for a year. The admin shrinks them to WebP in the
  browser first, and the limit is 4 MB per photo.
- **Changing a slug or the main category changes the post's link.** Old links stop working.
- **Post HTML is published as typed.** Only give the admin password to people you trust with the whole site.
- **`npm run db:seed`** refuses to run on a database that already has posts: it would overwrite admin edits with the
  original export. Use `--force` only if you really want that.

## Local development

```
cp .env.example .env     # fill it in
npm run dev              # http://localhost:3000, reads the real D1 database
```
`/admin` writes to the real database, so create a throwaway post to experiment and delete it afterwards.

## Cleaning up the old Cloudflare hosting (after Vercel works)

- Delete the Worker: Cloudflare dashboard > Workers & Pages > muhammad-nabi > Settings > Delete.
- GitHub repo > Settings > Secrets and variables > Actions: delete `D1_ACCOUNT_ID`, `D1_DATABASE_ID`, `D1_API_TOKEN`,
  `CF_DEPLOY_ACCOUNT_ID` and the `SITE_URL` variable.
- Revoke the Cloudflare deploy token and the GitHub dispatch token if you created them for Publish.
