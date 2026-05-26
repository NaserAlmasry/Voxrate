// ============================================================
// app/lib/mistral-fallback.ts
//
// 4-tier fallback chain for quality LLM calls:
//   1. Mistral Large Latest  — primary   (4M tokens/month, best quality)
//   2. Groq llama-3.3-70b   — fallback 1 (free, fast)
//   3. GitHub gpt-4o-mini   — fallback 2 (150 req/day, reliable JSON)
//   4. Mistral Large 2411   — last resort (200B tokens/month)
//
// For extraction/simple tasks: callMistral2411 directly (no fallback needed)
// ============================================================

import Groq from 'groq-sdk'
import { AsyncLocalStorage } from 'async_hooks'

// ── Session token accumulator (improvement #1) ────────────────
interface TokenStore { count: number }
const _tokenStorage = new AsyncLocalStorage<TokenStore>()

export function resetSessionTokens(): void {
  const store = _tokenStorage.getStore()
  if (store) store.count = 0
}
export function getSessionTokens(): number {
  return _tokenStorage.getStore()?.count ?? 0
}
export function runWithSessionTokens<T>(fn: () => Promise<T>): Promise<T> {
  return _tokenStorage.run({ count: 0 }, fn)
}

const MISTRAL_API_URL      = 'https://api.mistral.ai/v1/chat/completions'
const MISTRAL_MODEL_LATEST = 'mistral-large-latest'
const MISTRAL_MODEL_2411   = 'mistral-large-2411'
const GROQ_MODEL           = 'llama-3.3-70b-versatile'
const CEREBRAS_API_URL     = 'https://api.cerebras.ai/v1/chat/completions'
const CEREBRAS_MODEL       = 'gpt-oss-120b'
const GITHUB_API_URL       = 'https://models.inference.ai.azure.com/chat/completions'
const GITHUB_MODEL_GEMINI  = 'gemini-3.5-flash'
const GITHUB_MODEL_MINI    = 'gpt-4o-mini'

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
  const timeoutId  = setTimeout(() => controller.abort(), 35_000)
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
    if (usage) {
      console.log(`[Mistral:${model}] prompt:${usage.prompt_tokens} completion:${usage.completion_tokens} total:${usage.total_tokens}`)
      const _store = _tokenStorage.getStore(); if (_store) _store.count += usage.total_tokens ?? 0
    }
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
  if (usage) {
    console.log(`[Groq:${GROQ_MODEL}] prompt:${usage.prompt_tokens} completion:${usage.completion_tokens} total:${usage.total_tokens}`)
    const _store = _tokenStorage.getStore(); if (_store) _store.count += usage.total_tokens ?? 0
  }
  return res.choices[0]?.message?.content || ''
}

async function callCerebras(messages: Message[], maxTokens: number): Promise<string> {
  const key = process.env.CEREBRAS_API_KEY
  if (!key) throw new Error('CEREBRAS_API_KEY not set')

  const res = await fetch(CEREBRAS_API_URL, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
    body:    JSON.stringify({ model: CEREBRAS_MODEL, max_tokens: maxTokens, temperature: 0.1, messages }),
    signal:  AbortSignal.timeout(30_000),
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`Cerebras ${res.status}: ${body.slice(0, 200)}`)
  }
  const json  = await res.json()
  const usage = json.usage
  if (usage) {
    console.log(`[Cerebras:${CEREBRAS_MODEL}] prompt:${usage.prompt_tokens} completion:${usage.completion_tokens} total:${usage.total_tokens}`)
    const _store = _tokenStorage.getStore(); if (_store) _store.count += usage.total_tokens ?? 0
  }
  return json.choices?.[0]?.message?.content || ''
}

async function callGitHub(model: string, messages: Message[], maxTokens: number): Promise<string> {
  const key = process.env.GITHUB_TOKEN
  if (!key) throw new Error('GITHUB_TOKEN not set')

  const res = await fetch(GITHUB_API_URL, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
    body:    JSON.stringify({ model, max_tokens: maxTokens, temperature: 0.1, messages }),
    signal:  AbortSignal.timeout(30_000),
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`GitHub Models ${res.status}: ${body.slice(0, 200)}`)
  }
  const json  = await res.json()
  const usage = json.usage
  if (usage) {
    console.log(`[GitHub:${model}] prompt:${usage.prompt_tokens} completion:${usage.completion_tokens} total:${usage.total_tokens}`)
    const _store = _tokenStorage.getStore(); if (_store) _store.count += usage.total_tokens ?? 0
  }
  return json.choices?.[0]?.message?.content || ''
}

// ── Direct Mistral 2411 (extraction/simple tasks — no fallback needed) ──

export async function callMistral2411(messages: Message[], maxTokens: number): Promise<string> {
  return callMistral(messages, maxTokens, MISTRAL_MODEL_2411)
}

// ── Quality chain: Mistral Large Latest → Groq 70b → Mistral 2411 ──
// Use this for anything users directly read: complaints, strengths, rewrite, reply, listing.

export async function callMistralLatest(messages: Message[], maxTokens: number): Promise<string> {
  // Retry up to 2 times with 8s delay when all providers are rate-limited simultaneously
  for (let attempt = 0; attempt < 3; attempt++) {
    if (attempt > 0) {
      console.warn(`[LLM] All providers rate-limited — waiting 25s before retry ${attempt}/2`)
      await new Promise(r => setTimeout(r, 25_000))
    }

    // 1. Try Mistral Large Latest
    try {
      return await callMistral(messages, maxTokens, MISTRAL_MODEL_LATEST)
    } catch (err: any) {
      console.warn('[MistralLatest] Failed, falling back to Groq 70b:', err?.message?.slice(0, 100))
    }

    // 2. Try Cerebras gpt-oss-120b (120B params, 3,000 tok/s, 14,400 req/day free)
    try {
      return await callCerebras(messages, maxTokens)
    } catch (err: any) {
      console.warn('[Cerebras] Failed, falling back to Groq:', err?.message?.slice(0, 100))
    }

    // 3. Try Groq llama-3.3-70b (70B params, free)
    try {
      return await callGroq(messages, maxTokens)
    } catch (err: any) {
      console.warn('[Groq] Failed, falling back to GitHub gpt-4o-mini:', err?.message?.slice(0, 100))
    }

    // 4. Try Gemini 3.5 Flash via GitHub Models (beats GPT-4o, same token)
    try {
      return await callGitHub(GITHUB_MODEL_GEMINI, messages, maxTokens)
    } catch (err: any) {
      console.warn('[Gemini3.5Flash] Failed, falling back to gpt-4o-mini:', err?.message?.slice(0, 100))
    }

    // 5. Try gpt-4o-mini via GitHub Models (safety net, 150 req/day)
    try {
      return await callGitHub(GITHUB_MODEL_MINI, messages, maxTokens)
    } catch (err: any) {
      console.warn('[gpt-4o-mini] Failed, falling back to Mistral 2411:', err?.message?.slice(0, 100))
    }

    // 6. Try Mistral 2411
    try {
      return await callMistral(messages, maxTokens, MISTRAL_MODEL_2411)
    } catch (err: any) {
      console.warn('[Mistral2411] Failed:', err?.message?.slice(0, 100))
      if (attempt === 2) throw err
      // attempt < 2: all 6 providers failed this round, retry after delay
    }
  }

  throw new Error('All LLM providers exhausted after 3 attempts')
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

// ── Groq direct (fast, free — good for extraction tasks) ─────
// Use for domain knowledge, classification, and other simple extraction tasks.

export async function callGroqDirect(messages: Message[], maxTokens: number): Promise<string> {
  return callGroq(messages, maxTokens)
}

const GROQ_MODEL_FAST = 'llama-3.1-8b-instant'

export async function callGroqFast(messages: Message[], maxTokens: number): Promise<string> {
  const groq = getGroq()
  const res = await groq.chat.completions.create({
    model: GROQ_MODEL_FAST,
    max_tokens: maxTokens,
    temperature: 0.1,
    messages,
  })
  const usage = res.usage
  if (usage) {
    console.log(`[Groq:${GROQ_MODEL_FAST}] prompt:${usage.prompt_tokens} completion:${usage.completion_tokens} total:${usage.total_tokens}`)
    const _store = _tokenStorage.getStore(); if (_store) _store.count += usage.total_tokens ?? 0
  }
  return res.choices[0]?.message?.content || ''
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
