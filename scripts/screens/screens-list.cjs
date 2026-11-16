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
  // Every test, no patient (2026-11-16).
  { path: '/lab/tests/', waitFor: 'Lab test list', role: 'laboratory' },
  // Find a patient's paid tests, to correct (request 214).
  { path: '/lab/patient/', waitFor: "Find a patient's tests", role: 'laboratory' },
  { path: '/pharmacy/prescribe/?p=1', waitFor: 'Prescribe', medical: true },
  { path: '/pharmacy/list/', waitFor: 'Medicine list', role: 'pharmacy' },
  { path: '/patients/old-file/', waitFor: 'Register from old file' },
  { path: '/messages/', waitFor: 'From Front Desk' },
  { path: '/messages/?c=room:8', waitFor: 'Write the first one below' },
  { path: '/announce/', waitFor: 'Show on Home until', medical: true },
  { path: '/notifications/', waitFor: 'Notifications' },
  // History (requests 215, 216): money for the Front Desk, numbers for others.
  {
    path: '/history/',
    waitFor: 'Money taken',
    extra: {
      'rpc/money_summary': {
        total: 46500,
        count: 9,
        by_category: [
          { key: 'lab_test', count: 4, amount: 18000 },
          { key: 'consultation', count: 3, amount: 15000 },
          { key: 'card_antenatal', count: 1, amount: 5000 },
          { key: 'card_individual', count: 1, amount: 2000 },
          { key: 'drugs', count: 2, amount: 6500 },
        ],
        by_mode: [
          { key: 'cash', count: 5, amount: 21500 },
          { key: 'pos', count: 3, amount: 17000 },
          { key: 'transfer', count: 1, amount: 8000 },
        ],
        payments: [
          {
            id: 1,
            at: new Date().toISOString(),
            receipt: 'RCT-000009',
            patient: 'RMC-000012',
            category: 'lab_test',
            mode: 'cash',
            amount: 4500,
            taken_by: 'Chioma Eze',
          },
          {
            id: 2,
            at: new Date().toISOString(),
            receipt: 'RCT-000008',
            patient: 'RMC-000011',
            category: 'card_antenatal',
            mode: 'pos',
            amount: 5000,
            taken_by: 'Chioma Eze',
          },
        ],
        registered: [
          {
            at: new Date().toISOString(),
            patient: 'RMC-000012',
            category: 'individual',
            old_file: false,
          },
          {
            at: new Date().toISOString(),
            patient: 'RMC-000011',
            category: 'antenatal',
            old_file: false,
          },
        ],
      },
    },
  },
  {
    path: '/history/',
    waitFor: 'Pharmacy',
    role: 'pharmacy',
    extra: {
      'rpc/pharmacy_summary': {
        dispensed: 7,
        waiting: 2,
        unpaid: 1,
        by_drug: [
          { drug: 'Paracetamol 500 mg tablet', times: 4, amount: 120, unit: 'tablets' },
          {
            drug: 'Artemether and lumefantrine 80/480 mg tablet',
            times: 3,
            amount: 18,
            unit: 'tablets',
          },
        ],
      },
    },
  },
  {
    path: '/history/',
    waitFor: 'My work',
    role: 'doctor',
    medical: true,
    extra: {
      'rpc/my_summary': {
        patients: 6,
        counts: { consultation: 6, lab: 3, prescription: 4 },
        list: [{ patient: 'RMC-000012', at: new Date().toISOString(), times: 3 }],
      },
    },
  },
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
  // Settings part 1 (2026-11-16): the price list, with made up prices.
  {
    path: '/admin/?tab=prices',
    waitFor: 'Lab test prices',
    admin: true,
    extra: {
      'rest/v1/price_list': [
        { id: 1, kind: 'card', item: 'Registration card', amount: 2000 },
        { id: 2, kind: 'lab_test', item: 'Full Blood Count', amount: 3500 },
        { id: 3, kind: 'lab_test', item: 'Malaria test', amount: 1500 },
      ],
    },
  },
]
