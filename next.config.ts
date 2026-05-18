import type { NextConfig } from "next";
import { withSentryConfig } from '@sentry/nextjs'

const securityHeaders = [
  // Prevent browsers from MIME-sniffing the response type
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  // Stop page being embedded in iframes (clickjacking)
  { key: 'X-Frame-Options', value: 'DENY' },
  // Force HTTPS for 1 year, include subdomains
  { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' },
  // Disable referrer for cross-origin requests
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  // Disable browser features not needed by the app
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
  // Content Security Policy — restricts where scripts/styles/etc can load from
  {
    key: 'Content-Security-Policy',
    value: [
      "default-src 'self'",
      // Scripts: self + Stripe (payment widget)
      "script-src 'self' 'unsafe-inline' https://js.stripe.com",
      // Styles: self + inline (Tailwind uses inline styles)
      "style-src 'self' 'unsafe-inline'",
      // Images: self + Supabase storage + data URIs
      "img-src 'self' data: blob: https://*.supabase.co",
      // Fonts: self only
      "font-src 'self'",
      // API calls: self + Supabase + Stripe
      "connect-src 'self' https://*.supabase.co https://api.stripe.com wss://*.supabase.co",
      // Frames: Stripe checkout only
      "frame-src https://js.stripe.com https://hooks.stripe.com",
      // No plugins ever
      "object-src 'none'",
      // Base URI locked to self
      "base-uri 'self'",
      // Form submissions to self only
      "form-action 'self'",
    ].join('; '),
  },
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
})
