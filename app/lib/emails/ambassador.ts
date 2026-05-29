import { Resend } from 'resend'

const SITE_URL = 'https://voxrate.app'

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
    <p style="font-size:18px;font-weight:700;color:#111827;margin:0 0 12px;">Welcome aboard, ${name}.</p>
    <p>You're officially a Voxrate Ambassador. Your 3-month internship starts today.</p>
    <p style="margin:16px 0;"><strong>Your referral link:</strong></p>
    <div style="padding:12px;background:#fff7ed;border:1px solid #fed7aa;border-radius:8px;font-family:monospace;font-size:13px;color:#9a3412;word-break:break-all;">${link}</div>
    <p style="margin:16px 0;">You earn <strong>30% commission</strong> on every paying customer you refer — for as long as they stay subscribed.</p>
    <p style="color:#6b7280;font-size:13px;">Your dashboard tracks clicks, signups, customers, and earnings in real time.</p>
    ${ctaButton('Open your dashboard', `${SITE_URL}/careers/dashboard`)}
  `)
  await getResend().emails.send({ from: 'Voxrate <noreply@voxrate.app>', to, subject: 'Welcome to Voxrate Ambassadors', html })
}

export async function sendAmbassadorDay2(to: string, name: string) {
  const html = baseTemplate(`
    <p style="font-size:16px;font-weight:700;color:#111827;margin:0 0 12px;">${name}, here's where Amazon sellers hang out.</p>
    <p>Your link works best where your audience already lives. Start here:</p>
    <ul style="padding-left:20px;margin:0 0 16px;">
      <li style="margin-bottom:8px;"><strong>r/FulfillmentByAmazon</strong> — answer questions; mention Voxrate when relevant.</li>
      <li style="margin-bottom:8px;"><strong>Facebook groups</strong> — "Amazon FBA Sellers", "Amazon Private Label" (100k+ members each).</li>
      <li style="margin-bottom:8px;"><strong>LinkedIn</strong> — search "Amazon seller" and connect; soft intro after 2 messages.</li>
      <li style="margin-bottom:8px;"><strong>Twitter/X</strong> — search "FBA" and reply to sellers asking about reviews or listings.</li>
    </ul>
    <p style="color:#6b7280;font-size:13px;">Be helpful first. Recommendations land 10x better than pitches.</p>
    ${ctaButton('Open your dashboard', `${SITE_URL}/careers/dashboard`)}
  `)
  await getResend().emails.send({ from: 'Voxrate <noreply@voxrate.app>', to, subject: 'Where to find Amazon sellers (Day 2)', html })
}

export async function sendAmbassadorDay5(to: string, name: string, referralCode: string) {
  const link = `${SITE_URL}/?ref=${referralCode}`
  const html = baseTemplate(`
    <p style="font-size:16px;font-weight:700;color:#111827;margin:0 0 12px;">${name}, here's a copy-paste message that works.</p>
    <p>Send this to any Amazon seller you find on LinkedIn, Facebook, or via DM:</p>
    <div style="padding:14px;background:#f9fafb;border-left:3px solid #f05a1e;border-radius:6px;font-size:13px;color:#374151;line-height:1.6;">
      Hey &mdash; saw you sell on Amazon. Quick tip: there's a tool called Voxrate that scans your reviews and gives you a listing health score plus the exact complaints buyers have. Free trial. I've been using it to spot the issues my competitors miss. Here's my link if you want to try it: ${link}
    </div>
    <p style="margin:16px 0;color:#6b7280;font-size:13px;">Personalize the first line. Keep the rest exactly as is &mdash; it's tested.</p>
    ${ctaButton('Open your dashboard', `${SITE_URL}/careers/dashboard`)}
  `)
  await getResend().emails.send({ from: 'Voxrate <noreply@voxrate.app>', to, subject: 'A message that converts (Day 5)', html })
}

export async function sendAmbassadorDay10(to: string, name: string) {
  const html = baseTemplate(`
    <p style="font-size:16px;font-weight:700;color:#111827;margin:0 0 12px;">${name} &mdash; your first sale checklist.</p>
    <p>Most ambassadors who get a first sale by day 14 hit it through this exact sequence:</p>
    <ol style="padding-left:20px;margin:16px 0;">
      <li style="margin-bottom:8px;">Post 1 helpful comment in r/FulfillmentByAmazon (no link).</li>
      <li style="margin-bottom:8px;">DM 5 sellers from that thread with the Day 5 template.</li>
      <li style="margin-bottom:8px;">Share your link in 2 Facebook groups as a "this helped me" recommendation.</li>
      <li style="margin-bottom:8px;">Reply to 3 tweets from Amazon sellers asking about reviews.</li>
      <li style="margin-bottom:8px;">Follow up with anyone who clicked but didn't subscribe (your dashboard shows clicks).</li>
    </ol>
    <p style="color:#6b7280;font-size:13px;">Volume + patience. Most sales come from people who clicked 2-3 weeks earlier.</p>
    ${ctaButton('Open your dashboard', `${SITE_URL}/careers/dashboard`)}
  `)
  await getResend().emails.send({ from: 'Voxrate <noreply@voxrate.app>', to, subject: 'Your first-sale checklist (Day 10)', html })
}

export async function sendAmbassadorDay20(to: string, name: string) {
  const html = baseTemplate(`
    <p style="font-size:16px;font-weight:700;color:#111827;margin:0 0 12px;">${name}, just checking in.</p>
    <p>You're 20 days into your Voxrate internship. How's it going?</p>
    <p>If you're stuck, hit reply &mdash; I personally read every response. Tell me what's working and what isn't and I'll send back a strategy that fits.</p>
    <p style="margin:16px 0;">A few ambassadors who got going late ended up among our top earners. There's plenty of time.</p>
    ${ctaButton('Open your dashboard', `${SITE_URL}/careers/dashboard`)}
  `)
  await getResend().emails.send({ from: 'Voxrate <noreply@voxrate.app>', to, subject: 'How is it going, ' + name + '?', html })
}
