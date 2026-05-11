/**
 * Returns true if the text looks like random keysmashing or gibberish.
 * Checks: vowel ratio, average word length, and consecutive consonant runs.
 */
export function looksLikeNonsense(text: string): boolean {
  const cleaned = text.trim().toLowerCase()
  if (cleaned.length < 4) return false

  const words = cleaned.split(/\s+/).filter(w => w.length > 0)
  if (words.length === 0) return false

  // Allow short inputs that might be product codes or names
  if (words.length === 1 && cleaned.length <= 20) return false

  const letters = cleaned.replace(/[^a-z]/g, '')
  if (letters.length === 0) return false

  // Vowel ratio — real English text is ~38-42% vowels
  const vowels = (letters.match(/[aeiou]/g) || []).length
  const vowelRatio = vowels / letters.length
  if (vowelRatio < 0.1) return true

  // Avg word length > 12 chars suggests gibberish runs
  const avgWordLen = words.reduce((s, w) => s + w.replace(/[^a-z]/g, '').length, 0) / words.length
  if (avgWordLen > 12) return true

  // Check if >70% of words have no vowels (e.g. "mnkllj ddd fff")
  const noVowelWords = words.filter(w => !/[aeiou]/.test(w) && w.replace(/[^a-z]/g, '').length > 2)
  if (words.length >= 3 && noVowelWords.length / words.length > 0.7) return true

  // Consecutive consonants run > 6 in any single word (e.g. "MNKLLLJJDW")
  for (const word of words) {
    const consonants = word.replace(/[^a-z]/g, '')
    if (/[^aeiou]{7,}/.test(consonants)) return true
  }

  return false
}
