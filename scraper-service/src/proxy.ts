// Proxy URL builder — supports both BrightData residential and direct proxies (e.g. Webshare).
//
// BrightData mode (set BRIGHTDATA_CUSTOMER_ID + BRIGHTDATA_ZONE + BRIGHTDATA_PASSWORD):
//   Builds a session-pinned URL so all pages of one product scrape use the same IP.
//
// Direct mode (set PROXY_URL directly, e.g. http://user:pass@host:port):
//   Used for Webshare, Oxylabs, or any standard HTTP proxy.
//   Session pinning is not available — IP rotates per request.

export function proxyUrl(sessionId: string): string {
  // Direct proxy URL takes priority (Webshare, testing, any non-BrightData provider)
  if (process.env.PROXY_URL) return process.env.PROXY_URL

  // BrightData residential with session pinning
  const customer = process.env.BRIGHTDATA_CUSTOMER_ID!
  const zone     = process.env.BRIGHTDATA_ZONE ?? 'residential_proxy1'
  const password = process.env.BRIGHTDATA_PASSWORD!
  const port     = process.env.BRIGHTDATA_PORT ?? '33335'
  const user     = encodeURIComponent(`brd-customer-${customer}-zone-${zone}-session-${sessionId}`)
  const pass     = encodeURIComponent(password)
  return `http://${user}:${pass}@brd.superproxy.io:${port}`
}

export function newSessionId(): string {
  return Math.random().toString(36).slice(2, 10)
}
