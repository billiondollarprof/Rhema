/*
 * app/layout.tsx: the frame every screen of the RHEMA app sits inside.
 *
 * Why: sets the language, the page title, the phone friendly viewport, and
 * the base colours, once, for every screen. It also wraps every screen in
 * the sign in state (lib/auth/session.tsx).
 *
 * Never: fetch patient data here. This file wraps every screen, including
 * the sign in screen, so anything loaded here loads for people who are not
 * signed in yet.
 */
import type { Metadata, Viewport } from 'next'
import './globals.css'
import BellWaker from '@/components/attention/BellWaker'
import { AuthProvider } from '@/lib/auth/session'
import LoadingGate from '@/components/shell/LoadingGate'
import AppFreshness from '@/components/shell/AppFreshness'
import { BRAND } from '@/lib/brand/brand'

export const metadata: Metadata = {
  title: BRAND.name,
  description: `${BRAND.name}: hospital workspace`,
  // Staff only. Search engines must not list it.
  robots: { index: false, follow: false },
  // So the app can be added to a phone's home screen. An iPhone only shows
  // Call attention alerts for an app added this way.
  manifest: '/manifest.webmanifest',
  icons: { icon: '/icon-192.png', apple: '/apple-touch-icon.png' },
  appleWebApp: { capable: true, title: BRAND.short, statusBarStyle: 'black-translucent' },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#0a2a5e',
}

// ===== The old workers.dev addresses send people to the real ones =====
// Anthony, 2026-11-09: "go ahead with the workers.dev redirect". The
// screens on workers.dev are served as plain files before any code runs,
// so the move happens here, as the very first thing the page does, keeping
// the same screen and anything after it in the address. The /api/ door on
// workers.dev keeps answering, because the deploy checks use it.
const MOVE_TO_REAL_ADDRESS = `(function () {
  var h = location.hostname;
  if (!/\\.workers\\.dev$/.test(h)) return;
  var to = /^rhema-hospital-testing\\./.test(h)
    ? 'https://testing.rhemamedical.app'
    : /^rhema-hospital\\./.test(h) ? 'https://rhemamedical.app' : null;
  if (to) location.replace(to + location.pathname + location.search + location.hash);
})();`

// If the logo is still showing after 15 seconds, say so in plain words and
// offer a reload, with the first error the phone hit (a code, never a person).
// Anthony, 2026-11-09: one phone showed only the loading screen, for ever.
// This runs on its own, so it still works when the app's own code fails.
const STUCK_ON_LOGO = `(function () {
  var firstError = '';
  window.addEventListener('error', function (e) {
    if (!firstError) firstError = String(e && e.message ? e.message : 'script error').slice(0, 120);
  });
  setTimeout(function () {
    if (!document.querySelector('[role="status"][aria-label^="Opening"]')) return;
    var box = document.createElement('div');
    box.setAttribute('style', 'position:fixed;left:0;right:0;bottom:0;z-index:99999;padding:16px;text-align:center;background:#ffffff;color:#0f2238;font:15px/22px Arial,sans-serif');
    box.textContent = 'Taking longer than usual to open. ' + (firstError ? '(' + firstError + ') ' : '');
    var b = document.createElement('button');
    b.textContent = 'Try again';
    b.setAttribute('style', 'margin-left:8px;padding:8px 16px;border-radius:8px;border:1.5px solid #1f5fd0;background:#ffffff;color:#1f5fd0;font:bold 15px Arial,sans-serif');
    b.onclick = function () { location.reload(); };
    box.appendChild(b);
    document.body.appendChild(box);
  }, 15000);
})();`

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-GB">
      <head>
        <script dangerouslySetInnerHTML={{ __html: MOVE_TO_REAL_ADDRESS }} />
      </head>
      <body>
        {/* Who is signed in and whether the screen is locked, for every
            screen. It decides which screen shows, never what data a person
            may read: the database decides that. */}
        <AuthProvider>
          {children}
          {/* The logo, breathing, while the app starts (request 157). */}
          <LoadingGate />
        </AuthProvider>
        {/* Reloads an open app when a newer version has gone live. */}
        <AppFreshness />
        <script dangerouslySetInnerHTML={{ __html: STUCK_ON_LOGO }} />
        {/* Gets the Call attention bell ready on the first touch. */}
        <BellWaker />
      </body>
    </html>
  )
}
