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
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import Icon from './Icon'
import MainMenu from './MainMenu'
import AttentionAlerts from '@/components/attention/AttentionAlerts'
import OutboxSender from '@/components/offline/OutboxSender'
import { loadNotices, totalOf } from '@/lib/notifications/notifications'
import { onChange } from '@/lib/live/changes'
import { playNoticeSound } from '@/lib/live/sound'
import { AttentionMenuContext } from '@/components/attention/AttentionContext'
import AttentionMenu from '@/components/attention/AttentionMenu'
import AgreementGate from '@/components/legal/AgreementGate'
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
  { href: '/messages/', icon: 'msg', label: 'Messages', ready: true },
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
  // The install and alerts cards wait until the agreement card is answered,
  // so only one card shows at a time (request 156).
  const [agreementDone, setAgreementDone] = useState(false)
  // The refresh button (request 157, back on his word, 2026-11-09: "that
  // refresh spinning wheel at the top bar will be needed"): it turns for a
  // moment, then the app loads again.
  const [refreshing, setRefreshing] = useState(false)
  function refreshApp() {
    setRefreshing(true)
    window.setTimeout(() => window.location.reload(), 450)
  }
  // The back button (request 171b): back to the previous screen of the
  // app; when this screen was opened first (a link, a refresh), to Home.
  const router = useRouter()
  const firstPath = useRef(path)
  const [movedInApp, setMovedInApp] = useState(false)
  useEffect(() => {
    if (path !== firstPath.current) setMovedInApp(true)
  }, [path])
  function goBack() {
    if (movedInApp) router.back()
    else router.push('/')
  }
  const staff = auth.staff
  const client = auth.client
  // Everything waiting, checked every 30 seconds: the red bubble on the
  // menu button (all of it, request 132) and on Messages (messages only).
  const [unread, setUnread] = useState(0)
  const [waitingTotal, setWaitingTotal] = useState(0)
  // The last counts, to hear when something new arrives.
  const lastCount = useRef<{ total: number; messages: number } | null>(null)
  useEffect(() => {
    if (!client || !staff) return
    let current = true
    const check = () =>
      void loadNotices(client, staff).then((notices) => {
        if (!current) return
        const total = totalOf(notices)
        const messages = totalOf(notices.filter((notice) => notice.key.startsWith('messages-')))
        // Something new waiting: the notification sound (request 171d). Not
        // on the first count, and not for a message while Messages is open
        // (that screen plays its own pom).
        const before = lastCount.current
        if (before && total > before.total) {
          const onlyMessages = total - before.total === messages - before.messages
          if (!(onlyMessages && path.startsWith('/messages'))) playNoticeSound()
        }
        lastCount.current = { total, messages }
        setWaitingTotal(total)
        setUnread(messages)
      })
    const first = window.setTimeout(check, 1500)
    const timer = window.setInterval(check, 30_000)
    // A message sent anywhere: count again at once (request 157).
    const stopListening = onChange(client, 'messages', check)
    const stopRecords = onChange(client, 'records', check)
    return () => {
      stopListening()
      stopRecords()
      current = false
      window.clearTimeout(first)
      window.clearInterval(timer)
    }
  }, [client, staff, path])
  if (!staff || !client) return null

  const roleWords =
    roleLabel(staff.role) + (staff.can_admin && staff.role !== 'admin' ? ' · Admin' : '')

  return (
    <AttentionMenuContext.Provider value={{ open: attentionOpen, setOpen: setAttentionOpen }}>
      <div className={styles.app}>
        {/* ===== 2. Top bar ===== */}
        <header className={styles.top}>
          {/* On a desktop the logo sits above the menu down the left. */}
          <div className={styles.topBrand}>
            <Logo size={34} className={styles.topLogo} />
          </div>
          {/* On a desktop this part lines up with the page below it. */}
          <div className={styles.topInner}>
            {/* Back, on every screen but Home (request 171b). */}
            {path !== '/' ? (
              <button
                type="button"
                className={`${styles.topButton} ${styles.backButton}`}
                onClick={goBack}
                aria-label="Back"
                title="Back"
              >
                <Icon name="back" size={18} />
              </button>
            ) : null}
            {/* Refresh, near the logo and away from Call attention and the
                menu, so it is not tapped by mistake (Anthony, 2026-11-09). */}
            <button
              type="button"
              className={`${styles.topButton} ${refreshing ? styles.turning : ''}`}
              onClick={refreshApp}
              aria-label="Refresh"
              title="Refresh"
            >
              <Icon name="refresh" size={18} />
            </button>
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
            <MainMenu buttonClass={styles.topButton} waiting={waitingTotal} />
          </div>
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
                  {/* Unread messages: a red bubble with the number. */}
                  {item.href === '/messages/' && unread > 0 ? (
                    <em className={styles.bubble} aria-label={`${unread} unread`}>
                      {unread > 99 ? '99+' : unread}
                    </em>
                  ) : null}
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
        {/* Sends what waited while the network was down (request 128, step 3). */}
        <OutboxSender client={client} staffId={staff.id} />

        {/* ===== 6. Agreeing to the Terms of Use and Privacy Policy, once per
            version of the words (request 156) ===== */}
        <AgreementGate client={client} staffId={staff.id} onDone={() => setAgreementDone(true)} />

        {/* ===== 6. Install and alerts, once per device (must-do cards) ===== */}
        {agreementDone ? <OnboardingGate client={client} staffId={staff.id} /> : null}
      </div>
    </AttentionMenuContext.Provider>
  )
}
