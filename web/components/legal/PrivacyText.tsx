/*
 * components/legal/PrivacyText.tsx: the words of the Privacy Policy.
 *
 * Why: Anthony, 2026-11-08 (request 156): "a standard privacy protection
 * section... it will include the Nigeria Data Protection Act, everything
 * that I needed." The layout follows the policy StellaXafe wrote for Amara
 * (numbered sections, who we are, what is kept, why, rights).
 *
 * Every line here must be true of the system as built. When the system
 * changes what it keeps, where, or for how long, this text changes in the
 * same commit, and LEGAL_UPDATED moves.
 *
 * Anthony, 2026-11-08: "Our backend services should be confidential." So
 * the page never names the providers (the database, hosting, email or
 * monitoring companies) or where they are. The list lives with the
 * hospital (CURRENT.md, NDPA papers), for the regulator.
 *
 * Never: promise something the system does not do, or name a person,
 * a patient, a key, or a provider.
 */
import { BRAND } from '@/lib/brand/brand'

// 10 November: a doctor or nurse can email a patient their medical record,
// to the email the patient gave (request 174). Section 6 says so. This is a
// new promise to patients, not a new term for staff, so LEGAL_VERSION stays
// and staff are not asked to agree again.
// The dates shown at the top of both documents.
export const LEGAL_EFFECTIVE = '9 November 2026'
// 9 November: the providers are no longer named (his decision below). The
// promises did not change, so LEGAL_VERSION stays and nobody re-agrees.
export const LEGAL_UPDATED = '10 November 2026'
// Saved with each staff agreement, so we know which words they agreed to.
export const LEGAL_VERSION = '2026-11-08'

export default function PrivacyText() {
  return (
    <>
      <h2>1. Who we are</h2>
      <p>
        {BRAND.name} ({BRAND.address}) runs this system to care for its patients. Under the Nigeria
        Data Protection Act 2023 (the Act), the hospital is the <b>data controller</b>: it decides
        what is kept and why, and it answers for it.
      </p>
      <p>
        StellaXafe Technologies Limited, registered in Nigeria with the Corporate Affairs
        Commission, built the system and looks after it for the hospital. StellaXafe is a{' '}
        <b>data processor</b>: it works only on the hospital&apos;s instructions and never uses the
        information for itself.
      </p>
      <p>
        This policy explains what the system keeps about patients and staff, why, who can see it,
        how long it is kept, and the rights every person has.
      </p>

      <h2>2. What we keep about patients</h2>
      <ul>
        <li>
          <b>Who you are:</b> name, patient number, date of birth, sex, phone, email, address, and
          your next of kin.
        </li>
        <li>
          <b>Your care:</b> visits, vital signs, conditions, allergies, consultation notes,
          antenatal visits, nursing notes, medicines given, prescriptions, lab requests and results,
          appointments, admissions, and files added to your record (such as scans and old paper
          files).
        </li>
        <li>
          <b>Payments:</b> what was paid, for what, and how (cash, POS or transfer).
        </li>
      </ul>
      <p>
        Health information is <b>sensitive personal data</b> under the Act. It is kept only to give
        you care and is protected more strictly than anything else in the system.
      </p>

      <h2>3. What we keep about staff</h2>
      <ul>
        <li>Name, work email, role, room, and what each person is allowed to do.</li>
        <li>
          The PIN is never stored. Only a scrambled fingerprint of it is kept, which cannot be
          turned back into the PIN.
        </li>
        <li>
          Sign in and sign out times, and a log of what each person did (for example, who opened
          which record).
        </li>
        <li>Messages between staff, and the devices that receive call alerts.</li>
      </ul>

      <h2>4. Why we keep it, and on what lawful basis</h2>
      <table>
        <thead>
          <tr>
            <th>Purpose</th>
            <th>Lawful basis under the Act</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Diagnosing, treating and caring for patients</td>
            <td>Medical care by health workers bound to keep it confidential; vital interests</td>
          </tr>
          <tr>
            <td>Billing and receipts</td>
            <td>The agreement between you and the hospital</td>
          </tr>
          <tr>
            <td>Keeping medical and financial records the law requires</td>
            <td>Legal obligation</td>
          </tr>
          <tr>
            <td>Staff accounts, the activity log and security</td>
            <td>The hospital&apos;s legitimate interest in keeping records safe</td>
          </tr>
        </tbody>
      </table>
      <p>
        We do not sell, rent or share information for advertising. The system has no adverts and no
        tracking, and it does not build profiles of anybody.
      </p>

      <h2>5. Who can see it</h2>
      <ul>
        <li>
          Only staff the hospital has invited can sign in, each with their own email code and their
          own PIN.
        </li>
        <li>
          Each person sees only what their job needs. The medical record opens only for staff with
          medical record access, and every time a record is opened, it is written in the activity
          log. The laboratory sees lab requests, not the medical history.
        </li>
        <li>These rules are enforced inside the database itself, not only on the screen.</li>
        <li>
          StellaXafe staff may reach the system only to keep it working or to fix a fault, and only
          for that.
        </li>
      </ul>

      <h2>6. Where it is stored</h2>
      <ul>
        <li>
          The records are held by established cloud service providers that StellaXafe chose for
          their security. Each one works under a written agreement and may use the information only
          to provide its service.
        </li>
        <li>
          The email service that sends sign in codes and staff invitations receives no medical
          information for them.
        </li>
        <li>
          The same email service carries a patient&apos;s medical record or receipt only when a
          doctor, nurse or the front desk sends it, and only because the patient gave us their email
          address. It goes to that address and no other, and every send is written in the activity
          log. Once it is in the patient&apos;s inbox, keeping it private is up to the patient.
        </li>
        <li>
          A copy of the database is made every night, locked with a passphrase, and stored
          separately, so the records survive a fault.
        </li>
        <li>The service that checks the app is answering receives no personal information.</li>
      </ul>
      <p>
        Some of this storage may be outside Nigeria. Information leaves Nigeria only to places and
        providers with strong data protection rules, and only as the Act allows. The hospital keeps
        the list of providers and where they store information, and gives it to the Nigeria Data
        Protection Commission when asked.
      </p>

      <h2>7. How long we keep it</h2>
      <ul>
        <li>
          Medical and payment records are kept for as long as Nigerian law and medical practice
          rules require the hospital to keep them.
        </li>
        <li>Messages between staff are deleted after one year.</li>
        <li>Nightly copies of the database are deleted after 35 days.</li>
        <li>
          When a staff member leaves, their account is switched off. What they recorded stays, with
          their name on it, because medical records must show who did what.
        </li>
      </ul>

      <h2>8. How we protect it</h2>
      <ul>
        <li>
          Everything travels encrypted (https), and the providers encrypt it where it is stored.
        </li>
        <li>
          Sign in codes work for 10 minutes. Invitations run out after 72 hours. Five wrong PINs
          lock the account.
        </li>
        <li>The screen locks when it is left, and each person signs out at the end of a shift.</li>
        <li>The activity log records who opened and changed records.</li>
        <li>The nightly copies are checked every night to make sure they can be opened.</li>
      </ul>

      <h2>9. Your rights</h2>
      <p>Under the Act, every patient and every member of staff can ask the hospital to:</p>
      <ul>
        <li>tell them what is kept about them, and give them a copy;</li>
        <li>correct anything that is wrong;</li>
        <li>
          delete or stop using information, where the law allows (medical records the law requires
          the hospital to keep cannot be deleted early);
        </li>
        <li>give their information to them, or to another hospital, in a usable form;</li>
        <li>object to a use of their information, or withdraw a consent they gave.</li>
      </ul>
      <p>
        To ask, speak to the front desk or email <b>info@rhemamedical.app</b>. The hospital answers
        within the time the Act allows. If you are not satisfied, you can complain to the Nigeria
        Data Protection Commission (NDPC).
      </p>

      <h2>10. If something goes wrong</h2>
      <p>
        If personal information is lost, stolen or seen by somebody who should not see it, the
        hospital tells the Nigeria Data Protection Commission within 72 hours, as the Act requires,
        and tells the people affected when there is a high risk to them. StellaXafe tells the
        hospital straight away when it finds such a problem.
      </p>

      <h2>11. Children</h2>
      <p>
        A child&apos;s record is kept the same way, and their rights are used by a parent or
        guardian.
      </p>

      <h2>12. Changes to this policy</h2>
      <p>When this policy changes, the date at the top of this page changes.</p>
    </>
  )
}
