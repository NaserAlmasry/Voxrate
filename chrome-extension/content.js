// Voxrate Extension — Amazon Review Content Script
// Uses Amazon's internal AJAX endpoint directly — same call the Next button makes.
// No tab navigation needed: runs entirely on page 1.

;(async () => {
  // Clear any stale sessionStorage from previous navigation-based approach
  sessionStorage.removeItem('voxrate_job')

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
  const maxPages = Math.min(10, Math.ceil(max / 10))
  const tld      = marketplace.replace('amazon.', '')

  const allReviews = []
  const seenIds    = new Set()

  // Page 1 — already loaded in tab
  const page1 = parseReviews(document, asin, marketplace)
  page1.forEach(r => { allReviews.push(r); seenIds.add(r.id) })
  bgLog(jobId, `Page 1: ${page1.length} reviews`)

  // Pages 2+ — call Amazon's AJAX endpoint directly
  for (let page = 2; page <= maxPages && allReviews.length < max; page++) {
    try {
      const html = await fetchReviewPage(tld, asin, page, 'recent')
      const doc  = new DOMParser().parseFromString(html, 'text/html')

      if (isLoginWall(doc)) { bgLog(jobId, 'Login wall'); break }

      const batch   = parseReviews(doc, asin, marketplace)
      const newOnes = batch.filter(r => !seenIds.has(r.id))
      bgLog(jobId, `Page ${page} (recent): ${batch.length} reviews, ${newOnes.length} new`)

      if (newOnes.length === 0) break
      newOnes.forEach(r => { allReviews.push(r); seenIds.add(r.id) })
    } catch (e) {
      bgLog(jobId, `Page ${page} error: ${e.message}`)
      break
    }
  }

  // If still need more, try helpful sort (surfaces older highly-voted reviews)
  if (allReviews.length < max) {
    bgLog(jobId, `Switching to helpful sort (have ${allReviews.length} so far)`)
    for (let page = 1; page <= maxPages && allReviews.length < max; page++) {
      try {
        const html = await fetchReviewPage(tld, asin, page, 'helpful')
        const doc  = new DOMParser().parseFromString(html, 'text/html')

        if (isLoginWall(doc)) break

        const batch   = parseReviews(doc, asin, marketplace)
        const newOnes = batch.filter(r => !seenIds.has(r.id))
        bgLog(jobId, `Page ${page} (helpful): ${batch.length} reviews, ${newOnes.length} new`)

        if (newOnes.length === 0) break
        newOnes.forEach(r => { allReviews.push(r); seenIds.add(r.id) })
      } catch (e) {
        bgLog(jobId, `Helpful page ${page} error: ${e.message}`)
        break
      }
    }
  }

  bgLog(jobId, `Done: ${allReviews.length} unique reviews`)
  chrome.runtime.sendMessage({
    type: 'REVIEWS_DONE',
    jobId, asin,
    reviews: allReviews,
    amazonLoggedIn: true,
  })
})()

// ── Helpers ───────────────────────────────────────────────────────

function getCsrfToken() {
  const match = document.cookie.match(/anti-csrftoken-a2z=([^;]+)/)
  return match ? decodeURIComponent(match[1]) : ''
}

async function fetchReviewPage(tld, asin, pageNumber, sortBy) {
  const res = await fetch(`https://www.amazon.${tld}/hz/reviews-render/ajax/reviews/get/`, {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
      'X-Requested-With': 'XMLHttpRequest',
      'anti-csrftoken-a2z': getCsrfToken(),
    },
    body: new URLSearchParams({
      asin,
      pageNumber: String(pageNumber),
      pageSize: '10',
      reviewerType: 'all_reviews',
      sortBy,
      shouldAppend: 'undefined',
      reftag: `cm_cr_arp_d_paging_btm_next_${pageNumber}`,
      deviceType: 'desktop',
    }),
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.text()
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
    } catch { }
  })
  return reviews
}
