const securityHeaders = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
]

export default {
  poweredByHeader: false,
  // photos are served as they are (no image optimizer on this host)
  images: { unoptimized: true },
  async redirects() {
    return [
      // old WordPress addresses
      { source: '/feed', destination: '/feed.xml', permanent: true },
      { source: '/', has: [{ type: 'query', key: 's', value: '(?<q>.+)' }], destination: '/search?q=:q', permanent: true },
    ]
  },
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }]
  },
}
