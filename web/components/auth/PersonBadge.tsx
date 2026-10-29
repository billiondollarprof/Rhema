/*
 * components/auth/PersonBadge.tsx: the round badge with a person's initials.
 *
 * Why: the demo shows each staff member as a coloured circle with their
 * initials, on the lock screen and in lists. There are no photos yet.
 *
 * Never: show anything but the initials. It sits on shared screens.
 */
import { initials } from '@/lib/auth/roles'
import styles from './Auth.module.css'

export default function PersonBadge({ name, large = false }: { name: string; large?: boolean }) {
  return (
    <span className={`${styles.badge} ${large ? styles.badgeLarge : ''}`} aria-hidden="true">
      {initials(name)}
    </span>
  )
}
