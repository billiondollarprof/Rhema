// Tests for which requests count as a save that other apps should hear
// about (request 157). Run with `npm run check:tests`.
import { describe, expect, it } from 'vitest'
import { isSharedSave } from './changes'

const DB = 'https://x.supabase.co/rest/v1/'

describe('isSharedSave', () => {
  it('a read never counts, so apps cannot set each other off forever', () => {
    expect(isSharedSave(DB + 'patients?select=*', 'GET')).toBe(false)
    expect(isSharedSave(DB + 'rpc/patients_seen', 'POST')).toBe(false)
    expect(isSharedSave(DB + 'rpc/open_record', 'POST')).toBe(false)
    expect(isSharedSave(DB + 'rpc/note_presence', 'POST')).toBe(false)
  })

  it('saving only your own things does not count', () => {
    for (const own of [
      'set_my_pin',
      'check_my_pin',
      'mark_lab_result_seen',
      'register_push_device',
      'agree_to_terms',
    ]) {
      expect(isSharedSave(DB + 'rpc/' + own, 'POST')).toBe(false)
    }
  })

  it('saving a shared thing counts', () => {
    expect(isSharedSave(DB + 'patients', 'POST')).toBe(true)
    expect(isSharedSave(DB + 'vital_signs?id=eq.4', 'PATCH')).toBe(true)
    expect(isSharedSave(DB + 'rpc/move_patient', 'POST')).toBe(true)
    expect(isSharedSave(DB + 'rpc/record_lab_results', 'post')).toBe(true)
    expect(isSharedSave(DB + 'rpc/take_payment', 'POST')).toBe(true)
  })

  it('sign in and other addresses never count', () => {
    expect(isSharedSave('https://x.supabase.co/auth/v1/token', 'POST')).toBe(false)
    expect(isSharedSave('/api/files/lab', 'POST')).toBe(false)
  })
})
