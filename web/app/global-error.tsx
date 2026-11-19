/*
 * app/global-error.tsx: the last safety net, when even the app's frame (the
 * layout) cannot be shown. It draws its own page, because the normal one
 * failed.
 *
 * Why: the robustness review, 2026-11-19 (see app/error.tsx).
 *
 * Never: show the error's own text, or send it anywhere.
 */
'use client'

export default function AppError({ reset }: { error: Error; reset: () => void }) {
  return (
    <html lang="en-GB">
      <body
        style={{
          margin: 0,
          minHeight: '100vh',
          display: 'grid',
          placeItems: 'center',
          fontFamily: 'system-ui, sans-serif',
          background: '#f1f4f9',
          color: '#0f2238',
          padding: 16,
        }}
      >
        <div style={{ maxWidth: 420, textAlign: 'center' }}>
          <h1 style={{ fontSize: 22 }}>The app could not start</h1>
          <p>Check the internet, then try again.</p>
          <p style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={() => reset()}
              style={{
                minHeight: 44,
                padding: '8px 18px',
                borderRadius: 12,
                border: 0,
                background: '#1f5fd0',
                color: '#fff',
                fontWeight: 600,
              }}
            >
              Try again
            </button>
            <a
              href="/"
              style={{
                minHeight: 44,
                padding: '10px 18px',
                borderRadius: 12,
                border: '1px solid #cbd5e1',
                color: '#1f5fd0',
                fontWeight: 600,
                textDecoration: 'none',
                background: '#fff',
              }}
            >
              Reload the app
            </a>
          </p>
        </div>
      </body>
    </html>
  )
}
