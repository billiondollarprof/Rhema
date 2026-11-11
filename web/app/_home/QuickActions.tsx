/*
 * app/_home/QuickActions.tsx: the four big buttons at the top of Home.
 *
 * Why: the RHEMA demo gives each role its four most used jobs (the demo's
 * ACT list), so nobody hunts through menus. A button whose page is not
 * built yet shows "Soon" and cannot be pressed; set `ready` when it is.
 *
 * Never: let a button look pressable when it does nothing.
 */
'use client'

import { useRouter } from 'next/navigation'
import { useAttentionMenu } from '@/components/attention/AttentionContext'
import Icon from '@/components/shell/Icon'
import styles from './home.module.css'

// ===== 1. The four buttons for each role, from the demo =====
// job: 'queue' scrolls to the queue card; 'attention' opens the Call
// attention list; a page address opens that page; 'soon' is not built yet.
type Action = { icon: string; label: string; colour: string; ready: boolean; job: string }

const QUEUE = 'queue'
// Scrolls to the Laboratory card (request 115).
const LAB = 'lab'
// Scrolls to the Pharmacy card (request 123).
const PHARMACY_CARD = 'pharmacy'
const SOON = 'soon'
// Opens the Call attention list in the top bar, not a page.
const ATTENTION = 'attention'
const FIND = '/patients/'
const REGISTER = '/patients/register/'

const FRONT_DESK: Action[] = [
  { icon: 'reg', label: 'Register patient', colour: '#1976d2', ready: true, job: REGISTER },
  { icon: 'find', label: 'Find patient', colour: '#00897b', ready: true, job: FIND },
  { icon: 'door', label: 'Send to room', colour: '#7e57c2', ready: true, job: FIND },
  { icon: 'call', label: 'Call attention', colour: '#e53935', ready: true, job: ATTENTION },
]
const DOCTOR: Action[] = [
  { icon: 'clip', label: 'Patient queue', colour: '#1976d2', ready: true, job: QUEUE },
  { icon: 'find', label: 'Find patient', colour: '#00897b', ready: true, job: FIND },
  { icon: 'lab', label: 'Request lab', colour: '#7e57c2', ready: true, job: '/lab/request/' },
  { icon: 'call', label: 'Call attention', colour: '#e53935', ready: true, job: ATTENTION },
]
const NURSE: Action[] = [
  { icon: 'clip', label: 'Patient queue', colour: '#00838f', ready: true, job: QUEUE },
  { icon: 'find', label: 'Find patient', colour: '#00897b', ready: true, job: FIND },
  { icon: 'mega', label: 'Announce', colour: '#fb8c00', ready: true, job: '/announce/' },
  { icon: 'call', label: 'Call attention', colour: '#e53935', ready: true, job: ATTENTION },
]
const PHARMACY: Action[] = [
  { icon: 'pill', label: 'Prescriptions', colour: '#00897b', ready: true, job: PHARMACY_CARD },
  { icon: 'find', label: 'Find patient', colour: '#1976d2', ready: true, job: FIND },
  // Messages is in the menu; this place is for the medicine list (2026-11-11).
  { icon: 'pill', label: 'Medicine list', colour: '#7e57c2', ready: true, job: '/pharmacy/list/' },
  { icon: 'call', label: 'Call attention', colour: '#e53935', ready: true, job: ATTENTION },
]
const LABORATORY: Action[] = [
  { icon: 'lab', label: 'Lab requests', colour: '#7e57c2', ready: true, job: LAB },
  { icon: 'find', label: 'Find patient', colour: '#1976d2', ready: true, job: FIND },
  { icon: 'msg', label: 'Messages', colour: '#00897b', ready: true, job: '/messages/' },
  { icon: 'call', label: 'Call attention', colour: '#e53935', ready: true, job: ATTENTION },
]
const ADMIN: Action[] = [
  {
    icon: 'users',
    label: 'Invite staff',
    colour: '#546e7a',
    ready: true,
    job: '/admin/?tab=invite',
  },
  { icon: 'mega', label: 'Announce', colour: '#fb8c00', ready: true, job: '/announce/' },
  { icon: 'find', label: 'Find patient', colour: '#00897b', ready: true, job: FIND },
  { icon: 'call', label: 'Call attention', colour: '#e53935', ready: true, job: ATTENTION },
]

const BY_ROLE: Record<string, Action[]> = {
  front_desk: FRONT_DESK,
  doctor: DOCTOR,
  nurse: NURSE,
  matron: NURSE,
  pharmacy: PHARMACY,
  laboratory: LABORATORY,
  admin: ADMIN,
}

// ===== 2. The buttons =====
export default function QuickActions({ role, only }: { role: string; only?: Action[] }) {
  const actions = only ?? BY_ROLE[role] ?? ADMIN
  const router = useRouter()
  const attention = useAttentionMenu()

  function run(action: Action) {
    if (action.job === ATTENTION) {
      attention.setOpen(true)
    } else if (action.job === QUEUE || action.job === LAB || action.job === PHARMACY_CARD) {
      document.getElementById(action.job)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    } else if (action.job.startsWith('/')) {
      router.push(action.job)
    }
  }

  return (
    <div className={styles.actions}>
      {actions.map((action) => (
        <button
          key={action.label}
          className={styles.action}
          style={{ '--c': action.colour } as React.CSSProperties}
          disabled={!action.ready}
          onClick={() => run(action)}
        >
          <span>
            <Icon name={action.icon} size={26} />
          </span>
          {action.label}
          {!action.ready ? <span className={styles.soonTag}>Soon</span> : null}
        </button>
      ))}
    </div>
  )
}

// The admin's own buttons, shown last for somebody who also works with
// patients (Anthony, 2026-11-10).
export function AdminQuickActions() {
  return (
    <QuickActions
      role="admin"
      only={ADMIN.filter((a) => a.label !== 'Find patient' && a.label !== 'Call attention')}
    />
  )
}
