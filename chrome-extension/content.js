// Voxrate Extension — Amazon Review Content Script
// Pagination strategy:
//   1. visibilitySpoofer.js (MAIN world, document_start) fools Amazon into
//      thinking the tab is always active, so its AJAX pagination JS runs.
//   2. For each page we try to click li.a-last (the Next button) and wait
//      for MutationObserver to detect the review list being replaced.
//   3. If no clickable Next button is present we fall back to URL navigation
//      using the constructed pageNumber URL.
//   Scrapes recent sort first, then helpful sort for additional reviews.

;(async () => {
  // ── Resume an in-progress scrape (page 2+) ──────────────────────
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
    console.log(`[Voxrate] Page ${state.page} (${state.sort}): ${batch.length} reviews, ${newOnes.length} new`)

    state.reviews.push(...newOnes)
    newOnes.forEach(r => state.seenIds.push(r.id))

    const reachedMax = state.reviews.length >= state.maxReviews || state.page >= 10
    const exhausted  = newOnes.length === 0

    if (reachedMax) {
      sessionStorage.removeItem('voxrate_job')
      finish(state.jobId, state.asin, state.reviews)
    } else if (exhausted && state.sort === 'recent' && !state.triedHelpful) {
      console.log(`[Voxrate] Recent sort exhausted (${state.reviews.length} reviews) — switching to helpful`)
      state.sort         = 'helpful'
      state.triedHelpful = true
      state.page         = 1
      sessionStorage.setItem('voxrate_job', JSON.stringify(state))
      const tld = state.marketplace.replace('amazon.', '')
      location.assign(`https://www.amazon.${tld}/product-reviews/${state.asin}?reviewerType=all_reviews&sortBy=helpful&pageNumber=1`)
    } else if (exhausted) {
      sessionStorage.removeItem('voxrate_job')
      finish(state.jobId, state.asin, state.reviews)
    } else {
      state.page++
      sessionStorage.setItem('voxrate_job', JSON.stringify(state))
      await advanceToNextPage(state)
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
  console.log(`[Voxrate] Page 1 (recent): ${page1.length} reviews`)

  if (page1.length === 0) {
    finish(jobId, asin, page1)
    return
  }

  const state = {
    jobId, asin, marketplace,
    maxReviews: max,
    reviews:    page1,
    seenIds:    page1.map(r => r.id),
    page:       2,
    sort:       'recent',
    triedHelpful: false,
  }
  sessionStorage.setItem('voxrate_job', JSON.stringify(state))
  await advanceToNextPage(state)
})()

// ── Pagination — click Next if available, else URL-navigate ──────

async function advanceToNextPage(state) {
  const nextEl = getNextElement()

  if (nextEl) {
    // Amazon's pagination JS is alive (visibilitySpoofer worked).
    // Click the real Next button and wait for the review list to be replaced.
    console.log(`[Voxrate] Clicking Next (page ${state.page})`)
    try {
      await clickAndWaitForReviews(nextEl)
      // After AJAX update the URL in the address bar also changes.
      // Re-parse the now-updated DOM without a navigation.
      // Re-enter the resume path by re-dispatching to ourselves synchronously.
      const batch   = parseReviews(document, state.asin, state.marketplace)
      const newOnes = batch.filter(r => !state.seenIds.includes(r.id))
      console.log(`[Voxrate] Page ${state.page} (${state.sort}) via click: ${batch.length} reviews, ${newOnes.length} new`)

      state.reviews.push(...newOnes)
      newOnes.forEach(r => state.seenIds.push(r.id))

      const reachedMax = state.reviews.length >= state.maxReviews || state.page >= 10
      const exhausted  = newOnes.length === 0

      if (reachedMax) {
        sessionStorage.removeItem('voxrate_job')
        finish(state.jobId, state.asin, state.reviews)
      } else if (exhausted && state.sort === 'recent' && !state.triedHelpful) {
        console.log(`[Voxrate] Recent sort exhausted (${state.reviews.length}) — switching to helpful`)
        state.sort         = 'helpful'
        state.triedHelpful = true
        state.page         = 1
        sessionStorage.setItem('voxrate_job', JSON.stringify(state))
        const tld = state.marketplace.replace('amazon.', '')
        location.assign(`https://www.amazon.${tld}/product-reviews/${state.asin}?reviewerType=all_reviews&sortBy=helpful&pageNumber=1`)
      } else if (exhausted) {
        sessionStorage.removeItem('voxrate_job')
        finish(state.jobId, state.asin, state.reviews)
      } else {
        state.page++
        sessionStorage.setItem('voxrate_job', JSON.stringify(state))
        await advanceToNextPage(state)
      }
    } catch (err) {
      // Click/MutationObserver timed out — fall back to URL navigation
      console.log(`[Voxrate] Click approach timed out (${err.message}), falling back to URL nav`)
      location.assign(buildPageUrl(state.asin, state.marketplace, state.page, state.sort))
    }
  } else {
    // No live Next button — use URL navigation (resume path handles parsing)
    const url = buildPageUrl(state.asin, state.marketplace, state.page, state.sort)
    console.log(`[Voxrate] URL navigate → ${url}`)
    location.assign(url)
  }
}

// Click the Next element and resolve when the review list DOM changes.
// Amazon replaces the #cm_cr-review_list content via innerHTML swap after click.
function clickAndWaitForReviews(nextEl) {
  return new Promise((resolve, reject) => {
    const reviewList = document.querySelector('#cm_cr-review_list, #cm-cr-dp-review-list, #cm-cr-global-review-list')
    if (!reviewList) {
      reject(new Error('review list container not found'))
      return
    }

    const timeout = setTimeout(() => {
      observer.disconnect()
      reject(new Error('MutationObserver timeout'))
    }, 15000)

    const observer = new MutationObserver(() => {
      // Any child mutation in the review list container signals a reload
      clearTimeout(timeout)
      observer.disconnect()
      // Brief pause to let Amazon finish rendering all review nodes
      setTimeout(resolve, 800)
    })

    observer.observe(reviewList, { childList: true, subtree: true })

    // Dispatch a real click in the page's main context via a synthetic MouseEvent
    nextEl.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
  })
}

// ── Helpers ───────────────────────────────────────────────────────

function buildPageUrl(asin, marketplace, page, sort) {
  const tld       = marketplace.replace('amazon.', '')
  const sortParam = sort === 'helpful' ? 'sortBy=helpful' : 'sortBy=recent'
  return `https://www.amazon.${tld}/product-reviews/${asin}/ref=cm_cr_arp_d_paging_btm_${page}?ie=UTF8&reviewerType=all_reviews&${sortParam}&pageNumber=${page}`
}

// Returns the clickable Next button element, or null if there is none.
function getNextElement() {
  // Standard paginated layout
  const traditional = document.querySelector('li.a-last:not(.a-disabled) a')
  if (traditional) return traditional

  // Single-page infinite-scroll style "show more" button
  const showMore = document.querySelector('a[data-hook="show-more-button"]:not([aria-disabled="true"])')
  if (showMore) return showMore

  return null
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
  const containers = doc.querySelectorAll(
    '[data-hook="review"], ' +
    '#cm-cr-dp-review-list > li[id], ' +
    '#cm-cr-global-review-list > li[id]'
  )
  containers.forEach((el, i) => {
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
