/*
 * components/shell/AppShell.tsx: the frame around every signed in screen.
 *
 * Why: the RHEMA demo's frame. A blue top bar with the person's badge,
 * name and role, Lock screen and Sign out. Under it, the menu: a bar along
 * the bottom on a phone, a column down the left on a wider screen.
 *
 * Menu items whose part of the app is not built yet show "Soon" and cannot
 * be pressed. Each one switches on when its module is built (set `ready`
 * in section 1).
 *
 * Never: show patient data in the frame itself. It is on every screen.
 */
'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import Icon from './Icon'
import PersonBadge from '@/components/auth/PersonBadge'
import styles from './AppShell.module.css'
import { roleLabel } from '@/lib/auth/roles'
import { useAuth } from '@/lib/auth/session'

// ===== 1. The menu =====
const MENU = [
  { href: '/', icon: 'home', label: 'Home', ready: true },
  { href: '/patients/', icon: 'users', label: 'Patients', ready: false },
  { href: '/messages/', icon: 'msg', label: 'Messages', ready: false },
  { href: '/notifications/', icon: 'bell', label: 'Notifications', ready: false },
]

export default function AppShell({ children }: { children: React.ReactNode }) {
  const auth = useAuth()
  const path = usePathname()
  const staff = auth.staff
  if (!staff) return null

  const roleWords =
    roleLabel(staff.role) + (staff.can_admin && staff.role !== 'admin' ? ' · Admin' : '')

  return (
    <div className={styles.app}>
      {/* ===== 2. Top bar ===== */}
      <header className={styles.top}>
        <PersonBadge name={staff.full_name} />
        <div className={styles.who}>
          <b>{staff.full_name}</b>
          <small>{roleWords}</small>
        </div>
        <button className={styles.topButton} onClick={auth.lock} aria-label="Lock screen">
          <Icon name="lock" size={16} />
          <span>Lock screen</span>
        </button>
        <button className={styles.topButton} onClick={auth.signOut} aria-label="Sign out">
          <Icon name="out" size={16} />
          <span>Sign out</span>
        </button>
      </header>

      <div className={styles.body}>
        {/* ===== 3. Menu ===== */}
        <nav className={styles.nav} aria-label="Main menu">
          {MENU.map((item) =>
            item.ready ? (
              <Link
                key={item.href}
                href={item.href}
                className={`${styles.navItem} ${path === item.href ? styles.on : ''}`}
                aria-current={path === item.href ? 'page' : undefined}
              >
                <Icon name={item.icon} size={22} />
                {item.label}
              </Link>
            ) : (
              <span
                key={item.href}
                className={`${styles.navItem} ${styles.soon}`}
                aria-disabled="true"
              >
                <Icon name={item.icon} size={22} />
                {item.label}
                <em>Soon</em>
              </span>
            ),
          )}
        </nav>

        {/* ===== 4. The screen itself ===== */}
        <main className={styles.main}>{children}</main>
      </div>
    </div>
  )
}
