/*
 * lib/record/signers.ts: the routes and the ward's own events, as on the
 * hospital's paper sheets. (Who signs is always the person signed in:
 * request 225, so there is no list of names to pick from.)
 *
 * Why: the ward's treatment sheet (request 224, 2026-11-17): Time, Name of
 * drugs, Dosage, Route, Sign, with events such as "Blood connected" written
 * in red. The name pickers once here were removed when Anthony asked that
 * the person signed in signs every line (request 225).
 *
 * Never: hold a list of people to sign as.
 */

// ===== 1. Routes, and the ward's events =====
export const ROUTES = [
  'IV',
  'IM',
  'Oral',
  'SC',
  'Infusion',
  'PR',
  'PV',
  'Sublingual',
  'Topical',
  'Inhaled',
  'Eye drops',
  'Ear drops',
]

// Written in red on the paper sheet; one tap each here.
export const WARD_EVENTS = [
  'Blood connected',
  'Blood finished',
  'Blood disconnected',
  'IV fluid started',
  'IV fluid finished',
]
