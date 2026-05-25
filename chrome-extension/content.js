// Voxrate Extension — Amazon Review Content Script
// AJAX POST to /hz/reviews-render/ajax/reviews/get/ using nextPageToken cursor.
// CSRF token is in <script type="a-state"> JSON blocks under the "csrfToken" key.
// Falls back to URL navigation (capped at page 2 per filter) if CSRF unavailable.

const STAR_FILTERS = ['five_star', 'four_star', 'three_star', 'two_star', 'one_star']

;(async () => {
  // ── Resume path: navigation fallback ────────────────────────────
  const saved = sessionStorage.getItem('voxrate_job')
  if (saved) {
    let state
    try { state = JSON.parse(saved) } catch { sessionStorage.removeItem('voxrate_job'); return }

    // Schema compat across extension versions
    state.currentPage   = state.currentPage   ?? 1
    state.currentFilter = state.currentFilter ?? 'five_star'
    state.seenIds       = state.seenIds       ?? []
    state.reviews       = state.reviews       ?? []

    if (isCaptchaOrLoginWall(document)) {
      sessionStorage.removeItem('voxrate_job')
      chrome.runtime.sendMessage({ type: 'AMAZON_NOT_LOGGED_IN', jobId: state.jobId })
      return
    }

    const batch   = parseReviews(document, state.asin, state.marketplace)
    const newOnes = batch.filter(r => !state.seenIds.includes(r.id))
    chrome.runtime.sendMessage({ type: 'CONTENT_LOG', msg: `Nav fallback ${state.currentFilter} p${state.currentPage}: ${newOnes.length} new` })

    state.reviews.push(...newOnes)
    newOnes.forEach(r => state.seenIds.push(r.id))

    // Page 3+ always duplicates without nextPageToken — hard cap at page 2 per filter.
    // Amazon uses nextPageToken as a server-side cursor; ?pageNumber=N is decorative after page 2.
    const noMore = newOnes.length === 0 || state.currentPage >= 2
    const tld    = state.marketplace.replace('amazon.', '')

    if (state.reviews.length >= state.maxReviews || noMore) {
      const nextFilter = nextStarFilter(state.currentFilter)
      if (!nextFilter || state.reviews.length >= state.maxReviews) {
        sessionStorage.removeItem('voxrate_job')
        finish(state.jobId, state.asin, state.reviews)
        return
      }
      state.currentFilter = nextFilter
      state.currentPage   = 1
    } else {
      state.currentPage++
    }

    sessionStorage.setItem('voxrate_job', JSON.stringify(state))
    location.assign(filterUrl(tld, state.asin, state.currentFilter, state.currentPage))
    return
  }

  // ── First load — get job from background ────────────────────────
  let job = null
  try {
    const response = await new Promise((resolve) => {
      chrome.runtime.sendMessage({ type: 'CONTENT_READY', url: location.href }, (res) => {
        if (chrome.runtime.lastError) resolve(null)
        else resolve(res)
      })
    })
    job = response?.job || null
  } catch { return }

  if (!job) return

  const { id: jobId, asin, marketplace, maxReviews } = job

  if (isCaptchaOrLoginWall(document)) {
    chrome.runtime.sendMessage({ type: 'AMAZON_NOT_LOGGED_IN', jobId })
    return
  }

  const max        = maxReviews || 100
  const tld        = marketplace.replace('amazon.', '')
  const refererUrl = `https://www.amazon.${tld}/product-reviews/${asin}`

  // Amazon injects the CSRF token into a <meta name="anti-csrftoken-a2z"> tag
  // dynamically via a lazy /render XHR after page load — wait up to 8s for it.
  const csrfToken = await waitForCsrfToken(8000)
  chrome.runtime.sendMessage({ type: 'CONTENT_LOG', msg: `csrfToken found: ${!!csrfToken}` })

  if (!csrfToken) {
    // No CSRF — nav fallback (max ~50 reviews: 5 filters × 2 pages)
    const page1 = parseReviews(document, asin, marketplace)
    chrome.runtime.sendMessage({ type: 'CONTENT_LOG', msg: `No CSRF, nav fallback. Page 1: ${page1.length} reviews` })
    const state = {
      jobId, asin, marketplace, maxReviews: max,
      reviews: page1, seenIds: page1.map(r => r.id),
      currentFilter: 'five_star', currentPage: 1,
    }
    sessionStorage.setItem('voxrate_job', JSON.stringify(state))
    location.assign(filterUrl(tld, asin, 'five_star', 1))
    return
  }

  // ── AJAX path — collect 100+ reviews without navigating ─────────
  const allReviews = []
  const seenIds    = new Set()

  // Collect page 1 unfiltered reviews (already loaded in the DOM)
  const page1 = parseReviews(document, asin, marketplace)
  page1.forEach(r => { allReviews.push(r); seenIds.add(r.id) })
  chrome.runtime.sendMessage({ type: 'CONTENT_LOG', msg: `Page 1 (all): ${page1.length} reviews` })

  for (const filter of STAR_FILTERS) {
    if (allReviews.length >= max) break

    let page          = 1
    let nextPageToken = null

    while (page <= 10 && allReviews.length < max) {
      let html = null
      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          html = await fetchReviewsViaAjax(asin, tld, filter, page, nextPageToken, csrfToken, refererUrl)
          break
        } catch (err) {
          chrome.runtime.sendMessage({ type: 'CONTENT_LOG', msg: `AJAX ${filter} p${page} attempt ${attempt}: ${err.message}` })
          if (attempt < 3) await sleep(1000 * attempt)
        }
      }

      if (!html) break

      const doc     = new DOMParser().parseFromString(html, 'text/html')
      const batch   = parseReviews(doc, asin, marketplace)
      const newOnes = batch.filter(r => !seenIds.has(r.id))

      chrome.runtime.sendMessage({ type: 'CONTENT_LOG', msg: `AJAX ${filter} p${page}: ${batch.length} total, ${newOnes.length} new` })

      if (newOnes.length === 0) break

      newOnes.forEach(r => { allReviews.push(r); seenIds.add(r.id) })

      nextPageToken = extractNextPageTokenFromDoc(doc)
      if (!nextPageToken) break
      page++
    }
  }

  finish(jobId, asin, allReviews)
})()

// ── AJAX POST to Amazon's internal reviews endpoint ───────────────

async function fetchReviewsViaAjax(asin, tld, filter, page, nextPageToken, csrfToken, refererUrl) {
  // Parameters match Amazon's own show-more button POST (captured from DevTools Network tab).
  // shouldAppend=true for page 2+ (appending results), false for page 1 (fresh start).
  // canShowIntHeader=true — must be boolean string, not "undefined".
  // formatType/mediaType must be non-empty; empty strings cause 403.
  const body = new URLSearchParams({
    sortBy:           'recent',
    reviewerType:     'all_reviews',
    formatType:       'current_format',
    mediaType:        'all_reviews',
    filterByStar:     filter,
    pageNumber:       String(page),
    filterByLanguage: '',
    filterByKeyword:  '',
    shouldAppend:     nextPageToken ? 'true' : 'false',
    deviceType:       'desktop',
    canShowIntHeader: 'true',
    reftag:           `cm_cr_arp_d_paging_btm_next_${page}`,
    pageSize:         '10',
    asin,
  })
  if (nextPageToken) body.set('nextPageToken', nextPageToken)

  const res = await fetch(`https://www.amazon.${tld}/hz/reviews-render/ajax/reviews/get/`, {
    method:      'POST',
    credentials: 'include',
    headers: {
      'Content-Type':       'application/x-www-form-urlencoded;charset=UTF-8',
      'anti-csrftoken-a2z': csrfToken,
      'x-requested-with':   'XMLHttpRequest',
      'Accept':             'text/html,*/*',
    },
    body: body.toString(),
  })

  if (!res.ok) {
    // Log response body on 403 to diagnose what Amazon is rejecting
    const errBody = await res.text().catch(() => '')
    throw new Error(`HTTP ${res.status} — ${errBody.slice(0, 300)}`)
  }

  const text = await res.text()
  return parseTurboResponse(text)
}

// ── Parse Amazon's &&& turbo streaming response ───────────────────
// Format: chunks split by &&&, each chunk is a JSON array of
// [operation, cssSelector, htmlOrData] triples.

function parseTurboResponse(text) {
  const htmlParts = []

  for (const chunk of text.split(/&&&/)) {
    const trimmed = chunk.trim()
    if (!trimmed) continue
    try {
      const parsed = JSON.parse(trimmed)
      if (!Array.isArray(parsed)) continue
      for (const entry of parsed) {
        if (Array.isArray(entry) && entry.length >= 3 && typeof entry[2] === 'string') {
          htmlParts.push(entry[2])
        }
      }
    } catch {
      // Chunk isn't valid JSON — fall back to extracting "html" string fields
      const re = /"html"\s*:\s*"((?:[^"\\]|\\.)*)"/gs
      let m
      while ((m = re.exec(trimmed)) !== null) {
        try { htmlParts.push(JSON.parse(`"${m[1]}"`)) } catch {}
      }
    }
  }

  return htmlParts.join('')
}

// ── Extract nextPageToken from show-more / pagination button ──────

function extractNextPageTokenFromDoc(doc) {
  const selectors = [
    'a[data-hook="show-more-button"]',
    '[data-hook="pagination-bar"] li.a-last a',
    '[data-hook="pagination-bar"] a.a-last',
    '[data-hook="next-page-link"]',
    'li.a-last a',
  ]
  for (const sel of selectors) {
    const btn = doc.querySelector(sel)
    if (!btn) continue
    try {
      const params = JSON.parse(btn.getAttribute('data-reviews-state-param') || '{}')
      if (params.nextPageToken) return params.nextPageToken
    } catch {}
  }
  return null
}

// ── Wait for anti-CSRF token ──────────────────────────────────────
// Amazon injects <meta name="anti-csrftoken-a2z"> dynamically via a lazy
// /render XHR after page load. We observe the DOM for up to `timeoutMs`
// and also poll other locations as fallbacks.

function waitForCsrfToken(timeoutMs) {
  return new Promise((resolve) => {
    // Check immediately first
    const immediate = extractCsrfToken()
    if (immediate) { resolve(immediate); return }

    let resolved = false
    const done = (token) => {
      if (resolved) return
      resolved = true
      observer.disconnect()
      clearInterval(poll)
      clearTimeout(timer)
      resolve(token)
    }

    // MutationObserver: fires as soon as the meta tag is injected
    const observer = new MutationObserver(() => {
      const token = extractCsrfToken()
      if (token) done(token)
    })
    observer.observe(document.head, { childList: true, subtree: true, attributes: true })

    // Polling fallback every 500ms (catches attribute mutations MutationObserver may miss)
    const poll = setInterval(() => {
      const token = extractCsrfToken()
      if (token) done(token)
    }, 500)

    // Timeout — give up and return null, falling back to nav approach
    const timer = setTimeout(() => done(null), timeoutMs)
  })
}

// ── Extract anti-CSRF token (synchronous, checks current DOM state) ───────────
// Primary location: <meta name="anti-csrftoken-a2z"> injected by Amazon's
// lazy /render XHR. Also checks a-state blocks and inline scripts as fallbacks.

function extractCsrfToken() {
  // Primary: meta tag injected by Amazon's lazy render response (confirmed 2025)
  const metaToken = document.querySelector('meta[name="anti-csrftoken-a2z"]')?.content
  if (metaToken && metaToken.length >= 10) return metaToken

  // Fallback: a-state JSON blobs
  for (const script of document.querySelectorAll('script[type="a-state"]')) {
    try {
      const data = JSON.parse(script.textContent)
      if (typeof data.csrfToken === 'string' && data.csrfToken.length >= 10) return data.csrfToken
      if (typeof data.lazyWidgetCsrfToken === 'string' && data.lazyWidgetCsrfToken.length >= 10) return data.lazyWidgetCsrfToken
    } catch {}
  }

  // Fallback: data attribute
  const elToken = document.querySelector('[data-anti-csrftoken-a2z]')?.getAttribute('data-anti-csrftoken-a2z')
  if (elToken && elToken.length >= 10) return elToken

  return null
}

// ── Helpers ───────────────────────────────────────────────────────

function nextStarFilter(current) {
  const idx = STAR_FILTERS.indexOf(current)
  return idx >= 0 && idx < STAR_FILTERS.length - 1 ? STAR_FILTERS[idx + 1] : null
}

function filterUrl(tld, asin, filter, page) {
  return `https://www.amazon.${tld}/product-reviews/${asin}?reviewerType=all_reviews&filterByStar=${filter}&sortBy=recent&pageNumber=${page}`
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function finish(jobId, asin, reviews) {
  chrome.runtime.sendMessage({ type: 'CONTENT_LOG', msg: `Done: ${reviews.length} unique reviews` })
  chrome.runtime.sendMessage({ type: 'REVIEWS_DONE', jobId, asin, reviews, amazonLoggedIn: true })
}

function isCaptchaOrLoginWall(doc) {
  const url = doc.location?.href || ''
  if (url.includes('/ap/signin') || url.includes('/gp/sign-in')) return true
  if (doc.querySelector('#captchacharacters, form[action*="/errors/validateCaptcha"]')) return true
  const signInForm = doc.querySelector('form[name="signIn"], #ap_signin_form, input[name="email"]')
  const reviewList = doc.querySelector('#cm_cr-review_list, [data-hook="review"]')
  if (signInForm && !reviewList) return true
  return false
}

function parseReviews(doc, asin, marketplace) {
  const reviews = []
  doc.querySelectorAll('[data-hook="review"]').forEach((el, i) => {
    try {
      // Prefer Amazon's canonical review ID (e.g. "R1ABC123XYZ") from the element id attribute.
      // Extract from title link href if absent. Never use Date.now() as a fallback — it generates
      // unique IDs per page load, defeating deduplication across navigations.
      let id = el.id || ''
      if (!id) {
        const href = el.querySelector('a[data-hook="review-title"]')?.getAttribute('href') || ''
        const m = href.match(/\/(R[A-Z0-9]{6,})/)
        if (m) id = m[1]
      }
      if (!id) id = `${asin}-idx-${i}`

      const ratingEl    = el.querySelector('i[data-hook="review-star-rating"], i[data-hook="cmps-review-star-rating"]')
      const ratingTitle = ratingEl?.querySelector('.a-icon-alt')?.textContent || ratingEl?.title || ''
      const ratingMatch = ratingTitle.match(/^([\d.]+)/)
      const rating      = ratingMatch ? Math.round(parseFloat(ratingMatch[1])) : 0
      if (rating < 1 || rating > 5) return

      // Direct child span to avoid capturing star-rating sibling text
      const titleEl = el.querySelector('[data-hook="review-title"] > span:not(.a-icon-alt)')
                   || el.querySelector('[data-hook="review-title"] > span')
      const title   = (titleEl?.textContent || '').trim()

      // textContent works on both live DOM and DOMParser documents; innerText requires a layout engine
      const bodyEl = el.querySelector('[data-hook="review-body"] span')
                  || el.querySelector('.review-text span')
                  || el.querySelector('.review-text')
      const body   = (bodyEl?.textContent || '').trim()
      if (body.length < 3) return

      const date     = (el.querySelector('[data-hook="review-date"]')?.textContent || '').trim()
      const verified = !!el.querySelector('[data-hook="avp-badge"]')
      const vine     = !!el.querySelector('[data-hook="vine-badge"]')

      const helpfulText  = el.querySelector('[data-hook="helpful-vote-statement"]')?.textContent || ''
      const helpfulMatch = helpfulText.match(/(\d[\d,]*)/)
      const helpful      = helpfulMatch ? parseInt(helpfulMatch[1].replace(/,/g, '')) : 0

      reviews.push({ id, rating, title, body, date, verified, vine, helpful,
                     country: marketplace.replace('amazon.', '') })
    } catch {}
  })
  return reviews
}
