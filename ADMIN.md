# Admin page

`/admin` lets you add, edit and delete posts. It edits the D1 database; the public site is static files, so changes go
live when you **Publish** (or run `npm run deploy`).

```
visitors  ->  static files (no code runs)
you       ->  /admin  ->  /api/* (small Worker, password + signed cookie)  ->  D1
Publish   ->  GitHub Action: build from D1 -> wrangler deploy
```

## One-time setup (production)

1. **Deploy once** so the Worker exists: `npm run deploy`. Until the secrets below are set, `/admin` shows
   "Admin is not set up yet" and every `/api` call is refused (it fails closed).
2. **Set the secrets** (PowerShell, in the project folder; each command asks for the value):
   ```
   npx wrangler secret put ADMIN_PASSWORD     # choose a long password; this is what you type on /admin
   npx wrangler secret put SESSION_SECRET     # any long random text, e.g. output of the command below
   npx wrangler secret put D1_ACCOUNT_ID
   npx wrangler secret put D1_DATABASE_ID
   npx wrangler secret put D1_API_TOKEN       # a token with  Account > D1 > Edit  (see note)
   ```
   Random text for `SESSION_SECRET`: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`
3. Open `https://<your site>/admin` and log in.

**Token note.** The admin must write, so `D1_API_TOKEN` needs **D1: Edit**. The token in `.env` that builds the site only
needs read access; keep it read-only. If the Worker runs in the *same* Cloudflare account as the database you can use a
D1 binding instead of a token: add `"d1_databases": [{ "binding": "DB", "database_name": "muhammednabi", "database_id": "..." }]`
to `wrangler.jsonc` and skip the three D1 secrets.

**Changing the password:** run `npx wrangler secret put ADMIN_PASSWORD` again. To log everyone out, change `SESSION_SECRET`.

## Publish button (optional)

Without this the button stays disabled and you publish with `npm run deploy` from your computer.

1. GitHub repo -> Settings -> Secrets and variables -> Actions:
   - Secrets: `D1_ACCOUNT_ID`, `D1_DATABASE_ID`, `D1_API_TOKEN` (read-only is enough), `CF_DEPLOY_TOKEN`
     (Cloudflare token from the "Edit Cloudflare Workers" template), `CF_DEPLOY_ACCOUNT_ID` (the account that hosts the site).
   - Variable: `SITE_URL` (for example `https://your-domain.com`).
2. Create a GitHub fine-grained token for this repository only, permission **Actions: Read and write**, then:
   ```
   npx wrangler secret put GH_REPO             # D4DX-DEVS/MohammedNabi-islamonlive
   npx wrangler secret put GH_DISPATCH_TOKEN   # the token from this step
   ```
3. In the admin page, **Publish** now starts the "Deploy" workflow and shows its progress (about two minutes).

## Testing locally

```
cp .dev.vars.example .dev.vars      # fill in; this file is git-ignored
npm run db:seed:local               # a throwaway local copy of the database (first time only)
npm run preview                     # builds, then serves the site + admin on http://localhost:8787
```
`npm run preview` uses a **local** database copy, so you can experiment without touching real posts.

## Things to know

- **Photos:** the admin stores a photo as a path. Add the file to `public/uploads/...`, commit, deploy, then enter
  `/uploads/2026/10/name.jpg` in the post. There is no upload button yet.
- **Changing a slug or the main category changes the post's link.** Old links will no longer work.
- **Post HTML is published as typed.** Only give the password to people you trust with the whole site.
- **Login protection** is a 1 second delay per wrong password plus a long password. For more, add a Cloudflare rate-limiting
  rule on `/api/login`, or put `/admin*` and `/api/*` behind Cloudflare Access.
- **`npm run db:seed` refuses to run** once the database has posts, because it would overwrite your edits with the
  original export. Use `--force` only if you really want that.
- Categories can be chosen but not created or renamed from the admin page (yet).
