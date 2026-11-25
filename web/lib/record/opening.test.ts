// Tests for telling an old record opening apart from other refusals (request 248).
import { describe, expect, it } from 'vitest'
import { isOldOpening } from './opening'

describe('isOldOpening', () => {
  it('is the record rule refusing a row', () => {
    const error = {
      code: '42501',
      message: 'new row violates row-level security policy for table "antenatal_visits"',
    }
    expect(isOldOpening(error)).toBe(true)
  })
  it('is not another rule that uses the same code', () => {
    expect(isOldOpening({ code: '42501', message: 'Only active clinical staff can sign' })).toBe(
      false,
    )
  })
  it('is not a number out of range, or no error at all', () => {
    expect(isOldOpening({ code: '23514', message: 'violates check constraint' })).toBe(false)
    expect(isOldOpening(null)).toBe(false)
  })
})
