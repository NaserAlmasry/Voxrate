// Voxrate Extension — Amazon Review Content Script
// Navigation-only approach: no AJAX calls, no internal Amazon endpoints.
// The extension navigates through review pages like a human — full page loads
// with random delays. Amazon cannot distinguish this from normal browsing.

const STAR_FILTERS = ['one_star', 'two_star', 'five_star', 'four_star', 'three_star']

;(async () => {
  // ── Resume path: already mid-collection ─────────────────────────
  const saved = sessionStorage.getItem('voxrate_job')
  if (saved) {
    await runResumePath(saved)
    return
  }

  // ── First load: pick up job from background ──────────────────────
  let job = null
  try {
    job = await new Promise((resolve) => {
      chrome.runtime.sendMessage({ type: 'CONTENT_READY', url: location.href }, (res) => {
        if (chrome.runtime.lastError) resolve(null)
        else resolve(res?.job || null)
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

  // Collect whatever is already on the page (unfiltered first page)
  const page1 = parseReviews(document, asin, marketplace)
  chrome.runtime.sendMessage({ type: 'CONTENT_LOG', msg: `Start: ${page1.length} reviews on first page` })

  const state = {
    jobId, asin, marketplace,
    maxReviews: maxReviews || 500,
    reviews:    page1,
    seenIds:    page1.map(r => r.id),
    filterIdx:  0,
    page:       1,
  }

  sessionStorage.setItem('voxrate_job', JSON.stringify(state))

  // Human pause before starting filter navigation (simulate reading the page)
  await sleep(jitter(2500, 5000))
  location.assign(reviewUrl(tld, asin, STAR_FILTERS[0], 1))
})()

// ── Resume: called on every subsequent page load ─────────────────

async function runResumePath(saved) {
  let state
  try { state = JSON.parse(saved) } catch {
    sessionStorage.removeItem('voxrate_job')
    return
  }

  const { jobId, asin, marketplace } = state
  const tld = marketplace.replace('amazon.', '')

  if (isCaptchaOrLoginWall(document)) {
    sessionStorage.removeItem('voxrate_job')
    chrome.runtime.sendMessage({ type: 'AMAZON_NOT_LOGGED_IN', jobId })
    return
  }

  // Detect Amazon's "limited selection" throttle
  if (isThrottled(document)) {
    state.throttleCount = (state.throttleCount ?? 0) + 1
    chrome.runtime.sendMessage({ type: 'CONTENT_LOG', msg: `Throttle detected (${state.throttleCount}) — filter ${STAR_FILTERS[state.filterIdx]} p${state.page}` })
    if (state.throttleCount >= 2) {
      sessionStorage.removeItem('voxrate_job')
      finish(jobId, asin, state.reviews, true)
      return
    }
    // Back off: skip to next filter
    state.filterIdx++
    state.page = 1
    state.throttleCount = 0
    if (state.filterIdx >= STAR_FILTERS.length || state.reviews.length >= state.maxReviews) {
      sessionStorage.removeItem('voxrate_job')
      finish(jobId, asin, state.reviews, true)
      return
    }
    sessionStorage.setItem('voxrate_job', JSON.stringify(state))
    await sleep(jitter(5000, 10000))
    location.assign(reviewUrl(tld, asin, STAR_FILTERS[state.filterIdx], 1))
    return
  }

  state.throttleCount = 0

  const batch   = parseReviews(document, asin, marketplace)
  const newOnes = batch.filter(r => !state.seenIds.includes(r.id))

  state.reviews.push(...newOnes)
  newOnes.forEach(r => state.seenIds.push(r.id))

  const filter = STAR_FILTERS[state.filterIdx]
  chrome.runtime.sendMessage({ type: 'CONTENT_LOG', msg: `${filter} p${state.page}: ${newOnes.length} new (total ${state.reviews.length})` })

  // Decide next step
  const done       = state.reviews.length >= state.maxReviews
  const exhausted  = newOnes.length === 0
  const maxPages   = 20 // ~200 reviews per filter at 10/page

  if (done) {
    sessionStorage.removeItem('voxrate_job')
    finish(jobId, asin, state.reviews, false)
    return
  }

  if (exhausted || state.page >= maxPages) {
    // Move to next star filter
    state.filterIdx++
    state.page = 1
    if (state.filterIdx >= STAR_FILTERS.length) {
      sessionStorage.removeItem('voxrate_job')
      finish(jobId, asin, state.reviews, false)
      return
    }
    sessionStorage.setItem('voxrate_job', JSON.stringify(state))
    // Longer pause between filters — humans don't instantly click the next filter
    await sleep(jitter(3000, 7000))
    location.assign(reviewUrl(tld, asin, STAR_FILTERS[state.filterIdx], 1))
    return
  }

  // Next page of same filter
  state.page++
  sessionStorage.setItem('voxrate_job', JSON.stringify(state))
  // Pause that mimics a human reading through the page before clicking Next
  await sleep(jitter(2500, 5500))
  location.assign(reviewUrl(tld, asin, filter, state.page))
}

// ── Helpers ───────────────────────────────────────────────────────

function reviewUrl(tld, asin, filter, page) {
  return `https://www.amazon.${tld}/product-reviews/${asin}?reviewerType=all_reviews&filterByStar=${filter}&sortBy=recent&pageNumber=${page}`
}

function jitter(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)) }

function finish(jobId, asin, reviews, wasThrottled) {
  chrome.runtime.sendMessage({ type: 'CONTENT_LOG', msg: `Done: ${reviews.length} reviews${wasThrottled ? ' (throttled)' : ''}` })
  chrome.runtime.sendMessage({ type: 'REVIEWS_DONE', jobId, asin, reviews, amazonLoggedIn: true, wasThrottled })
}

function isThrottled(doc) {
  const text = (doc.body?.textContent || '').toLowerCase()
  return text.includes('limited selection of reviews') ||
         text.includes('to see more reviews, you can send a request')
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

      const titleEl = el.querySelector('[data-hook="review-title"] > span:not(.a-icon-alt)')
                   || el.querySelector('[data-hook="review-title"] > span')
      const title   = (titleEl?.textContent || '').trim()

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
