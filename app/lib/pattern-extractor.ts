// ============================================================
// app/lib/pattern-extractor.ts
//
// PASS 1 — Pure TypeScript pattern detection
// Runs on ALL reviews before the LLM call.
// No tokens consumed. Runs in <100ms even on 10,000 reviews.
//
// WHY THIS EXISTS:
// With 3,000 reviews and a 200-review LLM cap, frequency counts
// from the LLM sample are wildly inaccurate:
//   Real: "487 of 3,000 buyers mention handle cracking"
//   Without this: "50 of 280 sampled reviews" → misleading
//
// This extractor reads ALL reviews in pure code and gives the
// LLM accurate frequency data before it writes the report.
//
// WHAT IT PRODUCES:
// 1. Real complaint frequencies — counts across ALL reviews
// 2. Best samples for LLM — most diagnostic reviews per complaint
// 3. Best verbatim 5★ quotes — for marketing copy
// 4. Real star distribution — locked, accurate
// ============================================================

export interface ComplaintCluster {
  phrase:       string           // the recurring phrase detected
  count:        number           // how many reviews contain it
  pct:          number           // % of total reviews
  severity:     'high' | 'medium' | 'low'
  starBreakdown: Record<1|2|3|4|5, number>
  bestQuotes:   string[]         // top 3 verbatim reviews mentioning this
  verified?:    number           // how many verified reviews mention this
  vine?:        number           // how many vine reviews mention this
}

export interface StrengthCluster {
  phrase:     string
  count:      number
  pct:        number
  bestQuotes: string[]
}

export interface PatternAnalysis {
  totalReviews:      number
  starCounts:        Record<1|2|3|4|5, number>
  negativeReviews:   number
  negativePct:       number
  complaintClusters: ComplaintCluster[]
  strengthClusters:  StrengthCluster[]
  bestVerbatimQuotes: string[]   // top 5★ sentences for marketing copy
  promptSummary:     string      // pre-formatted block to inject into LLM prompt
}

// ── Complaint signal phrases ───────────────────────────────────
// Grouped by category — model uses these to cluster complaints.
// Add more phrases as you discover patterns from real user data.

const COMPLAINT_SIGNALS: Array<{ phrases: string[]; label: string }> = [
  // Compatibility (Amazon-specific)
  { phrases: ["doesn't fit", "not compatible", "incompatible", "wrong size", "doesn't work with", "not for", "won't fit"], label: 'compatibility issue' },
  // Structural failures
  { phrases: ['crack', 'cracked', 'cracking', 'split', 'splitting'], label: 'cracking or splitting' },
  { phrases: ['broke', 'broken', 'snapped', 'fell apart', 'came apart', 'came undone', 'unravel', 'unraveling', 'fraying'], label: 'breaking or unraveling' },
  { phrases: ['rust', 'rusting', 'corrode', 'corrosion', 'oxidiz'], label: 'rust or corrosion' },
  { phrases: ['stitch', 'stitching', 'seam', 'thread', 'sew'], label: 'stitching or seam failure' },
  { phrases: ['warp', 'warped', 'bent', 'bow', 'bowed', 'not straight', 'tilts', 'tilt'], label: 'warping or bending' },
  { phrases: ['scratch', 'scratched', 'scuff', 'scuffed', 'mark', 'damaged'], label: 'surface damage or scratches' },
  // Packaging and shipping
  { phrases: ['arrived broken', 'arrived cracked', 'arrived damaged', 'arrived scratched', 'shipping damage', 'damaged in transit', 'broken in shipping'], label: 'damaged on arrival' },
  { phrases: ['packaging', 'no bubble wrap', 'no padding', 'tissue paper only', 'poorly packed', 'not wrapped'], label: 'inadequate packaging' },
  // Color and appearance
  { phrases: ['color', 'colour', 'different from photo', 'not as pictured', 'not as shown', 'misleading photo', 'yellow', 'warm tone', 'beige not white'], label: 'color different from photos' },
  { phrases: ['smaller than', 'larger than', 'size', 'not the size', 'bigger than expected', 'smaller than expected'], label: 'size different from photos' },
  // Functionality
  { phrases: ['tight', 'stiff', 'hard to fit', 'hard to open', 'hard to close', 'stuck', 'wont fit', "won't fit", "doesn't fit"], label: 'too tight or stiff' },
  { phrases: ['loose', 'wobbly', 'not secure', 'falls out', 'came loose', 'not tight'], label: 'too loose or wobbly' },
  { phrases: ['dull', 'not sharp', 'edge retention', 'lost its edge', 'needs sharpening'], label: 'poor sharpness or edge retention' },
  { phrases: ['smell', 'odor', 'odour', 'chemical smell', 'strong smell', 'unpleasant smell'], label: 'smell or odor issue' },
  { phrases: ['bleed', 'bleeding', 'fade', 'fading', 'color transfer', 'colour transfer', 'dye transfer'], label: 'color bleeding or fading' },
  { phrases: ['tunnel', 'tunneling', 'wax wall', 'uneven burn', 'wick', 'soot', 'smoke', 'black smoke'], label: 'candle burn issue' },
  { phrases: ['weak scent', 'no scent', 'barely smells', 'scent faded', 'not strong enough', 'scent throw'], label: 'weak scent throw' },
  // Instructions and info
  { phrases: ['no instructions', 'no care card', 'no directions', 'unclear instructions', 'how to', 'no guide'], label: 'missing instructions' },
  // Hardware
  { phrases: ['zipper', 'zip', 'buckle', 'clasp', 'snap', 'hardware', 'button'], label: 'hardware failure' },
  { phrases: ['pilling', 'pills', 'bobbling', 'fuzzing'], label: 'fabric pilling' },
]

// ── Strength signal phrases ────────────────────────────────────

const STRENGTH_SIGNALS: Array<{ phrases: string[]; label: string }> = [
  { phrases: ['beautiful', 'gorgeous', 'stunning', 'breathtaking', 'stunning', 'mesmerizing', 'hypnotic'], label: 'beautiful appearance' },
  { phrases: ['sharp', 'razor sharp', 'very sharp', 'extremely sharp'], label: 'sharpness' },
  { phrases: ['soft', 'buttery soft', 'buttery', 'so soft'], label: 'soft texture' },
  { phrases: ['scent', 'smell', 'fragrance', 'smells amazing', 'smells wonderful', 'divine scent', 'strong scent'], label: 'strong scent' },
  { phrases: ['balance', 'well balanced', 'perfectly balanced', 'good balance'], label: 'good balance or fit' },
  { phrases: ['quality', 'high quality', 'excellent quality', 'premium quality', 'quality is outstanding'], label: 'high quality' },
  { phrases: ['gift', 'perfect gift', 'great gift', 'birthday gift', 'gift for'], label: 'gift appeal' },
  { phrases: ['lasts', 'durable', 'holds up', 'still going strong', 'years of use'], label: 'durability' },
  { phrases: ['unique', 'one of a kind', 'unlike anything', 'never seen'], label: 'unique or one-of-a-kind' },
  { phrases: ['comfortable', 'comfortable grip', 'fits perfectly', 'fits my hand', 'comfortable in hand'], label: 'comfort and fit' },
  { phrases: ['fast shipping', 'arrived quickly', 'shipped fast', 'quick delivery'], label: 'fast shipping' },
  { phrases: ['well packaged', 'beautifully packaged', 'great packaging', 'arrived safely'], label: 'great packaging' },
  { phrases: ['heirloom', 'treasure', 'pass down', 'last forever', 'lifetime'], label: 'heirloom quality' },
]

// ── Utility: normalize text ────────────────────────────────────

function normalize(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim()
}

// ── Utility: check if text contains any of the phrases ─────────

function matchesPhrases(text: string, phrases: string[]): boolean {
  const norm = normalize(text)
  return phrases.some(p => norm.includes(p.toLowerCase()))
}

// ── Utility: extract best quote for a cluster ─────────────────
// Returns the most detailed review mentioning this complaint
// "Most detailed" = longest text, to maximize diagnostic value

function getBestQuotes(
  reviews: Array<{ rating: number; text: string }>,
  phrases: string[],
  limit = 3,
): string[] {
  return reviews
    .filter(r => matchesPhrases(r.text, phrases))
    .sort((a, b) => b.text.length - a.text.length)
    .slice(0, limit)
    .map(r => r.text.slice(0, 200).trimEnd() + (r.text.length > 200 ? '…' : ''))
}

// ── Utility: get best verbatim 5★ sentences for marketing copy ─

function getBestVerbatimQuotes(
  reviews: Array<{ rating: number; text: string }>,
  limit = 8,
): string[] {
  return reviews
    .filter(r => r.rating === 5)
    .sort((a, b) => b.text.length - a.text.length)
    .slice(0, limit)
    .map(r => {
      // Split into sentences and pick the most descriptive one
      const sentences = r.text
        .split(/[.!?]+/)
        .map(s => s.trim())
        .filter(s => s.length > 30)
      // Prefer sentences that don't start with "I" — more quotable
      const nonI = sentences.filter(s => !s.toLowerCase().startsWith('i '))
      return (nonI[0] || sentences[0] || r.text.slice(0, 150)).trim()
    })
    .filter(Boolean)
    .slice(0, limit)
}

// ── Severity from frequency ────────────────────────────────────

function getSeverity(pct: number): 'high' | 'medium' | 'low' {
  if (pct >= 0.15) return 'high'
  if (pct >= 0.07) return 'medium'
  return 'low'
}

// ── Main export: extractPatterns ──────────────────────────────

export function extractPatterns(
  reviews: Array<{ rating: number; text: string; verified?: boolean; vine?: boolean }>,
): PatternAnalysis {
  const total = reviews.length
  if (total === 0) {
    return {
      totalReviews: 0,
      starCounts: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
      negativeReviews: 0,
      negativePct: 0,
      complaintClusters: [],
      strengthClusters: [],
      bestVerbatimQuotes: [],
      promptSummary: '',
    }
  }

  // Real star counts from ALL reviews
  const starCounts: Record<1|2|3|4|5, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
  for (const r of reviews) {
    const star = Math.min(5, Math.max(1, Math.round(r.rating))) as 1|2|3|4|5
    starCounts[star]++
  }

  const negativeReviews = starCounts[1] + starCounts[2]
  const negativePct     = negativeReviews / total

  // ── Complaint clusters ─────────────────────────────────────
  const complaintClusters: ComplaintCluster[] = []

  for (const signal of COMPLAINT_SIGNALS) {
    // Count matches across ALL reviews
    const matching = reviews.filter(r => matchesPhrases(r.text, signal.phrases))
    if (matching.length < 2) continue  // skip if fewer than 2 mentions

    const count = matching.length
    const pct   = count / total

    // Star breakdown within this complaint
    const sb: Record<1|2|3|4|5, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
    for (const r of matching) {
      const star = Math.min(5, Math.max(1, Math.round(r.rating))) as 1|2|3|4|5
      sb[star]++
    }

    // Amazon: track verified and vine counts within this cluster
    const verifiedCount = matching.filter(r => r.verified === true).length
    const vineCount     = matching.filter(r => r.vine === true).length

    complaintClusters.push({
      phrase:       signal.label,
      count,
      pct,
      severity:     getSeverity(pct),
      starBreakdown: sb,
      bestQuotes:   getBestQuotes(reviews, signal.phrases),
      verified:     verifiedCount,
      vine:         vineCount,
    })
  }

  // Sort by count descending — most common complaint first
  complaintClusters.sort((a, b) => b.count - a.count)

  // ── Strength clusters ──────────────────────────────────────
  const strengthClusters: StrengthCluster[] = []

  for (const signal of STRENGTH_SIGNALS) {
    const matching = reviews.filter(r => r.rating >= 4 && matchesPhrases(r.text, signal.phrases))
    if (matching.length < 2) continue

    strengthClusters.push({
      phrase:     signal.label,
      count:      matching.length,
      pct:        matching.length / total,
      bestQuotes: getBestQuotes(matching, signal.phrases, 2),
    })
  }

  strengthClusters.sort((a, b) => b.count - a.count)

  // ── Best verbatim quotes ───────────────────────────────────
  const bestVerbatimQuotes = getBestVerbatimQuotes(reviews)

  // ── Build prompt summary ───────────────────────────────────
  // This gets injected into the LLM prompt so it has
  // ACCURATE frequency data from ALL reviews, not just the sample

  const topComplaints = complaintClusters
    .slice(0, 6)
    .map(c =>
      `  • "${c.phrase}": ${c.count} of ${total} reviews (${Math.round(c.pct * 100)}% of buyers) — severity: ${c.severity}`
    )
    .join('\n')

  const topStrengths = strengthClusters
    .slice(0, 4)
    .map(s =>
      `  • "${s.phrase}": ${s.count} of ${total} reviews (${Math.round(s.pct * 100)}% of buyers)`
    )
    .join('\n')

  const promptSummary = `PATTERN ANALYSIS FROM ALL ${total} REVIEWS (pre-calculated, use these counts for frequency fields):

COMPLAINT PATTERNS DETECTED:
${topComplaints || '  • No significant complaint patterns detected'}

STRENGTH PATTERNS DETECTED:
${topStrengths || '  • No significant strength patterns detected'}

STAR DISTRIBUTION (EXACT — use these in starBreakdown):
  5★: ${starCounts[5]} | 4★: ${starCounts[4]} | 3★: ${starCounts[3]} | 2★: ${starCounts[2]} | 1★: ${starCounts[1]}
  Total: ${total}

FREQUENCY RULE: When writing complaint frequency fields, use the counts above.
"${complaintClusters[0]?.count || 0} of ${total} reviews" not counts from your sample only.
These numbers come from scanning ALL ${total} reviews — they are accurate.`

  console.log(
    `[PatternExtractor] ${total} reviews → ` +
    `${complaintClusters.length} complaint clusters, ` +
    `${strengthClusters.length} strength clusters`
  )

  return {
    totalReviews: total,
    starCounts,
    negativeReviews,
    negativePct,
    complaintClusters,
    strengthClusters,
    bestVerbatimQuotes,
    promptSummary,
  }
}

// ── Smart sampler using pattern data ──────────────────────────
// Replaces the basic buildReviewText() with one that ensures
// the LLM sample covers all detected complaint patterns.
// For each complaint cluster, picks the most diagnostic reviews.

export function buildSmartSample(
  reviews:  Array<{ rating: number; text: string; verified?: boolean; vine?: boolean }>,
  patterns: PatternAnalysis,
  maxTotal: number = 200,
): Array<{ rating: number; text: string; verified?: boolean; vine?: boolean }> {
  const selected = new Set<number>()  // track by index to avoid duplicates
  const result:  Array<{ rating: number; text: string }> = []

  // Step 1: For each complaint cluster, include its best reviews
  // This ensures the LLM has enough context to write specific fixes
  const perCluster = Math.min(5, Math.floor(maxTotal * 0.6 / Math.max(patterns.complaintClusters.length, 1)))

  for (const cluster of patterns.complaintClusters.slice(0, 6)) {
    let added = 0
    for (let i = 0; i < reviews.length && added < perCluster; i++) {
      if (!selected.has(i) && matchesPhrases(reviews[i].text, getPhrasesForLabel(cluster.phrase))) {
        selected.add(i)
        result.push(reviews[i])
        added++
      }
    }
  }

  // Step 2: Fill remaining budget with best 5★ reviews (for strengths + marketing copy)
  const highStarBudget = Math.floor(maxTotal * 0.25)
  let highAdded = 0
  const fiveStars = reviews
    .map((r, i) => ({ r, i }))
    .filter(({ r, i }) => r.rating === 5 && !selected.has(i))
    .sort((a, b) => b.r.text.length - a.r.text.length)

  for (const { r, i } of fiveStars) {
    if (highAdded >= highStarBudget) break
    selected.add(i)
    result.push(r)
    highAdded++
  }

  // Step 3: Fill any remaining budget with unrepresented low-star reviews
  const remaining = maxTotal - result.length
  let extraAdded = 0
  const lowStars = reviews
    .map((r, i) => ({ r, i }))
    .filter(({ r, i }) => r.rating <= 2 && !selected.has(i))
    .sort((a, b) => b.r.text.length - a.r.text.length)

  for (const { r, i } of lowStars) {
    if (extraAdded >= remaining) break
    selected.add(i)
    result.push(r)
    extraAdded++
  }

  console.log(
    `[SmartSampler] ${reviews.length} total → ${result.length} sampled ` +
    `(${Math.round(result.length / reviews.length * 100)}% coverage)`
  )

  return result.slice(0, maxTotal)
}

// ── Helper: get phrases for a cluster label ───────────────────
// Reverse lookup — given a cluster label, find its signal phrases

function getPhrasesForLabel(label: string): string[] {
  const signal = COMPLAINT_SIGNALS.find(s => s.label === label)
  return signal?.phrases || [label]
}
