/*
 * app/admin/_parts/AccessTicks.tsx: the six access ticks, used on the
 * invite form and when the admin changes a person.
 *
 * Why: the demo's "Advanced access". Choosing a role sets the ticks; the
 * admin can then change any one of them.
 *
 * Never: treat a tick as the access itself. The database stores it and
 * checks it on every read.
 */
'use client'

import styles from './admin.module.css'
import { ACCESS, type Access } from '@/lib/admin/admin'

export default function AccessTicks({
  value,
  onChange,
  open = false,
}: {
  value: Access
  onChange: (next: Access) => void
  // Open from the start (when changing a person); folded on the invite form.
  open?: boolean
}) {
  return (
    <details className={styles.ticks} open={open}>
      <summary>Access</summary>
      {ACCESS.map(([key, words]) => (
        <label key={key} className={styles.tick}>
          <input
            type="checkbox"
            checked={value[key]}
            onChange={(event) => onChange({ ...value, [key]: event.target.checked })}
          />
          {words}
        </label>
      ))}
    </details>
  )
}
