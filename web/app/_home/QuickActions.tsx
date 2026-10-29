/*
 * app/_home/QuickActions.tsx: the four big buttons at the top of Home.
 *
 * Why: the RHEMA demo gives each role its four most used jobs (the demo's
 * ACT list), so nobody hunts through menus. A button whose page is not
 * built yet shows "Soon" and cannot be pressed; set `ready` when it is.
 *
 * Never: let a button look pressable when it does nothing.
 */
import Icon from '@/components/shell/Icon'
import styles from './home.module.css'

// ===== 1. The four buttons for each role, from the demo =====
type Action = { icon: string; label: string; colour: string; ready: boolean; job: 'queue' | 'soon' }

const QUEUE = 'queue' as const
const SOON = 'soon' as const

const FRONT_DESK: Action[] = [
  { icon: 'reg', label: 'Register patient', colour: '#1976d2', ready: false, job: SOON },
  { icon: 'find', label: 'Find patient', colour: '#00897b', ready: false, job: SOON },
  { icon: 'door', label: 'Send to room', colour: '#7e57c2', ready: false, job: SOON },
  { icon: 'bell', label: 'Call attention', colour: '#e53935', ready: false, job: SOON },
]
const DOCTOR: Action[] = [
  { icon: 'clip', label: 'Patient queue', colour: '#1976d2', ready: true, job: QUEUE },
  { icon: 'find', label: 'Find patient', colour: '#00897b', ready: false, job: SOON },
  { icon: 'lab', label: 'Request lab', colour: '#7e57c2', ready: false, job: SOON },
  { icon: 'bell', label: 'Call attention', colour: '#e53935', ready: false, job: SOON },
]
const NURSE: Action[] = [
  { icon: 'clip', label: 'Patient queue', colour: '#00838f', ready: true, job: QUEUE },
  { icon: 'find', label: 'Find patient', colour: '#00897b', ready: false, job: SOON },
  { icon: 'mega', label: 'Announce', colour: '#fb8c00', ready: false, job: SOON },
  { icon: 'bell', label: 'Call attention', colour: '#e53935', ready: false, job: SOON },
]
const PHARMACY: Action[] = [
  { icon: 'pill', label: 'Prescriptions', colour: '#00897b', ready: true, job: QUEUE },
  { icon: 'find', label: 'Find patient', colour: '#1976d2', ready: false, job: SOON },
  { icon: 'msg', label: 'Messages', colour: '#7e57c2', ready: false, job: SOON },
  { icon: 'bell', label: 'Call attention', colour: '#e53935', ready: false, job: SOON },
]
const LABORATORY: Action[] = [
  { icon: 'lab', label: 'Lab requests', colour: '#7e57c2', ready: true, job: QUEUE },
  { icon: 'find', label: 'Find patient', colour: '#1976d2', ready: false, job: SOON },
  { icon: 'msg', label: 'Messages', colour: '#00897b', ready: false, job: SOON },
  { icon: 'bell', label: 'Call attention', colour: '#e53935', ready: false, job: SOON },
]
const ADMIN: Action[] = [
  { icon: 'users', label: 'Invite staff', colour: '#546e7a', ready: false, job: SOON },
  { icon: 'mega', label: 'Announce', colour: '#fb8c00', ready: false, job: SOON },
  { icon: 'find', label: 'Find patient', colour: '#00897b', ready: false, job: SOON },
  { icon: 'bell', label: 'Call attention', colour: '#e53935', ready: false, job: SOON },
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
export default function QuickActions({ role }: { role: string }) {
  const actions = BY_ROLE[role] ?? ADMIN

  function run(action: Action) {
    if (action.job === QUEUE) {
      document.getElementById('queue')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
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
