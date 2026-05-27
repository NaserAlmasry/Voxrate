// ── Analyses per plan per month ───────────────────────────────
export const PLAN_ANALYSES = {
  free:    { own: 1,   competitor: 0,  rolloverCap: 1 },
  starter: { own: 25,  competitor: 3,  rolloverCap: 2 },
  growth:  { own: 60,  competitor: 15, rolloverCap: 2 },
  pro:     { own: 150, competitor: 40, rolloverCap: 3 },
} as const

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
