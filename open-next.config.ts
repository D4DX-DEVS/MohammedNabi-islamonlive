import { defineCloudflareConfig } from "@opennextjs/cloudflare";

// Pages render per request from D1 and worker/index.ts stores the result, so no incremental cache is needed.
export default defineCloudflareConfig({});
