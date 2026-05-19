export function parseCSV(
  csvText: string,
): Array<{ rating: number; text: string; date: string }> {
  const lines = csvText.trim().replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n')
  if (lines.length < 2) throw new Error('CSV file is empty or has no reviews')

  const header = lines[0].toLowerCase().replace(/"/g, '').replace(/\r/g, '')
  const cols   = header.split(',').map((c) => c.trim())

  const ratingIdx = cols.findIndex(
    (c) => c.includes('rating') || c.includes('stars') || c.includes('score'),
  )
  const reviewIdx = cols.findIndex(
    (c) =>
      c.includes('review') ||
      c.includes('text')   ||
      c.includes('comment')||
      c.includes('body')   ||
      c.includes('content'),
  )
  const dateIdx = cols.findIndex(
    (c) => c.includes('date') || c.includes('time') || c.includes('created'),
  )

  if (reviewIdx === -1) {
    throw new Error('CSV must have a column named "review", "text", "comment", or "body"')
  }

  const reviews: Array<{ rating: number; text: string; date: string }> = []

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim()
    if (!line) continue

    const fields: string[] = []
    let current  = ''
    let inQuotes = false
    for (const char of line) {
      if (char === '"') { inQuotes = !inQuotes; continue }
      if (char === ',' && !inQuotes) { fields.push(current.trim()); current = ''; continue }
      current += char
    }
    fields.push(current.trim())

    let reviewText = fields[reviewIdx]?.replace(/^"|"$/g, '').trim()
    if (!reviewText || reviewText.length < 5) continue
    // Defuse CSV formula injection
    if (/^[=+\-@\t\r]/.test(reviewText)) reviewText = reviewText.replace(/^[=+\-@\t\r]+/, '')

    const ratingRaw = ratingIdx !== -1
      ? fields[ratingIdx]?.replace(/^"|"$/g, '').trim()
      : '5'
    const rating = Math.min(5, Math.max(1, parseInt(ratingRaw) || 5))
    const date   = dateIdx !== -1
      ? fields[dateIdx]?.replace(/^"|"$/g, '').trim()
      : ''

    reviews.push({ rating, text: reviewText, date })
  }

  if (reviews.length === 0) throw new Error('No valid reviews found in CSV')
  return reviews
}
