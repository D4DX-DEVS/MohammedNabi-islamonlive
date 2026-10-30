# Admin page

`/admin` lets one person add, edit and delete posts and upload photos. Saving writes to the D1 database and drops the
stored pages, so the change is live on the next visit; there is nothing to publish.

- **Login:** one password, the Worker secret `ADMIN_PASSWORD` (with `SESSION_SECRET` for the login cookie). If either
  is missing the admin refuses every request. Change the password with `npx wrangler secret put ADMIN_PASSWORD --name muhammad-nabi`;
  change `SESSION_SECRET` to log everyone out.
- **Photos:** "Upload photo" sets the post's main photo; "Insert photo" puts an `<img>` into the text at the cursor.
  Photos are shrunk to WebP in the browser (max 1600 px wide) and stored in R2. Only JPEG, PNG, WebP and GIF are
  accepted (checked by the file's own bytes), up to 4 MB.
- **Categories** can be chosen but not created or renamed here.
- **Login protection** is a 1 second delay per wrong password plus a long password. For more, add a Cloudflare rate-limiting
  rule on `/api/login` or restrict `/admin` with Cloudflare Access.
- Setup and hosting: see `DEPLOY.md`.
