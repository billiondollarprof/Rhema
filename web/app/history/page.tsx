/*
 * app/history/page.tsx: History, from the menu. Each person sees their part.
 *
 * Why: Anthony, 2026-11-16 (requests 215 and 216): "they want to know how
 * much they made when they were on duty... by category... by mode of
 * payment... the total paid... count the cash they have and know that it
 * matches. Then others are also able to see just numbers of how many they
 * attended to."
 *
 * What is here, in order:
 *   1. the period: Today, last 6 or 24 hours, this week, this month, or
 *      dates and times chosen;
 *   2. the Front Desk and admins: the money. The total first, then cash, POS
 *      and transfer, then each category (the card split into Individual,
 *      Family and Antenatal), then the patients registered and the payments.
 *      "Only payments I took" is on for the Front Desk: their shift's money;
 *   3. the Laboratory: tests requested, done and waiting, and how many of
 *      each test. No money;
 *   4. the Pharmacy: prescriptions dispensed, and how much of each drug.
 *      No money;
 *   5. doctors and nurses: their own work: patients they worked on, notes,
 *      readings, requests and prescriptions.
 *
 * Never: work out money here. The database answers each part, and only to
 * the people it is for.
 */
'use client'

import { HOSPITAL_TIME_ZONE } from '@/lib/time/zone'
import { useEffect, useState } from 'react'
import { recall, remember } from '@/lib/cache/memory'
import { HISTORY_KEY, type WarmHistory } from '@/lib/warm/warm'
import AppShell from '@/components/shell/AppShell'
import styles from './history.module.css'
import {
  CATEGORY_WORDS,
  MODE_WORDS,
  PATIENT_CATEGORY_WORDS,
  PERIODS,
  loadLab,
  loadShiftStart,
  loadTakers,
  loadMoney,
  loadMyWork,
  loadPharmacy,
  naira,
  periodRange,
  type LabNumbers,
  type Money,
  type MyWork,
  type PeriodKey,
  type PharmacyNumbers,
} from '@/lib/history/history'
import SearchSelect from '@/components/options/SearchSelect'
import { useRightPage } from '@/lib/auth/routes'
import { useAuth } from '@/lib/auth/session'

// "14:05" today, or "Tue 14 Nov, 14:05" another day.
function timeWords(iso: string): string {
  const at = new Date(iso)
  const today = at.toDateString() === new Date().toDateString()
  return at.toLocaleString('en-GB', {
    timeZone: HOSPITAL_TIME_ZONE,
    ...(today ? {} : { weekday: 'short', day: 'numeric', month: 'short' }),
    hour: '2-digit',
    minute: '2-digit',
  })
}

export default function HistoryPage() {
  const auth = useAuth()
  useRightPage(auth.status, '/history/')
  const { client, staff } = auth

  // The Front Desk works by shift: from their last email sign in (Anthony,
  // 2026-11-16: "they want to see from the time their own session started").
  const frontDesk = staff?.role === 'front_desk' && !staff.can_admin
  // What was chosen; until then, the shift for the Front Desk, today for others.
  const [chosen, setPeriod] = useState<PeriodKey | 'shift' | null>(null)
  const period: PeriodKey | 'shift' = chosen ?? (frontDesk ? 'shift' : 'today')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  // Loaded in the background after the app opened (request 230b): shown at
  // once for the period History opens on, then refreshed as usual.
  const warm = recall<WarmHistory>(staff?.id, HISTORY_KEY)
  const [shiftStart, setShiftStart] = useState<Date | null>(() => warm?.shiftStart ?? null)
  // An admin: everybody, or one person ("" is everybody).
  const [takenBy, setTakenBy] = useState('')
  const [takers, setTakers] = useState<{ value: string; label: string }[]>([])

  const [money, setMoney] = useState<Money | null>(() => warm?.money ?? null)
  const [lab, setLab] = useState<LabNumbers | null>(() => warm?.lab ?? null)
  const [pharmacy, setPharmacy] = useState<PharmacyNumbers | null>(() => warm?.pharmacy ?? null)
  const [work, setWork] = useState<MyWork | null>(() => warm?.work ?? null)
  const [loading, setLoading] = useState(false)

  const seesMoney = Boolean(staff && (staff.role === 'front_desk' || staff.can_admin))
  const seesLab = staff?.role === 'laboratory'
  const seesPharmacy = staff?.role === 'pharmacy'
  const seesWork = Boolean(staff?.can_medical)
  const range =
    period === 'shift'
      ? shiftStart
        ? { from: shiftStart, to: new Date() }
        : null
      : periodRange(period, from, to)

  // ===== 0. The shift start, and who takes payments (for an admin) =====
  useEffect(() => {
    if (!client || !staff) return
    let current = true
    loadShiftStart(client).then((found) => {
      if (current) setShiftStart(found ?? new Date(new Date().setHours(0, 0, 0, 0)))
    })
    if (staff.can_admin) {
      loadTakers(client).then((found) => {
        if (current) setTakers(found.map((one) => ({ value: one.id, label: one.full_name })))
      })
    }
    return () => {
      current = false
    }
  }, [client, staff])

  // ===== 1. Ask for each part this person sees =====
  useEffect(() => {
    if (!client || !staff || !range) return
    let current = true
    Promise.all([
      seesMoney
        ? loadMoney(client, range.from, range.to, false, takenBy || null)
        : Promise.resolve(null),
      seesLab ? loadLab(client, range.from, range.to) : Promise.resolve(null),
      seesPharmacy ? loadPharmacy(client, range.from, range.to) : Promise.resolve(null),
      seesWork ? loadMyWork(client, range.from, range.to) : Promise.resolve(null),
    ]).then(([m, l, p, w]) => {
      if (!current) return
      setMoney(m)
      setLab(l)
      setPharmacy(p)
      setWork(w)
      setLoading(false)
      // The period History opens on: keep it for next time (request 230b).
      if (chosen === null && !takenBy && shiftStart) {
        remember<WarmHistory>(staff.id, HISTORY_KEY, {
          shiftStart,
          money: m,
          lab: l,
          pharmacy: p,
          work: w,
        })
      }
    })
    return () => {
      current = false
    }
    // The range is rebuilt from these each render; its times are the key.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    client,
    staff,
    period,
    from,
    to,
    shiftStart,
    takenBy,
    seesMoney,
    seesLab,
    seesPharmacy,
    seesWork,
  ])

  if (auth.status !== 'ready' || !client || !staff) return null
  const cash = money?.by_mode.find((bucket) => bucket.key === 'cash')

  return (
    <AppShell>
      <div className={styles.page}>
        <h2>History</h2>

        {/* ===== 1. The period: a drop down, so nothing crowds the page ===== */}
        {frontDesk && period === 'shift' && shiftStart ? (
          <div className={styles.shiftCard}>
            <span>My shift</span>
            <b>
              Since you signed in:{' '}
              {shiftStart.toLocaleString('en-GB', {
                timeZone: HOSPITAL_TIME_ZONE,
                weekday: 'short',
                day: 'numeric',
                month: 'short',
                hour: '2-digit',
                minute: '2-digit',
              })}
            </b>
          </div>
        ) : null}
        <div className={styles.pickers}>
          <div className={styles.picker}>
            <label htmlFor="history-period">Show</label>
            <SearchSelect
              id="history-period"
              value={period}
              options={(frontDesk
                ? [
                    ['shift', 'This shift'],
                    ...PERIODS.filter(([key]) => key === 'today' || key === 'hours24'),
                  ]
                : PERIODS
              ).map(([key, words]) => ({ value: key, label: words }))}
              onChange={(next) => {
                setLoading(true)
                setPeriod(next as PeriodKey | 'shift')
              }}
            />
          </div>
          {staff.can_admin && seesMoney ? (
            <div className={styles.picker}>
              <label htmlFor="history-taken-by">Taken by</label>
              <SearchSelect
                id="history-taken-by"
                value={takenBy}
                placeholder="Everybody"
                options={[{ value: '', label: 'Everybody' }, ...takers]}
                onChange={(next) => {
                  setLoading(true)
                  setTakenBy(next)
                }}
              />
            </div>
          ) : null}
        </div>
        {period === 'custom' ? (
          <div className={styles.custom}>
            <label>
              From
              <input
                type="datetime-local"
                className={styles.input}
                value={from}
                onChange={(event) => setFrom(event.target.value)}
              />
            </label>
            <label>
              To
              <input
                type="datetime-local"
                className={styles.input}
                value={to}
                onChange={(event) => setTo(event.target.value)}
              />
            </label>
            {!range ? <small className={styles.muted}>Choose a start and an end.</small> : null}
          </div>
        ) : null}
        {range ? (
          <p className={styles.muted}>
            {range.from.toLocaleString('en-GB', {
              timeZone: HOSPITAL_TIME_ZONE,
              dateStyle: 'medium',
              timeStyle: 'short',
            })}{' '}
            to{' '}
            {range.to.toLocaleString('en-GB', {
              timeZone: HOSPITAL_TIME_ZONE,
              dateStyle: 'medium',
              timeStyle: 'short',
            })}
            {loading ? ' · loading…' : ''}
          </p>
        ) : null}

        {/* ===== 2. Money: Front Desk and admins ===== */}
        {seesMoney ? (
          <section className={styles.section}>
            <div className={styles.sectionHead}>
              <h3>
                {frontDesk
                  ? 'Money I took'
                  : takenBy
                    ? `Money taken by ${takers.find((one) => one.value === takenBy)?.label ?? 'one person'}`
                    : 'Money taken by everybody'}
              </h3>
            </div>

            <div className={styles.totalCard}>
              <span>Total</span>
              <b>{naira(money?.total ?? 0)}</b>
              <small>
                {money?.count ?? 0} payment{money?.count === 1 ? '' : 's'}
              </small>
            </div>

            <h4>By how it was paid</h4>
            <div className={`${styles.modes} ${styles.three}`}>
              {['cash', 'pos', 'transfer'].map((key) => {
                const bucket = money?.by_mode.find((one) => one.key === key)
                return (
                  <div
                    key={key}
                    className={`${styles.modeCard} ${key === 'cash' ? styles.cash : ''}`}
                  >
                    <span>{MODE_WORDS[key]}</span>
                    <b>{naira(bucket?.amount ?? 0)}</b>
                    <small>
                      {bucket?.count ?? 0} payment{bucket?.count === 1 ? '' : 's'}
                    </small>
                  </div>
                )
              })}
            </div>
            {cash ? (
              <p className={styles.hint}>
                Count the cash in hand: it should be {naira(cash.amount)}.
              </p>
            ) : null}

            <h4>By category</h4>
            {money && money.by_category.length === 0 ? (
              <p className={styles.muted}>No payments in this period.</p>
            ) : null}
            <div className={styles.rows}>
              {(money?.by_category ?? []).map((bucket) => (
                <div key={bucket.key} className={styles.row}>
                  <span className={styles.rowName}>{CATEGORY_WORDS[bucket.key] ?? bucket.key}</span>
                  <span className={styles.rowCount}>
                    {bucket.count} payment{bucket.count === 1 ? '' : 's'}
                  </span>
                  <b className={styles.rowAmount}>{naira(bucket.amount)}</b>
                  {/* Its share of the total, as a thin line under it. */}
                  <span className={styles.barTrack}>
                    <span
                      className={styles.bar}
                      style={{
                        width: `${money && money.total ? Math.max(2, (bucket.amount / money.total) * 100) : 0}%`,
                      }}
                    />
                  </span>
                </div>
              ))}
            </div>

            <h4>Patients registered ({money?.registered.length ?? 0})</h4>
            {money && money.registered.length > 0 ? (
              <>
                <div className={styles.chips}>
                  {['individual', 'family', 'antenatal'].map((key) => (
                    <span key={key} className={styles.chip}>
                      {PATIENT_CATEGORY_WORDS[key]}:{' '}
                      {money.registered.filter((one) => one.category === key).length}
                    </span>
                  ))}
                </div>
                <details className={styles.fold}>
                  <summary>See each patient registered</summary>
                  <ul className={styles.list}>
                    {money.registered.map((one) => (
                      <li key={one.patient}>
                        <span>{timeWords(one.at)}</span>
                        <b>{one.patient}</b>
                        <span>
                          {PATIENT_CATEGORY_WORDS[one.category]}
                          {one.old_file ? ' · old file' : ''}
                        </span>
                      </li>
                    ))}
                  </ul>
                </details>
              </>
            ) : (
              <p className={styles.muted}>Nobody registered in this period.</p>
            )}

            {money && money.payments.length > 0 ? (
              <details className={styles.fold}>
                <summary>See each payment ({money.payments.length})</summary>
                <ul className={styles.list}>
                  {money.payments.map((one) => (
                    <li key={one.id}>
                      <span>{timeWords(one.at)}</span>
                      <b>{naira(one.amount)}</b>
                      <span>
                        {CATEGORY_WORDS[one.category] ?? one.category} ·{' '}
                        {MODE_WORDS[one.mode] ?? one.mode} · {one.patient}
                        {!frontDesk && !takenBy && one.taken_by ? ` · ${one.taken_by}` : ''}
                      </span>
                    </li>
                  ))}
                </ul>
              </details>
            ) : null}
          </section>
        ) : null}

        {/* ===== 3. The Laboratory: numbers only ===== */}
        {seesLab ? (
          <section className={styles.section}>
            <h3>Laboratory</h3>
            <div className={`${styles.modes} ${styles.three}`}>
              <Tile label="Tests requested" value={lab?.requested} />
              <Tile label="Tests done" value={lab?.done} />
              <Tile label="Waiting now" value={lab?.waiting} />
            </div>
            <h4>How many of each test</h4>
            <CountRows
              rows={(lab?.by_test ?? []).map((one) => [one.test, `${one.count}`])}
              empty="No results in this period."
            />
          </section>
        ) : null}

        {/* ===== 4. The Pharmacy: numbers only ===== */}
        {seesPharmacy ? (
          <section className={styles.section}>
            <h3>Pharmacy</h3>
            <div className={`${styles.modes} ${styles.three}`}>
              <Tile label="Prescriptions dispensed" value={pharmacy?.dispensed} />
              <Tile label="Waiting to dispense" value={pharmacy?.waiting} />
              <Tile label="Waiting for payment" value={pharmacy?.unpaid} />
            </div>
            <h4>How much of each drug was given out</h4>
            <CountRows
              rows={(pharmacy?.by_drug ?? []).map((one) => [
                one.drug,
                one.amount
                  ? `${Number(one.amount)} ${one.unit ?? ''}`.trim()
                  : `${one.times} times`,
              ])}
              empty="Nothing dispensed in this period."
            />
          </section>
        ) : null}

        {/* ===== 5. My own work ===== */}
        {seesWork ? (
          <section className={styles.section}>
            <h3>My work</h3>
            <div className={styles.modes}>
              <Tile label="Patients I worked on" value={work?.patients} />
              <Tile
                label="Notes"
                value={(work?.counts.consultation ?? 0) + (work?.counts.nursing ?? 0)}
              />
              <Tile label="Vital signs" value={work?.counts.vitals} />
              <Tile label="Lab requests" value={work?.counts.lab} />
              <Tile label="Prescriptions" value={work?.counts.prescription} />
              <Tile label="Doses given" value={work?.counts.dose} />
            </div>
            <h4>Patients</h4>
            {work && work.list.length > 0 ? (
              <ul className={styles.list}>
                {work.list.map((one) => (
                  <li key={one.patient}>
                    <span>{timeWords(one.at)}</span>
                    <b>{one.patient}</b>
                    <span>
                      {one.times} thing{one.times === 1 ? '' : 's'} recorded
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className={styles.muted}>No work recorded in this period.</p>
            )}
          </section>
        ) : null}

        {!seesMoney && !seesLab && !seesPharmacy && !seesWork ? (
          <p className={styles.muted}>There is no history for your role yet.</p>
        ) : null}
      </div>
    </AppShell>
  )
}

// One number with its label.
function Tile({ label, value }: { label: string; value: number | undefined }) {
  return (
    <div className={styles.modeCard}>
      <span>{label}</span>
      <b>{value ?? 0}</b>
    </div>
  )
}

// A name and its number, one per line.
function CountRows({ rows, empty }: { rows: [string, string][]; empty: string }) {
  if (rows.length === 0) return <p className={styles.muted}>{empty}</p>
  return (
    <div className={styles.rows}>
      {rows.map(([name, value]) => (
        <div key={name} className={styles.row}>
          <span className={styles.rowName}>{name}</span>
          <b className={styles.rowAmount}>{value}</b>
        </div>
      ))}
    </div>
  )
}
