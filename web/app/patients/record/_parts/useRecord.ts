/*
 * record/_parts/useRecord.ts: one patient's record for the full pages (the
 * treatment sheet, the vital signs sheet and the consultation page).
 *
 * Why: request 224 (2026-11-17). Those pages read the same record as the
 * record page, the same way: what this person already loaded shows at once
 * from memory; with no network, the copy kept on this device; then the
 * database, after the opening is logged (CLAUDE.md 10).
 *
 * Never: show a record before it is opened, except the device copy (whose
 * saving was logged), and note an opening from the copy for the log.
 */
'use client'

import { useCallback, useEffect, useState } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import { recall, remember } from '@/lib/cache/memory'
import { onChange } from '@/lib/live/changes'
import { noteOfflineView, readSavedRecord } from '@/lib/offline/recordCopy'
import { getPatient, type PatientResult } from '@/lib/patients/patients'
import { loadRecord, openRecord, openingIsOld, type MedicalRecord } from '@/lib/record/record'

export function useRecord(
  client: SupabaseClient | null,
  staffId: string | null,
  patientId: number | null,
  allowed: boolean,
) {
  const [patient, setPatient] = useState<PatientResult | null | undefined>(
    () => recall<PatientResult>(staffId ?? undefined, `patient:${patientId}`) ?? undefined,
  )
  const [record, setRecord] = useState<MedicalRecord | null>(() =>
    recall<MedicalRecord>(staffId ?? undefined, `record:${patientId}`),
  )
  // When the copy kept for no network is what shows: the time it was saved.
  const [savedAt, setSavedAt] = useState<number | null>(null)
  const [refused, setRefused] = useState(false)
  // Past 12 hours since opening: keep what shows, and say so (request 248).
  const [stale, setStale] = useState(false)

  // ===== 1. Open, then read =====
  useEffect(() => {
    if (!client || !patientId || !staffId || !allowed) return
    let current = true
    ;(async () => {
      let copy: Awaited<ReturnType<typeof readSavedRecord>> = null
      if (!recall(staffId, `record:${patientId}`)) {
        copy = await readSavedRecord(staffId, patientId)
        const kept = copy
        if (kept && current) {
          setPatient((now) => now ?? kept.patient)
          setRecord((now) => now ?? kept.record)
          setSavedAt(kept.savedAt)
        }
      }
      const found = await getPatient(client, patientId)
      if (!current) return
      const opened = found ? await openRecord(client, patientId) : false
      const loaded = opened ? await loadRecord(client, patientId) : null
      if (!current) return
      if (!found || !opened || !loaded) {
        if (copy) noteOfflineView(staffId, patientId)
        else if (!recall(staffId, `record:${patientId}`)) setRefused(true)
        return
      }
      remember(staffId, `patient:${patientId}`, found)
      remember(staffId, `record:${patientId}`, loaded)
      setPatient(found)
      setRecord(loaded)
      setSavedAt(null)
    })()
    return () => {
      current = false
    }
  }, [client, staffId, patientId, allowed])

  // ===== 2. Read again after a change (the opening is still fresh) =====
  const reload = useCallback(() => {
    if (!client || !patientId) return
    if (openingIsOld()) {
      setStale(true)
      return
    }
    loadRecord(client, patientId).then((loaded) => {
      if (!loaded) return
      setStale(false)
      if (staffId) remember(staffId, `record:${patientId}`, loaded)
      setRecord(loaded)
    })
  }, [client, patientId, staffId])

  const opened = record !== null
  useEffect(() => {
    if (!client || !opened) return
    return onChange(client, 'records', reload)
  }, [client, opened, reload])

  return { patient, record, savedAt, refused, stale, reload }
}
