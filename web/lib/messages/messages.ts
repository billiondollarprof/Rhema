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
import type { SupabaseClient } from '@supabase/supabase-js'
import { addToOutbox, isNetworkFailure } from '../offline/outbox'

// ===== 1. Shapes =====
export type RoomKind =
  'front_desk' | 'nursing' | 'laboratory' | 'pharmacy' | 'consultation' | 'matron'

export const GROUP_WORDS: Record<RoomKind, string> = {
  front_desk: 'All Front Desks',
  nursing: 'All Nursing Stations',
  laboratory: 'All Laboratories',
  pharmacy: 'All Pharmacies',
  consultation: 'All Consultant Rooms',
  matron: "All Matron's Offices",
}

export type Room = { id: number; name: string; kind: RoomKind }

export type Message = {
  id: number
  sent_by: string
  from_room_id: number
  to_kind: RoomKind
  to_room_id: number | null
  body: string
  client_key: string
  created_at: string
  sender: { full_name: string } | null
}

export type Read = { message_id: number; staff_id: string }

// A conversation: one room, or a group of rooms of one kind.
export type Target = { kind: RoomKind; room: number | null }

const COLUMNS =
  'id, sent_by, from_room_id, to_kind, to_room_id, body, client_key, created_at, ' +
  'sender:staff!messages_sent_by_fkey(full_name)'

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
export async function loadRoomStaff(
  client: SupabaseClient,
): Promise<{ id: string; room_id: number }[]> {
  const { data } = await client
    .from('staff')
    .select('id, room_id')
    .eq('is_active', true)
    .not('room_id', 'is', null)
  return (data as { id: string; room_id: number }[] | null) ?? []
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
): Promise<null | 'waiting' | string> {
  const clientKey = crypto.randomUUID()
  const { error } = await client.rpc('send_message', {
    to_kind: target.kind,
    to_room: target.room,
    body: body.trim(),
    client_key: clientKey,
  })
  if (isNetworkFailure(error)) {
    addToOutbox(staffId, {
      kind: 'message',
      label: 'Message',
      toKind: target.kind,
      toRoom: target.room,
      body: body.trim(),
      clientKey,
    })
    return 'waiting'
  }
  if (error) return 'The message could not be sent. Try again.'
  return null
}

export async function markRead(client: SupabaseClient, ids: number[]) {
  if (ids.length) await client.rpc('mark_messages_read', { ids })
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
