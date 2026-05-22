import type { NextConfig } from "next";
import { withSentryConfig } from '@sentry/nextjs'

// CSP is set per-request by middleware.ts (nonce-based, no unsafe-inline for scripts).
// These static headers apply to every response and don't need per-request nonces.
const securityHeaders = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
]

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: securityHeaders,
      },
    ]
  },
}

export default withSentryConfig(nextConfig, {
  org:     'voxrate',
  project: 'voxrate',
  silent:  true,
  widenClientFileUpload: true,
  disableLogger: true,
  sourcemaps: {
    disable: true,
  },
})
