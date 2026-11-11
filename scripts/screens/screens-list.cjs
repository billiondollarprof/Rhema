/*
 * scripts/screens/screens-list.cjs: every screen of the app, with the text
 * that shows it has loaded, and who should open it. Used by the layout
 * check (scripts/overflow-audit.cjs) and the click-through check
 * (scripts/screens/clickthrough.cjs). Add a screen here when it is built.
 *
 * Never: put a real person's details here. Made up data only.
 */
// ===== 1. Every screen, and the text that shows it has loaded =====
module.exports.SCREENS = [
  { path: '/', waitFor: 'Registered today' },
  // Home is different for every role (review pass, 2026-11-02).
  { path: '/', waitFor: 'Registered today', role: 'doctor', medical: true },
  { path: '/', waitFor: 'Registered today', role: 'laboratory' },
  { path: '/', waitFor: 'Registered today', role: 'pharmacy' },
  { path: '/', waitFor: 'Registered today', role: 'matron', medical: true },
  { path: '/', waitFor: 'Registered today', role: 'admin', admin: true, medical: true },
  { path: '/patients/', waitFor: 'Find patient' },
  { path: '/patients/?p=1', waitFor: 'Adaeze Okafor' },
  { path: '/patients/register/', waitFor: 'Register patient' },
  { path: '/patients/edit/?p=1', waitFor: 'Edit patient' },
  { path: '/patients/record/?p=1', waitFor: 'Current medications', medical: true },
  // Request 170: an antenatal patient's record, with the booking and the consent.
  {
    path: '/patients/record/?p=1',
    waitFor: 'Antenatal booking',
    medical: true,
    extra: { 'rest/v1/patients': { ...require('./mock.cjs').PATIENT, category: 'antenatal' } },
  },
  { path: '/install/', waitFor: 'Get RHEMA on every device' },
  // Request 156: the two documents, open without signing in.
  { path: '/privacy/', waitFor: 'Your rights' },
  { path: '/terms/', waitFor: 'Your account is yours alone' },
  { path: '/lab/request/?p=1', waitFor: 'Send to', medical: true },
  { path: '/lab/result/', waitFor: 'Add a lab result' },
  { path: '/pharmacy/prescribe/?p=1', waitFor: 'Prescribe', medical: true },
  { path: '/pharmacy/list/', waitFor: 'Medicine list', role: 'pharmacy' },
  { path: '/patients/old-file/', waitFor: 'Register from old file' },
  { path: '/messages/', waitFor: 'From Front Desk' },
  { path: '/messages/?c=room:8', waitFor: 'Write the first one below' },
  { path: '/announce/', waitFor: 'Show on Home until', medical: true },
  { path: '/notifications/', waitFor: 'Notifications' },
  { path: '/automations/', waitFor: 'Happy birthday' },
  {
    path: '/payments/receipt/?id=1',
    waitFor: 'RHEMA MEDICAL CENTRE',
    extra: {
      'rest/v1/payments': {
        id: 1,
        receipt_number: 'RCT-000001',
        amount: 46500,
        purpose: 'other',
        mode: 'cash',
        received_at: '2026-11-02T10:00:00Z',
        voided_at: null,
        receiver: { full_name: 'Chioma Eze' },
        patient: {
          id: 1,
          full_name: 'Oluwaseyifunmi Chukwuemeka-Adebayo Okonkwo',
          patient_number: 'RMC-000001',
          // The Send to email button shows only with an email (request 159).
          email: 'made.up@example.com',
        },
        lines: [
          { label: 'Admission and overnight observation in the female ward', amount: 45000 },
          { label: 'Card', amount: 1500 },
        ],
      },
    },
  },
  { path: '/admin/', waitFor: 'Tap a name', admin: true },
  { path: '/admin/?tab=invite', waitFor: 'Invite a new staff member', admin: true },
  { path: '/admin/?tab=rooms', waitFor: 'Add a room', admin: true },
  { path: '/admin/?tab=activity', waitFor: 'activities today', admin: true },
]
