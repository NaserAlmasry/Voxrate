// Voxrate Extension — Amazon Review Content Script
// Auto-injected by manifest on amazon.*/product-reviews/* pages.
// Initiates contact with background — no "frame removed" errors possible.

;(async () => {
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

  if (!job) return // not a Voxrate scrape tab — do nothing

  const { id: jobId, asin, marketplace, maxReviews } = job

  if (isLoginWall(document)) {
    chrome.runtime.sendMessage({ type: 'AMAZON_NOT_LOGGED_IN', jobId })
    return
  }

  const allReviews = []
  const maxPages   = Math.ceil((maxReviews || 150) / 10)
  const tld        = marketplace.replace('amazon.', '')

  const page1 = parseReviews(document, asin, marketplace)
  console.log(`[Voxrate] Page 1: ${page1.length} reviews, hasNextPage=${hasNextPage(document)}`)
  allReviews.push(...page1)

  // Track currentDoc so hasNextPage checks the most recently fetched page
  let currentDoc  = document
  let pageNumber  = 1

  while (allReviews.length < (maxReviews || 150) && pageNumber < maxPages) {
    if (!hasNextPage(currentDoc)) {
      console.log(`[Voxrate] No next page at page ${pageNumber}, stopping`)
      break
    }

    pageNumber++
    const nextUrl = `https://www.amazon.${tld}/product-reviews/${asin}?pageNumber=${pageNumber}&reviewerType=all_reviews&sortBy=recent`
    console.log(`[Voxrate] Fetching page ${pageNumber}`)

    try {
      const html = await fetchPage(nextUrl)
      currentDoc  = new DOMParser().parseFromString(html, 'text/html')
      if (isLoginWall(currentDoc)) { console.log('[Voxrate] Login wall on page', pageNumber); break }
      const batch = parseReviews(currentDoc, asin, marketplace)
      console.log(`[Voxrate] Page ${pageNumber}: ${batch.length} reviews, hasNextPage=${hasNextPage(currentDoc)}`)
      if (batch.length === 0) break
      allReviews.push(...batch)
    } catch (e) {
      console.log(`[Voxrate] Fetch error page ${pageNumber}:`, e.message)
      break
    }
  }

  const seen    = new Set()
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
  // li.a-last WITHOUT a-disabled class means "Next" exists and is clickable
  const pagination = doc.querySelector(
    'li.a-last:not(.a-disabled) a, ' +
    '.a-pagination li.a-last:not(.a-disabled) a, ' +
    '[data-hook="pagination-bar"] li.a-last:not(.a-disabled) a'
  )
  return !!pagination
}

async function fetchPage(url) {
  const res = await fetch(url, {
    credentials: 'include',
    headers: {
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
    },
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.text()
}

function parseReviews(doc, asin, marketplace) {
  const reviews = []
  doc.querySelectorAll('[data-hook="review"]').forEach((el, i) => {
    try {
      const id = el.id || `${asin}-${Date.now()}-${i}`

      const ratingEl    = el.querySelector('i[data-hook="review-star-rating"], i[data-hook="cmps-review-star-rating"]')
      const ratingTitle = ratingEl?.querySelector('.a-icon-alt')?.textContent || ratingEl?.title || ''
      const ratingMatch = ratingTitle.match(/^([\d.]+)/)
      const rating      = ratingMatch ? Math.round(parseFloat(ratingMatch[1])) : 0
      if (rating < 1 || rating > 5) return

      const titleEl = el.querySelector('[data-hook="review-title"] span:not(.a-icon-alt)')
      const title   = titleEl?.textContent?.trim() || ''

      const bodyEl = el.querySelector('[data-hook="review-body"] span')
      const body   = bodyEl?.textContent?.trim() || ''
      if (body.length < 20) return

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
