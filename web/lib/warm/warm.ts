/*
 * lib/warm/warm.ts: load Messages and History quietly after the app opens,
 * so they show at once when tapped (request 230b).
 *
 * Why: Anthony, 2026-11-20: "before a person opens any button, at the
 * background, many of the next sections loads down... When they click on
 * messages, any recent messages... history." And: "the device they are
 * using... the desktop... 2 gig RAM... do it in a way that... their system
 * is still able to carry it."
 *
 * How:
 *   1. Once per person per opening of the app, a few seconds after the first
 *      screen shows: Messages (the rooms, the people, the recent messages and
 *      who read them), then History for the period it opens on (the shift
 *      for the Front Desk, today for others).
 *   2. One after the other, with a pause between, so the first screen and a
 *      slow network are never crowded.
 *   3. Kept in memory only (lib/cache/memory), under the same names the
 *      screens use, so each screen shows it at once and then loads a fresh
 *      copy as usual. Nothing goes on the disk, and sign out empties it.
 *   Notifications need nothing here: the menu bubble already loads them.
 *
 * Never: keep any of this on the disk, load more than a screen would load
 * itself, or load for somebody who would not see it on that screen.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import type { StaffMember } from '@/lib/auth/session'
import { remember } from '@/lib/cache/memory'
import { loadMessages, loadReads, loadRoomStaff, loadRooms } from '@/lib/messages/messages'
import {
  loadLab,
  loadMoney,
  loadMyWork,
  loadPharmacy,
  loadShiftStart,
  periodRange,
} from '@/lib/history/history'

// ===== 1. Once per person per opening of the app =====
const warmed = new Set<string>()
const FIRST_WAIT = 6000
const BETWEEN = 6000

const pause = (ms: number) => new Promise((done) => window.setTimeout(done, ms))

export function warmUp(client: SupabaseClient, staff: StaffMember) {
  if (warmed.has(staff.id)) return
  warmed.add(staff.id)
  void (async () => {
    await pause(FIRST_WAIT)
    await warmMessages(client, staff.id)
    await pause(BETWEEN)
    await warmHistory(client, staff)
  })()
}

// ===== 2. Messages: the same four things the Messages screen loads =====
async function warmMessages(client: SupabaseClient, staffId: string) {
  try {
    const [rooms, people, messages] = await Promise.all([
      loadRooms(client),
      loadRoomStaff(client),
      loadMessages(client),
    ])
    remember(staffId, 'rooms', rooms)
    remember(staffId, 'room-staff', people)
    remember(staffId, 'messages', messages)
    remember(
      staffId,
      'message-reads',
      await loadReads(
        client,
        messages.map((message) => message.id),
      ),
    )
  } catch {
    // No network: the screen loads it when opened, as before.
  }
}

// ===== 3. History: the period it opens on, for the parts this person sees =====
export type WarmHistory = {
  shiftStart: Date
  money: Awaited<ReturnType<typeof loadMoney>> | null
  lab: Awaited<ReturnType<typeof loadLab>> | null
  pharmacy: Awaited<ReturnType<typeof loadPharmacy>> | null
  work: Awaited<ReturnType<typeof loadMyWork>> | null
}

export const HISTORY_KEY = 'history-default'

async function warmHistory(client: SupabaseClient, staff: StaffMember) {
  try {
    const frontDesk = staff.role === 'front_desk' && !staff.can_admin
    const shiftStart = (await loadShiftStart(client)) ?? new Date(new Date().setHours(0, 0, 0, 0))
    const range = frontDesk ? { from: shiftStart, to: new Date() } : periodRange('today')
    if (!range) return
    const seesMoney = staff.role === 'front_desk' || staff.can_admin
    const [money, lab, pharmacy, work] = await Promise.all([
      seesMoney ? loadMoney(client, range.from, range.to, false, null) : null,
      staff.role === 'laboratory' ? loadLab(client, range.from, range.to) : null,
      staff.role === 'pharmacy' ? loadPharmacy(client, range.from, range.to) : null,
      staff.can_medical ? loadMyWork(client, range.from, range.to) : null,
    ])
    remember<WarmHistory>(staff.id, HISTORY_KEY, { shiftStart, money, lab, pharmacy, work })
  } catch {
    // No network: the screen loads it when opened, as before.
  }
}
