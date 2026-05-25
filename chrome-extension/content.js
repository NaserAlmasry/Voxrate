// Voxrate Extension — Amazon Review Content Script
// Strategy: stay on page 1, use AJAX POST for all subsequent pages.
// Extracts anti-CSRF token from inline scripts, then loops through
// star filters via /hz/reviews-render/ajax/reviews/get/ — no navigation needed.

const STAR_FILTERS = ['five_star', 'four_star', 'three_star', 'two_star', 'one_star']

;(async () => {
  // ── Resume path: navigation fallback (only if AJAX unavailable) ──
  const saved = sessionStorage.getItem('voxrate_job')
  if (saved) {
    let state
    try { state = JSON.parse(saved) } catch { sessionStorage.removeItem('voxrate_job'); return }

    if (isLoginWall(document)) {
      sessionStorage.removeItem('voxrate_job')
      chrome.runtime.sendMessage({ type: 'AMAZON_NOT_LOGGED_IN', jobId: state.jobId })
      return
    }

    const batch   = parseReviews(document, state.asin, state.marketplace)
    const newOnes = batch.filter(r => !state.seenIds.includes(r.id))
    chrome.runtime.sendMessage({ type: 'CONTENT_LOG', msg: `Nav fallback ${state.currentFilter} p${state.currentPage}: ${newOnes.length} new` })

    state.reviews.push(...newOnes)
    newOnes.forEach(r => state.seenIds.push(r.id))

    const noMore  = newOnes.length === 0 || state.currentPage >= 10
    const tld     = state.marketplace.replace('amazon.', '')

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

  if (isLoginWall(document)) {
    chrome.runtime.sendMessage({ type: 'AMAZON_NOT_LOGGED_IN', jobId })
    return
  }

  const max      = maxReviews || 100
  const csrfToken = extractCsrfToken()
  const tld       = marketplace.replace('amazon.', '')

  chrome.runtime.sendMessage({ type: 'CONTENT_LOG', msg: `csrfToken found: ${!!csrfToken}` })

  if (!csrfToken) {
    // No CSRF token — fall back to navigation approach
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

  // ── AJAX path — collect all reviews without navigating ──────────
  const allReviews = []
  const seenIds    = new Set()

  // Parse page 1 (all reviews, already loaded)
  const page1 = parseReviews(document, asin, marketplace)
  page1.forEach(r => { allReviews.push(r); seenIds.add(r.id) })
  chrome.runtime.sendMessage({ type: 'CONTENT_LOG', msg: `Page 1 (all): ${page1.length} reviews` })

  for (const filter of STAR_FILTERS) {
    if (allReviews.length >= max) break

    let page          = 1
    let nextPageToken = null

    while (page <= 10 && allReviews.length < max) {
      let html
      try {
        html = await fetchReviewsViaAjax(asin, tld, filter, page, nextPageToken, csrfToken)
      } catch (err) {
        chrome.runtime.sendMessage({ type: 'CONTENT_LOG', msg: `AJAX error ${filter} p${page}: ${err.message}` })
        break
      }

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

// ── AJAX call to Amazon's internal reviews endpoint ───────────────

async function fetchReviewsViaAjax(asin, tld, filter, page, nextPageToken, csrfToken) {
  const body = new URLSearchParams({
    sortBy:           'recent',
    reviewerType:     'all_reviews',
    formatType:       'current_format',
    mediaType:        'all_reviews',
    filterByStar:     filter,
    pageNumber:       String(page),
    deviceType:       'desktop',
    shouldAppend:     'false',
    canShowIntHeader: 'false',
    scope:            'reviewsAjax1',
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
    },
    body: body.toString(),
  })

  if (!res.ok) throw new Error(`HTTP ${res.status}`)

  const text = await res.text()

  // Turbo format: &&&\n[...JSON chunks...]\n&&&
  // Each chunk may have an "html" field with the reviews HTML
  const chunks = []
  const re = /"html"\s*:\s*"((?:[^"\\]|\\.)*)"/gs
  let m
  while ((m = re.exec(text)) !== null) {
    try { chunks.push(JSON.parse(`"${m[1]}"`) ) } catch {}
  }
  return chunks.length > 0 ? chunks.join('') : text
}

// ── Extract nextPageToken from show-more button ───────────────────

function extractNextPageTokenFromDoc(doc) {
  const btn = doc.querySelector('a[data-hook="show-more-button"], [data-hook="pagination-bar"] a.a-last')
  if (!btn) return null
  try {
    const params = JSON.parse(btn.getAttribute('data-reviews-state-param') || '{}')
    return params.nextPageToken || null
  } catch { return null }
}

// ── Extract anti-CSRF token from inline scripts ───────────────────

function extractCsrfToken() {
  for (const script of document.querySelectorAll('script:not([src])')) {
    const m = script.textContent.match(/"anti-csrftoken-a2z"\s*:\s*"([^"]{10,})"/)
    if (m) return m[1]
  }
  const el = document.querySelector('[data-anti-csrftoken-a2z]')
  if (el) return el.getAttribute('data-anti-csrftoken-a2z')
  const cm = document.cookie.match(/anti-csrftoken-a2z=([^;]{10,})/)
  if (cm) return decodeURIComponent(cm[1])
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

function finish(jobId, asin, reviews) {
  chrome.runtime.sendMessage({ type: 'CONTENT_LOG', msg: `Done: ${reviews.length} unique reviews` })
  chrome.runtime.sendMessage({ type: 'REVIEWS_DONE', jobId, asin, reviews, amazonLoggedIn: true })
}

function isLoginWall(doc) {
  const url = doc.location?.href || ''
  if (url.includes('/ap/signin') || url.includes('/gp/sign-in')) return true
  const signInForm = doc.querySelector('form[name="signIn"], #ap_signin_form, input[name="email"]')
  const reviewList = doc.querySelector('#cm_cr-review_list, [data-hook="review"]')
  if (signInForm && !reviewList) return true
  return false
}

function parseReviews(doc, asin, marketplace) {
  const reviews = []
  doc.querySelectorAll('[data-hook="review"]').forEach((el, i) => {
    try {
      const id = el.id || `${asin}-${Date.now()}-${i}`

      const ratingEl    = el.querySelector('i[data-hook="review-star-rating"], i[data-hook="cmps-review-star-rating"]')
      const ratingTitle = ratingEl?.querySelector('.a-icon-alt')?.innerText
                       || ratingEl?.querySelector('.a-icon-alt')?.textContent
                       || ratingEl?.title || ''
      const ratingMatch = ratingTitle.match(/^([\d.]+)/)
      const rating      = ratingMatch ? Math.round(parseFloat(ratingMatch[1])) : 0
      if (rating < 1 || rating > 5) return

      const titleEl = el.querySelector('[data-hook="review-title"] > span:not([class]), [data-hook="review-title"] span:not(.a-icon-alt)')
      const title   = (titleEl?.innerText || titleEl?.textContent || '').trim()

      const bodyEl = el.querySelector('[data-hook="review-body"] span, .review-text span, .review-text')
      const body   = (bodyEl?.innerText || bodyEl?.textContent || '').trim()
      if (body.length < 3) return

      const dateEl = el.querySelector('[data-hook="review-date"]')
      const date   = (dateEl?.textContent || '').trim()

      const verified = !!el.querySelector('[data-hook="avp-badge"]')
      const vine     = !!el.querySelector('[data-hook="vine-badge"]')

      const helpfulText  = el.querySelector('[data-hook="helpful-vote-statement"]')?.textContent || ''
      const helpfulMatch = helpfulText.match(/(\d[\d,]*)/)
      const helpful      = helpfulMatch ? parseInt(helpfulMatch[1].replace(/,/g, '')) : 0

      const country = marketplace.replace('amazon.', '')

      reviews.push({ id, rating, title, body, date, verified, vine, helpful, country })
    } catch { }
  })
  return reviews
}
