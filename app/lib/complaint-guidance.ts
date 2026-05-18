export function getComplaintCountGuidance(reviewCount: number, negCount: number, sampled?: number): string {
  const sampledNote = sampled ? ` (${sampled} sampled)` : ''
  const negNote     = negCount > 0 ? ` with ${negCount} negative reviews (1★–2★)` : ''
  const minFromNeg  = Math.max(2, Math.floor(negCount / 8))

  if (reviewCount >= 500) {
    const min = Math.max(6, minFromNeg)
    return `REVIEW COUNT: ${reviewCount}${sampledNote}${negNote}.
MANDATORY COMPLAINT COUNT: ${min}–9 distinct complaints. You MUST reach ${min} before stopping.
SEPARATION RULE: "handle cracks" and "handle wobbles" are TWO complaints, not one. Each physical symptom reviewers describe separately = its own entry.
Do NOT write "durability issues" — write the exact symptom reviewers described.`
  }
  if (reviewCount >= 200) {
    const min = Math.max(5, minFromNeg)
    return `REVIEW COUNT: ${reviewCount}${sampledNote}${negNote}.
MANDATORY COMPLAINT COUNT: ${min}–7 distinct complaints. Do NOT stop before ${min}.
SEPARATION RULE: Do not merge problems that affect different parts of the product or happen at different times. Each = its own entry.
Do NOT write "quality issues" or "durability problems" — name the specific symptom.`
  }
  if (reviewCount >= 100) {
    const min = Math.max(4, minFromNeg)
    return `REVIEW COUNT: ${reviewCount}${sampledNote}${negNote}.
MANDATORY COMPLAINT COUNT: ${min}–6 distinct complaints.
SEPARATION RULE: If reviewers complain about two different things (e.g. blade and handle), those are TWO complaints.
Write the exact words reviewers used to describe each problem — do not abstract or generalize.`
  }
  if (reviewCount >= 50) {
    const min = Math.max(3, minFromNeg)
    return `REVIEW COUNT: ${reviewCount}${sampledNote}${negNote}.
MANDATORY COMPLAINT COUNT: ${min}–5 distinct complaints.
Read every 1★ and 2★ review. Count how many distinct physical symptoms or failure modes appear. Each one = its own complaint entry.
If reviewers mention rust AND cracking AND wrong color, those are THREE complaints.`
  }
  const min = Math.max(2, minFromNeg)
  return `REVIEW COUNT: ${reviewCount}${sampledNote}${negNote}.
MANDATORY COMPLAINT COUNT: at least ${min} complaints.
Read every negative review individually. List every distinct problem mentioned — do not merge separate issues into one.
Even if all relate to the handle, "cracks at the pin" and "loose after a month" are DIFFERENT complaints.`
}
