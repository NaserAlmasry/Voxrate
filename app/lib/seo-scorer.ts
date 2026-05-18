// ============================================================
// app/lib/seo-scorer.ts
//
// DETERMINISTIC SEO SCORER
//
// WHY THIS EXISTS:
// The LLM was defaulting to 80/100 for every product regardless
// of actual keyword quality. Then after adding a formula it defaulted
// to 60. The model cannot reliably score SEO — it pattern-matches
// to a comfortable number instead of calculating.
//
// This module calculates the SEO score in pure TypeScript from the
// actual review text — no LLM involvement. The score is injected
// into the prompt as a locked value just like healthScore.
//
// HOW IT WORKS:
// 1. Extracts multi-word phrases from 5★ reviews
// 2. Filters out generic/useless phrases via GENERIC_WORDS + BLOCKED_PHRASES
// 3. Scores each phrase based on specificity and search intent
// 4. Returns a score + the top phrases to inject into the prompt
//
// CHANGES:
// - Expanded GENERIC_WORDS to include praise/shipping/sentiment words
// - Added BLOCKED_PHRASES to catch useless multi-word combos that
//   slip through the single-word filter (e.g. "high quality", "fast shipping")
// ============================================================

// ── Phrase extraction ─────────────────────────────────────────

// Words that make a phrase generic — penalize if phrase is ONLY these
const GENERIC_WORDS = new Set([
  // Articles, prepositions, conjunctions
  'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
  'of', 'with', 'is', 'it', 'this', 'that', 'was', 'are', 'be', 'been',
  'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
  'should', 'may', 'might', 'very', 'really', 'so', 'just', 'my', 'your',
  // Generic praise words
  'great', 'good', 'nice', 'love', 'loved', 'like', 'beautiful', 'perfect',
  'amazing', 'awesome', 'excellent', 'wonderful', 'fantastic', 'best',
  'cute', 'adorable', 'lovely', 'pretty', 'super', 'absolutely', 'totally',
  // Generic product/purchase words
  'quality', 'product', 'item', 'purchase', 'order', 'buy', 'bought',
  'made', 'make', 'get', 'got', 'use', 'used', 'using',
  // Shipping/service words
  'fast', 'quick', 'shipping', 'delivery', 'shipped', 'arrived', 'received',
  'packaged', 'packaging', 'seller', 'shop', 'store', 'service', 'customer',
  // Sentiment fillers
  'high', 'little', 'highly', 'recommend', 'exactly', 'pictured',
  'described', 'happy', 'pleased', 'satisfied', 'disappointed',
  'definitely', 'strongly', 'absolutely', 'certainly',
  // Review clichés
  'thank', 'thanks', 'again', 'another', 'also', 'even', 'still',
])

// Blocked multi-word phrases — useless for Amazon SEO even if they recur
// These slip through GENERIC_WORDS because only one word is generic
const BLOCKED_PHRASES = [
  // Generic praise combos
  'high quality', 'amazing product', 'great product', 'good product',
  'great quality', 'good quality', 'amazing quality', 'excellent quality',
  'beautiful product', 'perfect product', 'wonderful product',
  'nice product', 'nice quality', 'lovely product',
  // Shipping clichés
  'fast shipping', 'quick shipping', 'great shipping', 'fast delivery',
  'quick delivery', 'speedy shipping', 'arrived quickly', 'arrived fast',
  'shipped quickly', 'shipped fast', 'super fast', 'very fast',
  'quick delivery', 'prompt delivery', 'speedy delivery',
  // Review clichés
  'as described', 'as pictured', 'as expected', 'as advertised',
  'highly recommend', 'would recommend', 'highly recommended',
  'definitely recommend', 'strongly recommend', 'will recommend',
  'would definitely', 'will definitely', 'would absolutely',
  // Sentiment fillers
  'love it', 'loved it', 'love this', 'loved this', 'love them',
  'very happy', 'very pleased', 'so happy', 'so pleased', 'very satisfied',
  'so cute', 'very cute', 'cute little', 'really cute', 'so pretty',
  'absolutely love', 'absolutely perfect', 'absolutely beautiful',
  // Seller/shop praise
  'great seller', 'great shop', 'great store', 'great service',
  'amazing seller', 'wonderful seller', 'excellent seller',
  // Gift clichés
  'perfect gift', 'great gift', 'good gift', 'amazing gift',
  'lovely gift', 'beautiful gift', 'wonderful gift',
  // Repeat purchase intent
  'will order', 'will buy', 'order again', 'buy again', 'purchase again',
  'come back', 'back again', 'return again',
  // Thank you phrases
  'thank you', 'thanks so', 'many thanks',
]

// High-value search intent signals — phrases containing these score higher
// Updated for Amazon A10 algorithm (buyer intent, specificity, problem-solution language)
const SEARCH_INTENT_SIGNALS = [
  // Amazon buyer intent phrases
  'for', 'to use', 'works with', 'fits',
  // Use cases
  'gift', 'birthday', 'christmas', 'fathers day', 'mothers day',
  'wedding', 'anniversary', 'daily', 'everyday', 'kitchen',
  'valentines', 'holiday', 'graduation', 'housewarming',
  // Specificity signals
  'minute', 'hour', 'week', 'month', 'year', 'inch', 'cm', 'mm',
  // Outcome signals
  'keeps', 'holds', 'fits', 'lasts', 'works', 'feels', 'looks',
  // Comparison signals
  'ever', 'never', 'always', 'only', 'first',
  // Material specificity signals
  'wood', 'metal', 'ceramic', 'cotton', 'leather', 'silver', 'gold',
  'stainless', 'silicone', 'bpa free', 'food grade',
  // Problem-solution language (high-value A10 signals)
  'leak-proof', 'leakproof', 'non-stick', 'nonstick', 'rust-resistant',
  'waterproof', 'dishwasher safe', 'oven safe', 'compatible with',
  'fits perfectly', 'easy to clean', 'easy to use', 'no smell',
]

function extractPhrases(reviews: Array<{ rating: number; text: string }>): string[] {
  const fiveStarReviews = reviews.filter(r => r.rating === 5)
  const phraseCounts = new Map<string, number>()

  for (const review of fiveStarReviews) {
    const text = review.text.toLowerCase()
    const words = text.split(/\s+/).map(w => w.replace(/[^a-z0-9']/g, ''))

    // Extract 2-word phrases
    for (let i = 0; i < words.length - 1; i++) {
      if (words[i].length > 2 && words[i + 1].length > 2) {
        const phrase = `${words[i]} ${words[i + 1]}`
        if (!GENERIC_WORDS.has(words[i]) || !GENERIC_WORDS.has(words[i + 1])) {
          phraseCounts.set(phrase, (phraseCounts.get(phrase) || 0) + 1)
        }
      }
    }

    // Extract 3-word phrases
    for (let i = 0; i < words.length - 2; i++) {
      if (words[i].length > 2 && words[i + 2].length > 2) {
        const phrase = `${words[i]} ${words[i + 1]} ${words[i + 2]}`
        const nonGeneric = [words[i], words[i + 1], words[i + 2]].filter(w => !GENERIC_WORDS.has(w))
        if (nonGeneric.length >= 2) {
          phraseCounts.set(phrase, (phraseCounts.get(phrase) || 0) + 1)
        }
      }
    }

    // Extract 4-word phrases (high value — very specific)
    for (let i = 0; i < words.length - 3; i++) {
      const phrase = `${words[i]} ${words[i + 1]} ${words[i + 2]} ${words[i + 3]}`
      const nonGeneric = [words[i], words[i + 1], words[i + 2], words[i + 3]].filter(w => !GENERIC_WORDS.has(w))
      if (nonGeneric.length >= 3) {
        phraseCounts.set(phrase, (phraseCounts.get(phrase) || 0) + 1)
      }
    }
  }

  // Return phrases that appear in 2+ reviews, sorted by count
  // Then filter out blocked phrases
  const minCount = fiveStarReviews.length >= 20 ? 2 : 1
  return Array.from(phraseCounts.entries())
    .filter(([, count]) => count >= minCount)
    .sort((a, b) => b[1] - a[1])
    .map(([phrase]) => phrase)
    .filter(phrase => !BLOCKED_PHRASES.some(blocked => phrase.includes(blocked)))
    .slice(0, 20)
}

// ── Score a single phrase ─────────────────────────────────────

function scorePhraseSpecificity(phrase: string): number {
  const words = phrase.split(' ')
  let score = 0

  // Length bonus — longer phrases are more specific
  if (words.length >= 4) score += 15
  else if (words.length === 3) score += 10
  else if (words.length === 2) score += 5

  // Search intent signal bonus
  for (const signal of SEARCH_INTENT_SIGNALS) {
    if (phrase.toLowerCase().includes(signal)) {
      score += 8
      break // Only count once
    }
  }

  // Numbers make phrases more specific ("45 minutes", "3 weeks")
  if (/\d/.test(phrase)) score += 10

  // Generic word penalty
  const phraseWords = phrase.toLowerCase().split(' ')
  const genericCount = phraseWords.filter(w => GENERIC_WORDS.has(w)).length
  score -= genericCount * 5

  return Math.max(0, score)
}

// ── Main export ───────────────────────────────────────────────

export interface SeoPhrase {
  phrase:  string
  inTitle: boolean
}

export interface SeoAnalysis {
  score:       number
  topPhrases:  string[]
  phrases:     SeoPhrase[]
  phraseCount: number
  reasoning:   string  // injected into prompt so LLM understands the score
}

export function calculateSeoScore(
  reviews:     Array<{ rating: number; text: string }>,
  productName: string,
): SeoAnalysis {
  const fiveStarCount = reviews.filter(r => r.rating === 5).length

  // Not enough 5★ reviews to extract meaningful phrases
  if (fiveStarCount < 5) {
    return {
      score:       25,
      topPhrases:  [],
      phrases:     [],
      phraseCount: 0,
      reasoning:   `SEO score: 25/100 — insufficient 5★ reviews (${fiveStarCount}) to extract searchable phrases. Product needs more reviews before Amazon A10 keyword optimization can be assessed.`,
    }
  }

  const phrases = extractPhrases(reviews)
  const titleLower = productName.toLowerCase()

  if (phrases.length === 0) {
    return {
      score:       20,
      topPhrases:  [],
      phrases:     [],
      phraseCount: 0,
      reasoning:   `SEO score: 20/100 — no recurring specific phrases found in 5★ reviews after filtering generic terms. Buyers are not using consistent specific language that could drive Amazon search traffic.`,
    }
  }

  // Score the top phrases after blocking generic ones
  const topPhrases = phrases.slice(0, 8)
  const phraseScores = topPhrases.map(p => scorePhraseSpecificity(p))
  const avgPhraseScore = phraseScores.reduce((a, b) => a + b, 0) / phraseScores.length

  // Base score from phrase quality
  let score = 30 + avgPhraseScore

  // Bonus: many distinct recurring phrases = strong organic keyword base
  if (phrases.length >= 10) score += 10
  else if (phrases.length >= 6) score += 5

  // Bonus: product name is distinctive (not just generic category words)
  const productWords = productName.toLowerCase().split(' ')
  const genericProductWords = productWords.filter(w => GENERIC_WORDS.has(w)).length
  if (genericProductWords < productWords.length * 0.5) score += 5

  // Penalty: product name is too short or single word
  if (productName.length < 5) score -= 15
  if (productName.split(' ').length < 2) score -= 5

  // Clamp to 0-100
  score = Math.min(100, Math.max(10, Math.round(score)))

  // Build per-phrase inTitle flag
  const phrasesWithFlag: SeoPhrase[] = topPhrases.slice(0, 5).map(phrase => ({
    phrase,
    inTitle: titleLower.includes(phrase.toLowerCase()),
  }))

  // Build reasoning string for prompt injection
  const topThree = topPhrases.slice(0, 3).join('", "')
  const reasoning = `SEO score: ${score}/100 (pre-calculated from ${fiveStarCount} five-star reviews)
Top recurring phrases from buyers: "${topThree}"
${phrases.length} distinct specific phrases found across 5★ reviews.
Use these exact phrases as your magicKeywords — do not invent different ones.
Amazon A10 signals detected: buyer intent, problem-solution language, material specificity.
The score is LOCKED at ${score} — do not change it.`

  return {
    score,
    topPhrases: topPhrases.slice(0, 5),
    phrases:    phrasesWithFlag,
    phraseCount: phrases.length,
    reasoning,
  }
}