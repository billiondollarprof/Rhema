/*
 * lib/auth/routes.ts: which page belongs to which sign in state.
 *
 * Why: the sign in page, the lock page and the home page each check this
 * one table, so a person is always sent to the same place for the same
 * state, whichever page they opened.
 *
 * Never: treat this as security. It only moves people between screens. The
 * database refuses data to anybody not signed in, whatever page is shown.
 */
'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import type { AuthStatus } from './session'

// The two pages that are not part of the signed in app.
const SIGN_IN = '/sign-in/'
const LOCK = '/lock/'

// Where a person in this state belongs, when on `thisPage`. Null means
// "stay here". A signed in, unlocked person may be on any app page; only
// the sign in and lock pages send them on to Home.
export function pathFor(status: AuthStatus, thisPage: string): string | null {
  if (status === 'loading') return null
  if (status === 'locked') return thisPage === LOCK ? null : LOCK
  if (status === 'ready') return thisPage === SIGN_IN || thisPage === LOCK ? '/' : null
  // signed-out, needs-pin and not-configured all live on the sign in page.
  return thisPage === SIGN_IN ? null : SIGN_IN
}

// Send the person to the right page if they are on the wrong one.
export function useRightPage(status: AuthStatus, thisPage: string) {
  const router = useRouter()
  useEffect(() => {
    const target = pathFor(status, thisPage)
    if (target) router.replace(target)
  }, [status, thisPage, router])
}
