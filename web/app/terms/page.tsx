/*
 * app/terms/page.tsx: the Terms of Use for staff, open without signing in.
 *
 * Why: request 156 (2026-11-08). Linked from the sign in page and from the
 * agreement new staff tick on their first sign in.
 *
 * Never: show hospital data, or send people to sign in from here.
 */
import LegalPage from '@/components/legal/LegalPage'
import TermsText from '@/components/legal/TermsText'

export default function TermsPage() {
  return (
    <LegalPage which="terms">
      <TermsText />
    </LegalPage>
  )
}
