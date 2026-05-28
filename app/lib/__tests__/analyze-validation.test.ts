import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// ── Supabase mock ────────────────────────────────────────────────
const mockRpc  = vi.fn().mockResolvedValue({ data: true, error: null })
const mockFrom = vi.fn()
const mockGetUser = vi.fn()
const mockAuth = { getUser: mockGetUser }
const mockSupabase = { from: mockFrom, rpc: mockRpc, auth: mockAuth }

vi.mock('@supabase/supabase-js', () => ({
  createClient: () => mockSupabase,
}))

vi.mock('@/app/lib/supabase/server', () => ({
  createClient: () => Promise.resolve(mockSupabase),
}))

// ── CSRF mock ────────────────────────────────────────────────────
const mockCheckCsrf = vi.fn().mockReturnValue(null)
vi.mock('@/app/lib/csrf', () => ({
  checkCsrf: (req: any) => mockCheckCsrf(req),
}))

// ── Rate-limit mock ──────────────────────────────────────────────
const mockEnforceRateLimit = vi.fn().mockResolvedValue({ allowed: true, resetAt: Date.now() + 60000 })
vi.mock('@/app/lib/rate-limit', () => ({
  MAX_REQUESTS: 30,
  enforceRateLimit: (...args: any[]) => mockEnforceRateLimit(...args),
}))

// ── Cron-auth mock ───────────────────────────────────────────────
vi.mock('@/app/lib/cron-auth', () => ({
  verifyCronRequest: () => ({ isCron: false, error: null }),
}))

// ── Amazon scraper mock ──────────────────────────────────────────
const mockScrapeAmazon = vi.fn()
const mockScrapeAmazonFree = vi.fn()

const FAKE_SCRAPE_RESULT = {
  fromCache: true,
  product: {
    title:         'Test Product',
    price:         29.99,
    averageRating: 4.2,
    asin:          'B073JYC4XM',
    marketplace:   'amazon.com',
    category:      'Electronics',
    mainImage:     'https://example.com/img.jpg',
    imageCount:    5,
    videoCount:    1,
    hasAplus:      true,
    bsr:           1000,
    bsrCategory:   'Electronics',
    recentSales:   null,
    totalReviews:  120,
    ratingBreakdown: { 1: 5, 2: 5, 3: 10, 4: 30, 5: 70 },
  },
  reviews: Array.from({ length: 40 }, (_, i) => ({
    rating:   i % 5 === 0 ? 1 : 4,
    body:     `Review number ${i} — great product overall.`,
    verified: true,
    vine:     false,
  })),
  qa: [],
}

vi.mock('@/app/lib/amazon-scraper', () => ({
  scrapeAmazon:     (...args: any[]) => mockScrapeAmazon(...args),
  scrapeAmazonFree: (...args: any[]) => mockScrapeAmazonFree(...args),
}))

// ── Mistral mock ─────────────────────────────────────────────────
vi.mock('@/app/lib/mistral-fallback', () => ({
  callMistralLatest: vi.fn().mockResolvedValue(
    '{"complaints":[{"title":"Battery issue","description":"Battery dies fast","fixes":["Use quality cells"],"category":"PRODUCTION","count":10,"severity":"high"}]}'
  ),
  callMistral2411: vi.fn().mockResolvedValue(
    '{"complaints":[{"title":"Preview complaint","description":"desc","fixes":[],"category":"PRODUCTION","count":5,"severity":"medium"}],"strengths":[{"title":"Preview strength","description":"desc"}]}'
  ),
  resetSessionTokens:    vi.fn(),
  getSessionTokens:      vi.fn().mockReturnValue(0),
  runWithSessionTokens:  vi.fn().mockImplementation((fn: () => Promise<any>) => fn()),
}))

// ── Other lib mocks ──────────────────────────────────────────────
vi.mock('@/app/lib/health-score', () => ({
  calculateHealthScore: vi.fn().mockReturnValue({
    healthScore: 72, rawHealthScore: 72, verifiedHealthScore: 75,
    fakeReviewFlag: false, penaltyCount: 1, totalReviewCount: 120,
    starCounts: { 1: 5, 2: 5, 3: 10, 4: 30, 5: 70 },
    imageCount: 5, videoCount: 1, hasAplus: true,
    bsr: 1000, bsrCategory: 'Electronics', unansweredQACount: 0,
  }),
  formatHealthScoreForPrompt: vi.fn().mockReturnValue('Health: 72/100'),
  applyHardOverrides:         vi.fn().mockImplementation((v: any) => v),
  validateSemanticConstraints:vi.fn().mockReturnValue([]),
}))

vi.mock('@/app/lib/plan-limits', () => ({
  applyPlanLimits: vi.fn().mockImplementation((report: any) => report),
}))

vi.mock('@/app/lib/domain-knowledge', () => ({
  generateDomainAndSeo: vi.fn().mockResolvedValue({ knowledge: 'domain knowledge', seoThemes: ['theme1', 'theme2', 'theme3'] }),
  extractWorstReviews:  vi.fn().mockReturnValue([]),
  extractBestReviews:   vi.fn().mockReturnValue([]),
}))

vi.mock('@/app/lib/pattern-extractor', () => ({
  extractPatterns:  vi.fn().mockReturnValue({ promptSummary: '' }),
  buildSmartSample: vi.fn().mockImplementation((reviews: any[]) => reviews.slice(0, 60)),
}))

vi.mock('@/app/lib/seo-scorer', () => ({
  calculateSeoScore: vi.fn().mockReturnValue({ score: 65, reasoning: 'ok', topPhrases: ['phrase1', 'phrase2', 'phrase3'] }),
}))

vi.mock('@/app/lib/email', () => ({
  sendReportComplete: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('@/app/lib/extract-json', () => ({
  extractJson: vi.fn().mockImplementation((raw: string) => {
    try { return JSON.parse(raw) } catch { return {} }
  }),
}))

vi.mock('@/app/lib/sanitize-review', () => ({
  sanitizeReview: vi.fn().mockImplementation((t: string) => t),
}))

vi.mock('@/app/lib/complaint-guidance', () => ({
  getComplaintCountGuidance: vi.fn().mockReturnValue('Expect 3-5 complaints.'),
}))

vi.mock('@/app/lib/analysis-prompts', () => ({
  COMPLAINTS_SYSTEM_PROMPT:   'You are a review analyst.',
  FREE_PREVIEW_SYSTEM_PROMPT: 'You are a preview analyst.',
  buildComplaintsPrompt:      vi.fn().mockReturnValue('complaints prompt'),
  buildComplaintsRetryPrompt: vi.fn().mockReturnValue('retry prompt'),
  buildFreePreviewPrompt:     vi.fn().mockReturnValue('free preview prompt'),
}))

// ── Import route AFTER all mocks ─────────────────────────────────
import { POST } from '../../api/analyze/route'

// ── Helpers ──────────────────────────────────────────────────────
function makeRequest(body: object = {}, headers: Record<string, string> = {}) {
  return new NextRequest('http://localhost/api/analyze', {
    method: 'POST',
    headers: {
      'Content-Type':    'application/json',
      'X-Requested-With': 'XMLHttpRequest',
      'origin':           'http://localhost',
      'host':             'localhost',
      ...headers,
    },
    body: JSON.stringify(body),
  })
}

/** Build a chainable Supabase query mock.
 *
 * Operations that may be awaited directly (insert, update, upsert) are made
 * thenable so `await supabase.from(x).insert(...)` resolves to `{ error: null }`.
 * They also expose select/eq/etc. so callers can chain further.
 */
function makeThenable(extraMethods: Record<string, any> = {}) {
  const resolved = { error: null, data: null }
  const obj: any = {
    then:  (res: any, _rej: any) => Promise.resolve(resolved).then(res, _rej),
    catch: (fn: any)             => Promise.resolve(resolved).catch(fn),
    ...extraMethods,
  }
  return obj
}

function buildChain(overrides: Partial<Record<string, any>> = {}) {
  const chain: any = {}
  chain.select      = vi.fn().mockReturnValue(chain)
  chain.eq          = vi.fn().mockReturnValue(chain)
  chain.ilike       = vi.fn().mockReturnValue(chain)
  chain.gte         = vi.fn().mockReturnValue(chain)
  chain.not         = vi.fn().mockReturnValue(chain)
  chain.limit       = vi.fn().mockReturnValue(chain)
  chain.order       = vi.fn().mockReturnValue(chain)
  chain.maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null })
  chain.single      = vi.fn().mockResolvedValue({ data: null, error: null })
  // insert and update return a thenable that also has chain methods (for .select().single())
  chain.insert      = vi.fn().mockReturnValue(makeThenable({ select: vi.fn().mockReturnValue(chain), eq: vi.fn().mockReturnValue(makeThenable()) }))
  chain.update      = vi.fn().mockReturnValue(makeThenable({ eq: vi.fn().mockReturnValue(makeThenable()), select: vi.fn().mockReturnValue(chain) }))
  chain.upsert      = vi.fn().mockResolvedValue({ error: null })
  Object.assign(chain, overrides)
  return chain
}

// ── Tests ────────────────────────────────────────────────────────
describe('POST /api/analyze — input validation and credit-gating', () => {

  beforeEach(() => {
    vi.clearAllMocks()
    mockCheckCsrf.mockReturnValue(null)
    mockEnforceRateLimit.mockResolvedValue({ allowed: true, resetAt: Date.now() + 60000 })
    mockRpc.mockResolvedValue({ data: true, error: null })
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user_123', email: 'test@example.com' } }, error: null })
    mockScrapeAmazon.mockResolvedValue(FAKE_SCRAPE_RESULT)
    mockScrapeAmazonFree.mockResolvedValue(FAKE_SCRAPE_RESULT)

    // Default from() chain: user with analyses remaining on starter plan, no recent reports
    mockFrom.mockImplementation((table: string) => {
      if (table === 'users') {
        const c = buildChain()
        c.single = vi.fn().mockResolvedValue({
          data: { plan: 'starter', is_admin: false, own_analyses_remaining: 25, competitor_analyses_remaining: 3 },
          error: null,
        })
        return c
      }
      if (table === 'reports') {
        const c = buildChain()
        c.maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null })
        c.single      = vi.fn().mockResolvedValue({ data: null, error: null })
        // insert().select().single() → { data: { id: 'report_abc' }, error: null }
        const insertSelectChain: any = {}
        insertSelectChain.single = vi.fn().mockResolvedValue({ data: { id: 'report_abc' }, error: null })
        c.insert = vi.fn().mockReturnValue(makeThenable({ select: vi.fn().mockReturnValue(insertSelectChain) }))
        c.update = vi.fn().mockReturnValue(makeThenable({ eq: vi.fn().mockResolvedValue({ data: null, error: null }) }))
        return c
      }
      return buildChain()
    })
  })

  // ── 1. CSRF check ──────────────────────────────────────────────
  it('returns 403 if CSRF check fails (no X-Requested-With header)', async () => {
    const { NextResponse } = await import('next/server')
    mockCheckCsrf.mockReturnValue(
      NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    )

    const req = makeRequest({ productUrl: 'B073JYC4XM' }, { 'X-Requested-With': '' })
    const res = await POST(req)
    expect(res.status).toBe(403)
    const json = await res.json()
    expect(json.error).toMatch(/forbidden/i)
  })

  // ── 2. Missing URL/ASIN ────────────────────────────────────────
  it('returns 400 if no URL/ASIN provided in body', async () => {
    const req = makeRequest({})
    const res = await POST(req)
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error).toMatch(/url or asin is required/i)
  })

  it('returns 400 if productUrl is empty string', async () => {
    const req = makeRequest({ productUrl: '' })
    const res = await POST(req)
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error).toMatch(/url or asin is required/i)
  })

  // ── 3. Invalid Amazon URL ──────────────────────────────────────
  it('returns 400 if URL is not a valid Amazon URL', async () => {
    const req = makeRequest({ productUrl: 'https://www.google.com/dp/B073JYC4XM' })
    const res = await POST(req)
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error).toMatch(/valid amazon product url or asin/i)
  })

  it('returns 400 for a random non-URL string that is not a bare ASIN', async () => {
    const req = makeRequest({ productUrl: 'not-an-asin-or-url' })
    const res = await POST(req)
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error).toMatch(/valid amazon product url or asin/i)
  })

  // ── 4. Insufficient credits — deduct_credits RPC failure ───────
  it('returns 402-style 403 if user has no analyses remaining', async () => {
    // RPC returns false (atomic check failed — no balance)
    mockRpc.mockResolvedValueOnce({ data: false, error: null })
    mockFrom.mockImplementation((table: string) => {
      if (table === 'users') {
        const c = buildChain()
        c.single = vi.fn().mockResolvedValue({
          data: { plan: 'starter', is_admin: false, own_analyses_remaining: 0, competitor_analyses_remaining: 3 },
          error: null,
        })
        return c
      }
      if (table === 'reports') {
        const c = buildChain()
        c.maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null })
        return c
      }
      return buildChain()
    })

    const req = makeRequest({ productUrl: 'B073JYC4XM' })
    const res = await POST(req)
    expect(res.status).toBe(403)
    const json = await res.json()
    expect(json.upgradeRequired).toBe(true)
    expect(json.error).toMatch(/analyses this month/i)
  })

  it('returns 503 if deduct_own_analysis RPC returns an error', async () => {
    // User has enough analyses but RPC errors
    mockRpc.mockResolvedValue({ data: null, error: { message: 'DB connection error' } })

    const req = makeRequest({ productUrl: 'B073JYC4XM' })
    const res = await POST(req)
    expect(res.status).toBe(503)
    const json = await res.json()
    expect(json.error).toMatch(/could not deduct analysis/i)
  })

  it('returns 403 if deduct_own_analysis RPC returns data=false (insufficient funds)', async () => {
    // RPC succeeds but returns false — means not enough analyses at DB level
    mockRpc.mockResolvedValue({ data: false, error: null })

    const req = makeRequest({ productUrl: 'B073JYC4XM' })
    const res = await POST(req)
    expect(res.status).toBe(403)
    const json = await res.json()
    expect(json.upgradeRequired).toBe(true)
  })

  // ── 5. Happy path — paid user gets 200 with a report ──────────
  it('returns 200 with a report on a valid ASIN for a paid user', async () => {
    const req = makeRequest({ productUrl: 'B073JYC4XM' })
    const res = await POST(req)
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.success).toBe(true)
    expect(json.reportId).toBe('report_abc')
    expect(json.healthScore).toBeDefined()
    expect(typeof json.healthScore).toBe('number')
  })

  it('returns 200 for a valid full Amazon URL', async () => {
    const req = makeRequest({ productUrl: 'https://www.amazon.com/dp/B073JYC4XM' })
    const res = await POST(req)
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.success).toBe(true)
  })

  it('deducts analyses (calls deduct_own_analysis RPC) on successful analysis', async () => {
    const req = makeRequest({ productUrl: 'B073JYC4XM' })
    await POST(req)
    expect(mockRpc).toHaveBeenCalledWith('deduct_own_analysis', {
      p_user_id: 'user_123',
    })
  })

  // ── 6. Free plan users get limited report ─────────────────────
  it('free plan users get a limited report (isLimited: true)', async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === 'users') {
        const c = buildChain()
        c.single = vi.fn().mockResolvedValue({
          data: { plan: 'free', is_admin: false, own_analyses_remaining: 1, competitor_analyses_remaining: 0 },
          error: null,
        })
        return c
      }
      if (table === 'reports') {
        const c = buildChain()
        c.maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null })
        c.single      = vi.fn().mockResolvedValue({ data: null, error: null })
        const freeInsertSelect: any = {}
        freeInsertSelect.single = vi.fn().mockResolvedValue({ data: { id: 'report_free' }, error: null })
        c.insert = vi.fn().mockReturnValue(makeThenable({ select: vi.fn().mockReturnValue(freeInsertSelect) }))
        c.update = vi.fn().mockReturnValue(makeThenable({ eq: vi.fn().mockResolvedValue({ data: null, error: null }) }))
        return c
      }
      return buildChain()
    })

    const req = makeRequest({ productUrl: 'B073JYC4XM' })
    const res = await POST(req)
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.isLimited).toBe(true)
    // Free users should use scrapeAmazonFree (limited scrape)
    expect(mockScrapeAmazonFree).toHaveBeenCalled()
  })

  it('free plan users receive _isLimited:true in the stored report via analyzeFreePreview', async () => {
    // Verify the free preview path is taken by checking scrapeAmazonFree is called
    // and not scrapeAmazon (the paid version)
    mockFrom.mockImplementation((table: string) => {
      if (table === 'users') {
        const c = buildChain()
        c.single = vi.fn().mockResolvedValue({
          data: { plan: 'free', is_admin: false, own_analyses_remaining: 1, competitor_analyses_remaining: 0 },
          error: null,
        })
        return c
      }
      if (table === 'reports') {
        const c = buildChain()
        c.maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null })
        c.single = vi.fn().mockResolvedValue({ data: null, error: null })
        const free2InsertSelect: any = {}
        free2InsertSelect.single = vi.fn().mockResolvedValue({ data: { id: 'report_free2' }, error: null })
        c.insert = vi.fn().mockReturnValue(makeThenable({ select: vi.fn().mockReturnValue(free2InsertSelect) }))
        c.update = vi.fn().mockReturnValue(makeThenable({ eq: vi.fn().mockResolvedValue({ data: null, error: null }) }))
        return c
      }
      return buildChain()
    })

    const req = makeRequest({ productUrl: 'B073JYC4XM' })
    await POST(req)
    expect(mockScrapeAmazon).not.toHaveBeenCalled()
    expect(mockScrapeAmazonFree).toHaveBeenCalled()
  })

  // ── 7. Unauthenticated user ────────────────────────────────────
  it('returns 401 if user is not logged in', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null })

    const req = makeRequest({ productUrl: 'B073JYC4XM' })
    const res = await POST(req)
    expect(res.status).toBe(401)
    const json = await res.json()
    expect(json.error).toMatch(/log in/i)
  })

  // ── 8. Duplicate request protection ───────────────────────────
  it('returns 409 if the same product was analyzed in the last 60 seconds', async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === 'users') {
        const c = buildChain()
        c.single = vi.fn().mockResolvedValue({
          data: { plan: 'starter', is_admin: false, own_analyses_remaining: 25, competitor_analyses_remaining: 3 },
          error: null,
        })
        return c
      }
      if (table === 'reports') {
        const c = buildChain()
        // Return a recent report to trigger 409
        c.maybeSingle = vi.fn().mockResolvedValue({
          data: { id: 'existing_report', status: 'pending' },
          error: null,
        })
        return c
      }
      return buildChain()
    })

    const req = makeRequest({ productUrl: 'B073JYC4XM' })
    const res = await POST(req)
    expect(res.status).toBe(409)
    const json = await res.json()
    expect(json.reportId).toBe('existing_report')
  })
})
