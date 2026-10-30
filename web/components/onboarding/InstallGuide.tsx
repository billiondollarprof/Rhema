/*
 * components/onboarding/InstallGuide.tsx: the animated "how to install"
 * guide, one set of steps for each kind of device.
 *
 * Why: Anthony, 2026-10-30. No website may install itself on an iPhone,
 * an iPad or in Safari on a Mac, so the person does it by hand. "You can
 * even animate the process... use arrow that points to the step one, this,
 * step two, the other one." Each step draws the device, rings the spot to
 * tap with a pulsing circle and a numbered arrow, and says the step in one
 * short line. The steps play on their own, and the dots let a person go
 * back to any step.
 *
 * The drawings are made in code, in the same shapes as the real screens
 * (the Share icon, the menu, "Add to Home Screen"). Real screenshots can
 * replace them later without changing anything else.
 *
 * Sections:
 *   1. The steps for each device
 *   2. The drawings (one small function per scene)
 *   3. The guide: plays the steps, with dots
 *
 * Never: show steps for a device other than the one asked for.
 */
'use client'

import { useEffect, useState } from 'react'
import styles from './onboarding.module.css'
import type { Platform } from '@/lib/install/device'

// ===== 1. The steps for each device =====
type Scene =
  | 'phone-share' // iPhone Safari, Share button at the bottom
  | 'tablet-share' // iPad Safari, Share button at the top right
  | 'sheet-add' // the Share menu, "Add to Home Screen" row
  | 'confirm-add' // the "Add" button at the top right of the box
  | 'home-icon' // the home screen with the RHEMA icon
  | 'mac-file' // Mac Safari menu bar, "File"
  | 'mac-dock-item' // the File menu, "Add to Dock"
  | 'mac-dock' // the Dock with the RHEMA icon
  | 'android-menu' // Chrome on Android, the three dots menu
  | 'android-install' // the menu, "Install app"
  | 'desktop-icon' // Chrome or Edge, the install icon in the address bar

type Step = { scene: Scene; words: string }

export const GUIDES: Record<Exclude<Platform, 'other'>, Step[]> = {
  iphone: [
    { scene: 'phone-share', words: 'Tap the Share button at the bottom of Safari.' },
    { scene: 'sheet-add', words: 'Scroll down and tap Add to Home Screen.' },
    { scene: 'confirm-add', words: 'Tap Add at the top right.' },
    { scene: 'home-icon', words: 'Open RHEMA from your home screen.' },
  ],
  ipad: [
    { scene: 'tablet-share', words: 'Tap the Share button at the top right of Safari.' },
    { scene: 'sheet-add', words: 'Tap Add to Home Screen.' },
    { scene: 'confirm-add', words: 'Tap Add at the top right.' },
    { scene: 'home-icon', words: 'Open RHEMA from your home screen.' },
  ],
  'mac-safari': [
    { scene: 'mac-file', words: 'Click File in the menu bar at the top of the screen.' },
    { scene: 'mac-dock-item', words: 'Click Add to Dock.' },
    { scene: 'confirm-add', words: 'Click Add.' },
    { scene: 'mac-dock', words: 'Open RHEMA from the Dock.' },
  ],
  android: [
    { scene: 'android-menu', words: 'Tap the three dots at the top right of Chrome.' },
    { scene: 'android-install', words: 'Tap Install app (or Add to Home screen).' },
    { scene: 'confirm-add', words: 'Tap Install.' },
    { scene: 'home-icon', words: 'Open RHEMA from your home screen.' },
  ],
  desktop: [
    {
      scene: 'desktop-icon',
      words:
        'Click the install icon at the right of the address bar (it says Open in app if RHEMA is already installed).',
    },
    { scene: 'confirm-add', words: 'Click Install.' },
    {
      scene: 'mac-dock',
      words: 'RHEMA opens in its own window. Next time, open it from your apps.',
    },
  ],
}

// ===== 2. The drawings =====
// Each scene is a small picture of the screen. `Target` is the ringed spot
// to tap, with its step number.
function Target({ x, y, step }: { x: number; y: number; step: number }) {
  return (
    <g>
      <circle className={styles.pulse} cx={x} cy={y} r="14" />
      <circle cx={x} cy={y} r="14" fill="none" stroke="#e53935" strokeWidth="2.5" />
      <g className={styles.arrow}>
        <path
          d={`M${x + 34} ${y + 30} L${x + 14} ${y + 12}`}
          stroke="#e53935"
          strokeWidth="3"
          strokeLinecap="round"
        />
        <path
          d={`M${x + 14} ${y + 12} l9 1 M${x + 14} ${y + 12} l1 9`}
          stroke="#e53935"
          strokeWidth="3"
          strokeLinecap="round"
        />
        <circle cx={x + 42} cy={y + 37} r="10" fill="#e53935" />
        <text x={x + 42} y={y + 41} textAnchor="middle" fontSize="12" fontWeight="700" fill="#fff">
          {step}
        </text>
      </g>
    </g>
  )
}

const ShareIcon = ({ x, y }: { x: number; y: number }) => (
  <g stroke="#1f5fd0" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round">
    <path d={`M${x - 6} ${y - 2} h-3 v12 h18 v-12 h-3`} />
    <path d={`M${x} ${y - 10} v13 M${x - 4} ${y - 6} l4 -4 l4 4`} />
  </g>
)

const RhemaIcon = ({ x, y, size = 30 }: { x: number; y: number; size?: number }) => (
  <g>
    <rect x={x} y={y} width={size} height={size} rx={size * 0.24} fill="#0a2a5e" />
    <circle
      cx={x + size / 2}
      cy={y + size / 2}
      r={size * 0.28}
      fill="none"
      stroke="#fff"
      strokeWidth="1.5"
    />
    <text
      x={x + size / 2}
      y={y + size / 2 + size * 0.11}
      textAnchor="middle"
      fontSize={size * 0.3}
      fontWeight="700"
      fill="#fff"
    >
      RH
    </text>
  </g>
)

function Phone({ children }: { children: React.ReactNode }) {
  return (
    <>
      <rect
        x="70"
        y="6"
        width="120"
        height="208"
        rx="18"
        fill="#fff"
        stroke="#0f2238"
        strokeWidth="3"
      />
      <rect x="110" y="12" width="40" height="7" rx="3.5" fill="#0f2238" />
      {children}
    </>
  )
}

function Scene({ scene, step }: { scene: Scene; step: number }) {
  const lines = (x: number, y: number, rows: number) =>
    Array.from({ length: rows }, (_, i) => (
      <rect
        key={i}
        x={x}
        y={y + i * 12}
        width={i % 2 ? 70 : 90}
        height="5"
        rx="2.5"
        fill="#e5eaf2"
      />
    ))

  switch (scene) {
    case 'phone-share':
      return (
        <Phone>
          {lines(84, 40, 8)}
          <rect x="74" y="178" width="112" height="30" rx="0" fill="#f1f4f9" />
          <text x="130" y="171" textAnchor="middle" fontSize="8" fill="#64748b">
            rhema…workers.dev
          </text>
          <ShareIcon x={130} y={194} />
          <Target x={130} y={192} step={step} />
        </Phone>
      )
    case 'tablet-share':
      return (
        <>
          <rect
            x="20"
            y="20"
            width="220"
            height="170"
            rx="14"
            fill="#fff"
            stroke="#0f2238"
            strokeWidth="3"
          />
          <rect x="30" y="30" width="200" height="22" rx="6" fill="#f1f4f9" />
          <text x="110" y="45" textAnchor="middle" fontSize="8" fill="#64748b">
            rhema…workers.dev
          </text>
          <ShareIcon x={212} y={42} />
          {lines(40, 70, 8)}
          <Target x={212} y={40} step={step} />
        </>
      )
    case 'sheet-add':
      return (
        <Phone>
          <rect x="74" y="70" width="112" height="140" rx="10" fill="#f1f4f9" />
          {['Copy', 'Add to Reading List', 'Add to Home Screen', 'Find on Page'].map((label, i) => (
            <g key={label}>
              <rect
                x="80"
                y={84 + i * 28}
                width="100"
                height="22"
                rx="6"
                fill={i === 2 ? '#e8f0fd' : '#fff'}
              />
              <text
                x="86"
                y={98 + i * 28}
                fontSize="8"
                fontWeight={i === 2 ? 700 : 400}
                fill="#0f2238"
              >
                {label}
              </text>
              {i === 2 ? (
                <path
                  d="M168 147 v-7 M164.5 143.5 h7"
                  stroke="#0f2238"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                />
              ) : null}
            </g>
          ))}
          <Target x={118} y={151} step={step} />
        </Phone>
      )
    case 'confirm-add':
      return (
        <Phone>
          <rect x="74" y="30" width="112" height="90" rx="10" fill="#f1f4f9" />
          <text x="82" y="46" fontSize="8" fill="#1f5fd0">
            Cancel
          </text>
          <text x="174" y="46" textAnchor="end" fontSize="8" fontWeight="700" fill="#1f5fd0">
            Add
          </text>
          <RhemaIcon x={84} y={58} size={28} />
          <text x="118" y="76" fontSize="9" fontWeight="700" fill="#0f2238">
            RHEMA
          </text>
          <Target x={166} y={43} step={step} />
        </Phone>
      )
    case 'home-icon':
      return (
        <Phone>
          {Array.from({ length: 12 }, (_, i) => (
            <rect
              key={i}
              x={84 + (i % 4) * 24}
              y={40 + Math.floor(i / 4) * 30}
              width="18"
              height="18"
              rx="5"
              fill="#cbd5e1"
            />
          ))}
          <RhemaIcon x={84} y={130} size={22} />
          <text x="95" y="162" textAnchor="middle" fontSize="6.5" fill="#0f2238">
            RHEMA
          </text>
          <Target x={95} y={141} step={step} />
        </Phone>
      )
    case 'mac-file':
    case 'mac-dock-item':
      return (
        <>
          <rect
            x="10"
            y="20"
            width="240"
            height="160"
            rx="10"
            fill="#fff"
            stroke="#0f2238"
            strokeWidth="3"
          />
          <rect x="10" y="20" width="240" height="16" rx="0" fill="#f1f4f9" />
          {['Safari', 'File', 'Edit', 'View'].map((label, i) => (
            <text
              key={label}
              x={22 + i * 34}
              y={31}
              fontSize="8"
              fontWeight={label === 'File' ? 700 : 400}
              fill="#0f2238"
            >
              {label}
            </text>
          ))}
          {scene === 'mac-dock-item' ? (
            <g>
              <rect x="52" y="38" width="96" height="70" rx="6" fill="#fff" stroke="#e5eaf2" />
              {['New Window', 'Open File…', 'Add to Dock…', 'Close Window'].map((label, i) => (
                <g key={label}>
                  <rect
                    x="56"
                    y={42 + i * 16}
                    width="88"
                    height="13"
                    rx="3"
                    fill={i === 2 ? '#1f5fd0' : 'none'}
                  />
                  <text x="60" y={51 + i * 16} fontSize="7.5" fill={i === 2 ? '#fff' : '#0f2238'}>
                    {label}
                  </text>
                </g>
              ))}
              <Target x={100} y={74} step={step} />
            </g>
          ) : (
            <>
              {lines(30, 50, 9)}
              <Target x={64} y={28} step={step} />
            </>
          )}
        </>
      )
    case 'mac-dock':
      return (
        <>
          <rect
            x="10"
            y="20"
            width="240"
            height="160"
            rx="10"
            fill="#fff"
            stroke="#0f2238"
            strokeWidth="3"
          />
          {lines(30, 40, 7)}
          <rect x="50" y="150" width="160" height="26" rx="8" fill="#f1f4f9" stroke="#e5eaf2" />
          {[0, 1, 2, 3].map((i) => (
            <rect key={i} x={60 + i * 26} y="154" width="18" height="18" rx="5" fill="#cbd5e1" />
          ))}
          <RhemaIcon x={166} y={154} size={18} />
          <Target x={175} y={163} step={step} />
        </>
      )
    case 'android-menu':
    case 'android-install':
      return (
        <Phone>
          <rect x="74" y="24" width="112" height="20" rx="4" fill="#f1f4f9" />
          <text x="80" y="37" fontSize="7.5" fill="#64748b">
            rhema…workers.dev
          </text>
          {[0, 1, 2].map((i) => (
            <circle key={i} cx="178" cy={29 + i * 5} r="1.6" fill="#0f2238" />
          ))}
          {scene === 'android-install' ? (
            <g>
              <rect x="104" y="46" width="84" height="84" rx="6" fill="#fff" stroke="#e5eaf2" />
              {['New tab', 'Bookmarks', 'History', 'Install app'].map((label, i) => (
                <g key={label}>
                  <rect
                    x="108"
                    y={50 + i * 19}
                    width="76"
                    height="15"
                    rx="3"
                    fill={i === 3 ? '#e8f0fd' : 'none'}
                  />
                  <text
                    x="112"
                    y={60 + i * 19}
                    fontSize="7.5"
                    fontWeight={i === 3 ? 700 : 400}
                    fill="#0f2238"
                  >
                    {label}
                  </text>
                </g>
              ))}
              <Target x={140} y={115} step={step} />
            </g>
          ) : (
            <>
              {lines(84, 56, 9)}
              <Target x={178} y={34} step={step} />
            </>
          )}
        </Phone>
      )
    case 'desktop-icon':
      return (
        <>
          <rect
            x="10"
            y="20"
            width="240"
            height="160"
            rx="10"
            fill="#fff"
            stroke="#0f2238"
            strokeWidth="3"
          />
          <rect x="20" y="30" width="220" height="18" rx="9" fill="#f1f4f9" />
          <text x="32" y="42" fontSize="8" fill="#64748b">
            rhema…workers.dev
          </text>
          <g stroke="#0f2238" strokeWidth="1.5" fill="none" strokeLinecap="round">
            <rect x="214" y="34" width="12" height="10" rx="2" />
            <path d="M220 36 v5 M218 39 l2 2 l2 -2" />
          </g>
          {lines(30, 60, 8)}
          <Target x={220} y={39} step={step} />
        </>
      )
  }
}

// ===== 3. The guide: plays the steps, with dots =====
export default function InstallGuide({ platform }: { platform: Exclude<Platform, 'other'> }) {
  const steps = GUIDES[platform]
  const [at, setAt] = useState(0)

  // Move to the next step every 3 seconds, round and round.
  useEffect(() => {
    const timer = setInterval(() => setAt((now) => (now + 1) % steps.length), 3000)
    return () => clearInterval(timer)
  }, [steps.length])

  const step = steps[at]
  return (
    <div className={styles.guide}>
      <svg
        key={at}
        className={styles.scene}
        viewBox="0 0 260 220"
        role="img"
        aria-label={step.words}
      >
        <Scene scene={step.scene} step={at + 1} />
      </svg>
      <p className={styles.stepWords} key={`w${at}`}>
        <b>Step {at + 1}.</b> {step.words}
      </p>
      <div className={styles.dots} role="tablist" aria-label="Steps">
        {steps.map((s, i) => (
          <button
            key={s.words}
            role="tab"
            aria-selected={i === at}
            aria-label={`Step ${i + 1}`}
            className={styles.dot}
            onClick={() => setAt(i)}
          />
        ))}
      </div>
    </div>
  )
}
