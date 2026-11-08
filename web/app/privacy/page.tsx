/*
 * app/privacy/page.tsx: the Privacy Policy, open without signing in.
 *
 * Why: request 156 (2026-11-08). Linked from the sign in page and from the
 * agreement new staff tick on their first sign in.
 *
 * Never: show hospital data, or send people to sign in from here.
 */
import LegalPage from '@/components/legal/LegalPage'
import PrivacyText from '@/components/legal/PrivacyText'

export default function PrivacyPage() {
  return (
    <LegalPage which="privacy">
      <PrivacyText />
    </LegalPage>
  )
}
