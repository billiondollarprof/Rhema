/*
 * lib/notifications/notifications.ts: everything waiting for this person,
 * in one list (request 132).
 *
 * Why: Anthony, 2026-11-02: Notifications sits behind the menu button, so
 * "the hamburger menu will be showing a bubble, red, with... the number of
 * notifications that are unread... so it catches someone's eye."
 *
 * What counts, from what the app already knows (no new data is kept):
 *   - messages to your room not read yet, per room
 *   - announcements you have not tapped Got it on
 *   - lab results ready for tests you asked for
 *   - work waiting for your role: tests to pay for and drugs to pay for
 *     (Front Desk and admins), tests to do (Laboratory), prescriptions to
 *     dispense (Pharmacy)
 * Each line says what it is in a whole sentence. Tapped, it unfolds in
 * place and shows each thing waiting, with one button that goes straight
 * to where it is dealt with (Anthony, 2026-11-04: "just be clicking a maybe
 * a drop down to review all the notification... fold it back, open the
 * next one"). The bubble is the sum of the numbers.
 *
 * The last list is kept in memory, so opening Notifications shows it at
 * once while a fresh one loads (request 145).
 *
 * Never: send anybody to Home for something that has its own place.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import type { StaffMember } from '../auth/session'
import {
  listAwaitingPayment,
  listAwaitingTest,
  listMyReadyResults,
  type LabRequest,
} from '../lab/lab'
import {
  activeAnnouncements,
  loadMessages,
  loadReads,
  loadRooms,
  myAnnouncementReads,
} from '../messages/messages'
import {
  listAwaitingDispense,
  listAwaitingPayment as drugsAwaitingPayment,
  type Prescription,
} from '../pharmacy/pharmacy'
import { when } from '../record/record'
import { recall, remember } from '../cache/memory'

// ===== 1. The shapes =====
// One thing waiting, shown when its notice is unfolded.
export type NoticeItem = {
  key: string
  title: string
  detail: string | null
  time: string
  // Where the button goes, or an announcement to mark as read.
  action: { label: string; href: string } | { label: string; announcement: number }
}

// card: the Lab or Pharmacy card is shown inside the notice instead of the
// items, so payment, results and dispensing are done right there.
export type Notice = {
  key: string
  count: number
  words: string
  items: NoticeItem[]
  card?: 'lab' | 'pharmacy'
}

const many = (count: number, one: string, more: string) => `${count} ${count === 1 ? one : more}`

function patientWords(row: { patient: { full_name: string; patient_number: string } | null }) {
  return row.patient ? `${row.patient.full_name} · ${row.patient.patient_number}` : 'Patient'
}

function drugWords(prescription: Prescription) {
  return prescription.items.map((item) => item.drug).join(', ') || null
}

function testItems(
  requests: LabRequest[],
  action: (request: LabRequest) => { label: string; href: string },
  time: (request: LabRequest) => string,
): NoticeItem[] {
  return requests.map((request) => ({
    key: `lab-${request.id}`,
    title: patientWords(request),
    detail: request.tests.join(', '),
    time: when(time(request)),
    action: action(request),
  }))
}

// ===== 2. The last list, kept in memory for an instant open =====
export function cachedNotices(staffId: string): Notice[] | null {
  return recall<Notice[]>(staffId, 'notices')
}

// ===== 3. Load everything waiting, all at once =====
export async function loadNotices(client: SupabaseClient, staff: StaffMember): Promise<Notice[]> {
  // The same people the Lab and Pharmacy cards show payments to.
  const payer = staff.role === 'front_desk' || staff.role === 'admin'
  const empty = Promise.resolve([])
  const [
    messages,
    rooms,
    announcements,
    readAnnouncements,
    ready,
    testsToPay,
    drugsToPay,
    testsToDo,
    toDispense,
  ] = await Promise.all([
    staff.room_id ? loadMessages(client) : empty,
    staff.room_id ? loadRooms(client) : empty,
    activeAnnouncements(client),
    myAnnouncementReads(client, staff.id),
    listMyReadyResults(client, staff.id),
    payer ? listAwaitingPayment(client) : empty,
    payer ? drugsAwaitingPayment(client) : empty,
    staff.role === 'laboratory' ? listAwaitingTest(client) : empty,
    staff.role === 'pharmacy' ? listAwaitingDispense(client) : empty,
  ])
  const notices: Notice[] = []

  // ----- a. Messages to my room, not read yet, per room -----
  const incoming = messages.filter((message) => message.from_room_id !== staff.room_id)
  const reads = await loadReads(
    client,
    incoming.map((message) => message.id),
  )
  const unread = incoming.filter(
    (message) =>
      !reads.some((read) => read.message_id === message.id && read.staff_id === staff.id),
  )
  // A message that tags you says so first (request 142).
  const messageItem = (message: (typeof unread)[number], href: string): NoticeItem => ({
    key: `message-${message.id}`,
    title: `${message.mention_staff === staff.id ? 'For you · ' : ''}${message.sender?.full_name ?? 'Staff'}`,
    detail: message.body,
    time: when(message.created_at),
    action: { label: 'Reply', href },
  })
  for (const room of rooms) {
    const fromRoom = unread.filter(
      (message) => message.from_room_id === room.id && !message.to_everyone,
    )
    if (fromRoom.length) {
      notices.push({
        key: `messages-${room.id}`,
        count: fromRoom.length,
        words: `${many(fromRoom.length, 'new message', 'new messages')} from ${room.name}.`,
        items: fromRoom.map((message) => messageItem(message, `/messages/?c=room:${room.id}`)),
      })
    }
  }
  // General, for everybody, in one notice of its own.
  const general = unread.filter((message) => message.to_everyone)
  if (general.length) {
    notices.push({
      key: 'messages-general',
      count: general.length,
      words: `${many(general.length, 'new message', 'new messages')} in General.`,
      items: general.map((message) => messageItem(message, '/messages/?c=general')),
    })
  }

  // ----- b. Announcements not read yet -----
  const newAnnouncements = announcements.filter((one) => !readAnnouncements.includes(one.id))
  if (newAnnouncements.length) {
    notices.push({
      key: 'announcements',
      count: newAnnouncements.length,
      words: `${many(newAnnouncements.length, 'new announcement', 'new announcements')}.`,
      items: newAnnouncements.map((one) => ({
        key: `announcement-${one.id}`,
        title: one.sender?.full_name ?? 'Announcement',
        detail: one.body,
        time: when(one.created_at),
        action: { label: 'Got it', announcement: one.id },
      })),
    })
  }

  // ----- c. Lab results ready for tests I asked for -----
  if (ready.length) {
    notices.push({
      key: 'results',
      card: 'lab',
      count: ready.length,
      words: `${many(ready.length, 'lab result is', 'lab results are')} ready for tests you asked for.`,
      items: testItems(
        ready,
        (request) => ({
          label: 'See results',
          href: `/patients/record/?p=${request.patient_id}#lab`,
        }),
        (request) => request.completed_at ?? request.requested_at,
      ),
    })
  }

  // ----- d. Work waiting for my role -----
  if (testsToPay.length) {
    notices.push({
      key: 'pay-tests',
      card: 'lab',
      count: testsToPay.length,
      words: `${many(testsToPay.length, 'lab request is', 'lab requests are')} waiting for payment.`,
      items: testItems(
        testsToPay,
        () => ({ label: 'Take payment', href: '/#lab' }),
        (request) => request.requested_at,
      ),
    })
  }
  if (drugsToPay.length) {
    notices.push({
      key: 'pay-drugs',
      card: 'pharmacy',
      count: drugsToPay.length,
      words: `${many(drugsToPay.length, 'prescription is', 'prescriptions are')} waiting for payment.`,
      items: drugsToPay.map((prescription) => ({
        key: `rx-${prescription.id}`,
        title: patientWords(prescription),
        detail: drugWords(prescription),
        time: when(prescription.prescribed_at),
        action: { label: 'Take payment', href: '/#pharmacy' },
      })),
    })
  }
  if (testsToDo.length) {
    notices.push({
      key: 'do-tests',
      card: 'lab',
      count: testsToDo.length,
      words: `${many(testsToDo.length, 'lab request is', 'lab requests are')} waiting to be tested.`,
      items: testItems(
        testsToDo,
        (request) => ({ label: 'Enter results', href: `/lab/result/?r=${request.id}` }),
        (request) => request.requested_at,
      ),
    })
  }
  if (toDispense.length) {
    notices.push({
      key: 'dispense',
      card: 'pharmacy',
      count: toDispense.length,
      words: `${many(toDispense.length, 'prescription is', 'prescriptions are')} waiting to be dispensed.`,
      items: toDispense.map((prescription) => ({
        key: `rx-${prescription.id}`,
        title: patientWords(prescription),
        detail: drugWords(prescription),
        time: when(prescription.prescribed_at),
        action: { label: 'Dispense', href: '/#pharmacy' },
      })),
    })
  }

  return remember(staff.id, 'notices', notices)
}

export const totalOf = (notices: Notice[]) => notices.reduce((sum, notice) => sum + notice.count, 0)
