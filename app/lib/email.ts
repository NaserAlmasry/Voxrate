import { Resend } from 'resend'

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null

function h(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

const MARKETPLACE_IDS: Record<string, string> = {
  'amazon.com':     'ATVPDKIKX0DER',
  'amazon.co.uk':   'A1F83G8C2ARO7P',
  'amazon.de':      'A1PA6795UKMFR9',
  'amazon.fr':      'A13V1IB3VIYZZH',
  'amazon.it':      'APJ6JRA9NG5V4',
  'amazon.es':      'A1RKKUPIHCS9HS',
  'amazon.co.jp':   'A1VC38T7YXB528',
  'amazon.ca':      'A2EUQ1WTGCTBG2',
  'amazon.com.au':  'A39IBJ37TRP1C6',
  'amazon.in':      'A21TJRUUN4KGV',
  'amazon.com.mx':  'A1AM78C64UM0Y8',
}

function getMarketplaceId(marketplace: string): string {
  return MARKETPLACE_IDS[marketplace] || MARKETPLACE_IDS['amazon.com']
}

export async function sendWeeklyDigest({
  to,
  listings,
}: {
  to: string
  listings: {
    productName: string
    currentScore: number
    previousScore: number | null
    topComplaint: string | null
    reportId: string
  }[]
}) {
  if (!resend) {
    console.warn('[Email] RESEND_API_KEY not set - skipping weekly digest')
    return
  }

  const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://voxrate.app'

  const scoreColor = (n: number) => n >= 66 ? '#22c55e' : n >= 38 ? '#f05a1e' : '#ef4444'

  const listingsHtml = listings.map(l => {
    const trend = l.previousScore !== null
      ? l.currentScore > l.previousScore
        ? `<span style="color:#22c55e;font-size:11px;">&#9650; +${l.currentScore - l.previousScore}</span>`
        : l.currentScore < l.previousScore
          ? `<span style="color:#ef4444;font-size:11px;">&#9660; ${l.currentScore - l.previousScore}</span>`
          : `<span style="color:#9ca3af;font-size:11px;">no change</span>`
      : ''

    return `
    <div style="border:1px solid #e5e7eb;border-radius:12px;padding:14px 16px;margin-bottom:10px;">
      <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;">
        <div style="flex:1;min-width:0;">
          <p style="font-size:13px;font-weight:700;color:#111;margin:0 0 2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${h(l.productName)}</p>
          ${l.topComplaint ? `<p style="font-size:11px;color:#9ca3af;margin:0;">Top issue: ${h(l.topComplaint)}</p>` : ''}
        </div>
        <div style="text-align:right;flex-shrink:0;">
          <p style="font-size:22px;font-weight:900;color:${scoreColor(l.currentScore)};margin:0;line-height:1;">${l.currentScore}</p>
          <div style="text-align:right;">${trend}</div>
        </div>
      </div>
      <a href="${SITE_URL}/dashboard/report/${l.reportId}"
         style="display:inline-block;margin-top:10px;font-size:11px;color:#f05a1e;text-decoration:none;font-weight:600;">
        View report &rarr;
      </a>
    </div>`
  }).join('')

  const allHealthy  = listings.every(l => l.currentScore >= 66)
  const needsWork   = listings.filter(l => l.currentScore < 38).length
  const tagline = allHealthy
    ? 'All your listings are in great shape this week.'
    : needsWork > 0
      ? `${needsWork} listing${needsWork > 1 ? 's' : ''} need${needsWork === 1 ? 's' : ''} attention.`
      : 'A few listings have room to improve.'

  await resend.emails.send({
    from:    'Voxrate <noreply@voxrate.app>',
    to,
    subject: `Your weekly Voxrate digest - ${new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`,
    html: `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f9fafb;margin:0;padding:24px;">
  <div style="max-width:520px;margin:0 auto;background:#fff;border-radius:16px;border:1px solid #e5e7eb;overflow:hidden;">

    <div style="background:#111;padding:20px 24px;">
      <span style="font-size:18px;font-weight:900;color:#fff;">Voxrate</span>
      <span style="display:block;font-size:11px;color:#6b7280;margin-top:2px;">Weekly shop digest</span>
    </div>

    <div style="padding:24px;">
      <h1 style="font-size:15px;font-weight:700;color:#111;margin:0 0 4px;">Weekly summary</h1>
      <p style="font-size:12px;color:#6b7280;margin:0 0 20px;">${tagline}</p>

      ${listingsHtml}

      <a href="${SITE_URL}/dashboard/monitor"
         style="display:block;text-align:center;padding:14px;background:#111;color:#fff;text-decoration:none;border-radius:10px;font-size:13px;font-weight:700;margin-top:16px;">
        Manage monitoring &rarr;
      </a>
    </div>

    <div style="padding:16px 24px;border-top:1px solid #f3f4f6;text-align:center;">
      <p style="font-size:11px;color:#9ca3af;margin:0;">
        Weekly digest from <a href="${SITE_URL}" style="color:#f05a1e;text-decoration:none;">Voxrate</a>.
        <a href="${SITE_URL}/dashboard/monitor" style="color:#9ca3af;">Unsubscribe</a>
      </p>
    </div>
  </div>
</body>
</html>`,
  })
}

export async function sendReportComplete({
  to,
  productName,
  healthScore,
  reportId,
}: {
  to: string
  productName: string
  healthScore: number
  reportId: string
}) {
  if (!resend) return

  const SITE_URL  = process.env.NEXT_PUBLIC_SITE_URL || 'https://voxrate.app'
  const reportUrl = `${SITE_URL}/dashboard/report/${reportId}`
  const scoreColor = healthScore >= 66 ? '#22c55e' : healthScore >= 38 ? '#f05a1e' : '#ef4444'
  const scoreLabel = healthScore >= 66 ? 'Great shape' : healthScore >= 38 ? 'Needs work' : 'Critical issues'

  await resend.emails.send({
    from:    'Voxrate <noreply@voxrate.app>',
    to,
    subject: `Your report is ready - ${productName}`,
    html: `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f9fafb;margin:0;padding:24px;">
  <div style="max-width:520px;margin:0 auto;background:#fff;border-radius:16px;border:1px solid #e5e7eb;overflow:hidden;">
    <div style="background:#111;padding:20px 24px;">
      <span style="font-size:18px;font-weight:900;color:#fff;">Voxrate</span>
      <span style="display:block;font-size:11px;color:#6b7280;margin-top:2px;">Your analysis is ready</span>
    </div>
    <div style="padding:24px;">
      <h1 style="font-size:16px;font-weight:700;color:#111;margin:0 0 4px;">${h(productName)}</h1>
      <p style="font-size:12px;color:#6b7280;margin:0 0 24px;">Your review analysis has finished. Here's the summary.</p>
      <div style="text-align:center;padding:24px;background:#f9fafb;border-radius:12px;border:1px solid #e5e7eb;margin-bottom:20px;">
        <p style="font-size:11px;color:#9ca3af;margin:0 0 4px;text-transform:uppercase;letter-spacing:0.05em;">Health Score</p>
        <p style="font-size:52px;font-weight:900;color:${scoreColor};margin:0;line-height:1;">${healthScore}</p>
        <p style="font-size:11px;color:${scoreColor};margin:4px 0 0;font-weight:600;">${scoreLabel}</p>
      </div>
      <a href="${reportUrl}" style="display:block;text-align:center;padding:14px;background:#f05a1e;color:#fff;text-decoration:none;border-radius:10px;font-size:13px;font-weight:700;">
        View full report &rarr;
      </a>
    </div>
    <div style=”padding:16px 24px;border-top:1px solid #f3f4f6;text-align:center;”>
      <p style=”font-size:11px;color:#9ca3af;margin:0;”>
        <a href=”${SITE_URL}” style=”color:#f05a1e;text-decoration:none;”>Voxrate</a> &mdash; Amazon review intelligence
      </p>
    </div>
  </div>
</body>
</html>`,
  })
}

export async function sendReportFailed({
  to,
  productName,
}: {
  to: string
  productName: string
}) {
  if (!resend) return

  const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://voxrate.app'

  await resend.emails.send({
    from:    'Voxrate <noreply@voxrate.app>',
    to,
    subject: `Analysis failed - ${productName}`,
    html: `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f9fafb;margin:0;padding:24px;">
  <div style="max-width:520px;margin:0 auto;background:#fff;border-radius:16px;border:1px solid #e5e7eb;overflow:hidden;">
    <div style="background:#111;padding:20px 24px;">
      <span style="font-size:18px;font-weight:900;color:#fff;">Voxrate</span>
    </div>
    <div style="padding:24px;">
      <h1 style="font-size:16px;font-weight:700;color:#111;margin:0 0 8px;">Analysis failed</h1>
      <p style="font-size:13px;color:#6b7280;margin:0 0 16px;">
        We ran into an issue analyzing <strong>${h(productName)}</strong>. Your analysis has been refunded automatically.
      </p>
      <p style="font-size:13px;color:#6b7280;margin:0 0 20px;">
        You can try again from your dashboard. If the problem persists, reply to this email and we'll look into it.
      </p>
      <a href="${SITE_URL}/dashboard" style="display:block;text-align:center;padding:14px;background:#f05a1e;color:#fff;text-decoration:none;border-radius:10px;font-size:13px;font-weight:700;">
        Go to dashboard &rarr;
      </a>
    </div>
    <div style=”padding:16px 24px;border-top:1px solid #f3f4f6;text-align:center;”>
      <p style=”font-size:11px;color:#9ca3af;margin:0;”>
        <a href=”${SITE_URL}” style=”color:#f05a1e;text-decoration:none;”>Voxrate</a> &mdash; Amazon review intelligence
      </p>
    </div>
  </div>
</body>
</html>`,
  })
}

export async function sendSentimentAlert({
  to,
  productName,
  asin,
  marketplace,
  reviews,
  frequency,
  creditsCharged,
}: {
  to: string
  productName: string
  asin: string
  marketplace: string
  reviews: { rating: number; title: string; body: string }[]
  frequency: string
  creditsCharged: number
}) {
  if (!resend) {
    console.warn('[Email] RESEND_API_KEY not set - skipping sentiment alert')
    return
  }

  const SITE_URL  = process.env.NEXT_PUBLIC_SITE_URL || 'https://voxrate.app'
  const safeName  = productName.replace(/[^\w\s\-.,!?']/g, '') || asin
  const count     = reviews.length
  const productHref = `https://www.${marketplace.replace(/^amazon\./, 'amazon.')}/dp/${asin}`

  const marketplaceId = getMarketplaceId(marketplace)
  const reviewsHtml = reviews.slice(0, 20).map(r => {
    const stars  = '&#9733;'.repeat(r.rating) + '&#9734;'.repeat(5 - r.rating)
    const color  = r.rating === 1 ? '#dc2626' : '#f05a1e'
    const snippet = (r.body || '').slice(0, 800)
    return `
      <div style="border:1px solid #fecaca;background:#fff5f5;border-radius:10px;padding:12px 14px;margin-bottom:8px;">
        <p style="margin:0 0 4px;font-size:12px;font-weight:700;color:${color};letter-spacing:1px;">${stars} <span style="color:#6b7280;font-weight:500;letter-spacing:0;margin-left:6px;">${r.rating}-star</span></p>
        ${r.title ? `<p style="margin:0 0 4px;font-size:12px;font-weight:700;color:#111;">${h(r.title)}</p>` : ''}
        <p style="margin:0 0 8px;font-size:12px;color:#374151;line-height:1.5;">${h(snippet)}${snippet.length >= 800 ? '&hellip;' : ''}</p>
        <div style="display:flex;gap:12px;flex-wrap:wrap;">
          <a href="https://sellercentral.amazon.com/messaging/contact?asin=${h(asin)}&marketplaceId=${marketplaceId}" style="font-size:11px;color:#1a56db;font-weight:600;text-decoration:none;">Reply on Amazon &rarr;</a>
          <a href="${SITE_URL}/dashboard/reply?prefill=${encodeURIComponent((r.body || '').slice(0, 500))}&asin=${h(asin)}" style="font-size:11px;color:#f05a1e;font-weight:600;text-decoration:none;">Generate reply in Voxrate &rarr;</a>
        </div>
      </div>`
  }).join('')

  await resend.emails.send({
    from:    'Voxrate <noreply@voxrate.app>',
    to,
    subject: `New negative reviews for ${safeName} - ${count} review${count === 1 ? '' : 's'}`,
    html: `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f9fafb;margin:0;padding:24px;">
  <div style="max-width:560px;margin:0 auto;background:#fff;border-radius:16px;border:1px solid #e5e7eb;overflow:hidden;">
    <div style="background:#111;padding:20px 24px;">
      <span style="font-size:18px;font-weight:900;color:#fff;">Voxrate</span>
      <span style="display:block;font-size:11px;color:#6b7280;margin-top:2px;">Sentiment alert &middot; ${frequency}</span>
    </div>
    <div style="padding:24px;">
      <h1 style="font-size:16px;font-weight:700;color:#111;margin:0 0 4px;">${h(productName)}</h1>
      <p style="font-size:12px;color:#6b7280;margin:0 0 18px;">
        ${count} new 1&#9733;/2&#9733; review${count === 1 ? '' : 's'} detected &middot; ASIN <a href="${productHref}" style="color:#6b7280;text-decoration:underline;">${h(asin)}</a>
      </p>
      ${count === 0
        ? `<div style="padding:18px;text-align:center;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:10px;"><p style="margin:0;font-size:13px;color:#15803d;font-weight:600;">No new negative reviews this period.</p></div>`
        : reviewsHtml}
      <a href="${SITE_URL}/dashboard/sentiment-alerts" style="display:block;text-align:center;padding:14px;background:#f05a1e;color:#fff;text-decoration:none;border-radius:10px;font-size:13px;font-weight:700;margin-top:16px;">
        Manage alerts &rarr;
      </a>
      <p style="font-size:11px;color:#9ca3af;margin:14px 0 0;text-align:center;">${creditsCharged > 0 ? '1 analysis used for this scan.' : ''}</p>
    </div>
    <div style="padding:16px 24px;border-top:1px solid #f3f4f6;text-align:center;">
      <p style="font-size:11px;color:#9ca3af;margin:0;">
        <a href=”${SITE_URL}” style=”color:#f05a1e;text-decoration:none;”>Voxrate</a> &mdash; Amazon review intelligence
      </p>
    </div>
  </div>
</body>
</html>`,
  })
}

export async function sendMonitorAlert({
  to,
  productName,
  oldScore,
  newScore,
  reportId,
  newComplaints,
}: {
  to: string
  productName: string
  oldScore: number
  newScore: number
  reportId: string
  newComplaints: string[]
}) {
  if (!resend) {
    console.warn('[Email] RESEND_API_KEY not set - skipping email')
    return
  }

  const diff     = newScore - oldScore
  const dropped  = diff < 0
  const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://voxrate.app'
  const reportUrl = `${SITE_URL}/dashboard/report/${reportId}`

  const scoreColor = newScore >= 66 ? '#22c55e' : newScore >= 38 ? '#f05a1e' : '#ef4444'
  const diffText   = dropped ? `dropped ${Math.abs(diff)} points` : `improved ${diff} points`
  const safeProductName = productName.replace(/[^\w\s\-.,!?']/g, '')
  const subject    = dropped
    ? `Alert: "${safeProductName}" health score dropped to ${newScore}`
    : `Good news: "${safeProductName}" improved to ${newScore}`

  const complaintsHtml = newComplaints.length > 0
    ? `<div style="margin:16px 0;padding:14px;background:#fff5f5;border:1px solid #fca5a5;border-radius:10px;">
        <p style="font-size:12px;font-weight:700;color:#dc2626;margin:0 0 8px;">New complaints detected:</p>
        <ul style="margin:0;padding-left:16px;">
          ${newComplaints.map(c => `<li style="font-size:12px;color:#374151;margin-bottom:4px;">${h(c)}</li>`).join('')}
        </ul>
       </div>`
    : ''

  await resend.emails.send({
    from:    'Voxrate <noreply@voxrate.app>',
    to,
    subject,
    html: `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f9fafb;margin:0;padding:24px;">
  <div style="max-width:520px;margin:0 auto;background:#fff;border-radius:16px;border:1px solid #e5e7eb;overflow:hidden;">

    <div style="background:#111;padding:20px 24px;display:flex;align-items:center;gap:10px;">
      <span style="font-size:18px;font-weight:900;color:#fff;">Voxrate</span>
      <span style="font-size:11px;color:#6b7280;margin-left:auto;">Product monitoring alert</span>
    </div>

    <div style="padding:24px;">
      <h1 style="font-size:16px;font-weight:700;color:#111;margin:0 0 4px;">${h(productName)}</h1>
      <p style="font-size:12px;color:#6b7280;margin:0 0 20px;">Health score ${diffText}</p>

      <div style="display:flex;gap:16px;margin-bottom:20px;">
        <div style="flex:1;text-align:center;padding:16px;background:#f9fafb;border-radius:12px;border:1px solid #e5e7eb;">
          <p style="font-size:10px;color:#9ca3af;margin:0 0 4px;text-transform:uppercase;">Before</p>
          <p style="font-size:28px;font-weight:900;color:#6b7280;margin:0;">${oldScore}</p>
        </div>
        <div style="display:flex;align-items:center;color:#9ca3af;font-size:20px;">&rarr;</div>
        <div style="flex:1;text-align:center;padding:16px;background:#f9fafb;border-radius:12px;border:2px solid ${scoreColor};">
          <p style="font-size:10px;color:#9ca3af;margin:0 0 4px;text-transform:uppercase;">Now</p>
          <p style="font-size:28px;font-weight:900;color:${scoreColor};margin:0;">${newScore}</p>
        </div>
      </div>

      ${complaintsHtml}

      <a href="${reportUrl}" style="display:block;text-align:center;padding:14px;background:#f05a1e;color:#fff;text-decoration:none;border-radius:10px;font-size:13px;font-weight:700;margin-top:8px;">
        View full report &rarr;
      </a>
    </div>

    <div style="padding:16px 24px;border-top:1px solid #f3f4f6;text-align:center;">
      <p style="font-size:11px;color:#9ca3af;margin:0;">
        You’re receiving this because you’re monitoring this listing on
        <a href="${SITE_URL}" style="color:#f05a1e;text-decoration:none;">Voxrate</a>.
        <a href="${SITE_URL}/dashboard/monitor" style="color:#9ca3af;">Manage alerts</a>
      </p>
    </div>
  </div>
</body>
</html>`,
  })
}

export async function sendImmediateStarAlert({
  to,
  productName,
  asin,
  marketplace,
  reviews,
  reportId,
}: {
  to: string
  productName: string
  asin: string
  marketplace: string
  reviews: { rating: number; title?: string; body?: string }[]
  reportId: string
}) {
  if (!resend) {
    console.warn('[Email] RESEND_API_KEY not set - skipping immediate star alert')
    return
  }

  const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://voxrate.app'
  const marketplaceId = getMarketplaceId(marketplace)
  const count = reviews.length
  const safeName = productName.replace(/[^\w\s\-.,!?']/g, '') || asin

  const reviewsHtml = reviews.slice(0, 5).map(r => {
    const stars = '&#9733;'.repeat(r.rating) + '&#9734;'.repeat(5 - r.rating)
    const color = r.rating === 1 ? '#dc2626' : '#f05a1e'
    const body = (r.body || '').slice(0, 800)
    return `
      <div style="border:1px solid #fecaca;background:#fff5f5;border-radius:10px;padding:14px 16px;margin-bottom:10px;">
        <p style="margin:0 0 6px;font-size:13px;font-weight:700;color:${color};">${stars} ${r.rating}-star</p>
        ${r.title ? `<p style="margin:0 0 6px;font-size:13px;font-weight:700;color:#111;">${h(r.title)}</p>` : ''}
        <p style="margin:0 0 10px;font-size:13px;color:#374151;line-height:1.6;">${h(body)}${body.length >= 800 ? '&hellip;' : ''}</p>
        <div style="display:flex;gap:12px;flex-wrap:wrap;">
          <a href="https://sellercentral.amazon.com/messaging/contact?asin=${h(asin)}&marketplaceId=${marketplaceId}"
             style="font-size:12px;color:#1a56db;font-weight:600;text-decoration:none;">Reply on Amazon &rarr;</a>
          <a href="${SITE_URL}/dashboard/reply?prefill=${encodeURIComponent((r.body || '').slice(0, 500))}&asin=${h(asin)}"
             style="font-size:12px;color:#f05a1e;font-weight:600;text-decoration:none;">Generate reply in Voxrate &rarr;</a>
        </div>
      </div>`
  }).join('')

  await resend.emails.send({
    from: 'Voxrate <noreply@voxrate.app>',
    to,
    subject: `🚨 New ${count} 1★/2★ review${count > 1 ? 's' : ''} on "${safeName}"`,
    html: `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f9fafb;margin:0;padding:24px;">
  <div style="max-width:560px;margin:0 auto;background:#fff;border-radius:16px;border:1px solid #e5e7eb;overflow:hidden;">
    <div style="background:#dc2626;padding:20px 24px;">
      <span style="font-size:18px;font-weight:900;color:#fff;">Voxrate</span>
      <span style="display:block;font-size:11px;color:#fca5a5;margin-top:2px;">Immediate 1&#9733;/2&#9733; alert</span>
    </div>
    <div style="padding:24px;">
      <h1 style="font-size:16px;font-weight:700;color:#111;margin:0 0 4px;">${h(productName)}</h1>
      <p style="font-size:13px;color:#6b7280;margin:0 0 18px;">
        ${count} new low-rated review${count > 1 ? 's' : ''} just appeared on your listing.
        Act fast &mdash; negative reviews can impact conversion within 24 hours.
      </p>
      ${reviewsHtml}
      <a href="${SITE_URL}/dashboard/report/${reportId}"
         style="display:block;text-align:center;padding:14px;background:#111;color:#fff;text-decoration:none;border-radius:10px;font-size:13px;font-weight:700;margin-top:8px;">
        View full report &rarr;
      </a>
    </div>
    <div style="padding:16px 24px;border-top:1px solid #f3f4f6;text-align:center;">
      <p style="font-size:11px;color:#9ca3af;margin:0;">
        <a href="${SITE_URL}" style="color:#f05a1e;text-decoration:none;">Voxrate</a> &mdash; Amazon review intelligence.
        <a href="${SITE_URL}/dashboard/monitor" style="color:#9ca3af;">Manage alerts</a>
      </p>
    </div>
  </div>
</body>
</html>`,
  })
}

export async function sendEmergingComplaintAlert({
  to, productName, reportId, newThemes, spikedThemes,
}: {
  to: string
  productName: string
  reportId: string
  newThemes: { name: string; percentage: number; severity: string | null }[]
  spikedThemes: { name: string; oldPct: number; newPct: number }[]
}) {
  if (!resend) return
  const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://voxrate.app'
  const safeName = productName.replace(/[^\w\s\-.,!?']/g, '') || 'your product'
  const totalChanges = newThemes.length + spikedThemes.length

  const newThemesHtml = newThemes.map(t => `
    <div style="border:1px solid #fed7aa;background:#fff7ed;border-radius:10px;padding:12px 14px;margin-bottom:8px;">
      <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;">
        <p style="margin:0;font-size:13px;font-weight:700;color:#c2410c;">${h(t.name)}</p>
        <span style="font-size:11px;background:#f97316;color:#fff;padding:2px 8px;border-radius:20px;font-weight:700;flex-shrink:0;">NEW</span>
      </div>
      <p style="margin:4px 0 0;font-size:12px;color:#92400e;">Appears in ${t.percentage.toFixed(0)}% of reviews${t.severity ? ` · ${h(t.severity)} severity` : ''}</p>
      <p style="margin:4px 0 0;font-size:11px;color:#b45309;">This complaint was not present 30 days ago</p>
    </div>`).join('')

  const spikedHtml = spikedThemes.map(t => `
    <div style="border:1px solid #fecaca;background:#fff5f5;border-radius:10px;padding:12px 14px;margin-bottom:8px;">
      <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;">
        <p style="margin:0;font-size:13px;font-weight:700;color:#991b1b;">${h(t.name)}</p>
        <span style="font-size:11px;background:#ef4444;color:#fff;padding:2px 8px;border-radius:20px;font-weight:700;flex-shrink:0;">&#9650; +${(t.newPct - t.oldPct).toFixed(0)}%</span>
      </div>
      <p style="margin:4px 0 0;font-size:12px;color:#7f1d1d;">${t.oldPct.toFixed(0)}% → ${t.newPct.toFixed(0)}% of reviews</p>
    </div>`).join('')

  await resend.emails.send({
    from: 'Voxrate <noreply@voxrate.app>',
    to,
    subject: `⚠️ New complaint detected on "${safeName}"`,
    html: `<!DOCTYPE html><html><head><meta charset="utf-8"></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f9fafb;margin:0;padding:24px;">
<div style="max-width:560px;margin:0 auto;background:#fff;border-radius:16px;border:1px solid #e5e7eb;overflow:hidden;">
  <div style="background:#ea580c;padding:20px 24px;">
    <span style="font-size:18px;font-weight:900;color:#fff;">Voxrate</span>
    <span style="display:block;font-size:11px;color:#fed7aa;margin-top:2px;">Emerging complaint alert</span>
  </div>
  <div style="padding:24px;">
    <h1 style="font-size:16px;font-weight:700;color:#111;margin:0 0 4px;">${h(productName)}</h1>
    <p style="font-size:13px;color:#6b7280;margin:0 0 20px;">
      ${totalChanges} complaint change${totalChanges > 1 ? 's' : ''} detected since 30 days ago.
      ${newThemes.length > 0 ? `<strong style="color:#c2410c;">${newThemes.length} new complaint${newThemes.length > 1 ? 's' : ''} emerged</strong> that weren't there before.` : ''}
    </p>
    ${newThemesHtml}
    ${spikedHtml}
    <a href="${SITE_URL}/dashboard/report/${reportId}" style="display:block;text-align:center;padding:14px;background:#ea580c;color:#fff;text-decoration:none;border-radius:10px;font-size:13px;font-weight:700;margin-top:8px;">View full report &rarr;</a>
  </div>
  <div style="padding:16px 24px;border-top:1px solid #f3f4f6;text-align:center;">
    <p style="font-size:11px;color:#9ca3af;margin:0;"><a href="${SITE_URL}" style="color:#f05a1e;text-decoration:none;">Voxrate</a> — <a href="${SITE_URL}/dashboard/watchlist" style="color:#9ca3af;">Manage watchlist</a></p>
  </div>
</div></body></html>`,
  })
}

export async function sendReviewAttackAlert({
  to, productName, asin, marketplace, reviews, monitorId, isCoordinated, sharedPhrases,
}: {
  to: string
  productName: string
  asin: string
  marketplace: string
  reviews: { rating: number; title?: string; body?: string; verified?: boolean }[]
  monitorId: string
  isCoordinated: boolean
  sharedPhrases?: string[]
}) {
  if (!resend) return
  const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://voxrate.app'
  const count = reviews.length
  const safeName = productName.replace(/[^\w\s\-.,!?']/g, '') || asin
  const subject = isCoordinated
    ? `🚨 Coordinated attack detected on "${safeName}" — ${count} suspicious reviews`
    : `⚠️ Possible review attack on "${safeName}" — ${count} new negative reviews`
  const headerBg = isCoordinated ? '#7c3aed' : '#dc2626'
  const headerLabel = isCoordinated ? 'Coordinated attack detected' : 'Possible review attack'

  const reviewsHtml = reviews.slice(0, 5).map(r => {
    const stars = '&#9733;'.repeat(r.rating) + '&#9734;'.repeat(5 - r.rating)
    const unverifiedBadge = r.verified === false
      ? `<span style="font-size:10px;background:#fef3c7;color:#92400e;padding:2px 6px;border-radius:4px;margin-left:6px;">Unverified</span>`
      : ''
    return `<div style="border:1px solid #fecaca;background:#fff5f5;border-radius:10px;padding:14px;margin-bottom:10px;">
      <p style="margin:0 0 4px;font-size:12px;font-weight:700;color:#dc2626;">${stars}${unverifiedBadge}</p>
      ${r.title ? `<p style="margin:0 0 4px;font-size:13px;font-weight:700;color:#111;">${h(r.title)}</p>` : ''}
      <p style="margin:0;font-size:12px;color:#374151;line-height:1.5;">${h((r.body || '').slice(0, 300))}</p>
    </div>`
  }).join('')

  await resend.emails.send({
    from: 'Voxrate <noreply@voxrate.app>',
    to,
    subject,
    html: `<!DOCTYPE html><html><head><meta charset="utf-8"></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f9fafb;margin:0;padding:24px;">
<div style="max-width:560px;margin:0 auto;background:#fff;border-radius:16px;border:1px solid #e5e7eb;overflow:hidden;">
  <div style="background:${headerBg};padding:20px 24px;">
    <span style="font-size:18px;font-weight:900;color:#fff;">Voxrate</span>
    <span style="display:block;font-size:11px;color:#fca5a5;margin-top:2px;">${headerLabel}</span>
  </div>
  <div style="padding:24px;">
    <h1 style="font-size:16px;font-weight:700;color:#111;margin:0 0 4px;">${h(productName)}</h1>
    <p style="font-size:13px;color:#6b7280;margin:0 0 18px;">${count} new negative reviews detected in this monitoring cycle. ${isCoordinated ? 'Multiple reviews share similar language — this may be a coordinated attack.' : 'This volume is unusually high and may indicate a review attack.'}</p>
    ${isCoordinated && sharedPhrases && sharedPhrases.length > 0 ? `
    <div style="margin-bottom:16px;padding:12px 14px;background:#f5f3ff;border:1px solid #ddd6fe;border-radius:10px;">
      <p style="margin:0 0 6px;font-size:12px;font-weight:700;color:#6d28d9;">Shared phrases detected across reviews:</p>
      ${sharedPhrases.slice(0, 3).map(p => `<p style="margin:0 0 4px;font-size:12px;color:#5b21b6;font-style:italic;">"${h(p)}"</p>`).join('')}
      <p style="margin:8px 0 0;font-size:11px;color:#7c3aed;">Use this as evidence when reporting to Amazon Brand Registry.</p>
    </div>` : ''}
    ${reviewsHtml}
    <a href="${SITE_URL}/dashboard/monitor" style="display:block;text-align:center;padding:14px;background:#111;color:#fff;text-decoration:none;border-radius:10px;font-size:13px;font-weight:700;margin-top:8px;">View attack log &rarr;</a>
  </div>
  <div style="padding:16px 24px;border-top:1px solid #f3f4f6;text-align:center;">
    <p style="font-size:11px;color:#9ca3af;margin:0;"><a href="${SITE_URL}" style="color:#f05a1e;text-decoration:none;">Voxrate</a> — <a href="${SITE_URL}/dashboard/monitor" style="color:#9ca3af;">Manage alerts</a></p>
  </div>
</div></body></html>`,
  })
}

export async function sendReviewRemovedAlert({
  to, productName, removedCount, newRating, monitorId,
}: {
  to: string
  productName: string
  removedCount: number
  newRating?: number
  monitorId: string
}) {
  if (!resend) return
  const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://voxrate.app'
  const safeName = productName.replace(/[^\w\s\-.,!?']/g, '') || 'your product'
  await resend.emails.send({
    from: 'Voxrate <noreply@voxrate.app>',
    to,
    subject: `✅ Good news: ${removedCount} negative review${removedCount > 1 ? 's' : ''} removed from "${safeName}"`,
    html: `<!DOCTYPE html><html><head><meta charset="utf-8"></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f9fafb;margin:0;padding:24px;">
<div style="max-width:520px;margin:0 auto;background:#fff;border-radius:16px;border:1px solid #e5e7eb;overflow:hidden;">
  <div style="background:#16a34a;padding:20px 24px;">
    <span style="font-size:18px;font-weight:900;color:#fff;">Voxrate</span>
    <span style="display:block;font-size:11px;color:#bbf7d0;margin-top:2px;">Good news alert</span>
  </div>
  <div style="padding:24px;">
    <h1 style="font-size:16px;font-weight:700;color:#111;margin:0 0 8px;">${h(productName)}</h1>
    <p style="font-size:14px;color:#374151;margin:0 0 16px;">
      <strong>${removedCount} negative review${removedCount > 1 ? 's were' : ' was'} removed</strong> from your listing — likely taken down by Amazon or retracted by the reviewer.
      ${newRating ? `Your current rating is <strong>${newRating.toFixed(1)} ★</strong>.` : ''}
    </p>
    <a href="${SITE_URL}/dashboard/monitor" style="display:block;text-align:center;padding:14px;background:#16a34a;color:#fff;text-decoration:none;border-radius:10px;font-size:13px;font-weight:700;">View monitoring dashboard &rarr;</a>
  </div>
  <div style="padding:16px 24px;border-top:1px solid #f3f4f6;text-align:center;">
    <p style="font-size:11px;color:#9ca3af;margin:0;"><a href="${SITE_URL}" style="color:#f05a1e;text-decoration:none;">Voxrate</a> — <a href="${SITE_URL}/dashboard/monitor" style="color:#9ca3af;">Manage alerts</a></p>
  </div>
</div></body></html>`,
  })
}

export async function sendCompetitorAlert({
  to,
  productName,
  oldScore,
  newScore,
  reportId,
  newComplaints,
}: {
  to: string
  productName: string
  oldScore: number
  newScore: number
  reportId: string
  newComplaints: string[]
}): Promise<void> {
  if (!resend) return
  const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://voxrate.app'
  const delta = newScore - oldScore
  const arrow = delta >= 0 ? '&#9650;' : '&#9660;'
  const deltaColor = delta >= 0 ? '#16a34a' : '#dc2626'
  const complaintsHtml = newComplaints.slice(0, 5).map(c =>
    `<li style="margin-bottom:4px;">${h(c)}</li>`
  ).join('')
  await resend.emails.send({
    from: 'Voxrate <alerts@voxrate.app>',
    to,
    subject: `Competitor update: ${productName} score changed to ${newScore}`,
    html: `<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background:#f9fafb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <div style="max-width:560px;margin:32px auto;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #e5e7eb;">
    <div style="padding:24px;background:#1e293b;">
      <p style="margin:0;font-size:18px;font-weight:700;color:#ffffff;">Competitor Score Change</p>
      <p style="margin:6px 0 0;font-size:13px;color:#94a3b8;">${h(productName)}</p>
    </div>
    <div style="padding:24px;">
      <div style="display:flex;gap:16px;margin-bottom:20px;">
        <div style="flex:1;padding:16px;background:#f8fafc;border-radius:12px;text-align:center;">
          <p style="margin:0;font-size:11px;color:#6b7280;text-transform:uppercase;letter-spacing:0.05em;">Previous</p>
          <p style="margin:4px 0 0;font-size:28px;font-weight:700;color:#374151;">${oldScore}</p>
        </div>
        <div style="flex:1;padding:16px;background:#f8fafc;border-radius:12px;text-align:center;">
          <p style="margin:0;font-size:11px;color:#6b7280;text-transform:uppercase;letter-spacing:0.05em;">Now</p>
          <p style="margin:4px 0 0;font-size:28px;font-weight:700;color:#374151;">${newScore}</p>
          <p style="margin:2px 0 0;font-size:13px;font-weight:600;color:${deltaColor};">${arrow} ${Math.abs(delta)} pts</p>
        </div>
      </div>
      ${newComplaints.length > 0 ? `
      <div style="margin-bottom:20px;">
        <p style="margin:0 0 8px;font-size:13px;font-weight:600;color:#374151;">New complaints detected</p>
        <ul style="margin:0;padding-left:20px;font-size:13px;color:#6b7280;">${complaintsHtml}</ul>
      </div>` : ''}
      <a href="${SITE_URL}/dashboard/report/${reportId}" style="display:inline-block;padding:10px 20px;background:#000;color:#fff;font-size:13px;font-weight:600;border-radius:10px;text-decoration:none;">View full report</a>
    </div>
    <div style="padding:16px 24px;border-top:1px solid #f3f4f6;text-align:center;">
      <p style="font-size:11px;color:#9ca3af;margin:0;">
        <a href="${SITE_URL}" style="color:#f05a1e;text-decoration:none;">Voxrate</a> &mdash; Amazon review intelligence.
        <a href="${SITE_URL}/dashboard/watchlist" style="color:#9ca3af;">Manage watchlist</a>
      </p>
    </div>
  </div>
</body>
</html>`,
  })
}
