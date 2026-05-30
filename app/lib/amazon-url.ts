// ============================================================
// app/lib/amazon-url.ts
//
// Amazon URL validator — accepts Amazon URLs (any marketplace)
// or bare ASINs (10 char alphanumeric).
// ============================================================

export const AMAZON_DOMAINS = [
  'amazon.com', 'amazon.co.uk', 'amazon.de', 'amazon.co.jp',
  'amazon.ca', 'amazon.com.au', 'amazon.fr', 'amazon.it', 'amazon.es',
  'amazon.com.mx', 'amazon.nl', 'amazon.se', 'amazon.pl',
]

export function extractAsin(urlOrAsin: string): string | null {
  const trimmed = urlOrAsin.trim()
  if (/^[A-Z0-9]{10}$/i.test(trimmed)) return trimmed.toUpperCase()
  try {
    const m = trimmed.match(/\/(?:dp|gp\/product)\/([A-Z0-9]{10})/i)
    return m ? m[1].toUpperCase() : null
  } catch {
    return null
  }
}

export function sanitizeAmazonInput(raw: string): string | null {
  const trimmed = raw.trim()

  // Bare ASIN: 10 alphanumeric chars
  if (/^[A-Z0-9]{10}$/i.test(trimmed)) {
    return trimmed.toUpperCase()
  }

  // Full Amazon URL
  try {
    const parsed = new URL(trimmed)
    const host   = parsed.hostname.toLowerCase().replace('www.', '')
    if (!AMAZON_DOMAINS.includes(host)) return null

    // Must contain /dp/ASIN or /gp/product/ASIN
    const asinMatch = parsed.pathname.match(/\/(?:dp|gp\/product)\/([A-Z0-9]{10})/i)
    if (!asinMatch) return null

    return trimmed
  } catch {
    return null
  }
}
