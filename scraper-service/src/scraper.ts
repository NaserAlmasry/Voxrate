import { isBlocked, hasNextPage, parseReviews } from './parser.js'
import type { ScrapeRequest, Review } from './types.js'

const BRIGHTDATA_API_KEY = process.env.BRIGHTDATA_API_KEY!
const BRIGHTDATA_ZONE    = process.env.BRIGHTDATA_ZONE ?? 'web_unlocker1'
const UNLOCKER_ENDPOINT  = 'https://api.brightdata.com/request'

const MAX_PAGES = 20

// Maps Amazon marketplace TLD to country code for geo targeting
const MARKETPLACE_COUNTRY: Record<string, string> = {
  'com':    'us',
  'co.uk':  'gb',
  'de':     'de',
  'fr':     'fr',
  'it':     'it',
  'es':     'es',
  'ca':     'ca',
  'com.au': 'au',
  'co.jp':  'jp',
  'in':     'in',
  'com.mx': 'mx',
  'com.br': 'br',
  'pl':     'pl',
  'nl':     'nl',
  'se':     'se',
  'sg':     'sg',
  'ae':     'ae',
  'sa':     'sa',
}

async function fetchPage(url: string, country: string): Promise<{ html: string; ok: boolean }> {
  const res = await fetch(UNLOCKER_ENDPOINT, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${BRIGHTDATA_API_KEY}`,
      'Content-Type':  'application/json',
    },
    body: JSON.stringify({
      zone:    BRIGHTDATA_ZONE,
      url,
      country,
      format:  'json',
    }),
  })

  if (!res.ok) {
    const errCode = res.headers.get('x-brd-error-code') ?? 'unknown'
    const errMsg  = res.headers.get('x-brd-error') ?? res.statusText
    console.error(`[Scraper] Unlocker error ${res.status} (${errCode}): ${errMsg}`)
    return { html: '', ok: false }
  }

  const { body: html = '' } = await res.json() as { status_code: number; body: string }
  return { html, ok: true }
}

export async function scrape(req: ScrapeRequest): Promise<Review[]> {
  const marketplaceTld = req.marketplace.replace(/^amazon\./, '')
  const country        = MARKETPLACE_COUNTRY[marketplaceTld] ?? 'us'

  const allReviews: Review[] = []
  const seenIds = new Set<string>()

  const base = new URL(req.url)
  base.searchParams.delete('pageNumber')
  // Ensure required Amazon review params are present
  if (!base.searchParams.has('reviewerType')) base.searchParams.set('reviewerType', 'all_reviews')
  if (!base.searchParams.has('ie')) base.searchParams.set('ie', 'UTF8')

  for (let page = 1; page <= MAX_PAGES; page++) {
    if (allReviews.length >= req.maxReviews) break

    base.searchParams.set('pageNumber', String(page))
    const pageUrl = base.toString()
    console.log(`[Scraper] ${req.asin} fetching page ${page} via Unlocker`)

    const { html, ok } = await fetchPage(pageUrl, country)

    if (!ok) {
      console.error(`[Scraper] Unlocker failed on page ${page} — aborting`)
      break
    }

    console.log(`[Scraper] HTML snippet (first 800 chars): ${html.slice(0, 800)}`)

    if (isBlocked(html, pageUrl)) {
      console.warn(`[Scraper] Block detected on page ${page} despite Unlocker — aborting`)
      break
    }

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
  }

  return allReviews.slice(0, req.maxReviews)
}
