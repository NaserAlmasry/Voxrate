import { describe, it, expect } from 'vitest'
import { parseCSV } from '../parse-csv'

const csv = (header: string, ...rows: string[]) =>
  [header, ...rows].join('\n')

describe('parseCSV', () => {
  it('parses a simple rating,review CSV', () => {
    const result = parseCSV(csv('rating,review', '5,Great product!', '1,Terrible quality'))
    expect(result).toHaveLength(2)
    expect(result[0]).toMatchObject({ rating: 5, text: 'Great product!' })
    expect(result[1]).toMatchObject({ rating: 1, text: 'Terrible quality' })
  })

  it('accepts "stars" and "text" column names', () => {
    const result = parseCSV(csv('stars,text', '4,Decent product overall'))
    expect(result[0].rating).toBe(4)
    expect(result[0].text).toBe('Decent product overall')
  })

  it('accepts "body" as review column name', () => {
    const result = parseCSV(csv('rating,body', '3,Average at best'))
    expect(result[0].text).toBe('Average at best')
  })

  it('accepts "comment" as review column name', () => {
    const result = parseCSV(csv('rating,comment', '5,Loved it'))
    expect(result[0].text).toBe('Loved it')
  })

  it('handles quoted fields with commas inside', () => {
    const result = parseCSV(csv('rating,review', '5,"Great product, fast shipping"'))
    expect(result[0].text).toBe('Great product, fast shipping')
  })

  it('clamps ratings to 1–5', () => {
    // parseInt('0') is 0 (falsy), so || 5 applies — 0-star reviews become 5-star (defaulted)
    // parseInt('9') is 9, clamped to 5 via Math.min
    const result = parseCSV(csv('rating,review', '9,Too high rating', '0,Defaulted to five'))
    expect(result[0].rating).toBe(5)
    expect(result[1].rating).toBe(5) // 0 is treated as missing → defaults to 5
  })

  it('defaults rating to 5 when column is missing', () => {
    const result = parseCSV(csv('review', 'No rating column here'))
    expect(result[0].rating).toBe(5)
  })

  it('skips rows with review text shorter than 5 chars', () => {
    const result = parseCSV(csv('rating,review', '5,ok', '5,Long enough review'))
    expect(result).toHaveLength(1)
    expect(result[0].text).toBe('Long enough review')
  })

  it('skips empty rows', () => {
    const result = parseCSV(csv('rating,review', '5,Good product', '', '1,Bad product'))
    expect(result).toHaveLength(2)
  })

  it('strips CSV formula injection characters', () => {
    // '@bad' strips to 'bad' (3 chars) → filtered by min-length check
    // '=SUM(...)' and '+cmd|...' strip to content > 5 chars → kept
    const result = parseCSV(csv('rating,review', '5,=SUM(A1:A10) formula', '3,+cmd|calc|more'))
    expect(result[0].text).not.toMatch(/^=/)
    expect(result[1].text).not.toMatch(/^\+/)
  })

  it('throws if no review column is found', () => {
    expect(() => parseCSV(csv('price,quantity', '10,5'))).toThrow(/column named/)
  })

  it('throws if CSV has only a header row', () => {
    expect(() => parseCSV('rating,review')).toThrow(/empty|no reviews/i)
  })

  it('throws if no valid reviews found after filtering', () => {
    expect(() => parseCSV(csv('rating,review', '5,ok', '5,x'))).toThrow(/no valid reviews/i)
  })

  it('handles Windows CRLF line endings', () => {
    const result = parseCSV('rating,review\r\n5,Good product\r\n1,Bad product')
    expect(result).toHaveLength(2)
  })

  it('extracts date when column exists', () => {
    const result = parseCSV(csv('rating,review,date', '5,Great product,2024-01-15'))
    expect(result[0].date).toBe('2024-01-15')
  })
})
