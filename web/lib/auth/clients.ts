/*
 * lib/auth/clients.ts: one Supabase connection per remembered person.
 *
 * Why: several people can be signed in on one shared computer. Each keeps
 * their own session in its own storage slot ("rhema-auth-<their id>"), so
 * switching person never mixes one person's access with another's.
 *
 * Sign in starts on a "pending" connection that keeps the new session in
 * memory only. Once Supabase says who it is, the session moves into that
 * person's own slot, and the pending connection is dropped. The pending one
 * never refreshes the session itself: two connections refreshing the same
 * session would cancel each other out.
 *
 * Never: create a connection with the secret key. Only the publishable key
 * from lib/auth/config.ts is used in the browser.
 */
import { createClient, type Session, type SupabaseClient } from '@supabase/supabase-js'
import { SUPABASE_KEY, SUPABASE_URL } from './config'
import { noteSave } from '../live/changes'

// ===== 1. Each person's own connection, made once and reused =====
const clients = new Map<string, SupabaseClient>()

export function storageKeyFor(id: string) {
  return `rhema-auth-${id}`
}

export function clientFor(id: string): SupabaseClient {
  const existing = clients.get(id)
  if (existing) return existing

  // Every save this person makes is noticed (savedSomething), so every
  // other open app updates at once (request 157). The connection itself
  // only fetches; whether a request was a save is decided in lib/live.
  let made: SupabaseClient | null = null
  const watchedFetch: typeof fetch = async (input, init) => {
    const answer = await fetch(input, init)
    if (made && answer.ok)
      noteSave(made, String(input instanceof Request ? input.url : input), init?.method ?? 'GET')
    return answer
  }
  const client = createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: {
      storageKey: storageKeyFor(id),
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false,
    },
    global: { fetch: watchedFetch },
  })
  made = client
  clients.set(id, client)
  return client
}

// Stop and forget one person's connection (after they sign out here).
export function dropClient(id: string) {
  const client = clients.get(id)
  if (client) client.auth.stopAutoRefresh()
  clients.delete(id)
  try {
    localStorage.removeItem(storageKeyFor(id))
  } catch {
    // Storage blocked: nothing was saved anyway.
  }
}

// ===== 2. The pending connection used while signing in =====
let pending: SupabaseClient | null = null

export function pendingClient(): SupabaseClient {
  if (!pending) {
    pending = createClient(SUPABASE_URL, SUPABASE_KEY, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        // Picks up the session when somebody arrives from the link in the
        // email (used until the hospital's own email sender is connected).
        detectSessionInUrl: true,
        flowType: 'implicit',
      },
    })
  }
  return pending
}

// ===== 3. Move a fresh session into its owner's own slot =====
export async function adoptSession(session: Session): Promise<SupabaseClient> {
  const client = clientFor(session.user.id)
  const { error } = await client.auth.setSession({
    access_token: session.access_token,
    refresh_token: session.refresh_token,
  })
  if (error) throw error
  pending = null
  return client
}
