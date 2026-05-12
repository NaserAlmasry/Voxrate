// Voxrate scraper microservice — Playwright + stealth + Etsy XHR interception
const express = require('express')
const { chromium } = require('playwright')

const app = express()
app.use(express.json())

const PORT   = process.env.PORT || 3001
const SECRET = process.env.SCRAPER_SECRET || 'dev-secret'

// ─── helpers ────────────────────────────────────────────────────────────────

function extractListingId(url) {
  const m = url.match(/listing\/(\d+)/)
  return m ? m[1] : null
}

function collectReviews(obj, found = [], depth = 0) {
  if (depth > 12 || !obj || typeof obj !== 'object') return found
  if (Array.isArray(obj)) {
    for (const item of obj) collectReviews(item, found, depth + 1)
    return found
  }
  const text   = obj.review ?? obj.reviewBody ?? obj.body ?? obj.text ?? obj.content ?? null
  const rating = obj.rating ?? obj.reviewRating?.ratingValue ?? obj.stars ?? null
  if (typeof text === 'string' && text.length > 5 && typeof rating === 'number' && rating >= 1 && rating <= 5) {
    found.push({
      rating: Math.round(rating),
      review: text.replace(/<[^>]*>/g, '').trim(),
      id:     obj.listing_review_id ?? obj.id ?? obj.review_id ?? null,
      date:   obj.datePublished ?? (obj.create_timestamp ? new Date(obj.create_timestamp * 1000).toISOString().slice(0, 10) : ''),
    })
    return found
  }
  for (const val of Object.values(obj)) collectReviews(val, found, depth + 1)
  return found
}

// ─── main scrape ─────────────────────────────────────────────────────────────

async function scrapeReviews(listingUrl, maxPages = 30) {
  const listingId = extractListingId(listingUrl)
  if (!listingId) throw new Error('Could not extract listing ID from URL')

  let browser
  try {
    browser = await chromium.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-blink-features=AutomationControlled',
        '--disable-infobars',
        '--window-size=1280,900',
      ],
    })

    const context = await browser.newContext({
      userAgent:
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
        '(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      viewport:    { width: 1280, height: 900 },
      locale:      'en-US',
      timezoneId:  'America/New_York',
      extraHTTPHeaders: { 'Accept-Language': 'en-US,en;q=0.9' },
    })

    // Hide webdriver flag
    await context.addInitScript(() => {
      Object.defineProperty(navigator, 'webdriver', { get: () => false })
      Object.defineProperty(navigator, 'plugins',   { get: () => [1, 2, 3, 4, 5] })
      Object.defineProperty(navigator, 'languages', { get: () => ['en-US', 'en'] })
      window.chrome = { runtime: {} }
    })

    const allReviews  = []
    const seenIds     = new Set()
    let reviewApiBase = null  // captured XHR base URL

    // Intercept ALL JSON responses and fish for reviews + capture review API URL
    context.on('response', async (response) => {
      try {
        const url = response.url()
        if (!url.includes('etsy.com')) return
        const ct = response.headers()['content-type'] ?? ''
        if (!ct.includes('json')) return

        const body = await response.text().catch(() => null)
        if (!body || body.length < 10) return

        // Log every JSON endpoint so we can see what Etsy is calling
        console.log(`[xhr] ${response.status()} ${url.slice(0, 100)}`)

        let json
        try { json = JSON.parse(body) } catch { return }

        // Capture the review endpoint URL
        if (!reviewApiBase && (url.includes('review') || url.includes('Review'))) {
          reviewApiBase = url
          console.log('[intercept] Captured review endpoint:', url)
        }

        const reviews = collectReviews(json)
        if (reviews.length > 0) {
          console.log(`[intercept] +${reviews.length} reviews from ${url.slice(0, 80)}`)
          for (const r of reviews) {
            const key = r.id ?? r.review.slice(0, 40)
            if (!seenIds.has(key)) { seenIds.add(key); allReviews.push(r) }
          }
        }
      } catch {}
    })

    const page = await context.newPage()

    console.log('[scraper] Loading page:', listingUrl)
    const response = await page.goto(listingUrl, { waitUntil: 'domcontentloaded', timeout: 45000 })
    console.log('[scraper] Page status:', response?.status())

    // Wait for reviews section to load
    await page.waitForTimeout(4000)

    // Try to scroll to reviews section to trigger lazy loading
    await page.evaluate(() => {
      const el = document.querySelector('[data-reviews-section], #reviews, [class*="review"]')
      if (el) el.scrollIntoView()
      else window.scrollTo(0, document.body.scrollHeight / 2)
    })
    await page.waitForTimeout(2000)

    console.log(`[scraper] After first page load: ${allReviews.length} reviews captured`)

    // ── If we captured the review API, paginate directly ────────────────────
    if (reviewApiBase) {
      const base    = buildBaseReviewUrl(reviewApiBase, listingId)
      const cookies = await context.cookies('https://www.etsy.com')
      const cookieHeader = cookies.map(c => `${c.name}=${c.value}`).join('; ')

      console.log('[scraper] Paginating via XHR endpoint:', base)

      for (let p = 2; p <= maxPages; p++) {
        const apiUrl = `${base}&page=${p}`
        const res = await fetch(apiUrl, {
          headers: {
            'Cookie':           cookieHeader,
            'User-Agent':       'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0.0.0 Safari/537.36',
            'Accept':           'application/json, text/javascript, */*; q=0.01',
            'Accept-Language':  'en-US,en;q=0.9',
            'Referer':          listingUrl,
            'x-requested-with': 'XMLHttpRequest',
          },
        }).catch(e => { console.log(`[scraper] fetch error page ${p}:`, e.message); return null })

        if (!res || !res.ok) {
          console.log(`[scraper] Page ${p} returned ${res?.status ?? 'no response'}, stopping`)
          break
        }

        const json = await res.json().catch(() => null)
        if (!json) break

        const reviews = collectReviews(json)
        if (reviews.length === 0) { console.log(`[scraper] Page ${p}: 0 reviews, stopping`); break }

        for (const r of reviews) {
          const key = r.id ?? r.review.slice(0, 40)
          if (!seenIds.has(key)) { seenIds.add(key); allReviews.push(r) }
        }
        console.log(`[scraper] Page ${p}: +${reviews.length} (total ${allReviews.length})`)
        await new Promise(r => setTimeout(r, 300))
      }
    } else {
      // ── Fallback: click through review pages in DOM ──────────────────────
      console.log('[scraper] No XHR endpoint captured — using DOM pagination')
      await domPaginate(page, allReviews, seenIds, maxPages)
    }

    console.log(`[scraper] Final total: ${allReviews.length} reviews`)
    return allReviews

  } finally {
    if (browser) await browser.close()
  }
}

function buildBaseReviewUrl(captured, listingId) {
  try {
    const u = new URL(captured)
    u.searchParams.delete('page')
    if (!u.pathname.includes(listingId)) {
      return `https://www.etsy.com/api/v3/ajax/bespoke/member/listings/${listingId}/reviews?language=en&limit=25`
    }
    return u.origin + u.pathname + '?' + u.searchParams.toString()
  } catch {
    return `https://www.etsy.com/api/v3/ajax/bespoke/member/listings/${listingId}/reviews?language=en&limit=25`
  }
}

async function domPaginate(page, allReviews, seenIds, maxPages) {
  for (let p = 2; p <= maxPages; p++) {
    const domReviews = await page.evaluate(() => {
      const results = []
      document.querySelectorAll('[data-review-region], [class*="review-card"], [class*="ReviewCard"]').forEach(card => {
        const ratingEl = card.querySelector('[aria-label*="star"], [aria-label*="Star"]')
        const textEl   = card.querySelector('p')
        if (!ratingEl || !textEl) return
        const m = (ratingEl.getAttribute('aria-label') ?? '').match(/(\d)/)
        if (!m) return
        const text = textEl.innerText?.trim()
        if (text && text.length > 5) results.push({ rating: parseInt(m[1]), review: text, id: null, date: '' })
      })
      return results
    })

    for (const r of domReviews) {
      const key = r.review.slice(0, 40)
      if (!seenIds.has(key)) { seenIds.add(key); allReviews.push(r) }
    }

    const nextBtn = page.locator('[data-wt-test-id="pagination-button-next"], a[rel="next"]').first()
    if (!await nextBtn.isVisible().catch(() => false)) break
    await nextBtn.click()
    await page.waitForTimeout(2500)
  }
}

// ─── routes ──────────────────────────────────────────────────────────────────

app.get('/health', (_, res) => res.json({ ok: true }))

app.post('/scrape', async (req, res) => {
  const { url, secret, max_pages } = req.body ?? {}
  if (secret !== SECRET)                          return res.status(401).json({ error: 'Unauthorized' })
  if (!url || !url.includes('etsy.com/listing')) return res.status(400).json({ error: 'Invalid Etsy URL' })

  console.log(`\n[POST /scrape] ${url}`)
  try {
    const reviews = await scrapeReviews(url, max_pages ?? 30)
    res.json({ reviews, total: reviews.length })
  } catch (err) {
    console.error('[scrape error]', err)
    res.status(500).json({ error: err.message })
  }
})

app.listen(PORT, () => console.log(`Voxrate scraper on port ${PORT}`))
