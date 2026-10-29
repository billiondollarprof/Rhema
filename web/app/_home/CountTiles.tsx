/*
 * app/_home/CountTiles.tsx: the count tiles on Home (the demo's tiles()).
 *
 * Why: at a glance, how busy the hospital is today. Real counts from the
 * database, never made up numbers. "Lab pending" joins when the lab is
 * built.
 *
 * Never: show names here. Counts only.
 */
import styles from './home.module.css'
import type { TodayCounts } from '@/lib/queue/queue'

export default function CountTiles({ counts }: { counts: TodayCounts | null }) {
  const tiles: [string, number | null, string][] = [
    ['Registered today', counts?.registeredToday ?? null, '#1976d2'],
    ['In queue', counts?.waiting ?? null, '#ef6c00'],
    ['In consultation', counts?.inConsultation ?? null, '#7e57c2'],
    ['Completed today', counts?.completedToday ?? null, '#2e7d5b'],
  ]
  return (
    <div className={styles.tiles}>
      {tiles.map(([label, value, colour]) => (
        <div
          key={label}
          className={`${styles.card} ${styles.tile}`}
          style={{ '--c': colour, borderTopColor: colour } as React.CSSProperties}
        >
          <b>{value ?? '·'}</b>
          <span>{label}</span>
        </div>
      ))}
    </div>
  )
}
