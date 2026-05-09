// ============================================================
// app/lib/domain-knowledge.ts
//
// REVIEW-GROUNDED PATTERN EXTRACTOR + SEO PHRASE EXTRACTOR
//
// Philosophy change from previous version:
//   BEFORE: injected generic "expert knowledge" about product types
//           → model used it to invent measurements, brand names, techniques
//           → outputs like "1.5mm steel rod", "Amaco SG-4", "5mm thickness"
//           → technically specific but not grounded in reviews → breaks trust
//
//   NOW: extracts what reviewers ACTUALLY SAID about each problem
//        → model fixes the specific thing reviewers described
//        → outputs grounded in buyer language, not generic product knowledge
//        → an experienced Etsy seller would recognize the advice as real
//
// What this pre-call does:
// 1. Groups worst reviews by complaint theme
// 2. Extracts the exact language reviewers used to describe each problem
// 3. Classifies each as SHIPPING / PRODUCTION / LISTING / DESIGN
// 4. Extracts SEO phrases from best reviews via semantic clustering
//
// COST: ~500 tokens per analysis (was ~800 with llama-4-scout)
// TIME: adds ~1-2 seconds before main analysis (was 3-5s)
//
// MODEL CHANGE [2026-05]:
//   FROM: meta-llama/llama-4-scout-17b-16e-instruct  ← DEPRECATED Feb 2026
//   TO:   llama-3.1-8b-instant
//   WHY:  This call is pure extraction/classification — no complex reasoning.
//         8b-instant handles it perfectly, is faster, and uses fewer tokens.
// ============================================================

import Groq from 'groq-sdk'

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY })

// Model for this pre-call — extraction only, no complex reasoning needed
const DOMAIN_MODEL = 'llama-3.1-8b-instant'

export interface DomainResult {
  knowledge:  string   // review-grounded problem context → injected into main prompt
  seoThemes:  string[] // search-ready phrases → passed to seo-scorer
}

// ── Main export ───────────────────────────────────────────────

export async function generateDomainKnowledge(
  productName:    string,
  category:       string,
  worstReviews:   Array<{ rating: number; text: string }>,
  bestReviews?:   Array<{ rating: number; text: string }>,
  listingDescription?: string,
): Promise<string> {
  const result = await generateDomainAndSeo(productName, category, worstReviews, bestReviews, listingDescription)
  return result.knowledge
}

export async function generateDomainAndSeo(
  productName:    string,
  category:       string,
  worstReviews:   Array<{ rating: number; text: string }>,
  bestReviews?:   Array<{ rating: number; text: string }>,
  listingDescription?: string,
): Promise<DomainResult> {

  const badSample = worstReviews
    .filter(r => r.rating <= 2)
    .slice(0, 10)
    .map(r => `[${r.rating}★] ${r.text.slice(0, 200).trimEnd()}`)
    .join('\n')

  const goodSample = (bestReviews || [])
    .filter(r => r.rating === 5)
    .slice(0, 15)
    .map(r => `[5★] ${r.text.slice(0, 200).trimEnd()}`)
    .join('\n')

  if (!badSample && !goodSample) {
    return {
      knowledge: getFallbackKnowledge(productName, category),
      seoThemes: [],
    }
  }

  const descriptionBlock = listingDescription
    ? `SELLER'S LISTING DESCRIPTION (use material names and claims here to ground your analysis):\n${listingDescription.slice(0, 400).trimEnd()}`
    : ''

  const prompt = `You are analyzing Etsy reviews for a seller. Your job is to extract what reviewers ACTUALLY SAID — not to add your own product knowledge.

PRODUCT: ${productName}
CATEGORY: ${category}

${descriptionBlock ? descriptionBlock + '\n' : ''}
${badSample ? `NEGATIVE REVIEWS:\n${badSample}` : ''}

${goodSample ? `POSITIVE REVIEWS:\n${goodSample}` : ''}

PART 1 — COMPLAINT PATTERNS (from the negative reviews only):

For each distinct complaint pattern you see, write ONE line in this format:
COMPLAINT: [what reviewers said happened] | TYPE: [SHIPPING / PRODUCTION / LISTING / DESIGN] | EVIDENCE: [short verbatim phrase from a real review]

Rules:
- Only write complaints that appear in the reviews above — do not add complaints from general product knowledge
- TYPE definitions:
  SHIPPING = reviewer said item arrived damaged, broken, or in bad condition
  PRODUCTION = reviewer said item failed or broke after receiving and using it
  LISTING = reviewer said item was different from what the listing showed (size, color, description)
  DESIGN = reviewer said the design or functionality doesn't work for their use case
- EVIDENCE must be a short phrase actually written by a reviewer above
- Maximum 5 complaints
- If there are no negative reviews, write: NO_COMPLAINTS

PART 2 — SEO THEMES (from the positive reviews only):

Read each positive review above. Find the specific phrases buyers use to describe what they love.
Group similar expressions into one canonical search phrase.

Example grouping: "pattern is gorgeous" + "pattern is mesmerizing" + "pattern is stunning" → "stunning glaze pattern"
Example grouping: "keeps coffee hot for ages" + "still warm after 45 minutes" + "retains heat so well" → "keeps coffee hot longer"

Rules:
- Must come from actual words in the positive reviews above — do NOT invent phrases
- Must be 2-5 words that a buyer would actually type into Etsy search
- REJECT generic terms: "handmade ceramic mug", "unique design", "good quality", "nice product"
- ACCEPT specific buyer praise: "keeps coffee hot longer", "stunning glaze depth", "perfect morning mug", "heat retention coffee"
- If you cannot find 5 good phrases in the reviews, use fewer — do not invent to reach 5

Format your response EXACTLY like this — nothing else:

COMPLAINT: [what happened] | TYPE: SHIPPING | EVIDENCE: [verbatim phrase]
COMPLAINT: [what happened] | TYPE: PRODUCTION | EVIDENCE: [verbatim phrase]

SEO_THEMES:
phrase one
phrase two
phrase three
phrase four
phrase five`

  try {
    const response = await groq.chat.completions.create({
      model:       DOMAIN_MODEL,  // llama-3.1-8b-instant — was llama-4-scout (deprecated Feb 2026)
      max_tokens:  300,           // was 500 — output is structured text, 300 is plenty
      temperature: 0.1,
      messages: [{ role: 'user', content: prompt }],
    })

    const raw = response.choices[0].message.content || ''

    // Split on SEO_THEMES: marker
    const parts          = raw.split('SEO_THEMES:')
    const patternSection = parts[0].trim()
    const seoSection     = parts[1] || ''

    // Extract SEO phrases
    const seoThemes = seoSection
      .split('\n')
      .map(l => l.trim())
      .filter(l => l.length > 3 && l.length < 60)
      .filter(l => l.split(' ').length >= 2)
      .slice(0, 5)

    // Parse complaint patterns into a structured context block
    const complaintLines = patternSection
      .split('\n')
      .filter(l => l.startsWith('COMPLAINT:'))

    let knowledgeBlock: string

    if (complaintLines.length === 0 || patternSection.includes('NO_COMPLAINTS')) {
      knowledgeBlock = `REVIEW CONTEXT FOR "${productName}":
No significant complaint patterns detected in the negative reviews.
Focus the analysis on amplifying the strengths buyers described.

COMPLAINT TYPE RULES:
- "arrived broken/damaged/scratched" → SHIPPING problem → fix is packaging and transit protection
- "broke/failed/came apart after using" → PRODUCTION problem → fix is how it is made
- "different from photos/description" → LISTING problem → fix is listing copy and photos
- "doesn't work for my use case" → DESIGN problem → fix is product design or buyer targeting`
    } else {
      const parsedComplaints = complaintLines.map(line => {
        const complaintMatch = line.match(/COMPLAINT:\s*(.+?)\s*\|/)
        const typeMatch      = line.match(/TYPE:\s*(\w+)/)
        const evidenceMatch  = line.match(/EVIDENCE:\s*(.+)$/)
        return {
          complaint: complaintMatch?.[1]?.trim() || '',
          type:      typeMatch?.[1]?.trim() || 'PRODUCTION',
          evidence:  evidenceMatch?.[1]?.trim() || '',
        }
      }).filter(c => c.complaint)

      const complaintContext = parsedComplaints.map(c => {
        const fixDirection = c.type === 'SHIPPING'
          ? 'Fix direction: packaging and transit protection — not production quality'
          : c.type === 'LISTING'
          ? 'Fix direction: listing photos, description accuracy, or size information'
          : c.type === 'DESIGN'
          ? 'Fix direction: product design, use case targeting, or buyer expectations'
          : 'Fix direction: how the product is made — specifically what reviewers described failing'

        return `- Complaint: ${c.complaint}
  Type: ${c.type}
  Reviewers said: "${c.evidence}"
  ${fixDirection}`
      }).join('\n\n')

      const listingContext = listingDescription
        ? `\nSELLER'S LISTING DESCRIPTION — use these material names in fixes, do not invent others:\n${listingDescription.slice(0, 400).trimEnd()}\nIf reviewers describe failures that contradict listing claims, flag as EXPECTATION GAP.`
        : ''

      knowledgeBlock = `COMPLAINT PATTERNS EXTRACTED FROM REVIEWS FOR "${productName}":
${complaintContext}
${listingContext ? listingContext : ''}

GROUNDING RULES — the main analysis must follow these:
- Every fix must address the specific thing reviewers described — not a generalisation
- If listing description above has material names (wood type, steel grade, coating), use those — do not invent alternatives
- "Handle snapped at the base after 3 weeks" → fix the base attachment point, not handles generically
- "Arrived with a crack, just tissue paper" → fix packaging for transit, not production quality
- "Color looks different in photos" → fix listing photography, not the product itself
- Do NOT invent material names, brand names, or techniques not mentioned by reviewers or in the listing
- A fix should sound like advice from an experienced Etsy seller — practical, specific to what went wrong`
    }

    console.log(`[DomainKnowledge] ${complaintLines.length} complaint patterns for "${productName}" via ${DOMAIN_MODEL}`)
    console.log(`[DomainKnowledge] SEO themes: ${seoThemes.join(' | ')}`)

    return { knowledge: knowledgeBlock, seoThemes }

  } catch (err: any) {
    console.warn('[DomainKnowledge] Generation failed, using fallback:', err.message)
    return {
      knowledge: getFallbackKnowledge(productName, category),
      seoThemes: [],
    }
  }
}

// ── Fallback ──────────────────────────────────────────────────

function getFallbackKnowledge(productName: string, category: string): string {
  return `PRODUCT CONTEXT: ${productName} (${category})

COMPLAINT TYPE RULES — classify before fixing:
- "Arrived broken/cracked/scratched/damaged" → SHIPPING problem → fix is packaging
- "Broke/failed/came apart after X weeks of use" → PRODUCTION problem → fix is construction
- "Color/size/look different from photos" → LISTING problem → fix is photos or description
- "Doesn't work for my use case" → DESIGN problem → fix is product or targeting

Fix grounding rule: every fix must address what the reviewer specifically described.
Do not invent measurements, brand names, or techniques not mentioned by reviewers.`
}

// ── Helper: extract worst reviews ────────────────────────────

export function extractWorstReviews(
  reviews: Array<{ rating: number; text: string }>,
  limit = 10,
): Array<{ rating: number; text: string }> {
  return reviews
    .filter(r => r.rating <= 2)
    .sort((a, b) => {
      if (a.rating !== b.rating) return a.rating - b.rating
      return b.text.length - a.text.length
    })
    .slice(0, limit)
}

// ── Helper: extract best reviews ─────────────────────────────

export function extractBestReviews(
  reviews: Array<{ rating: number; text: string }>,
  limit = 10,
): Array<{ rating: number; text: string }> {
  return reviews
    .filter(r => r.rating === 5)
    .sort((a, b) => b.text.length - a.text.length)
    .slice(0, limit)
}
