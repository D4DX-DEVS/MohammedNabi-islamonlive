# Admin page

`/admin` lets one person add, edit and delete posts and upload photos. Edits are saved to the D1 database and are live
on the site straight away (the page cache is expired on every save).

- **Login:** one password, the `ADMIN_PASSWORD` environment variable (with `SESSION_SECRET` for the login cookie). If either
  is missing the admin refuses every request. Change the password by changing the variable in Vercel and redeploying;
  change `SESSION_SECRET` to log everyone out.
- **Photos:** "Upload photo" sets the post's main photo; "Insert photo" puts an `<img>` into the text at the cursor.
  Photos are shrunk to WebP in the browser (max 1600 px wide) and stored in R2. Only JPEG, PNG, WebP and GIF are
  accepted (checked by the file's own bytes), up to 4 MB.
- **Categories** can be chosen but not created or renamed here.
- **Login protection** is a 1 second delay per wrong password plus a long password. For more, add a rate-limiting rule
  on `/api/login` (Vercel Firewall) or restrict `/admin` by IP.
- Setup and hosting: see `DEPLOY.md`.
