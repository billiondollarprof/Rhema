/*
 * components/shell/AppShell.tsx: the frame around every signed in screen.
 *
 * Why: the RHEMA demo's frame. A blue top bar with the hospital's logo, a
 * thin red line under it (request 114), the person's badge, Call attention
 * and the menu button; Lock screen, Notifications, the installation guide
 * and Sign out sit behind the menu (request 117, 2026-10-31). Under it,
 * the page menu: a bar along the bottom on a phone, a column down the left
 * on a wider screen.
 *
 * Menu items whose part of the app is not built yet show "Soon" and cannot
 * be pressed. Each one switches on when its module is built (set `ready`
 * in section 1).
 *
 * The frame also carries Call attention, because it must work on every
 * screen: the bell in the top bar opens the list, and the cards float in
 * over whatever screen is open (components/attention). And it carries the
 * install and alerts cards each device goes through once
 * (components/onboarding).
 *
 * A person with admin access also gets Admin in the menu (request 112).
 *
 * Never: show patient data in the frame itself. It is on every screen.
 */
'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'
import Icon from './Icon'
import MainMenu from './MainMenu'
import AttentionAlerts from '@/components/attention/AttentionAlerts'
import { AttentionMenuContext } from '@/components/attention/AttentionContext'
import AttentionMenu from '@/components/attention/AttentionMenu'
import OnboardingGate from '@/components/onboarding/OnboardingGate'
import PersonBadge from '@/components/auth/PersonBadge'
import Logo from '@/components/brand/Logo'
import styles from './AppShell.module.css'
import { roleLabel } from '@/lib/auth/roles'
import { useAuth } from '@/lib/auth/session'

// ===== 1. The menu =====
const MENU = [
  { href: '/', icon: 'home', label: 'Home', ready: true },
  { href: '/patients/', icon: 'users', label: 'Patients', ready: true },
  { href: '/messages/', icon: 'msg', label: 'Messages', ready: false },
]

// Only for a person with admin access (request 112). The database checks
// it again on every read and change.
const ADMIN_ITEM = { href: '/admin/', icon: 'shield', label: 'Admin', ready: true }

// Home is lit only on Home; any other item is lit on its own pages too
// (Patients stays lit on Register and Edit).
function isHere(path: string, href: string) {
  return href === '/' ? path === '/' : path.startsWith(href)
}

export default function AppShell({ children }: { children: React.ReactNode }) {
  const auth = useAuth()
  const path = usePathname()
  const [attentionOpen, setAttentionOpen] = useState(false)
  const staff = auth.staff
  const client = auth.client
  if (!staff || !client) return null

  const roleWords =
    roleLabel(staff.role) + (staff.can_admin && staff.role !== 'admin' ? ' · Admin' : '')

  return (
    <AttentionMenuContext.Provider value={{ open: attentionOpen, setOpen: setAttentionOpen }}>
      <div className={styles.app}>
        {/* ===== 2. Top bar ===== */}
        <header className={styles.top}>
          <Logo size={34} className={styles.topLogo} />
          {/* A thin line keeps the hospital's logo apart from the person. */}
          <span className={styles.topDivider} aria-hidden="true" />
          <PersonBadge name={staff.full_name} />
          <div className={styles.who}>
            <b>{staff.full_name}</b>
            <small>{roleWords}</small>
          </div>
          <AttentionMenu
            client={client}
            staffId={staff.id}
            myRoomId={staff.room_id}
            buttonClass={styles.topButton}
          />
          {/* Lock screen, Notifications, the guide and Sign out (request 117). */}
          <MainMenu buttonClass={styles.topButton} />
        </header>

        <div className={styles.body}>
          {/* ===== 3. Menu ===== */}
          <nav className={styles.nav} aria-label="Main menu">
            {(staff.can_admin ? [...MENU, ADMIN_ITEM] : MENU).map((item) =>
              item.ready ? (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`${styles.navItem} ${isHere(path, item.href) ? styles.on : ''}`}
                  aria-current={isHere(path, item.href) ? 'page' : undefined}
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

        {/* ===== 5. Call attention cards, over every screen ===== */}
        <AttentionAlerts client={client} staffId={staff.id} />

        {/* ===== 6. Install and alerts, once per device (must-do cards) ===== */}
        <OnboardingGate client={client} staffId={staff.id} />
      </div>
    </AttentionMenuContext.Provider>
  )
}
