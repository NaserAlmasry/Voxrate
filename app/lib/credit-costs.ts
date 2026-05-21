export const CREDIT_COSTS = {
  ownAnalysis: 20,
  competitorAnalysis: 35,
  sentimentAlert: {
    daily: 15,
    everyOtherDay: 12,
    weekly: 10,
    biweekly: 5,
  },
} as const

export const PLAN_CREDITS = {
  starter: 300,
  growth: 800,
  pro: 2000,
} as const

export const PACK_CREDITS = {
  starter_pack: 100,
  growth_pack: 300,
  pro_pack: 700,
} as const

export const CREDIT_CAPS = {
  maxPackGrant: 700,
  maxSubscriptionGrant: 2000,
} as const
