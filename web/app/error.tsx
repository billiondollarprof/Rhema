/*
 * app/error.tsx: what shows when a screen hits an error while it draws.
 *
 * Why: security and robustness review, 2026-11-19 (Anthony: "anything that
 * will cause any crash or breakage, so that we catch and fix it now"). With
 * no screen like this, one fault left a blank white page until somebody
 * reloaded the app. Now the person sees what happened and two ways on.
 * Unsaved notes are kept as drafts (request 227j), so Try again loses
 * nothing typed in a form that keeps a draft.
 *
 * Never: show the error's own text (it can hold record details), or send
 * it anywhere. Only its short code goes to the browser's console.
 */
'use client'

import { useEffect } from 'react'
import styles from './problem.module.css'

export default function ScreenError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // The code only, never the message, for whoever looks at the console.
    console.warn(`A screen could not be shown${error.digest ? ` (code ${error.digest})` : ''}.`)
  }, [error])

  return (
    <main className={styles.page}>
      <div className={styles.card}>
        <h1>This screen could not be shown</h1>
        <p>
          Something went wrong while opening it. What you typed in a note is kept as a draft. Try
          again, or go back to Home.
        </p>
        <div className={styles.buttons}>
          <button type="button" className={styles.primary} onClick={() => reset()}>
            Try again
          </button>
          {/* A full load: if the fault came from an old version of the app,
              this brings the new one. */}
          <a className={styles.secondary} href="/">
            Go to Home
          </a>
        </div>
      </div>
    </main>
  )
}
