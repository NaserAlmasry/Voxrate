// Run: node scripts/send-test-emails.mjs
// Requires: RESEND_API_KEY env var
// Example: $env:RESEND_API_KEY="re_xxx"; node scripts/send-test-emails.mjs

import { Resend } from 'resend'

const TO      = '1naserbusi@gmail.com'
const API_KEY = process.env.RESEND_API_KEY
const SITE    = 'https://voxrate.app'

if (!API_KEY) {
  console.error('Set RESEND_API_KEY first:\n  $env:RESEND_API_KEY="re_your_key_here"')
  process.exit(1)
}

const resend = new Resend(API_KEY)

function h(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}
function scoreColor(n) { return n >= 66 ? '#22c55e' : n >= 38 ? '#f97316' : '#ef4444' }

// â”€â”€ 1. Weekly Digest â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
async function sendWeeklyDigest() {
  const listings = [
    { productName: 'Bamboo Cutting Board Set (3-Pack)', currentScore: 74, previousScore: 68, topComplaint: 'Warps after dishwasher use', reportId: 'test-report-1' },
    { productName: 'Silicone Spatula Set â€” Heat Resistant', currentScore: 41, previousScore: 55, topComplaint: 'Handle too slippery when wet', reportId: 'test-report-2' },
    { productName: 'Stainless Steel Mixing Bowls (5-Pack)', currentScore: 88, previousScore: 85, topComplaint: null, reportId: 'test-report-3' },
  ]

  const listingsHtml = listings.map(l => {
    const diff = l.previousScore != null ? l.currentScore - l.previousScore : null
    const trend = diff !== null
      ? diff > 0
        ? `<span style="color:#22c55e;font-size:11px;">â–² +${diff} vs last week</span>`
        : diff < 0
        ? `<span style="color:#ef4444;font-size:11px;">â–¼ ${diff} vs last week</span>`
        : `<span style="color:#9ca3af;font-size:11px;">â€” no change</span>`
      : ''

    return `
    <div style="border:1px solid #e5e7eb;border-radius:12px;padding:14px 16px;margin-bottom:10px;">
      <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;">
        <div style="flex:1;min-width:0;">
          <p style="font-size:13px;font-weight:700;color:#111;margin:0 0 2px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${h(l.productName)}</p>
          ${l.topComplaint ? `<p style="font-size:11px;color:#9ca3af;margin:0;">Top issue: ${h(l.topComplaint)}</p>` : '<p style="font-size:11px;color:#22c55e;margin:0;">No major complaints âœ“</p>'}
        </div>
        <div style="text-align:right;flex-shrink:0;">
          <p style="font-size:26px;font-weight:900;color:${scoreColor(l.currentScore)};margin:0;line-height:1;">${l.currentScore}</p>
          <div>${trend}</div>
        </div>
      </div>
      <a href="${SITE}/dashboard/report/${l.reportId}" style="display:inline-block;margin-top:10px;font-size:11px;color:#f97316;text-decoration:none;font-weight:600;">View full report â†’</a>
    </div>`
  }).join('')

  await resend.emails.send({
    from: 'Voxrate <noreply@voxrate.app>',
    to:   TO,
    subject: `Your Voxrate weekly summary â€” ${new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`,
    html: `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f9fafb;margin:0;padding:24px;">
<div style="max-width:520px;margin:0 auto;background:#fff;border-radius:16px;border:1px solid #e5e7eb;overflow:hidden;">

  <div style="background:#111;padding:20px 24px;">
    <span style="font-size:20px;font-weight:900;color:#fff;">Voxrate</span>
    <span style="display:block;font-size:11px;color:#6b7280;margin-top:2px;">Weekly shop digest Â· ${new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</span>
  </div>

  <div style="padding:24px;">
    <h1 style="font-size:15px;font-weight:700;color:#111;margin:0 0 4px;">Good morning, Naser ðŸ‘‹</h1>
    <p style="font-size:13px;color:#6b7280;margin:0 0 20px;">1 of your listings dropped this week â€” here's the full picture.</p>

    ${listingsHtml}

    <div style="background:#fff8f0;border:1px solid #fed7aa;border-radius:12px;padding:14px 16px;margin-top:4px;">
      <p style="font-size:12px;font-weight:700;color:#c2410c;margin:0 0 6px;">ðŸŽ¯ This week's priority action</p>
      <p style="font-size:12px;color:#7c2d12;margin:0;line-height:1.6;">Your Silicone Spatula Set dropped 14 points â€” the "slippery handle" complaint appeared in 23% of 1-star reviews this week. Add a silicone grip texture mention to your bullet points and respond to the top 3 recent complaints to signal engagement to Amazon's algorithm.</p>
    </div>

    <a href="${SITE}/dashboard" style="display:block;text-align:center;padding:14px;background:#111;color:#fff;text-decoration:none;border-radius:10px;font-size:13px;font-weight:700;margin-top:16px;">Open Dashboard â†’</a>
  </div>

  <div style="padding:16px 24px;border-top:1px solid #f3f4f6;text-align:center;">
    <p style="font-size:11px;color:#9ca3af;margin:0;">Weekly digest from <a href="${SITE}" style="color:#f97316;text-decoration:none;">Voxrate</a> Â· <a href="${SITE}/dashboard/settings" style="color:#9ca3af;">Unsubscribe</a></p>
  </div>

</div>
</body></html>`,
  })
  console.log('âœ“ Weekly digest sent')
}

// â”€â”€ 2. Review Attack Alert â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
async function sendAttackAlert() {
  await resend.emails.send({
    from: 'Voxrate <noreply@voxrate.app>',
    to:   TO,
    subject: 'âš ï¸ Possible review attack â€” Bamboo Cutting Board Set',
    html: `<!DOCTYPE html>
<html><head><meta charset="utf-8"></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f9fafb;margin:0;padding:24px;">
<div style="max-width:520px;margin:0 auto;background:#fff;border-radius:16px;border:1px solid #e5e7eb;overflow:hidden;">

  <div style="background:#dc2626;padding:20px 24px;">
    <span style="font-size:18px;font-weight:900;color:#fff;">Voxrate</span>
    <span style="display:block;font-size:11px;color:#fca5a5;margin-top:2px;">Review attack alert</span>
  </div>

  <div style="padding:24px;">
    <h1 style="font-size:16px;font-weight:700;color:#111;margin:0 0 4px;">Possible review attack detected</h1>
    <p style="font-size:13px;color:#6b7280;margin:0 0 20px;">Bamboo Cutting Board Set (B08N5WRWNW) Â· amazon.com</p>

    <div style="display:flex;gap:12px;margin-bottom:20px;">
      <div style="flex:1;text-align:center;padding:16px;background:#fef2f2;border-radius:12px;border:1px solid #fecaca;">
        <p style="font-size:11px;color:#9ca3af;margin:0 0 4px;text-transform:uppercase;">Today</p>
        <p style="font-size:36px;font-weight:900;color:#dc2626;margin:0;line-height:1;">9</p>
        <p style="font-size:11px;color:#dc2626;margin:4px 0 0;">1-star reviews</p>
      </div>
      <div style="display:flex;align-items:center;color:#9ca3af;font-size:18px;">vs</div>
      <div style="flex:1;text-align:center;padding:16px;background:#f9fafb;border-radius:12px;border:1px solid #e5e7eb;">
        <p style="font-size:11px;color:#9ca3af;margin:0 0 4px;text-transform:uppercase;">Daily avg</p>
        <p style="font-size:36px;font-weight:900;color:#6b7280;margin:0;line-height:1;">1.2</p>
        <p style="font-size:11px;color:#6b7280;margin:4px 0 0;">past 7 days</p>
      </div>
    </div>

    <p style="font-size:13px;color:#374151;margin:0 0 16px;background:#fef2f2;padding:12px;border-radius:10px;border-left:3px solid #dc2626;">That's <strong>7.5Ã— your normal rate</strong> â€” this pattern matches coordinated review attacks seen on competing listings in your category.</p>

    <div style="margin-bottom:20px;">
      <p style="font-size:12px;font-weight:700;color:#374151;margin:0 0 8px;">Recommended actions:</p>
      <ol style="margin:0;padding-left:16px;font-size:12px;color:#6b7280;line-height:2;">
        <li>Report to Amazon Seller Support with evidence</li>
        <li>Use Voxrate's Evidence Builder to package the report</li>
        <li>Reply professionally to the suspicious reviews</li>
      </ol>
    </div>

    <a href="${SITE}/dashboard/toolkit" style="display:block;text-align:center;padding:14px;background:#dc2626;color:#fff;text-decoration:none;border-radius:10px;font-size:13px;font-weight:700;">Open Toolkit â†’ Build Evidence Report</a>
  </div>

  <div style="padding:16px 24px;border-top:1px solid #f3f4f6;text-align:center;">
    <p style="font-size:11px;color:#9ca3af;margin:0;"><a href="${SITE}" style="color:#f97316;text-decoration:none;">Voxrate</a> Â· <a href="${SITE}/dashboard/settings" style="color:#9ca3af;">Manage alerts</a></p>
  </div>

</div>
</body></html>`,
  })
  console.log('âœ“ Review attack alert sent')
}

// â”€â”€ 3. Analysis Complete â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
async function sendReportComplete() {
  await resend.emails.send({
    from: 'Voxrate <noreply@voxrate.app>',
    to:   TO,
    subject: 'Your analysis is ready â€” Bamboo Cutting Board Set',
    html: `<!DOCTYPE html>
<html><head><meta charset="utf-8"></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f9fafb;margin:0;padding:24px;">
<div style="max-width:520px;margin:0 auto;background:#fff;border-radius:16px;border:1px solid #e5e7eb;overflow:hidden;">

  <div style="background:#111;padding:20px 24px;">
    <span style="font-size:18px;font-weight:900;color:#fff;">Voxrate</span>
    <span style="display:block;font-size:11px;color:#6b7280;margin-top:2px;">Your analysis is ready</span>
  </div>

  <div style="padding:24px;">
    <h1 style="font-size:16px;font-weight:700;color:#111;margin:0 0 4px;">Bamboo Cutting Board Set (3-Pack)</h1>
    <p style="font-size:12px;color:#6b7280;margin:0 0 24px;">B08N5WRWNW Â· amazon.com Â· 847 reviews analyzed</p>

    <div style="text-align:center;padding:24px;background:#f9fafb;border-radius:12px;border:1px solid #e5e7eb;margin-bottom:20px;">
      <p style="font-size:11px;color:#9ca3af;margin:0 0 4px;text-transform:uppercase;letter-spacing:0.05em;">Health Score</p>
      <p style="font-size:56px;font-weight:900;color:#f97316;margin:0;line-height:1;">74</p>
      <p style="font-size:11px;color:#f97316;margin:4px 0 0;font-weight:600;">Needs work</p>
    </div>

    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:20px;">
      <div style="padding:12px;background:#fef2f2;border-radius:10px;border:1px solid #fecaca;">
        <p style="font-size:10px;color:#9ca3af;margin:0 0 4px;text-transform:uppercase;">Top complaint</p>
        <p style="font-size:12px;font-weight:600;color:#dc2626;margin:0;">Warps after dishwasher</p>
      </div>
      <div style="padding:12px;background:#f0fdf4;border-radius:10px;border:1px solid #bbf7d0;">
        <p style="font-size:10px;color:#9ca3af;margin:0 0 4px;text-transform:uppercase;">Top strength</p>
        <p style="font-size:12px;font-weight:600;color:#15803d;margin:0;">Beautiful presentation</p>
      </div>
    </div>

    <a href="${SITE}/dashboard/report/test-report-1" style="display:block;text-align:center;padding:14px;background:#f97316;color:#fff;text-decoration:none;border-radius:10px;font-size:13px;font-weight:700;">View full report â†’</a>
  </div>

  <div style="padding:16px 24px;border-top:1px solid #f3f4f6;text-align:center;">
    <p style="font-size:11px;color:#9ca3af;margin:0;"><a href="${SITE}" style="color:#f97316;text-decoration:none;">Voxrate</a> â€” Amazon review intelligence</p>
  </div>

</div>
</body></html>`,
  })
  console.log('âœ“ Report complete email sent')
}

// â”€â”€ 4. Hijacker Alert â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
async function sendHijackerAlert() {
  await resend.emails.send({
    from: 'Voxrate <noreply@voxrate.app>',
    to:   TO,
    subject: 'ðŸš¨ Buy Box hijacked â€” Silicone Spatula Set',
    html: `<!DOCTYPE html>
<html><head><meta charset="utf-8"></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f9fafb;margin:0;padding:24px;">
<div style="max-width:520px;margin:0 auto;background:#fff;border-radius:16px;border:1px solid #e5e7eb;overflow:hidden;">

  <div style="background:#7c3aed;padding:20px 24px;">
    <span style="font-size:18px;font-weight:900;color:#fff;">Voxrate</span>
    <span style="display:block;font-size:11px;color:#ddd6fe;margin-top:2px;">Buy Box alert</span>
  </div>

  <div style="padding:24px;">
    <h1 style="font-size:16px;font-weight:700;color:#111;margin:0 0 4px;">Buy Box seller changed</h1>
    <p style="font-size:13px;color:#6b7280;margin:0 0 20px;">Silicone Spatula Set â€” Heat Resistant Â· B07QFK7MH3</p>

    <div style="display:flex;gap:12px;margin-bottom:20px;align-items:center;">
      <div style="flex:1;padding:14px;background:#f9fafb;border-radius:12px;border:1px solid #e5e7eb;text-align:center;">
        <p style="font-size:10px;color:#9ca3af;margin:0 0 6px;text-transform:uppercase;">Was</p>
        <p style="font-size:13px;font-weight:700;color:#111;margin:0;">YourBrand Store</p>
      </div>
      <div style="color:#7c3aed;font-size:22px;font-weight:900;">â†’</div>
      <div style="flex:1;padding:14px;background:#fdf4ff;border-radius:12px;border:2px solid #a855f7;text-align:center;">
        <p style="font-size:10px;color:#9ca3af;margin:0 0 6px;text-transform:uppercase;">Now</p>
        <p style="font-size:13px;font-weight:700;color:#7c3aed;margin:0;">SalesDrop LLC</p>
      </div>
    </div>

    <p style="font-size:12px;color:#6b7280;margin:0 0 16px;">A third-party seller has taken your Buy Box. This usually means they're selling at a lower price or have higher seller metrics. Every sale while this is active goes to them.</p>

    <a href="${SITE}/dashboard/toolkit" style="display:block;text-align:center;padding:14px;background:#7c3aed;color:#fff;text-decoration:none;border-radius:10px;font-size:13px;font-weight:700;">View in Toolkit â†’</a>
  </div>

  <div style="padding:16px 24px;border-top:1px solid #f3f4f6;text-align:center;">
    <p style="font-size:11px;color:#9ca3af;margin:0;"><a href="${SITE}" style="color:#f97316;text-decoration:none;">Voxrate</a> Â· <a href="${SITE}/dashboard/settings" style="color:#9ca3af;">Manage alerts</a></p>
  </div>

</div>
</body></html>`,
  })
  console.log('âœ“ Hijacker alert sent')
}

// â”€â”€ Run all â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
console.log('Sending test emails to', TO, '...\n')
await sendWeeklyDigest()
await sendAttackAlert()
await sendReportComplete()
await sendHijackerAlert()
console.log('\nAll 4 emails sent. Check your inbox.')
