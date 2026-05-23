// Proxy URL builder — supports both BrightData residential and direct proxies (e.g. Webshare).
//
// BrightData mode (set BRIGHTDATA_CUSTOMER_ID + BRIGHTDATA_ZONE + BRIGHTDATA_PASSWORD):
//   Builds a session-pinned URL so all pages of one product scrape use the same IP.
//
// Direct mode (set PROXY_URL directly, e.g. http://user:pass@host:port):
//   Used for Webshare, Oxylabs, or any standard HTTP proxy.
//   Session pinning is not available — IP rotates per request.

export function proxyUrl(sessionId: string): string {
  // DataImpulse residential with session pinning (sessid parameter in username)
  if (process.env.DATAIMPULSE_LOGIN && process.env.DATAIMPULSE_PASSWORD) {
    const login    = process.env.DATAIMPULSE_LOGIN
    const password = encodeURIComponent(process.env.DATAIMPULSE_PASSWORD)
    const user     = encodeURIComponent(`${login}__sessid.${sessionId}`)
    return `http://${user}:${password}@gw.dataimpulse.com:823`
  }

  // Generic direct proxy URL — no session pinning (Webshare, testing, etc.)
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
