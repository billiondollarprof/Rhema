/*
 * components/shell/LoadingGate.tsx: shows the starting screen (AppLoading)
 * over every page while the app works out who is signed in.
 *
 * Why: request 157 (2026-11-08), the installed app's start. Until sign in
 * is known every page is empty, so this fills that moment with the logo.
 *
 * Never: stay up once the sign in state is known.
 */
'use client'

import AppLoading from './AppLoading'
import { useAuth } from '@/lib/auth/session'

export default function LoadingGate() {
  const auth = useAuth()
  return auth.status === 'loading' ? <AppLoading /> : null
}
