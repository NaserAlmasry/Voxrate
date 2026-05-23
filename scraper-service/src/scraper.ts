import { Impit } from 'impit'
import { proxyUrl, newSessionId } from './proxy.js'
import { isBlocked, hasNextPage, parseReviews } from './parser.js'
import type { ScrapeRequest, Review } from './types.js'

// Chrome 131 headers in wire order — Amazon's bot detection scores header ordering.
const BASE_HEADERS: Record<string, string> = {
  'Accept':                    'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
  'Accept-Language':           'en-US,en;q=0.9',
  'Accept-Encoding':           'gzip, deflate, br, zstd',
  'sec-ch-ua':                 '"Google Chrome";v="131", "Chromium";v="131", "Not_A Brand";v="24"',
  'sec-ch-ua-mobile':          '?0',
  'sec-ch-ua-platform':        '"Windows"',
  'Sec-Fetch-Dest':            'document',
  'Sec-Fetch-Mode':            'navigate',
  'Sec-Fetch-Site':            'none',
  'Sec-Fetch-User':            '?1',
  'Upgrade-Insecure-Requests': '1',
  'Cache-Control':             'max-age=0',
  'User-Agent':                'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
}

function paginationHeaders(baseUrl: string, cookieHeader: string): Record<string, string> {
  return {
    ...BASE_HEADERS,
    'Referer':        baseUrl,
    'Sec-Fetch-Site': 'same-origin',
    'Sec-Fetch-User': '?1',
    ...(cookieHeader ? { 'Cookie': cookieHeader } : {}),
  }
}

function warmupHeaders(tld: string): Record<string, string> {
  return {
    ...BASE_HEADERS,
    'Accept-Language': tld === 'pl' ? 'pl-PL,pl;q=0.9,en-US;q=0.8,en;q=0.7'
      : tld === 'de' ? 'de-DE,de;q=0.9,en-US;q=0.8,en;q=0.7'
      : tld === 'fr' ? 'fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7'
      : tld === 'co.uk' ? 'en-GB,en;q=0.9'
      : 'en-US,en;q=0.9',
  }
}

// Parse Set-Cookie headers into a cookie jar string
function extractCookies(res: Response): string {
  const raw = res.headers.getSetCookie?.() ?? []
  return raw.map(c => c.split(';')[0]).filter(Boolean).join('; ')
}

function mergeCookies(existing: string, fresh: string): string {
  const map = new Map<string, string>()
  for (const pair of (existing + '; ' + fresh).split(';')) {
    const [k, ...v] = pair.trim().split('=')
    if (k) map.set(k.trim(), v.join('=').trim())
  }
  return [...map.entries()].map(([k, v]) => `${k}=${v}`).join('; ')
}

const MAX_CAPTCHA_RETRIES = 3
const MAX_PAGES           = 20

// Random jitter delay — fixed intervals are a bot signal
function jitterDelay(minMs: number, maxMs: number): Promise<void> {
  const ms = minMs + Math.random() * (maxMs - minMs)
  return new Promise(r => setTimeout(r, ms))
}

export async function scrape(req: ScrapeRequest): Promise<Review[]> {
  const sessionId      = newSessionId()
  const marketplaceTld = req.marketplace.replace(/^amazon\./, '')
  const proxy          = proxyUrl(sessionId, marketplaceTld)

  const client = new Impit({
    browser:         'chrome',
    proxyUrl:        proxy,
    followRedirects: true,
  })

  let cookieJar = ''

  // Warm-up: visit homepage then product page to seed cookies and look like organic navigation
  try {
    const homepageUrl = `https://www.amazon.${marketplaceTld}/`
    console.log(`[Scraper] Warming up — visiting ${homepageUrl}`)
    const homeRes = await client.fetch(homepageUrl, { headers: warmupHeaders(marketplaceTld) })
    cookieJar = mergeCookies(cookieJar, extractCookies(homeRes))
    console.log(`[Scraper] Warmup homepage done — ${cookieJar.length} cookie chars`)

    await jitterDelay(2000, 4000)

    // Visit product page to simulate organic navigation to reviews
    const productUrl = `https://www.amazon.${marketplaceTld}/dp/${req.asin}`
    const productHeaders = {
      ...warmupHeaders(marketplaceTld),
      'Referer':        homepageUrl,
      'Sec-Fetch-Site': 'same-origin',
      ...(cookieJar ? { 'Cookie': cookieJar } : {}),
    }
    const productRes = await client.fetch(productUrl, { headers: productHeaders })
    cookieJar = mergeCookies(cookieJar, extractCookies(productRes))
    console.log(`[Scraper] Warmup product page done — ${cookieJar.length} cookie chars`)

    await jitterDelay(1500, 3000)
  } catch (err: any) {
    console.warn(`[Scraper] Warmup failed (non-fatal): ${err.message}`)
  }

  const allReviews: Review[] = []
  const seenIds = new Set<string>()

  const base    = new URL(req.url)
  base.searchParams.delete('pageNumber')
  const baseUrl = base.toString()

  let captchaStreak = 0

  for (let page = 1; page <= MAX_PAGES; page++) {
    if (allReviews.length >= req.maxReviews) break

    const pageUrl = `${baseUrl}&pageNumber=${page}`
    const headers = page === 1
      ? { ...BASE_HEADERS, ...(cookieJar ? { 'Cookie': cookieJar } : {}) }
      : paginationHeaders(baseUrl, cookieJar)

    let html = ''
    let finalUrl = pageUrl

    try {
      const res  = await client.fetch(pageUrl, { headers })
      html       = await res.text()
      finalUrl   = res.url ?? pageUrl
      // Keep accumulating cookies across pages
      const fresh = extractCookies(res)
      if (fresh) cookieJar = mergeCookies(cookieJar, fresh)
    } catch (err: any) {
      console.error(`[Scraper] Page ${page} fetch error: ${err.message}`)
      break
    }

    if (isBlocked(html, finalUrl)) {
      captchaStreak++
      console.warn(`[Scraper] CAPTCHA on page ${page} (streak ${captchaStreak}) — rotating session`)
      console.log(`[Scraper] Block details — finalUrl: ${finalUrl} | html snippet: ${html.slice(0, 500)}`)

      if (captchaStreak >= MAX_CAPTCHA_RETRIES) {
        console.error(`[Scraper] ${MAX_CAPTCHA_RETRIES} consecutive CAPTCHAs — aborting`)
        break
      }

      // New session = new residential IP, reset cookie jar and re-warm
      const newSession = newSessionId()
      const newProxy   = proxyUrl(newSession, marketplaceTld)
      ;(client as any)._proxyUrl = newProxy
      cookieJar = ''

      page--
      await jitterDelay(3000 * captchaStreak, 5000 * captchaStreak)
      continue
    }

    captchaStreak = 0
    const batch = parseReviews(html, req.asin, req.marketplace)

    for (const r of batch) {
      if (!seenIds.has(r.id)) {
        seenIds.add(r.id)
        allReviews.push(r)
      }
    }

    console.log(`[Scraper] ${req.asin} page ${page} → ${batch.length} reviews (total: ${allReviews.length}/${req.maxReviews})`)

    const $ = (await import('cheerio')).load(html)
    if (!hasNextPage($)) {
      console.log(`[Scraper] No next page after page ${page} — done`)
      break
    }

    if (page < MAX_PAGES && allReviews.length < req.maxReviews) {
      await jitterDelay(1200, 3500)
    }
  }

  return allReviews.slice(0, req.maxReviews)
}
