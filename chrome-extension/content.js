// Voxrate Extension — Amazon Review Content Script
// Auto-injected by manifest on amazon.*/product-reviews/* pages.
// Initiates contact with background — background never messages us first,
// so "Frame with ID 0 was removed" errors are impossible.

;(async () => {
  // Ask background: "is there a job for this tab?"
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

  if (!job) return // this tab isn't a Voxrate scrape tab — do nothing

  const { id: jobId, asin, marketplace, maxReviews } = job

  // Check login wall
  if (isLoginWall(document)) {
    chrome.runtime.sendMessage({ type: 'AMAZON_NOT_LOGGED_IN', jobId })
    return
  }

  const allReviews = []
  const maxPages = Math.ceil((maxReviews || 150) / 10)
  const tld = marketplace.replace('amazon.', '')

  // Parse first page (already loaded)
  allReviews.push(...parseReviews(document, asin, marketplace))

  // Paginate through remaining pages
  let pageNumber = 1
  while (allReviews.length < (maxReviews || 150) && pageNumber < maxPages) {
    if (!hasNextPage(document)) break

    pageNumber++
    const nextUrl = `https://www.amazon.${tld}/product-reviews/${asin}?pageNumber=${pageNumber}&reviewerType=all_reviews&sortBy=recent`

    try {
      const html = await fetchPage(nextUrl)
      const doc = new DOMParser().parseFromString(html, 'text/html')
      if (isLoginWall(doc)) break
      const batch = parseReviews(doc, asin, marketplace)
      if (batch.length === 0) break
      allReviews.push(...batch)
    } catch {
      break
    }
  }

  // Deduplicate by ID
  const seen = new Set()
  const deduped = allReviews.filter(r => {
    if (seen.has(r.id)) return false
    seen.add(r.id)
    return true
  })

  chrome.runtime.sendMessage({
    type: 'REVIEWS_DONE',
    jobId,
    asin,
    reviews: deduped,
    amazonLoggedIn: true,
  })
})()

// ── Helpers ───────────────────────────────────────────────────────

function isLoginWall(doc) {
  const url = doc.location?.href || ''
  if (url.includes('/ap/signin') || url.includes('/gp/sign-in')) return true
  const signInForm = doc.querySelector('form[name="signIn"], #ap_signin_form, input[name="email"]')
  const reviewList = doc.querySelector('#cm_cr-review_list, [data-hook="review"]')
  if (signInForm && !reviewList) return true
  return false
}

function hasNextPage(doc) {
  return !!doc.querySelector('li.a-last a, [data-hook="pagination-bar"] .a-last a')
}

async function fetchPage(url) {
  const res = await fetch(url, { credentials: 'include' })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.text()
}

function parseReviews(doc, asin, marketplace) {
  const reviews = []
  doc.querySelectorAll('[data-hook="review"]').forEach((el, i) => {
    try {
      const id = el.id || `${asin}-${Date.now()}-${i}`

      const ratingEl = el.querySelector('i[data-hook="review-star-rating"], i[data-hook="cmps-review-star-rating"]')
      const ratingTitle = ratingEl?.querySelector('.a-icon-alt')?.textContent || ratingEl?.title || ''
      const ratingMatch = ratingTitle.match(/^([\d.]+)/)
      const rating = ratingMatch ? Math.round(parseFloat(ratingMatch[1])) : 0
      if (rating < 1 || rating > 5) return

      const titleEl = el.querySelector('[data-hook="review-title"] span:not(.a-icon-alt)')
      const title = titleEl?.textContent?.trim() || ''

      const bodyEl = el.querySelector('[data-hook="review-body"] span')
      const body = bodyEl?.textContent?.trim() || ''
      if (body.length < 20) return

      const dateEl = el.querySelector('[data-hook="review-date"]')
      const date = dateEl?.textContent?.trim() || ''

      const verified = !!el.querySelector('[data-hook="avp-badge"]')
      const vine = !!el.querySelector('[data-hook="vine-badge"]')

      const helpfulText = el.querySelector('[data-hook="helpful-vote-statement"]')?.textContent || ''
      const helpfulMatch = helpfulText.match(/(\d[\d,]*)/)
      const helpful = helpfulMatch ? parseInt(helpfulMatch[1].replace(/,/g, '')) : 0

      const country = marketplace.replace('amazon.', '')

      reviews.push({ id, rating, title, body, date, verified, vine, helpful, country })
    } catch {
      // skip malformed element
    }
  })
  return reviews
}
