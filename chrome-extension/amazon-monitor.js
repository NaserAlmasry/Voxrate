// Voxrate Amazon Monitor — Velocity Tracker + Snapshot
// Only sends data when velocity_active is enabled by the user in popup.
// Sends CONTENT_SNAPSHOT always (needed for overlay) if overlay_active.
// Sends REVIEW_VELOCITY only when velocity_active.

;(function () {
  'use strict'

  // URL-based page detection is faster and more reliable than DOM parsing
  const url = window.location.href
  const asinMatch = url.match(/\/(?:dp|gp\/product)\/([A-Z0-9]{10})/i)
  if (!asinMatch) return

  const asin = asinMatch[1].toUpperCase()
  const host = window.location.hostname
  const marketplace = host.replace('www.', '')

  // ── Parsers ───────────────────────────────────────────────────────

  function getText(selector) {
    const el = document.querySelector(selector)
    return el ? el.textContent.trim() : null
  }

  function parsePrice() {
    // Method 1: whole + fraction
    const whole = getText('.a-price-whole')
    const fraction = getText('.a-price-fraction')
    if (whole) {
      const raw = whole.replace(/[^0-9]/g, '') + '.' + (fraction || '00')
      const parsed = parseFloat(raw)
      return isNaN(parsed) ? null : parsed
    }
    // Method 2: offscreen (best fallback — always present even on sale items)
    const offscreen = document.querySelector('.a-offscreen')
    if (offscreen) {
      const match = offscreen.textContent.match(/[\d,.]+/)
      if (match) {
        const parsed = parseFloat(match[0].replace(/,/g, ''))
        return isNaN(parsed) ? null : parsed
      }
    }
    return null
  }

  function parseTitle() {
    // data-hook based selectors survive redesigns longer than class names
    return getText('#productTitle') || getText('#title') || null
  }

  function parseBullets() {
    const bullets = []
    document.querySelectorAll('#feature-bullets li span.a-list-item').forEach(el => {
      const text = el.textContent.trim()
      if (text) bullets.push(text)
    })
    return bullets.length > 0 ? bullets : null
  }

  function parseMainImage() {
    const img = document.querySelector('#landingImage, #imgBlkFront, #main-image')
    return img ? (img.getAttribute('data-old-hires') || img.getAttribute('src') || null) : null
  }

  function parseBuyBoxSeller() {
    const soldBy = document.querySelector('#sellerProfileTriggerId, #merchant-info a')
    if (soldBy) return soldBy.textContent.trim() || null
    const buybox = document.querySelector('#tabular-buybox .tabular-buybox-text')
    if (buybox) return buybox.textContent.trim() || null
    return null
  }

  function parseReviewCount() {
    // Multiple fallbacks — Amazon A/B tests these selectors frequently
    const selectors = [
      '#acrCustomerReviewText',
      '#customerReviews .a-size-base',
      '[data-hook="total-review-count"]',
      '#averageCustomerReviews span[data-hook="total-review-count"]',
    ]
    for (const sel of selectors) {
      const el = document.querySelector(sel)
      if (el) {
        const match = el.textContent.match(/([\d,]+)/)
        if (match) return parseInt(match[1].replace(/,/g, ''), 10)
      }
    }
    return null
  }

  function parseAverageRating() {
    const selectors = [
      '#acrPopover .a-icon-alt',
      '#averageCustomerReviews .a-icon-alt',
      '[data-hook="rating-out-of-text"]',
    ]
    for (const sel of selectors) {
      const el = document.querySelector(sel)
      if (el) {
        const match = el.textContent.match(/([\d.]+)/)
        if (match) return parseFloat(match[1])
      }
    }
    return null
  }

  function parseIsSuppressed() {
    // Scope to buy-box / availability node to avoid false positives from widgets
    const availNode = document.getElementById('availability') ||
                      document.getElementById('outOfStock') ||
                      document.getElementById('buy-now-button')?.closest('form') ||
                      document.getElementById('productSupportAndReturnPolicy_feature_div')
    const searchNode = availNode || document.getElementById('ppd') || document.body
    const suppressionTexts = [
      'This listing is currently unavailable',
      "We're sorry. This item is not available",
      'Currently unavailable',
      'This item cannot be displayed',
    ]
    const text = searchNode.textContent
    return suppressionTexts.some(t => text.includes(t))
  }

  function parseStarCounts() {
    const counts = { one_star: 0, two_star: 0, three_star: 0, four_star: 0, five_star: 0 }
    const total = parseReviewCount() || 0
    if (total === 0) return counts

    // Primary: data-hook based rating list (most stable across redesigns)
    const items = document.querySelectorAll('[data-hook="rating-count-list"] li, #histogramTable tr')
    if (items.length === 0) return counts

    items.forEach((li) => {
      // Detect which star tier this row represents from its own anchor title attribute
      // (e.g. "2 stars represent 12% of rating")  — immune to positional shifts on redesigns
      const anchor = li.querySelector('a[title]')
      const titleText = anchor?.getAttribute('title') || ''
      const starMatch = titleText.match(/(\d)\s*star/)
      const pctEl = anchor || li.querySelector('.a-text-right a') || li.querySelector('td:last-child')
      if (!pctEl) return
      const pctText = pctEl.getAttribute('title') || pctEl.textContent
      const pctMatch = pctText.match(/([\d]+)%/)
      if (!pctMatch) return
      const count = Math.round((parseInt(pctMatch[1], 10) / 100) * total)
      if (starMatch) {
        const star = parseInt(starMatch[1], 10)
        if (star === 5) counts.five_star = count
        else if (star === 4) counts.four_star = count
        else if (star === 3) counts.three_star = count
        else if (star === 2) counts.two_star = count
        else if (star === 1) counts.one_star = count
      }
    })

    return counts
  }

  // ── Send data gated by feature flags ────────────────────────────

  function sendData() {
    chrome.storage.local.get(['velocity_active', 'overlay_active'], ({ velocity_active, overlay_active }) => {
      if (!velocity_active && !overlay_active) return

      const reviewCount = parseReviewCount()

      if (overlay_active) {
        const snapshot = {
          asin,
          marketplace,
          title: parseTitle(),
          bullets: parseBullets(),
          main_image: parseMainImage(),
          price: parsePrice(),
          review_count: reviewCount,
          average_rating: parseAverageRating(),
          buy_box_seller: parseBuyBoxSeller(),
          is_suppressed: parseIsSuppressed(),
          captured_at: new Date().toISOString(),
        }
        chrome.runtime.sendMessage({ type: 'CONTENT_SNAPSHOT', payload: snapshot })
      }

      if (velocity_active) {
        // M4 defense: skip if histogram not found (prevents writing zeros over valid data)
        const histogramPresent = document.querySelector(
          '[data-hook="rating-count-list"] li, #histogramTable tr'
        )
        if (!histogramPresent) return

        // B4 defense: suppress spike alerts for low-review products (handled server-side,
        // but we still send data — server applies the 100+ review threshold)
        const starCounts = parseStarCounts()
        const payload = {
          asin,
          marketplace,
          ...starCounts,
          total: reviewCount || Object.values(starCounts).reduce((a, b) => a + b, 0),
        }
        chrome.runtime.sendMessage({ type: 'REVIEW_VELOCITY', payload })
      }
    })
  }

  // Wait for full page load — prevents M1 (partial load)
  if (document.readyState === 'complete') {
    sendData()
  } else {
    window.addEventListener('load', sendData, { once: true })
  }
})()
