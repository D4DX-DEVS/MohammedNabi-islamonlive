# Admin page

`/admin` lets one person add, edit and delete posts and upload photos. Saving writes to the D1 database; the site
shows the change after you press **Publish** (top right), which rebuilds and deploys it in about two minutes. The button
shows "Publishing…" until it is done.

- **Login:** one password, the Worker secret `ADMIN_PASSWORD` (with `SESSION_SECRET` for the login cookie). If either
  is missing the admin refuses every request. Change the password with `npx wrangler secret put ADMIN_PASSWORD`;
  change `SESSION_SECRET` to log everyone out.
- **Photos:** "Upload photo" sets the post's main photo; "Insert photo" puts an `<img>` into the text at the cursor.
  Photos are shrunk to WebP in the browser (max 1600 px wide) and stored in R2. Only JPEG, PNG, WebP and GIF are
  accepted (checked by the file's own bytes), up to 4 MB. A photo is usable at once; its post still needs Publish.
- **Categories** can be chosen but not created or renamed here.
- **Login protection** is a 1 second delay per wrong password plus a long password. For more, add a Cloudflare rate-limiting
  rule on `/api/login` or restrict `/admin` with Cloudflare Access.
- Setup and hosting: see `DEPLOY.md`.
