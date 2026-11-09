// Tests for the receipt number people see (request 159).
import { describe, expect, it } from 'vitest'
import { receiptCode } from './payments'

describe('receiptCode', () => {
  it('reads like a bank reference: the day paid, then the number, in fours', () => {
    expect(receiptCode('RCT-000123', '2026-11-09T07:52:00Z')).toBe('2611 0900 0123')
  })
  it('uses the day in Lagos, not in London', () => {
    // 23:30 UTC on the 9th is 00:30 on the 10th in Lagos.
    expect(receiptCode('RCT-000001', '2026-11-09T23:30:00Z')).toBe('2611 1000 0001')
  })
  it('keeps every digit when the number grows past six', () => {
    expect(receiptCode('RCT-1234567', '2026-01-02T10:00:00Z')).toBe('2601 0212 3456 7')
  })
  it('never looks like a patient number', () => {
    expect(receiptCode('RCT-000001', '2026-11-09T07:52:00Z')).not.toMatch(/RMC|RCT/)
  })
})
