/**
 * Returns true if the text looks like random keysmashing or gibberish.
 */
export function looksLikeNonsense(text: string): boolean {
  const cleaned = text.trim().toLowerCase()
  if (cleaned.length < 4) return false

  const words = cleaned.split(/\s+/).filter(w => w.length > 0)
  if (words.length === 0) return false

  const letters = cleaned.replace(/[^a-z]/g, '')
  if (letters.length === 0) return false

  // Vowel ratio — real English text is ~38-42% vowels; gibberish is much lower
  const vowels = (letters.match(/[aeiou]/g) || []).length
  const vowelRatio = vowels / letters.length
  if (vowelRatio < 0.1) return true

  // Single long word with very low vowels (e.g. "rwerhwrhwrthr")
  if (words.length === 1 && vowelRatio < 0.2) return true

  // Avg word length > 12 chars suggests gibberish
  const avgWordLen = words.reduce((s, w) => s + w.replace(/[^a-z]/g, '').length, 0) / words.length
  if (avgWordLen > 12) return true

  // >70% of words have no vowels
  const noVowelWords = words.filter(w => !/[aeiou]/.test(w) && w.replace(/[^a-z]/g, '').length > 2)
  if (words.length >= 3 && noVowelWords.length / words.length > 0.7) return true

  // Consecutive consonant run > 6 in any single word
  for (const word of words) {
    const letters = word.replace(/[^a-z]/g, '')
    if (/[^aeiou]{7,}/.test(letters)) return true
  }

  return false
}

const REVIEW_SIGNAL_WORDS = new Set([
  'product', 'item', 'order', 'shipping', 'delivery', 'quality', 'arrived', 'package',
  'bought', 'purchased', 'received', 'seller', 'shop', 'store', 'etsy', 'broken',
  'damaged', 'perfect', 'beautiful', 'love', 'hate', 'disappointed', 'happy', 'great',
  'terrible', 'awful', 'excellent', 'poor', 'fast', 'slow', 'wrong', 'missing',
  'refund', 'return', 'size', 'color', 'colour', 'material', 'fabric', 'fit',
  'expected', 'exactly', 'recommend', 'worth', 'waste', 'money', 'price',
  'described', 'accurate', 'accurate', 'smells', 'looks', 'feels', 'works',
  'stopped', 'broke', 'cracked', 'faded', 'scratched', 'pleased', 'upset',
  'nice', 'bad', 'good', 'okay', 'fine', 'amazing', 'horrible', 'lovely',
])

/**
 * Returns true if text looks like a genuine product review.
 * Rejects off-topic questions, opinions, or unrelated sentences.
 */
export function looksLikeReview(text: string): boolean {
  const lower = text.trim().toLowerCase()
  const words = lower.split(/\W+/).filter(w => w.length > 2)

  // Must have at least 4 words
  if (words.length < 4) return false

  // At least one word must be review-related
  return words.some(w => REVIEW_SIGNAL_WORDS.has(w))
}
