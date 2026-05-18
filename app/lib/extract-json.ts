export function extractJson(content: string): unknown {
  const stripped = content
    .replace(/<think>[\s\S]*?<\/think>/gi, '')
    .replace(/```json\s*/gi, '')
    .replace(/```\s*/g, '')
    .trim()

  const candidates: { json: unknown; length: number }[] = []
  let depth = 0, start = -1, inStr = false, escape = false

  for (let i = 0; i < stripped.length; i++) {
    const ch = stripped[i]
    if (escape)               { escape = false; continue }
    if (ch === '\\' && inStr) { escape = true;  continue }
    if (ch === '"')           { inStr = !inStr;  continue }
    if (inStr) continue
    if (ch === '{') { if (depth === 0) start = i; depth++ }
    else if (ch === '}') {
      depth--
      if (depth === 0 && start !== -1) {
        const candidate = stripped.substring(start, i + 1)
        try {
          candidates.push({ json: JSON.parse(candidate), length: candidate.length })
        } catch {}
        start = -1
      }
    }
  }

  if (candidates.length === 0)
    throw new Error('No valid JSON object found in model response')
  candidates.sort((a, b) => b.length - a.length)
  return candidates[0].json
}
