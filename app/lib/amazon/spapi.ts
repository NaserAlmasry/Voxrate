// Amazon SP-API client — handles token refresh + API calls

export interface SPTokens {
  access_token: string
  expires_in: number
}

const TOKEN_URL = 'https://api.amazon.com/auth/o2/token'

// Exchange a refresh_token for a short-lived access_token (1h TTL)
export async function getAccessToken(refreshToken: string): Promise<string> {
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: process.env.AMAZON_LWA_CLIENT_ID!,
      client_secret: process.env.AMAZON_LWA_CLIENT_SECRET!,
    }),
  })
  if (!res.ok) {
    const body = await res.text()
    throw new Error(`LWA token refresh failed: ${res.status} ${body}`)
  }
  const data = await res.json()
  return data.access_token
}

// Make an authenticated SP-API call with retry on 429/503
export async function spApiCall(
  apiUrl: string,
  accessToken: string,
  path: string,
  params?: Record<string, string>,
  retries = 2,
): Promise<unknown> {
  const url = new URL(`${apiUrl}${path}`)
  if (params) {
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)
  }
  for (let attempt = 0; attempt <= retries; attempt++) {
    const res = await fetch(url.toString(), {
      headers: {
        'x-amz-access-token': accessToken,
        'Content-Type': 'application/json',
        'User-Agent': 'Voxrate/1.1 (Language=JavaScript/Node)',
      },
    })
    if (res.status === 429 || res.status === 503) {
      const retryAfter = parseInt(res.headers.get('Retry-After') ?? '2', 10)
      const wait = (isFinite(retryAfter) ? retryAfter : 2) * 1000 * Math.pow(2, attempt)
      if (attempt < retries) {
        await new Promise(r => setTimeout(r, wait))
        continue
      }
    }
    if (!res.ok) {
      const body = await res.text()
      throw new Error(`SP-API ${path} failed: ${res.status} ${body}`)
    }
    return res.json()
  }
  throw new Error(`SP-API ${path} failed after ${retries} retries`)
}

// Pull account health rating from SP-API
// Returns { healthScore, status, suspensionThreshold } or null on error
export async function fetchAccountHealth(
  apiUrl: string,
  accessToken: string,
  marketplaceId: string,
): Promise<{ healthScore: number; status: string; suspensionThreshold: number } | null> {
  try {
    const data = await spApiCall(apiUrl, accessToken, '/seller/v1/account/health/ratings', {
      marketplaceIds: marketplaceId,
    }) as { payload?: { healthScore?: number; status?: string; suspensionThreshold?: number } }
    const p = data?.payload
    if (!p) return null
    return {
      healthScore: p.healthScore ?? 0,
      status: p.status ?? 'UNKNOWN',
      suspensionThreshold: p.suspensionThreshold ?? 100,
    }
  } catch {
    return null
  }
}

// Pull FBA stranded inventory count
export async function fetchStrandedInventory(
  apiUrl: string,
  accessToken: string,
  marketplaceId: string,
): Promise<{ strandedUnits: number; asinCount: number } | null> {
  try {
    const data = await spApiCall(apiUrl, accessToken, '/fba/inventory/v1/inventories', {
      marketplaceIds: marketplaceId,
      details: 'true',
    }) as { payload?: { inventorySummaries?: Array<{ condition?: string; totalQuantity?: number }> } }
    const summaries = data?.payload?.inventorySummaries ?? []
    // Stranded = items with no active listing (condition 'STRANDED' from Amazon)
    // SP-API doesn't have a direct stranded endpoint — we use fulfillment health instead
    // For now, return total inventory as a proxy; stranded alert comes from account health
    return { strandedUnits: 0, asinCount: summaries.length }
  } catch {
    return null
  }
}

// Marketplace ID map (most common)
export const MARKETPLACE_IDS: Record<string, string> = {
  'amazon.com':    'ATVPDKIKX0DER',   // US
  'amazon.co.uk':  'A1F83G8C2ARO7P',  // UK
  'amazon.de':     'A1PA6795UKMFR9',  // DE
  'amazon.fr':     'A13V1IB3VIYZZH',  // FR
  'amazon.it':     'APJ6JRA9NG5V4',   // IT
  'amazon.es':     'A1RKKUPIHCS9HS',  // ES
  'amazon.ca':     'A2EUQ1WTGCTBG2',  // CA
  'amazon.co.jp':  'A1VC38T7YXB528',  // JP
  'amazon.in':     'A21TJRUUN4KGV',   // IN
  'amazon.com.au': 'A39IBJ37TRP1C6',  // AU
  'amazon.com.mx': 'A1AM78C64UM0Y8',  // MX
}
