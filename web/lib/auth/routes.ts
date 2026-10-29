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

export function pathFor(status: AuthStatus): string | null {
  if (status === 'loading') return null
  if (status === 'locked') return '/lock/'
  if (status === 'ready') return '/'
  // signed-out, needs-pin and not-configured all live on the sign in page.
  return '/sign-in/'
}

// Send the person to the right page if they are on the wrong one.
export function useRightPage(status: AuthStatus, thisPage: string) {
  const router = useRouter()
  useEffect(() => {
    const target = pathFor(status)
    if (target && target !== thisPage) router.replace(target)
  }, [status, thisPage, router])
}
