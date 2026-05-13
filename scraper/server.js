// Voxrate scraper — Playwright + Decodo residential proxy
const express  = require('express')
const { chromium } = require('playwright')

const app    = express()
app.use(express.json())

const PORT          = process.env.PORT || 3001
const SECRET        = process.env.SCRAPER_SECRET   || 'dev-secret'
const DECODO_USER   = process.env.DECODO_PROXY_USER // e.g. "user-abc123"
const DECODO_PASS   = process.env.DECODO_PROXY_PASS // e.g. "password"
// Decodo residential proxy endpoint. Override when switching protocol/port.
const PROXY_SERVER_RAW = process.env.DECODO_PROXY_SERVER || 'http://gate.decodo.com:10000'
const PROXY_SERVER = PROXY_SERVER_RAW.startsWith('socks5h://')
  ? PROXY_SERVER_RAW.replace(/^socks5h:\/\//, 'socks5://')
  : PROXY_SERVER_RAW
const proxyConfigured = Boolean(DECODO_USER && DECODO_PASS)

if (proxyConfigured && /^socks5:\/\//i.test(PROXY_SERVER)) {
  console.warn('[scraper] SOCKS5 with username/password is not supported here. Use http://gate.decodo.com:PORT instead.')
}

// ─── helpers ─────────────────────────────────────────────────────────────────

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
      date:   obj.datePublished ?? (obj.create_timestamp
        ? new Date(obj.create_timestamp * 1000).toISOString().slice(0, 10) : ''),
    })
    return found
  }
  for (const val of Object.values(obj)) collectReviews(val, found, depth + 1)
  return found
}

// ─── scrape ───────────────────────────────────────────────────────────────────

async function scrapeReviews(listingUrl, maxPages = 30) {
  const listingId = extractListingId(listingUrl)
  if (!listingId) throw new Error('Could not extract listing ID')

  const launchOpts = {
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-blink-features=AutomationControlled',
    ],
  }

  const contextOpts = {
    userAgent:
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
      '(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    viewport:   { width: 1280, height: 900 },
    locale:     'en-US',
    timezoneId: 'America/New_York',
    extraHTTPHeaders: { 'Accept-Language': 'en-US,en;q=0.9' },
  }

  if (DECODO_USER && DECODO_PASS) {
    if (/^socks5:\/\//i.test(PROXY_SERVER)) {
      throw new Error('Authenticated SOCKS5 proxy is not supported in this scraper. Switch DECODO_PROXY_SERVER to http://gate.decodo.com:PORT.')
    }
    launchOpts.proxy = {
      server:   PROXY_SERVER,
      username: DECODO_USER,
      password: DECODO_PASS,
    }
    console.log(`[scraper] Using Decodo residential proxy (${PROXY_SERVER}, user=${DECODO_USER.slice(0, 3)}***)`)
  } else {
    console.log('[scraper] No proxy configured — direct connection')
  }

  const browser = await chromium.launch(launchOpts)
  try {
    const context = await browser.newContext(contextOpts)

    // Hide automation signals
    await context.addInitScript(() => {
      Object.defineProperty(navigator, 'webdriver', { get: () => false })
      Object.defineProperty(navigator, 'plugins',   { get: () => [1,2,3,4,5] })
      Object.defineProperty(navigator, 'languages', { get: () => ['en-US','en'] })
      window.chrome = { runtime: {} }
    })

    const allReviews  = []
    const seenIds     = new Set()
    let reviewApiBase = null

    // Save residential proxy bandwidth. Reviews come from document + XHR/JSON.
    await context.route('**/*', (route) => {
      const request = route.request()
      const type = request.resourceType()
      const url = request.url()

      if (
        ['image', 'media', 'font', 'stylesheet'].includes(type) ||
        /google-analytics|googletagmanager|doubleclick|facebook|pinterest|bing\.com|tiktok/i.test(url)
      ) {
        return route.abort()
      }

      return route.continue()
    })

    // Intercept all JSON responses from etsy.com
    context.on('response', async (response) => {
      try {
        const url = response.url()
        if (!url.includes('etsy.com')) return
        const ct = response.headers()['content-type'] ?? ''
        if (!ct.includes('json')) return

        console.log(`[xhr] ${response.status()} ${url.slice(0, 120)}`)

        const body = await response.text().catch(() => null)
        if (!body) return

        let json
        try { json = JSON.parse(body) } catch { return }

        if (!reviewApiBase && (url.includes('review') || url.includes('Review'))) {
          reviewApiBase = url
          console.log('[intercept] Review endpoint:', url)
        }

        const reviews = collectReviews(json)
        for (const r of reviews) {
          const key = r.id ?? r.review.slice(0, 40)
          if (!seenIds.has(key)) { seenIds.add(key); allReviews.push(r) }
        }
        if (reviews.length) console.log(`[intercept] +${reviews.length} reviews (total ${allReviews.length})`)
      } catch {}
    })

    const page = await context.newPage()
    const res  = await page.goto(listingUrl, { waitUntil: 'domcontentloaded', timeout: 45000 })
    console.log('[scraper] HTTP status:', res?.status())

    if (res?.status() === 403 || res?.status() === 429) {
      throw new Error(`Etsy blocked the request (${res.status()}) — proxy may be needed`)
    }

    await page.waitForTimeout(4000)

    // Scroll to trigger lazy-loaded reviews
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight / 2))
    await page.waitForTimeout(2000)

    console.log(`[scraper] After page load: ${allReviews.length} reviews`)

    // ── Paginate via captured XHR endpoint ──────────────────────────────────
    if (reviewApiBase) {
      const base    = buildBaseUrl(reviewApiBase, listingId)
      const cookies = await context.cookies('https://www.etsy.com')
      const cookieHeader = cookies.map(c => `${c.name}=${c.value}`).join('; ')

      console.log('[scraper] Paginating:', base)

      for (let p = 2; p <= maxPages; p++) {
        const apiUrl = `${base}&page=${p}`
        const r = await fetch(apiUrl, {
          headers: {
            'Cookie':           cookieHeader,
            'User-Agent':       'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0.0.0 Safari/537.36',
            'Accept':           'application/json, text/javascript, */*; q=0.01',
            'Accept-Language':  'en-US,en;q=0.9',
            'Referer':          listingUrl,
            'x-requested-with': 'XMLHttpRequest',
          },
        }).catch(() => null)

        if (!r?.ok) { console.log(`[scraper] Page ${p}: ${r?.status ?? 'error'}, stopping`); break }

        const json = await r.json().catch(() => null)
        if (!json) break

        const reviews = collectReviews(json)
        if (!reviews.length) { console.log(`[scraper] Page ${p}: 0 reviews, done`); break }

        for (const rv of reviews) {
          const key = rv.id ?? rv.review.slice(0, 40)
          if (!seenIds.has(key)) { seenIds.add(key); allReviews.push(rv) }
        }
        console.log(`[scraper] Page ${p}: +${reviews.length} (total ${allReviews.length})`)
        await new Promise(r => setTimeout(r, 400))
      }
    } else {
      // DOM fallback
      console.log('[scraper] No XHR captured — DOM pagination fallback')
      await domPaginate(page, allReviews, seenIds, maxPages)
    }

    console.log(`[scraper] Done: ${allReviews.length} total reviews`)
    return allReviews

  } finally {
    await browser.close()
  }
}

function buildBaseUrl(captured, listingId) {
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
    const reviews = await page.evaluate(() => {
      const results = []
      document.querySelectorAll('[data-review-region], [class*="review-card"]').forEach(card => {
        const rEl = card.querySelector('[aria-label*="star"], [aria-label*="Star"]')
        const tEl = card.querySelector('p')
        if (!rEl || !tEl) return
        const m = (rEl.getAttribute('aria-label') ?? '').match(/(\d)/)
        const text = tEl.innerText?.trim()
        if (m && text?.length > 5) results.push({ rating: parseInt(m[1]), review: text, id: null, date: '' })
      })
      return results
    })
    for (const r of reviews) {
      const key = r.review.slice(0, 40)
      if (!seenIds.has(key)) { seenIds.add(key); allReviews.push(r) }
    }
    const next = page.locator('[data-wt-test-id="pagination-button-next"], a[rel="next"]').first()
    if (!await next.isVisible().catch(() => false)) break
    await next.click()
    await page.waitForTimeout(2500)
  }
}

// ─── routes ──────────────────────────────────────────────────────────────────

app.get('/health', (_, res) => res.json({ ok: true }))
app.get('/debug', (_, res) => res.json({
  ok: true,
  proxyConfigured,
  proxyServer: PROXY_SERVER,
  proxyUserPrefix: DECODO_USER ? `${DECODO_USER.slice(0, 3)}***` : null,
}))

app.post('/scrape', async (req, res) => {
  const { url, secret, max_pages } = req.body ?? {}
  if (secret !== SECRET)                          return res.status(401).json({ error: 'Unauthorized' })
  if (!url || !url.includes('etsy.com/listing')) return res.status(400).json({ error: 'Invalid Etsy URL' })

  console.log(`\n[POST /scrape] ${url}`)
  try {
    const reviews = await scrapeReviews(url, max_pages ?? 30)
    res.json({ reviews, total: reviews.length })
  } catch (err) {
    console.error('[error]', err.message)
    res.status(500).json({
      error: err.message,
      proxyConfigured,
      proxyServer: PROXY_SERVER,
      proxyUserPrefix: DECODO_USER ? `${DECODO_USER.slice(0, 3)}***` : null,
    })
  }
})

app.listen(PORT, () => console.log(`Voxrate scraper on port ${PORT}`))
