/*
 * app/page.tsx: the first screen, at the root address.
 *
 * Why: for now it shows the RHEMA idle screen with a small server status
 * line at the bottom. The status proves the build, the deploy and the
 * Worker all work end to end, by asking the Worker for /api/health.
 *
 * Never: show patient data here. The sign in screen takes over this
 * address in step 4 of the build order (PLAN.md section 13), and the idle
 * screen then appears after a period with no activity.
 */
'use client'

import { useEffect, useState } from 'react'
import IdleScreen from '@/components/IdleScreen'

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

  return <IdleScreen footer={<span>Server: {label}</span>} />
}
