/*
 * lib/attention/attention.ts: Call attention, the data side.
 *
 * Why: Anthony, 2026-10-29. A call goes to a ROOM, never to a person.
 * Front Desk, Nursing Station, Laboratory and Pharmacy are groups: one tap
 * rings everyone on duty there. Consultant and Matron open a list of their
 * rooms, and the call goes to the room picked. The database decides whose
 * screen rings (migration 20261029180000_attention_calls.sql).
 *
 * Sections:
 *   1. Shapes and words
 *   2. The list: who can be called, and the search
 *   3. Making a call
 *   4. Hearing calls: live, with a slow check behind it
 *
 * Never: put a patient's name or anything clinical in a call. A call says
 * "come", nothing else. The double tap guard is in the database, so the
 * app never has to be trusted with it.
 */
import type { RealtimeChannel, SupabaseClient } from '@supabase/supabase-js'

// ===== 1. Shapes and words =====
export type RoomKind =
  'front_desk' | 'nursing' | 'laboratory' | 'pharmacy' | 'consultation' | 'matron' | 'office'

// One line in the list. roomId null means the whole group.
export type Target = { kind: RoomKind; roomId: number | null; label: string; detail: string | null }

export type AttentionCall = {
  id: number
  created_at: string
  called_by: string
  to_kind: RoomKind
  // 'call_patient': raised by Call in, for the Front Desk (request 129).
  kind: 'attention' | 'call_patient'
  patient: { full_name: string } | null
  caller: { full_name: string } | null
  from_room: { name: string } | null
  to_room: { name: string } | null
}

export type CallResult = 'sent' | 'already_sent' | 'failed'

// Groups ring every room of that kind with one tap. Lists open their rooms.
export const GROUPS: RoomKind[] = ['front_desk', 'nursing', 'laboratory', 'pharmacy']
export const LISTS: RoomKind[] = ['consultation', 'matron']

export const KIND_LABELS: Record<RoomKind, string> = {
  front_desk: 'Front Desk',
  nursing: 'Nursing Station',
  laboratory: 'Laboratory',
  pharmacy: 'Pharmacy',
  consultation: 'Consultant',
  matron: 'Matron',
  // The admin's room (2026-11-09). Not in the Call attention list: who can
  // be called is his design, unchanged.
  office: 'Admin Office',
}

// ===== 2. The list =====
type Room = { id: number; name: string; kind: RoomKind }
type Person = { full_name: string; room_id: number }

export type Directory = {
  groups: Target[]
  lists: { kind: RoomKind; label: string; rooms: Target[] }[]
  everything: Target[]
}

export async function loadDirectory(
  client: SupabaseClient,
  myRoomId: number | null,
): Promise<Directory> {
  const [rooms, people] = await Promise.all([
    client.from('rooms').select('id, name, kind').eq('is_active', true).order('name'),
    client
      .from('staff')
      .select('full_name, room_id')
      .eq('is_active', true)
      .not('room_id', 'is', null),
  ])
  const allRooms = (rooms.data as Room[] | null) ?? []
  const everyone = (people.data as Person[] | null) ?? []
  const myKind = allRooms.find((room) => room.id === myRoomId)?.kind ?? null

  // Who sits in each room, so a matron's office shows the matron's name.
  const namesIn = (roomId: number) =>
    everyone
      .filter((person) => person.room_id === roomId)
      .map((person) => person.full_name)
      .join(', ') || null

  // A group shows if the hospital has that kind of room, and it is not your own group.
  const groups: Target[] = GROUPS.filter(
    (kind) => kind !== myKind && allRooms.some((room) => room.kind === kind),
  ).map((kind) => ({ kind, roomId: null, label: KIND_LABELS[kind], detail: null }))

  const lists = LISTS.map((kind) => ({
    kind,
    label: KIND_LABELS[kind],
    rooms: allRooms
      .filter((room) => room.kind === kind && room.id !== myRoomId)
      .map((room) => ({ kind, roomId: room.id, label: room.name, detail: namesIn(room.id) })),
  })).filter((list) => list.rooms.length > 0)

  // For the search: every group, and every single room you could call
  // (including one nursing station or the front desk by its own name).
  const singles: Target[] = allRooms
    .filter((room) => room.id !== myRoomId && room.kind !== myKind)
    .filter((room) => !LISTS.includes(room.kind))
    // "Front Desk" the room and "Front Desk" the group would show twice.
    .filter((room) => !groups.some((group) => group.label === room.name))
    .map((room) => ({
      kind: room.kind,
      roomId: room.id,
      label: room.name,
      detail: namesIn(room.id),
    }))
  const everything = [...groups, ...lists.flatMap((list) => list.rooms), ...singles]

  return { groups, lists, everything }
}

// Matches the room name, the group name, or the name of somebody in the room.
export function searchTargets(directory: Directory, words: string): Target[] {
  const query = words.trim().toLowerCase()
  if (!query) return []
  const seen = new Set<string>()
  return directory.everything.filter((target) => {
    const key = `${target.kind}:${target.roomId ?? 'all'}`
    const text = `${target.label} ${target.detail ?? ''} ${KIND_LABELS[target.kind]}`.toLowerCase()
    if (seen.has(key) || !text.includes(query)) return false
    seen.add(key)
    return true
  })
}

// ===== 3. Making a call =====
export async function callAttention(client: SupabaseClient, target: Target): Promise<CallResult> {
  const { data, error } = await client.rpc('call_attention', {
    called_kind: target.kind,
    called_room: target.roomId,
  })
  if (error) {
    console.warn(`Call attention to ${target.kind} failed: ${error.code}`)
    return 'failed'
  }
  return data === 'already_sent' ? 'already_sent' : 'sent'
}

// ===== 4. Hearing calls =====
const CALL_COLUMNS =
  'id, created_at, called_by, to_kind, kind, patient:patients(full_name), caller:staff!called_by(full_name), from_room:rooms!from_room_id(name), to_room:rooms!to_room_id(name)'

// Calls made to me in the last few minutes. The database only returns the
// calls I am allowed to read; my own calls are left out here.
export async function loadRecentCalls(
  client: SupabaseClient,
  myId: string,
  minutes: number,
): Promise<AttentionCall[]> {
  const since = new Date(Date.now() - minutes * 60_000).toISOString()
  const { data, error } = await client
    .from('attention_calls')
    .select(CALL_COLUMNS)
    .neq('called_by', myId)
    .gte('created_at', since)
    .order('created_at', { ascending: true })
  if (error) console.warn(`Recent calls could not be read: ${error.code}`)
  return (data as AttentionCall[] | null) ?? []
}

async function loadCall(client: SupabaseClient, id: number): Promise<AttentionCall | null> {
  const { data } = await client
    .from('attention_calls')
    .select(CALL_COLUMNS)
    .eq('id', id)
    .maybeSingle()
  return (data as AttentionCall | null) ?? null
}

// Live: Supabase sends each new call I may read the moment it is saved.
// Returns a function that stops listening.
export function listenForCalls(
  client: SupabaseClient,
  myId: string,
  onCall: (call: AttentionCall) => void,
): () => void {
  const channel: RealtimeChannel = client
    .channel(`attention-${myId}`)
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'attention_calls' },
      async (payload) => {
        const row = payload.new as { id: number; called_by: string }
        if (row.called_by === myId) return
        const call = await loadCall(client, row.id)
        if (call) onCall(call)
      },
    )
    .subscribe()
  return () => {
    client.removeChannel(channel)
  }
}
