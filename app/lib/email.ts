import { Resend } from 'resend'

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null

function h(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
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
    console.warn('[Email] RESEND_API_KEY not set â€” skipping weekly digest')
    return
  }

  const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://voxrate.app'

  const scoreColor = (n: number) => n >= 66 ? '#22c55e' : n >= 38 ? '#f05a1e' : '#ef4444'

  const listingsHtml = listings.map(l => {
    const trend = l.previousScore !== null
      ? l.currentScore > l.previousScore
        ? `<span style="color:#22c55e;font-size:11px;">â–² +${l.currentScore - l.previousScore}</span>`
        : l.currentScore < l.previousScore
          ? `<span style="color:#ef4444;font-size:11px;">â–¼ ${l.currentScore - l.previousScore}</span>`
          : `<span style="color:#9ca3af;font-size:11px;">â€” no change</span>`
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
        View report â†’
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
    subject: `Your weekly Voxrate digest â€” ${new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`,
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
        Manage monitoring â†’
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
    subject: `Your report is ready â€” ${productName}`,
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
        View full report â†’
      </a>
    </div>
    <div style="padding:16px 24px;border-top:1px solid #f3f4f6;text-align:center;">
      <p style="font-size:11px;color:#9ca3af;margin:0;">
        <a href="${SITE_URL}" style="color:#f05a1e;text-decoration:none;">Voxrate</a> â€” Amazon review intelligence
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
    subject: `Analysis failed â€” ${productName}`,
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
        Go to dashboard â†’
      </a>
    </div>
    <div style="padding:16px 24px;border-top:1px solid #f3f4f6;text-align:center;">
      <p style="font-size:11px;color:#9ca3af;margin:0;">
        <a href="${SITE_URL}" style="color:#f05a1e;text-decoration:none;">Voxrate</a> â€” Amazon review intelligence
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
    console.warn('[Email] RESEND_API_KEY not set â€” skipping sentiment alert')
    return
  }

  const SITE_URL  = process.env.NEXT_PUBLIC_SITE_URL || 'https://voxrate.app'
  const safeName  = productName.replace(/[^\w\s\-.,!?']/g, '') || asin
  const count     = reviews.length
  const productHref = `https://www.${marketplace.replace(/^amazon\./, 'amazon.')}/dp/${asin}`

  const reviewsHtml = reviews.slice(0, 20).map(r => {
    const stars  = 'â˜…'.repeat(r.rating) + 'â˜†'.repeat(5 - r.rating)
    const color  = r.rating === 1 ? '#dc2626' : '#f05a1e'
    const snippet = (r.body || '').slice(0, 280)
    return `
      <div style="border:1px solid #fecaca;background:#fff5f5;border-radius:10px;padding:12px 14px;margin-bottom:8px;">
        <p style="margin:0 0 4px;font-size:12px;font-weight:700;color:${color};letter-spacing:1px;">${stars} <span style="color:#6b7280;font-weight:500;letter-spacing:0;margin-left:6px;">${r.rating}-star</span></p>
        ${r.title ? `<p style="margin:0 0 4px;font-size:12px;font-weight:700;color:#111;">${h(r.title)}</p>` : ''}
        <p style="margin:0;font-size:12px;color:#374151;line-height:1.5;">${h(snippet)}${snippet.length >= 280 ? 'â€¦' : ''}</p>
      </div>`
  }).join('')

  await resend.emails.send({
    from:    'Voxrate <noreply@voxrate.app>',
    to,
    subject: `New negative reviews for ${safeName} â€” ${count} review${count === 1 ? '' : 's'}`,
    html: `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f9fafb;margin:0;padding:24px;">
  <div style="max-width:560px;margin:0 auto;background:#fff;border-radius:16px;border:1px solid #e5e7eb;overflow:hidden;">
    <div style="background:#111;padding:20px 24px;">
      <span style="font-size:18px;font-weight:900;color:#fff;">Voxrate</span>
      <span style="display:block;font-size:11px;color:#6b7280;margin-top:2px;">Sentiment alert Â· ${frequency}</span>
    </div>
    <div style="padding:24px;">
      <h1 style="font-size:16px;font-weight:700;color:#111;margin:0 0 4px;">${h(productName)}</h1>
      <p style="font-size:12px;color:#6b7280;margin:0 0 18px;">
        ${count} new 1â˜…/2â˜… review${count === 1 ? '' : 's'} detected Â· ASIN <a href="${productHref}" style="color:#6b7280;text-decoration:underline;">${h(asin)}</a>
      </p>
      ${count === 0
        ? `<div style="padding:18px;text-align:center;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:10px;"><p style="margin:0;font-size:13px;color:#15803d;font-weight:600;">No new negative reviews this period.</p></div>`
        : reviewsHtml}
      <a href="${SITE_URL}/dashboard/sentiment-alerts" style="display:block;text-align:center;padding:14px;background:#f05a1e;color:#fff;text-decoration:none;border-radius:10px;font-size:13px;font-weight:700;margin-top:16px;">
        Manage alerts â†’
      </a>
      <p style="font-size:11px;color:#9ca3af;margin:14px 0 0;text-align:center;">${creditsCharged > 0 ? '1 analysis used for this scan.' : ''}</p>
    </div>
    <div style="padding:16px 24px;border-top:1px solid #f3f4f6;text-align:center;">
      <p style="font-size:11px;color:#9ca3af;margin:0;">
        <a href="${SITE_URL}" style="color:#f05a1e;text-decoration:none;">Voxrate</a> â€” Amazon review intelligence
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
    console.warn('[Email] RESEND_API_KEY not set â€” skipping email')
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
        <div style="display:flex;align-items:center;color:#9ca3af;font-size:20px;">â†’</div>
        <div style="flex:1;text-align:center;padding:16px;background:#f9fafb;border-radius:12px;border:2px solid ${scoreColor};">
          <p style="font-size:10px;color:#9ca3af;margin:0 0 4px;text-transform:uppercase;">Now</p>
          <p style="font-size:28px;font-weight:900;color:${scoreColor};margin:0;">${newScore}</p>
        </div>
      </div>

      ${complaintsHtml}

      <a href="${reportUrl}" style="display:block;text-align:center;padding:14px;background:#f05a1e;color:#fff;text-decoration:none;border-radius:10px;font-size:13px;font-weight:700;margin-top:8px;">
        View full report â†’
      </a>
    </div>

    <div style="padding:16px 24px;border-top:1px solid #f3f4f6;text-align:center;">
      <p style="font-size:11px;color:#9ca3af;margin:0;">
        You're receiving this because you're monitoring this listing on
        <a href="${SITE_URL}" style="color:#f05a1e;text-decoration:none;">Voxrate</a>.
        <a href="${SITE_URL}/dashboard/monitor" style="color:#9ca3af;">Manage alerts</a>
      </p>
    </div>
  </div>
</body>
</html>`,
  })
}
