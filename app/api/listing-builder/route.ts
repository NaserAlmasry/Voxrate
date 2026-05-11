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
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Please log in first' }, { status: 401 })

  const limit = await enforceRateLimit(user.id, ip)
  if (!limit.allowed) return NextResponse.json({ error: 'Too many requests.' }, { status: 429 })

  const { data: userData } = await supabase.from('users').select('plan, ai_uses').eq('id', user.id).single()
  const plan   = userData?.plan    || 'free'
  const aiUses = userData?.ai_uses ?? 0
  if (plan === 'free' && aiUses >= 1) {
    return NextResponse.json({ error: 'Free plan includes 1 AI generation. Upgrade to continue using this feature.', upgrade: true }, { status: 403 })
  }

  const body        = await request.json()
  const prompt_text = typeof body?.prompt      === 'string' ? body.prompt.trim().slice(0, 1000)   : ''
  const category    = typeof body?.category    === 'string' ? body.category.trim().slice(0, 100)  : ''
  const materials   = typeof body?.materials   === 'string' ? body.materials.trim().slice(0, 300) : ''
  const price       = typeof body?.price       === 'string' ? body.price.trim().slice(0, 50)      : ''

  if (!prompt_text) {
    return NextResponse.json({ error: 'Product description is required' }, { status: 400 })
  }

  if (looksLikeNonsense(prompt_text)) {
    return NextResponse.json({ error: 'The product description doesn\'t look meaningful. Please describe your product properly.' }, { status: 400 })
  }

  const systemPrompt = `You are an expert Etsy listing copywriter with deep knowledge of Etsy SEO.

Product details:
- Description: ${prompt_text}
${category  ? `- Category: ${category}`   : ''}
${materials ? `- Materials: ${materials}` : ''}
${price     ? `- Price: $${price}`        : ''}

Create a complete, optimized Etsy listing. Rules:
- Title: 120-140 chars, front-load main keyword, include material, occasion, and style
- Tags: exactly 13 tags, mix of short (2-3 words) and long-tail (4-5 words) phrases buyers actually search
- Description: 200-300 words, starts with key benefit, short paragraphs, no markdown headers, ends with CTA
- Generate 3 title variations ranked best to worst

Return ONLY valid JSON:
{
  "titles": [
    {"title": "Best title here", "charCount": 132, "why": "Leads with material, includes occasion and style"},
    {"title": "Second option", "charCount": 118, "why": "More direct, shorter"},
    {"title": "Third option", "charCount": 125, "why": "Focuses on buyer intent"}
  ],
  "tags": ["tag one", "tag two", "tag three", "tag four", "tag five", "tag six", "tag seven", "tag eight", "tag nine", "tag ten", "tag eleven", "tag twelve", "tag thirteen"],
  "description": "Full listing description here...",
  "seoTips": ["tip 1", "tip 2", "tip 3"]
}`

  const completion = await groq.chat.completions.create({
    model:       'llama-3.3-70b-versatile',
    max_tokens:  1200,
    temperature: 0.6,
    messages:    [{ role: 'user', content: systemPrompt }],
  })

  const raw = completion.choices[0]?.message?.content || ''
  let parsed: any
  try {
    const match = raw.match(/\{[\s\S]*\}/)
    parsed = match ? JSON.parse(match[0]) : null
  } catch {
    parsed = null
  }

  if (!parsed?.titles || !parsed?.tags || !parsed?.description) {
    return NextResponse.json({ error: 'Failed to generate listing. Please try again.' }, { status: 500 })
  }

  await supabase.from('users').update({ ai_uses: aiUses + 1 }).eq('id', user.id)

  return NextResponse.json(parsed)
}
