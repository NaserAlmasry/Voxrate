// Voxrate Extension — Amazon Review Content Script
// Handles both Amazon pagination styles:
//   1. Traditional (pageNumber URL param) — navigate tab per page
//   2. AJAX "Show more reviews" button — click in-page

;(async () => {
  // ── Resume a navigation-based scrape (page 2+) ───────────────────
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
    bgLog(state.jobId, `Page ${state.page}: ${batch.length} reviews, ${newOnes.length} new`)

    state.reviews.push(...newOnes)
    newOnes.forEach(r => state.seenIds.push(r.id))

    const nextHref = getNextPageHref()
    const done = newOnes.length === 0
               || state.reviews.length >= state.maxReviews
               || state.page >= state.maxPages
               || !nextHref

    if (done) {
      sessionStorage.removeItem('voxrate_job')
      finish(state.jobId, state.asin, state.reviews)
    } else {
      state.page++
      sessionStorage.setItem('voxrate_job', JSON.stringify(state))
      location.assign(nextHref)
    }
    return
  }

  // ── First page — get job from background ─────────────────────────
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

  const page1    = parseReviews(document, asin, marketplace)
  const max      = maxReviews || 100
  const maxPages = Math.min(10, Math.ceil(max / 10))
  bgLog(jobId, `Page 1: ${page1.length} reviews`)

  if (page1.length === 0 || maxPages <= 1) {
    finish(jobId, asin, page1)
    return
  }

  // Detect pagination style
  const showMoreBtn = document.querySelector(
    '[data-hook="show-more-reviews-button"] a, ' +
    '[data-action="reviews:show-more-reviews"], ' +
    'a[data-hook="load-more-reviews"]'
  )

  if (showMoreBtn) {
    // ── AJAX "Show more" style ──────────────────────────────────────
    bgLog(jobId, 'Using AJAX show-more pagination')
    const allReviews = [...page1]
    const seenIds    = new Set(page1.map(r => r.id))

    let clicks = 0
    while (allReviews.length < max && clicks < 9) {
      const btn = document.querySelector(
        '[data-hook="show-more-reviews-button"] a, ' +
        '[data-action="reviews:show-more-reviews"], ' +
        'a[data-hook="load-more-reviews"]'
      )
      if (!btn) break

      const countBefore = document.querySelectorAll('[data-hook="review"]').length
      btn.click()
      clicks++

      // Wait for new reviews to appear in DOM (up to 8 seconds)
      const loaded = await waitForMoreReviews(countBefore, 8000)
      if (!loaded) { bgLog(jobId, 'Show-more timed out'); break }

      const batch   = parseReviews(document, asin, marketplace)
      const newOnes = batch.filter(r => !seenIds.has(r.id))
      bgLog(jobId, `Show-more click ${clicks}: ${newOnes.length} new`)
      if (newOnes.length === 0) break
      newOnes.forEach(r => { allReviews.push(r); seenIds.add(r.id) })
    }

    finish(jobId, asin, allReviews)
  } else {
    // ── Traditional URL pagination — follow Amazon's own Next link ──
    const nextHref = getNextPageHref()
    if (!nextHref) {
      bgLog(jobId, 'No next page link found — only 1 page')
      finish(jobId, asin, page1)
      return
    }
    bgLog(jobId, `Using URL pagination, next: ${nextHref}`)
    const state = {
      jobId, asin, marketplace,
      maxReviews: max, maxPages,
      reviews:  page1,
      seenIds:  page1.map(r => r.id),
      page: 2,
    }
    sessionStorage.setItem('voxrate_job', JSON.stringify(state))
    location.assign(nextHref)
  }
})()

// ── Helpers ───────────────────────────────────────────────────────

function getNextPageHref() {
  const el = document.querySelector(
    'li.a-last:not(.a-disabled) a, ' +
    '.a-pagination li.a-last:not(.a-disabled) a, ' +
    '[data-hook="pagination-bar"] li.a-last:not(.a-disabled) a'
  )
  if (!el) return null
  const href = el.getAttribute('href')
  if (!href) return null
  return href.startsWith('http') ? href : `https://www.amazon.com${href}`
}

function finish(jobId, asin, reviews) {
  bgLog(jobId, `Done: ${reviews.length} unique reviews collected`)
  chrome.runtime.sendMessage({
    type: 'REVIEWS_DONE',
    jobId, asin,
    reviews,
    amazonLoggedIn: true,
  })
}

function waitForMoreReviews(countBefore, timeout) {
  return new Promise((resolve) => {
    const start = Date.now()
    const check = setInterval(() => {
      const current = document.querySelectorAll('[data-hook="review"]').length
      if (current > countBefore) { clearInterval(check); resolve(true) }
      else if (Date.now() - start > timeout) { clearInterval(check); resolve(false) }
    }, 300)
  })
}

function bgLog(jobId, msg) {
  console.log(`[Voxrate] ${msg}`)
  chrome.runtime.sendMessage({ type: 'CONTENT_LOG', jobId, msg }).catch(() => {})
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

      const bodyEl = el.querySelector('[data-hook="review-body"] span')
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
    } catch {
      // skip malformed element
    }
  })
  return reviews
}
