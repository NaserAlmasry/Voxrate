import { describe, it, expect } from 'vitest'
import { applyPlanLimits } from '../plan-limits'

const fullReport = {
  complaints:      [{ title: 'c1' }, { title: 'c2' }, { title: 'c3' }],
  strengths:       [{ title: 's1' }, { title: 's2' }],
  improvements:    [{ title: 'i1' }],
  marketingCopy:   ['copy1', 'copy2'],
  reviewTemplates: ['t1'],
  topActions:      ['a1', 'a2', 'a3'],
  seo:             { score: 80, magicKeywords: ['keyword'] },
  healthScore:     75,
}

describe('applyPlanLimits — free plan', () => {
  it('caps complaints at 2', () => {
    const r = applyPlanLimits(fullReport, 'free', false)
    expect(r.complaints).toHaveLength(2)
  })

  it('caps strengths at 1', () => {
    const r = applyPlanLimits(fullReport, 'free', false)
    expect(r.strengths).toHaveLength(1)
  })

  it('hides improvements', () => {
    const r = applyPlanLimits(fullReport, 'free', false)
    expect(r.improvements).toEqual([])
  })

  it('hides marketingCopy', () => {
    const r = applyPlanLimits(fullReport, 'free', false)
    expect(r.marketingCopy).toEqual([])
  })

  it('hides reviewTemplates', () => {
    const r = applyPlanLimits(fullReport, 'free', false)
    expect(r.reviewTemplates).toEqual([])
  })

  it('hides topActions', () => {
    const r = applyPlanLimits(fullReport, 'free', false)
    expect(r.topActions).toEqual([])
  })

  it('hides seo', () => {
    const r = applyPlanLimits(fullReport, 'free', false)
    expect(r.seo).toBeNull()
  })

  it('sets _isLimited: true', () => {
    const r = applyPlanLimits(fullReport, 'free', false)
    expect(r._isLimited).toBe(true)
  })

  it('preserves healthScore', () => {
    const r = applyPlanLimits(fullReport, 'free', false)
    expect(r.healthScore).toBe(75)
  })
})

describe('applyPlanLimits — starter plan', () => {
  it('returns all complaints', () => {
    const r = applyPlanLimits(fullReport, 'starter', false)
    expect(r.complaints).toHaveLength(3)
  })

  it('returns all strengths', () => {
    const r = applyPlanLimits(fullReport, 'starter', false)
    expect(r.strengths).toHaveLength(2)
  })

  it('returns seo', () => {
    const r = applyPlanLimits(fullReport, 'starter', false)
    expect(r.seo).not.toBeNull()
  })

  it('sets _isLimited: false', () => {
    const r = applyPlanLimits(fullReport, 'starter', false)
    expect(r._isLimited).toBe(false)
  })
})

describe('applyPlanLimits — growth plan', () => {
  it('returns full data', () => {
    const r = applyPlanLimits(fullReport, 'growth', false)
    expect(r.complaints).toHaveLength(3)
    expect(r.improvements).toHaveLength(1)
    expect(r._isLimited).toBe(false)
  })
})

describe('applyPlanLimits — pro plan', () => {
  it('returns full data with _isLimited: false', () => {
    const r = applyPlanLimits(fullReport, 'pro', false)
    expect(r.complaints).toHaveLength(3)
    expect(r._isLimited).toBe(false)
  })
})

describe('applyPlanLimits — admin override', () => {
  it('admin on free plan gets full data', () => {
    const r = applyPlanLimits(fullReport, 'free', true)
    expect(r.complaints).toHaveLength(3)
    expect(r._isLimited).toBe(false)
  })

  it('admin on starter gets full data', () => {
    const r = applyPlanLimits(fullReport, 'starter', true)
    expect(r.complaints).toHaveLength(3)
    expect(r._isLimited).toBe(false)
  })
})

describe('applyPlanLimits — edge cases', () => {
  it('handles missing complaints gracefully', () => {
    const r = applyPlanLimits({ healthScore: 50 }, 'free', false)
    expect(r.complaints).toEqual([])
    expect(r.strengths).toEqual([])
  })

  it('handles null report fields gracefully', () => {
    const r = applyPlanLimits({ complaints: null, strengths: null }, 'free', false)
    expect(r.complaints).toEqual([])
    expect(r.strengths).toEqual([])
  })

  it('free plan with exactly 2 complaints returns both', () => {
    const r = applyPlanLimits({ ...fullReport, complaints: [{ title: 'c1' }, { title: 'c2' }] }, 'free', false)
    expect(r.complaints).toHaveLength(2)
  })
})
