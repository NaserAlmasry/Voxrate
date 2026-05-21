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
  chain.select   = vi.fn().mockReturnValue(chain)
  chain.eq       = vi.fn().mockReturnValue(chain)
  chain.single   = vi.fn().mockResolvedValue({ data: returnData, error: null })
  chain.maybeSingle = vi.fn().mockResolvedValue({ data: returnData, error: null })
  chain.update   = vi.fn().mockReturnValue(chain)
  chain.upsert   = vi.fn().mockResolvedValue({ error: null })
  chain.insert   = vi.fn().mockResolvedValue({ error: null })
  chain.delete   = vi.fn().mockReturnValue(chain)
  return chain
}

// ── Tests ────────────────────────────────────────────────────────
describe('Stripe webhook — POST /api/stripe/webhook', () => {

  beforeEach(() => {
    vi.clearAllMocks()
    // Default: event not yet processed
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
      data: { object: { metadata: { user_id: 'u1', type: 'subscription', plan: 'starter', credits: '300' } } },
    })
    // Simulate event already marked processed
    const chain = chainSelect({ processed: true })
    mockFrom.mockReturnValue(chain)

    const res = await POST(makeRequest())
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.received).toBe(true)
    // add_credits should NOT have been called
    expect(mockRpc).not.toHaveBeenCalled()
  })

  // ── checkout.session.completed — subscription ─────────────────
  it('upgrades user to starter plan and adds 300 credits', async () => {
    mockConstructEvent.mockReturnValue({
      id: 'evt_001',
      type: 'checkout.session.completed',
      data: {
        object: {
          metadata: { user_id: 'user_abc', type: 'subscription', plan: 'starter', credits: '300' },
          customer: 'cus_123',
          subscription: 'sub_123',
        },
      },
    })
    mockRetrieveSub.mockResolvedValue({ current_period_end: 9999999999, metadata: {} })

    const updateChain: any = { eq: vi.fn().mockResolvedValue({ error: null }) }
    const selectChain = chainSelect(null)
    const upsertChain = { upsert: vi.fn().mockResolvedValue({ error: null }) }
    const updateFn    = vi.fn().mockReturnValue(updateChain)
    mockFrom.mockImplementation((table: string) => {
      if (table === 'users') return { ...updateChain, update: updateFn, select: vi.fn().mockReturnValue(selectChain) }
      return { ...selectChain, upsert: upsertChain.upsert, update: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) }) }
    })
    mockRpc.mockResolvedValue({ error: null })

    const res = await POST(makeRequest())
    expect(res.status).toBe(200)
    expect(mockRpc).toHaveBeenCalledWith('add_credits', { p_user_id: 'user_abc', p_amount: 300 })
  })

  it('rejects suspicious subscription credit amount above cap', async () => {
    mockConstructEvent.mockReturnValue({
      id: 'evt_002',
      type: 'checkout.session.completed',
      data: {
        object: {
          metadata: { user_id: 'user_abc', type: 'subscription', plan: 'pro', credits: '99999' },
          customer: 'cus_123',
          subscription: 'sub_123',
        },
      },
    })
    mockRetrieveSub.mockResolvedValue({ current_period_end: 9999999999, metadata: {} })

    const updateChain: any = { eq: vi.fn().mockResolvedValue({ error: null }) }
    mockFrom.mockImplementation((table: string) => {
      if (table === 'users') return { update: vi.fn().mockReturnValue(updateChain) }
      return { upsert: vi.fn().mockResolvedValue({ error: null }), update: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) }), select: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }) }) }) }
    })

    const res = await POST(makeRequest())
    expect(res.status).toBe(200)
    // add_credits should NOT be called — amount exceeds cap
    expect(mockRpc).not.toHaveBeenCalledWith('add_credits', expect.objectContaining({ p_amount: 99999 }))
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
  it('resets subscription credits on renewal, preserving pack_credits', async () => {
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
      metadata: { user_id: 'user_abc', plan: 'growth', credits: '800' },
      current_period_end: 9999999999,
    })

    const userWithPackCredits = { pack_credits: 100 }
    const selectChain = chainSelect(userWithPackCredits)
    const updateEq    = vi.fn().mockResolvedValue({ error: null })
    const updateFn    = vi.fn().mockReturnValue({ eq: updateEq })
    mockFrom.mockReturnValue({ ...selectChain, update: updateFn, upsert: vi.fn().mockResolvedValue({ error: null }) })

    const res = await POST(makeRequest())
    expect(res.status).toBe(200)
    // credits = pack_credits (100) + plan_credits (800) = 900
    expect(updateFn).toHaveBeenCalledWith(expect.objectContaining({ credits: 900 }))
  })

  it('skips renewal credit update for non-cycle billing reason', async () => {
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
  it('downgrades to free on cancellation, preserving pack_credits', async () => {
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

    const userWithPack = { pack_credits: 50 }
    const selectChain  = chainSelect(userWithPack)
    const updateEq     = vi.fn().mockResolvedValue({ error: null })
    const updateFn     = vi.fn().mockReturnValue({ eq: updateEq })
    mockFrom.mockReturnValue({ ...selectChain, update: updateFn, upsert: vi.fn().mockResolvedValue({ error: null }) })

    const res = await POST(makeRequest())
    expect(res.status).toBe(200)
    expect(updateFn).toHaveBeenCalledWith(expect.objectContaining({
      plan: 'free',
      credits: 50,
      stripe_current_period_end: null,
    }))
  })

  // ── invoice.payment_failed ────────────────────────────────────
  it('does NOT downgrade or wipe credits on payment failure', async () => {
    mockConstructEvent.mockReturnValue({
      id: 'evt_008',
      type: 'invoice.payment_failed',
      data: {
        object: { subscription: 'sub_abc' },
      },
    })

    const selectChain = chainSelect(null)
    const updateFn    = vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) })
    mockFrom.mockReturnValue({ ...selectChain, update: updateFn, upsert: vi.fn().mockResolvedValue({ error: null }) })

    const res = await POST(makeRequest())
    expect(res.status).toBe(200)
    // No credits update, no plan downgrade
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
