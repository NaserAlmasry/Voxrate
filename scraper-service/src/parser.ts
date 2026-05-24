import * as cheerio from 'cheerio'
import type { Review } from './types.js'

// Amazon review page selectors — verified against live pages, May 2026.
// Amazon returns HTTP 200 even for bot blocks, so we must inspect the body.

const CAPTCHA_MARKERS = [
  'robot check',
  'enter the characters you see below',
  '/errors/validatecaptcha',
  'api-services-support@amazon.com',
  'sorry, we just need to make sure',
  '<title>\n      page not found',
]

const SIGNIN_MARKERS = [
  '/ap/signin',
  'sign in to continue',
  'authportal',
  'claimid=',
  'ap_signin_form',
]

export function isBlocked(html: string, finalUrl: string): boolean {
  if (/captcha|validateCaptcha/i.test(finalUrl)) return true
  if (/\/ap\/signin/i.test(finalUrl)) return true
  const lower = html.toLowerCase()
  return CAPTCHA_MARKERS.some(m => lower.includes(m)) || SIGNIN_MARKERS.some(m => lower.includes(m))
}

export function hasNextPage($: cheerio.CheerioAPI): boolean {
  // "Next page" link exists and is not disabled
  return $('li.a-last').length > 0 && $('li.a-last.a-disabled').length === 0
}

export function parseReviews(html: string, asin: string, marketplace: string): Review[] {
  const $ = cheerio.load(html)
  const tld = marketplace.replace(/^amazon\./, '')
  const reviews: Review[] = []

  $('[data-hook="review"]').each((_, el) => {
    const node = $(el)

    const id = node.attr('id') ?? `bd-${asin}-${Date.now()}-${reviews.length}`

    // "4.0 out of 5 stars" → 4
    const ratingText = node.find('[data-hook="review-star-rating"] span.a-icon-alt, [data-hook="cmps-review-star-rating"] span.a-icon-alt').first().text()
    const rating = Math.round(parseFloat(ratingText) || 0)
    if (rating < 1 || rating > 5) return   // skip unresolvable rating

    // Title: the last span child avoids grabbing the hidden icon-alt span
    const title = node.find('[data-hook="review-title"] > span:last-child').text().trim()
      || node.find('[data-hook="review-title"]').text().trim()

    // Body: sometimes split across multiple spans; join them
    const body = node.find('[data-hook="review-body"] span').map((_, s) => $(s).text()).get().join(' ').trim()
    if (body.length < 20) return

    // "Reviewed in the United States on January 5, 2025" → "January 5, 2025"
    const dateRaw = node.find('[data-hook="review-date"]').text().trim()
    const date = dateRaw.split(' on ').pop() ?? dateRaw

    const verified = node.find('[data-hook="avp-badge"]').length > 0

    // "47 people found this helpful" | "One person found this helpful"
    const helpfulText = node.find('[data-hook="helpful-vote-statement"]').text().trim()
    const helpfulMatch = helpfulText.match(/^(one|\d[\d,]*)/i)
    const helpful = helpfulMatch
      ? (helpfulMatch[1].toLowerCase() === 'one' ? 1 : parseInt(helpfulMatch[1].replace(/,/g, '')))
      : 0

    reviews.push({ id, rating, title, body, date, verified, helpful, country: tld })
  })

  return reviews
}
