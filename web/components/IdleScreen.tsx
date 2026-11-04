/*
 * components/IdleScreen.tsx: the RHEMA screen that covers the app when it
 * is idle, and the holding screen at the root address for now.
 *
 * Why: Anthony's design (2026-10-28): deep blue, flowing light waves, the
 * hospital mark in a glowing ring, the hospital's name and "HOSPITAL OPERATIONS
 * SYSTEM", gently animated with a shimmer. It is drawn in code (SVG and CSS),
 * not loaded as a picture, so it stays sharp on any screen, weighs almost
 * nothing, and can move.
 *
 * Since 2026-10-30 (request 114) the ring holds the hospital's own logo,
 * the name is RHEMA MEDICAL CENTRE, and a thin red line under it is one of
 * the few red accents ("let the red be the accent, let the blue be the
 * major color").
 *
 * Never: show patient data on this screen. It is what a passer by sees on
 * an unattended desk, so it shows the hospital's name and nothing else.
 * Never remove the reduced motion rule in IdleScreen.module.css: some
 * people get unwell from movement, and their device setting must win.
 */
import { Montserrat } from 'next/font/google'
import styles from './IdleScreen.module.css'
import Logo from './brand/Logo'
import { BRAND } from '@/lib/brand/brand'

// Built into the app at build time, so no screen ever calls Google Fonts.
const montserrat = Montserrat({ subsets: ['latin'], weight: ['500', '600'] })

type IdleScreenProps = {
  // A small line at the bottom, such as the server status. Optional.
  footer?: React.ReactNode
  // Something to show behind the waves, such as the hospital photos on the
  // lock screen (Anthony, 2026-10-30). Optional.
  behind?: React.ReactNode
}

export default function IdleScreen({ footer, behind }: IdleScreenProps) {
  return (
    <main className={`${styles.screen} ${montserrat.className}`}>
      {/* ===== 0. Optional layer behind everything (the lock screen photos) ===== */}
      {behind ? <div className={styles.behind}>{behind}</div> : null}

      {/* ===== 1. The flowing waves, behind everything ===== */}
      <svg
        className={styles.waves}
        viewBox="0 0 1600 900"
        preserveAspectRatio="xMidYMid slice"
        aria-hidden="true"
      >
        <defs>
          <linearGradient id="waveA" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="#1fb6ff" stopOpacity="0" />
            <stop offset="0.35" stopColor="#5ee0ff" stopOpacity="0.95" />
            <stop offset="1" stopColor="#1e7bff" stopOpacity="0.1" />
          </linearGradient>
          <linearGradient id="waveB" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#3b8cff" stopOpacity="0.45" />
            <stop offset="1" stopColor="#0b3fa8" stopOpacity="0.9" />
          </linearGradient>
          <linearGradient id="waveC" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#8cc8ff" stopOpacity="0.75" />
            <stop offset="1" stopColor="#1556c9" stopOpacity="0.95" />
          </linearGradient>
          {/* Blur that turns a thin line into a glowing ribbon of light. */}
          <filter id="glow" x="-10%" y="-50%" width="120%" height="200%">
            <feGaussianBlur stdDeviation="6" result="soft" />
            <feMerge>
              <feMergeNode in="soft" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Each wave is two identical copies side by side (0 to 1600, then
            1600 to 3200) and slides left by exactly one copy, so the loop
            restarts with no visible jump. */}
        <g className={styles.waveSlow}>
          <path
            d="M0 640 C 400 520, 1200 760, 1600 640 C 2000 520, 2800 760, 3200 640 L 3200 900 L 0 900 Z"
            fill="url(#waveB)"
          />
        </g>
        <g className={styles.waveMid}>
          <path
            d="M0 720 C 500 820, 1100 610, 1600 720 C 2100 820, 2700 610, 3200 720 L 3200 900 L 0 900 Z"
            fill="url(#waveC)"
          />
        </g>
        <g className={styles.waveFast} filter="url(#glow)">
          <path
            d="M0 600 C 450 500, 1150 720, 1600 600 C 2050 500, 2750 720, 3200 600"
            fill="none"
            stroke="url(#waveA)"
            strokeWidth="4"
          />
          <path
            d="M0 660 C 500 560, 1100 800, 1600 660 C 2100 560, 2700 800, 3200 660"
            fill="none"
            stroke="url(#waveA)"
            strokeWidth="2"
            opacity="0.7"
          />
        </g>
      </svg>

      {/* ===== 2. Soft light at the top, like the design ===== */}
      <div className={styles.topGlow} aria-hidden="true" />

      {/* ===== 3. The hospital's logo in its glowing ring ===== */}
      <div className={styles.centre}>
        <div className={styles.ring}>
          <Logo size={160} className={styles.logo} />
        </div>

        {/* ===== 4. The name, with the shimmer passing across it ===== */}
        <h1 className={styles.name}>{BRAND.name.toUpperCase()}</h1>
        {/* A thin line in the hospital's red, as on its letterhead. */}
        <span className={styles.redLine} aria-hidden="true" />
        <p className={styles.subtitle}>HOSPITAL OPERATIONS SYSTEM</p>
      </div>

      {/* ===== 5. Optional footer line ===== */}
      {footer ? <div className={styles.footer}>{footer}</div> : null}
    </main>
  )
}
