/*
 * components/shell/AppFreshness.tsx: keeps an open app working after a new
 * version goes live.
 *
 * Why: Anthony, 2026-11-08: "when the app is open for long, the buttons are
 * dead... the sidebar buttons on mobile... it's as if they are dead." The
 * cause: each deploy replaces the app's files. An app left open still holds
 * the old version, and when a button asks for an old screen file that is
 * gone, nothing happens. So:
 *   1. When the app comes back to the front (and every 10 minutes), it asks
 *      /version.json which version is live. If it is newer, the app reloads
 *      when it comes back to the front, but only if nothing is typed on the
 *      screen; otherwise, and while somebody is using it, it waits for the
 *      next tap of a menu link (a full page load, which always works), so
 *      nobody ever loses what they are typing.
 *   2. If a screen file still fails to load, the app reloads itself (at
 *      most once a minute, so a real outage cannot loop).
 *
 * Never: reload while somebody is typing.
 */
'use client'

import { useEffect } from 'react'

const MINE = process.env.NEXT_PUBLIC_BUILD_ID ?? 'local'
const RELOADED_AT = 'rhema-reloaded-at'

// Reload, but never twice in one minute.
function reloadOnce() {
  try {
    const last = Number(sessionStorage.getItem(RELOADED_AT) ?? 0)
    if (Date.now() - last < 60_000) return
    sessionStorage.setItem(RELOADED_AT, String(Date.now()))
  } catch {
    // No storage: reload anyway.
  }
  window.location.reload()
}

// True while somebody has typed something on the screen (a name, a note,
// a message). The app then never reloads by itself: it waits for the next
// tap on a menu link. Anthony, 2026-11-09: "someone is typing name and all
// of a sudden the screen refreshes and clears what they were doing?" Never.
function somethingTyped(): boolean {
  const fields = document.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>(
    'input:not([type=checkbox]):not([type=radio]):not([type=hidden]), textarea',
  )
  for (const field of fields) if (field.value.trim() !== '') return true
  return false
}

async function liveBuild(): Promise<string | null> {
  try {
    const answer = await fetch('/version.json', { cache: 'no-store' })
    if (!answer.ok) return null
    const { build } = (await answer.json()) as { build?: string }
    return build ?? null
  } catch {
    return null
  }
}

export default function AppFreshness() {
  useEffect(() => {
    // A local build never reloads itself.
    if (MINE === 'local') return
    let stale = false

    async function check(comingBack: boolean) {
      const live = await liveBuild()
      if (!live || live === MINE) return
      stale = true
      if (comingBack && !somethingTyped()) reloadOnce()
    }

    function cameBack() {
      if (document.visibilityState === 'visible') void check(true)
    }

    // While stale, a tap on a link inside the app becomes a full page load.
    function tapped(event: MouseEvent) {
      if (!stale) return
      const link = (event.target as Element | null)?.closest?.('a[href^="/"]')
      if (!link) return
      event.preventDefault()
      window.location.assign((link as HTMLAnchorElement).href)
    }

    // A screen file that will not load: reload.
    function failed(reason: unknown) {
      const words = String((reason as { message?: string })?.message ?? reason ?? '')
      if (
        /ChunkLoadError|Loading chunk|dynamically imported module|Importing a module script failed/i.test(
          words,
        )
      ) {
        reloadOnce()
      }
    }
    const onError = (event: ErrorEvent) => failed(event.error ?? event.message)
    const onRejection = (event: PromiseRejectionEvent) => failed(event.reason)

    document.addEventListener('visibilitychange', cameBack)
    document.addEventListener('click', tapped, true)
    window.addEventListener('error', onError)
    window.addEventListener('unhandledrejection', onRejection)
    const timer = window.setInterval(() => void check(false), 10 * 60_000)
    return () => {
      document.removeEventListener('visibilitychange', cameBack)
      document.removeEventListener('click', tapped, true)
      window.removeEventListener('error', onError)
      window.removeEventListener('unhandledrejection', onRejection)
      window.clearInterval(timer)
    }
  }, [])

  return null
}
