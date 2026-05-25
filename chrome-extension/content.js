// Voxrate Extension — Amazon Review Content Script
// Injected into hidden Amazon review tabs to parse and return all reviews.

;(async () => {
  // Wait for START_SCRAPE message from background.js
  const config = await new Promise((resolve) => {
    chrome.runtime.onMessage.addListener(function handler(msg) {
      if (msg.type === 'START_SCRAPE') {
        chrome.runtime.onMessage.removeListener(handler)
        resolve(msg)
      }
    })
  })

  const { jobId, asin, marketplace, maxReviews } = config

  // Check if Amazon is showing a login wall
  if (isLoginWall()) {
    chrome.runtime.sendMessage({ type: 'AMAZON_NOT_LOGGED_IN', jobId })
    return
  }

  const allReviews = []
  let pageNumber = 1
  const tld = marketplace.replace('amazon.', '')
  const maxPages = Math.ceil(maxReviews / 10)

  // Parse first page (already loaded)
  const firstPageReviews = parseReviews(document, asin, marketplace)
  allReviews.push(...firstPageReviews)

  // Paginate through remaining pages
  while (allReviews.length < maxReviews && pageNumber < maxPages) {
    const hasNext = hasNextPage(document)
    if (!hasNext) break

    pageNumber++
    const nextUrl = buildReviewUrl(asin, tld, pageNumber)

    try {
      const html = await fetchPage(nextUrl)
      const doc = new DOMParser().parseFromString(html, 'text/html')

      if (isLoginWallDoc(doc)) {
        // Hit login wall mid-pagination — return what we have
        break
      }

      const pageReviews = parseReviews(doc, asin, marketplace)
      if (pageReviews.length === 0) break
      allReviews.push(...pageReviews)
    } catch (e) {
      console.warn('[Voxrate] Page fetch error:', e)
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

function isLoginWall() {
  return isLoginWallDoc(document)
}

function isLoginWallDoc(doc) {
  // Amazon redirects to sign-in page or shows an auth overlay
  const url = doc.location?.href || ''
  if (url.includes('/ap/signin') || url.includes('/gp/sign-in')) return true
  const body = doc.body?.innerText || ''
  if (body.includes('Sign in to see reviews') || body.includes('Sign in to filter reviews')) return true
  // Check for the reviews container — if absent, we're on the wrong page
  const reviewsContainer = doc.querySelector('#cm_cr-review_list, [data-hook="review"]')
  const signInForm = doc.querySelector('form[name="signIn"], #ap_signin_form, input[name="email"]')
  if (signInForm && !reviewsContainer) return true
  return false
}

function hasNextPage(doc) {
  // Look for "Next page" pagination link
  const nextBtn = doc.querySelector('li.a-last a, [data-hook="pagination-bar"] .a-last a')
  if (nextBtn) return true
  // Alternative: look for the next page link by text
  const links = Array.from(doc.querySelectorAll('a'))
  return links.some(a => /next page/i.test(a.textContent || ''))
}

function buildReviewUrl(asin, tld, pageNumber) {
  return `https://www.amazon.${tld}/product-reviews/${asin}?pageNumber=${pageNumber}&reviewerType=all_reviews&sortBy=recent`
}

async function fetchPage(url) {
  const res = await fetch(url, { credentials: 'include' })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.text()
}

function parseReviews(doc, asin, marketplace) {
  const reviewEls = doc.querySelectorAll('[data-hook="review"]')
  const reviews = []

  reviewEls.forEach((el, i) => {
    try {
      const id = el.id || `${asin}-${Date.now()}-${i}`

      // Rating: "4.0 out of 5 stars"
      const ratingEl = el.querySelector('i[data-hook="review-star-rating"], i[data-hook="cmps-review-star-rating"]')
      const ratingTitle = ratingEl?.querySelector('.a-icon-alt')?.textContent || ratingEl?.title || ''
      const ratingMatch = ratingTitle.match(/^([\d.]+)/)
      const rating = ratingMatch ? Math.round(parseFloat(ratingMatch[1])) : 0
      if (rating < 1 || rating > 5) return

      // Title
      const titleEl = el.querySelector('[data-hook="review-title"] span:not(.a-icon-alt)')
      const title = titleEl?.textContent?.trim() || ''

      // Body
      const bodyEl = el.querySelector('[data-hook="review-body"] span')
      const body = bodyEl?.textContent?.trim() || ''
      if (body.length < 20) return // too short to be useful

      // Date
      const dateEl = el.querySelector('[data-hook="review-date"]')
      const date = dateEl?.textContent?.trim() || ''

      // Verified purchase
      const verifiedEl = el.querySelector('[data-hook="avp-badge"]')
      const verified = !!verifiedEl

      // Vine
      const vineEl = el.querySelector('[data-hook="vine-badge"]')
      const vine = !!vineEl

      // Helpful votes: "X people found this helpful"
      const helpfulEl = el.querySelector('[data-hook="helpful-vote-statement"]')
      const helpfulText = helpfulEl?.textContent || ''
      const helpfulMatch = helpfulText.match(/(\d[\d,]*)/)
      const helpful = helpfulMatch ? parseInt(helpfulMatch[1].replace(/,/g, '')) : 0

      // Country from domain
      const country = marketplace.replace('amazon.', '')

      reviews.push({ id, rating, title, body, date, verified, vine, helpful, country })
    } catch (e) {
      // skip malformed review element
    }
  })

  return reviews
}
