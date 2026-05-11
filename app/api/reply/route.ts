import { NextRequest, NextResponse } from 'next/server'
import Groq from 'groq-sdk'
import { createClient } from '@/app/lib/supabase/server'
import { enforceRateLimit } from '@/app/lib/rate-limit'
import { checkCsrf } from '@/app/lib/csrf'
import { looksLikeNonsense } from '@/app/lib/text-validation'

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY })

export async function POST(request: NextRequest) {
  const csrfError = checkCsrf(request)
  if (csrfError) return csrfError

  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'

  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Please log in first' }, { status: 401 })

    const limit = await enforceRateLimit(user.id, ip)
    if (!limit.allowed) {
      return NextResponse.json({ error: 'Too many requests. Please wait a moment.' }, { status: 429 })
    }

    const { data: userData } = await supabase.from('users').select('plan, ai_uses').eq('id', user.id).single()
    const plan    = userData?.plan    || 'free'
    const aiUses  = userData?.ai_uses ?? 0
    if (plan === 'free' && aiUses >= 1) {
      return NextResponse.json({ error: 'Free plan includes 1 AI generation. Upgrade to continue using this feature.', upgrade: true }, { status: 403 })
    }

    const body        = await request.json()
    const reviewText  = typeof body?.review       === 'string' ? body.review.trim().slice(0, 1000)       : ''
    const productName = typeof body?.productName  === 'string' ? body.productName.trim().slice(0, 200)   : 'our product'
    const sellerName  = typeof body?.sellerName   === 'string' ? body.sellerName.trim().slice(0, 100)    : ''
    const rating      = typeof body?.rating       === 'number' ? Math.min(5, Math.max(1, body.rating))   : 1

    if (!reviewText) {
      return NextResponse.json({ error: 'Review text is required' }, { status: 400 })
    }

    if (looksLikeNonsense(reviewText)) {
      return NextResponse.json({ error: 'The review text doesn\'t look like a real customer review. Please paste an actual review.' }, { status: 400 })
    }

    const tone = rating <= 2 ? 'empathetic and professional, focused on making things right' : 'warm and appreciative'

    const prompt = `You are an experienced Etsy seller writing a reply to a customer review.

Product: ${productName}
${sellerName ? `Seller name: ${sellerName}` : ''}
Star rating: ${rating}/5
Customer review: "${reviewText}"

Write 3 different reply options. Each should be:
- ${tone}
- 2-4 sentences max
- Natural, human, not corporate
- Never defensive or argumentative
- Specific to what the customer said
${rating <= 2 ? '- Offer to make it right if appropriate' : '- Express genuine gratitude'}

Return ONLY valid JSON in this exact format:
{
  "replies": [
    { "tone": "Empathetic", "text": "..." },
    { "tone": "Professional", "text": "..." },
    { "tone": "Personal", "text": "..." }
  ]
}`

    const completion = await groq.chat.completions.create({
      model:       'llama-3.1-8b-instant',
      max_tokens:  600,
      temperature: 0.7,
      messages:    [{ role: 'user', content: prompt }],
    })

    const raw = completion.choices[0]?.message?.content || ''

    let parsed: any
    try {
      const jsonMatch = raw.match(/\{[\s\S]*\}/)
      parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : null
    } catch {
      parsed = null
    }

    if (!parsed?.replies || !Array.isArray(parsed.replies)) {
      return NextResponse.json({ error: 'Failed to generate replies. Please try again.' }, { status: 500 })
    }

    await supabase.from('users').update({ ai_uses: aiUses + 1 }).eq('id', user.id)

    return NextResponse.json({ replies: parsed.replies })

  } catch (err: any) {
    console.error('[Reply] Error:', err.message)
    return NextResponse.json({ error: 'Failed to generate replies. Please try again.' }, { status: 500 })
  }
}
