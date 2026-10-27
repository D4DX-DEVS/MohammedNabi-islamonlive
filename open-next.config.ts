import { defineCloudflareConfig } from '@opennextjs/cloudflare'
import staticAssetsIncrementalCache from '@opennextjs/cloudflare/overrides/incremental-cache/static-assets-incremental-cache'

// All content ships with the app and never revalidates, so prerendered pages are served straight from the assets (no R2/KV needed).
export default defineCloudflareConfig({
  incrementalCache: staticAssetsIncrementalCache,
})
