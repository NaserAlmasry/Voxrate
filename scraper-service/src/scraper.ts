import { Impit } from 'impit'
import { proxyUrl, newSessionId } from './proxy.js'
import { isBlocked, hasNextPage, parseReviews } from './parser.js'
import type { ScrapeRequest, Review } from './types.js'

// Chrome 131 headers in wire order — Amazon's bot detection scores header ordering.
// Sec-Fetch-User only appears on user-initiated navigations, not sub-requests.
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

// For paginated requests (page 2+), Referer and Sec-Fetch-Site change
function paginationHeaders(baseUrl: string): Record<string, string> {
  return {
    ...BASE_HEADERS,
    'Referer':        baseUrl,
    'Sec-Fetch-Site': 'same-origin',
    'Sec-Fetch-User': '?1',
  }
}

const MAX_CAPTCHA_RETRIES = 3
const PAGE_DELAY_MS       = 1200  // stay under Amazon's rate limit signal
const MAX_PAGES           = 20    // hard ceiling to prevent runaway jobs

export async function scrape(req: ScrapeRequest): Promise<Review[]> {
  // One session ID per product = same residential IP across all pages of this job
  const sessionId = newSessionId()
  const proxy     = proxyUrl(sessionId)

  const client = new Impit({
    browser:         'chrome',
    proxyUrl:        proxy,
    followRedirects: true,
  })

  const allReviews: Review[] = []
  const seenIds = new Set<string>()

  // Build the first page URL — remove any existing pageNumber param so we control it
  const base    = new URL(req.url)
  base.searchParams.delete('pageNumber')
  const baseUrl = base.toString()

  let captchaStreak = 0

  for (let page = 1; page <= MAX_PAGES; page++) {
    if (allReviews.length >= req.maxReviews) break

    const pageUrl = `${baseUrl}&pageNumber=${page}`
    const headers = page === 1 ? BASE_HEADERS : paginationHeaders(baseUrl)

    let html = ''
    let finalUrl = pageUrl

    try {
      const res  = await client.fetch(pageUrl, { headers })
      html       = await res.text()
      finalUrl   = res.url ?? pageUrl
    } catch (err: any) {
      console.error(`[Scraper] Page ${page} fetch error: ${err.message}`)
      break
    }

    if (isBlocked(html, finalUrl)) {
      captchaStreak++
      console.warn(`[Scraper] CAPTCHA on page ${page} (streak ${captchaStreak}) — rotating session`)

      if (captchaStreak >= MAX_CAPTCHA_RETRIES) {
        console.error(`[Scraper] ${MAX_CAPTCHA_RETRIES} consecutive CAPTCHAs — aborting`)
        break
      }

      // New session = new residential IP from BrightData
      const newSession  = newSessionId()
      const newProxy    = proxyUrl(newSession)
      ;(client as any)._proxyUrl = newProxy

      page--   // retry the same page with the new IP
      await delay(2000 * captchaStreak)
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

    // No more pages available
    const $ = (await import('cheerio')).load(html)
    if (!hasNextPage($)) {
      console.log(`[Scraper] No next page after page ${page} — done`)
      break
    }

    if (page < MAX_PAGES && allReviews.length < req.maxReviews) {
      await delay(PAGE_DELAY_MS)
    }
  }

  return allReviews.slice(0, req.maxReviews)
}

function delay(ms: number): Promise<void> {
  return new Promise(r => setTimeout(r, ms))
}
