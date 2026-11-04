/*
 * components/brand/Logo.tsx: the hospital's own round mark.
 *
 * Why: Anthony, 2026-10-30 (request 114): "crop out the logo and use the
 * logo for where we have the... RH", on the sign in card, the lock screen,
 * the install cards and the top bar. Rhema's was cut from the hospital's
 * letterhead into web/public/logo.webp.
 *
 * For a client being shown the system (request 150), the mark is the
 * client's letters in a circle, "MA" for MASCAP, set in lib/brand/brand.ts.
 *
 * Never: stretch it out of its circle, or recolour a hospital's own logo.
 */
import { BRAND } from '@/lib/brand/brand'

export default function Logo({ size, className }: { size: number; className?: string }) {
  // ===== 1. A client's letters in a circle =====
  if (BRAND.initials) {
    return (
      <span
        role="img"
        aria-label={BRAND.name}
        className={className}
        style={{
          width: size,
          height: size,
          borderRadius: '50%',
          display: 'grid',
          placeItems: 'center',
          flexShrink: 0,
          background: '#fff',
          color: '#0a2a5e',
          boxShadow: `inset 0 0 0 ${Math.max(2, Math.round(size / 20))}px #0a2a5e`,
          fontWeight: 800,
          fontSize: Math.round(size * 0.38),
          letterSpacing: '0.02em',
          lineHeight: 1,
        }}
      >
        {BRAND.initials}
      </span>
    )
  }

  // ===== 2. The hospital's own logo picture =====
  return (
    // A plain picture: the app is a static export, so there is no image server.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/logo.webp"
      alt={BRAND.name}
      width={size}
      height={size}
      className={className}
      style={{ borderRadius: '50%', display: 'block' }}
    />
  )
}
