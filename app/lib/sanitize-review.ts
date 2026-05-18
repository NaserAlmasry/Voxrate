// Strips common prompt injection patterns from review text before it enters
// an LLM prompt. Targets jailbreak phrases that could redirect model behavior.
// Deliberately conservative — only matches patterns that are unambiguous
// injection attempts, not legitimate reviewer language.
export function sanitizeReview(t: string): string {
  return t
    .replace(/ignore\s+(previous|all|above|prior)\s+(instructions?|prompts?|context)/gi, '[…]')
    .replace(/you\s+are\s+(now|a|an)\s+(?=\w)/gi, '[…]')
    .replace(/(?<!\w)system\s*:/gi, '[…]')
    .replace(/(?<!\w)assistant\s*:/gi, '[…]')
    .replace(/disregard\s+(all|previous|prior|above)/gi, '[…]')
    .replace(/forget\s+(all|previous|prior|above)/gi, '[…]')
    .replace(/override\s+(your|all|previous)\s+\w/gi, '[…]')
    .replace(/\bdo not follow\s+\w/gi, '[…]')
    .replace(/\bnew instruction\b/gi, '[…]')
}
