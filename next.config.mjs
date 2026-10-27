// Fully static site: `next build` writes plain files to ./out, which Cloudflare serves with no Worker running.
export default {
  output: 'export',
  // no image optimizer in a static export; photos in public/uploads are served as they are
  images: { unoptimized: true },
}
