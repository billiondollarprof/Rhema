// Tests for drugs and lab tests that expire unpaid (request 228a).
import { describe, expect, it, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { expireUnpaid, isExpiredRefusal } from './expiry'

describe('isExpiredRefusal', () => {
  it('knows the database refusing an expired one', () => {
    expect(isExpiredRefusal({ message: 'expired: not paid within 72 hours' })).toBe(true)
  })
  it('does not mistake any other failure for it', () => {
    expect(isExpiredRefusal({ message: 'Failed to fetch' })).toBe(false)
    expect(isExpiredRefusal(null)).toBe(false)
  })
})

describe('expireUnpaid', () => {
  it('asks the database once, however many lists load together', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: 0, error: null })
    const client = { rpc } as unknown as SupabaseClient
    await Promise.all([expireUnpaid(client), expireUnpaid(client), expireUnpaid(client)])
    expect(rpc).toHaveBeenCalledTimes(1)
    expect(rpc).toHaveBeenCalledWith('expire_unpaid')
  })
})
