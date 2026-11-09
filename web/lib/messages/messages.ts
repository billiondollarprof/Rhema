/*
 * lib/messages/messages.ts: room to room messages, their ticks, and
 * announcements (request 123: messages, announcements).
 *
 * Why: Anthony, 2026-11-02: "send from a room to a room... just the way you
 * also call attention"; groups too; plain text. Ticks like WhatsApp: a
 * clock while it waits for the network, one tick sent, two ticks read; for
 * a group, two ticks when everyone has read. Kept 1 year.
 *
 * Who may read or send is decided by the database
 * (supabase/migrations/20261102202827_messages.sql).
 *
 * Never: log what a message says. Counts only.
 */
import { announceChange } from '@/lib/live/changes'
import type { SupabaseClient } from '@supabase/supabase-js'
import { addToOutbox, isNetworkFailure } from '../offline/outbox'

// ===== 1. Shapes =====
export type RoomKind =
  'front_desk' | 'nursing' | 'laboratory' | 'pharmacy' | 'consultation' | 'matron' | 'office'

export const GROUP_WORDS: Record<RoomKind, string> = {
  front_desk: 'All Front Desks',
  nursing: 'All Nursing Stations',
  laboratory: 'All Laboratories',
  pharmacy: 'All Pharmacies',
  consultation: 'All Consultant Rooms',
  matron: "All Matron's Offices",
  // The admin's room (2026-11-09, option A).
  office: 'All Admin Offices',
}

export type Room = { id: number; name: string; kind: RoomKind }

export type Message = {
  id: number
  sent_by: string
  from_room_id: number
  // Null for General, which has no room kind (request 142).
  to_kind: RoomKind | null
  to_room_id: number | null
  to_everyone: boolean
  // A reply points at the message it answers; a tag names one person.
  reply_to: number | null
  mention_staff: string | null
  edited_at: string | null
  body: string
  client_key: string
  created_at: string
  sender: { full_name: string } | null
  mention: { full_name: string } | null
}

export type Read = { message_id: number; staff_id: string }

// A conversation: one room, a group of rooms of one kind, or General.
export type Target = { kind: RoomKind | null; room: number | null; everyone?: boolean }

// A message can be changed for 15 minutes after sending (request 144).
export const EDIT_MINUTES = 15
export const canStillEdit = (message: Message, staffId: string) =>
  message.sent_by === staffId &&
  Date.now() - new Date(message.created_at).getTime() < EDIT_MINUTES * 60 * 1000

const COLUMNS =
  'id, sent_by, from_room_id, to_kind, to_room_id, to_everyone, reply_to, mention_staff, ' +
  'edited_at, body, client_key, created_at, ' +
  'sender:staff!messages_sent_by_fkey(full_name), mention:staff!messages_mention_staff_fkey(full_name)'

// ===== 2. Read =====
export async function loadRooms(client: SupabaseClient): Promise<Room[]> {
  const { data } = await client
    .from('rooms')
    .select('id, name, kind')
    .eq('is_active', true)
    .order('name')
  return (data as Room[] | null) ?? []
}

// Staff in rooms, for "read by everyone" in a group.
// With their names, for tagging somebody in a message.
export type RoomPerson = { id: string; room_id: number; full_name: string }

export async function loadRoomStaff(client: SupabaseClient): Promise<RoomPerson[]> {
  const { data } = await client
    .from('staff')
    .select('id, room_id, full_name')
    .eq('is_active', true)
    .not('room_id', 'is', null)
  return (data as RoomPerson[] | null) ?? []
}

// The last 30 days of messages this person may read (the database decides).
export async function loadMessages(client: SupabaseClient): Promise<Message[]> {
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
  const { data } = await client
    .from('messages')
    .select(COLUMNS)
    .gte('created_at', since)
    .order('created_at')
    .limit(1000)
  return (data as unknown as Message[] | null) ?? []
}

export async function loadReads(client: SupabaseClient, ids: number[]): Promise<Read[]> {
  if (ids.length === 0) return []
  const { data } = await client
    .from('message_reads')
    .select('message_id, staff_id')
    .in('message_id', ids.slice(-500))
  return (data as Read[] | null) ?? []
}

// ===== 3. Send =====
// Answers null when sent, 'waiting' when kept on the device for the
// network, or the words to show.
export async function sendMessage(
  client: SupabaseClient,
  staffId: string,
  target: Target,
  body: string,
  extra: { replyTo: number | null; mention: string | null } = { replyTo: null, mention: null },
): Promise<null | 'waiting' | string> {
  const clientKey = crypto.randomUUID()
  const everyone = Boolean(target.everyone)
  const { error } = await client.rpc('send_message_to', {
    to_kind: everyone ? null : target.kind,
    to_room: everyone ? null : target.room,
    to_everyone: everyone,
    body: body.trim(),
    client_key: clientKey,
    reply_to: extra.replyTo,
    mention: extra.mention,
  })
  if (isNetworkFailure(error)) {
    addToOutbox(staffId, {
      kind: 'message',
      label: 'Message',
      toKind: everyone ? null : target.kind,
      toRoom: everyone ? null : target.room,
      toEveryone: everyone,
      replyTo: extra.replyTo,
      mention: extra.mention,
      body: body.trim(),
      clientKey,
    })
    return 'waiting'
  }
  if (error) return 'The message could not be sent. Try again.'
  // Every open app fetches it at once (request 157).
  announceChange(client, 'messages')
  return null
}

// Change your own message, for 15 minutes (request 144). Answers null when
// saved, or the words to show.
export async function editMessage(
  client: SupabaseClient,
  id: number,
  body: string,
): Promise<string | null> {
  const { error } = await client.rpc('edit_message', { message: id, body: body.trim() })
  if (isNetworkFailure(error)) return 'No network. Check the connection and save it again.'
  if (error) return 'A message can be changed for 15 minutes after sending.'
  announceChange(client, 'messages')
  return null
}

export async function markRead(client: SupabaseClient, ids: number[]) {
  if (!ids.length) return
  await client.rpc('mark_messages_read', { ids })
  // The sender's ticks turn to two at once (request 157).
  announceChange(client, 'messages')
}

// ===== 4. Announcements =====
export type Announcement = {
  id: number
  body: string
  show_until: string
  created_at: string
  sender: { full_name: string } | null
}

export async function activeAnnouncements(client: SupabaseClient): Promise<Announcement[]> {
  const today = new Date().toISOString().slice(0, 10)
  const { data } = await client
    .from('announcements')
    .select('id, body, show_until, created_at, sender:staff!announcements_sent_by_fkey(full_name)')
    .gte('show_until', today)
    .order('created_at', { ascending: false })
    .limit(20)
  return (data as unknown as Announcement[] | null) ?? []
}

export async function myAnnouncementReads(
  client: SupabaseClient,
  staffId: string,
): Promise<number[]> {
  const { data } = await client
    .from('announcement_reads')
    .select('announcement_id')
    .eq('staff_id', staffId)
  return ((data as { announcement_id: number }[] | null) ?? []).map((row) => row.announcement_id)
}

export async function sendAnnouncement(
  client: SupabaseClient,
  body: string,
  showUntil: string | null,
): Promise<string | null> {
  const { error } = await client.rpc('send_announcement', {
    body: body.trim(),
    show_until: showUntil,
    client_key: crypto.randomUUID(),
  })
  if (isNetworkFailure(error)) return 'No network. Check the connection and send it again.'
  if (error) return 'The announcement could not be sent. Try again.'
  return null
}

export async function markAnnouncementRead(client: SupabaseClient, id: number) {
  await client.rpc('mark_announcement_read', { announcement: id })
}
