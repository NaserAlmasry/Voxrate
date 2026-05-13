// ============================================================
// app/api/analyze/route.ts
//
// PROXY FIX (this version):
//  [PROXY-1] Removed Web Scraping API (scraper-api.decodo.com) entirely.
//            It was returning 613 "could not scrape" on Etsy — unfixable.
//  [PROXY-2] All HTTP requests to Etsy now route through your Decodo
//            Residential Proxy (us.decodo.com:10000) via undici ProxyAgent.
//            Residential IPs are not blocklisted by Etsy; datacenter IPs are.
//  [PROXY-3] fetchReviewsFromInternalApi() was making a naked fetch from
//            the Vercel datacenter IP — Etsy sees it instantly and 404s.
//            Now proxied through residential endpoint.
//  [PROXY-4] fetchReviewsFromDeepDiveApi() direct fetch fallback also proxied.
//  [PROXY-5] Geo rotation added: us → gb → ca → au. If one IP pool is
//            temporarily rate-limited, the next geo retries automatically.
//  [PROXY-6] Session pinning: all requests for a single listing share the
//            same session_id so Etsy sees one consistent "user" browsing.
//
// REQUIRED: npm install undici
// ENV VARS NEEDED:
//   DECODO_USERNAME   — e.g. sp2pq9xo68   (from Decodo dashboard)
//   DECODO_PASSWORD   — your proxy password
//   DECODO_PROXY_HOST — us.decodo.com     (or gate.decodo.com)
//   DECODO_PROXY_PORT — 10000
//
// MODEL ROUTING — unchanged from previous version:
//  [ROUTING-1] Call 1 (Complaints):    llama-3.3-70b-versatile
//  [ROUTING-2] Call 2 (Strengths):     llama-3.3-70b-versatile
//  [ROUTING-3] Call 3 (SEO+Marketing): llama-3.1-8b-instant
//  [ROUTING-4] Call 4 (Summary):       llama-3.1-8b-instant
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import Groq from 'groq-sdk'
import { ProxyAgent, fetch as uFetch } from 'undici'
import { createClient } from '@/app/lib/supabase/server'
import {
  calculateHealthScore,
  formatHealthScoreForPrompt,
  applyHardOverrides,
  validateSemanticConstraints,
} from '@/app/lib/health-score'
import { enforceRateLimit } from '@/app/lib/rate-limit'
import { checkCsrf } from '@/app/lib/csrf'
import {
  generateDomainAndSeo,
  extractWorstReviews,
  extractBestReviews,
} from '@/app/lib/domain-knowledge'
import { extractPatterns, buildSmartSample } from '@/app/lib/pattern-extractor'
import { calculateSeoScore } from '@/app/lib/seo-scorer'
import { sendReportComplete } from '@/app/lib/email'

export const maxDuration = 300

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY })

// ── Model routing ─────────────────────────────────────────────
const MODEL_70B = 'llama-3.3-70b-versatile'
const MODEL_8B  = 'llama-3.1-8b-instant'

// ── Geo rotation for residential proxy ───────────────────────
// Rotates through geos when one is rate-limited or blocked.
const GEO_ROTATION = ['us', 'gb', 'ca', 'au']

// ── Residential proxy builder ─────────────────────────────────
// Returns an undici ProxyAgent pointed at your Decodo residential endpoint.
// Residential IPs (homes) are not flagged by Etsy; datacenter IPs are.
//
// Decodo residential proxy URL format:
//   http://USERNAME:PASSWORD@PROXY_HOST:PORT
//
// For geo/session targeting, Decodo encodes parameters into the username:
//   USERNAME-country-US-session-SESSION_ID
//
// See: https://help.decodo.com/residential-proxies/proxy-setup

function buildProxyAgent(geo = 'us', sessionId?: string): ProxyAgent {
  const username = process.env.DECODO_PROXY_USER
  const password = process.env.DECODO_PROXY_PASS
  const host     = process.env.DECODO_PROXY_HOST || 'gate.decodo.com'
  const port     = process.env.DECODO_PROXY_PORT || '10000'

  if (!username || !password) {
    throw new Error('DECODO_USERNAME or DECODO_PASSWORD env var not set')
  }

  // Decodo username format for targeting:
  // sp2pq9xo68-country-US                       (rotating residential, US)
  // sp2pq9xo68-country-US-session-abc123        (sticky session, same IP)
  let targetedUsername = `${username}-country-${geo.toUpperCase()}`
  if (sessionId) {
    targetedUsername += `-session-${sessionId}`
  }

  const proxyUrl = `http://${targetedUsername}:${password}@${host}:${port}`
  return new ProxyAgent(proxyUrl)
}

// ── Proxied fetch wrapper ─────────────────────────────────────
// All Etsy requests must go through this — never use global fetch() for Etsy.
// undici's fetch() accepts a `dispatcher` option for proxy routing.

async function proxyFetch(
  url: string,
  init: RequestInit & { dispatcher?: ProxyAgent } = {},
  geo = 'us',
  sessionId?: string,
): Promise<Response> {
  const agent = buildProxyAgent(geo, sessionId)
  // undici's fetch is type-compatible with the global fetch API
  return uFetch(url, { ...init, dispatcher: agent } as any) as unknown as Response
}

// ── Geo-rotating fetch ────────────────────────────────────────
// Tries each geo in order. On 403/429/613 moves to next geo.
// Returns on first success.

async function proxyFetchWithGeoFallback(
  url: string,
  init: RequestInit = {},
  sessionId?: string,
): Promise<Response> {
  let lastError: Error = new Error('No geos attempted')

  for (const geo of GEO_ROTATION) {
    try {
      const res = await proxyFetch(url, init, geo, sessionId)
      // Treat 403 and 429 as blocked — try next geo
      if (res.status === 403 || res.status === 429) {
        console.log(`[Proxy] Geo ${geo} returned ${res.status} for ${url} — trying next geo`)
        lastError = new Error(`HTTP ${res.status} on geo ${geo}`)
        continue
      }
      console.log(`[Proxy] Geo ${geo} OK for ${url}`)
      return res
    } catch (err: any) {
      console.log(`[Proxy] Geo ${geo} failed: ${err.message} — trying next geo`)
      lastError = err
    }
  }

  throw new Error(`All proxy geos failed for ${url}: ${lastError.message}`)
}

// ── URL sanitizer ─────────────────────────────────────────────

function sanitizeEtsyUrl(raw: string): string | null {
  try {
    const parsed = new URL(raw.trim())
    if (!['www.etsy.com', 'etsy.com'].includes(parsed.hostname)) return null
    if (!parsed.pathname.includes('/listing/')) return null
    const parts = parsed.pathname.split('/')
    const idx   = parts.indexOf('listing')
    if (idx === -1 || !parts[idx + 1]) return null
    return `https://www.etsy.com/listing/${parts[idx + 1]}/${parts[idx + 2] || ''}`
  } catch {
    return null
  }
}

// ── Etsy API review fetcher ───────────────────────────────────
// Uses the official Etsy v3 API to fetch all reviews in batches of 100.
// Requires ETSY_API_KEY in env. Falls back to proxy scraping if missing.
// NOTE: This requires a valid non-banned Etsy API key to work.

function extractListingId(productUrl: string): string | null {
  const match = productUrl.match(/\/listing\/(\d+)/)
  return match ? match[1] : null
}

async function fetchReviewsViaEtsyApi(
  listingId: string,
): Promise<Array<{ rating: number; text: string; date: string }>> {
  const apiKey = process.env.ETSY_API_KEY
  if (!apiKey) throw new Error('ETSY_API_KEY not set')

  const allReviews: Array<{ rating: number; text: string; date: string }> = []
  const LIMIT  = 100
  let   offset = 0
  let   total  = Infinity

  console.log(`[EtsyAPI] Fetching reviews for listing ${listingId}`)

  while (allReviews.length < total && allReviews.length < 400) {
    const url = `https://openapi.etsy.com/v3/application/listings/${listingId}/reviews?limit=${LIMIT}&offset=${offset}`

    const res = await fetch(url, {
      headers: {
        'x-api-key': apiKey,
        'Accept':    'application/json',
      },
      signal: AbortSignal.timeout(30_000),
    })

    if (!res.ok) {
      const err = await res.text()
      console.error(`[EtsyAPI] HTTP ${res.status}: ${err.slice(0, 200)}`)
      throw new Error(`Etsy API error ${res.status}`)
    }

    const json   = await res.json()
    total        = json.count ?? json.total ?? total
    const results: any[] = json.results ?? []
    if (results.length === 0) break

    for (const r of results) {
      const text = (r.review ?? '').replace(/<[^>]*>/g, '').trim()
      if (text.length > 5) {
        allReviews.push({
          rating: r.rating ?? 5,
          text,
          date: r.create_timestamp
            ? new Date(r.create_timestamp * 1000).toISOString().slice(0, 10)
            : '',
        })
      }
    }

    console.log(`[EtsyAPI] offset=${offset} fetched=${results.length} total=${allReviews.length}/${total}`)
    offset += LIMIT

    if (results.length < LIMIT) break
    await new Promise((r) => setTimeout(r, 300))
  }

  console.log(`[EtsyAPI] Done — ${allReviews.length} reviews fetched`)
  return allReviews
}

// ── Proxied HTML fetcher ──────────────────────────────────────
// Replaces the old scraper-api.decodo.com Web Scraping API.
// Fetches raw HTML through your residential proxy directly.
// Much cheaper, faster, and avoids the 613 "could not scrape" error.

const BROWSER_HEADERS = {
  'User-Agent':      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Accept':          'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
  'Accept-Encoding': 'gzip, deflate, br',
  'Connection':      'keep-alive',
  'Upgrade-Insecure-Requests': '1',
  'Sec-Fetch-Dest':  'document',
  'Sec-Fetch-Mode':  'navigate',
  'Sec-Fetch-Site':  'none',
  'Sec-Fetch-User':  '?1',
  'Cache-Control':   'max-age=0',
}

async function fetchHtmlViaProxy(
  url: string,
  sessionId?: string,
): Promise<string> {
  console.log(`[Proxy] Fetching HTML: ${url}`)

  const res = await proxyFetchWithGeoFallback(
    url,
    {
      headers: BROWSER_HEADERS,
      signal: AbortSignal.timeout(45_000),
    },
    sessionId,
  )

  if (!res.ok) {
    throw new Error(`Proxy HTML fetch failed: HTTP ${res.status} for ${url}`)
  }

  const html = await res.text()
  if (!html || html.length < 500) {
    throw new Error(`Proxy returned empty/tiny HTML (${html.length} chars) for ${url}`)
  }

  console.log(`[Proxy] Got ${html.length} chars from ${url}`)
  return html
}

// ── First-page scrape ─────────────────────────────────────────

async function scrapeFirstPage(
  url: string,
  sessionId?: string,
): Promise<{ renderedHtml: string; rawHtml: string }> {
  try {
    const html = await fetchHtmlViaProxy(url, sessionId)
    console.log(`[Proxy] First page — ${html.length} chars`)
    // We get one HTML response from the proxy (server-rendered by Etsy)
    // Use it for both rawHtml and renderedHtml since we no longer have
    // a separate JS-rendering step (the proxy fetches static HTML).
    return { renderedHtml: html, rawHtml: html }
  } catch (err) {
    console.warn(`[Proxy] First page failed: ${err}`)
    return { renderedHtml: '', rawHtml: '' }
  }
}

async function scrapePage(url: string, sessionId?: string): Promise<string> {
  return fetchHtmlViaProxy(url, sessionId)
}

// ── JSON-LD extraction ────────────────────────────────────────

function extractJsonLd(html: string): any {
  const matches =
    html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g) || []

  for (const match of matches) {
    try {
      const json = JSON.parse(
        match
          .replace(/<script type="application\/ld\+json">/, '')
          .replace('</script>', '')
          .trim(),
      )
      if (json['@type'] === 'Product' || json.name) return json
    } catch {
      continue
    }
  }

  console.warn('[Parser] No valid JSON-LD found in HTML')
  return null
}

// ── Etsy embedded page-state extraction ──────────────────────

function extractReviewsFromPageState(
  html: string,
): Array<{ rating: number; text: string; date: string }> {
  const reviews: Array<{ rating: number; text: string; date: string }> = []

  const jsonBlocks = html.match(/<script type="application\/json"[^>]*>([\s\S]*?)<\/script>/gi) || []
  const nextData   = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/i)
  const blocks: string[] = [...jsonBlocks, ...(nextData ? [nextData[0]] : [])]

  for (const block of blocks) {
    let json: any
    try {
      const content = block.replace(/<script[^>]*>/, '').replace('</script>', '').trim()
      if (content.length < 50) continue
      json = JSON.parse(content)
    } catch { continue }

    const found = extractReviewObjects(json, 0)
    for (const r of found) {
      if (r.text.length > 10) reviews.push(r)
    }
    if (reviews.length > 0) break
  }

  return reviews
}

function extractReviewObjects(
  obj: any,
  depth: number,
): Array<{ rating: number; text: string; date: string }> {
  if (depth > 12 || !obj || typeof obj !== 'object') return []
  const results: Array<{ rating: number; text: string; date: string }> = []

  if (Array.isArray(obj)) {
    for (const item of obj) results.push(...extractReviewObjects(item, depth + 1))
    return results
  }

  const text   = obj.review || obj.reviewBody || obj.body || obj.content || obj.text || ''
  const rating = obj.rating || obj.reviewRating?.ratingValue || obj.stars || 0
  if (typeof text === 'string' && text.length > 10 && typeof rating === 'number') {
    results.push({
      rating: Math.min(5, Math.max(1, Math.round(rating))),
      text: text.replace(/<[^>]*>/g, '').replace(/&#39;/g, "'").replace(/&amp;/g, '&').trim(),
      date: obj.datePublished || obj.create_timestamp
        ? (obj.datePublished || new Date(obj.create_timestamp * 1000).toISOString().slice(0, 10))
        : '',
    })
    return results
  }

  for (const key of Object.keys(obj)) results.push(...extractReviewObjects(obj[key], depth + 1))
  return results
}

// ── Product + review parsers ──────────────────────────────────

function parseProduct(data: any, url: string) {
  const slug         = url.split('/').pop() || 'product'
  const fallbackTitle = slug
    .split('-')
    .map((w: string) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
    .replace(/\d+/g, '')
    .trim()

  return {
    title:       data?.name                          || fallbackTitle,
    price:       data?.offers?.price                 || '0',
    rating:      data?.aggregateRating?.ratingValue  || '0',
    reviewCount: 0,
    shopName:    data?.brand?.name                   || 'Etsy Shop',
    description: data?.description                   || '',
  }
}

function parseReviews(
  data: any,
): Array<{ rating: number; text: string; date: string }> {
  if (!data?.review) return []

  return (data.review as any[])
    .filter((r) => r.reviewBody && r.reviewBody.trim().length > 5)
    .map((r) => ({
      rating: parseInt(r.reviewRating?.ratingValue) || 5,
      text: r.reviewBody
        .replace(/&#39;/g,  "'")
        .replace(/&amp;/g,  '&')
        .replace(/&quot;/g, '"')
        .replace(/<[^>]*>/g, '')
        .trim(),
      date: r.datePublished || '',
    }))
}

function parseReviewsFromHtml(html: string) {
  const reviews: Array<{ rating: number; text: string; date: string }> = []
  const safeHtml = html.length > 2_000_000 ? html.slice(0, 2_000_000) : html

  const blockPattern =
    /aria-label="(\d)\s+out\s+of\s+5\s+stars?"[\s\S]{0,2000}?<p[^>]*>([\s\S]*?)<\/p>/gi

  let m: RegExpExecArray | null
  // eslint-disable-next-line no-cond-assign
  while ((m = blockPattern.exec(safeHtml)) !== null) {
    const rating = parseInt(m[1]) || 5
    const text = m[2]
      .replace(/<[^>]*>/g, '')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&amp;/g, '&')
      .trim()
    if (text.length > 30) {
      reviews.push({ rating, text, date: '' })
    }
  }

  if (reviews.length === 0) {
    const matches =
      html.match(/<p[^>]*class="[^"]*wt-text-body[^"]*"[^>]*>(.*?)<\/p>/g) || []
    for (const block of matches) {
      const text = block
        .replace(/<[^>]*>/g, '')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&amp;/g, '&')
        .trim()
      if (text.length > 30) {
        reviews.push({ rating: 5, text, date: '' })
      }
    }
  }

  return reviews
}

function decodeHtmlText(text: string) {
  return text
    .replace(/<[^>]*>/g, '')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function parseReviewsFromDeepDiveHtml(html: string) {
  const reviews = parseReviewsFromHtml(html)
  if (reviews.length > 0) return reviews

  const safeHtml = html.length > 1_000_000 ? html.slice(0, 1_000_000) : html
  const cards = safeHtml.match(/<div[^>]*(?:class="[^"]*review-card[^"]*"|data-review-region="[^"]+")[\s\S]*?(?=<div[^>]*(?:class="[^"]*review-card[^"]*"|data-review-region="[^"]+")|$)/gi) || []

  for (const card of cards) {
    const ratingMatch =
      card.match(/name="rating"[^>]*value="(\d)"/i) ||
      card.match(/aria-label="(\d)\s+out\s+of\s+5\s+stars?"/i)
    const textMatch =
      card.match(/<p[^>]*data-review-text[^>]*>([\s\S]*?)<\/p>/i) ||
      card.match(/<div[^>]*class="[^"]*wt-text-body[^"]*"[^>]*>([\s\S]*?)<\/div>/i) ||
      card.match(/<p[^>]*class="[^"]*wt-text-body[^"]*"[^>]*>([\s\S]*?)<\/p>/i)

    const text = textMatch ? decodeHtmlText(textMatch[1]) : ''
    if (text.length > 10) {
      reviews.push({
        rating: ratingMatch ? parseInt(ratingMatch[1]) || 5 : 5,
        text,
        date: '',
      })
    }
  }

  return reviews
}

// ── Review sampling ───────────────────────────────────────────

function sampleReviews(
  allReviews: Array<{ rating: number; text: string; date: string }>,
  totalCount: number,
): Array<{ rating: number; text: string; date: string }> {
  const byRating: Record<number, typeof allReviews> = {
    1: [], 2: [], 3: [], 4: [], 5: [],
  }
  for (const r of allReviews) {
    const star = Math.min(5, Math.max(1, r.rating))
    byRating[star].push(r)
  }

  for (const star of [1, 2, 3, 4, 5]) {
    byRating[star].sort((a, b) => b.text.length - a.text.length)
  }

  let targets: Record<number, number>
  if (totalCount <= 50) {
    targets = { 1: 999, 2: 999, 3: 999, 4: 999, 5: 999 }
  } else if (totalCount <= 200) {
    targets = { 1: 40, 2: 30, 3: 15, 4: 25, 5: 50 }
  } else if (totalCount <= 500) {
    targets = { 1: 60, 2: 40, 3: 20, 4: 30, 5: 60 }
  } else if (totalCount <= 1000) {
    targets = { 1: 80, 2: 50, 3: 20, 4: 30, 5: 80 }
  } else {
    targets = { 1: 100, 2: 60, 3: 20, 4: 30, 5: 90 }
  }

  const sampled: typeof allReviews = []
  for (const star of [1, 2, 3, 4, 5]) {
    const take = Math.min(targets[star], byRating[star].length)
    sampled.push(...byRating[star].slice(0, take))
  }

  console.log(
    `[Sampling] totalCount=${totalCount} | ` +
    `1★:${byRating[1].length}→${Math.min(targets[1], byRating[1].length)} | ` +
    `2★:${byRating[2].length}→${Math.min(targets[2], byRating[2].length)} | ` +
    `3★:${byRating[3].length}→${Math.min(targets[3], byRating[3].length)} | ` +
    `4★:${byRating[4].length}→${Math.min(targets[4], byRating[4].length)} | ` +
    `5★:${byRating[5].length}→${Math.min(targets[5], byRating[5].length)} | ` +
    `total sampled=${sampled.length}`,
  )

  return sampled
}

// ── Etsy internal review API (now proxied) ────────────────────
// Etsy's own frontend loads reviews via their internal REST API.
// Previously this was a naked Vercel IP fetch — Etsy 404'd it immediately.
// Now routed through your residential proxy so Etsy sees a real home IP.

async function fetchReviewsFromInternalApi(
  listingId: string,
  sessionId?: string,
): Promise<Array<{ rating: number; text: string; date: string }> | null> {
  const allReviews: Array<{ rating: number; text: string; date: string }> = []
  const LIMIT = 100
  let page    = 1
  let total   = Infinity

  const headers = {
    'Accept':           'application/json, text/javascript, */*; q=0.01',
    'Accept-Language':  'en-US,en;q=0.9',
    'Referer':          `https://www.etsy.com/listing/${listingId}`,
    'User-Agent':       BROWSER_HEADERS['User-Agent'],
    'X-Requested-With': 'XMLHttpRequest',
  }

  while (allReviews.length < total && allReviews.length < 400) {
    const url = `https://www.etsy.com/api/v3/ajax/bespoke/member/listings/${listingId}/reviews?language=en&limit=${LIMIT}&page=${page}&rating=`
    try {
      // Previously: naked fetch() → Vercel datacenter IP → Etsy 404s
      // Now: proxied through residential IP → Etsy sees a real user
      const res = await proxyFetchWithGeoFallback(
        url,
        { headers, signal: AbortSignal.timeout(25_000) },
        sessionId,
      )
      if (!res.ok) {
        console.log(`[InternalAPI] HTTP ${res.status} — not available, falling back`)
        return null
      }
      const json = await res.json()
      const results: any[] = json?.reviews ?? json?.results ?? []
      if (results.length === 0) break
      total = json?.count ?? json?.total_results ?? total

      for (const r of results) {
        const text = (r.review || r.text || '').replace(/<[^>]*>/g, '').trim()
        if (text.length > 5) {
          allReviews.push({
            rating: r.rating ?? 5,
            text,
            date: r.create_timestamp
              ? new Date(r.create_timestamp * 1000).toISOString().slice(0, 10)
              : r.created_timestamp || '',
          })
        }
      }

      console.log(`[InternalAPI] page=${page} fetched=${results.length} total=${allReviews.length}/${total}`)
      page++
      if (results.length < LIMIT) break
      await new Promise(r => setTimeout(r, 400))
    } catch (err) {
      console.log(`[InternalAPI] Failed: ${err} — falling back`)
      return null
    }
  }

  if (allReviews.length === 0) return null
  console.log(`[InternalAPI] Done — ${allReviews.length} reviews`)
  return allReviews
}

function extractDeepDiveParams(html: string, listingId: string) {
  const shopId =
    html.match(/"shopId"\s*:\s*"?(\d+)"?/i)?.[1] ||
    html.match(/"shop_id"\s*:\s*"?(\d+)"?/i)?.[1] ||
    html.match(/shop_id[\\"]*\s*[:=]\s*[\\"]?(\d+)/i)?.[1] ||
    null

  const csrf =
    html.match(/<meta[^>]+name="csrf_nonce"[^>]+content="([^"]+)"/i)?.[1] ||
    html.match(/<meta[^>]+content="([^"]+)"[^>]+name="csrf_nonce"/i)?.[1] ||
    html.match(/"csrf_nonce"\s*:\s*"([^"]+)"/i)?.[1] ||
    html.match(/"csrf_token"\s*:\s*"([^"]+)"/i)?.[1] ||
    null

  if (!shopId) console.log(`[DeepDiveAPI] Missing shop_id in first-page HTML for listing ${listingId}`)
  if (!csrf)   console.log(`[DeepDiveAPI] Missing csrf_nonce in first-page HTML for listing ${listingId}`)

  return { shopId, csrf }
}

async function fetchReviewsFromDeepDiveApi(
  listingId: string,
  productUrl: string,
  firstPageHtml: string,
  sessionId?: string,
): Promise<Array<{ rating: number; text: string; date: string }> | null> {
  if (!firstPageHtml) {
    console.log('[DeepDiveAPI] No first-page HTML available — skipping')
    return null
  }

  const { shopId, csrf } = extractDeepDiveParams(firstPageHtml, listingId)
  if (!shopId) return null

  const allReviews: Array<{ rating: number; text: string; date: string }> = []
  const seenTexts = new Set<string>()
  const endpoint  = 'https://www.etsy.com/api/v3/ajax/bespoke/member/neu/specs/deep_dive_reviews'
  const specPath  = 'Etsy\\Modules\\ListingPage\\Reviews\\DeepDive\\AsyncApiSpec'

  for (let page = 1; page <= 40 && allReviews.length < 400; page++) {
    const specParams = {
      listing_id:               parseInt(listingId),
      shop_id:                  parseInt(shopId),
      scope:                    'listingReviews',
      page,
      sort_option:              'Relevancy',
      tag_filters:              [],
      should_lazy_load_images:  false,
      should_show_variations:   false,
    }
    const payloads = [
      {
        log_performance_metrics: true,
        specs: { deep_dive_reviews: [specPath, specParams] },
        runtime_analysis: false,
      },
      {
        log_performance_metrics: true,
        specs: {
          deep_dive_reviews: {
            module_path: 'neu/specs/deep_dive_reviews',
            ...specParams,
          },
        },
        runtime_analysis: false,
      },
    ]

    try {
      const reqHeaders: Record<string, string> = {
        'Accept':           'application/json, text/plain, */*',
        'Accept-Language':  'en-US,en;q=0.9',
        'Content-Type':     'application/json',
        'Referer':          productUrl,
        'User-Agent':       BROWSER_HEADERS['User-Agent'],
        'X-Requested-With': 'XMLHttpRequest',
      }
      if (csrf) reqHeaders['X-Csrf-Token'] = csrf

      let reviewHtml = ''
      let lastStatus = 0

      for (let variant = 0; variant < payloads.length; variant++) {
        const payload = JSON.stringify(payloads[variant])

        try {
          // Route DeepDive API calls through residential proxy too
          const res = await proxyFetchWithGeoFallback(
            endpoint,
            {
              method:  'POST',
              headers: reqHeaders,
              body:    payload,
              signal:  AbortSignal.timeout(25_000),
            },
            sessionId,
          )
          lastStatus = res.status
          const text = await res.text()

          if (!res.ok) {
            console.log(`[DeepDiveAPI] page=${page} variant ${variant + 1} HTTP ${res.status}: ${text.slice(0, 160)}`)
            continue
          }

          const json = JSON.parse(text)
          const candidate = json?.output?.deep_dive_reviews
          if (typeof candidate === 'string' && candidate.length > 0) {
            reviewHtml = candidate
            if (variant > 0) console.log(`[DeepDiveAPI] page=${page} used payload variant ${variant + 1}`)
            break
          }
          console.log(`[DeepDiveAPI] page=${page} variant ${variant + 1} returned no review HTML`)
        } catch (err) {
          console.log(`[DeepDiveAPI] page=${page} variant ${variant + 1} failed: ${err}`)
        }
      }

      if (!reviewHtml) {
        console.log(`[DeepDiveAPI] Page ${page}: no review HTML, lastStatus=${lastStatus}, stopping`)
        break
      }

      const reviews = parseReviewsFromDeepDiveHtml(reviewHtml)
      let added = 0
      let duplicates = 0
      for (const review of reviews) {
        if (review.text && !seenTexts.has(review.text)) {
          seenTexts.add(review.text)
          allReviews.push(review)
          added++
        } else if (review.text) {
          duplicates++
        }
      }

      console.log(
        `[DeepDiveAPI] page=${page} html=${reviewHtml.length} ` +
        `parsed=${reviews.length} added=${added} dupes=${duplicates} total=${allReviews.length}`,
      )
      if (added === 0) break
      await new Promise(r => setTimeout(r, 400))
    } catch (err) {
      console.log(`[DeepDiveAPI] Failed on page ${page}: ${err}`)
      return allReviews.length > 0 ? allReviews : null
    }
  }

  if (allReviews.length === 0) return null
  console.log(`[DeepDiveAPI] Done — ${allReviews.length} reviews`)
  return allReviews
}

// ── Playwright microservice scraper ──────────────────────────
// Calls the self-hosted scraper service (scraper/ directory).
// Set SCRAPER_URL + SCRAPER_SECRET env vars to enable this path.
// This is the most reliable scraper — real browser + XHR interception.

async function fetchReviewsViaPlaywright(
  productUrl: string,
): Promise<Array<{ rating: number; text: string; date: string }> | null> {
  const scraperUrl = process.env.SCRAPER_URL
  const secret     = process.env.SCRAPER_SECRET
  if (!scraperUrl || !secret) return null

  console.log(`[Playwright] Calling scraper service for ${productUrl}`)

  try {
    const res = await fetch(`${scraperUrl}/scrape`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: productUrl, secret, max_pages: 30 }),
      signal: AbortSignal.timeout(120_000),
    })

    if (!res.ok) {
      const err = await res.text()
      console.error(`[Playwright] Service error ${res.status}: ${err.slice(0, 200)}`)
      return null
    }

    const data = await res.json()
    const raw: any[] = data.reviews ?? []
    if (raw.length === 0) {
      console.log('[Playwright] Service returned 0 reviews')
      return null
    }

    const reviews = raw.map((r: any) => ({
      rating: Math.min(5, Math.max(1, Math.round(r.rating ?? 5))),
      text:   String(r.review ?? r.text ?? '').replace(/<[^>]*>/g, '').trim(),
      date:   r.date ?? '',
    })).filter(r => r.text.length > 5)

    console.log(`[Playwright] Got ${reviews.length} reviews from service`)
    return reviews
  } catch (err) {
    console.error('[Playwright] Service call failed:', err)
    return null
  }
}

// ── Multi-page scraper ────────────────────────────────────────
// All Etsy HTML fetches now go through the residential proxy.
// fetchReviewsFromInternalApi is tried first (cheapest, returns clean JSON).
// Falls back to DeepDive API, then to paginated HTML scraping.

async function scrapeAllReviews(
  productUrl: string,
): Promise<{ reviews: Array<{ rating: number; text: string; date: string }>; rawHtml: string }> {

  // ── Playwright microservice (if SCRAPER_URL is set) ─────
  const playwrightReviews = await fetchReviewsViaPlaywright(productUrl)
  if (playwrightReviews && playwrightReviews.length >= 5) {
    const firstPage = await scrapeFirstPage(productUrl).catch(() => ({ rawHtml: '' }))
    console.log(`[Scraper] Playwright path — ${playwrightReviews.length} reviews`)
    return { reviews: playwrightReviews, rawHtml: (firstPage as any).rawHtml }
  }

  // ── Official Etsy API (if key is present) ────────────────
  if (process.env.ETSY_API_KEY) {
    const listingId = extractListingId(productUrl)
    if (listingId) {
      try {
        const [apiReviews, firstPage] = await Promise.all([
          fetchReviewsViaEtsyApi(listingId),
          scrapeFirstPage(productUrl).catch(() => ({ renderedHtml: '', rawHtml: '' })),
        ])
        console.log(`[Scraper] Official API path — ${apiReviews.length} reviews`)
        return { reviews: apiReviews, rawHtml: firstPage.rawHtml }
      } catch (err) {
        console.warn('[Scraper] Official API failed, falling back:', err)
      }
    }
  }

  // ── Shared session ID — all requests for this listing use the same proxy IP ──
  const listingId       = extractListingId(productUrl)
  const decodoSessionId = listingId ? `etsy-${listingId}-${Date.now()}` : undefined

  // ── Fetch first page + try internal API in parallel ──────
  // The internal API now goes through residential proxy — Etsy won't 404 it.
  const [firstPageResult, internalReviews] = await Promise.allSettled([
    scrapeFirstPage(productUrl, decodoSessionId),
    listingId ? fetchReviewsFromInternalApi(listingId, decodoSessionId) : Promise.resolve(null),
  ])

  const firstPage = firstPageResult.status === 'fulfilled'
    ? firstPageResult.value
    : { renderedHtml: '', rawHtml: '' }

  const internalResult = internalReviews.status === 'fulfilled' ? internalReviews.value : null

  if (internalResult && internalResult.length >= 5) {
    console.log(`[Scraper] Internal API path — ${internalResult.length} reviews`)
    return { reviews: internalResult, rawHtml: firstPage.rawHtml }
  }
  console.log(`[Scraper] Internal API returned ${internalResult?.length ?? 0} reviews — trying DeepDive API`)

  const firstPageHtml  = firstPage.rawHtml || firstPage.renderedHtml
  const deepDiveReviews = listingId
    ? await fetchReviewsFromDeepDiveApi(listingId, productUrl, firstPageHtml, decodoSessionId)
    : null

  if (deepDiveReviews && deepDiveReviews.length > 0) {
    console.log(`[Scraper] DeepDive API path — ${deepDiveReviews.length} reviews`)
    return { reviews: deepDiveReviews, rawHtml: firstPage.rawHtml }
  }
  console.log(`[Scraper] DeepDive API returned ${deepDiveReviews?.length ?? 0} reviews — using HTML scraping`)

  // ── Proxied HTML scraping fallback ────────────────────────
  const allReviews: Array<{ rating: number; text: string; date: string }> = []
  const seenTexts = new Set<string>()

  function ingestHtml(html: string) {
    const data         = extractJsonLd(html)
    let reviews        = parseReviews(data)
    if (reviews.length === 0) reviews = parseReviewsFromHtml(html)
    const stateReviews = extractReviewsFromPageState(html)
    const combined     = [...reviews, ...stateReviews]
    let added = 0
    for (const r of combined) {
      if (r.text && !seenTexts.has(r.text)) {
        seenTexts.add(r.text)
        allReviews.push(r)
        added++
      }
    }
    return added
  }

  const { renderedHtml, rawHtml } = firstPage

  if (!renderedHtml && !rawHtml) {
    throw new Error('Could not fetch Etsy listing HTML. Please try again in a few minutes or upload a CSV.')
  }

  ingestHtml(renderedHtml)
  ingestHtml(rawHtml)

  const firstData    = extractJsonLd(rawHtml)
  const totalReviews = firstData?.aggregateRating?.reviewCount
    ? parseInt(firstData.aggregateRating.reviewCount)
    : 0

  console.log(`[Scraper] First page reviews: ${allReviews.length} | totalReviews: ${totalReviews}`)

  if (totalReviews > 0 && allReviews.length >= totalReviews) {
    console.log('[Scraper] All reviews captured on first page, done.')
    return { reviews: allReviews, rawHtml }
  }

  // ── Paginated HTML scraping ───────────────────────────────
  const REVIEWS_PER_PAGE      = 4
  const MAX_BUDGET            = 300
  const MAX_CONSECUTIVE_EMPTY = 2
  const MAX_PAGE_ERRORS       = 2
  const SCRAPE_DEADLINE_MS    = 210_000

  const maxPages = totalReviews > 0
    ? Math.min(75, Math.ceil(Math.min(totalReviews, MAX_BUDGET) / REVIEWS_PER_PAGE))
    : 20

  console.log(`[Scraper] Paginating up to ${maxPages} pages via ?reviews_page=N`)

  let consecutiveEmpty = 0
  let pageErrors       = 0
  const startedAt      = Date.now()

  for (let page = 2; page <= maxPages; page++) {
    if (Date.now() - startedAt > SCRAPE_DEADLINE_MS) {
      console.log(`[Scraper] Hit scrape deadline with ${allReviews.length} reviews, stopping`)
      break
    }
    if (allReviews.length >= MAX_BUDGET) {
      console.log(`[Scraper] Hit ${MAX_BUDGET} review budget, stopping`)
      break
    }

    try {
      const pageUrl = `${productUrl}?reviews_page=${page}`
      const html    = await scrapePage(pageUrl, decodoSessionId)
      const added   = ingestHtml(html)

      console.log(`[Scraper] Page ${page}: +${added} reviews (total ${allReviews.length})`)

      if (added === 0) {
        consecutiveEmpty++
        if (consecutiveEmpty >= MAX_CONSECUTIVE_EMPTY) {
          console.log(`[Scraper] ${MAX_CONSECUTIVE_EMPTY} consecutive empty pages — stopping`)
          break
        }
      } else {
        consecutiveEmpty = 0
      }

      await new Promise((r) => setTimeout(r, 800))
    } catch (err) {
      console.error(`[Scraper] Page ${page} error:`, err)
      pageErrors++
      if (pageErrors >= MAX_PAGE_ERRORS) {
        console.log(`[Scraper] ${MAX_PAGE_ERRORS} page errors — stopping`)
        break
      }
      consecutiveEmpty++
      if (consecutiveEmpty >= MAX_CONSECUTIVE_EMPTY) break
    }
  }

  console.log(`[Scraper] Done. Total unique reviews: ${allReviews.length}`)
  return { reviews: allReviews, rawHtml }
}

// ── Retry wrapper ─────────────────────────────────────────────

async function withRetry<T>(fn: () => Promise<T>, retries = 2): Promise<T> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn()
    } catch (err) {
      if (attempt === retries) throw err
      const delay = 1500 * (attempt + 1)
      console.log(`[Retry] Attempt ${attempt + 1} failed, retrying in ${delay}ms`)
      await new Promise((r) => setTimeout(r, delay))
    }
  }
  throw new Error('Max retries exceeded')
}

// ── JSON extractor ────────────────────────────────────────────

function extractJson(content: string): unknown {
  const stripped = content
    .replace(/<think>[\s\S]*?<\/think>/gi, '')
    .replace(/```json\s*/gi, '')
    .replace(/```\s*/g, '')
    .trim()

  const candidates: { json: unknown; length: number }[] = []
  let depth = 0, start = -1, inStr = false, escape = false

  for (let i = 0; i < stripped.length; i++) {
    const ch = stripped[i]
    if (escape)               { escape = false; continue }
    if (ch === '\\' && inStr) { escape = true;  continue }
    if (ch === '"')           { inStr = !inStr;  continue }
    if (inStr) continue
    if (ch === '{') { if (depth === 0) start = i; depth++ }
    else if (ch === '}') {
      depth--
      if (depth === 0 && start !== -1) {
        const candidate = stripped.substring(start, i + 1)
        try {
          candidates.push({ json: JSON.parse(candidate), length: candidate.length })
        } catch {}
        start = -1
      }
    }
  }

  if (candidates.length === 0)
    throw new Error('No valid JSON object found in model response')
  candidates.sort((a, b) => b.length - a.length)
  return candidates[0].json
}

// ── Groq callers — one per model tier ────────────────────────

async function callGroq70b(
  messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>,
  maxTokens: number,
): Promise<string> {
  const response = await groq.chat.completions.create({
    model:       MODEL_70B,
    max_tokens:  maxTokens,
    temperature: 0.1,
    messages,
  })
  const usage = response.usage
  if (usage) {
    console.log(`[Groq-70b] prompt: ${usage.prompt_tokens}, completion: ${usage.completion_tokens}, total: ${usage.total_tokens}`)
  }
  return response.choices[0].message.content || ''
}

async function callGroq8b(
  messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>,
  maxTokens: number,
): Promise<string> {
  const response = await groq.chat.completions.create({
    model:       MODEL_8B,
    max_tokens:  maxTokens,
    temperature: 0.1,
    messages,
  })
  const usage = response.usage
  if (usage) {
    console.log(`[Groq-8b] prompt: ${usage.prompt_tokens}, completion: ${usage.completion_tokens}, total: ${usage.total_tokens}`)
  }
  return response.choices[0].message.content || ''
}

// ── Complaint count guidance ──────────────────────────────────

function getComplaintCountGuidance(reviewCount: number, negCount: number, sampled?: number): string {
  const sampledNote = sampled ? ` (${sampled} sampled)` : ''
  const negNote     = negCount > 0 ? ` with ${negCount} negative reviews (1★–2★)` : ''
  const minFromNeg  = Math.max(2, Math.floor(negCount / 8))

  if (reviewCount >= 500) {
    const min = Math.max(6, minFromNeg)
    return `REVIEW COUNT: ${reviewCount}${sampledNote}${negNote}.
MANDATORY COMPLAINT COUNT: ${min}–9 distinct complaints. You MUST reach ${min} before stopping.
SEPARATION RULE: "handle cracks" and "handle wobbles" are TWO complaints, not one. Each physical symptom reviewers describe separately = its own entry.
Do NOT write "durability issues" — write the exact symptom reviewers described.`
  }
  if (reviewCount >= 200) {
    const min = Math.max(5, minFromNeg)
    return `REVIEW COUNT: ${reviewCount}${sampledNote}${negNote}.
MANDATORY COMPLAINT COUNT: ${min}–7 distinct complaints. Do NOT stop before ${min}.
SEPARATION RULE: Do not merge problems that affect different parts of the product or happen at different times. Each = its own entry.
Do NOT write "quality issues" or "durability problems" — name the specific symptom.`
  }
  if (reviewCount >= 100) {
    const min = Math.max(4, minFromNeg)
    return `REVIEW COUNT: ${reviewCount}${sampledNote}${negNote}.
MANDATORY COMPLAINT COUNT: ${min}–6 distinct complaints.
SEPARATION RULE: If reviewers complain about two different things (e.g. blade and handle), those are TWO complaints.
Write the exact words reviewers used to describe each problem — do not abstract or generalize.`
  }
  if (reviewCount >= 50) {
    const min = Math.max(3, minFromNeg)
    return `REVIEW COUNT: ${reviewCount}${sampledNote}${negNote}.
MANDATORY COMPLAINT COUNT: ${min}–5 distinct complaints.
Read every 1★ and 2★ review. Count how many distinct physical symptoms or failure modes appear. Each one = its own complaint entry.
If reviewers mention rust AND cracking AND wrong color, those are THREE complaints.`
  }
  const min = Math.max(2, minFromNeg)
  return `REVIEW COUNT: ${reviewCount}${sampledNote}${negNote}.
MANDATORY COMPLAINT COUNT: at least ${min} complaints.
Read every negative review individually. List every distinct problem mentioned — do not merge separate issues into one.
Even if all relate to the handle, "cracks at the pin" and "loose after a month" are DIFFERENT complaints.`
}

// ── Main analysis ─────────────────────────────────────────────

async function analyzeWithGroq(
  product:             any,
  reviews:             Array<{ rating: number; text: string }>,
  ctx:                 ReturnType<typeof calculateHealthScore>,
  listingDescription?: string,
): Promise<any> {
  const patterns       = extractPatterns(reviews)
  const sampledReviews = buildSmartSample(reviews, patterns, 200)

  const sanitizeReview = (t: string) =>
    t.replace(/ignore\s+(previous|all|above|prior)\s+(instructions?|prompts?|context)/gi, '[…]')
     .replace(/you\s+are\s+(now|a|an)\s+/gi, '[…]')
     .replace(/system\s*:/gi, '[…]')
     .replace(/assistant\s*:/gi, '[…]')

  const reviewText = sampledReviews
    .map(r =>
      `[${r.rating}★] ${sanitizeReview(r.text).slice(0, 300).trimEnd()}` +
      (r.text.length > 300 ? '…' : ''),
    )
    .join('\n')

  const negativeReviews = sampledReviews.filter(r => r.rating <= 2).slice(0, 25)
  const positiveReviews = sampledReviews.filter(r => r.rating >= 4).slice(0, 30)
  const fiveStarReviews = sampledReviews.filter(r => r.rating === 5).slice(0, 10)

  const negReviewText = (negativeReviews.length > 0 ? negativeReviews : sampledReviews.slice(0, 20))
    .map(r =>
      `[${r.rating}★] ${sanitizeReview(r.text).slice(0, 200).trimEnd()}` +
      (r.text.length > 200 ? '…' : ''),
    ).join('\n')

  const posReviewText = (positiveReviews.length > 0 ? positiveReviews : sampledReviews.slice(0, 25))
    .map(r =>
      `[${r.rating}★] ${sanitizeReview(r.text).slice(0, 200).trimEnd()}` +
      (r.text.length > 200 ? '…' : ''),
    ).join('\n')

  const fiveStarText = (fiveStarReviews.length > 0 ? fiveStarReviews : positiveReviews.slice(0, 10))
    .map(r =>
      `[5★] ${sanitizeReview(r.text).slice(0, 180).trimEnd()}` +
      (r.text.length > 180 ? '…' : ''),
    ).join('\n')

  console.log(
    `[Parallel] Review splits — neg: ${negativeReviews.length}, ` +
    `pos: ${positiveReviews.length}, 5★: ${fiveStarReviews.length}`,
  )

  const healthBlock    = formatHealthScoreForPrompt(ctx)
  const negativeCount  = sampledReviews.filter(r => r.rating <= 2).length
  const complaintGuide = getComplaintCountGuidance(reviews.length, negativeCount, sampledReviews.length)

  const worstReviews = extractWorstReviews(reviews)
  const bestReviews  = extractBestReviews(reviews, 15)
  const domainResult = await generateDomainAndSeo(
    product.title, 'Etsy Product',
    worstReviews, bestReviews, listingDescription,
  )
  const domainKnowledge = domainResult.knowledge
  const seoAnalysis     = calculateSeoScore(reviews, product.title)
  const seoTopPhrases   = domainResult.seoThemes.length >= 3
    ? domainResult.seoThemes
    : seoAnalysis.topPhrases

  console.log(
    `[SEO] Score: ${seoAnalysis.score}/100 | ` +
    `Themes: ${seoTopPhrases.slice(0, 3).join(' | ')}`,
  )

  const negCount = ctx.starCounts[1] + ctx.starCounts[2]
  const negPct   = ctx.totalReviewCount > 0
    ? Math.round((negCount / ctx.totalReviewCount) * 100)
    : 0

  const descriptionLine = listingDescription
    ? `\nSELLER'S LISTING DESCRIPTION:\n${listingDescription.slice(0, 400).trimEnd()}\n`
    : ''

  const contextBlock = `PRODUCT: ${product.title}
PRICE: $${product.price}
RATING: ${product.rating}/5
REVIEWS ANALYZED: ${reviews.length}${descriptionLine}

${healthBlock}

${patterns.promptSummary}

${domainKnowledge}

Classify each issue as SHIPPING / PRODUCTION / LISTING / DESIGN before writing fixes.`

  const systemPrompt = `You are a review analysis engine. Convert reviewer language into structured JSON. Every word you write must trace back to something a reviewer actually said or described.

━━━ GROUNDING LAW ━━━
- Quote or closely paraphrase what reviewers wrote. Do not abstract it.
- "Handle scales cracked along the wood grain near the pins after 3 weeks" → keep that specificity. Do not turn it into "durability issue".
- Never infer technical causes (materials, manufacturing, engineering) unless a reviewer explicitly named them.
- Minimum 3 reviews must support any claim. If only 1-2 mention something, skip it.

━━━ ABSOLUTELY BANNED PHRASES ━━━
These phrases are forbidden in every field. If you write any of them, the output fails:
  × "improve durability"          × "enhance quality"           × "update listing"
  × "better materials"            × "stronger construction"     × "improve craftsmanship"
  × "reduce returns"              × "improve customer satisfaction"
  × "customers will appreciate"   × "buyers expect"             × "enhance the experience"
  × "consider [anything]"         × "could involve"             × "may improve"
  × "this will help"              × "address this issue"        × "tackle this problem"
  × Any sentence starting with "To address this"
  × Any invented percentage improvement

━━━ TITLE RULE ━━━
Complaint titles must name the EXACT SYMPTOM reviewers described.
  ✓ GOOD: "Handle scales crack at pin after 3 weeks"
  ✓ GOOD: "Blade rusts near base within 2 weeks"
  ✗ BAD:  "Handle durability issues"
  ✗ BAD:  "Rust resistance problems"

━━━ FIX STRUCTURE — STRICT FORMAT ━━━
Each fix = one sentence following this exact pattern:
  "Reviewers say [exact symptom + location + timing from reviews] — [what this pattern reveals about where or how the failure starts] — [one specific action that follows directly from that pattern]"

GOOD EXAMPLE:
  "Reviewers say the crack starts specifically at the pin holes rather than along the full grain — cracks initiating at the pin holes rather than elsewhere means the stress is concentrated at the fastening points rather than in the wood itself — switch the pin configuration on this handle to brass compression rivets which distribute load across a wider surface area rather than creating a stress point"

BAD EXAMPLE (rejected):
  "Reviewers say handle cracked — this indicates a durability issue — improve the handle construction with better materials"
  Why rejected: "durability issue" is an abstraction. "Better materials" is banned. No specific location. No specific action.

━━━ DISTINCT ANGLE RULE — NON-NEGOTIABLE ━━━
Each fix within a complaint MUST target a completely different layer:
  Fix 1 → WHERE and HOW the physical failure occurs (the symptom and its location)
  Fix 2 → WHEN it fails — the trigger, usage pattern, or condition that causes it
  Fix 3 → WHAT buyers were told vs what they got (listing/expectation gap)
If fixes 1 and 2 both say "make it stronger" in different words, that is ONE fix repeated — rejected.

━━━ FIX COUNT — NON-NEGOTIABLE ━━━
  CRITICAL → exactly 3 fixes using the 3 distinct angles above
  MEDIUM   → exactly 2 fixes (angle 1 + angle 3)
  LOW      → exactly 1 fix (angle 1 only)

━━━ COMPLAINT SEPARATION RULE ━━━
Do NOT merge separate problems into one complaint:
  × "Handle and blade issues" → wrong, those are two complaints
  × "Durability problems" when reviewers mention cracking AND rusting → two complaints
  ✓ Each physical location or symptom that reviewers describe separately = its own complaint entry

━━━ why FIELD FORMAT ━━━
Write only: "[X] of [Y] reviewers described this."
Nothing else. No business impact sentence. No invented consequence.

━━━ MARKETING COPY ━━━
Copy exact verbatim sentences from 5★ reviews. Do not paraphrase. Do not summarize.

━━━ SEO ━━━
Keywords: copy the pre-calculated phrases verbatim — do not replace them.
Suggestions: use only phrases from 5★ reviews, never from complaint areas.`

  console.log(`[Section:complaints] Starting for ${reviews.length} reviews...`)

  // ── Call 1: COMPLAINTS — llama-3.3-70b-versatile ─────────
  const complaintsRaw = await callGroq70b([
    { role: 'system' as const, content: systemPrompt },
    {
      role: 'user' as const,
      content: `${contextBlock}

${complaintGuide}

NEGATIVE REVIEWS (1★ and 2★ only):
${negReviewText}

STEP 1 — READ ALL NEGATIVE REVIEWS BELOW AND LIST EVERY DISTINCT SYMPTOM:
Go through each review. For each 1★ or 2★ review, note: what broke/failed, where on the product, and when. Separate symptoms = separate complaints.

STEP 2 — GROUP INTO COMPLAINTS:
Each distinct physical symptom or failure = one complaint. Do not merge.
"Cracked at pin" ≠ "cracked along grain" — if reviewers describe both, report both.

STEP 3 — FOR EACH COMPLAINT, WRITE 3 FIXES ON 3 DIFFERENT LAYERS:
  Fix 1: WHERE and HOW — the exact physical location and symptom reviewers described
  Fix 2: WHEN and WHAT TRIGGERS IT — usage pattern, timing, or condition reviewers mentioned
  Fix 3: EXPECTATION GAP — what the listing implied vs what reviewers actually received

Each fix must start: "Reviewers say [exact reviewer words] —"

BANNED IN EVERY FIELD: "improve durability", "enhance quality", "better materials", "update listing", "address this", "reduce returns", "customers will appreciate", any sentence starting with "To address this", any invented percentage.

Return ONLY this JSON — start with { immediately:
{
  "complaints": [
    {
      "title": "<exact symptom + location in 5-7 words — e.g. 'Handle scales crack at pin holes'>",
      "severity": "CRITICAL|MEDIUM|LOW",
      "confidence": "High|Medium|Low",
      "fixPriority": "High|Medium|Low",
      "shortDescription": "<1-2 sentences using reviewer words: what specifically fails, on what part, for which buyers — zero fixes>",
      "description": "<3 sentences: quote the exact reviewer descriptions, note which buyer type mentions it, note the business pattern (returns, 1-star velocity)>",
      "revenueImpact": "<X of Y reviews describe this>",
      "riskIfIgnored": "<specific consequence reviewers described or directly implied — no invented outcomes>",
      "urgency": "<what already happened in reviews — not predictions>",
      "frequency": "<X of Y reviews>",
      "quote": "<copy-paste verbatim from a review in the list below>",
      "fixes": [
        {
          "advancedFix": "Reviewers say [exact symptom + location + timing from reviews] — [what this pattern reveals about where/how the failure starts] — [one specific action grounded in that pattern]",
          "simpleFix": "<same action in plain one sentence — no new claims>",
          "why": "<X> of <Y> reviewers described this."
        },
        {
          "advancedFix": "Reviewers say [different angle: when it happens or what triggers it] — [what this timing/trigger pattern reveals] — [action targeting that trigger specifically]",
          "simpleFix": "<same action in plain one sentence>",
          "why": "<X> of <Y> reviewers described this."
        },
        {
          "advancedFix": "Reviewers say [what they expected vs what they got, in their words] — [the gap between listing language and actual product behavior] — [specific listing or description change to close that gap]",
          "simpleFix": "<same action in plain one sentence>",
          "why": "<X> of <Y> reviewers described this."
        }
      ]
    }
  ]
}`,
    },
  ], 5500)

  let complaintsData: any = { complaints: [] }
  try {
    const rawParsed = extractJson(complaintsRaw) as any
    if (Array.isArray(rawParsed?.complaints)) {
      complaintsData = rawParsed
    } else if (Array.isArray(rawParsed)) {
      complaintsData = { complaints: rawParsed }
    } else {
      const firstArray = Object.values(rawParsed || {}).find(v => Array.isArray(v))
      if (firstArray) complaintsData = { complaints: firstArray }
    }
    console.log(`[Section:complaints] Parsed — ${complaintsData.complaints?.length || 0} found`)
  } catch (e) {
    console.error('[Section:complaints] Parse FAILED:', String(e).slice(0, 200))
  }

  if (!complaintsData.complaints || complaintsData.complaints.length === 0) {
    console.warn('[Section:complaints] 0 complaints — retrying on 70b...')
    try {
      const retryRaw = await callGroq70b([
        { role: 'system' as const, content: systemPrompt },
        {
          role: 'user' as const,
          content: `${contextBlock}

Read these reviews and find every distinct physical problem mentioned. Each different symptom = a separate complaint.

REVIEWS:
${reviewText.slice(0, 3000)}

RULES:
- Title = exact symptom + location (e.g. "Handle cracks at pin holes after 3 weeks")
- Each fix starts: "Reviewers say [exact words] — [what pattern this reveals] — [specific action]"
- Fix 1 = physical symptom location. Fix 2 = trigger/timing. Fix 3 = expectation gap.
- BANNED: "improve durability", "enhance quality", "better materials", "address this issue", any invented percentage.
- why field: "[X] of [Y] reviewers described this." only.

Return ONLY: { "complaints": [ { "title": "...", "severity": "CRITICAL|MEDIUM|LOW", "confidence": "High", "fixPriority": "High", "shortDescription": "...", "description": "...", "revenueImpact": "X of Y reviews", "riskIfIgnored": "...", "urgency": "...", "frequency": "X of Y reviews", "quote": "verbatim from a review", "fixes": [ { "advancedFix": "Reviewers say [exact symptom+location+timing] — [what pattern reveals] — [specific action]", "simpleFix": "...", "why": "X of Y reviewers described this." }, { "advancedFix": "Reviewers say [trigger/timing angle] — [pattern] — [action targeting trigger]", "simpleFix": "...", "why": "..." }, { "advancedFix": "Reviewers say [expectation vs reality] — [gap] — [listing change]", "simpleFix": "...", "why": "..." } ] } ] }`,
        },
      ], 5000)
      const retryParsed = extractJson(retryRaw) as any
      if (Array.isArray(retryParsed?.complaints) && retryParsed.complaints.length > 0) {
        complaintsData = retryParsed
        console.log(`[Section:complaints] Retry succeeded — ${complaintsData.complaints.length} found`)
      }
    } catch (retryErr) {
      console.error('[Section:complaints] Retry also failed:', retryErr)
    }
  }

  const topComplaintTitle = complaintsData.complaints?.[0]?.title || 'quality issues'

  const partialReport: any = {
    healthScore:   ctx.healthScore,
    starBreakdown: {
      '1': ctx.starCounts[1],
      '2': ctx.starCounts[2],
      '3': ctx.starCounts[3],
      '4': ctx.starCounts[4],
      '5': ctx.starCounts[5],
    },
    complaints:      Array.isArray(complaintsData.complaints) ? complaintsData.complaints : [],
    strengths:       [],
    improvements:    [],
    seo:             null,
    marketingCopy:   [],
    reviewTemplates: [],
    careGuide:       null,
    quickWin:        null,
    topActions:      [],
    freeSummary:     '',
    keyInsight:      '',
    summary:         '',
    _cache: {
      contextBlock,
      negReviewText,
      posReviewText,
      fiveStarText,
      reviewText,
      seoScore:         seoAnalysis.score,
      seoReasoning:     seoAnalysis.reasoning,
      seoTopPhrases,
      negPct,
      topComplaintTitle,
    },
    _sectionsReady: ['complaints'],
  }

  return partialReport
}

// ── Free preview — single cheap call ─────────────────────────

async function analyzeFreePreview(
  product: any,
  reviews: Array<{ rating: number; text: string }>,
  ctx: ReturnType<typeof calculateHealthScore>,
  listingDescription?: string,
): Promise<any> {
  const patterns        = extractPatterns(reviews)
  const sampledReviews  = buildSmartSample(reviews, patterns, 60)
  const negativeReviews = sampledReviews.filter(r => r.rating <= 2).slice(0, 18)
  const positiveReviews = sampledReviews.filter(r => r.rating >= 4).slice(0, 12)
  const sanitizeFree = (t: string) =>
    t.replace(/ignore\s+(previous|all|above|prior)\s+(instructions?|prompts?|context)/gi, '[…]')
     .replace(/system\s*:/gi, '[…]').replace(/assistant\s*:/gi, '[…]')
  const reviewText = [...negativeReviews, ...positiveReviews]
    .map(r => `[${r.rating}★] ${sanitizeFree(r.text).slice(0, 180).trimEnd()}${r.text.length > 180 ? '…' : ''}`)
    .join('\n')

  const seoAnalysis = calculateSeoScore(reviews, product.title)
  const negCount    = ctx.starCounts[1] + ctx.starCounts[2]
  const negPct      = ctx.totalReviewCount > 0
    ? Math.round((negCount / ctx.totalReviewCount) * 100)
    : 0

  let complaintsData: any = { complaints: [] }
  let strengthsData: any  = { strengths: [] }

  try {
    const raw = await callGroq8b([
      {
        role: 'system' as const,
        content: `You are a compact review analysis engine. Return JSON only.
Rules:
- Return exactly 2 complaints and 1 strength.
- Do not write fixes, improvements, marketing copy, templates, SEO keywords, or business advice.
- Do not use generic business language like consider, this will help, improve quality, better materials, reduce returns, customer satisfaction, update listing.`,
      },
      {
        role: 'user' as const,
        content: `PRODUCT: ${product.title}
PRICE: $${product.price}
REVIEWS ANALYZED: ${reviews.length}
HEALTH SCORE: ${ctx.healthScore}/100

REVIEWS:
${reviewText}

Return ONLY this JSON:
{
  "complaints": [
    {
      "title": "<exact symptom in 4-8 words>",
      "severity": "CRITICAL|MEDIUM|LOW",
      "frequency": "<X of ${reviews.length} reviews>",
      "shortDescription": "<1-2 sentences using reviewer words>",
      "description": "<same as shortDescription>",
      "revenueImpact": "<X of ${reviews.length} reviews describe this>",
      "quote": "<verbatim quote from a provided review>"
    },
    {
      "title": "<exact symptom in 4-8 words>",
      "severity": "CRITICAL|MEDIUM|LOW",
      "frequency": "<X of ${reviews.length} reviews>",
      "shortDescription": "<1-2 sentences using reviewer words>",
      "description": "<same as shortDescription>",
      "revenueImpact": "<X of ${reviews.length} reviews describe this>",
      "quote": "<verbatim quote from a provided review>"
    }
  ],
  "strengths": [
    {
      "title": "<exact praised quality in 4-7 words>",
      "frequency": "<X of ${reviews.length} reviews>",
      "summary": "<1 sentence using reviewer words>",
      "quote": "<verbatim quote from a provided review>"
    }
  ]
}`,
      },
    ], 1400)

    const parsed = extractJson(raw) as any
    if (Array.isArray(parsed?.complaints)) complaintsData = { complaints: parsed.complaints.slice(0, 2) }
    if (Array.isArray(parsed?.strengths))  strengthsData  = { strengths:  parsed.strengths.slice(0, 1) }
  } catch (err) {
    console.warn('[FreePreview] parse failed, using empty preview:', err)
  }

  return {
    healthScore: ctx.healthScore,
    starBreakdown: {
      '1': ctx.starCounts[1],
      '2': ctx.starCounts[2],
      '3': ctx.starCounts[3],
      '4': ctx.starCounts[4],
      '5': ctx.starCounts[5],
    },
    complaints:      Array.isArray(complaintsData.complaints) ? complaintsData.complaints : [],
    strengths:       Array.isArray(strengthsData.strengths)   ? strengthsData.strengths   : [],
    improvements:    [],
    seo:             { score: seoAnalysis.score },
    marketingCopy:   [],
    reviewTemplates: [],
    careGuide:       null,
    quickWin:        null,
    topActions:      [],
    freeSummary:     `Health score ${ctx.healthScore}/100 is based on ${reviews.length} reviews, with ${negPct}% unhappy buyers. Free preview shows the top problems and one strength; fixes and full SEO unlock on paid plans.`,
    keyInsight:      'This is a preview of the biggest patterns in the reviews, not the full action plan.',
    summary:         `Health score ${ctx.healthScore}/100 reflects the main review patterns. The free preview shows the top complaints, one strength, and an SEO score.`,
    _sectionsReady:  ['complaints', 'strengths', 'seo', 'summary'],
    _cache: {
      reviewText,
      seoScore: seoAnalysis.score,
      negPct,
      listingDescription,
    },
    _isLimited: true,
  }
}

// ── Plan limits ───────────────────────────────────────────────

export function applyPlanLimits(
  report: any,
  plan: string,
  isAdminUser: boolean,
) {
  if (isAdminUser || plan === 'pro')
    return { ...report, _isLimited: false }

  if (plan === 'starter') {
    return {
      ...report,
      complaints:   report.complaints   || [],
      strengths:    report.strengths    || [],
      improvements: report.improvements || [],
      _isLimited:   false,
    }
  }

  return {
    ...report,
    complaints:      (report.complaints || []).slice(0, 2),
    strengths:       (report.strengths  || []).slice(0, 1),
    improvements:    [],
    marketingCopy:   [],
    reviewTemplates: [],
    seo:             null,
    topActions:      report.topActions || [],
    _isLimited:      true,
  }
}

// ── Main handler ──────────────────────────────────────────────

export async function POST(request: NextRequest) {
  const csrfError = checkCsrf(request)
  if (csrfError) return csrfError

  const ip =
    request.headers.get('x-real-ip') ||
    request.headers.get('x-forwarded-for')?.split(',').at(-1)?.trim() ||
    'unknown'

  const timeoutSignal = AbortSignal.timeout(270_000)

  let creditsDeducted    = false
  let creditRefundUserId = ''
  let creditRefundAmount = 0

  const refundCredits = async () => {
    if (!creditsDeducted || !creditRefundUserId) return
    try {
      const supabase = await createClient()
      await supabase.rpc('add_credits', { p_user_id: creditRefundUserId, p_amount: creditRefundAmount })
      console.log(`[Analyze] Refunded ${creditRefundAmount} credits to user ${creditRefundUserId}`)
    } catch (e) {
      console.error('[Analyze] Credit refund failed — manual review needed for user', creditRefundUserId)
    }
  }

  try {
    const body               = await request.json()
    const rawUrl             = body?.productUrl
    const isReAnalyze        = body?.reAnalyze === true
    const reportType         = body?.reportType === 'competitor' ? 'competitor' : 'own'
    const productDescription = typeof body?.productDescription === 'string'
      ? body.productDescription.trim().slice(0, 500).replace(/[<>]/g, '')
      : undefined

    if (!rawUrl || typeof rawUrl !== 'string') {
      return NextResponse.json({ error: 'Product URL is required' }, { status: 400 })
    }

    const productUrl = sanitizeEtsyUrl(rawUrl)
    if (!productUrl) {
      return NextResponse.json({ error: 'Please provide a valid Etsy product URL' }, { status: 400 })
    }

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Please log in first' }, { status: 401 })
    }

    const { data: userData } = await supabase
      .from('users')
      .select('plan, is_admin, credits')
      .eq('id', user.id)
      .single()

    const isAdminUser = userData?.is_admin === true
    const plan        = userData?.plan    || 'free'
    const credits     = userData?.credits ?? 0

    if (!isAdminUser) {
      const limit = await enforceRateLimit(user.id, ip)
      if (!limit.allowed) {
        const resetIn = Math.ceil((limit.resetAt - Date.now()) / 60000)
        return NextResponse.json(
          { error: `Too many requests. Please wait ${resetIn} minute(s).` },
          { status: 429 },
        )
      }
    }

    const creditCost = reportType === 'competitor' ? 48 : 24

    if (!isAdminUser) {
      if (credits < creditCost) {
        return NextResponse.json(
          {
            error:           `Not enough credits. This analysis costs ${creditCost} credits and you have ${credits}.`,
            upgradeRequired: true,
            credits,
            creditCost,
          },
          { status: 403 },
        )
      }
      const { error: deductError } = await supabase.rpc('deduct_credits', {
        p_user_id: user.id,
        p_amount:  creditCost,
      })
      if (deductError) {
        console.error('[Analyze] Credit deduction failed:', deductError.message)
        return NextResponse.json(
          { error: 'Could not deduct credits. Please refresh and try again.', upgradeRequired: false },
          { status: 503 },
        )
      }
      creditsDeducted    = true
      creditRefundUserId = user.id
      creditRefundAmount = creditCost
    }

    if (isReAnalyze) {
      const { data: lastReport } = await supabase
        .from('reports')
        .select('last_analyzed_at')
        .eq('user_id', user.id)
        .eq('product_url', productUrl)
        .eq('status', 'completed')
        .order('created_at', { ascending: false })
        .limit(1)
        .single()

      if (lastReport?.last_analyzed_at) {
        const daysSince =
          (Date.now() - new Date(lastReport.last_analyzed_at).getTime()) / 86_400_000
        if (daysSince < 7) {
          return NextResponse.json(
            { error: `Re-analyze available in ${Math.ceil(7 - daysSince)} day(s).` },
            { status: 429 },
          )
        }
      }
    }

    const { data: reportRow, error: reportError } = await supabase
      .from('reports')
      .insert({ user_id: user.id, product_url: productUrl, status: 'pending', report_type: reportType })
      .select()
      .single()

    if (reportError) throw reportError
    const reportId = reportRow.id

    try {
      console.log(`[Pipeline] Starting: ${productUrl}`)

      const { reviews: rawReviews, rawHtml: firstRawHtml } =
        await withRetry(() => scrapeAllReviews(productUrl), 0)

      const firstData        = extractJsonLd(firstRawHtml)
      const product          = parseProduct(firstData, productUrl)
      const totalReviewCount = firstData?.aggregateRating?.reviewCount
        ? parseInt(firstData.aggregateRating.reviewCount)
        : 0

      const sampledReviews    = sampleReviews(rawReviews, totalReviewCount || rawReviews.length)
      product.reviewCount     = sampledReviews.length

      if (sampledReviews.length === 0) {
        await supabase.from('reports').update({ status: 'failed' }).eq('id', reportId)
        await refundCredits()
        return NextResponse.json({ error: 'No reviews found for this product. Your credits have been refunded.' }, { status: 400 })
      }

      const ctx = calculateHealthScore(sampledReviews, totalReviewCount || rawReviews.length)
      console.log(
        `[HealthScore] ${ctx.healthScore} | Raw: ${ctx.weightedRaw.toFixed(1)} | Penalties: ${ctx.penaltyCount}`,
      )

      const analysis = (!isAdminUser && plan === 'free')
        ? await analyzeFreePreview(product, sampledReviews, ctx, productDescription)
        : await analyzeWithGroq(product, sampledReviews, ctx, productDescription)

      await supabase
        .from('reports')
        .update({
          product_name:           product.title,
          health_score:           analysis.healthScore,
          total_reviews_analyzed: sampledReviews.length,
          top_complaint:          analysis.complaints?.[0]?.title || null,
          top_strength:           analysis.strengths?.[0]?.title  || null,
          top_improvement:        analysis.improvements?.[0]?.title || null,
          competitors:            [],
          full_report:            analysis,
          status:                 (!isAdminUser && plan === 'free') ? 'completed' : 'partial',
          last_analyzed_at:       new Date().toISOString(),
        })
        .eq('id', reportId)

      await supabase
        .from('usage_logs')
        .insert({ user_id: user.id, report_id: reportId, tokens_used: 0 })

      if (!isReAnalyze && user.email) {
        sendReportComplete({
          to:          user.email,
          productName: product.title,
          healthScore: analysis.healthScore,
          reportId,
        }).catch(e => console.error('[Analyze] Completion email failed:', e.message))
      }

      console.log(`[Pipeline] Complaints ready. Redirecting. Report: ${reportId}`)

      return NextResponse.json({
        success:        true,
        reportId,
        productName:    product.title,
        healthScore:    analysis.healthScore,
        totalReviewed:  sampledReviews.length,
        plan,
        isLimited:      plan === 'free' && !isAdminUser,
        isPartial:      !(!isAdminUser && plan === 'free'),
        lowReviewCount: sampledReviews.length < 30,
      })
    } catch (err: any) {
      console.error('[Pipeline] Error:', err.message)
      await supabase.from('reports').update({ status: 'failed' }).eq('id', reportId)
      await refundCredits()
      throw err
    }
  } catch (error: any) {
    if (error?.name === 'TimeoutError' || error?.code === 23) {
      console.error('[Analyze] Request timed out after 270s')
      await refundCredits()
      return NextResponse.json(
        { error: 'Analysis timed out — your credits have been refunded. Please try again.' },
        { status: 504 },
      )
    }
    console.error('[Analyze] Unhandled error:', error.message)
    await refundCredits()
    return NextResponse.json(
      { error: 'Analysis failed — your credits have been refunded. Please try again.' },
      { status: 500 },
    )
  }
}