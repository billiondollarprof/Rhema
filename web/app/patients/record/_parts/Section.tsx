/*
 * record/_parts/Section.tsx: one part of the record as a card that folds
 * open and shut (Anthony, 2026-10-28: minimal screens, drop-downs for the
 * rest). The title shows how many lines it holds, so a closed card still
 * tells you what is inside.
 *
 * Never: hide the allergy banner inside a section. It sits above them all.
 */
import Icon from '@/components/shell/Icon'
import styles from './record.module.css'

type SectionProps = {
  title: string
  count?: number
  open?: boolean
  children: React.ReactNode
}

export default function Section({ title, count, open = false, children }: SectionProps) {
  return (
    <details className={styles.section} open={open}>
      <summary>
        <span className={styles.grow}>{title}</span>
        {count !== undefined ? <span className={styles.count}>{count}</span> : null}
        <span className={styles.chevron} aria-hidden="true">
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="m9 18 6-6-6-6" />
          </svg>
        </span>
      </summary>
      <div className={styles.body}>{children}</div>
    </details>
  )
}

export function EmptyLine({ text }: { text: string }) {
  return <p className={styles.muted}>{text}</p>
}

export { Icon }
