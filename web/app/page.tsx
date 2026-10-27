/*
 * app/page.tsx: the first screen, at the root address.
 *
 * Why: for now this is a holding screen that proves the build, the deploy
 * and the Worker all work end to end. It asks the Worker for /api/health
 * and shows whether the answer came back.
 *
 * Never: show patient data here. The sign in screen replaces this in step 4
 * of the build order (PLAN.md section 13).
 */
'use client'

import { useEffect, useState } from 'react'

// ===== 1. Ask the Worker whether it is running =====
function useWorkerStatus() {
  const [status, setStatus] = useState<'checking' | 'ok' | 'down'>('checking')

  useEffect(() => {
    fetch('/api/health')
      .then((response) => setStatus(response.ok ? 'ok' : 'down'))
      .catch(() => setStatus('down'))
  }, [])

  return status
}

// ===== 2. The screen =====
export default function HomePage() {
  const status = useWorkerStatus()
  const label = { checking: 'Checking…', ok: 'Ready', down: 'Not reachable' }[status]

  return (
    <main
      style={{
        minHeight: '100dvh',
        display: 'grid',
        placeItems: 'center',
        padding: 20,
        background: 'linear-gradient(150deg, #0a2a5e, #1565c0 60%, #42a5f5)',
      }}
    >
      <div
        style={{
          background: '#fff',
          borderRadius: 22,
          padding: 26,
          width: 'min(400px, 100%)',
          textAlign: 'center',
        }}
      >
        <h1 style={{ margin: 0, letterSpacing: '0.32em', color: 'var(--nv)' }}>RHEMA</h1>
        <p style={{ color: 'var(--mut)', margin: '6px 0 18px' }}>Hospital workspace</p>
        <p style={{ margin: 0 }}>
          Server: <b>{label}</b>
        </p>
      </div>
    </main>
  )
}
