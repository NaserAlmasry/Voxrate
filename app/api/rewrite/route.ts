import { NextRequest, NextResponse } from 'next/server'
import Groq from 'groq-sdk'
import { createClient } from '@/app/lib/supabase/server'
import { enforceRateLimit } from '@/app/lib/rate-limit'
import { checkCsrf } from '@/app/lib/csrf'

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

  const body        = await request.json()
  const description = typeof body?.description === 'string' ? body.description.trim().slice(0, 3000) : ''
  const reportId    = typeof body?.reportId     === 'string' ? body.reportId    : null
  const productName = typeof body?.productName  === 'string' ? body.productName.slice(0, 200) : ''

  if (!description) return NextResponse.json({ error: 'Description is required' }, { status: 400 })

  // Pull SEO keywords from the report if provided
  let keywords: string[] = []
  let complaints: string[] = []
  let strengths: string[] = []

  if (reportId) {
    const { data: report } = await supabase
      .from('reports')
      .select('full_report, user_id')
      .eq('id', reportId)
      .single()

    if (report && report.user_id === user.id) {
      const fr = report.full_report || {}
      keywords   = (fr.seo?.keywords || []).slice(0, 10).map((k: any) => typeof k === 'string' ? k : k.keyword).filter(Boolean)
      complaints = (fr.complaints || []).slice(0, 5).map((c: any) => c.title).filter(Boolean)
      strengths  = (fr.strengths  || []).slice(0, 3).map((s: any) => s.title).filter(Boolean)
    }
  }

  const prompt = `You are an expert Etsy listing copywriter. Rewrite the product description below to maximize conversions and SEO.

Product name: ${productName || 'Etsy product'}
Current description:
"""
${description}
"""

${keywords.length > 0 ? `Target SEO keywords to naturally include: ${keywords.join(', ')}` : ''}
${strengths.length > 0 ? `Key strengths to highlight (from customer reviews): ${strengths.join(', ')}` : ''}
${complaints.length > 0 ? `Known customer concerns to address proactively: ${complaints.join(', ')}` : ''}

Rules:
- Keep the same tone and personality
- Keep it under 500 words
- Use short paragraphs, no walls of text
- Front-load the most important benefit in the first sentence
- Naturally weave in SEO keywords without stuffing
- If there are known complaints, address them positively ("Unlike typical products, ours...")
- End with a clear call to action
- Do NOT use markdown headers or bullet points — write in natural paragraphs

Return ONLY valid JSON:
{
  "rewritten": "the full rewritten description",
  "changes": ["change 1", "change 2", "change 3"],
  "keywordsUsed": ["keyword1", "keyword2"]
}`

  const completion = await groq.chat.completions.create({
    model:       'llama-3.1-8b-instant',
    max_tokens:  1000,
    temperature: 0.6,
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

  if (!parsed?.rewritten) {
    return NextResponse.json({ error: 'Failed to rewrite. Please try again.' }, { status: 500 })
  }

  return NextResponse.json(parsed)
}
