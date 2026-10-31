/*
 * components/shell/MainMenu.tsx: the menu button (three lines) at the right
 * of the top bar, and the list it opens.
 *
 * Why: Anthony, 2026-10-31 (request 117): "only the call attention will be
 * there, then by the right of it, hamburger menu icon... Every other thing
 * is now behind hamburger menu... Keeps it clean." Behind it: Lock screen,
 * Notifications, the installation guide (later with the user manual inside
 * it), and Sign out. The automations go here too, when they are built.
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

export default function MainMenu({ buttonClass }: { buttonClass: string }) {
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
        aria-label="Menu"
      >
        <Icon name="menu" size={18} />
        <span>Menu</span>
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
          {/* The notifications part is not built yet: shown, but not pressable. */}
          <span className={`${styles.menuItem} ${styles.menuSoon}`} aria-disabled="true">
            <Icon name="bell" size={18} />
            Notifications
            <em>Soon</em>
          </span>
          <Link
            className={styles.menuItem}
            role="menuitem"
            href="/install/"
            onClick={() => setOpen(false)}
          >
            <Icon name="guide" size={18} />
            Installation guide
          </Link>
          <hr className={styles.menuLine} />
          <button
            className={`${styles.menuItem} ${styles.menuRed}`}
            role="menuitem"
            onClick={() => {
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
