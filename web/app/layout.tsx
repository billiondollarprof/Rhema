/*
 * app/layout.tsx: the frame every screen of the RHEMA app sits inside.
 *
 * Why: sets the language, the page title, the phone friendly viewport, and
 * the base colours, once, for every screen.
 *
 * Never: fetch patient data here. This file wraps every screen, including
 * the sign in screen, so anything loaded here loads for people who are not
 * signed in yet.
 */
import type { Metadata, Viewport } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'RHEMA Hospital',
  description: 'RHEMA Medical Center hospital workspace',
  // Staff only. Search engines must not list it.
  robots: { index: false, follow: false },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#0a2a5e',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-GB">
      <body>{children}</body>
    </html>
  )
}
