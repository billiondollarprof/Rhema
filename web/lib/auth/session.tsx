/*
 * lib/auth/session.tsx: who is using this device, and whether the screen is
 * locked. Every screen reads it; only this file changes it.
 *
 * Why: sign in has several steps (email code, first PIN, lock, switching
 * person at a shared desk). Keeping all of it in one place means the sign
 * in page, the lock page and the home page never disagree about the state.
 *
 * The states, in the order a person meets them:
 *   loading         working out who is here (a split second)
 *   not-configured  this build has no Supabase address (CI builds)
 *   signed-out      nobody is using the device: show the sign in page
 *   needs-pin       signed in with an email code, has no PIN yet
 *   locked          signed in, but the PIN must be typed to carry on
 *   ready           signed in and unlocked
 *
 * Rules from Anthony (2026-10-28 and 29): lock after 1 hour without use (10 minutes until 2026-10-31);
 * signed out of the device after 24 hours without use; 5 wrong PINs means
 * sign in again with an email code. The PIN is checked by the database.
 *
 * Never: keep patient data here, and never decide what a person may see
 * from this state. It only decides which screen to show. What a person may
 * read is decided by RLS in the database, whatever this file says.
 *
 * Since Admin (request 112, 2026-10-30): a code can be asked for by any
 * email, and the database refuses one with no waiting invitation. The
 * first sign in uses the invitation. The app also tells the database when
 * a person is using it, for the admin's activity log.
 */
'use client'

import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import type { Session, SupabaseClient } from '@supabase/supabase-js'
import { EXPIRE_AFTER_MS, LOCK_AFTER_MS, isConfigured } from './config'
import { wipeOutbox } from '@/lib/offline/outbox'
import { wipeCopy } from '@/lib/offline/patientCopy'
import { adoptSession, clientFor, dropClient, pendingClient } from './clients'
import { forgetThisDevice } from '@/lib/attention/push'
import {
  type DeviceAccount,
  getAccount,
  getActiveId,
  listAccounts,
  removeAccount,
  saveAccount,
  setActiveId,
  updateAccount,
} from './device-accounts'

// ===== 1. Shapes =====
export type AuthStatus =
  'loading' | 'not-configured' | 'signed-out' | 'needs-pin' | 'locked' | 'ready'

export type StaffMember = {
  id: string
  full_name: string
  role: string
  can_admin: boolean
  // Medical record access (doctors, nurses, the matron, the admin).
  can_medical: boolean
  // The Laboratory tick: may enter lab results (request 115).
  can_lab: boolean
  // The Pharmacy tick: may dispense (request 123).
  can_pharmacy: boolean
  room_id: number | null
  // The room the admin gave them, e.g. "Consultant Room 1". Null if none.
  room: { name: string; kind: string } | null
}

export type UnlockResult = 'ok' | 'wrong' | 'locked-out'

type AuthState = {
  status: AuthStatus
  account: DeviceAccount | null
  staff: StaffMember | null
  // A short line for the sign in page, e.g. why somebody was signed out.
  notice: string | null
  client: SupabaseClient | null
  requestCode: (email: string) => Promise<string | null>
  verifyCode: (email: string, code: string) => Promise<string | null>
  setPin: (pin: string) => Promise<string | null>
  unlock: (pin: string) => Promise<UnlockResult>
  lock: () => void
  switchTo: (id: string) => Promise<void>
  useAnotherAccount: () => void
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthState | null>(null)

export function useAuth(): AuthState {
  const value = useContext(AuthContext)
  if (!value) throw new Error('useAuth must be used inside <AuthProvider>')
  return value
}

// ===== 2. Small database questions =====
async function loadStaff(client: SupabaseClient, id: string): Promise<StaffMember | null> {
  const { data } = await client
    .from('staff')
    .select(
      'id, full_name, role, can_admin, can_medical, can_lab, can_pharmacy, room_id, room:rooms(name, kind)',
    )
    .eq('id', id)
    .maybeSingle()
  return (data as StaffMember | null) ?? null
}

async function hasPin(client: SupabaseClient): Promise<boolean> {
  const { data } = await client.rpc('i_have_a_pin')
  return data === true
}

// Turn Supabase's sign in errors into words a person can act on.
function codeErrorMessage(code: string | undefined, fallback: string): string {
  if (code === 'over_email_send_rate_limit' || code === 'over_request_rate_limit') {
    return 'Too many codes were asked for. Wait a minute, then try again.'
  }
  if (code === 'email_address_not_authorized') {
    return 'This email cannot get codes yet. Until the hospital email is connected, only the main hospital address can sign in.'
  }
  // unexpected_failure (or a bare 500): the database refused an email with
  // no waiting invitation.
  if (
    code === 'otp_disabled' ||
    code === 'signup_disabled' ||
    code === 'user_not_found' ||
    code === 'unexpected_failure'
  ) {
    return 'We could not send a code to that email. Check it is the email your administrator invited.'
  }
  if (code === 'otp_expired') {
    return 'That code is wrong or has run out. Ask for a new code.'
  }
  return fallback
}

// ===== 3. The provider every screen sits inside =====
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>('loading')
  const [account, setAccount] = useState<DeviceAccount | null>(null)
  const [staff, setStaff] = useState<StaffMember | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [client, setClient] = useState<SupabaseClient | null>(null)

  // ----- 3a. Sign one person out of this device only -----
  const signOutHere = useCallback(async (id: string, why: string | null) => {
    // This person stops getting Call attention alerts on this device. A
    // slow network never holds up signing out: after 3 seconds it carries on.
    await Promise.race([
      forgetThisDevice(clientFor(id)),
      new Promise((done) => setTimeout(done, 3000)),
    ])
    try {
      await clientFor(id).auth.signOut({ scope: 'local' })
    } catch {
      // Offline or already gone: still forget them on this device.
    }
    dropClient(id)
    // Nothing of this person's stays on the device: the waiting list and
    // the copy of recent patients go too (request 128, step 3).
    wipeOutbox(id)
    wipeCopy(id)
    removeAccount(id)
    setAccount(null)
    setStaff(null)
    setClient(null)
    setNotice(why)
    setStatus('signed-out')
  }, [])

  // ----- 3b. Make one remembered person the one using the device -----
  const activate = useCallback(
    async (id: string) => {
      const remembered = getAccount(id)
      const personClient = clientFor(id)
      const { data } = await personClient.auth.getSession()
      if (!remembered || !data.session) {
        await signOutHere(id, 'Please sign in again.')
        return
      }

      const member = await loadStaff(personClient, id)
      if (!member) {
        await signOutHere(id, 'This account is switched off. Ask your administrator.')
        return
      }

      setActiveId(id)
      setClient(personClient)
      setStaff(member)
      const idleTooLong = Date.now() - remembered.lastActive > LOCK_AFTER_MS
      const current = { ...remembered, name: member.full_name, role: member.role }
      saveAccount(current)
      setAccount(current)

      if (!(await hasPin(personClient))) setStatus('needs-pin')
      else if (remembered.locked || idleTooLong) setStatus('locked')
      else setStatus('ready')
    },
    [signOutHere],
  )

  // ----- 3c. A fresh session from a code or a link -----
  const finishSignIn = useCallback(
    async (session: Session): Promise<string | null> => {
      const personClient = await adoptSession(session)
      // A first sign in after an invitation turns it into a staff account
      // (Admin, request 112). Anybody else: nothing changes.
      await personClient.rpc('accept_my_invite')
      const member = await loadStaff(personClient, session.user.id)
      if (!member) {
        await signOutHere(session.user.id, null)
        return 'This email is not set up as hospital staff. Ask your administrator.'
      }
      saveAccount({
        id: member.id,
        name: member.full_name,
        email: session.user.email ?? '',
        role: member.role,
        lastActive: Date.now(),
        locked: false,
      })
      setNotice(null)
      await activate(member.id)
      return null
    },
    [activate, signOutHere],
  )

  // ----- 3d. On opening the app: tidy up, then pick up where we were -----
  useEffect(() => {
    async function start() {
      if (!isConfigured) {
        setStatus('not-configured')
        return
      }

      // Anybody unused for 24 hours is signed out of this device.
      for (const remembered of listAccounts()) {
        if (Date.now() - remembered.lastActive > EXPIRE_AFTER_MS) {
          await signOutHere(remembered.id, null)
        }
      }

      // Arriving from the sign in link in an email.
      if (window.location.hash.includes('access_token')) {
        const { data } = await pendingClient().auth.getSession()
        window.history.replaceState(null, '', window.location.pathname)
        if (data.session) {
          await finishSignIn(data.session)
          return
        }
      }

      const activeId = getActiveId()
      if (activeId && getAccount(activeId)) await activate(activeId)
      else setStatus('signed-out')
    }
    start()
  }, [activate, finishSignIn, signOutHere])

  // ----- 3e. Lock after 1 hour without use (LOCK_AFTER_MS) -----
  const lastTouch = useRef(0)
  useEffect(() => {
    if (status !== 'ready' || !account) return
    const id = account.id

    function touched() {
      // Write at most every 15 seconds, not on every tap.
      if (Date.now() - lastTouch.current < 15000) return
      lastTouch.current = Date.now()
      updateAccount(id, { lastActive: Date.now() })
    }
    touched()

    function checkIdle() {
      const remembered = getAccount(id)
      if (remembered && Date.now() - remembered.lastActive > LOCK_AFTER_MS) {
        updateAccount(id, { locked: true })
        setStatus('locked')
      }
    }

    window.addEventListener('pointerdown', touched)
    window.addEventListener('keydown', touched)
    const timer = window.setInterval(checkIdle, 15000)
    return () => {
      window.removeEventListener('pointerdown', touched)
      window.removeEventListener('keydown', touched)
      window.clearInterval(timer)
    }
  }, [status, account])

  // ----- 3f. Signed in and signed out times, for the activity log -----
  // While a person uses the app, it tells the database "seen" every 3
  // minutes. Locking, signing out or switching person ends the stretch.
  useEffect(() => {
    if (status !== 'ready' || !client) return
    // A Supabase request only goes out once .then() is called on it.
    const tell = (kind: string) => client.rpc('note_presence', { kind }).then(() => undefined)
    const seen = () => tell('seen')
    seen()
    const timer = window.setInterval(seen, 3 * 60 * 1000)
    return () => {
      window.clearInterval(timer)
      tell('end')
    }
  }, [status, client])

  // ===== 4. The actions screens can call =====
  const requestCode = useCallback(async (email: string) => {
    const { error } = await pendingClient().auth.signInWithOtp({
      email,
      options: {
        // On, because an invited person has no sign in account yet. The
        // database refuses any email without a waiting invitation.
        shouldCreateUser: true,
        emailRedirectTo: `${window.location.origin}/sign-in/`,
      },
    })
    if (!error) return null
    // The error code only, never the email, so the browser log holds no
    // personal details.
    console.warn(`Sign in code request refused: ${error.code ?? error.status}`)
    // The database refusing an email with no invitation comes back as a
    // bare 500 with no code.
    const code = error.code ?? (error.status === 500 ? 'unexpected_failure' : undefined)
    return codeErrorMessage(code, 'The code could not be sent. Try again.')
  }, [])

  const verifyCode = useCallback(
    async (email: string, code: string) => {
      const { data, error } = await pendingClient().auth.verifyOtp({
        email,
        token: code,
        type: 'email',
      })
      if (error || !data.session) {
        return codeErrorMessage(error?.code ?? 'otp_expired', 'That code did not work.')
      }
      return finishSignIn(data.session)
    },
    [finishSignIn],
  )

  const setPin = useCallback(
    async (pin: string) => {
      if (!client) return 'Please sign in again.'
      const { error } = await client.rpc('set_my_pin', { pin })
      if (error) return 'The PIN could not be saved. Try again.'
      if (account) updateAccount(account.id, { locked: false, lastActive: Date.now() })
      setStatus('ready')
      return null
    },
    [client, account],
  )

  const unlock = useCallback(
    async (pin: string): Promise<UnlockResult> => {
      if (!client || !account) return 'wrong'
      const { data, error } = await client.rpc('check_my_pin', { pin })
      if (error) return 'wrong'
      if (data === 'ok') {
        updateAccount(account.id, { locked: false, lastActive: Date.now() })
        setStatus('ready')
        return 'ok'
      }
      if (data === 'locked') {
        await signOutHere(
          account.id,
          'The PIN was wrong 5 times. Sign in with an email code and choose a new PIN.',
        )
        return 'locked-out'
      }
      if (data === 'no_pin') {
        setStatus('needs-pin')
        return 'ok'
      }
      return 'wrong'
    },
    [client, account, signOutHere],
  )

  const lock = useCallback(() => {
    if (!account) return
    updateAccount(account.id, { locked: true })
    setStatus('locked')
  }, [account])

  const switchTo = useCallback(
    async (id: string) => {
      if (account) updateAccount(account.id, { locked: true })
      // Whoever steps up must type their own PIN first.
      updateAccount(id, { locked: true })
      setStatus('loading')
      await activate(id)
    },
    [account, activate],
  )

  const useAnotherAccount = useCallback(() => {
    if (account) updateAccount(account.id, { locked: true })
    setActiveId(null)
    setAccount(null)
    setStaff(null)
    setClient(null)
    setNotice(null)
    setStatus('signed-out')
  }, [account])

  const signOut = useCallback(async () => {
    if (account) await signOutHere(account.id, null)
  }, [account, signOutHere])

  return (
    <AuthContext.Provider
      value={{
        status,
        account,
        staff,
        notice,
        client,
        requestCode,
        verifyCode,
        setPin,
        unlock,
        lock,
        switchTo,
        useAnotherAccount,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}
