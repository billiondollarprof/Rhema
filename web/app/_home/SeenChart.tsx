/*
 * app/_home/SeenChart.tsx: the "Patients seen" chart on Home.
 *
 * Why: the demo's chart, with Week, Month, Year and 5 years. Here it counts
 * real finished visits from the queue (the database function
 * patients_seen), so it starts at nothing and fills up as the hospital
 * works.
 *
 * Never: show names. Counts only.
 */
'use client'

import { useEffect, useState } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import styles from './home.module.css'
import { loadPatientsSeen, type Period } from '@/lib/queue/queue'

const PERIODS: [Period, string, string][] = [
  ['week', 'Week', 'this week'],
  ['month', 'Month', 'this month'],
  ['year', 'Year', 'this year'],
  ['five_years', '5 years', 'over 5 years'],
]

export default function SeenChart({ client }: { client: SupabaseClient }) {
  const [period, setPeriod] = useState<Period>('week')
  const [series, setSeries] = useState<{ labels: string[]; values: number[] } | null>(null)

  // ===== 1. Load the counts for the chosen period =====
  useEffect(() => {
    let current = true
    loadPatientsSeen(client, period).then((result) => {
      if (current) setSeries(result)
    })
    return () => {
      current = false
    }
  }, [client, period])

  // ===== 2. Turn the counts into a line =====
  const values = series?.values ?? []
  const total = values.reduce((sum, value) => sum + value, 0)
  const highest = Math.max(1, ...values)
  const points = values.map((value, index) => [
    values.length > 1 ? (index * 300) / (values.length - 1) : 0,
    92 - (value / highest) * 80,
  ])
  const line = points
    .map(([x, y], index) => `${index ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`)
    .join('')
  // Show at most 7 labels under the chart, spread evenly.
  const labels = series?.labels ?? []
  const step = Math.max(1, Math.ceil(labels.length / 7))
  const shownLabels = labels.filter((_, index) => index % step === 0)
  const words = PERIODS.find(([key]) => key === period)?.[2] ?? ''

  return (
    <div className={styles.card}>
      <div className={styles.chartHead}>
        <div>
          <h3 style={{ margin: 0 }}>Patients seen {words}</h3>
          <small className={styles.muted}>Finished visits</small>
        </div>
        <b>{series ? total.toLocaleString('en-GB') : '·'}</b>
      </div>
      <div className={styles.segments} role="group" aria-label="Period">
        {PERIODS.map(([key, label]) => (
          <button key={key} aria-pressed={period === key} onClick={() => setPeriod(key)}>
            {label}
          </button>
        ))}
      </div>
      <svg
        className={styles.chart}
        viewBox="0 0 300 100"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <defs>
          <linearGradient id="seenFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#1976d2" stopOpacity="0.35" />
            <stop offset="1" stopColor="#1976d2" stopOpacity="0" />
          </linearGradient>
        </defs>
        {line ? (
          <>
            <path d={`${line}L300 100L0 100Z`} fill="url(#seenFill)" />
            <path
              d={line}
              fill="none"
              stroke="#1976d2"
              strokeWidth="3"
              vectorEffect="non-scaling-stroke"
            />
          </>
        ) : null}
      </svg>
      <div className={styles.axis}>
        {shownLabels.map((label, index) => (
          <span key={`${label}-${index}`}>{label}</span>
        ))}
      </div>
    </div>
  )
}
