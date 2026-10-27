// Fully static site: `next build` writes plain files to ./out, which Cloudflare serves with no Worker running.
export default {
  output: 'export',
  // no image optimizer in a static export; photos are served as-is from the media bucket
  images: { unoptimized: true },
}
