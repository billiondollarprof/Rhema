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
 * Each line says what it is in a whole sentence and opens the place where
 * it is dealt with. The bubble is the sum of the numbers.
 *
 * Never: show a patient's name here. Counts and rooms only.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import type { StaffMember } from '../auth/session'
import { listAwaitingPayment, listAwaitingTest, listMyReadyResults } from '../lab/lab'
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
} from '../pharmacy/pharmacy'

export type Notice = { key: string; count: number; words: string; href: string }

const many = (count: number, one: string, more: string) => `${count} ${count === 1 ? one : more}`

export async function loadNotices(client: SupabaseClient, staff: StaffMember): Promise<Notice[]> {
  const notices: Notice[] = []

  // ===== 1. Messages to my room, not read yet, per room =====
  if (staff.room_id) {
    const [messages, rooms] = await Promise.all([loadMessages(client), loadRooms(client)])
    const incoming = messages.filter((message) => message.from_room_id !== staff.room_id)
    const reads = await loadReads(
      client,
      incoming.map((message) => message.id),
    )
    const unread = incoming.filter(
      (message) =>
        !reads.some((read) => read.message_id === message.id && read.staff_id === staff.id),
    )
    for (const room of rooms) {
      const count = unread.filter((message) => message.from_room_id === room.id).length
      if (count) {
        notices.push({
          key: `messages-${room.id}`,
          count,
          words: `${many(count, 'new message', 'new messages')} from ${room.name}.`,
          href: `/messages/?c=room:${room.id}`,
        })
      }
    }
  }

  // ===== 2. Announcements not read yet =====
  const [announcements, read] = await Promise.all([
    activeAnnouncements(client),
    myAnnouncementReads(client, staff.id),
  ])
  const newAnnouncements = announcements.filter((one) => !read.includes(one.id)).length
  if (newAnnouncements) {
    notices.push({
      key: 'announcements',
      count: newAnnouncements,
      words: `${many(newAnnouncements, 'new announcement', 'new announcements')} on Home.`,
      href: '/',
    })
  }

  // ===== 3. Lab results ready for tests I asked for =====
  const ready = (await listMyReadyResults(client, staff.id)).length
  if (ready) {
    notices.push({
      key: 'results',
      count: ready,
      words: `${many(ready, 'lab result is', 'lab results are')} ready for tests you asked for.`,
      href: '/',
    })
  }

  // ===== 4. Work waiting for my role =====
  if (staff.role === 'front_desk' || staff.can_admin) {
    const [tests, drugs] = await Promise.all([
      listAwaitingPayment(client),
      drugsAwaitingPayment(client),
    ])
    if (tests.length) {
      notices.push({
        key: 'pay-tests',
        count: tests.length,
        words: `${many(tests.length, 'lab request is', 'lab requests are')} waiting for payment.`,
        href: '/',
      })
    }
    if (drugs.length) {
      notices.push({
        key: 'pay-drugs',
        count: drugs.length,
        words: `${many(drugs.length, 'prescription is', 'prescriptions are')} waiting for payment.`,
        href: '/#pharmacy',
      })
    }
  }
  if (staff.role === 'laboratory') {
    const tests = (await listAwaitingTest(client)).length
    if (tests) {
      notices.push({
        key: 'do-tests',
        count: tests,
        words: `${many(tests, 'lab request is', 'lab requests are')} waiting to be tested.`,
        href: '/',
      })
    }
  }
  if (staff.role === 'pharmacy') {
    const waiting = (await listAwaitingDispense(client)).length
    if (waiting) {
      notices.push({
        key: 'dispense',
        count: waiting,
        words: `${many(waiting, 'prescription is', 'prescriptions are')} waiting to be dispensed.`,
        href: '/#pharmacy',
      })
    }
  }
  return notices
}

export const totalOf = (notices: Notice[]) => notices.reduce((sum, notice) => sum + notice.count, 0)
