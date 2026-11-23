// Tests for the number of doses in a chart course (request 240).
import { describe, expect, it } from 'vitest'
import { courseDoses, doseWords } from './doses'

describe('courseDoses', () => {
  it('works out the doses from how often and the days', () => {
    expect(courseDoses('Twice daily', 3)).toBe(6)
    expect(courseDoses('Every 8 hours', 5)).toBe(15)
    expect(courseDoses('Four times daily', 2)).toBe(8)
    expect(courseDoses('once daily', 7)).toBe(7)
  })
  it('knows a single dose and a weekly one', () => {
    expect(courseDoses('Once only (stat)', null)).toBe(1)
    expect(courseDoses('Once weekly', 14)).toBe(2)
  })
  it('does not guess', () => {
    expect(courseDoses('When needed', 5)).toBeNull()
    expect(courseDoses('After meals', 5)).toBeNull()
    expect(courseDoses('Twice daily', null)).toBeNull()
  })
})

describe('doseWords', () => {
  it('says how many of the course are given', () => {
    expect(doseWords(2, 6)).toBe('2 of 6 doses given')
    expect(doseWords(3, null)).toBe('3 doses given')
  })
})
