// Tests for the whole number check behind the red boxes (request 252).
import { describe, expect, it } from 'vitest'
import { countWrong, quantityWrong } from './wrong'

describe('countWrong', () => {
  it('lets whole numbers in range through, and an empty box', () => {
    expect(countWrong('3')).toBe(false)
    expect(countWrong('0')).toBe(false)
    expect(countWrong('')).toBe(false)
    expect(countWrong(null)).toBe(false)
  })
  it('marks a decimal, a negative, words, and a number past the top', () => {
    expect(countWrong('2.5')).toBe(true)
    expect(countWrong('-1')).toBe(true)
    expect(countWrong('abc')).toBe(true)
    expect(countWrong('31', 0, 30)).toBe(true)
    expect(countWrong('0', 1)).toBe(true)
  })
})

describe('quantityWrong', () => {
  it('lets a quantity through, with or without a decimal', () => {
    expect(quantityWrong('2.5')).toBe(false)
    expect(quantityWrong('200', 0.01)).toBe(false)
  })
  it('marks two dots, words, and a number under the lowest', () => {
    expect(quantityWrong('1.2.3')).toBe(true)
    expect(quantityWrong('abc')).toBe(true)
    expect(quantityWrong('0', 0.01)).toBe(true)
  })
})
