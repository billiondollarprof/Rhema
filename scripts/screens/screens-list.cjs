/*
 * scripts/screens/screens-list.cjs: every screen of the app, with the text
 * that shows it has loaded, and who should open it. Used by the layout
 * check (scripts/overflow-audit.cjs) and the click-through check
 * (scripts/screens/clickthrough.cjs). Add a screen here when it is built.
 *
 * Never: put a real person's details here. Made up data only.
 */
// A made up day on one record (request 217c): two medicines on the chart,
// two doses, a consultation with a plan, and vital signs. Times are hours ago.
const hoursAgo = (hours) => new Date(Date.now() - hours * 3600 * 1000).toISOString()
const NURSE = { full_name: 'Nurse Bisi Ade' }
const DOCTOR = { full_name: 'Dr Emeka Obi' }
const NOT_VOIDED = { voided_at: null, void_reason: null, voider: null }
// A made up bill (request 235, part 3): two lines, not paid yet.
const BILL_ROWS = [
  {
    id: 1,
    patient_id: 1,
    note: null,
    status: 'awaiting_payment',
    created_at: hoursAgo(1),
    created_by: 'someone-else',
    patient: { full_name: 'Adaeze Okafor', patient_number: 'RMC-000001' },
    maker: DOCTOR,
    lines: [
      { id: 1, kind: 'dressing', item: 'Wound dressing', amount: 5000 },
      { id: 2, kind: 'bed', item: 'Bed fee, 2 days', amount: 10000 },
    ],
  },
]
const RECORD_DAY = {
  'rest/v1/patient_medications': [
    {
      id: 1,
      ...NOT_VOIDED,
      medicine: 'Artemether/Lumefantrine 80/480 mg tablet',
      dose: '1 tablet',
      how_often: 'Twice daily',
      status: 'active',
      created_at: hoursAgo(14),
      author: DOCTOR,
    },
    {
      id: 2,
      ...NOT_VOIDED,
      medicine: 'Paracetamol 500 mg tablet',
      dose: '1 g',
      how_often: 'Every 8 hours',
      status: 'active',
      created_at: hoursAgo(14),
      author: DOCTOR,
    },
  ],
  'rest/v1/medications_given': [
    // A dose that was due and not given (request 219c, number 2).
    {
      id: 3,
      ...NOT_VOIDED,
      medication_id: 2,
      medicine: 'Paracetamol 500 mg tablet',
      dose: null,
      not_given_reason: 'Vomited',
      given_at: hoursAgo(1),
      note: null,
      giver: NURSE,
    },
    {
      id: 1,
      ...NOT_VOIDED,
      medication_id: 2,
      medicine: 'Paracetamol 500 mg tablet',
      dose: '1 g',
      given_at: hoursAgo(9),
      note: null,
      giver: NURSE,
    },
    {
      id: 2,
      ...NOT_VOIDED,
      medication_id: 1,
      medicine: 'Artemether/Lumefantrine 80/480 mg tablet',
      dose: '1 tablet',
      given_at: hoursAgo(2),
      note: null,
      giver: NURSE,
    },
  ],
  // A lab result with values outside the normal range (request 219c, number 3).
  'rest/v1/lab_results': [
    {
      id: 1,
      request_id: null,
      test: 'Full Blood Count',
      result:
        'HB: 10.2 g/dl (normal M 14 to 18, F 12 to 14)\nWBC: 12.5 x10³/mm³ (normal 4 to 10)\nNeutrophils: 62 % (normal 50 to 70)',
      file_key: null,
      file_name: null,
      file_type: null,
      file_size: null,
      recorded_at: hoursAgo(5),
      recorder: { full_name: 'Lab Scientist Uche' },
    },
  ],
  'rest/v1/consultation_notes': [
    {
      id: 1,
      ...NOT_VOIDED,
      title: 'Fever',
      complaint: 'Fever, headache, body pains, for 2 days',
      findings: 'Febrile, not pale, chest clear',
      assessment: 'Malaria',
      plan: 'Out-patient treatment, give medicines as charted, encourage oral fluids, review in 48 hours',
      created_at: hoursAgo(14),
      // Written by the signed in doctor, so Void shows (request 229).
      written_by: '00000000-0000-0000-0000-0000000000e1',
      signed_by: '00000000-0000-0000-0000-0000000000e1',
      author: DOCTOR,
    },
  ],
  'rest/v1/vital_signs': [
    {
      id: 1,
      ...NOT_VOIDED,
      systolic: 120,
      diastolic: 80,
      pulse: 92,
      temperature_c: 38.4,
      breathing_rate: 18,
      spo2: 98,
      weight_kg: 64,
      height_cm: 165,
      // Request 235: blood glucose and pain.
      blood_glucose: 6.8,
      glucose_unit: 'mmol/L',
      glucose_when: 'random',
      pain_score: 4,
      recorded_at: hoursAgo(14),
      recorder: NURSE,
    },
  ],
}

// The queue with an emergency and an urgent patient (request 219c, number 1).
const QUEUE_PRIORITY = {
  'rest/v1/queue_entries': [
    {
      id: 11,
      patient_id: 1,
      status: 'waiting',
      note: null,
      created_at: hoursAgo(1),
      priority: 'normal',
      room: { id: 6, name: 'Nursing Station 1', kind: 'nursing' },
      patient: { patient_number: 'RMC-000001', full_name: 'Adaeze Okafor', category: 'individual' },
    },
    {
      id: 12,
      patient_id: 2,
      status: 'waiting',
      note: null,
      created_at: hoursAgo(0.2),
      priority: 'emergency',
      room: { id: 6, name: 'Nursing Station 1', kind: 'nursing' },
      patient: { patient_number: 'RMC-000002', full_name: 'Tunde Bello', category: 'individual' },
    },
    {
      id: 13,
      patient_id: 3,
      status: 'waiting',
      note: null,
      created_at: hoursAgo(0.5),
      priority: 'urgent',
      room: { id: 6, name: 'Nursing Station 1', kind: 'nursing' },
      patient: { patient_number: 'RMC-000003', full_name: 'Ngozi Eze', category: 'family' },
    },
  ],
}
// The Pharmacy's list with a line running low and stock expiring (number 6).
const PHARMACY_ALERTS = {
  'rest/v1/stock_moves': [
    {
      id: 1,
      medicine_id: 7,
      change: 200,
      expiry_date: new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10),
      medicine: { name: 'Amoxicillin', strength: '500 mg capsule', in_stock: 150, unit: 'capsule' },
    },
  ],
  'rest/v1/medicine_list': [
    {
      id: 7,
      name: 'Amoxicillin',
      strength: '500 mg capsule',
      kind: 'medicine',
      status: 'standard',
      source: 'pharmacy',
      is_active: true,
      added_by: null,
      created_at: hoursAgo(100),
      adder: null,
      unit: 'capsule',
      in_stock: 150,
      low_level: 50,
    },
    {
      id: 8,
      name: 'Paracetamol',
      strength: '500 mg tablet',
      kind: 'medicine',
      status: 'standard',
      source: 'pharmacy',
      is_active: true,
      added_by: null,
      created_at: hoursAgo(100),
      adder: null,
      unit: 'tablet',
      in_stock: 12,
      low_level: 100,
    },
  ],
}

// ===== 1. Every screen, and the text that shows it has loaded =====
// A made up family (request 228b): one row, or the list, as asked.
const FAMILY = {
  id: 12,
  family_number: 'FAM-000012',
  name: 'James',
  phone: null,
  address: '4 Okoro Close',
  town: 'Surulere',
  lga: 'Surulere',
  state: 'Lagos',
  country: 'Nigeria',
  created_at: hoursAgo(48),
}
const oneOrAll = (row) => (req) =>
  (req.headers().accept || '').includes('vnd.pgrst.object') ? row : [row]
const FAMILY_ROWS = oneOrAll(FAMILY)
const FAMILY_PATIENT = oneOrAll({
  ...require('./mock.cjs').PATIENT,
  category: 'family',
  family_id: 12,
  family: { family_number: 'FAM-000012' },
})

// 80 made up medicine names, two strengths each (request 231).
const MANY_MEDICINES = Array.from({ length: 160 }, (_, at) => ({
  id: at + 1,
  name: `Zz Medicine ${String(Math.floor(at / 2) + 1).padStart(2, '0')}`,
  strength: at % 2 ? '500 mg tablet' : '250 mg tablet',
  kind: 'medicine',
  status: 'standard',
  source: 'pharmacy',
  is_active: true,
  in_stock: null,
  low_level: null,
  unit: null,
}))

module.exports.SCREENS = [
  { path: '/', waitFor: 'Registered today' },
  // Home is different for every role (review pass, 2026-11-02).
  { path: '/', waitFor: 'Registered today', role: 'doctor', medical: true },
  { path: '/', waitFor: 'Registered today', role: 'laboratory' },
  { path: '/', waitFor: 'Registered today', role: 'pharmacy' },
  // Request 235: the Front Desk sees the doctor's price, locked.
  {
    path: '/',
    waitFor: 'Ceftriaxone 1 g injection',
    roomId: 1,
    press: 'Take payment',
    extra: {
      'rest/v1/prescriptions': [
        {
          id: 8,
          patient_id: 1,
          note: null,
          status: 'awaiting_payment',
          prescribed_at: hoursAgo(1),
          dispensed_at: null,
          expired_at: null,
          also_sent: true,
          payment_id: null,
          patient: { full_name: 'Adaeze Okafor', patient_number: 'RMC-000001' },
          prescriber: DOCTOR,
          items: [
            {
              id: 80,
              drug: 'Ceftriaxone',
              strength: '1 g injection',
              dose: '1 g',
              how_often: 'Once daily',
              days: 3,
              quantity: '3',
              note: null,
              price: 2500,
            },
          ],
        },
      ],
    },
    mustSee: ["Doctor's price", 'Record payment · ₦2,500'],
  },
  // Request 233: the Pharmacy finds a patient's drugs to give, paid or not.
  {
    path: '/patients/?p=1',
    waitFor: 'Adaeze Okafor',
    role: 'pharmacy',
    extra: {
      'rest/v1/prescriptions': [
        {
          id: 5,
          patient_id: 1,
          note: null,
          status: 'awaiting_payment',
          prescribed_at: hoursAgo(2),
          dispensed_at: null,
          expired_at: null,
          also_sent: false,
          payment_id: null,
          patient: { full_name: 'Adaeze Okafor', patient_number: 'RMC-000001' },
          prescriber: DOCTOR,
          items: [
            {
              id: 50,
              drug: 'Paracetamol',
              strength: '500 mg tablet',
              dose: '1 g',
              how_often: 'Three times daily',
              days: 3,
              quantity: '18',
              note: null,
            },
          ],
        },
      ],
    },
    mustSee: ['Drugs to give', 'Not paid yet', 'Dispensed'],
  },
  // Request 232: an unpaid drug can still be dispensed; an unpaid test done.
  {
    path: '/',
    waitFor: 'Registered today',
    role: 'pharmacy',
    extra: {
      'rest/v1/prescriptions': [
        {
          id: 3,
          patient_id: 1,
          note: null,
          status: 'awaiting_payment',
          prescribed_at: hoursAgo(1),
          dispensed_at: null,
          expired_at: null,
          also_sent: true,
          payment_id: null,
          patient: { full_name: 'Adaeze Okafor', patient_number: 'RMC-000001' },
          prescriber: DOCTOR,
          items: [
            {
              id: 30,
              drug: 'Ceftriaxone',
              strength: '1 g injection',
              dose: '1 g',
              how_often: 'Once daily',
              days: 3,
              quantity: '3',
              note: null,
            },
          ],
        },
      ],
    },
    mustSee: ['Not paid yet', 'Dispensed'],
  },
  {
    path: '/',
    waitFor: 'Registered today',
    role: 'laboratory',
    extra: {
      'rest/v1/lab_requests': [
        {
          id: 4,
          patient_id: 1,
          tests: ['Malaria Parasite (MP)'],
          note: null,
          status: 'awaiting_payment',
          requested_at: hoursAgo(1),
          completed_at: null,
          sample_taken_at: null,
          expired_at: null,
          patient: { full_name: 'Adaeze Okafor', patient_number: 'RMC-000001' },
          requester: DOCTOR,
        },
      ],
    },
    mustSee: ['Not paid yet', 'Sample taken', 'Enter results'],
  },
  { path: '/', waitFor: 'Registered today', role: 'matron', medical: true },
  { path: '/', waitFor: 'Registered today', role: 'admin', admin: true, medical: true },
  { path: '/patients/', waitFor: 'Find patient' },
  { path: '/patients/?p=1', waitFor: 'Adaeze Okafor' },
  { path: '/patients/register/', waitFor: 'Register patient' },
  { path: '/patients/edit/?p=1', waitFor: 'Edit patient' },
  { path: '/patients/record/?p=1', waitFor: 'Current medications', medical: true },
  // Request 217c: the nurse's record (plan, chart) and the doctor's (note open).
  {
    path: '/patients/record/?p=1',
    waitFor: 'Medication chart',
    medical: true,
    role: 'nurse',
    roomId: 6,
    extra: RECORD_DAY,
  },
  {
    path: '/patients/record/?p=1',
    waitFor: 'Write a consultation',
    medical: true,
    role: 'doctor',
    roomId: 2,
    extra: RECORD_DAY,
    // Request 227: Print and Email at the top; Void on a saved note.
    // Request 235, part 3: Add a bill.
    mustSee: ['Prescribe', 'Request lab', 'Add a bill', 'Print', 'Email record', 'Void'],
  },
  // Request 228a: a drug and a lab test not paid in 72 hours, in grey.
  {
    path: '/patients/record/?p=1',
    waitFor: 'Write a consultation',
    medical: true,
    role: 'doctor',
    roomId: 2,
    press: 'Prescriptions',
    extra: {
      ...RECORD_DAY,
      'rest/v1/prescriptions': [
        {
          id: 7,
          patient_id: 1,
          note: null,
          status: 'voided',
          prescribed_at: hoursAgo(30),
          dispensed_at: null,
          expired_at: hoursAgo(6),
          also_sent: false,
          payment_id: null,
          patient: { full_name: 'Adaeze Okafor', patient_number: 'RMC-000001' },
          prescriber: DOCTOR,
          items: [
            {
              id: 1,
              drug: 'Amoxicillin',
              strength: '500 mg',
              dose: '1 capsule',
              how_often: 'Three times daily',
              days: 5,
              quantity: null,
              note: null,
            },
          ],
        },
      ],
    },
    mustSee: ['Expired, not paid'],
  },
  // Request 224: the ward's sheets and the consultation, full page.
  {
    path: '/patients/record/sheet/?p=1&s=drugs',
    waitFor: 'Save line',
    medical: true,
    role: 'nurse',
    roomId: 6,
    extra: RECORD_DAY,
    // Request 227b.
    mustSee: ['+ Add another row', 'Save line'],
  },
  {
    path: '/patients/record/sheet/?p=1&s=vitals',
    waitFor: 'Save readings',
    medical: true,
    role: 'nurse',
    roomId: 6,
    extra: RECORD_DAY,
    // Request 235: Glucose and Pain columns, and a reading in them.
    mustSee: ['Random', '4/10', 'Save readings'],
  },
  {
    path: '/patients/record/consult/?p=1',
    waitFor: 'Seen by',
    medical: true,
    role: 'doctor',
    roomId: 2,
    extra: RECORD_DAY,
    // Request 227d: Prescription and Request lab inside the note.
    mustSee: ['+ Write a prescription', '+ Request a lab test', 'Save consultation'],
  },
  // Request 170: an antenatal patient's record, with the booking and the consent.
  {
    path: '/patients/record/?p=1',
    waitFor: 'Antenatal booking',
    medical: true,
    mustSee: ['Consent for an operation'],
    extra: { 'rest/v1/patients': { ...require('./mock.cjs').PATIENT, category: 'antenatal' } },
  },
  { path: '/install/', waitFor: 'Get RHEMA on every device', mustSee: ['Back to the app'] },
  // Request 228c: the Front Desk's Take vitals, and its form.
  {
    path: '/patients/?p=1',
    waitFor: 'Adaeze Okafor',
    press: 'Take vitals',
    mustSee: ['Take vitals for Adaeze Okafor', 'Temperature °C', 'Save vital signs'],
  },
  // Request 228b: the category first; Individual opens the form.
  {
    path: '/patients/register/',
    waitFor: 'Register patient',
    press: 'Individual',
    mustSee: ['Category', 'Who are we registering?', 'Save patient'],
  },
  // Request 228b: Family opens the Family details card and Add family member.
  {
    path: '/patients/register/',
    waitFor: 'Register patient',
    press: 'Family',
    mustSee: ['Family details', 'Family name (surname)', 'Add family member'],
  },
  // Request 228b: adding to a family that exists: no card fee.
  {
    path: '/patients/register/?family=12',
    waitFor: 'Adding to family',
    extra: { 'rest/v1/families': FAMILY_ROWS },
    mustSee: ['The family card covers this member. No card fee.'],
  },
  // Request 228b: a member's page shows the family's details, and Edit.
  {
    path: '/patients/?p=1',
    waitFor: 'Adaeze Okafor',
    extra: { 'rest/v1/families': FAMILY_ROWS, 'rest/v1/patients': FAMILY_PATIENT },
    mustSee: ['Family name', 'Family address', 'Edit family details', 'Add family member'],
  },
  // Request 227g: choosing Antenatal shows the antenatal card's details.
  {
    path: '/patients/register/',
    waitFor: 'Register patient',
    press: 'Antenatal',
    mustSee: ['Antenatal details', 'Marital status', 'Occupation', 'Age'],
  },
  // Request 227k: the Front Desk sees what is waiting for payment.
  {
    path: '/patients/?p=1',
    waitFor: 'Adaeze Okafor',
    extra: {
      'rest/v1/prescriptions': [
        {
          id: 1,
          patient_id: 1,
          note: null,
          status: 'dispensed',
          prescribed_at: '2026-11-18T08:00:00Z',
          dispensed_at: null,
          also_sent: false,
          payment_id: null,
          patient: { full_name: 'Adaeze Okafor', patient_number: 'RMC-000001' },
          prescriber: { full_name: 'Dr Bello' },
          items: [
            {
              id: 10,
              drug: 'Amoxicillin',
              strength: '500 mg capsule',
              dose: null,
              how_often: null,
              days: null,
              quantity: '15',
              note: null,
            },
          ],
        },
      ],
    },
    mustSee: ['Drugs to pay for', 'Owed: already given, not paid yet.', 'Take payment'],
  },
  // Request 156: the two documents, open without signing in.
  { path: '/privacy/', waitFor: 'Your rights' },
  { path: '/terms/', waitFor: 'Your account is yours alone' },
  { path: '/lab/request/?p=1', waitFor: 'Send to', medical: true },
  // Request 233: Front Desk and Lab (the default), or Front Desk only.
  {
    path: '/lab/request/?p=1',
    waitFor: 'Send to',
    medical: true,
    mustSee: ['Front Desk and Lab', 'Front Desk only'],
  },
  { path: '/lab/result/', waitFor: 'Add a lab result' },
  // Every test, no patient (2026-11-16).
  { path: '/lab/tests/', waitFor: 'Lab test list', role: 'laboratory' },
  // Find a patient's paid tests, to correct (request 214).
  { path: '/lab/patient/', waitFor: "Find a patient's tests", role: 'laboratory' },
  { path: '/pharmacy/prescribe/?p=1', waitFor: 'Prescribe', medical: true },
  // Request 235: a price box per drug for the doctor.
  {
    path: '/pharmacy/prescribe/?p=1',
    waitFor: 'Prescribe',
    medical: true,
    role: 'doctor',
    mustSee: ['Price ₦ (optional)'],
  },
  // Request 233: Front Desk and Pharmacy (the default), or Front Desk only.
  {
    path: '/pharmacy/prescribe/?p=1',
    waitFor: 'Prescribe',
    medical: true,
    role: 'doctor',
    mustSee: ['Front Desk and Pharmacy', 'Front Desk only'],
  },
  { path: '/pharmacy/list/', waitFor: 'Medicine list', role: 'pharmacy' },
  // Request 231: every name shows (not only 60), each with Add another strength.
  {
    path: '/pharmacy/list/',
    waitFor: 'Medicine list',
    role: 'pharmacy',
    extra: { 'rest/v1/medicine_list': MANY_MEDICINES },
    mustSee: ['The list (80 medicines)', 'Zz Medicine 80', '+ Add another strength'],
  },
  // Request 219c: Running low and Expiring soon at the top.
  { path: '/pharmacy/list/', waitFor: 'Running low', role: 'pharmacy', extra: PHARMACY_ALERTS },
  // Request 219c: the queue shows emergencies first.
  {
    path: '/',
    waitFor: 'Emergency',
    role: 'nurse',
    medical: true,
    roomId: 6,
    extra: QUEUE_PRIORITY,
  },
  { path: '/patients/old-file/', waitFor: 'Register from old file' },
  // Request 228b: Family on an old file opens the Family details card.
  {
    path: '/patients/old-file/',
    waitFor: 'Register from old file',
    press: 'Family',
    mustSee: ['Family details', 'Family name (surname)', 'Add family member'],
  },
  // Request 227o: Antenatal on an old file shows the antenatal card's details.
  {
    path: '/patients/old-file/',
    waitFor: 'Register from old file',
    press: 'Antenatal',
    mustSee: ['Antenatal details', 'Marital status', 'Occupation', 'Age'],
  },
  { path: '/messages/', waitFor: 'From Front Desk' },
  { path: '/messages/?c=room:8', waitFor: 'Write the first one below' },
  { path: '/announce/', waitFor: 'Show on Home until', medical: true },
  { path: '/notifications/', waitFor: 'Notifications' },
  // History (requests 215, 216): money for the Front Desk, numbers for others.
  {
    path: '/history/',
    waitFor: 'Money I took',
    extra: {
      'rpc/my_shift_start': new Date(Date.now() - 9 * 3600 * 1000).toISOString(),
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
    waitFor: 'Money taken by everybody',
    role: 'admin',
    admin: true,
    extra: {
      'rpc/money_summary': {
        total: 46500,
        count: 9,
        by_category: [{ key: 'lab_test', count: 4, amount: 18000 }],
        by_mode: [{ key: 'cash', count: 5, amount: 21500 }],
        payments: [],
        registered: [],
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
  {
    path: '/admin/?tab=data',
    waitFor: 'This file holds every patient',
    admin: true,
    // Request 226b.
    mustSee: ['Download our data', 'Monthly copy to Google Drive', 'Connect Google Drive'],
  },
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
        // Request 236: a drug's standard price.
        { id: 4, kind: 'drug', item: 'Ceftriaxone 1 g injection', amount: 2500 },
        // Request 235, part 3: a bill line's standard price.
        { id: 5, kind: 'procedure', item: 'Bed fee per day', amount: 5000 },
      ],
    },
    mustSee: [
      'Drug prices (1)',
      'Ceftriaxone 1 g injection',
      'Procedure and bill prices (1)',
      'Bed fee per day',
    ],
  },
  // Request 241: the matron in a consulting room prescribes and bills.
  {
    path: '/patients/record/?p=1',
    waitFor: 'Write a consultation',
    medical: true,
    role: 'matron',
    roomId: 2,
    extra: RECORD_DAY,
    mustSee: ['Prescribe', 'Request lab', 'Add a bill'],
  },
  {
    path: '/pharmacy/prescribe/?p=1',
    waitFor: 'Prescribe',
    medical: true,
    role: 'matron',
    roomId: 2,
    mustSee: ['Price ₦ (optional)'],
  },
  // Request 235, part 3: Add a bill, for a doctor.
  {
    path: '/bills/add/?p=1',
    waitFor: 'Add a bill',
    medical: true,
    role: 'doctor',
    roomId: 2,
    mustSee: ['What for', 'Amount ₦', '+ Add another line', 'Send bill'],
  },
  // The Front Desk: Bills to pay on Home, and on the patient's page.
  {
    path: '/',
    waitFor: 'Bills to pay',
    extra: { 'rest/v1/bills': BILL_ROWS },
    mustSee: ['Bills to pay', 'Wound dressing', 'Take payment'],
  },
  {
    path: '/patients/?p=1',
    waitFor: 'Not paid yet',
    extra: { 'rest/v1/bills': BILL_ROWS },
    press: 'Take payment',
    mustSee: ['Bills', 'Not paid yet', "Doctor's price", 'Record payment · ₦15,000'],
  },
  // Everybody sees the bill (Anthony, 2026-11-22); only the Front Desk pays.
  {
    path: '/patients/?p=1',
    waitFor: 'Not paid yet',
    role: 'nurse',
    medical: true,
    roomId: 6,
    extra: { 'rest/v1/bills': BILL_ROWS },
    mustSee: ['Bills', 'Not paid yet', 'Wound dressing'],
  },
]
