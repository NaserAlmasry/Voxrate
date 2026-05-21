// ============================================================
// app/lib/mistral-fallback.ts
//
// 3-tier fallback chain for quality LLM calls:
//   1. Mistral Large Latest  — primary   (4M tokens/month, best quality)
//   2. Groq llama-3.3-70b   — fallback 1 (free, fast, stronger than 2411)
//   3. Mistral Large 2411   — fallback 2 (200B tokens/month, unlimited backup)
//
// For extraction/simple tasks: callMistral2411 directly (no fallback needed)
// ============================================================

import Groq from 'groq-sdk'

const MISTRAL_API_URL      = 'https://api.mistral.ai/v1/chat/completions'
const MISTRAL_MODEL_LATEST = 'mistral-large-latest'
const MISTRAL_MODEL_2411   = 'mistral-large-2411'
const GROQ_MODEL           = 'llama-3.3-70b-versatile'

export type Message = { role: 'system' | 'user' | 'assistant'; content: string }

let _groq: Groq | null = null
function getGroq(): Groq {
  return _groq ??= new Groq({ apiKey: process.env.GROQ_API_KEY })
}

function isQuotaError(err: any): boolean {
  const status  = err?.status ?? err?.statusCode ?? 0
  const message = String(err?.message || err || '')
  return (
    status === 429 ||
    message.includes('429') ||
    message.includes('rate_limit_exceeded') ||
    message.includes('Rate limit reached') ||
    message.includes('rate limit') ||
    message.includes('quota') ||
    message.includes('insufficient_quota') ||
    message.includes('capacity exceeded') ||
    message.includes('service_tier_capacity')
  )
}

async function callMistral(messages: Message[], maxTokens: number, model: string): Promise<string> {
  const key = process.env.MISTRAL_API_KEY
  if (!key) throw new Error('MISTRAL_API_KEY not set')

  const controller = new AbortController()
  const timeoutId  = setTimeout(() => controller.abort(), 20_000)
  try {
    const res = await fetch(MISTRAL_API_URL, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
      body:    JSON.stringify({ model, max_tokens: maxTokens, temperature: 0.1, messages }),
      signal:  controller.signal,
    })

    if (!res.ok) {
      const body = await res.text().catch(() => '')
      throw new Error(`Mistral ${model} error ${res.status}: ${body.slice(0, 200)}`)
    }

    const json  = await res.json()
    const usage = json.usage
    if (usage) console.log(`[Mistral:${model}] prompt:${usage.prompt_tokens} completion:${usage.completion_tokens} total:${usage.total_tokens}`)
    return json.choices?.[0]?.message?.content || ''
  } finally {
    clearTimeout(timeoutId)
  }
}

async function callGroq(messages: Message[], maxTokens: number): Promise<string> {
  const groq = getGroq()
  const res  = await groq.chat.completions.create({
    model:      GROQ_MODEL,
    max_tokens: maxTokens,
    temperature: 0.1,
    messages,
  })
  const usage = res.usage
  if (usage) console.log(`[Groq:${GROQ_MODEL}] prompt:${usage.prompt_tokens} completion:${usage.completion_tokens} total:${usage.total_tokens}`)
  return res.choices[0]?.message?.content || ''
}

// ── Direct Mistral 2411 (extraction/simple tasks — no fallback needed) ──

export async function callMistral2411(messages: Message[], maxTokens: number): Promise<string> {
  return callMistral(messages, maxTokens, MISTRAL_MODEL_2411)
}

// ── Quality chain: Mistral Large Latest → Groq 70b → Mistral 2411 ──
// Use this for anything users directly read: complaints, strengths, rewrite, reply, listing.

export async function callMistralLatest(messages: Message[], maxTokens: number): Promise<string> {
  // 1. Try Mistral Large Latest — fall through on any error (quota, timeout, capacity)
  try {
    return await callMistral(messages, maxTokens, MISTRAL_MODEL_LATEST)
  } catch (err: any) {
    console.warn('[MistralLatest] Failed, falling back to Groq 70b:', err?.message?.slice(0, 100))
  }

  // 2. Try Groq 70b (stronger than 2411, free, fast)
  try {
    return await callGroq(messages, maxTokens)
  } catch (err: any) {
    console.warn('[Groq] Failed, falling back to Mistral 2411:', err?.message?.slice(0, 100))
  }

  // 3. Last resort — Mistral 2411
  return callMistral(messages, maxTokens, MISTRAL_MODEL_2411)
}

// ── Legacy export used by csv-analysis.ts (callWithFallback) ──────────────
// Kept for backward compatibility — internally uses the same 3-tier chain.

export async function callWithFallback(
  _groqFn: () => Promise<string>,
  messages: Message[],
  maxTokens: number,
): Promise<{ result: string; usedFallback: boolean }> {
  // 1. Try Groq directly (groqFn is provided by caller for backward compat)
  try {
    const result = await _groqFn()
    return { result, usedFallback: false }
  } catch (err: any) {
    if (!isQuotaError(err)) throw err
    console.warn('[Fallback] Groq quota hit — switching to Mistral Large Latest')
  }

  // 2. Try Mistral Large Latest
  try {
    const result = await callMistral(messages, maxTokens, MISTRAL_MODEL_LATEST)
    return { result, usedFallback: true }
  } catch (err: any) {
    if (!isQuotaError(err)) throw err
    console.warn('[Fallback] Mistral Latest quota hit — switching to Mistral 2411')
  }

  // 3. Last resort
  const result = await callMistral(messages, maxTokens, MISTRAL_MODEL_2411)
  return { result, usedFallback: true }
}

// ── Groq rate-limit helpers (used in outer catch blocks for error detection) ──

export interface GroqRateLimitInfo {
  isRateLimit:        boolean
  retryAfterSeconds:  number | null
}

export function getGroqRateLimitInfo(err: any): GroqRateLimitInfo {
  if (!isQuotaError(err)) return { isRateLimit: false, retryAfterSeconds: null }
  const retryAfter = err?.headers?.['retry-after'] ?? err?.headers?.['x-ratelimit-reset-requests']
  return {
    isRateLimit:       true,
    retryAfterSeconds: retryAfter ? parseInt(retryAfter, 10) : null,
  }
}

export function friendlyGroqLimitMessage(retryAfterSeconds: number | null): string {
  if (!retryAfterSeconds) return 'Service is busy. Please try again in a moment.'
  const mins = Math.ceil(retryAfterSeconds / 60)
  return mins <= 1
    ? 'Service is busy. Please try again in about a minute.'
    : `Service is busy. Please try again in about ${mins} minutes.`
}
