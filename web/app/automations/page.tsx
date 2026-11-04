/*
 * app/automations/page.tsx: Automations, the messages and alerts that will
 * send themselves, shown as coming soon.
 *
 * Why: request 150 (Anthony, 2026-11-04), for showing the system to a new
 * client: "at the back of the hamburger menu, put automations there...
 * the WhatsApp messaging stuff that we are going to automate, the birthday,
 * happy birthday... put them as coming soon. So when I open it, it's
 * looking like I already have a demo for them."
 *
 * Then, when testing went back to Rhema: "the automation section, don't
 * remove it... Keep it at the menu icon there... they will see that that's
 * the next thing on the line." So it is in the menu on every build.
 *
 * Never: send anything from here. Nothing on this page is switched on yet.
 */
'use client'

import styles from './automations.module.css'
import AppShell from '@/components/shell/AppShell'
import Icon from '@/components/shell/Icon'
import { useRightPage } from '@/lib/auth/routes'
import { useAuth } from '@/lib/auth/session'

// ===== 1. What will send itself =====
type Automation = { icon: string; title: string; when: string; does: string; by: string[] }

const FOR_PATIENTS: Automation[] = [
  {
    icon: 'cake',
    title: 'Happy birthday',
    when: 'On the patient’s birthday, at 8 am',
    does: 'Sends a warm birthday message from the hospital.',
    by: ['WhatsApp', 'SMS'],
  },
  {
    icon: 'calendar',
    title: 'Appointment reminders',
    when: 'The day before, and 2 hours before',
    does: 'Reminds the patient of the date, the time and the room.',
    by: ['WhatsApp', 'SMS'],
  },
  {
    icon: 'lab',
    title: 'Lab results ready',
    when: 'As soon as the lab saves a result',
    does: 'Tells the patient the result is ready to discuss with the doctor.',
    by: ['WhatsApp'],
  },
  {
    icon: 'heart',
    title: 'Antenatal check reminders',
    when: 'When each antenatal visit is due',
    does: 'Reminds the mother of her next check, by the week of her pregnancy.',
    by: ['WhatsApp', 'SMS'],
  },
  {
    icon: 'baby',
    title: 'Child immunisation reminders',
    when: 'When each vaccine is due, by the child’s age',
    does: 'Reminds the parent which vaccine is next and when to come.',
    by: ['WhatsApp', 'SMS'],
  },
  {
    icon: 'pill',
    title: 'Medicine refill reminders',
    when: 'A few days before a prescription runs out',
    does: 'Reminds the patient to come back for a refill.',
    by: ['WhatsApp'],
  },
  {
    icon: 'msg',
    title: 'After-visit check-in',
    when: '2 days after a visit',
    does: 'Asks the patient how they are feeling. Their reply goes to the Front Desk.',
    by: ['WhatsApp'],
  },
  {
    icon: 'file',
    title: 'Receipts on WhatsApp',
    when: 'As soon as a payment is saved',
    does: 'Sends the patient their receipt.',
    by: ['WhatsApp', 'Email'],
  },
]

const FOR_THE_HOSPITAL: Automation[] = [
  {
    icon: 'chart',
    title: 'Daily summary',
    when: 'Every evening at 7 pm',
    does: 'Sends the Medical Director the patients seen, the payments and the results still waiting.',
    by: ['WhatsApp', 'Email'],
  },
  {
    icon: 'clock',
    title: 'Long waits',
    when: 'When a patient has waited more than an hour',
    does: 'Alerts the Matron, so nobody is forgotten in a queue.',
    by: ['In the app'],
  },
  {
    icon: 'bell',
    title: 'Low drug stock',
    when: 'When a drug is running low',
    does: 'Alerts the Pharmacy before it runs out.',
    by: ['In the app', 'WhatsApp'],
  },
]

export default function AutomationsPage() {
  const auth = useAuth()
  useRightPage(auth.status, '/automations/')

  if (auth.status !== 'ready') return null

  return (
    <AppShell>
      <div className={styles.page}>
        <div className={styles.head}>
          <span className={styles.headIcon}>
            <Icon name="bolt" size={22} />
          </span>
          <div>
            <h2>Automations</h2>
            <p className={styles.muted}>
              Messages and alerts that send themselves, so nobody has to remember.
            </p>
          </div>
        </div>
        <Group title="For patients" list={FOR_PATIENTS} />
        <Group title="For the hospital" list={FOR_THE_HOSPITAL} />
      </div>
    </AppShell>
  )
}

// ===== 3. One group of automations =====
function Group({ title, list }: { title: string; list: Automation[] }) {
  return (
    <section className={styles.group} aria-label={title}>
      <h3>{title}</h3>
      <div className={styles.grid}>
        {list.map((automation) => (
          <article key={automation.title} className={styles.card}>
            <div className={styles.cardTop}>
              <span className={styles.icon}>
                <Icon name={automation.icon} size={20} />
              </span>
              <b>{automation.title}</b>
              <span className={styles.soon}>Coming soon</span>
            </div>
            <dl className={styles.rule}>
              <div>
                <dt>When</dt>
                <dd>{automation.when}</dd>
              </div>
              <div>
                <dt>Then</dt>
                <dd>{automation.does}</dd>
              </div>
            </dl>
            <div className={styles.channels}>
              {automation.by.map((channel) => (
                <span key={channel} className={styles.channel}>
                  {channel}
                </span>
              ))}
            </div>
          </article>
        ))}
      </div>
    </section>
  )
}
