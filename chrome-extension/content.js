// Voxrate Extension — Amazon Review Content Script

const STAR_FILTERS = ['five_star', 'four_star', 'three_star', 'two_star', 'one_star']

;(async () => {
  // ── Resume a filter-based scrape (filter 2+) ────────────────────
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
    console.log(`[Voxrate] Filter ${state.currentFilter}: ${batch.length} reviews, ${newOnes.length} new`)

    state.reviews.push(...newOnes)
    newOnes.forEach(r => state.seenIds.push(r.id))

    const nextFilter = nextStarFilter(state.currentFilter)
    const reachedMax = state.reviews.length >= state.maxReviews

    if (reachedMax || !nextFilter) {
      sessionStorage.removeItem('voxrate_job')
      finish(state.jobId, state.asin, state.reviews)
    } else {
      state.currentFilter = nextFilter
      sessionStorage.setItem('voxrate_job', JSON.stringify(state))
      const tld = state.marketplace.replace('amazon.', '')
      location.assign(filterUrl(tld, state.asin, nextFilter))
    }
    return
  }

  // ── First page — get job from background ────────────────────────
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

  const page1 = parseReviews(document, asin, marketplace)
  const max   = maxReviews || 100
  console.log(`[Voxrate] All-reviews page 1: ${page1.length} reviews`)

  const state = {
    jobId, asin, marketplace,
    maxReviews:    max,
    reviews:       page1,
    seenIds:       page1.map(r => r.id),
    currentFilter: 'five_star',
  }

  sessionStorage.setItem('voxrate_job', JSON.stringify(state))
  const tld = marketplace.replace('amazon.', '')
  location.assign(filterUrl(tld, asin, 'five_star'))
})()

// ── Helpers ───────────────────────────────────────────────────────

function nextStarFilter(current) {
  const idx = STAR_FILTERS.indexOf(current)
  return idx >= 0 && idx < STAR_FILTERS.length - 1 ? STAR_FILTERS[idx + 1] : null
}

function filterUrl(tld, asin, filter) {
  return `https://www.amazon.${tld}/product-reviews/${asin}?reviewerType=all_reviews&filterByStar=${filter}&sortBy=recent`
}

function finish(jobId, asin, reviews) {
  console.log(`[Voxrate] Done: ${reviews.length} unique reviews`)
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
      const date   = dateEl?.textContent?.trim() || ''

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
