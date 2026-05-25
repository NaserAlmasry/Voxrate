// Voxrate Extension — Amazon Review Content Script
// Auto-injected by manifest on amazon.*/product-reviews/* pages.
// Uses real tab navigation (not fetch) so Amazon can't detect programmatic requests.

;(async () => {
  // ── Resume an in-progress scrape (page 2+) ───────────────────────
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

    const done = newOnes.length === 0
               || state.reviews.length >= state.maxReviews
               || state.page >= state.maxPages

    if (done) {
      sessionStorage.removeItem('voxrate_job')
      bgLog(state.jobId, `Done: ${state.reviews.length} unique reviews collected`)
      chrome.runtime.sendMessage({
        type: 'REVIEWS_DONE',
        jobId: state.jobId,
        asin:  state.asin,
        reviews: state.reviews,
        amazonLoggedIn: true,
      })
    } else {
      state.page++
      sessionStorage.setItem('voxrate_job', JSON.stringify(state))
      const tld     = state.marketplace.replace('amazon.', '')
      const nextUrl = `https://www.amazon.${tld}/product-reviews/${state.asin}/ref=cm_cr_arp_d_paging_btm_next_${state.page}?ie=UTF8&reviewerType=all_reviews&sortBy=recent&pageNumber=${state.page}`
      location.assign(nextUrl)
    }
    return
  }

  // ── First page — ask background for a job ────────────────────────
  let job = null
  try {
    const response = await new Promise((resolve) => {
      chrome.runtime.sendMessage({ type: 'CONTENT_READY', url: location.href }, (res) => {
        if (chrome.runtime.lastError) resolve(null)
        else resolve(res)
      })
    })
    job = response?.job || null
  } catch {
    return
  }

  if (!job) return

  const { id: jobId, asin, marketplace, maxReviews } = job

  if (isLoginWall(document)) {
    chrome.runtime.sendMessage({ type: 'AMAZON_NOT_LOGGED_IN', jobId })
    return
  }

  const page1   = parseReviews(document, asin, marketplace)
  const maxPages = Math.min(10, Math.ceil((maxReviews || 100) / 10))
  bgLog(jobId, `Page 1: ${page1.length} reviews`)

  const canContinue = page1.length >= 10 && maxPages > 1

  if (!canContinue) {
    bgLog(jobId, `Done: ${page1.length} unique reviews collected`)
    chrome.runtime.sendMessage({
      type: 'REVIEWS_DONE',
      jobId,
      asin,
      reviews: page1,
      amazonLoggedIn: true,
    })
    return
  }

  // Save state and navigate to page 2
  const state = {
    jobId,
    asin,
    marketplace,
    maxReviews: maxReviews || 150,
    maxPages,
    reviews:  page1,
    seenIds:  page1.map(r => r.id),
    page: 2,
  }
  sessionStorage.setItem('voxrate_job', JSON.stringify(state))
  const tld     = marketplace.replace('amazon.', '')
  const nextUrl = `https://www.amazon.${tld}/product-reviews/${asin}/ref=cm_cr_arp_d_paging_btm_next_2?ie=UTF8&reviewerType=all_reviews&sortBy=recent&pageNumber=2`
  location.assign(nextUrl)
})()

// ── Helpers ───────────────────────────────────────────────────────

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
      const title   = titleEl?.innerText?.trim() || titleEl?.textContent?.trim() || ''

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
