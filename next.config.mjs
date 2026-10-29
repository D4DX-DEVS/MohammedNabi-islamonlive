const securityHeaders = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
]

export default {
  // old WordPress search links (/?s=word) land on the new search page
  async redirects() {
    return [{ source: '/', has: [{ type: 'query', key: 's', value: '(?<q>.+)' }], destination: '/search?q=:q', permanent: true }]
  },
  async headers() {
    return [
      { source: '/:path*', headers: securityHeaders },
      // photo file names are not hashed, so keep this short enough that a replaced photo shows up within a week
      { source: '/uploads/:path*', headers: [{ key: 'Cache-Control', value: 'public, max-age=604800, stale-while-revalidate=86400' }] },
    ]
  },
}
