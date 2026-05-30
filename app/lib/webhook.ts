export interface AlertPayload {
  event:        'new_1star_review' | 'score_drop' | 'new_complaint' | 'competitor_complaint'
  asin:         string
  product_name: string
  review_text?: string
  rating?:      number
  old_score?:   number
  new_score?:   number
  complaint?:   string
  timestamp:    string
  report_url:   string
  reply_url?:   string
}

export async function sendWebhookAlert(url: string, payload: AlertPayload): Promise<void> {
  try {
    await fetch(url, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(payload),
      signal:  AbortSignal.timeout(8000),
    })
  } catch (err: any) {
    console.error('[Webhook] Delivery failed:', err.message)
  }
}

export async function sendSlackAlert(webhookUrl: string, payload: AlertPayload): Promise<void> {
  const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://voxrate.app'
  const icon = payload.rating === 1 ? '🚨' : payload.event === 'score_drop' ? '📉' : '⚠️'

  let text = `${icon} *${payload.product_name}*`
  if (payload.rating)     text += `\n⭐ ${payload.rating}-star review`
  if (payload.review_text) text += `\n>${payload.review_text.slice(0, 300)}`
  if (payload.old_score !== undefined && payload.new_score !== undefined)
    text += `\nScore: ${payload.old_score} → ${payload.new_score}`
  if (payload.complaint)  text += `\nNew complaint: ${payload.complaint}`
  text += `\n<${payload.report_url}|View report>`
  if (payload.reply_url)  text += ` | <${payload.reply_url}|Reply on Amazon>`

  try {
    await fetch(webhookUrl, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ text }),
      signal:  AbortSignal.timeout(8000),
    })
  } catch (err: any) {
    console.error('[Slack] Delivery failed:', err.message)
  }
}
