/*
 * components/shell/MainMenu.tsx: the menu button (three lines) at the right
 * of the top bar, and the list it opens.
 *
 * Why: Anthony, 2026-10-31 (request 117): "only the call attention will be
 * there, then by the right of it, hamburger menu icon... Every other thing
 * is now behind hamburger menu... Keeps it clean." Behind it: Lock screen,
 * Notifications (with a red bubble of how many wait, request 132), the
 * installation guide (later with the user manual inside it), and Sign out. The automations go here too, when they are built.
 *
 * Never: put Call attention behind this menu. It stays in the top bar,
 * one tap away, because it is urgent.
 */
'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import Icon from './Icon'
import styles from './AppShell.module.css'
import { useAuth } from '@/lib/auth/session'
import { readOutbox } from '@/lib/offline/outbox'

export default function MainMenu({
  buttonClass,
  waiting = 0,
}: {
  buttonClass: string
  // How many notifications wait (request 132): a red bubble on the button.
  waiting?: number
}) {
  const auth = useAuth()
  const [open, setOpen] = useState(false)
  const box = useRef<HTMLDivElement | null>(null)

  // ===== 1. A tap outside the list, or Escape, shuts it =====
  useEffect(() => {
    if (!open) return
    const outside = (event: PointerEvent) => {
      if (box.current && !box.current.contains(event.target as Node)) setOpen(false)
    }
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('pointerdown', outside)
    document.addEventListener('keydown', escape)
    return () => {
      document.removeEventListener('pointerdown', outside)
      document.removeEventListener('keydown', escape)
    }
  }, [open])

  // ===== 2. The button and the list =====
  return (
    <div className={styles.menuWrap} ref={box}>
      <button
        className={buttonClass}
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-controls="main-menu"
        aria-label={waiting > 0 ? `Menu, ${waiting} notifications` : 'Menu'}
      >
        <Icon name="menu" size={18} />
        {waiting > 0 ? (
          <em className={styles.menuBubble} aria-hidden="true">
            {waiting > 99 ? '99+' : waiting}
          </em>
        ) : null}
      </button>

      {open ? (
        <div id="main-menu" className={styles.menuPanel} role="menu">
          <button
            className={styles.menuItem}
            role="menuitem"
            onClick={() => {
              setOpen(false)
              auth.lock()
            }}
          >
            <Icon name="lock" size={18} />
            Lock screen
          </button>
          <Link
            className={styles.menuItem}
            role="menuitem"
            href="/notifications/"
            onClick={() => setOpen(false)}
          >
            <Icon name="bell" size={18} />
            Notifications
            {waiting > 0 ? (
              <em className={styles.menuCount}>{waiting > 99 ? '99+' : waiting}</em>
            ) : null}
          </Link>
          <Link
            className={styles.menuItem}
            role="menuitem"
            href="/install/"
            onClick={() => setOpen(false)}
          >
            <Icon name="guide" size={18} />
            Installation guide
          </Link>
          {/* What comes next, for everybody (request 150, kept 2026-11-04). */}
          <Link
            className={styles.menuItem}
            role="menuitem"
            href="/automations/"
            onClick={() => setOpen(false)}
          >
            <Icon name="bolt" size={18} />
            Automations
          </Link>
          <hr className={styles.menuLine} />
          <button
            className={`${styles.menuItem} ${styles.menuRed}`}
            role="menuitem"
            onClick={() => {
              // Things still waiting to send would be lost: ask first.
              const waiting = auth.staff ? readOutbox(auth.staff.id).length : 0
              if (
                waiting > 0 &&
                !window.confirm(
                  `You have ${waiting === 1 ? '1 entry' : `${waiting} entries`} not saved yet. Wait a little longer for the network to come back. If you sign out now, ${waiting === 1 ? 'it' : 'they'} will be deleted from this device. Sign out anyway?`,
                )
              ) {
                return
              }
              setOpen(false)
              void auth.signOut()
            }}
          >
            <Icon name="out" size={18} />
            Sign out
          </button>
        </div>
      ) : null}
    </div>
  )
}
