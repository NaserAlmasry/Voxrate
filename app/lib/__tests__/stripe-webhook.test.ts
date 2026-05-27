import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// ── Supabase mock ────────────────────────────────────────────────
const mockRpc  = vi.fn().mockResolvedValue({ error: null })
const mockFrom = vi.fn()
const mockSupabase = { from: mockFrom, rpc: mockRpc }

vi.mock('@supabase/supabase-js', () => ({
  createClient: () => mockSupabase,
}))

// ── Stripe mock ──────────────────────────────────────────────────
const mockConstructEvent = vi.fn()
const mockRetrieveSub    = vi.fn()

vi.mock('stripe', () => {
  class MockStripe {
    webhooks     = { constructEvent: mockConstructEvent }
    subscriptions = { retrieve: mockRetrieveSub }
  }
  return { default: MockStripe }
})

// ── Import route after mocks are in place ────────────────────────
import { POST } from '../../api/stripe/webhook/route'

// ── Helpers ──────────────────────────────────────────────────────
function makeRequest(body = '{}') {
  return new NextRequest('http://localhost/api/stripe/webhook', {
    method: 'POST',
    headers: { 'stripe-signature': 'sig_test' },
    body,
  })
}

function chainSelect(returnData: any) {
  const chain: any = {}
  chain.select      = vi.fn().mockReturnValue(chain)
  chain.eq          = vi.fn().mockReturnValue(chain)
  chain.single      = vi.fn().mockResolvedValue({ data: returnData, error: null })
  chain.maybeSingle = vi.fn().mockResolvedValue({ data: returnData, error: null })
  chain.update      = vi.fn().mockReturnValue(chain)
  chain.upsert      = vi.fn().mockResolvedValue({ error: null })
  chain.insert      = vi.fn().mockResolvedValue({ error: null })
  chain.delete      = vi.fn().mockReturnValue(chain)
  return chain
}

// ── Tests ────────────────────────────────────────────────────────
describe('Stripe webhook — POST /api/stripe/webhook', () => {

  beforeEach(() => {
    vi.clearAllMocks()
    const chain = chainSelect(null)
    mockFrom.mockReturnValue(chain)
  })

  // ── Signature ─────────────────────────────────────────────────
  it('returns 400 when stripe-signature header is missing', async () => {
    const req = new NextRequest('http://localhost/api/stripe/webhook', {
      method: 'POST',
      body: '{}',
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error).toMatch(/missing signature/i)
  })

  it('returns 400 when signature verification fails', async () => {
    mockConstructEvent.mockImplementation(() => { throw new Error('Bad signature') })
    const res = await POST(makeRequest())
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error).toMatch(/invalid signature/i)
  })

  // ── Idempotency ───────────────────────────────────────────────
  it('skips already-processed events', async () => {
    mockConstructEvent.mockReturnValue({
      id: 'evt_already',
      type: 'checkout.session.completed',
      data: { object: { metadata: { user_id: 'u1', type: 'subscription', plan: 'starter' } } },
    })
    const chain = chainSelect({ processed: true })
    mockFrom.mockReturnValue(chain)

    const res = await POST(makeRequest())
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.received).toBe(true)
    expect(mockRpc).not.toHaveBeenCalled()
  })

  // ── checkout.session.completed — subscription ─────────────────
  it('upgrades user to starter plan and sets 25 own + 3 competitor analyses', async () => {
    mockConstructEvent.mockReturnValue({
      id: 'evt_001',
      type: 'checkout.session.completed',
      data: {
        object: {
          metadata: { user_id: 'user_abc', type: 'subscription', plan: 'starter' },
          customer: 'cus_123',
          subscription: 'sub_123',
        },
      },
    })
    mockRetrieveSub.mockResolvedValue({ current_period_end: 9999999999, metadata: {} })

    const updateEq  = vi.fn().mockResolvedValue({ error: null })
    const updateFn  = vi.fn().mockReturnValue({ eq: updateEq })
    const selectChain = chainSelect(null)
    mockFrom.mockImplementation((table: string) => {
      if (table === 'users') return { update: updateFn, select: vi.fn().mockReturnValue(selectChain) }
      return { ...selectChain, upsert: vi.fn().mockResolvedValue({ error: null }), update: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) }) }
    })

    const res = await POST(makeRequest())
    expect(res.status).toBe(200)
    // First update: plan + stripe IDs
    expect(updateFn).toHaveBeenCalledWith(expect.objectContaining({ plan: 'starter' }))
    // Second update: analyses remaining
    expect(updateFn).toHaveBeenCalledWith(expect.objectContaining({
      own_analyses_remaining: 25,
      competitor_analyses_remaining: 3,
    }))
  })

  it('upgrades user to pro plan and sets 150 own + 40 competitor analyses', async () => {
    mockConstructEvent.mockReturnValue({
      id: 'evt_001b',
      type: 'checkout.session.completed',
      data: {
        object: {
          metadata: { user_id: 'user_abc', type: 'subscription', plan: 'pro' },
          customer: 'cus_123',
          subscription: 'sub_123',
        },
      },
    })
    mockRetrieveSub.mockResolvedValue({ current_period_end: 9999999999, metadata: {} })

    const updateEq  = vi.fn().mockResolvedValue({ error: null })
    const updateFn  = vi.fn().mockReturnValue({ eq: updateEq })
    const selectChain = chainSelect(null)
    mockFrom.mockImplementation((table: string) => {
      if (table === 'users') return { update: updateFn, select: vi.fn().mockReturnValue(selectChain) }
      return { ...selectChain, upsert: vi.fn().mockResolvedValue({ error: null }), update: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) }) }
    })

    const res = await POST(makeRequest())
    expect(res.status).toBe(200)
    expect(updateFn).toHaveBeenCalledWith(expect.objectContaining({
      own_analyses_remaining: 150,
      competitor_analyses_remaining: 40,
    }))
  })

  // ── checkout.session.completed — credit pack ──────────────────
  it('adds pack credits on credit_pack purchase', async () => {
    mockConstructEvent.mockReturnValue({
      id: 'evt_003',
      type: 'checkout.session.completed',
      data: {
        object: {
          metadata: { user_id: 'user_abc', type: 'credit_pack', credits: '300' },
          customer: 'cus_123',
        },
      },
    })

    const selectChain = chainSelect(null)
    mockFrom.mockReturnValue({ ...selectChain, upsert: vi.fn().mockResolvedValue({ error: null }), update: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) }) })
    mockRpc.mockResolvedValue({ error: null })

    const res = await POST(makeRequest())
    expect(res.status).toBe(200)
    expect(mockRpc).toHaveBeenCalledWith('add_pack_credits', { p_user_id: 'user_abc', p_amount: 300 })
  })

  it('rejects pack credit amount above cap (700)', async () => {
    mockConstructEvent.mockReturnValue({
      id: 'evt_004',
      type: 'checkout.session.completed',
      data: {
        object: {
          metadata: { user_id: 'user_abc', type: 'credit_pack', credits: '9999' },
        },
      },
    })
    const selectChain = chainSelect(null)
    mockFrom.mockReturnValue({ ...selectChain, upsert: vi.fn().mockResolvedValue({ error: null }), update: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) }) })

    const res = await POST(makeRequest())
    expect(res.status).toBe(200)
    expect(mockRpc).not.toHaveBeenCalledWith('add_pack_credits', expect.objectContaining({ p_amount: 9999 }))
  })

  // ── invoice.payment_succeeded — renewal ───────────────────────
  it('calls renew_analyses_with_rollover RPC on subscription cycle renewal', async () => {
    mockConstructEvent.mockReturnValue({
      id: 'evt_005',
      type: 'invoice.payment_succeeded',
      data: {
        object: {
          subscription: 'sub_abc',
          billing_reason: 'subscription_cycle',
        },
      },
    })
    mockRetrieveSub.mockResolvedValue({
      metadata: { user_id: 'user_abc', plan: 'growth' },
      current_period_end: 9999999999,
    })

    const updateEq = vi.fn().mockResolvedValue({ error: null })
    const updateFn = vi.fn().mockReturnValue({ eq: updateEq })
    mockFrom.mockReturnValue({ update: updateFn, upsert: vi.fn().mockResolvedValue({ error: null }), select: vi.fn().mockReturnValue(chainSelect(null)) })
    mockRpc.mockResolvedValue({ error: null })

    const res = await POST(makeRequest())
    expect(res.status).toBe(200)
    expect(mockRpc).toHaveBeenCalledWith('renew_analyses_with_rollover', {
      p_user_id:            'user_abc',
      p_own_monthly:        60,
      p_competitor_monthly: 15,
      p_rollover_cap:       2,
    })
  })

  it('skips renewal for non-cycle billing reason', async () => {
    mockConstructEvent.mockReturnValue({
      id: 'evt_006',
      type: 'invoice.payment_succeeded',
      data: {
        object: {
          subscription: 'sub_abc',
          billing_reason: 'subscription_create',
        },
      },
    })
    const res = await POST(makeRequest())
    expect(res.status).toBe(200)
    expect(mockRpc).not.toHaveBeenCalled()
  })

  // ── customer.subscription.deleted — cancellation ─────────────
  it('downgrades to free and zeros analyses on cancellation', async () => {
    mockConstructEvent.mockReturnValue({
      id: 'evt_007',
      type: 'customer.subscription.deleted',
      data: {
        object: {
          id: 'sub_abc',
          metadata: { user_id: 'user_abc' },
        },
      },
    })

    const updateEq = vi.fn().mockResolvedValue({ error: null })
    const updateFn = vi.fn().mockReturnValue({ eq: updateEq })
    mockFrom.mockReturnValue({ update: updateFn, upsert: vi.fn().mockResolvedValue({ error: null }), select: vi.fn().mockReturnValue(chainSelect(null)) })

    const res = await POST(makeRequest())
    expect(res.status).toBe(200)
    expect(updateFn).toHaveBeenCalledWith(expect.objectContaining({
      plan: 'free',
      own_analyses_remaining: 0,
      competitor_analyses_remaining: 0,
      stripe_current_period_end: null,
    }))
  })

  // ── invoice.payment_failed ────────────────────────────────────
  it('does NOT downgrade on payment failure', async () => {
    mockConstructEvent.mockReturnValue({
      id: 'evt_008',
      type: 'invoice.payment_failed',
      data: {
        object: { subscription: 'sub_abc' },
      },
    })

    const updateFn = vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) })
    mockFrom.mockReturnValue({ update: updateFn, upsert: vi.fn().mockResolvedValue({ error: null }), select: vi.fn().mockReturnValue(chainSelect(null)) })

    const res = await POST(makeRequest())
    expect(res.status).toBe(200)
    expect(updateFn).not.toHaveBeenCalledWith(expect.objectContaining({ plan: 'free' }))
    expect(mockRpc).not.toHaveBeenCalled()
  })

  // ── Unknown event type ────────────────────────────────────────
  it('returns 200 and received:true for unknown event types', async () => {
    mockConstructEvent.mockReturnValue({
      id: 'evt_009',
      type: 'payment_intent.created',
      data: { object: {} },
    })
    const selectChain = chainSelect(null)
    mockFrom.mockReturnValue({ ...selectChain, upsert: vi.fn().mockResolvedValue({ error: null }), update: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) }) })

    const res = await POST(makeRequest())
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.received).toBe(true)
  })
})
