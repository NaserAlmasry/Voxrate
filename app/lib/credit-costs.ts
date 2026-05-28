// ── Analyses per plan per month ───────────────────────────────
// Pool is unified (own + competitor combined = total shown on pricing page)
// own + competitor here = allocation split for DB columns; total = the advertised pool
export const PLAN_ANALYSES = {
  free:    { own: 3,   competitor: 2,  rolloverCap: 1 },  // trial: 5 total
  starter: { own: 30,  competitor: 5,  rolloverCap: 2 },  // 35 total
  growth:  { own: 65,  competitor: 15, rolloverCap: 2 },  // 80 total
  pro:     { own: 175, competitor: 45, rolloverCap: 3 },  // 220 total
} as const

// Burst cap: max analyses per 2-minute window per plan
export const PLAN_BURST_INTERVAL_MS: Record<string, number> = {
  free:    180_000, // 1 per 3 min
  trial:   180_000,
  starter: 120_000, // 1 per 2 min
  growth:   90_000, // 1 per 90 sec
  pro:      60_000, // 1 per 60 sec
}

// Re-analyze cooldown by plan (days; 0 = no cooldown)
export const REANALYZE_COOLDOWN_DAYS: Record<string, number> = {
  free:    999,
  starter: 7,
  growth:  3,
  pro:     0,
}

// Legacy credit costs — kept for backward compat
export const CREDIT_COSTS = {
  ownAnalysis:        20,
  competitorAnalysis: 35,
  sentimentAlert: {
    daily:         15,
    everyOtherDay: 12,
    weekly:        10,
    biweekly:       5,
  },
} as const

export const PLAN_CREDITS = {
  starter: 300,
  growth:  800,
  pro:     2000,
} as const

export const PACK_CREDITS = {
  starter_pack: 100,
  growth_pack:  300,
  pro_pack:     700,
} as const

export const CREDIT_CAPS = {
  maxPackGrant:         700,
  maxSubscriptionGrant: 2000,
} as const
