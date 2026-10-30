/*
 * components/brand/Logo.tsx: the hospital's own round logo.
 *
 * Why: Anthony, 2026-10-30 (request 114): "crop out the logo and use the
 * logo for where we have the... RH", on the sign in card, the lock screen,
 * the install cards and the top bar. It was cut from the hospital's
 * letterhead into web/public/logo.webp.
 *
 * Never: stretch it out of its circle, or recolour it. It is the hospital's
 * mark.
 */
export default function Logo({ size, className }: { size: number; className?: string }) {
  return (
    // A plain picture: the app is a static export, so there is no image server.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/logo.webp"
      alt="Rhema Medical Centre"
      width={size}
      height={size}
      className={className}
      style={{ borderRadius: '50%', display: 'block' }}
    />
  )
}
