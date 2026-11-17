// ranges.test.ts: above or below the normal range (request 219c, number 3).
import { describe, expect, it } from 'vitest'
import { markOf } from './ranges'

describe('markOf', () => {
  it('a plain range', () => {
    expect(markOf('WBC: 12 x10³/mm³ (normal 4 to 10)', null)).toBe('high')
    expect(markOf('WBC: 3.9 x10³/mm³ (normal 4 to 10)', null)).toBe('low')
    expect(markOf('WBC: 4 x10³/mm³ (normal 4 to 10)', null)).toBeNull()
    expect(markOf('WBC: 10 x10³/mm³ (normal 4 to 10)', null)).toBeNull()
  })
  it('by sex, and no mark when the sex is not known', () => {
    const line = 'HB: 13 g/dl (normal M 14 to 18, F 12 to 14)'
    expect(markOf(line, 'male')).toBe('low')
    expect(markOf(line, 'female')).toBeNull()
    expect(markOf(line, null)).toBeNull()
    expect(markOf('X: 30 (normal men 3.45 to 17.42, women 4.60 to 25.07)', 'female')).toBe('high')
  })
  it('below and or more', () => {
    expect(markOf('Cholesterol: 210 mg/dl (normal below 200)', null)).toBe('high')
    expect(markOf('Cholesterol: 199 mg/dl (normal below 200)', null)).toBeNull()
    expect(markOf('Ratio: 3 (normal 4 or more)', null)).toBe('low')
  })
  it('no mark for words, ranges that depend on context, or lines without a range', () => {
    expect(markOf('Malaria parasite: Seen (+) (normal Negative)', null)).toBeNull()
    expect(
      markOf('Glucose: 150 mg/dl (normal fasting 70 to 110, random below 140)', null),
    ).toBeNull()
    expect(
      markOf('Glucose: 150 mg/dl (normal below 92 in pregnancy, below 110 otherwise)', null),
    ).toBeNull()
    expect(markOf('Comment: repeat in 2 weeks', null)).toBeNull()
    expect(markOf('PCV: 1,200 (normal 100 to 300)', null)).toBe('high')
  })
})
