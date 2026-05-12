// Voxrate scraper microservice — Playwright + Etsy review interception
const express = require('express')
const { chromium } = require('playwright')

const app = express()
app.use(express.json())

const PORT = process.env.PORT || 3001
const SECRET = process.env.SCRAPER_SECRET || 'dev-secret'

// ─── helpers ────────────────────────────────────────────────────────────────

function extractListingId(url) {
  const m = url.match(/listing\/(\d+)/)
  return m ? m[1] : null
}

// Walk a JSON object tree and collect anything that looks like a review
function collectReviews(obj, found = [], depth = 0) {
  if (depth > 12 || !obj || typeof obj !== 'object') return found
  if (Array.isArray(obj)) {
    for (const item of obj) collectReviews(item, found, depth + 1)
    return found
  }
  const hasRating = typeof obj.rating === 'number' && obj.rating >= 1 && obj.rating <= 5
  const hasText   = typeof (obj.review ?? obj.reviewBody ?? obj.text ?? obj.body) === 'string'
  const textLen   = String(obj.review ?? obj.reviewBody ?? obj.text ?? obj.body ?? '').length
  if (hasRating && hasText && textLen > 3) {
    found.push({
      rating: obj.rating,
      review: obj.review ?? obj.reviewBody ?? obj.text ?? obj.body ?? '',
      id:     obj.listing_review_id ?? obj.id ?? obj.review_id ?? null,
    })
    return found
  }
  for (const val of Object.values(obj)) collectReviews(val, found, depth + 1)
  return found
}

// ─── main scrape handler ─────────────────────────────────────────────────────

async function scrapeReviews(listingUrl, maxPages = 30) {
  const listingId = extractListingId(listingUrl)
  if (!listingId) throw new Error('Could not extract listing ID from URL')

  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
  })

  try {
    const context = await browser.newContext({
      userAgent:
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
        '(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      viewport: { width: 1280, height: 900 },
      locale: 'en-US',
      extraHTTPHeaders: {
        'Accept-Language': 'en-US,en;q=0.9',
      },
    })

    const allReviews = []
    const seenIds    = new Set()
    let   reviewApiPattern = null  // captured XHR URL template

    // Intercept every JSON response, fish for reviews
    context.on('response', async (response) => {
      const url = response.url()
      if (!url.includes('etsy.com')) return
      const ct = response.headers()['content-type'] ?? ''
      if (!ct.includes('json')) return

      // Track the review endpoint URL so we can paginate it directly later
      if (!reviewApiPattern && (url.includes('review') || url.includes('Review'))) {
        reviewApiPattern = url
        console.log('[intercept] Review endpoint:', url)
      }

      try {
        const json = await response.json().catch(() => null)
        if (!json) return
        const reviews = collectReviews(json)
        for (const r of reviews) {
          const key = r.id ?? r.review.slice(0, 40)
          if (!seenIds.has(key)) {
            seenIds.add(key)
            allReviews.push(r)
          }
        }
        if (reviews.length > 0) {
          console.log(`[intercept] +${reviews.length} reviews (total ${allReviews.length}) from ${url.slice(0, 80)}`)
        }
      } catch {}
    })

    const page = await context.newPage()
    console.log('[scraper] Loading listing page...')
    await page.goto(listingUrl, { waitUntil: 'networkidle', timeout: 45000 })
    await page.waitForTimeout(2000)

    // ── If we captured a review API URL, paginate it directly ──────────────
    if (reviewApiPattern) {
      const baseUrl = buildBaseReviewUrl(reviewApiPattern, listingId)
      console.log('[scraper] Paginating review API:', baseUrl)

      const cookies = await context.cookies('https://www.etsy.com')
      const cookieHeader = cookies.map(c => `${c.name}=${c.value}`).join('; ')

      // First page already captured via intercept — start from page 2
      for (let page = 2; page <= maxPages; page++) {
        const apiUrl = `${baseUrl}&page=${page}`
        console.log(`[scraper] Fetching page ${page}...`)

        const res = await fetch(apiUrl, {
          headers: {
            'Cookie':          cookieHeader,
            'User-Agent':      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0.0.0 Safari/537.36',
            'Accept':          'application/json, text/javascript, */*; q=0.01',
            'Accept-Language': 'en-US,en;q=0.9',
            'Referer':         listingUrl,
            'x-requested-with': 'XMLHttpRequest',
          },
        })

        if (!res.ok) {
          console.log(`[scraper] Page ${page} returned ${res.status}, stopping`)
          break
        }

        const json = await res.json().catch(() => null)
        if (!json) break

        const reviews = collectReviews(json)
        if (reviews.length === 0) {
          console.log(`[scraper] Page ${page} returned 0 reviews, stopping`)
          break
        }

        for (const r of reviews) {
          const key = r.id ?? r.review.slice(0, 40)
          if (!seenIds.has(key)) {
            seenIds.add(key)
            allReviews.push(r)
          }
        }
        console.log(`[scraper] Page ${page}: +${reviews.length} (total ${allReviews.length})`)

        // Small delay to avoid hammering
        await new Promise(r => setTimeout(r, 300))
      }
    } else {
      // ── Fallback: click through review pages in the browser ───────────────
      console.log('[scraper] No XHR endpoint captured, falling back to DOM pagination')
      await domPaginate(page, allReviews, seenIds, maxPages)
    }

    console.log(`[scraper] Done — ${allReviews.length} total reviews`)
    return allReviews

  } finally {
    await browser.close()
  }
}

// Build a clean pageable base URL from the captured XHR URL
function buildBaseReviewUrl(captured, listingId) {
  try {
    const u = new URL(captured)
    // Remove existing page param
    u.searchParams.delete('page')
    // Ensure we have listing ID in path
    if (!u.pathname.includes(listingId)) {
      // Try to reconstruct known Etsy pattern
      return `https://www.etsy.com/api/v3/ajax/bespoke/member/listings/${listingId}/reviews?language=en&limit=25`
    }
    return u.origin + u.pathname + '?' + u.searchParams.toString()
  } catch {
    return `https://www.etsy.com/api/v3/ajax/bespoke/member/listings/${listingId}/reviews?language=en&limit=25`
  }
}

// DOM fallback: look for review pagination and click through
async function domPaginate(page, allReviews, seenIds, maxPages) {
  for (let p = 1; p <= maxPages; p++) {
    // Extract text reviews from DOM
    const domReviews = await page.evaluate(() => {
      const cards = document.querySelectorAll('[data-review-region], .wt-mb-xs-3, [class*="review"]')
      const results = []
      for (const card of cards) {
        const ratingEl = card.querySelector('[aria-label*="star"], [aria-label*="Star"]')
        const textEl   = card.querySelector('p, [class*="body"]')
        if (!ratingEl || !textEl) continue
        const ratingMatch = (ratingEl.getAttribute('aria-label') ?? '').match(/(\d)/)
        if (!ratingMatch) continue
        const text = textEl.innerText?.trim()
        if (!text || text.length < 5) continue
        results.push({ rating: parseInt(ratingMatch[1]), review: text, id: null })
      }
      return results
    })

    for (const r of domReviews) {
      const key = r.review.slice(0, 40)
      if (!seenIds.has(key)) {
        seenIds.add(key)
        allReviews.push(r)
      }
    }

    // Try to click "Next page" in the reviews section
    const nextBtn = page.locator('[data-wt-test-id="pagination-button-next"], a[rel="next"]').first()
    const visible = await nextBtn.isVisible().catch(() => false)
    if (!visible) break

    await nextBtn.click()
    await page.waitForTimeout(2000)
  }
}

// ─── routes ──────────────────────────────────────────────────────────────────

app.get('/health', (_, res) => res.json({ ok: true }))

app.post('/scrape', async (req, res) => {
  const { url, secret, max_pages } = req.body ?? {}

  if (secret !== SECRET) {
    return res.status(401).json({ error: 'Unauthorized' })
  }
  if (!url || !url.includes('etsy.com/listing')) {
    return res.status(400).json({ error: 'Invalid or missing Etsy listing URL' })
  }

  console.log(`[POST /scrape] ${url}`)

  try {
    const reviews = await scrapeReviews(url, max_pages ?? 30)
    res.json({ reviews, total: reviews.length })
  } catch (err) {
    console.error('[scrape error]', err)
    res.status(500).json({ error: err.message })
  }
})

// ─── start ───────────────────────────────────────────────────────────────────

app.listen(PORT, () => {
  console.log(`Voxrate scraper listening on port ${PORT}`)
})
