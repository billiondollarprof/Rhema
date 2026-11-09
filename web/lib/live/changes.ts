/*
 * lib/live/changes.ts: tells every open app, at once, that something new
 * was saved, so it fetches it without anybody refreshing.
 *
 * Why: Anthony, 2026-11-08: "If someone sends you a message, you should
 * see it without refreshing your app... The messages takes... almost a
 * minute to appear in the other device, make it instant." Screens used to
 * look again every 15 to 30 seconds. Now the device that saves something
 * sends a short signal on one live channel, and every open app that cares
 * fetches straight away, through the database, with its own rights.
 *
 * The signal says only WHAT kind of thing changed ("messages"). It never
 * carries a message, a name or a patient: whoever hears it still has to
 * ask the database, which answers only what that person may read. The
 * screens keep looking now and then as well, so a missed signal costs a
 * few seconds, never a message.
 *
 * Never: put content, names or ids in the signal.
 */
import type { RealtimeChannel, SupabaseClient } from '@supabase/supabase-js'

// ===== 1. The kinds of change =====
export type ChangeKind = 'messages'

const CHANNEL = 'rhema-changes'
const EVENT = 'changed'

// ===== 2. One channel per signed in person, shared by every screen =====
type Listener = (kind: ChangeKind) => void
const channels = new Map<SupabaseClient, { channel: RealtimeChannel; listeners: Set<Listener> }>()

function channelFor(client: SupabaseClient) {
  let found = channels.get(client)
  if (!found) {
    const listeners = new Set<Listener>()
    const channel = client
      .channel(CHANNEL, { config: { broadcast: { self: false } } })
      .on('broadcast', { event: EVENT }, ({ payload }) => {
        const kind = (payload as { kind?: unknown })?.kind
        if (kind === 'messages') listeners.forEach((listener) => listener(kind))
      })
      .subscribe()
    found = { channel, listeners }
    channels.set(client, found)
  }
  return found
}

// ===== 3. Say that something changed =====
// Never throws: a missed signal only means the others see it a little later.
export function announceChange(client: SupabaseClient, kind: ChangeKind): void {
  try {
    void channelFor(client).channel.send({ type: 'broadcast', event: EVENT, payload: { kind } })
  } catch {
    // Nothing to do: the screens also look again by themselves.
  }
}

// ===== 4. Listen for a kind of change =====
// Returns the function that stops listening.
export function onChange(client: SupabaseClient, kind: ChangeKind, run: () => void): () => void {
  const { listeners } = channelFor(client)
  const listener: Listener = (changed) => {
    if (changed === kind) run()
  }
  listeners.add(listener)
  return () => listeners.delete(listener)
}
