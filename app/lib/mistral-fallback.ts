// ============================================================
// app/lib/mistral-fallback.ts
//
// 3-tier fallback chain for LLM calls:
//   1. Groq 70b           — primary (free, fast)
//   2. Mistral Large Latest — fallback 1 (better quality, 4M tokens/month)
//   3. Mistral Large 2411  — fallback 2 (200B tokens/month, unlimited backup)
//
// ENV VARS:
//   MISTRAL_API_KEY — from console.mistral.ai
// ============================================================

const MISTRAL_API_URL      = 'https://api.mistral.ai/v1/chat/completions'
const MISTRAL_MODEL_LATEST = 'mistral-large-latest'  // 4M tokens/month — better quality
const MISTRAL_MODEL_2411   = 'mistral-large-2411'    // 200B tokens/month — unlimited backup

export type Message = { role: 'system' | 'user' | 'assistant'; content: string }

function isQuotaError(err: any): boolean {
  const status  = err?.status ?? err?.statusCode ?? 0
  const message = String(err?.message || err || '')
  return (
    status === 429 ||
    message.includes('rate_limit_exceeded') ||
    message.includes('Rate limit reached') ||
    message.includes('rate limit') ||
    message.includes('quota') ||
    message.includes('insufficient_quota')
  )
}

async function callMistral(messages: Message[], maxTokens: number, model: string): Promise<string> {
  const key = process.env.MISTRAL_API_KEY
  if (!key) throw new Error('MISTRAL_API_KEY not set — cannot use Mistral fallback')

  const res = await fetch(MISTRAL_API_URL, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
    body: JSON.stringify({ model, max_tokens: maxTokens, temperature: 0.1, messages }),
  })

  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`Mistral ${model} error ${res.status}: ${body.slice(0, 200)}`)
  }

  const json = await res.json()
  const usage = json.usage
  if (usage) console.log(`[Mistral:${model}] prompt:${usage.prompt_tokens} completion:${usage.completion_tokens} total:${usage.total_tokens}`)
  return json.choices?.[0]?.message?.content || ''
}

// ── Main export ───────────────────────────────────────────────

export async function callWithFallback(
  groqFn: () => Promise<string>,
  messages: Message[],
  maxTokens: number,
): Promise<{ result: string; usedFallback: boolean }> {
  // 1. Try Groq
  try {
    const result = await groqFn()
    return { result, usedFallback: false }
  } catch (err: any) {
    if (!isQuotaError(err)) throw err
    console.warn('[Fallback] Groq quota hit — switching to Mistral Large Latest')
  }

  // 2. Try Mistral Large Latest (4M tokens/month)
  try {
    const result = await callMistral(messages, maxTokens, MISTRAL_MODEL_LATEST)
    return { result, usedFallback: true }
  } catch (err: any) {
    if (!isQuotaError(err)) throw err
    console.warn('[Fallback] Mistral Latest quota hit — switching to Mistral Large 2411')
  }

  // 3. Last resort — Mistral Large 2411 (200B tokens/month)
  const result = await callMistral(messages, maxTokens, MISTRAL_MODEL_2411)
  return { result, usedFallback: true }
}
