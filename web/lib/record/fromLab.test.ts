// Tests for reading values out of lab results (request 256).
import { describe, expect, it } from 'vitest'
import {
  LAB_NAMES,
  dipstickWords,
  newestNumber,
  newestValue,
  shortBloodGroup,
  type LabLine,
} from './fromLab'

const daysAgo = (days: number) => new Date(Date.now() - days * 86400000).toISOString()

const results: LabLine[] = [
  {
    test: 'Full Blood Count (FBC)',
    result: 'WBC: 6 x10³/mm³ (normal 4 to 10)\nHB: 10.5 g/dl (normal M 14 to 18, F 12 to 14)',
    recorded_at: daysAgo(3),
  },
  {
    test: 'Haemoglobin (HB)',
    result: 'Haemoglobin (HB): 9 g/dl (normal M 14 to 18, F 12 to 14)',
    recorded_at: daysAgo(40),
  },
  {
    test: 'Urinalysis',
    result: 'Urinalysis:\nProtein: Negative\nGlucose: ++++\nComment: clear',
    recorded_at: daysAgo(1),
  },
  { test: 'Blood Group', result: 'Blood Group: O Rh D positive', recorded_at: daysAgo(10) },
]

describe('newestValue and newestNumber', () => {
  it('finds the newest HB and leaves out the unit and the normal range', () => {
    expect(newestNumber(results, LAB_NAMES.hb)).toEqual({
      value: '10.5',
      at: results[0].recorded_at,
    })
  })
  it('keeps to results recent enough', () => {
    expect(newestNumber(results, LAB_NAMES.hb, 2)).toBe(null)
  })
  it('reads a line inside a longer result', () => {
    expect(newestValue(results, LAB_NAMES.protein)?.value).toBe('Negative')
  })
  it('finds nothing for a test never done', () => {
    expect(newestValue(results, LAB_NAMES.genotype)).toBe(null)
  })
})

describe('dipstickWords', () => {
  it('puts the lab words into the visit words', () => {
    expect(dipstickWords('Negative')).toBe('Nil')
    expect(dipstickWords('Small')).toBe('Trace')
    expect(dipstickWords('++')).toBe('++')
  })
  it('leaves a word the visit does not take', () => {
    expect(dipstickWords('++++')).toBe(null)
  })
})

describe('shortBloodGroup', () => {
  it('writes the short form', () => {
    expect(shortBloodGroup('O Rh D positive')).toBe('O+')
    expect(shortBloodGroup('AB Rh D negative')).toBe('AB-')
  })
  it('keeps anything else as written', () => {
    expect(shortBloodGroup('Not done')).toBe('Not done')
  })
})
