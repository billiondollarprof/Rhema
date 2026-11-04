/*
 * app/install/page.tsx: "Get RHEMA on every device", the install guide.
 *
 * Why: Anthony, 2026-10-29 (request 102). One place that shows how to
 * install RHEMA on an iPhone, an iPad, Android, a Mac or a Windows
 * computer, with the animated steps. It opens before signing in too, so
 * the admin can send this page to new staff, and it helps when RHEMA is
 * offered to other hospitals.
 *
 * Never: ask anybody to sign in here, or show any hospital data.
 */
'use client'

import Logo from '@/components/brand/Logo'
import Link from 'next/link'
import { useState, useSyncExternalStore } from 'react'
import InstallGuide from '@/components/onboarding/InstallGuide'
import card from '@/components/onboarding/onboarding.module.css'
import styles from './install.module.css'
import { detectPlatform, type Platform } from '@/lib/install/device'
import { BRAND } from '@/lib/brand/brand'

type Device = Exclude<Platform, 'other'>

// ===== 1. The devices, in the order most staff use them =====
const DEVICES: { id: Device; label: string }[] = [
  { id: 'android', label: 'Android' },
  { id: 'iphone', label: 'iPhone' },
  { id: 'ipad', label: 'iPad' },
  { id: 'desktop', label: 'Windows (Chrome or Edge)' },
  { id: 'mac-safari', label: 'Mac (Safari)' },
]

// ===== 2. The page =====
export default function InstallPage() {
  // Start on the device the person is holding, until they pick another.
  const holding = useSyncExternalStore(
    () => () => {},
    detectPlatform,
    () => 'other' as Platform,
  )
  const [picked, setDevice] = useState<Device | null>(null)
  const device: Device = picked ?? (holding === 'other' ? 'android' : holding)

  return (
    <main className={styles.page}>
      <div className={`${card.badge} ${card.badgeLogo}`}>
        <Logo size={58} />
      </div>
      <h1>Get {BRAND.short} on every device</h1>
      <div className={card.explain}>
        <p>Install {BRAND.short} once, and you open it from your home screen like any other app.</p>
        <p>Calls from other rooms reach you even when the app is closed.</p>
        <p>Pick your device below and follow the steps.</p>
      </div>

      <div className={styles.tabs} role="tablist" aria-label="Device">
        {DEVICES.map((item) => (
          <button
            key={item.id}
            role="tab"
            aria-selected={device === item.id}
            className={styles.tab}
            onClick={() => setDevice(item.id)}
          >
            {item.label}
          </button>
        ))}
      </div>

      <section className={styles.panel}>
        <InstallGuide key={device} platform={device} withList />
      </section>

      <Link className={card.help} href="/">
        Open {BRAND.short}
      </Link>
    </main>
  )
}
