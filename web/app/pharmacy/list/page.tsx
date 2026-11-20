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
 *      switched off (never deleted). Every name shows, not only the first
 *      60, and each name has Add another strength (Add another size for a
 *      supply) (request 231, 2026-11-20: "cimetidine might have 400
 *      milligram, 200 milligram... add another strength").
 *
 * At the top (request 219c, 2026-11-17): Running low (counted lines at or
 * below their warning level) and Expiring soon (new stock that expires
 * within 90 days). Tapping one opens that medicine's stock. New stock can
 * carry its expiry date.
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
  loadExpiring,
  loadMedicines,
  moveStock,
  setStockSettings,
  stockWords,
  updateMedicine,
  type ExpiringBatch,
  type MedicineLine,
} from '@/lib/medicines/medicines'
import SearchSelect from '@/components/options/SearchSelect'
import type { SupabaseClient } from '@supabase/supabase-js'
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
  // The line whose stock is open (request 214).
  const [stockFor, setStockFor] = useState<number | null>(null)
  // The name getting another strength or size (request 231), and what is typed.
  const [addingTo, setAddingTo] = useState<string | null>(null)
  const [moreStrength, setMoreStrength] = useState('')

  // Stock that expires within 90 days (request 219c).
  const [expiring, setExpiring] = useState<ExpiringBatch[]>([])

  const staffId = staff?.id
  const reload = useCallback(async () => {
    if (!client || !staffId) return
    const [fresh, soon] = await Promise.all([loadMedicines(client, staffId), loadExpiring(client)])
    if (fresh) setLines(fresh)
    setExpiring(soon)
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
  // Counted lines at or below their warning level (request 219c, number 6).
  const low = useMemo(
    () =>
      lines.filter(
        (line) =>
          line.is_active &&
          line.in_stock !== null &&
          line.low_level !== null &&
          Number(line.in_stock) <= Number(line.low_level),
      ),
    [lines],
  )
  const names = useMemo(() => groupMedicines(mine.filter((l) => l.status === 'standard')), [mine])
  // Every name, not only the first 60 (request 231: "I want the pharmacist
  // to be able to see the list of all the medicine that has been added").
  const shown = useMemo(() => findMedicines(names, search, names.length), [names, search])
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

        {/* ----- Running low and expiring soon (request 219c, number 6) ----- */}
        {low.length > 0 ? (
          <div className={`${styles.card} ${styles.alertCard}`}>
            <div className={styles.sectionHead}>
              <b>Running low ({low.length})</b>
            </div>
            {low.map((line) => (
              <button
                key={line.id}
                type="button"
                className={styles.alertRow}
                onClick={() => {
                  setTab(line.kind)
                  setSearch(line.name)
                  setStockFor(line.id)
                }}
              >
                <span>
                  <b>{line.name}</b>
                  {line.strength ? ` · ${line.strength}` : ''}
                </span>
                <small>
                  {stockWords(line)}, warning at {Number(line.low_level)}
                </small>
              </button>
            ))}
          </div>
        ) : null}
        {expiring.length > 0 ? (
          <div className={`${styles.card} ${styles.alertCard}`}>
            <div className={styles.sectionHead}>
              <b>Expiring soon ({expiring.length})</b>
            </div>
            <p className={styles.muted}>
              Stock that expires within 90 days. Check the shelf, and use Correct the count with
              Expired for any that has gone off.
            </p>
            {expiring.map((batch) => {
              const past = batch.expiry_date < new Date().toISOString().slice(0, 10)
              return (
                <button
                  key={batch.id}
                  type="button"
                  className={styles.alertRow}
                  onClick={() => {
                    setSearch(batch.medicine?.name ?? '')
                    setStockFor(batch.medicine_id)
                  }}
                >
                  <span>
                    <b>{batch.medicine?.name ?? 'Medicine'}</b>
                    {batch.medicine?.strength ? ` · ${batch.medicine.strength}` : ''}
                  </span>
                  <small className={past ? styles.expired : undefined}>
                    {past ? 'Expired' : 'Expires'}{' '}
                    {new Date(batch.expiry_date).toLocaleDateString('en-GB', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                    })}{' '}
                    · {Number(batch.change)} added
                  </small>
                </button>
              )
            })}
          </div>
        ) : null}

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
            <b>
              The list ({names.length} {tab === 'medicine' ? 'medicines' : 'supplies'})
            </b>
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
                    {/* Stock (request 214): how many are left, or not counted. */}
                    <span
                      className={`${styles.tag} ${
                        line.in_stock !== null &&
                        Number(line.in_stock) <= Number(line.low_level ?? 0)
                          ? styles.tagWarn
                          : ''
                      }`}
                    >
                      {stockWords(line) ?? 'Stock not counted'}
                    </span>
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
                    <button
                      className={`${styles.button} ${styles.small}`}
                      disabled={busy}
                      onClick={() => setStockFor(stockFor === line.id ? null : line.id)}
                    >
                      Stock
                    </button>
                    {stockFor === line.id ? (
                      <StockEditor
                        client={client}
                        line={line}
                        onDone={async () => {
                          setStockFor(null)
                          await reload()
                        }}
                      />
                    ) : null}
                  </div>
                ),
              )}
              {/* ----- Another strength or size for this name (request 231) ----- */}
              {addingTo === entry.name ? (
                <div className={styles.lineRow}>
                  <input
                    className={styles.input}
                    aria-label={`New ${tab === 'medicine' ? 'strength' : 'size'} for ${entry.name}`}
                    placeholder={tab === 'medicine' ? 'e.g. 800 mg tablet' : 'e.g. 3 ml'}
                    maxLength={60}
                    autoFocus
                    value={moreStrength}
                    onChange={(event) => setMoreStrength(event.target.value)}
                  />
                  <button
                    className={`${styles.button} ${styles.primary} ${styles.small}`}
                    disabled={busy || !moreStrength.trim()}
                    onClick={() =>
                      run(async () => {
                        const result = await addMedicine(
                          client,
                          entry.name,
                          moreStrength.trim(),
                          tab,
                        )
                        if (!result) {
                          setAddingTo(null)
                          setMoreStrength('')
                        }
                        return result
                      })
                    }
                  >
                    Save
                  </button>
                  <button
                    className={`${styles.button} ${styles.small}`}
                    onClick={() => {
                      setAddingTo(null)
                      setMoreStrength('')
                    }}
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  className={`${styles.button} ${styles.small} ${styles.addMore}`}
                  disabled={busy}
                  onClick={() => {
                    setAddingTo(entry.name)
                    setMoreStrength('')
                  }}
                >
                  {tab === 'medicine' ? '+ Add another strength' : '+ Add another size'}
                </button>
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

// ===== Stock for one line (request 214, 2026-11-16) =====
// The unit it is sold in, the level that warns, and the count: add new stock,
// or correct the count (recount, expired, damaged). Every change is kept.
const UNITS = [
  'tablet',
  'capsule',
  'sachet',
  'bottle',
  'vial',
  'ampoule',
  'tube',
  'pack',
  'strip',
  'piece',
  'bag',
]

function StockEditor({
  client,
  line,
  onDone,
}: {
  client: SupabaseClient
  line: MedicineLine
  onDone: () => Promise<void>
}) {
  const [unit, setUnit] = useState(line.unit ?? '')
  const [low, setLow] = useState(line.low_level !== null ? String(line.low_level) : '')
  const [added, setAdded] = useState('')
  // The new stock's expiry date (request 219c); optional.
  const [expires, setExpires] = useState('')
  const [count, setCount] = useState('')
  const [why, setWhy] = useState('correction')
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)
  const now = line.in_stock !== null ? Number(line.in_stock) : null

  async function act(job: () => Promise<string | null>) {
    setBusy(true)
    setProblem(null)
    const answer = await job()
    setBusy(false)
    if (answer) setProblem(answer)
    else await onDone()
  }

  return (
    <div className={styles.stockBox}>
      <b>
        Stock of {line.name} {line.strength ?? ''}:{' '}
        {now === null ? 'not counted yet' : `${now} ${line.unit ?? ''}`}
      </b>
      <div className={styles.stockGrid}>
        <div>
          <label htmlFor={`unit-${line.id}`}>Sold as</label>
          <SearchSelect
            id={`unit-${line.id}`}
            value={unit}
            placeholder="Choose the unit"
            options={UNITS.map((word) => ({ value: word, label: word }))}
            onChange={setUnit}
            onOther={(typed) => typed && setUnit(typed)}
          />
        </div>
        <div>
          <label htmlFor={`low-${line.id}`}>Warn me below</label>
          <input
            id={`low-${line.id}`}
            className={styles.input}
            inputMode="decimal"
            placeholder="e.g. 20"
            value={low}
            onChange={(event) => setLow(event.target.value.replace(/[^\d.]/g, ''))}
          />
        </div>
      </div>
      <button
        className={`${styles.button} ${styles.small}`}
        disabled={busy}
        onClick={() =>
          act(() => setStockSettings(client, line.id, unit, low === '' ? null : Number(low)))
        }
      >
        Save unit and warning
      </button>

      <div className={styles.stockGrid}>
        <div>
          <label htmlFor={`add-${line.id}`}>New stock arrived</label>
          <input
            id={`add-${line.id}`}
            className={styles.input}
            inputMode="decimal"
            placeholder="e.g. 200"
            value={added}
            onChange={(event) => setAdded(event.target.value.replace(/[^\d.]/g, ''))}
          />
        </div>
        <div>
          <label htmlFor={`expires-${line.id}`}>Expiry date (optional)</label>
          <input
            id={`expires-${line.id}`}
            className={styles.input}
            type="date"
            value={expires}
            onChange={(event) => setExpires(event.target.value)}
          />
        </div>
        <button
          className={`${styles.button} ${styles.small}`}
          disabled={busy || !(Number(added) > 0)}
          onClick={() =>
            act(() => moveStock(client, line.id, Number(added), 'restock', null, expires || null))
          }
        >
          Add to stock
        </button>
      </div>

      <div className={styles.stockGrid}>
        <div>
          <label htmlFor={`count-${line.id}`}>Correct the count to</label>
          <input
            id={`count-${line.id}`}
            className={styles.input}
            inputMode="decimal"
            placeholder={now === null ? 'e.g. 150' : String(now)}
            value={count}
            onChange={(event) => setCount(event.target.value.replace(/[^\d.]/g, ''))}
          />
        </div>
        <div>
          <label htmlFor={`why-${line.id}`}>Why</label>
          <select
            id={`why-${line.id}`}
            className={styles.input}
            value={why}
            onChange={(event) => setWhy(event.target.value)}
          >
            <option value="correction">Recount</option>
            <option value="expired">Expired</option>
            <option value="damaged">Damaged</option>
          </select>
        </div>
        <button
          className={`${styles.button} ${styles.small}`}
          disabled={busy || count === '' || Number(count) === (now ?? 0)}
          onClick={() =>
            act(() => moveStock(client, line.id, Number(count) - (now ?? 0), why, null))
          }
        >
          Correct the count
        </button>
      </div>
      {problem ? <p className={styles.error}>{problem}</p> : null}
    </div>
  )
}
