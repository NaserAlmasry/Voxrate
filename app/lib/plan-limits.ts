export function applyPlanLimits(
  report: any,
  plan: string,
  isAdminUser: boolean,
) {
  if (isAdminUser || plan === 'pro')
    return { ...report, _isLimited: false }

  if (plan === 'growth' || plan === 'starter') {
    return {
      ...report,
      complaints:    report.complaints   || [],
      strengths:     report.strengths    || [],
      improvements:  report.improvements || [],
      seo:           report.seo          || null,
      marketingCopy: report.marketingCopy || [],
      _isLimited:    false,
    }
  }

  // free plan
  return {
    ...report,
    complaints:      (report.complaints || []).slice(0, 2),
    strengths:       (report.strengths  || []).slice(0, 1),
    improvements:    [],
    marketingCopy:   [],
    reviewTemplates: [],
    seo:             null,
    topActions:      [],
    _isLimited:      true,
  }
}
