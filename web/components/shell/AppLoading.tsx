/*
 * components/shell/AppLoading.tsx: what shows while the app starts.
 *
 * Why: Anthony, 2026-11-08, about the installed app: "as it is loading...
 * it's just as if they all plastered the logo on this thing, so it didn't
 * blend and it didn't show dynamic loading." The phone's own start screen
 * is now white (manifest background_color), the same white as the logo's
 * square, so the logo sits on one clean page. Then this screen takes over:
 * the same logo in the middle, breathing gently, with a thin bar moving
 * under it, until the app is ready.
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
