import { chromium } from 'playwright-core'
import type { ScrapeRequest, Review } from './types.js'

const BROWSER_WS = process.env.BRIGHTDATA_BROWSER_WS!
const REVIEWS_PER_PAGE = 10

async function scrapePage(page: any, asin: string, tld: string, pageNum: number): Promise<Review[]> {
  const url = `https://www.amazon.${tld}/product-reviews/${asin}/?pageNumber=${pageNum}&sortBy=recent&reviewerType=all_reviews`
  console.log(`[Scraper] Navigating to page ${pageNum}: ${url}`)

  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30_000 })

  // Check for block / no reviews
  const bodyText = await page.locator('body').innerText().catch(() => '')
  if (
    bodyText.includes('Enter the characters you see below') ||
    bodyText.includes('Type the characters') ||
    bodyText.includes('api-services-support@amazon.com')
  ) {
    console.error(`[Scraper] Blocked on page ${pageNum}`)
    return []
  }

  const reviews = await page.evaluate(() => {
    const items = document.querySelectorAll('[data-hook="review"]')
    const results: any[] = []

    items.forEach((el: Element) => {
      const id = el.getAttribute('id') ?? ''
      if (!id) return

      const ratingEl  = el.querySelector('[data-hook="review-star-rating"] span, [data-hook="cmps-review-star-rating"] span')
      const titleEl   = el.querySelector('[data-hook="review-title"] span:not(.a-icon-alt)')
      const bodyEl    = el.querySelector('[data-hook="review-body"] span')
      const dateEl    = el.querySelector('[data-hook="review-date"]')
      const verifiedEl = el.querySelector('[data-hook="avp-badge"]')
      const helpfulEl = el.querySelector('[data-hook="helpful-vote-statement"]')

      const ratingText = ratingEl?.textContent?.trim() ?? ''
      const rating = parseFloat(ratingText.split(' ')[0]) || 0

      const body = bodyEl?.textContent?.trim() ?? ''
      if (body.length < 20) return

      const dateText = dateEl?.textContent?.trim() ?? ''
      // "Reviewed in the United States on January 1, 2024"
      const countryMatch = dateText.match(/Reviewed in (.+?) on/)
      const country = countryMatch?.[1] ?? ''
      const date = dateText.replace(/Reviewed in .+? on /, '').trim()

      const helpfulText = helpfulEl?.textContent?.trim() ?? ''
      const helpfulNum = parseInt(helpfulText.replace(/[^0-9]/g, '')) || 0

      results.push({
        id,
        rating,
        title:    titleEl?.textContent?.trim() ?? '',
        body,
        date,
        verified: !!verifiedEl,
        helpful:  helpfulNum,
        country,
      })
    })

    return results
  })

  console.log(`[Scraper] Page ${pageNum} — ${reviews.length} reviews`)
  return reviews as Review[]
}

export async function scrape(req: ScrapeRequest): Promise<Review[]> {
  const tld = req.marketplace.replace(/^amazon\./, '')
  console.log(`[Scraper] ${req.asin} — targeting ${req.maxReviews} reviews via Scraping Browser`)

  const browser = await chromium.connectOverCDP(BROWSER_WS)
  const context = await browser.newContext()
  const page    = await context.newPage()

  try {
    const allReviews: Review[] = []
    const seenIds = new Set<string>()
    const maxPages = Math.ceil(req.maxReviews / REVIEWS_PER_PAGE)

    for (let p = 1; p <= maxPages && allReviews.length < req.maxReviews; p++) {
      const reviews = await scrapePage(page, req.asin, tld, p)

      if (reviews.length === 0) {
        console.log(`[Scraper] Empty page ${p}, stopping`)
        break
      }

      for (const r of reviews) {
        if (!seenIds.has(r.id)) {
          seenIds.add(r.id)
          allReviews.push(r)
        }
      }

      console.log(`[Scraper] ${req.asin} — ${allReviews.length} total so far`)

      // Small delay between pages to be polite
      if (p < maxPages) await new Promise(r => setTimeout(r, 1500))
    }

    console.log(`[Scraper] ${req.asin} → ${allReviews.length} reviews`)
    return allReviews.slice(0, req.maxReviews)
  } finally {
    await page.close()
    await context.close()
    await browser.close()
  }
}
