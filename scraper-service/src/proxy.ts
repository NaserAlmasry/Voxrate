// BrightData residential proxy URL builder.
// Each scrape job gets a unique session ID so all pages of one product
// route through the same residential IP — avoids Amazon cookie invalidation
// between paginated requests.

const CUSTOMER   = process.env.BRIGHTDATA_CUSTOMER_ID!
const ZONE       = process.env.BRIGHTDATA_ZONE ?? 'residential_proxy1'
const PASSWORD   = process.env.BRIGHTDATA_PASSWORD!
const HOST       = 'brd.superproxy.io'
const PORT       = 22225

export function proxyUrl(sessionId: string): string {
  const user = `brd-customer-${CUSTOMER}-zone-${ZONE}-session-${sessionId}`
  return `http://${user}:${PASSWORD}@${HOST}:${PORT}`
}

export function newSessionId(): string {
  // 8-char alphanumeric — short enough for URL, unique enough for our volume
  return Math.random().toString(36).slice(2, 10)
}
