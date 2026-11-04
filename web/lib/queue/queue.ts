/*
 * lib/queue/queue.ts: reading and moving the patient queue.
 *
 * Why: the home screens (and later the patients pages) need the same few
 * things: today's counts, the patients waiting in a room, the "patients
 * seen" numbers for the chart, and moving a patient on. Keeping them here
 * means every screen asks the database the same way.
 *
 * Who may see what is decided by the database (queue_entries RLS): only
 * staff with the patients permission. These functions never widen that.
 *
 * Never: put clinical detail into a queue note, and never log a patient's
 * name. Errors here are reported by queue entry number only.
 */
import type { SupabaseClient } from '@supabase/supabase-js'

// ===== 1. Shapes =====
export type QueueStatus = 'waiting' | 'in_consultation' | 'lab' | 'pharmacy' | 'done'

export type QueueEntry = {
  id: number
  status: QueueStatus
  note: string | null
  created_at: string
  room: { id: number; name: string; kind: string } | null
  patient: { patient_number: string; full_name: string; category: string } | null
}

export type TodayCounts = {
  registeredToday: number
  waiting: number
  inConsultation: number
  completedToday: number
}

export type Period = 'week' | 'month' | 'year' | 'five_years'

// The words staff see for each status.
export const STATUS_LABELS: Record<QueueStatus, string> = {
  waiting: 'Waiting',
  in_consultation: 'In consultation',
  lab: 'At the lab',
  pharmacy: 'At the pharmacy',
  done: 'Done',
}

// How a visit ended, in the words staff see (requests 140 and 147).
// Calling in the next patient means this one was seen, so both say Seen.
export const FINISH_WORDS: Record<string, string> = {
  finished: 'Seen',
  next_called: 'Seen',
  moved: 'Moved',
  left: 'Left',
  end_of_day: 'Closed at the end of the day',
}

// The words staff see for each patient category (stored in lower case).
export const CATEGORY_LABELS: Record<string, string> = {
  individual: 'Individual',
  family: 'Family',
  antenatal: 'Antenatal',
}

// Midnight today on this device. The hospital's devices are in Nigeria.
function startOfToday(): string {
  const now = new Date()
  return new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString()
}

// ===== 2. Today's counts for the tiles =====
export async function loadTodayCounts(client: SupabaseClient): Promise<TodayCounts> {
  const today = startOfToday()
  const count = async (query: PromiseLike<{ count: number | null }>) => (await query).count ?? 0

  const [registeredToday, waiting, inConsultation, completedToday] = await Promise.all([
    count(
      client.from('patients').select('id', { count: 'exact', head: true }).gte('created_at', today),
    ),
    count(
      client
        .from('queue_entries')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'waiting'),
    ),
    count(
      client
        .from('queue_entries')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'in_consultation'),
    ),
    count(
      client
        .from('queue_entries')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'done')
        .gte('finished_at', today),
    ),
  ])
  return { registeredToday, waiting, inConsultation, completedToday }
}

// ===== 3. The open queue (everyone not yet done) =====
export async function loadOpenQueue(client: SupabaseClient): Promise<QueueEntry[]> {
  const { data } = await client
    .from('queue_entries')
    .select(
      'id, status, note, created_at, room:rooms(id, name, kind), patient:patients(patient_number, full_name, category)',
    )
    .neq('status', 'done')
    .order('created_at', { ascending: true })
  return (data as unknown as QueueEntry[] | null) ?? []
}

// ===== 4. Move a patient on =====
// Calling in sets the time they were called; finishing sets the end time.
export async function moveTo(
  client: SupabaseClient,
  entryId: number,
  status: QueueStatus,
): Promise<string | null> {
  const change: Record<string, string> = { status }
  if (status === 'in_consultation') change.called_at = new Date().toISOString()
  if (status === 'done') change.finished_at = new Date().toISOString()
  const { error } = await client.from('queue_entries').update(change).eq('id', entryId)
  if (error) {
    console.warn(`Queue entry ${entryId} could not be moved: ${error.code}`)
    return 'That could not be saved. Try again.'
  }
  return null
}

// ===== 5. "Patients seen" for the chart =====
// The database counts per day, month or year; this fills the empty ones
// with 0 so the chart has one point per day (or month, or year).
export async function loadPatientsSeen(
  client: SupabaseClient,
  period: Period,
): Promise<{ labels: string[]; values: number[] }> {
  const { data } = await client.rpc('patients_seen', { period })
  const counts = new Map<string, number>()
  for (const row of (data as { bucket: string; total: number }[] | null) ?? []) {
    counts.set(
      row.bucket.slice(0, period === 'five_years' ? 4 : period === 'year' ? 7 : 10),
      Number(row.total),
    )
  }

  const labels: string[] = []
  const values: number[] = []
  const now = new Date()
  if (period === 'week' || period === 'month') {
    const days = period === 'week' ? 7 : 30
    for (let back = days - 1; back >= 0; back--) {
      const day = new Date(now.getFullYear(), now.getMonth(), now.getDate() - back)
      const key = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}`
      labels.push(
        period === 'week'
          ? day.toLocaleDateString('en-GB', { weekday: 'short' })
          : String(day.getDate()),
      )
      values.push(counts.get(key) ?? 0)
    }
  } else if (period === 'year') {
    for (let back = 11; back >= 0; back--) {
      const month = new Date(now.getFullYear(), now.getMonth() - back, 1)
      const key = `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, '0')}`
      labels.push(month.toLocaleDateString('en-GB', { month: 'short' }))
      values.push(counts.get(key) ?? 0)
    }
  } else {
    for (let back = 4; back >= 0; back--) {
      const year = String(now.getFullYear() - back)
      labels.push(year)
      values.push(counts.get(year) ?? 0)
    }
  }
  return { labels, values }
}

// ===== 6. Move a patient who is already in a room, or mark that they left =====
// Move ends the visit in the old room and starts one in the new room; the
// database does both at once, and twice is once (request 140).
export async function movePatient(
  client: SupabaseClient,
  entryId: number,
  roomId: number,
  note: string,
): Promise<string | null> {
  const { error } = await client.rpc('move_patient', { entry: entryId, room: roomId, note })
  if (error) {
    console.warn(`Queue entry ${entryId} could not be moved: ${error.code}`)
    return 'The patient could not be moved. Check the network and try again.'
  }
  return null
}

// Has left: the Front Desk or an admin ends a visit, with the time.
export async function markLeft(client: SupabaseClient, entryId: number): Promise<string | null> {
  const { error } = await client.rpc('mark_left', { entry: entryId })
  if (error) {
    console.warn(`Queue entry ${entryId} could not be marked as left: ${error.code}`)
    return 'That could not be saved. Try again.'
  }
  return null
}
