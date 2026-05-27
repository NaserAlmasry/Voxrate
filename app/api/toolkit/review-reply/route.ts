import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/app/lib/supabase/server'
import { callMistralLatest } from '@/app/lib/mistral-fallback'
import { checkCsrf } from '@/app/lib/csrf'
import { enforceRateLimit } from '@/app/lib/rate-limit'
import { getClientIp } from '@/app/lib/ip'
import { escapePromptInput } from '@/app/lib/escape-prompt'

export async function POST(req: NextRequest) {
  const csrfError = checkCsrf(req)
  if (csrfError) return csrfError

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const ip = getClientIp(req)
  const limit = await enforceRateLimit(user.id, ip)
  if (!limit.allowed) return NextResponse.json({ error: 'Too many requests' }, { status: 429 })

  let body: { review_text: string; product_name?: string; asin?: string }
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  const { review_text, product_name, asin } = body
  if (!review_text || review_text.trim().length < 10) {
    return NextResponse.json({ error: 'Review text too short' }, { status: 400 })
  }
  if (review_text.length > 5000) {
    return NextResponse.json({ error: 'Review text too long' }, { status: 400 })
  }

  const productContext = product_name
    ? `Product: ${product_name}${asin ? ` (ASIN: ${asin})` : ''}`
    : asin
    ? `ASIN: ${asin}`
    : 'Amazon product'

  const prompt = `You are an expert Amazon seller response specialist. Generate exactly 3 distinct reply options for the following customer review.

${productContext}

Customer Review:
"${escapePromptInput(review_text.trim())}"

Generate 3 replies with these tones:
1. PROFESSIONAL — polished, formal, empathetic, solution-focused
2. FRIENDLY — warm, conversational, personable, still resolves the issue
3. CONCISE — brief and to the point, 2-3 sentences max

Rules:
- Never be defensive or dismissive
- Always acknowledge the customer's experience
- Offer a concrete next step (contact support, replacement, refund, etc.)
- Do not make up policies or promises you can't keep
- Keep each reply under 150 words
- Do not include the label (Professional/Friendly/Concise) in the reply text itself

Respond with valid JSON only:
{
  "replies": [
    { "tone": "Professional", "text": "..." },
    { "tone": "Friendly", "text": "..." },
    { "tone": "Concise", "text": "..." }
  ]
}`

  try {
    const raw = await callMistralLatest([
      { role: 'user', content: prompt }
    ], 800)

    // Extract JSON from response
    const jsonMatch = raw.match(/\{[\s\S]*\}/)
    if (!jsonMatch) throw new Error('No JSON in response')

    const parsed = JSON.parse(jsonMatch[0]) as { replies: Array<{ tone: string; text: string }> }
    if (!parsed.replies || parsed.replies.length !== 3) throw new Error('Invalid reply structure')

    return NextResponse.json({ replies: parsed.replies })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'LLM error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
