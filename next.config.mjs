// Fully static site: `next build` writes plain files to ./out, which Cloudflare serves without running any code.
// Only /api/* and /media/* reach the Worker (worker/index.ts); headers and redirects live in public/_headers and _redirects.
export default {
  output: 'export',
  // no image optimizer in a static export; photos are served as they are
  images: { unoptimized: true },
}
