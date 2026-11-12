/*
 * app/pharmacy/list/page.tsx: the Pharmacy's medicine list.
 *
 * Why: Anthony, 2026-11-11: the Pharmacy enters all the medicine and supplies
 * they have, with their strengths, so doctors and nurses pick instead of
 * typing. "Only the pharmacist edits and adds... whatever the pharmacist adds
 * becomes part of the list... the doctor can add, but it is pending the
 * pharmacist's confirmation."
 *
 * What is here, in order:
 *   1. lines doctors and nurses added, waiting for the Pharmacy to confirm;
 *   2. the starter list, to be checked once (confirm all, or one by one);
 *   3. add a medicine (or, on the Supplies tab, a supply such as a syringe or
 *      plaster), with one or more strengths or sizes;
 *   4. the whole list, searched by the first letters, each line editable or
 *      switched off (never deleted).
 *
 * Never: let anybody but the Pharmacy open this page's buttons. The database
 * refuses the writes too.
 */
'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import AppShell from '@/components/shell/AppShell'
import styles from '../_parts/pharmacy.module.css'
import {
  addMedicine,
  confirmMedicine,
  confirmStarterMedicines,
  groupMedicines,
  findMedicines,
  knownMedicines,
  loadMedicines,
  updateMedicine,
  type MedicineLine,
} from '@/lib/medicines/medicines'
import { useRightPage } from '@/lib/auth/routes'
import { useAuth } from '@/lib/auth/session'

export default function MedicineListPage() {
  const auth = useAuth()
  useRightPage(auth.status, '/pharmacy/list/')
  const { client, staff } = auth
  const [lines, setLines] = useState<MedicineLine[]>(() => knownMedicines(auth.staff?.id))
  const [search, setSearch] = useState('')
  const [problem, setProblem] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  // The add form.
  const [newName, setNewName] = useState('')
  const [newStrengths, setNewStrengths] = useState('')
  // Medicines and supplies are two lists (Anthony, 2026-11-12: "anything
  // that's not medicine should have its own list").
  const [tab, setTab] = useState<'medicine' | 'item'>('medicine')
  // One line being corrected.
  const [editing, setEditing] = useState<number | null>(null)
  const [editName, setEditName] = useState('')
  const [editStrength, setEditStrength] = useState('')

  const staffId = staff?.id
  const reload = useCallback(async () => {
    if (!client || !staffId) return
    const fresh = await loadMedicines(client, staffId)
    if (fresh) setLines(fresh)
  }, [client, staffId])

  useEffect(() => {
    if (auth.status !== 'ready') return
    const timer = window.setTimeout(reload, 0)
    return () => window.clearTimeout(timer)
  }, [auth.status, reload])

  const mine = useMemo(() => lines.filter((line) => line.kind === tab), [lines, tab])
  const pending = useMemo(
    () => mine.filter((line) => line.status === 'pending' && line.is_active),
    [mine],
  )
  const starter = useMemo(() => lines.filter((line) => line.source === 'starter'), [lines])
  const names = useMemo(() => groupMedicines(mine.filter((l) => l.status === 'standard')), [mine])
  const shown = useMemo(() => findMedicines(names, search, 60), [names, search])
  // Switched off lines, shown to the Pharmacy only, to switch back on.
  const off = useMemo(
    () => mine.filter((line) => line.status === 'standard' && !line.is_active),
    [mine],
  )

  if (auth.status !== 'ready' || !client || !staff) return null

  // ===== 1. Only the Pharmacy =====
  if (staff.role !== 'pharmacy') {
    return (
      <AppShell>
        <div className={styles.page}>
          <h2>Medicine list</h2>
          <p className={styles.muted}>Only the Pharmacy keeps the medicine list.</p>
        </div>
      </AppShell>
    )
  }

  async function run(job: () => Promise<string | null>) {
    setBusy(true)
    setProblem(null)
    const result = await job()
    if (result) setProblem(result)
    await reload()
    setBusy(false)
  }

  // ===== 2. Add one name with one or more strengths =====
  async function addNew() {
    if (!client || newName.trim().length < 2) {
      setProblem('Type the name.')
      return
    }
    const strengths = newStrengths
      .split(',')
      .map((part) => part.trim())
      .filter(Boolean)
    await run(async () => {
      for (const strength of strengths.length ? strengths : [null]) {
        const result = await addMedicine(client, newName.trim(), strength, tab)
        if (result) return result
      }
      setNewName('')
      setNewStrengths('')
      return null
    })
  }

  return (
    <AppShell>
      <div className={styles.page}>
        <h2>Medicine list</h2>
        {/* Two lists: medicines, and supplies such as syringes and plaster. */}
        <div className={styles.segments} role="group" aria-label="Which list">
          <button aria-pressed={tab === 'medicine'} onClick={() => setTab('medicine')}>
            Medicines
          </button>
          <button aria-pressed={tab === 'item'} onClick={() => setTab('item')}>
            Supplies
          </button>
        </div>
        <p className={styles.muted}>
          {tab === 'medicine'
            ? 'Doctors and nurses pick from this list instead of typing. What you add here is standard for everybody.'
            : 'Syringes, plaster and other things that are not drugs. Only the Pharmacy sees this list.'}
        </p>
        {problem ? <p className={styles.error}>{problem}</p> : null}

        {/* ----- Waiting for the Pharmacy ----- */}
        {pending.length > 0 ? (
          <div className={styles.card}>
            <div className={styles.sectionHead}>
              <b>Waiting for you to confirm ({pending.length})</b>
            </div>
            {pending.map((line) => (
              <div key={line.id} className={styles.lineRow}>
                <span>
                  <b>{line.name}</b>
                  {line.strength ? ` · ${line.strength}` : ''}
                  <br />
                  <small className={styles.muted}>
                    Added by {line.adder?.full_name ?? 'staff'}
                  </small>
                </span>
                <button
                  className={`${styles.button} ${styles.primary} ${styles.small}`}
                  disabled={busy}
                  onClick={() => run(() => confirmMedicine(client, line.id))}
                >
                  Confirm
                </button>
                <button
                  className={`${styles.button} ${styles.small}`}
                  disabled={busy}
                  onClick={() => run(() => updateMedicine(client, line.id, { is_active: false }))}
                >
                  Not needed
                </button>
              </div>
            ))}
          </div>
        ) : null}

        {/* ----- The starter list ----- */}
        {starter.length > 0 ? (
          <div className={styles.card}>
            <div className={styles.sectionHead}>
              <b>
                Starter list to check ({starter.length} {starter.length === 1 ? 'line' : 'lines'})
              </b>
            </div>
            <p className={styles.muted}>
              These usual medicines were put in to save you typing. Look through the list below,
              correct or switch off anything wrong, then confirm.
            </p>
            <div className={styles.buttons}>
              <button
                className={`${styles.button} ${styles.primary}`}
                disabled={busy}
                onClick={() => run(() => confirmStarterMedicines(client))}
              >
                Confirm the starter list
              </button>
            </div>
          </div>
        ) : null}

        {/* ----- Add ----- */}
        <div className={styles.card}>
          <div className={styles.sectionHead}>
            <b>{tab === 'medicine' ? 'Add a medicine' : 'Add a supply'}</b>
          </div>
          <div>
            <label className={styles.label} htmlFor="new-name">
              Name
            </label>
            <input
              id="new-name"
              className={styles.input}
              placeholder="e.g. Paracetamol"
              maxLength={120}
              value={newName}
              onChange={(event) => setNewName(event.target.value)}
            />
          </div>
          <div>
            <label className={styles.label} htmlFor="new-strengths">
              {tab === 'medicine'
                ? 'Strengths (separate with commas)'
                : 'Sizes (separate with commas)'}
            </label>
            <input
              id="new-strengths"
              className={styles.input}
              placeholder="e.g. 500 mg tablet, 1 g tablet"
              value={newStrengths}
              onChange={(event) => setNewStrengths(event.target.value)}
            />
          </div>
          <div className={styles.buttons}>
            <button
              className={`${styles.button} ${styles.primary}`}
              disabled={busy}
              onClick={addNew}
            >
              {busy ? 'Saving…' : 'Add to the list'}
            </button>
          </div>
        </div>

        {/* ----- The list ----- */}
        <div className={styles.card}>
          <div className={styles.sectionHead}>
            <b>The list</b>
          </div>
          <input
            className={styles.input}
            aria-label="Search the list"
            placeholder="Type the first letters"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
          {shown.length === 0 ? <p className={styles.muted}>Nothing found.</p> : null}
          {shown.map((entry) => (
            <div key={entry.name} className={styles.listName}>
              <b>{entry.name}</b>
              {entry.strengths.map((line) =>
                editing === line.id ? (
                  <div key={line.id} className={styles.lineRow}>
                    <div className={styles.editRow}>
                      <input
                        className={styles.input}
                        aria-label="Name"
                        value={editName}
                        onChange={(event) => setEditName(event.target.value)}
                      />
                      <input
                        className={styles.input}
                        aria-label="Strength"
                        value={editStrength}
                        onChange={(event) => setEditStrength(event.target.value)}
                      />
                    </div>
                    <button
                      className={`${styles.button} ${styles.primary} ${styles.small}`}
                      disabled={busy}
                      onClick={() =>
                        run(async () => {
                          const result = await updateMedicine(client, line.id, {
                            name: editName.trim(),
                            strength: editStrength.trim() || null,
                          })
                          if (!result) setEditing(null)
                          return result
                        })
                      }
                    >
                      Save
                    </button>
                    <button
                      className={`${styles.button} ${styles.small}`}
                      onClick={() => setEditing(null)}
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <div key={line.id} className={styles.lineRow}>
                    <span>{line.strength ?? 'No strength'}</span>
                    {line.source === 'starter' ? (
                      <span className={`${styles.tag} ${styles.tagWarn}`}>Starter</span>
                    ) : null}
                    {line.kind === 'item' ? <span className={styles.tag}>Supply</span> : null}
                    <button
                      className={`${styles.button} ${styles.small}`}
                      disabled={busy}
                      onClick={() => {
                        setEditing(line.id)
                        setEditName(line.name)
                        setEditStrength(line.strength ?? '')
                      }}
                    >
                      Edit
                    </button>
                    <button
                      className={`${styles.button} ${styles.small}`}
                      disabled={busy}
                      onClick={() =>
                        run(() => updateMedicine(client, line.id, { is_active: false }))
                      }
                    >
                      Switch off
                    </button>
                  </div>
                ),
              )}
            </div>
          ))}
        </div>

        {/* ----- Switched off ----- */}
        {off.length > 0 ? (
          <div className={styles.card}>
            <div className={styles.sectionHead}>
              <b>Switched off ({off.length})</b>
            </div>
            {off.map((line) => (
              <div key={line.id} className={styles.lineRow}>
                <span>
                  {line.name}
                  {line.strength ? ` · ${line.strength}` : ''}
                </span>
                <span className={`${styles.tag} ${styles.tagOff}`}>Off</span>
                <button
                  className={`${styles.button} ${styles.small}`}
                  disabled={busy}
                  onClick={() => run(() => updateMedicine(client, line.id, { is_active: true }))}
                >
                  Switch on
                </button>
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </AppShell>
  )
}
