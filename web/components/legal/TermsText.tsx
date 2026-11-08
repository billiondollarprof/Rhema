/*
 * components/legal/TermsText.tsx: the words of the Terms of Use, for staff.
 *
 * Why: Anthony, 2026-11-08 (request 156): "terms and agreement... so they
 * are agreeing to protect patients' information, you know, all those
 * standard practice." Every invited staff member agrees to these the
 * first time they sign in.
 *
 * Never: promise something the system does not do. Keep it in step with
 * PrivacyText.tsx.
 */
import Link from 'next/link'
import { BRAND } from '@/lib/brand/brand'

export default function TermsText() {
  return (
    <>
      <h2>1. Agreeing to these terms</h2>
      <p>
        These terms are for every member of staff who uses the {BRAND.name} system. You agree to
        them the first time you sign in. If you do not agree, do not use the system, and tell the
        hospital&apos;s admin.
      </p>
      <p>
        The system belongs to the hospital&apos;s work. StellaXafe Technologies Limited built it and
        looks after it for the hospital.
      </p>

      <h2>2. Your account is yours alone</h2>
      <ul>
        <li>Only staff the hospital has invited may use the system.</li>
        <li>
          Sign in with your own work email and your own PIN. Never share your PIN, and never use
          somebody else&apos;s account. Everything done under your PIN carries your name.
        </li>
        <li>
          Lock the screen when you leave the device, and sign out at the end of your shift, so the
          next person signs in as themselves.
        </li>
        <li>If you think somebody knows your PIN, tell the admin straight away.</li>
      </ul>

      <h2>3. Patient information is confidential</h2>
      <ul>
        <li>Look at a patient&apos;s information only when your work for that patient needs it.</li>
        <li>
          Never copy, photograph, screenshot, print or send patient information outside the system
          (for example on WhatsApp or social media), unless the patient&apos;s care requires it and
          the hospital allows it.
        </li>
        <li>
          Never talk about a patient where others can hear, or with people not caring for them.
        </li>
        <li>This duty continues after you leave the hospital.</li>
      </ul>

      <h2>4. Keep records true</h2>
      <ul>
        <li>Record only what really happened, at the time it happened, under your own name.</li>
        <li>
          Never delete or hide a mistake. Correct it in the way the system allows, so the record
          shows what was changed and by whom.
        </li>
      </ul>

      <h2>5. Everything is logged</h2>
      <p>
        The system writes down who signed in, who opened which record and who changed what. The
        hospital may review this log at any time, to protect patients.
      </p>

      <h2>6. Your devices</h2>
      <ul>
        <li>Keep a screen lock on any phone or computer you use for the system.</li>
        <li>Do not use the system on a device other people can open without you.</li>
        <li>If a device with the system on it is lost or stolen, tell the admin at once.</li>
      </ul>

      <h2>7. Report problems at once</h2>
      <p>
        If you see patient information where it should not be, or think somebody has seen what they
        should not, tell the admin the same day. The hospital must report some of these events to
        the Nigeria Data Protection Commission within 72 hours.
      </p>

      <h2>8. Misuse</h2>
      <p>
        Breaking these terms can lead to your account being switched off and to the hospital&apos;s
        own disciplinary steps. Misusing personal information can also be an offence under the
        Nigeria Data Protection Act 2023.
      </p>

      <h2>9. Availability</h2>
      <p>
        The system can be unavailable at times, for example when the internet is down. When it is,
        follow the hospital&apos;s paper process and enter the records once it is back.
      </p>

      <h2>10. Privacy</h2>
      <p>
        How the system keeps and protects information is explained in the{' '}
        <Link href="/privacy/">Privacy Policy</Link>.
      </p>

      <h2>11. Changes to these terms</h2>
      <p>
        When these terms change, the date at the top changes, and you may be asked to agree again.
      </p>
    </>
  )
}
