// ============================================================
// app/lib/mistral-fallback.ts
//
// Mistral Large as a fallback when Groq hits its daily quota.
// Uses Mistral's OpenAI-compatible API — no extra SDK needed.
//
// HOW IT WORKS:
//   callWithFallback() tries Groq first.
//   On 429 (rate limit / quota exhausted), switches to Mistral Large.
//   Transparent to callers — same input/output as callGroq.
//
// ENV VARS:
//   MISTRAL_API_KEY — from console.mistral.ai
// ============================================================

const MISTRAL_API_URL = 'https://api.mistral.ai/v1/chat/completions'
const MISTRAL_MODEL   = 'mistral-large-latest'

export type Message = { role: 'system' | 'user' | 'assistant'; content: string }

function isGroqQuotaError(err: any): boolean {
  const status  = err?.status  ?? err?.statusCode ?? 0
  const message = String(err?.message || err || '')
  return (
    status === 429 ||
    message.includes('rate_limit_exceeded') ||
    message.includes('Rate limit reached') ||
    message.includes('rate limit') ||
    message.includes('quota')
  )
}

async function callMistralLarge(messages: Message[], maxTokens: number): Promise<string> {
  const key = process.env.MISTRAL_API_KEY
  if (!key) throw new Error('MISTRAL_API_KEY not set — cannot use Mistral fallback')

  const res = await fetch(MISTRAL_API_URL, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model:       MISTRAL_MODEL,
      max_tokens:  maxTokens,
      temperature: 0.1,
      messages,
    }),
  })

  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`Mistral API error ${res.status}: ${body.slice(0, 200)}`)
  }

  const json = await res.json()
  const usage = json.usage
  if (usage) {
    console.log(`[Mistral] prompt:${usage.prompt_tokens} completion:${usage.completion_tokens} total:${usage.total_tokens}`)
  }
  return json.choices?.[0]?.message?.content || ''
}

// ── Main export ───────────────────────────────────────────────
// Drop-in wrapper: tries groqFn first, falls back to Mistral Large on quota error.

export async function callWithFallback(
  groqFn: () => Promise<string>,
  messages: Message[],
  maxTokens: number,
): Promise<{ result: string; usedFallback: boolean }> {
  try {
    const result = await groqFn()
    return { result, usedFallback: false }
  } catch (err: any) {
    if (!isGroqQuotaError(err)) throw err

    console.warn('[Fallback] Groq quota hit — switching to Mistral Large')
    const result = await callMistralLarge(messages, maxTokens)
    return { result, usedFallback: true }
  }
}
