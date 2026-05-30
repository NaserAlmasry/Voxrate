export interface ReportDiff {
  scoreDelta: number
  previousScore: number
  previousDate: string
  newThemes: string[]
  resolvedThemes: string[]
  worsenedThemes: { title: string; before: number; after: number; delta: number }[]
  improvedThemes: { title: string; before: number; after: number; delta: number }[]
}

export function computeReportDiff(
  current: { healthScore: number; complaints: { title: string; percentage: number }[] },
  previous: { healthScore: number; complaints: { title: string; percentage: number }[]; createdAt: string },
): ReportDiff {
  const scoreDelta = current.healthScore - previous.healthScore

  const prevMap = new Map(
    previous.complaints.map(c => [c.title.toLowerCase().trim(), c.percentage])
  )
  const currMap = new Map(
    current.complaints.map(c => [c.title.toLowerCase().trim(), c.percentage])
  )

  const newThemes = current.complaints
    .filter(c => !prevMap.has(c.title.toLowerCase().trim()))
    .map(c => c.title)

  const resolvedThemes = previous.complaints
    .filter(c => !currMap.has(c.title.toLowerCase().trim()))
    .map(c => c.title)

  const changedThemes = current.complaints
    .filter(c => prevMap.has(c.title.toLowerCase().trim()))
    .map(c => {
      const before = prevMap.get(c.title.toLowerCase().trim())!
      const after = c.percentage
      return { title: c.title, before, after, delta: after - before }
    })
    .filter(c => Math.abs(c.delta) >= 3)

  return {
    scoreDelta,
    previousScore: previous.healthScore,
    previousDate: previous.createdAt,
    newThemes,
    resolvedThemes,
    worsenedThemes: changedThemes.filter(c => c.delta > 0).sort((a, b) => b.delta - a.delta),
    improvedThemes: changedThemes.filter(c => c.delta < 0).sort((a, b) => a.delta - b.delta),
  }
}
