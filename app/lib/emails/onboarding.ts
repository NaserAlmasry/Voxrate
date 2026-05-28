import { Resend } from 'resend'

const SITE_URL = 'https://voxrate.app'

function baseTemplate(body: string) {
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f9fafb;font-family:'DM Sans',Helvetica,Arial,sans-serif;">
  <div style="max-width:560px;margin:40px auto;background:#fff;border-radius:16px;overflow:hidden;border:1px solid #f3f4f6;">
    <div style="padding:24px 28px 20px;border-bottom:1px solid #f3f4f6;display:flex;align-items:center;gap:10px;">
      <span style="font-size:20px;font-weight:700;color:#111827;letter-spacing:-0.5px;">Voxrate</span>
    </div>
    <div style="padding:28px 28px 20px;font-size:14px;color:#374151;line-height:1.7;">
      ${body}
    </div>
    <div style="padding:16px 28px;border-top:1px solid #f3f4f6;text-align:center;">
      <p style="font-size:11px;color:#9ca3af;margin:0;">
        You're receiving this because you signed up for a free trial at
        <a href="${SITE_URL}" style="color:#f97316;text-decoration:none;">Voxrate</a>.
        &mdash; <a href="${SITE_URL}/dashboard/settings" style="color:#9ca3af;">Manage email preferences</a>
      </p>
    </div>
  </div>
</body>
</html>`
}

function ctaButton(label: string, href: string) {
  return `<a href="${href}" style="display:block;text-align:center;padding:14px;background:#f97316;color:#fff;text-decoration:none;border-radius:10px;font-size:13px;font-weight:700;margin-top:20px;">${label} &#x2192;</a>`
}

export function welcomeEmail(firstName: string) {
  const name = firstName || 'there'
  return {
    subject: 'Your Voxrate trial is live — start here',
    html: baseTemplate(`
      <p style="font-size:18px;font-weight:700;color:#111827;margin:0 0 12px;">Welcome to Voxrate, ${name}.</p>
      <p>Your 14-day trial is active. Here's the fastest way to get value in the next 5 minutes:</p>
      <ol style="padding-left:20px;margin:16px 0;space-y:6px;">
        <li style="margin-bottom:8px;"><strong>Paste any Amazon listing URL</strong> — your own product or a competitor's.</li>
        <li style="margin-bottom:8px;"><strong>Get your listing health score</strong> — graded A through F with a full complaint breakdown.</li>
        <li style="margin-bottom:8px;"><strong>See the exact fixes</strong> — ranked by impact so you know what to work on first.</li>
      </ol>
      <p style="color:#6b7280;font-size:13px;">Your trial includes <strong>10 own-product analyses</strong> and <strong>2 competitor analyses</strong> — enough to benchmark your top listings and spy on your biggest rival.</p>
      ${ctaButton('Analyze your first listing', `${SITE_URL}/dashboard`)}
    `),
  }
}

export function day3Email(firstName: string) {
  const name = firstName || 'there'
  return {
    subject: 'One feature most sellers miss on Voxrate',
    html: baseTemplate(`
      <p style="font-size:16px;font-weight:700;color:#111827;margin:0 0 12px;">Hey ${name} — quick tip.</p>
      <p>Most sellers only analyze their own listings. But your trial also includes <strong>competitor analysis</strong>.</p>
      <p style="margin:16px 0;">Paste any competitor's Amazon URL and Voxrate will surface:</p>
      <ul style="padding-left:20px;margin:0 0 16px;">
        <li style="margin-bottom:6px;">Their most-complained-about weaknesses</li>
        <li style="margin-bottom:6px;">Keywords their buyers use that you may be missing</li>
        <li style="margin-bottom:6px;">How their listing health score compares to yours</li>
      </ul>
      <p style="color:#6b7280;font-size:13px;">It takes 60 seconds and gives you a direct edge to position against them.</p>
      ${ctaButton('Analyze a competitor now', `${SITE_URL}/dashboard`)}
    `),
  }
}

export function trialEndingSoonEmail(firstName: string, daysLeft: number) {
  const name = firstName || 'there'
  const urgency = daysLeft === 1 ? 'expires tomorrow' : `expires in ${daysLeft} days`
  return {
    subject: `Your Voxrate trial ${urgency}`,
    html: baseTemplate(`
      <p style="font-size:16px;font-weight:700;color:#111827;margin:0 0 12px;">Your trial ${urgency}, ${name}.</p>
      <p>After your trial ends, your account moves to the free tier — <strong>1 analysis per month</strong>.</p>
      <p style="margin:16px 0;">Upgrade to keep:</p>
      <ul style="padding-left:20px;margin:0 0 16px;">
        <li style="margin-bottom:6px;"><strong>Starter ($14.99/mo)</strong> — 25 analyses + watchlist + re-analyze</li>
        <li style="margin-bottom:6px;"><strong>Growth ($39.99/mo)</strong> — 60 analyses + competitor + sentiment alerts</li>
        <li style="margin-bottom:6px;"><strong>Pro ($59.99/mo)</strong> — 150 analyses + all features, no cooldown</li>
      </ul>
      <p style="color:#6b7280;font-size:13px;">All plans billed monthly. Cancel anytime. Annual billing saves up to 17%.</p>
      ${ctaButton('Upgrade now', `${SITE_URL}/dashboard/settings`)}
    `),
  }
}

export async function sendOnboardingEmail(
  resendApiKey: string,
  to: string,
  type: 'welcome' | 'day3' | 'trial_ending',
  firstName: string,
  daysLeft?: number,
) {
  const resend = new Resend(resendApiKey)

  const payload =
    type === 'welcome' ? welcomeEmail(firstName) :
    type === 'day3'    ? day3Email(firstName) :
    trialEndingSoonEmail(firstName, daysLeft ?? 2)

  await resend.emails.send({
    from: 'Voxrate <noreply@voxrate.app>',
    to,
    subject: payload.subject,
    html: payload.html,
  })
}
