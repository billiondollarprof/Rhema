/*
 * lib/patients/age.test.ts: checks for the age and waiting time words.
 */
import { describe, expect, it } from 'vitest'
import { ageFrom, waitedSince } from './age'
import { cleanPhone, phoneLooksRight } from './patients'

describe('ageFrom', () => {
  const today = new Date('2026-10-29T10:00:00')
  it('gives years for adults', () => expect(ageFrom('1990-01-01', today)).toBe('36 years'))
  it('does not count the birthday before it comes', () =>
    expect(ageFrom('1990-11-15', today)).toBe('35 years'))
  it('gives months for babies', () => expect(ageFrom('2026-06-10', today)).toBe('4 months'))
  it('gives days for the newborn', () => expect(ageFrom('2026-10-25', today)).toBe('4 days'))
  it('gives a year and months', () => expect(ageFrom('2025-07-01', today)).toBe('1 year 3 months'))
  it('says nothing for a date in the future', () => expect(ageFrom('2027-01-01', today)).toBe(''))
})

describe('waitedSince', () => {
  const now = new Date('2026-10-29T10:00:00Z')
  it('gives minutes', () => expect(waitedSince('2026-10-29T09:35:00Z', now)).toBe('25 min'))
  it('gives hours and minutes', () =>
    expect(waitedSince('2026-10-29T08:50:00Z', now)).toBe('1 hr 10 min'))
})

describe('phone numbers', () => {
  it('tidies spaces', () => expect(cleanPhone('0803 555 0126')).toBe('08035550126'))
  it('turns +234 into 0', () => expect(cleanPhone('+234 803 555 0126')).toBe('08035550126'))
  it('accepts 11 digits from 0', () => expect(phoneLooksRight('08035550126')).toBe(true))
  it('refuses a short number', () => expect(phoneLooksRight('0803555')).toBe(false))
})
