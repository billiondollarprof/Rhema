// zone.test.ts: the day a moment falls on, by the hospital's clock (226a).
import { describe, expect, it } from 'vitest'
import { HOSPITAL_TIME_ZONE, hospitalDay } from './zone'

describe('hospitalDay', () => {
  it('is Nigeria unless the hospital says otherwise', () => {
    expect(HOSPITAL_TIME_ZONE).toBe('Africa/Lagos')
  })
  it('uses Lagos time, one hour ahead of UTC', () => {
    // 23:30 UTC on the 16th is 00:30 on the 17th in Lagos.
    expect(hospitalDay('2026-11-16T23:30:00Z')).toBe('2026-11-17')
    expect(hospitalDay('2026-11-16T22:30:00Z')).toBe('2026-11-16')
  })
})
