/*
 * components/onboarding/InstallGuide.tsx: the animated "how to install"
 * guide, with the written steps beside it.
 *
 * Why: Anthony, 2026-10-30 (requests 102, 104, 107). No website may
 * install itself on an iPhone, an iPad or in Safari on a Mac, so the
 * person does it by hand. The animation follows the real screens he sent
 * from his iPad: the Share button, a menu that starts with people and
 * apps, then Copy, Add to Reading List and Add Bookmark, and you scroll
 * down to reach Add to Home Screen. Then Add, the icon on the home screen,
 * and the app open. Each step rings the spot to tap and points at it with
 * a numbered arrow, and the written steps sit beside it: "the first step,
 * second step, third step."
 *
 * The drawings are made in code, in the shapes of the real screens. Real
 * screenshots can replace them later without changing anything else.
 *
 * Sections:
 *   1. The steps for each device
 *   2. The drawings
 *   3. The guide: plays the steps, with the written list
 *
 * Never: show steps for a device other than the one asked for.
 */
'use client'

import { useEffect, useState } from 'react'
import styles from './onboarding.module.css'
import type { Platform } from '@/lib/install/device'

// ===== 1. The steps for each device =====
type Scene =
  | 'share' // Safari, the Share button (bottom on iPhone, top right on iPad)
  | 'sheet-top' // the Share menu as it opens, before scrolling
  | 'sheet-scrolled' // the Share menu scrolled down to Add to Home Screen
  | 'confirm' // the box with Add (or Install) at the top right
  | 'home' // the home screen with the RHEMA icon
  | 'app-open' // RHEMA open, full screen
  | 'mac-file' // Mac Safari, File in the menu bar
  | 'mac-dock-item' // the File menu, Add to Dock
  | 'mac-dock' // the Dock with the RHEMA icon
  | 'android-menu' // Chrome on Android, the three dots
  | 'android-install' // the Chrome menu, Install app
  | 'desktop-icon' // Chrome or Edge, the install icon in the address bar

type Step = { scene: Scene; words: string }
type Device = Exclude<Platform, 'other'>

export const GUIDES: Record<Device, Step[]> = {
  iphone: [
    { scene: 'share', words: 'In Safari, tap the Share button at the bottom of the screen.' },
    { scene: 'sheet-top', words: 'A menu opens. Scroll down the menu with your finger.' },
    { scene: 'sheet-scrolled', words: 'Tap Add to Home Screen.' },
    { scene: 'confirm', words: 'Tap Add at the top right.' },
    { scene: 'home', words: 'Go to your home screen and tap the RHEMA icon.' },
    { scene: 'app-open', words: 'RHEMA opens on its own. Sign in, and you are done.' },
  ],
  ipad: [
    { scene: 'share', words: 'In Safari, tap the Share button at the top right of the screen.' },
    { scene: 'sheet-top', words: 'A menu opens. Scroll down the menu with your finger.' },
    { scene: 'sheet-scrolled', words: 'Tap Add to Home Screen.' },
    { scene: 'confirm', words: 'Tap Add at the top right.' },
    { scene: 'home', words: 'Go to your home screen and tap the RHEMA icon.' },
    { scene: 'app-open', words: 'RHEMA opens on its own. Sign in, and you are done.' },
  ],
  'mac-safari': [
    { scene: 'mac-file', words: 'In Safari, click File in the menu bar at the top of the screen.' },
    { scene: 'mac-dock-item', words: 'Click Add to Dock.' },
    { scene: 'confirm', words: 'Click Add.' },
    { scene: 'mac-dock', words: 'Click the RHEMA icon in the Dock.' },
    { scene: 'app-open', words: 'RHEMA opens in its own window. Sign in, and you are done.' },
  ],
  android: [
    { scene: 'android-menu', words: 'In Chrome, tap the three dots at the top right.' },
    {
      scene: 'android-install',
      words: 'Tap Install app. On some phones it says Add to Home screen.',
    },
    { scene: 'confirm', words: 'Tap Install.' },
    { scene: 'home', words: 'Go to your home screen and tap the RHEMA icon.' },
    { scene: 'app-open', words: 'RHEMA opens on its own. Sign in, and you are done.' },
  ],
  desktop: [
    {
      scene: 'desktop-icon',
      words: 'In Chrome or Edge, click the install icon at the right of the address bar.',
    },
    { scene: 'confirm', words: 'Click Install.' },
    {
      scene: 'app-open',
      words: 'RHEMA opens in its own window. Next time, open it from your apps.',
    },
  ],
}

// ===== 2. The drawings =====
// The ringed spot to tap, with its numbered arrow. The arrow comes in from
// whichever side has room, and from above when the spot is near the
// bottom, so the arrow and its number never run off the picture or cover
// the words. `side` forces left (-1) or right (1) where words sit nearby.
function Target({ x, y, step, side }: { x: number; y: number; step: number; side?: 1 | -1 }) {
  const across = side ?? (x < 100 ? 1 : -1)
  const down = y > 150 ? -1 : 1
  const tipX = x + across * 14
  const tipY = y + down * 12
  return (
    <g>
      <circle className={styles.pulse} cx={x} cy={y} r="14" />
      <circle cx={x} cy={y} r="14" fill="none" stroke="#e53935" strokeWidth="2.5" />
      <g className={styles.arrow}>
        <path
          d={`M${x + across * 34} ${y + down * 30} L${tipX} ${tipY}`}
          stroke="#e53935"
          strokeWidth="3"
          strokeLinecap="round"
        />
        <path
          d={`M${tipX} ${tipY} l${across * 9} ${down} M${tipX} ${tipY} l${across} ${down * 9}`}
          stroke="#e53935"
          strokeWidth="3"
          strokeLinecap="round"
        />
        <circle cx={x + across * 42} cy={y + down * 37} r="10" fill="#e53935" />
        <text
          x={x + across * 42}
          y={y + down * 37 + 4}
          textAnchor="middle"
          fontSize="12"
          fontWeight="700"
          fill="#fff"
        >
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
      r={size * 0.3}
      fill="none"
      stroke="#fff"
      strokeWidth="1.4"
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

// Grey bars standing in for the page's text.
const Lines = ({
  x,
  y,
  rows,
  width = 90,
}: {
  x: number
  y: number
  rows: number
  width?: number
}) => (
  <>
    {Array.from({ length: rows }, (_, i) => (
      <rect
        key={i}
        x={x}
        y={y + i * 12}
        width={i % 2 ? width * 0.75 : width}
        height="5"
        rx="2.5"
        fill="#e5eaf2"
      />
    ))}
  </>
)

// One row of the Share menu.
function Row({
  x,
  y,
  w,
  label,
  on,
}: {
  x: number
  y: number
  w: number
  label: string
  on?: boolean
}) {
  return (
    <g>
      <rect x={x} y={y} width={w} height="17" rx="0" fill={on ? '#e8f0fd' : '#fff'} />
      <text x={x + 6} y={y + 12} fontSize="9" fontWeight={on ? 700 : 500} fill="#0f2238">
        {label}
      </text>
    </g>
  )
}

// The Share menu: people, apps, then the list. `scrolled` shows the lower
// part of the list, where Add to Home Screen is.
function ShareSheet({ x, y, w, scrolled }: { x: number; y: number; w: number; scrolled: boolean }) {
  const top = ['Copy', 'Add to Reading List', 'Add Bookmark']
  const lower = [
    'Add to Favourites',
    'Add to Quick Note',
    'Find on Page',
    'Add to Home Screen',
    'Markup',
  ]
  return (
    <g>
      <rect x={x} y={y} width={w} height="150" rx="10" fill="#f1f4f9" stroke="#e5eaf2" />
      {scrolled ? (
        lower.map((label, i) => (
          <Row
            key={label}
            x={x + 6}
            y={y + 10 + i * 19}
            w={w - 12}
            label={label}
            on={label === 'Add to Home Screen'}
          />
        ))
      ) : (
        <g className={styles.scrollHint}>
          {/* People you message often */}
          <circle cx={x + 22} cy={y + 20} r="9" fill="#cbd5e1" />
          <rect x={x + 12} y={y + 32} width="20" height="3" rx="1.5" fill="#cbd5e1" />
          {/* App icons: AirDrop, Mail, Notes, Reminders */}
          {[0, 1, 2, 3].map((i) => (
            <rect
              key={i}
              x={x + 10 + i * 24}
              y={y + 44}
              width="16"
              height="16"
              rx="4"
              fill={['#cfe0fb', '#4a86ee', '#fde68a', '#e5eaf2'][i]}
            />
          ))}
          {top.map((label, i) => (
            <Row key={label} x={x + 6} y={y + 72 + i * 19} w={w - 12} label={label} />
          ))}
        </g>
      )}
    </g>
  )
}

// A swipe up sign, to show "scroll down the menu". It sits beside the menu,
// never on a row, and it is grey, because red rings are kept for the one
// thing to tap (Anthony, 2026-10-30: "you only circle and highlight what
// they need to click").
function Swipe({ x, y }: { x: number; y: number }) {
  return (
    <g
      className={styles.swipe}
      stroke="#64748b"
      fill="none"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d={`M${x} ${y} v-34 M${x - 6} ${y - 28} l6 -6 l6 6`} strokeWidth="2.5" />
      <path d={`M${x - 7} ${y + 4} q7 8 14 0`} strokeWidth="2" />
      <text
        x={x}
        y={y + 18}
        textAnchor="middle"
        fontSize="9"
        fontWeight="700"
        fill="#64748b"
        stroke="none"
      >
        Scroll
      </text>
    </g>
  )
}

function PhoneFrame({ tablet, children }: { tablet: boolean; children: React.ReactNode }) {
  return tablet ? (
    <>
      <rect
        x="10"
        y="12"
        width="240"
        height="196"
        rx="14"
        fill="#fff"
        stroke="#0f2238"
        strokeWidth="3"
      />
      {children}
    </>
  ) : (
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

function SceneDrawing({ scene, step, device }: { scene: Scene; step: number; device: Device }) {
  const tablet = device === 'ipad'
  const computer = device === 'mac-safari' || device === 'desktop'

  // Phone and tablet scenes share the shapes; only the places differ.
  const sheet = tablet ? { x: 96, y: 34, w: 120 } : { x: 74, y: 56, w: 112 }

  switch (scene) {
    case 'share':
      return tablet ? (
        <PhoneFrame tablet>
          <rect x="20" y="22" width="220" height="20" rx="6" fill="#f1f4f9" />
          <text x="30" y="35" fontSize="7.5" fill="#64748b">
            rhema-hospital…workers.dev
          </text>
          <ShareIcon x={196} y={33} />
          {/* The real iPad bar: Share, then +, then the tabs button. */}
          <path d="M212 33 h8 M216 29 v8" stroke="#1f5fd0" strokeWidth="2" strokeLinecap="round" />
          <g stroke="#1f5fd0" strokeWidth="1.6" fill="none">
            <rect x="226" y="28" width="8" height="8" rx="1.5" />
            <rect x="229" y="25.5" width="8" height="8" rx="1.5" />
          </g>
          <Lines x={30} y={56} rows={10} width={150} />
          <Target x={196} y={31} step={step} />
        </PhoneFrame>
      ) : (
        <PhoneFrame tablet={false}>
          <Lines x={84} y={36} rows={9} />
          <rect x="73" y="176" width="114" height="34" fill="#f1f4f9" />
          <text x="130" y="170" textAnchor="middle" fontSize="7" fill="#64748b">
            rhema…workers.dev
          </text>
          {/* The real iPhone bar: back, forward, Share, bookmarks, tabs. */}
          <g
            stroke="#1f5fd0"
            strokeWidth="2"
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M92 188 l-5 5 l5 5" />
            <path d="M107 188 l5 5 l-5 5" />
            <path d="M146 188 v10 M146 188 q4 -2 8 0 v10 q-4 -2 -8 0" />
            <rect x="166" y="188" width="8" height="8" rx="1.5" />
            <rect x="169" y="185.5" width="8" height="8" rx="1.5" />
          </g>
          <ShareIcon x={130} y={193} />
          <Target x={130} y={191} step={step} />
        </PhoneFrame>
      )
    case 'sheet-top':
      return (
        <PhoneFrame tablet={tablet}>
          {tablet ? <Lines x={24} y={40} rows={10} width={80} /> : null}
          <ShareSheet x={sheet.x} y={sheet.y} w={sheet.w} scrolled={false} />
          <Swipe x={tablet ? sheet.x - 18 : sheet.x + sheet.w + 24} y={sheet.y + 120} />
        </PhoneFrame>
      )
    case 'sheet-scrolled':
      return (
        <PhoneFrame tablet={tablet}>
          {tablet ? <Lines x={24} y={40} rows={10} width={80} /> : null}
          <ShareSheet x={sheet.x} y={sheet.y} w={sheet.w} scrolled />
          <Target x={sheet.x + 48} y={sheet.y + 76} step={step} side={1} />
        </PhoneFrame>
      )
    case 'confirm': {
      const label = device === 'android' || device === 'desktop' ? 'Install' : 'Add'
      if (computer) {
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
            <rect x="60" y="56" width="140" height="80" rx="10" fill="#f1f4f9" stroke="#e5eaf2" />
            <RhemaIcon x={72} y={68} size={26} />
            <text x="106" y="85" fontSize="9" fontWeight="700" fill="#0f2238">
              Install RHEMA?
            </text>
            <rect x="140" y="110" width="50" height="18" rx="6" fill="#1f5fd0" />
            <text x="165" y="122" textAnchor="middle" fontSize="8" fontWeight="700" fill="#fff">
              {label}
            </text>
            <Target x={165} y={119} step={step} />
          </>
        )
      }
      return (
        <PhoneFrame tablet={tablet}>
          <rect x={sheet.x} y={sheet.y - 20} width={sheet.w} height="80" rx="10" fill="#f1f4f9" />
          <text x={sheet.x + 8} y={sheet.y - 6} fontSize="7.5" fill="#1f5fd0">
            Cancel
          </text>
          <text
            x={sheet.x + sheet.w - 8}
            y={sheet.y - 6}
            textAnchor="end"
            fontSize="7.5"
            fontWeight="700"
            fill="#1f5fd0"
          >
            {label}
          </text>
          <RhemaIcon x={sheet.x + 10} y={sheet.y + 6} size={26} />
          <text x={sheet.x + 42} y={sheet.y + 23} fontSize="9" fontWeight="700" fill="#0f2238">
            RHEMA
          </text>
          <Target x={sheet.x + sheet.w - 18} y={sheet.y - 9} step={step} side={1} />
        </PhoneFrame>
      )
    }
    case 'home': {
      const cols = tablet ? 7 : 4
      const ox = tablet ? 30 : 84
      const oy = tablet ? 32 : 40
      const gap = tablet ? 30 : 24
      return (
        <PhoneFrame tablet={tablet}>
          {Array.from({ length: cols * 3 }, (_, i) => (
            <rect
              key={i}
              x={ox + (i % cols) * gap}
              y={oy + Math.floor(i / cols) * 30}
              width="18"
              height="18"
              rx="5"
              fill="#cbd5e1"
            />
          ))}
          <RhemaIcon x={ox} y={oy + 90} size={20} />
          <text x={ox + 10} y={oy + 120} textAnchor="middle" fontSize="6.5" fill="#0f2238">
            RHEMA
          </text>
          <Target x={ox + 10} y={oy + 100} step={step} />
        </PhoneFrame>
      )
    }
    case 'app-open':
      if (computer) {
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
            <rect x="10" y="20" width="240" height="22" fill="#0a2a5e" />
            <text x="22" y="35" fontSize="8" fontWeight="700" fill="#fff">
              RHEMA
            </text>
            <RhemaIcon x={112} y={70} size={36} />
            <rect x="90" y="120" width="80" height="16" rx="6" fill="#1f5fd0" />
            <text x="130" y="131" textAnchor="middle" fontSize="7.5" fontWeight="700" fill="#fff">
              Sign in
            </text>
          </>
        )
      }
      return (
        <PhoneFrame tablet={tablet}>
          <rect
            x={tablet ? 12 : 72}
            y={tablet ? 14 : 8}
            width={tablet ? 236 : 116}
            height={tablet ? 192 : 204}
            rx={tablet ? 12 : 16}
            fill="url(#rhemaBlue)"
          />
          <RhemaIcon x={tablet ? 112 : 112} y={tablet ? 70 : 78} size={36} />
          <text
            x="130"
            y={tablet ? 128 : 136}
            textAnchor="middle"
            fontSize="8"
            fontWeight="700"
            fill="#fff"
          >
            RHEMA
          </text>
          <rect x="100" y={tablet ? 140 : 150} width="60" height="16" rx="6" fill="#fff" />
          <text
            x="130"
            y={tablet ? 151 : 161}
            textAnchor="middle"
            fontSize="7.5"
            fontWeight="700"
            fill="#0a2a5e"
          >
            Sign in
          </text>
        </PhoneFrame>
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
          <rect x="10" y="20" width="240" height="16" fill="#f1f4f9" />
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
              <Target x={120} y={74} step={step} />
            </g>
          ) : (
            <>
              <Lines x={30} y={50} rows={9} width={160} />
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
          <Lines x={30} y={40} rows={7} width={160} />
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
        <PhoneFrame tablet={false}>
          <rect x="74" y="24" width="112" height="20" rx="4" fill="#f1f4f9" />
          <text x="80" y="37" fontSize="7" fill="#64748b">
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
              <Target x={132} y={115} step={step} side={1} />
            </g>
          ) : (
            <>
              <Lines x={84} y={56} rows={9} />
              <Target x={178} y={34} step={step} />
            </>
          )}
        </PhoneFrame>
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
            rhema-hospital…workers.dev
          </text>
          <g stroke="#0f2238" strokeWidth="1.5" fill="none" strokeLinecap="round">
            <rect x="214" y="34" width="12" height="10" rx="2" />
            <path d="M220 36 v5 M218 39 l2 2 l2 -2" />
          </g>
          <Lines x={30} y={60} rows={8} width={160} />
          <Target x={220} y={39} step={step} />
        </>
      )
  }
}

// ===== 3. The guide: plays the steps, with the written list =====
export default function InstallGuide({
  platform,
  withList = false,
}: {
  platform: Device
  withList?: boolean
}) {
  const steps = GUIDES[platform]
  const [at, setAt] = useState(0)
  const [held, setHeld] = useState(false)

  // Move to the next step every 5 seconds, round and round, until the
  // person taps a step: then it stays on that step, so they can read it
  // at their own pace.
  useEffect(() => {
    if (held) return
    const timer = setInterval(() => setAt((now) => (now + 1) % steps.length), 5000)
    return () => clearInterval(timer)
  }, [steps.length, held])

  function show(index: number) {
    setHeld(true)
    setAt(index)
  }

  const step = steps[at]
  return (
    <div className={`${styles.guide} ${withList ? styles.guideWide : ''}`}>
      <div className={styles.guideScene}>
        <svg
          key={at}
          className={styles.scene}
          viewBox="0 0 260 220"
          role="img"
          aria-label={step.words}
        >
          <defs>
            <linearGradient id="rhemaBlue" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#0a2a5e" />
              <stop offset="1" stopColor="#1565c0" />
            </linearGradient>
          </defs>
          <SceneDrawing scene={step.scene} step={at + 1} device={platform} />
        </svg>
        {/* The step in words, right under the picture, so the eye never
            has to leave the animation to know what to do. */}
        <p className={styles.stepWords} key={`w${at}`}>
          <b>
            Step {at + 1} of {steps.length}.
          </b>{' '}
          {step.words}
        </p>
      </div>
      {withList ? (
        <ol className={styles.stepList}>
          {steps.map((s, i) => (
            <li key={s.words}>
              <button
                className={styles.stepItem}
                aria-current={i === at ? 'step' : undefined}
                onClick={() => show(i)}
              >
                <span className={styles.stepNumber}>{i + 1}</span>
                <span>{s.words}</span>
              </button>
            </li>
          ))}
        </ol>
      ) : (
        <div className={styles.dots} role="tablist" aria-label="Steps">
          {steps.map((s, i) => (
            <button
              key={s.words}
              role="tab"
              aria-selected={i === at}
              aria-label={`Step ${i + 1}`}
              className={styles.dot}
              onClick={() => show(i)}
            />
          ))}
        </div>
      )}
    </div>
  )
}
