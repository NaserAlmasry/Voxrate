// Voxrate Extension — Amazon Review Content Script
// Starts from the product page (/dp/ASIN), simulates real human browsing:
// scrolls, moves mouse, clicks real DOM buttons (not location.assign).
// Session profile randomises timing, filter order, burst size, and distraction
// rate so every user produces a unique fingerprint.

// Each filter+sort combo has an independent 100-review cap (10 pages × 10 reviews).
// We cycle through all combos to maximize yield — Amazon's WAF doesn't share state
// across different filter URLs so each is a fresh 100-review window.
const STAR_FILTERS = ['one_star', 'two_star', 'three_star', 'four_star', 'five_star']
// Additional verified-purchase filter combos — separate 100-review cap per star tier
const VERIFIED_FILTERS = ['one_star', 'five_star'] // most valuable for analysis: extremes

;(async () => {
  const url      = location.href
  const onDp     = /\/dp\/|\/gp\/product\//.test(url)
  const onReview = url.includes('/product-reviews/')

  if (!onDp && !onReview) return

  // Inject XHR interceptor early so we capture Amazon's own pagination AJAX calls
  injectXhrInterceptor()

  // ── Resumed job ────────────────────────────────────────────────
  const saved = sessionStorage.getItem('voxrate_job')
  if (saved) { await runResumePath(saved); return }

  // ── First load — must be product page ─────────────────────────
  if (!onDp) return

  let job = null
  try {
    job = await new Promise(resolve => {
      chrome.runtime.sendMessage({ type: 'CONTENT_READY', url }, res => {
        resolve(chrome.runtime.lastError ? null : res?.job ?? null)
      })
    })
  } catch { return }
  if (!job) return

  const { id: jobId, asin, marketplace, maxReviews } = job
  const tld = marketplace.replace('amazon.', '')

  if (isCaptchaOrLoginWall(document)) {
    chrome.runtime.sendMessage({ type: 'AMAZON_NOT_LOGGED_IN', jobId })
    return
  }

  const profile = generateSessionProfile()
  chrome.runtime.sendMessage({ type: 'CONTENT_LOG', msg: `Profile: patience=${profile.patience.toFixed(2)} burst=${profile.burstSize} filters=${profile.filterOrder.join(',')}` })

  const state = {
    jobId, asin, marketplace,
    maxReviews:      maxReviews || 500,
    reviews:         [],
    seenIds:         [],
    phase:           'product',   // product → unfiltered → filtered
    filterIdx:       0,
    page:            1,
    unfilteredPages: 0,
    totalPages:      0,
    throttleCount:   0,
    profile,
  }

  sessionStorage.setItem('voxrate_job', JSON.stringify(state))

  // Read the product page like a human (8–15s), then click See All Reviews
  await simulatePageReading(profile, 0)

  const reviewsLink = findSeeAllReviewsLink()
  if (reviewsLink) {
    chrome.runtime.sendMessage({ type: 'CONTENT_LOG', msg: 'Clicking "See all reviews"' })
    reviewsLink.click()
  } else {
    location.assign(`https://www.amazon.${tld}/product-reviews/${asin}?reviewerType=all_reviews&sortBy=recent`)
  }
})()

// ── Resume path: every page load after the first ──────────────────

async function runResumePath(saved) {
  let state
  try { state = JSON.parse(saved) } catch { sessionStorage.removeItem('voxrate_job'); return }

  const { jobId, asin, marketplace } = state
  const tld     = marketplace.replace('amazon.', '')
  const profile = state.profile ?? generateSessionProfile()

  if (isCaptchaOrLoginWall(document)) {
    sessionStorage.removeItem('voxrate_job')
    chrome.runtime.sendMessage({ type: 'AMAZON_NOT_LOGGED_IN', jobId })
    return
  }

  // Ask background to keep this tab in the foreground
  chrome.runtime.sendMessage({ type: 'ENSURE_TAB_ACTIVE' })
  await ensureVisible()

  // Note: Amazon's "limited selection" banner is informational — reviews are
  // still present on the page below it. We log it but don't stop collecting.
  if (isThrottled(document)) {
    chrome.runtime.sendMessage({ type: 'CONTENT_LOG', msg: 'Limited selection banner present — collecting available reviews anyway' })
  }

  // ── Phase: product → unfiltered ───────────────────────────────
  if (state.phase === 'product') {
    state.phase = 'unfiltered'
    state.page  = 1
  }

  // Collect AJAX-intercepted reviews (Amazon's own pagination XHR)
  const ajaxBatch = []
  listenForAjaxReviews(asin, marketplace, (batch) => ajaxBatch.push(...batch))

  // Drain any late-arriving AJAX reviews before the page unloads
  window.addEventListener('beforeunload', () => {
    if (ajaxBatch.length === 0) return
    try {
      const cur = JSON.parse(sessionStorage.getItem('voxrate_job') || 'null')
      if (!cur) return
      const seen = new Set(cur.seenIds || [])
      const fresh = ajaxBatch.filter(r => !seen.has(r.id))
      if (fresh.length === 0) return
      cur.reviews.push(...fresh)
      fresh.forEach(r => cur.seenIds.push(r.id))
      if (cur.seenIds.length > 1000) cur.seenIds = cur.seenIds.slice(-1000)
      sessionStorage.setItem('voxrate_job', JSON.stringify(cur))
    } catch {}
  })

  // ── Simulate human reading before doing anything ──────────────
  const batch   = parseReviews(document, asin, marketplace)
  // BUG 2 fix: use a Set for O(1) duplicate checks
  const seenSet = new Set(state.seenIds)
  const newOnes = batch.filter(r => !seenSet.has(r.id))
  await simulatePageReading(profile, newOnes.length)

  // BUG 1 fix: merge AJAX-intercepted reviews before pushing to state.reviews
  const ajaxNew = ajaxBatch.filter(r => !seenSet.has(r.id) && !newOnes.some(n => n.id === r.id))

  state.reviews.push(...newOnes, ...ajaxNew)
  newOnes.forEach(r => state.seenIds.push(r.id))
  ajaxNew.forEach(r => state.seenIds.push(r.id))

  // BUG 2 fix: cap seenIds to the last 1000 entries to prevent unbounded growth
  if (state.seenIds.length > 1000) {
    state.seenIds = state.seenIds.slice(state.seenIds.length - 1000)
  }

  state.totalPages = (state.totalPages ?? 0) + 1

  // ── Phase: unfiltered (1–2 pages of all-star reviews) ─────────
  if (state.phase === 'unfiltered') {
    chrome.runtime.sendMessage({ type: 'CONTENT_LOG', msg: `Unfiltered p${state.unfilteredPages + 1}: ${newOnes.length} new` })
    state.unfilteredPages = (state.unfilteredPages ?? 0) + 1

    const wantMoreUnfiltered = state.unfilteredPages < (1 + (Math.random() < profile.patience ? 1 : 0))
    const nextBtn = findNextPageButton(document)

    if (wantMoreUnfiltered && nextBtn && newOnes.length > 0) {
      state.page++
      sessionStorage.setItem('voxrate_job', JSON.stringify(state))
      await maybeDistract(state.totalPages, profile)
      await sleep(humanDelay(2500, 7000, 4500, profile) * fatigueMultiplier(state.totalPages))
      nextBtn.click()
      return
    }

    // Bail early if Amazon is walling us — unfiltered page returned 0 reviews on first page
    if (state.unfilteredPages === 1 && newOnes.length === 0 && state.reviews.length === 0) {
      chrome.runtime.sendMessage({ type: 'CONTENT_LOG', msg: 'Zero reviews on unfiltered page — aws-waf-token likely missing. Browse Amazon naturally for a few minutes, then retry.' })
      sessionStorage.removeItem('voxrate_job')
      finish(jobId, asin, [], false)
      return
    }

    // Transition to filtered phase
    state.phase     = 'filtered'
    state.filterIdx = 0
    state.page      = 1

    if (state.reviews.length >= state.maxReviews || profile.filterOrder.length === 0) {
      sessionStorage.removeItem('voxrate_job')
      finish(jobId, asin, state.reviews, false)
      return
    }

    sessionStorage.setItem('voxrate_job', JSON.stringify(state))
    await maybeDistract(state.totalPages, profile)
    await sleep(humanDelay(4000, 10000, 6000, profile))
    await navigateToFilter(tld, asin, profile.filterOrder[0], 1)
    return
  }

  // ── Phase: filtered ───────────────────────────────────────────
  const filter = profile.filterOrder[state.filterIdx]
  chrome.runtime.sendMessage({ type: 'CONTENT_LOG', msg: `${filter} p${state.page}: ${newOnes.length} new (total ${state.reviews.length})` })

  const done      = state.reviews.length >= state.maxReviews
  const exhausted = newOnes.length === 0
  const maxPages  = 10 // Amazon UI caps at page 10

  if (done) {
    sessionStorage.removeItem('voxrate_job')
    finish(jobId, asin, state.reviews, false)
    return
  }

  if (exhausted || state.page >= maxPages) {
    // Advance to next filter — occasionally skip one
    state.filterIdx++
    while (state.filterIdx < profile.filterOrder.length - 1 && Math.random() < profile.skipChance) {
      state.filterIdx++
    }
    state.page = 1

    if (state.filterIdx >= profile.filterOrder.length) {
      sessionStorage.removeItem('voxrate_job')
      finish(jobId, asin, state.reviews, false)
      return
    }

    sessionStorage.setItem('voxrate_job', JSON.stringify(state))
    await maybeDistract(state.totalPages, profile)
    const fatigue = fatigueMultiplier(state.totalPages)
    await sleep(humanDelay(4000, 11000, 6500, profile) * fatigue)
    await navigateToFilter(tld, asin, profile.filterOrder[state.filterIdx], 1)
    return
  }

  // Next page — click the real DOM button for Sec-Fetch-User: ?1
  state.page++
  sessionStorage.setItem('voxrate_job', JSON.stringify(state))

  await maybeDistract(state.totalPages, profile)
  const fatigue   = fatigueMultiplier(state.totalPages)
  const burstRest = isBurstRest(state.page, profile.burstSize) ? humanDelay(3000, 8000, 5000, profile) : 0
  await sleep((humanDelay(2000, 7000, 4000, profile) + burstRest) * fatigue)

  const nextBtn = findNextPageButton(document)
  if (nextBtn) {
    nextBtn.click()
  } else {
    location.assign(buildFilterUrl(tld, asin, filter, state.page))
  }
}

// ── Helpers: session profile ──────────────────────────────────────

function generateSessionProfile() {
  const patience = Math.random()
  // Build filter order: star filters first, then verified-purchase passes for 1★ and 5★
  // Each verified pass has an independent review cap — doubles yield for extremes
  const baseFilters = shuffle([...STAR_FILTERS])
  const verifiedFilters = VERIFIED_FILTERS.map(f => `${f}:avp`)
  return {
    patience,
    filterOrder:  [...baseFilters, ...verifiedFilters],
    burstSize:    2 + Math.floor(Math.random() * 4),     // 2–5 pages per burst
    distractRate: 0.04 + Math.random() * 0.10,           // 4–14% distraction chance
    skipChance:   0.10 + Math.random() * 0.15,           // 10–25% chance to skip a filter
    readSpeed:    0.7 + Math.random() * 0.6,             // reading pace multiplier
  }
}

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr
}

// ── Helpers: timing ───────────────────────────────────────────────

// Weibull distribution — right-skewed, matches human task-completion curves
function weibull(scaleMs, k = 1.8) {
  return Math.round(scaleMs * Math.pow(-Math.log(1 - Math.random()), 1 / k))
}

function humanDelay(minMs, maxMs, scaleMs, profile) {
  const scale = scaleMs * ((profile?.readSpeed ?? 1) * 0.5 + 0.5)
  return Math.max(minMs, Math.min(maxMs, weibull(scale)))
}

function fatigueMultiplier(totalPages) {
  return Math.min(1.4, 1 + Math.floor(totalPages / 10) * 0.06)
}

function isBurstRest(page, burstSize) {
  return page > 1 && (page - 1) % (burstSize ?? 3) === 0
}

async function maybeDistract(totalPages, profile) {
  if (totalPages > 0 && Math.random() < (profile?.distractRate ?? 0.06)) {
    const ms = humanDelay(6000, 22000, 12000, profile)
    chrome.runtime.sendMessage({ type: 'CONTENT_LOG', msg: `Distraction pause ${Math.round(ms / 1000)}s` })
    await sleep(ms)
  }
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)) }

// ── Helpers: page simulation ──────────────────────────────────────

async function simulatePageReading(profile, reviewCount) {
  // Scroll down the page in steps like a human reading
  const pageH  = Math.max(document.documentElement?.scrollHeight ?? 2000, 1000)
  const steps  = 6 + Math.floor(Math.random() * 8)

  for (let i = 1; i <= steps; i++) {
    const y = Math.floor(pageH * (i / steps) * (0.7 + Math.random() * 0.3))
    window.scrollTo(0, y)
    window.dispatchEvent(new Event('scroll'))
    await sleep(humanDelay(120, 650, 320, profile))
  }

  // Mouse movements — populate aws-waf-token behavioral data
  const moves = 3 + Math.floor(Math.random() * 5)
  for (let i = 0; i < moves; i++) {
    document.dispatchEvent(new MouseEvent('mousemove', {
      clientX: Math.floor(80 + Math.random() * 900),
      clientY: Math.floor(80 + Math.random() * 500),
      bubbles: true,
    }))
    await sleep(humanDelay(80, 350, 180, profile))
  }

  // Reading time scales with content volume
  const base    = humanDelay(3000, 10000, 5500, profile) * (profile?.readSpeed ?? 1)
  const content = reviewCount * 180
  await sleep(base + content)
}

async function ensureVisible() {
  if (!document.hidden) return
  await new Promise(resolve => {
    const t = setTimeout(resolve, 30000)
    document.addEventListener('visibilitychange', function h() {
      if (!document.hidden) { clearTimeout(t); document.removeEventListener('visibilitychange', h); resolve() }
    })
  })
}

// ── Helpers: navigation ───────────────────────────────────────────

function findSeeAllReviewsLink() {
  const selectors = [
    'a[data-hook="see-all-reviews-link-footer"]',   // NikolaiT confirmed working
    'a[data-hook="see-all-reviews-link-foot"]',
    'a[data-hook="reviews-medley-footer-see-all-link"]',
    '#reviews-medley-footer a',
    'a[href*="/product-reviews/"]',
  ]
  for (const sel of selectors) {
    const el = document.querySelector(sel)
    if (el) return el
  }
  return null
}

function findNextPageButton(doc) {
  const selectors = [
    'li.a-last:not(.a-disabled) a',
    'a[data-hook="next-page-link"]',
    '[data-hook="pagination-bar"] li.a-last a',
  ]
  for (const sel of selectors) {
    const el = (doc ?? document).querySelector(sel)
    if (el) return el
  }
  return null
}

async function navigateToFilter(tld, asin, filter, page) {
  const starFilter = filter.replace(':avp', '')
  const avp = filter.endsWith(':avp')
  // Try clicking the actual filter link so Amazon sees a real user gesture
  if (page === 1 && !avp) {
    const link = document.querySelector(`a[href*="filterByStar=${starFilter}"]`)
    if (link) { link.click(); return }
  }
  location.assign(buildFilterUrl(tld, asin, filter, page))
}

function buildFilterUrl(tld, asin, filter, page) {
  const starFilter = filter.replace(':avp', '')
  const avp = filter.endsWith(':avp')
  const reviewerType = avp ? 'avp_only_reviews' : 'all_reviews'
  return `https://www.amazon.${tld}/product-reviews/${asin}?reviewerType=${reviewerType}&filterByStar=${starFilter}&sortBy=recent&pageNumber=${page}`
}

// ── Helpers: detection ────────────────────────────────────────────

function isThrottled(doc) {
  const text = (doc.body?.textContent ?? '').toLowerCase()
  return text.includes('limited selection of reviews') ||
         text.includes('to see more reviews, you can send a request')
}

function isCaptchaOrLoginWall(doc) {
  const url = doc.location?.href ?? ''
  if (url.includes('/ap/signin') || url.includes('/gp/sign-in')) return true
  if (doc.querySelector('#captchacharacters, form[action*="/errors/validateCaptcha"]')) return true
  const signIn = doc.querySelector('form[name="signIn"], #ap_signin_form, input[name="email"]')
  const reviews = doc.querySelector('#cm_cr-review_list, [data-hook="review"]')
  if (signIn && !reviews) return true
  return false
}

// ── XHR Intercept: capture Amazon's own internal pagination AJAX ──
// Amazon's /reviews-render/ajax/ endpoint is called by their own JS when
// clicking next page. We intercept the response in page context and relay
// the HTML fragment back to content script via a custom event, letting us
// parse reviews from AJAX without triggering extra WAF-visible requests.

function injectXhrInterceptor() {
  const script = document.createElement('script')
  script.textContent = `(function() {
    const _open = XMLHttpRequest.prototype.open
    const _send = XMLHttpRequest.prototype.send
    XMLHttpRequest.prototype.open = function(method, url, ...rest) {
      this._voxrateUrl = url
      return _open.call(this, method, url, ...rest)
    }
    XMLHttpRequest.prototype.send = function(...args) {
      this.addEventListener('load', function() {
        if (this._voxrateUrl && this._voxrateUrl.includes('reviews-render')) {
          document.dispatchEvent(new CustomEvent('voxrate-ajax-reviews', {
            detail: { html: this.responseText, url: this._voxrateUrl }
          }))
        }
      })
      return _send.apply(this, args)
    }
    // Also intercept fetch (Amazon may use either)
    const _fetch = window.fetch
    window.fetch = function(input, init) {
      const url = typeof input === 'string' ? input : (input?.url ?? '')
      const p = _fetch.call(this, input, init)
      if (url.includes('reviews-render')) {
        p.then(res => res.clone().text().then(html => {
          document.dispatchEvent(new CustomEvent('voxrate-ajax-reviews', {
            detail: { html, url }
          }))
        })).catch(() => {})
      }
      return p
    }
  })()`
  ;(document.head || document.documentElement).appendChild(script)
  script.remove()
}

function listenForAjaxReviews(asin, marketplace, onBatch) {
  document.addEventListener('voxrate-ajax-reviews', (e) => {
    try {
      const tmp = document.createElement('div')
      tmp.innerHTML = e.detail.html
      const batch = parseReviews(tmp, asin, marketplace)
      if (batch.length > 0) onBatch(batch)
    } catch {}
  })
}

// ── Helpers: parse & finish ───────────────────────────────────────

function finish(jobId, asin, reviews, wasThrottled) {
  chrome.runtime.sendMessage({ type: 'CONTENT_LOG', msg: `Done: ${reviews.length} reviews${wasThrottled ? ' (throttled)' : ''}` })
  chrome.runtime.sendMessage({ type: 'REVIEWS_DONE', jobId, asin, reviews, amazonLoggedIn: true, wasThrottled })
}

function parseReviews(doc, asin, marketplace) {
  const reviews = []
  doc.querySelectorAll('[data-hook="review"]').forEach((el, i) => {
    try {
      let id = el.id || ''
      if (!id) {
        const href = el.querySelector('a[data-hook="review-title"]')?.getAttribute('href') ?? ''
        const m = href.match(/\/(R[A-Z0-9]{6,})/)
        if (m) id = m[1]
      }
      if (!id) id = `${asin}-idx-${i}`

      const ratingEl    = el.querySelector('i[data-hook="review-star-rating"], i[data-hook="cmps-review-star-rating"]')
      const ratingTitle = ratingEl?.querySelector('.a-icon-alt')?.textContent ?? ratingEl?.title ?? ''
      const ratingMatch = ratingTitle.match(/^([\d.]+)/)
      const rating      = ratingMatch ? Math.round(parseFloat(ratingMatch[1])) : 0
      if (rating < 1 || rating > 5) return

      const titleEl = el.querySelector('[data-hook="review-title"] > span:not(.a-icon-alt)')
                   || el.querySelector('[data-hook="review-title"] > span')
      const title   = (titleEl?.textContent ?? '').trim()

      const bodyEl = el.querySelector('[data-hook="review-body"] span')
                  || el.querySelector('.review-text span')
                  || el.querySelector('.review-text')
      const body   = (bodyEl?.textContent ?? '').trim()
      if (body.length < 3) return

      const date     = (el.querySelector('[data-hook="review-date"]')?.textContent ?? '').trim()
      const verified = !!el.querySelector('[data-hook="avp-badge"]')
      const vine     = !!el.querySelector('[data-hook="vine-badge"]')
      const helpfulT = el.querySelector('[data-hook="helpful-vote-statement"]')?.textContent ?? ''
      const helpfulM = helpfulT.match(/(\d[\d,]*)/)
      const helpful  = helpfulM ? parseInt(helpfulM[1].replace(/,/g, '')) : 0

      reviews.push({ id, rating, title, body, date, verified, vine, helpful,
                     country: marketplace.replace('amazon.', '') })
    } catch {}
  })
  return reviews
}
