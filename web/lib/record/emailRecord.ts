/*
 * lib/record/emailRecord.ts: asks the Worker to email a patient their record.
 *
 * Why: Anthony, 2026-11-10: nurses and doctors may send a medical record to
 * the patient's email, only because the patient gave that email.
 *
 * The Worker reads the record again as this person and sends to the email on
 * the patient's own record. Nothing here chooses the address.
 *
 * Never: send an address from the screen, or keep the address anywhere.
 */
import type { SupabaseClient } from '@supabase/supabase-js'

// Returns null when it went, or the words to show.
export async function emailRecord(
  client: SupabaseClient,
  patientId: number,
): Promise<string | null> {
  const { data } = await client.auth.getSession()
  const token = data.session?.access_token
  if (!token) return 'Please sign in again.'
  try {
    const answer = await fetch('/api/records/email', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ patientId }),
    })
    if (answer.ok) return null
    if (answer.status === 409) return 'This patient has no email on their record.'
    if (answer.status === 403) return 'You cannot send this record.'
  } catch {
    // No network: the words below.
  }
  return 'The email did not go. Check the internet and try again.'
}
