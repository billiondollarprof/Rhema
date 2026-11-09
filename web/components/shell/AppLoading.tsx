/*
 * components/shell/AppLoading.tsx: what shows while the app starts.
 *
 * Why: Anthony, 2026-11-08, about the installed app: "as it is loading...
 * it's just as if they all plastered the logo on this thing, so it didn't
 * blend and it didn't show dynamic loading." Then: "why change the app's
 * loading screen to white instead of making the logo circular and letting
 * the edges blend well with the blue background." So the installed app's
 * icon is now the round logo with clear corners (web/public/icon-*.png),
 * the phone's start screen stays navy, and this screen continues it: the
 * same round logo on the same navy, breathing gently, with a light bar
 * moving under it, until the app is ready.
 *
 * Never: show anybody's data here. It shows before sign in is known.
 */
import Logo from '@/components/brand/Logo'
import { BRAND } from '@/lib/brand/brand'
import styles from './AppLoading.module.css'

export default function AppLoading() {
  return (
    <div className={styles.page} role="status" aria-label={`Opening ${BRAND.short}`}>
      <div className={styles.mark}>
        <Logo size={112} />
      </div>
      <div className={styles.bar} aria-hidden="true">
        <span />
      </div>
    </div>
  )
}
