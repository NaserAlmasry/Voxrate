import { Resend } from 'resend'

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://voxrate.app'

function baseTemplate(body: string) {
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f9fafb;font-family:'DM Sans',Helvetica,Arial,sans-serif;">
  <div style="max-width:560px;margin:40px auto;background:#fff;border-radius:16px;overflow:hidden;border:1px solid #f3f4f6;">
    <div style="padding:24px 28px 20px;border-bottom:1px solid #f3f4f6;">
      <span style="font-size:20px;font-weight:700;color:#111827;letter-spacing:-0.5px;">Voxrate Ambassadors</span>
    </div>
    <div style="padding:28px 28px 20px;font-size:14px;color:#374151;line-height:1.7;">
      ${body}
    </div>
    <div style="padding:16px 28px;border-top:1px solid #f3f4f6;text-align:center;">
      <p style="font-size:11px;color:#9ca3af;margin:0;">
        Voxrate Ambassador Program &mdash; <a href="${SITE_URL}/careers/dashboard" style="color:#f05a1e;text-decoration:none;">Open dashboard</a>
      </p>
    </div>
  </div>
</body>
</html>`
}

function ctaButton(label: string, href: string) {
  return `<a href="${href}" style="display:block;text-align:center;padding:14px;background:#f05a1e;color:#fff;text-decoration:none;border-radius:10px;font-size:13px;font-weight:700;margin-top:20px;">${label} &#x2192;</a>`
}

function getResend() {
  const key = process.env.RESEND_API_KEY
  if (!key) throw new Error('RESEND_API_KEY missing')
  return new Resend(key)
}

export async function sendAmbassadorWelcome(to: string, name: string, referralCode: string) {
  const link = `${SITE_URL}/?ref=${referralCode}`
  const html = baseTemplate(`
    <p style="font-size:18px;font-weight:700;color:#111827;margin:0 0 12px;">Welcome, ${name}. We're glad you're here.</p>
    <p>You've taken the first step toward building real marketing experience — backed by a product people love, real earnings that grow with your effort, and a team that's with you every step of the way.</p>

    <p style="margin:20px 0 8px;"><strong>Your personal referral link is live and ready:</strong></p>
    <div style="padding:12px;background:#fff7ed;border:1px solid #fed7aa;border-radius:8px;font-family:monospace;font-size:13px;color:#9a3412;word-break:break-all;">${link}</div>
    <p style="margin:12px 0;color:#6b7280;font-size:13px;">Share it with Amazon sellers and earn commission on every customer you refer — recurring every month for as long as they stay subscribed.</p>

    <p style="margin:20px 0 10px;"><strong>What you earn per referred customer:</strong></p>
    <table style="width:100%;border-collapse:collapse;font-size:13px;">
      <tr style="background:#f9fafb;">
        <td style="padding:10px 12px;border:1px solid #f3f4f6;font-weight:600;">Starter plan</td>
        <td style="padding:10px 12px;border:1px solid #f3f4f6;color:#f05a1e;font-weight:700;">$4.99/month per referred customer</td>
      </tr>
      <tr>
        <td style="padding:10px 12px;border:1px solid #f3f4f6;font-weight:600;">Growth plan</td>
        <td style="padding:10px 12px;border:1px solid #f3f4f6;color:#f05a1e;font-weight:700;">$14.99/month per referred customer</td>
      </tr>
      <tr style="background:#f9fafb;">
        <td style="padding:10px 12px;border:1px solid #f3f4f6;font-weight:600;">Pro plan</td>
        <td style="padding:10px 12px;border:1px solid #f3f4f6;color:#f05a1e;font-weight:700;">$23.99/month per referred customer</td>
      </tr>
    </table>
    <p style="margin:12px 0;color:#6b7280;font-size:13px;">Your dashboard shows your clicks, signups, paying customers, and earnings updated in real time.</p>

    ${ctaButton('Open your dashboard', `${SITE_URL}/careers/dashboard`)}

    <p style="margin:24px 0 8px;"><strong>A few things to know:</strong></p>
    <ul style="padding-left:20px;margin:0;color:#374151;">
      <li style="margin-bottom:8px;">Your 3-month internship starts from today</li>
      <li style="margin-bottom:8px;">You'll receive a certificate of completion at the end</li>
      <li style="margin-bottom:8px;">Top performers get a path to a full-time role</li>
      <li style="margin-bottom:8px;">Want free Voxrate Pro access? Just email us at <a href="mailto:support@voxrate.app" style="color:#f05a1e;">support@voxrate.app</a> and we'll activate it for you — get to know the product firsthand</li>
    </ul>

    <p style="margin:24px 0 0;padding:16px;background:#f9fafb;border-radius:10px;font-size:13px;color:#374151;">
      Hit a wall? Have a question? Email us at <a href="mailto:support@voxrate.app" style="color:#f05a1e;font-weight:600;">support@voxrate.app</a> — we read every message personally and will get back to you.
    </p>

    <p style="margin:20px 0 0;color:#6b7280;font-size:13px;">We want to see you succeed. Let's build something together.</p>
    <p style="margin:6px 0 0;color:#111827;font-weight:600;font-size:13px;">— The Voxrate Team</p>
  `)
  await getResend().emails.send({ from: 'Voxrate <noreply@voxrate.app>', to, subject: "You're in — Welcome to Voxrate Ambassadors", html })
}
