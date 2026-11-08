/*
 * components/legal/LegalPage.tsx: the frame for the Privacy Policy and the
 * Terms of Use pages.
 *
 * Why: Anthony, 2026-11-08 (request 156): "It stays outside of the app,
 * just on its own." So these pages open without signing in, show no
 * hospital data, and link to each other and back to sign in.
 *
 * Never: ask anybody to sign in here, or show any hospital data.
 */
import Link from 'next/link'
import Logo from '@/components/brand/Logo'
import { BRAND } from '@/lib/brand/brand'
import { LEGAL_EFFECTIVE, LEGAL_UPDATED } from './PrivacyText'
import styles from './legal.module.css'

export default function LegalPage({
  which,
  children,
}: {
  which: 'privacy' | 'terms'
  children: React.ReactNode
}) {
  const title = which === 'privacy' ? 'Privacy Policy' : 'Terms of Use'
  return (
    <main className={styles.page}>
      <header className={styles.head}>
        <Logo size={56} />
        <h1>{title}</h1>
        <p className={styles.meta}>
          {BRAND.name} · Effective {LEGAL_EFFECTIVE} · Last updated {LEGAL_UPDATED}
        </p>
        <nav className={styles.tabs} aria-label="Documents">
          <Link
            href="/privacy/"
            className={which === 'privacy' ? styles.on : undefined}
            aria-current={which === 'privacy' ? 'page' : undefined}
          >
            Privacy Policy
          </Link>
          <Link
            href="/terms/"
            className={which === 'terms' ? styles.on : undefined}
            aria-current={which === 'terms' ? 'page' : undefined}
          >
            Terms of Use
          </Link>
        </nav>
      </header>
      <article className={styles.body}>{children}</article>
      <footer className={styles.foot}>
        <Link href="/sign-in/">Back to sign in</Link>
        <span>Developed by StellaXafe Technologies Limited</span>
      </footer>
    </main>
  )
}
