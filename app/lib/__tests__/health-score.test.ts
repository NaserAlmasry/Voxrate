import { describe, it, expect } from 'vitest'
import { calculateHealthScore } from '../health-score'

const make = (rating: number, text = 'review text') => ({ rating, text })

describe('calculateHealthScore', () => {
  it('returns 100 for all 5-star reviews', () => {
    const reviews = Array.from({ length: 20 }, () => make(5))
    const { healthScore } = calculateHealthScore(reviews, reviews.length)
    expect(healthScore).toBe(100)
  })

  it('returns a low score for all 1-star reviews', () => {
    const reviews = Array.from({ length: 20 }, () => make(1, 'arrived broken and damaged'))
    const { healthScore } = calculateHealthScore(reviews, reviews.length)
    expect(healthScore).toBeLessThan(40)
  })

  it('score is always within [20, 100]', () => {
    const worst = Array.from({ length: 50 }, () => make(1, 'terrible broken garbage refund'))
    const { healthScore } = calculateHealthScore(worst, worst.length)
    expect(healthScore).toBeGreaterThanOrEqual(20)
    expect(healthScore).toBeLessThanOrEqual(100)
  })

  it('more 5-star reviews raise the score vs more 1-star reviews', () => {
    const good = [
      ...Array.from({ length: 15 }, () => make(5)),
      ...Array.from({ length: 5  }, () => make(1)),
    ]
    const bad = [
      ...Array.from({ length: 5  }, () => make(5)),
      ...Array.from({ length: 15 }, () => make(1, 'broken damaged')),
    ]
    const goodScore = calculateHealthScore(good, good.length).healthScore
    const badScore  = calculateHealthScore(bad,  bad.length).healthScore
    expect(goodScore).toBeGreaterThan(badScore)
  })

  it('penalises damage/return keywords', () => {
    const clean   = Array.from({ length: 10 }, () => make(3, 'average product'))
    const damaged = Array.from({ length: 10 }, () => make(3, 'arrived damaged and broken, requested refund'))
    const cleanScore   = calculateHealthScore(clean,   clean.length).healthScore
    const damagedScore = calculateHealthScore(damaged, damaged.length).healthScore
    expect(damagedScore).toBeLessThan(cleanScore)
  })

  it('starCounts sum equals totalSampled', () => {
    const reviews = [make(1), make(2), make(3), make(4), make(5), make(5), make(4)]
    const ctx = calculateHealthScore(reviews, reviews.length)
    const sum = Object.values(ctx.starCounts).reduce((a, b) => a + b, 0)
    expect(sum).toBe(ctx.totalSampled)
  })

  it('weightedRaw is a positive number', () => {
    const reviews = [make(1), make(3), make(5)]
    const { weightedRaw } = calculateHealthScore(reviews, reviews.length)
    expect(weightedRaw).toBeGreaterThan(0)
  })
})
