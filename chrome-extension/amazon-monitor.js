// Voxrate Amazon Monitor — Content script on Amazon product pages
// Sends listing snapshot and review velocity data to background.js

;(function () {
  'use strict'

  // Only run on product detail pages (dp/*) not on review-only pages
  // (content.js handles review pages)
  const url = window.location.href
  const isDpPage = /amazon\.[a-z.]+\/(?:dp|gp\/product)\/([A-Z0-9]{10})/i.test(url)
  if (!isDpPage) return

  const asinMatch = url.match(/\/(?:dp|gp\/product)\/([A-Z0-9]{10})/i)
  if (!asinMatch) return
  const asin = asinMatch[1].toUpperCase()

  // Detect marketplace from hostname
  const host = window.location.hostname
  const marketplace = host.replace('www.', '')

  function getText(selector) {
    const el = document.querySelector(selector)
    return el ? el.textContent.trim() : null
  }

  function parsePrice() {
    const whole = getText('.a-price-whole')
    const fraction = getText('.a-price-fraction')
    if (whole) {
      const raw = whole.replace(/[^0-9]/g, '') + '.' + (fraction || '00')
      const parsed = parseFloat(raw)
      return isNaN(parsed) ? null : parsed
    }
    // Fallback: look for offscreen price
    const offscreen = document.querySelector('.a-offscreen')
    if (offscreen) {
      const match = offscreen.textContent.match(/[\d,.]+/)
      if (match) {
        const parsed = parseFloat(match[0].replace(',', ''))
        return isNaN(parsed) ? null : parsed
      }
    }
    return null
  }

  function parseTitle() {
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
    // Seller name near "Ships from" or "Sold by"
    const soldBy = document.querySelector('#sellerProfileTriggerId, #merchant-info a')
    if (soldBy) return soldBy.textContent.trim() || null

    const buyboxSeller = document.querySelector('#tabular-buybox .tabular-buybox-text')
    if (buyboxSeller) return buyboxSeller.textContent.trim() || null

    return null
  }

  function parseReviewCount() {
    const el = document.querySelector('#acrCustomerReviewText, #customerReviews .a-size-base')
    if (el) {
      const match = el.textContent.match(/([\d,]+)/)
      if (match) return parseInt(match[1].replace(',', ''), 10)
    }
    return null
  }

  function parseAverageRating() {
    const el = document.querySelector('#acrPopover .a-icon-alt, #averageCustomerReviews .a-icon-alt')
    if (el) {
      const match = el.textContent.match(/([\d.]+)/)
      if (match) return parseFloat(match[1])
    }
    return null
  }

  function parseIsSuppressed() {
    // Common suppression signals
    const suppressionTexts = [
      'This listing is currently unavailable',
      'We\'re sorry. This item is not available',
      'Currently unavailable',
      'This item cannot be displayed',
    ]
    const bodyText = document.body.textContent
    return suppressionTexts.some(t => bodyText.includes(t))
  }

  function parseStarCounts() {
    // Review histogram on product page (summary ratings)
    const counts = { one_star: 0, two_star: 0, three_star: 0, four_star: 0, five_star: 0 }
    document.querySelectorAll('[data-hook="rating-count-list"] li').forEach((li, i) => {
      const pct = li.querySelector('.a-text-right a')
      const total = parseReviewCount() || 0
      if (pct && total > 0) {
        const match = pct.textContent.match(/([\d]+)%/)
        if (match) {
          const count = Math.round((parseInt(match[1], 10) / 100) * total)
          // li index 0 = 5-star, 1 = 4-star, ... 4 = 1-star
          if (i === 0) counts.five_star = count
          else if (i === 1) counts.four_star = count
          else if (i === 2) counts.three_star = count
          else if (i === 3) counts.two_star = count
          else if (i === 4) counts.one_star = count
        }
      }
    })
    return counts
  }

  function sendData() {
    const snapshot = {
      asin,
      marketplace,
      title: parseTitle(),
      bullets: parseBullets(),
      main_image: parseMainImage(),
      price: parsePrice(),
      review_count: parseReviewCount(),
      average_rating: parseAverageRating(),
      buy_box_seller: parseBuyBoxSeller(),
      is_suppressed: parseIsSuppressed(),
    }

    const starCounts = parseStarCounts()
    const velocityPayload = {
      asin,
      ...starCounts,
      total: Object.values(starCounts).reduce((a, b) => a + b, 0),
    }

    chrome.runtime.sendMessage({ type: 'CONTENT_SNAPSHOT', payload: snapshot })
    chrome.runtime.sendMessage({ type: 'REVIEW_VELOCITY', payload: velocityPayload })
  }

  // Wait for DOM to be reasonably loaded
  if (document.readyState === 'complete') {
    sendData()
  } else {
    window.addEventListener('load', sendData, { once: true })
  }
})()
