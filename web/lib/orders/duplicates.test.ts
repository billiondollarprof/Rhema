// Tests for the words of the duplicate warning (request 251).
import { describe, expect, it } from 'vitest'
import { elsewhereWords, listWords, sameDrugsWords, sameTestsWords } from './duplicates'

// 24 Nov 2026, 20:40 UTC is 21:40 in Lagos.
const at = '2026-11-24T20:40:00Z'
const later = '2026-11-24T20:46:00Z'

describe('listWords', () => {
  it('joins names the way a person says them', () => {
    expect(listWords(['MP'])).toBe('MP')
    expect(listWords(['MP', 'Widal'])).toBe('MP and Widal')
    expect(listWords(['MP', 'Widal', 'PCV'])).toBe('MP, Widal and PCV')
  })
})

describe('sameTestsWords', () => {
  it('names the tests and when, once each', () => {
    expect(
      sameTestsWords([
        { same: ['Widal', 'PCV'], at, paid: false },
        { same: ['PCV'], at: later, paid: true },
      ]),
    ).toBe(
      'Widal and PCV were already requested for this patient at 24 Nov, 21:40 and 24 Nov, 21:46 and are not done yet.',
    )
  })
  it('says was and is for one test', () => {
    expect(sameTestsWords([{ same: ['MP'], at, paid: false }])).toBe(
      'MP was already requested for this patient at 24 Nov, 21:40 and is not done yet.',
    )
  })
})

describe('sameDrugsWords', () => {
  it('names the drug with its strength', () => {
    expect(sameDrugsWords([{ same: ['Amoxicillin 500 mg'], at, paid: false }])).toBe(
      'Amoxicillin 500 mg was already prescribed for this patient at 24 Nov, 21:40 and is not given yet.',
    )
  })
})

describe('elsewhereWords', () => {
  it('says paid or not, for the Front Desk', () => {
    expect(elsewhereWords([{ same: ['MP', 'Widal'], at, paid: true }])).toBe(
      'This patient has MP and Widal on another request too (asked for at 24 Nov, 21:40, paid). Check before taking payment twice.',
    )
  })
})
