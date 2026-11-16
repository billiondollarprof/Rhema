/*
 * lib/lab/catalogue.ts: every lab test the Laboratory does, by section, with
 * the boxes the Laboratory fills in for each one.
 *
 * Why: Anthony, 2026-11-16. First (request 196a) a standard menu from
 * general knowledge, "later when I bring the list, check if anyone is
 * missing... rewrite it the way our list is." Then (request 202) he sent the
 * Laboratory's own past reports. This file now follows that list: the
 * Laboratory's tests, its own order of fields, its units (mg/dl for the
 * chemistry) and its normal ranges, and its own result words (for example
 * "Trophozoites of P. falciparum seen (+)" and "Non reactive for HIV 1 & 2").
 * Tests the reports did not show are kept further down each section, so a
 * test the Laboratory adds later is already there.
 *
 * How it is used:
 *   - Request lab: the Laboratory's most asked tests are one tap away
 *     (COMMON_LAB_TESTS); every other test is in one drop down with a search
 *     box. A test that is not here is typed with Other.
 *   - Enter results: a test found here shows its own boxes (a number with
 *     its unit and normal range, or a pick such as Negative or +, always with
 *     Other to type something else). What is filled in is written as plain
 *     lines of text, which is what the record already shows. A test not found
 *     here keeps the one free text box.
 *
 * Never: decide a diagnosis, or mark a value as good or bad. It only writes
 * what the Laboratory entered, with the unit and the normal range beside it.
 * Never: put anything about a real patient in this file.
 */

// ===== 1. Shapes =====
// A box for one value. A number has a unit; a pick has choices; anything
// else is a short line of text. A heading starts a group of boxes, such as
// "Sensitivity" or "Urinalysis", on the screen and in the result.
export type LabField = {
  name: string
  unit?: string
  range?: string
  choices?: string[]
  heading?: string
}

export type LabTest = {
  name: string
  // Other names people search by, such as FBC or E/U/Cr, and old names.
  also?: string[]
  fields: LabField[]
}

export type LabSection = {
  name: string
  tests: LabTest[]
}

// ===== 2. Words the Laboratory uses on many reports =====
const POS_NEG = ['Negative', 'Positive']
const PREGNANCY = ['Negative', 'Positive', 'Faintly positive']
const HIV = [
  'Non reactive for HIV 1 & 2',
  'Reactive for HIV 1',
  'Reactive for HIV 2',
  'Reactive for HIV 1 & 2',
]
const REACTIVE = ['Non reactive', 'Reactive']
const BLOOD_GROUPS = [
  'A Rh D positive',
  'A Rh D negative',
  'B Rh D positive',
  'B Rh D negative',
  'AB Rh D positive',
  'AB Rh D negative',
  'O Rh D positive',
  'O Rh D negative',
]
const GENOTYPES = ['AA', 'AS', 'AC', 'SS', 'SC', 'CC']
const MALARIA = [
  'No malaria parasite seen',
  'Trophozoites of P. falciparum seen (+)',
  'Trophozoites of P. falciparum seen (++)',
  'Trophozoites of P. falciparum seen (+++)',
  'Trophozoites of P. falciparum seen (++++)',
]
const DIPSTICK = ['Nil', 'Negative', 'Trace', 'Small', '+', '++', '+++', '++++']
const PER_HPF = ['Nil', '0-1/hpf', '1-2/hpf', '2-3/hpf', '3-4/hpf', '4-5/hpf', '5-10/hpf', 'Many']
const AMOUNT = ['Nil', '+', '++', '+++', 'Many']
const GROWTH = [
  'No growth after 24 hours of incubation',
  'No growth after 48 hours of incubation',
  'Scanty growth',
  'Moderate growth',
  'Heavy growth',
]
const ORGANISMS = [
  'Staphylococcus spp',
  'Candida albicans',
  'Proteus spp',
  'E. coli',
  'Klebsiella spp',
  'Pseudomonas spp',
  'Streptococcus spp',
]
const SENSITIVITY = ['3+', '2+', '+', 'R']
// The antibiotics on the Laboratory's sensitivity panel, in its order.
const ANTIBIOTICS = [
  'Ciprofloxacin',
  'Norfloxacin',
  'Gentamicin',
  'Amoxicillin (Amoxil)',
  'Streptomycin',
  'Rifampicin',
  'Erythromycin',
  'Chloramphenicol',
  'Ampiclox',
  'Levofloxacin',
  'Pefloxacin',
]
const TITRE = ['1/20', '1/40', '1/80', '1/160', '1/320', '1/640']
const WIDAL_COMMENTS = [
  'Insignificant titre obtained.',
  'Significant titre obtained (1/160 or above).',
  'Titres above 1/160 are considered significant for possible enteric fever and would require stool or blood culture for confirmatory diagnosis.',
]

// The boxes shared by tests.
const PCV_BOX: LabField = { name: 'PCV', unit: '%', range: 'M 40 to 54, F 36 to 46' }
const URINALYSIS_BOXES: LabField[] = [
  { name: 'Appearance', choices: ['Clear', 'Slightly turbid', 'Turbid', 'Cloudy'] },
  { name: 'Colour', choices: ['Straw', 'Pale yellow', 'Amber', 'Dark yellow', 'Red', 'Whitish'] },
  { name: 'pH', range: '4.5 to 8.0' },
  { name: 'Specific gravity (S.G)', range: '1.005 to 1.030' },
  { name: 'Protein', choices: DIPSTICK },
  { name: 'Glucose', choices: DIPSTICK },
  { name: 'Ketones', choices: DIPSTICK },
  { name: 'Blood', choices: DIPSTICK },
  { name: 'Bilirubin', choices: DIPSTICK },
  { name: 'Urobilinogen', choices: ['Normal', '+', '++', '+++'] },
  { name: 'Nitrite', choices: POS_NEG },
  { name: 'Leukocytes', choices: DIPSTICK },
  { name: 'Others', choices: ['Nil'] },
]

// The sensitivity panel: one pick per antibiotic, under one heading.
function sensitivityBoxes(): LabField[] {
  return ANTIBIOTICS.map((name, at) => ({
    name,
    choices: SENSITIVITY,
    heading: at === 0 ? 'Sensitivity' : undefined,
  }))
}

const SEEN = ['Not seen', 'Seen']
const CRYSTALS = ['Nil', 'Calcium oxalate', 'Uric acid', 'Amorphous phosphates', 'Triple phosphate']
const CASTS = ['Nil', 'Hyaline casts', 'Granular casts', 'Red cell casts', 'White cell casts']

// What is looked for under the microscope, by kind of sample.
// vaginal: High vaginal and endocervical swabs. urine: urine. none: blood.
type Microscopy = 'standard' | 'vaginal' | 'urine' | 'none'

function microscopyBoxes(kind: Microscopy): LabField[] {
  if (kind === 'none') return []
  const boxes: LabField[] = [
    { name: 'Pus cells', choices: PER_HPF, heading: 'Microscopy' },
    { name: 'Epithelial cells', choices: PER_HPF },
    { name: 'Red cells', choices: PER_HPF },
    { name: 'Yeast cells', choices: AMOUNT },
  ]
  if (kind === 'vaginal') {
    boxes.push({ name: 'Trichomonas vaginalis', choices: SEEN })
    boxes.push({ name: 'Clue cells', choices: SEEN })
  }
  if (kind === 'urine') {
    boxes.push({ name: 'Casts', choices: CASTS })
    boxes.push({ name: 'Crystals', choices: CRYSTALS })
  }
  return boxes
}

// A culture (M/C/S): microscopy, what grew, and the sensitivity panel.
function culture(name: string, also: string[] = [], kind: Microscopy = 'standard'): LabTest {
  const growthHeading: LabField = { name: 'Growth', choices: GROWTH, heading: 'Isolation' }
  return {
    name,
    also,
    fields: [
      ...microscopyBoxes(kind),
      growthHeading,
      { name: 'Organism', choices: ORGANISMS },
      { name: 'Second organism', choices: ORGANISMS },
      ...sensitivityBoxes(),
    ],
  }
}

// One value with its unit.
function single(name: string, unit: string, range?: string, also: string[] = []): LabTest {
  return { name, also, fields: [{ name: 'Result', unit, range }] }
}

// One pick, such as Negative or Positive.
function screen(name: string, choices: string[], also: string[] = []): LabTest {
  return { name, also, fields: [{ name: 'Result', choices }] }
}

// A scan or a tracing: what was found, and what it means.
function report(name: string, also: string[] = []): LabTest {
  return { name, also, fields: [{ name: 'Findings' }, { name: 'Conclusion' }] }
}

// ===== 3. The sections and their tests =====
// The Laboratory's own tests come first in each section, most asked first.
export const LAB_SECTIONS: LabSection[] = [
  {
    name: 'Screening panels',
    tests: [
      {
        // The antenatal booking tests, as one request (asked most of all).
        name: 'Antenatal Screening (ANC)',
        also: ['ANC', 'Antenatal', 'Booking tests'],
        fields: [
          PCV_BOX,
          { name: 'RVS', choices: HIV },
          { name: 'Hepatitis B (HBsAg)', choices: POS_NEG },
          { name: 'Hepatitis C (HCV)', choices: POS_NEG },
          { name: 'Blood group', choices: BLOOD_GROUPS },
          { name: 'Genotype', choices: GENOTYPES },
          { name: 'VDRL', choices: POS_NEG },
          ...URINALYSIS_BOXES.map((box, at) =>
            at === 0 ? { ...box, heading: 'Urinalysis' } : box,
          ),
        ],
      },
      {
        name: 'Medical Screening',
        also: ['Screening', 'Pre employment', 'Fitness'],
        fields: [
          PCV_BOX,
          { name: 'RVS', choices: HIV },
          { name: 'Hepatitis B (HBsAg)', choices: POS_NEG },
          { name: 'Hepatitis C (HCV)', choices: POS_NEG },
        ],
      },
    ],
  },
  {
    name: 'Blood (haematology)',
    tests: [
      single('PCV', '%', 'M 40 to 54, F 36 to 46', [
        'Packed Cell Volume',
        'PCV test',
        'Haematocrit',
      ]),
      screen('Malaria Parasite (MP)', MALARIA, [
        'MP',
        'Malaria test',
        'Malaria',
        'Blood film for malaria',
      ]),
      {
        name: 'Full Blood Count (FBC)',
        also: ['FBC', 'Full Blood Count', 'CBC', 'Complete blood count', 'FBC test'],
        fields: [
          { name: 'WBC', unit: 'x10³/mm³', range: '4 to 10' },
          { name: 'Lymphocytes', unit: '%', range: '20 to 40' },
          { name: 'Neutrophils', unit: '%', range: '50 to 70' },
          PCV_BOX,
          { name: 'HB', unit: 'g/dl', range: 'M 14 to 18, F 12 to 14' },
          { name: 'MID', unit: '%', range: '1 to 15' },
          { name: 'MCV', unit: 'fl', range: '80 to 99' },
          { name: 'MCH', unit: 'pg', range: '26 to 32' },
          { name: 'MCHC', unit: 'g/dl', range: '32 to 36' },
          { name: 'Platelets', unit: 'x10³/mm³', range: '100 to 300' },
          { name: 'RBC', unit: 'x10⁶/mcl', range: '4.2 to 6.1' },
        ],
      },
      screen('Blood Group', BLOOD_GROUPS, ['Bloodgroup', 'Blood grouping', 'Rhesus', 'BG']),
      screen('Genotype', GENOTYPES, ['Haemoglobin Genotype', 'Hb genotype', 'Hb electrophoresis']),
      single('Haemoglobin (HB)', 'g/dl', 'M 14 to 18, F 12 to 14', ['Hb', 'Haemoglobin']),
      single('ESR', 'mm/hour', 'M 0 to 15, F 0 to 20', ['Erythrocyte sedimentation rate']),
      screen('Sickling Test', POS_NEG, ['Sickle cell test']),
      {
        name: 'Grouping and Cross Matching',
        also: ['Cross match', 'Crossmatch', 'Blood transfusion'],
        fields: [
          { name: 'Blood group', choices: BLOOD_GROUPS },
          { name: 'Cross match', choices: ['Compatible', 'Not compatible'] },
          { name: 'Units ready' },
        ],
      },
      {
        name: 'Clotting Profile',
        also: ['PT INR', 'INR', 'APTT', 'Coagulation', 'Prothrombin time'],
        fields: [
          { name: 'Prothrombin time (PT)', unit: 'seconds', range: '11 to 15' },
          { name: 'INR', range: '0.8 to 1.2' },
          { name: 'APTT', unit: 'seconds', range: '25 to 40' },
        ],
      },
      {
        name: 'Bleeding and Clotting Time',
        also: ['BT', 'CT'],
        fields: [
          { name: 'Bleeding time', unit: 'minutes', range: '2 to 7' },
          { name: 'Clotting time', unit: 'minutes', range: '4 to 10' },
        ],
      },
      report('Blood Film', ['Peripheral blood film', 'PBF']),
    ],
  },
  {
    name: 'Serology (rapid tests)',
    tests: [
      {
        name: 'Widal Test',
        also: ['Widal', 'Typhoid test'],
        fields: [
          { name: 'S. typhi D, O antigen', choices: TITRE, heading: 'Agglutination titres' },
          { name: 'S. typhi D, H antigen', choices: TITRE },
          { name: 'Paratyphi A, O antigen', choices: TITRE },
          { name: 'Paratyphi A, H antigen', choices: TITRE },
          { name: 'Paratyphi B, O antigen', choices: TITRE },
          { name: 'Paratyphi B, H antigen', choices: TITRE },
          { name: 'Paratyphi C, O antigen', choices: TITRE },
          { name: 'Paratyphi C, H antigen', choices: TITRE },
          { name: 'Comment on titres', choices: WIDAL_COMMENTS },
        ],
      },
      screen('RVS (HIV 1 & 2)', HIV, [
        'RVS',
        'HIV',
        'Retroviral screening',
        'RVS test',
        'HIV screening',
      ]),
      screen('Pregnancy Test', PREGNANCY, ['PT', 'P.T', 'Urine pregnancy test', 'Urine hCG']),
      screen('H. pylori', POS_NEG, ['H pylori', 'Helicobacter pylori', 'H. pylori test']),
      screen('Hepatitis B (HBsAg)', POS_NEG, ['HBsAg', 'Hepatitis B', 'HBV']),
      screen('Hepatitis C (HCV)', POS_NEG, ['HCV', 'Hepatitis C']),
      screen('VDRL (Syphilis)', POS_NEG, ['VDRL', 'Syphilis', 'RPR']),
      screen('Herpes Simplex Virus 1 & 2', REACTIVE, ['HSV', 'Herpes', 'Herpes simplex 1 & 2']),
      screen('Typhoid Rapid Test', POS_NEG, ['Typhidot']),
      screen('Pregnancy Test (Blood)', PREGNANCY, ['Serum pregnancy test', 'Serum hCG']),
      single('Beta hCG (Quantitative)', 'mIU/ml', undefined, ['Beta hCG', 'Quantitative hCG']),
      screen('Rheumatoid Factor', POS_NEG, ['RF']),
      single('ASO Titre', 'IU/ml', 'Below 200', ['ASO', 'Antistreptolysin O']),
      screen('Chlamydia', POS_NEG),
      screen('Gonorrhoea', POS_NEG),
      screen('Toxoplasma', POS_NEG, ['Toxoplasmosis']),
      {
        name: 'Hepatitis B Profile',
        also: ['HBV profile', 'HBeAg', 'Hepatitis B five panel'],
        fields: [
          { name: 'HBsAg', choices: POS_NEG },
          { name: 'HBsAb', choices: POS_NEG },
          { name: 'HBeAg', choices: POS_NEG },
          { name: 'HBeAb', choices: POS_NEG },
          { name: 'HBcAb', choices: POS_NEG },
        ],
      },
      single('HIV Viral Load', 'copies/ml', undefined, ['Viral load']),
      single('CD4 Count', 'cells/µl', '500 to 1500', ['CD4']),
    ],
  },
  {
    name: 'Urine',
    tests: [
      {
        name: 'Urinalysis',
        also: ['Urine test', 'Dipstick', 'Urine routine', 'Urinalyis'],
        fields: URINALYSIS_BOXES,
      },
      single('Urine Protein (24 hours)', 'g/24 hours', 'Below 0.15', ['24 hour urine protein']),
    ],
  },
  {
    name: 'Swabs and cultures (M/C/S)',
    tests: [
      culture('Urine M/C/S', ['Urine MCS', 'Urine MC/S', 'Urine culture'], 'urine'),
      culture('High Vaginal Swab M/C/S', ['HVS', 'HVS MCS', 'HVS MC/S'], 'vaginal'),
      culture('Urethral Swab M/C/S', ['US', 'Urethral swab', 'US MC/S']),
      culture('Endocervical Swab M/C/S', ['ECS', 'ECS MCS', 'ECS MC/S'], 'vaginal'),
      culture('Wound Swab M/C/S', ['Wound MCS', 'Wound MC/S', 'Wound culture']),
      culture('Throat Swab M/C/S', ['Throat MCS', 'Throat MC/S']),
      culture('Sputum M/C/S', ['Sputum', 'Sputum MCS', 'Sputum culture']),
      culture('Stool M/C/S', ['Stool MCS', 'Stool culture']),
      culture('Ear Swab M/C/S', ['Ear MCS']),
      culture('Eye Swab M/C/S', ['Eye MCS']),
      culture('Blood Culture', ['Blood MCS'], 'none'),
      screen(
        'Sputum AFB',
        ['No AFB seen', 'Scanty', '+', '++', '+++'],
        ['AFB', 'Ziehl Neelsen', 'ZN'],
      ),
      screen(
        'GeneXpert (TB)',
        [
          'MTB not detected',
          'MTB detected, rifampicin resistance not detected',
          'MTB detected, rifampicin resistance detected',
        ],
        ['GeneXpert', 'TB test'],
      ),
      {
        name: 'Stool Microscopy',
        also: ['Stool analysis', 'Stool for ova and cysts', 'Stool O/C'],
        fields: [
          {
            name: 'Appearance',
            choices: ['Formed', 'Semi formed', 'Loose', 'Watery', 'Mucoid', 'Bloody'],
          },
          { name: 'Ova or cysts' },
          { name: 'Pus cells', choices: PER_HPF },
          { name: 'Red cells', choices: PER_HPF },
        ],
      },
    ],
  },
  {
    name: 'Chemistry',
    tests: [
      {
        name: 'Electrolytes, Urea and Creatinine (E/U/Cr)',
        also: [
          'E/U/Cr',
          'EUCr',
          'E/U/CR',
          'U&E',
          'Electrolytes',
          'Kidney function',
          'Electrolytes, Urea and Creatinine',
        ],
        fields: [
          { name: 'Urea', unit: 'mg/dl', range: '10 to 50' },
          { name: 'Creatinine', unit: 'mg/dl', range: '0.6 to 1.3' },
          { name: 'Sodium', unit: 'mmol/l', range: '135 to 145' },
          { name: 'Potassium', unit: 'mmol/l', range: '3.6 to 5.5' },
          { name: 'Chloride', unit: 'mmol/l', range: '98 to 107' },
          { name: 'Bicarbonate', unit: 'mmol/l', range: '22 to 29' },
        ],
      },
      {
        name: 'Liver Function Test (LFT)',
        also: ['LFT', 'Liver Function Test', 'Liver tests'],
        fields: [
          { name: 'Total bilirubin (T.B)', unit: 'mg/dl', range: '0.1 to 1.2' },
          { name: 'Direct bilirubin (D.B)', unit: 'mg/dl', range: '0 to 0.3' },
          { name: 'ALT', unit: 'u/l', range: '0 to 45' },
          { name: 'AST', unit: 'u/l', range: '0 to 35' },
          { name: 'ALP', unit: 'u/l', range: '80 to 306' },
          { name: 'Total protein (T.P)', unit: 'g/dl', range: '6 to 8' },
          { name: 'Albumin (ALB)', unit: 'g/dl', range: '3.5 to 5.2' },
        ],
      },
      {
        name: 'Lipid Profile',
        also: ['Fasting lipid profile', 'Cholesterol', 'Cholesterol test', 'Lipids'],
        fields: [
          { name: 'Cholesterol', unit: 'mg/dl', range: 'below 200' },
          { name: 'Triglycerides', unit: 'mg/dl', range: '60 to 165' },
          { name: 'HDL-C', unit: 'mg/dl', range: '33 to 63' },
          { name: 'LDL-C', unit: 'mg/dl', range: 'below 100' },
        ],
      },
      {
        name: 'Blood Sugar',
        also: [
          'Blood sugar',
          'Glucose',
          'FBS',
          'RBS',
          'Fasting blood sugar',
          'Random blood sugar',
          'Sugar',
        ],
        fields: [
          { name: 'Type', choices: ['Fasting', 'Random', '2 hours after a meal'] },
          { name: 'Blood glucose', unit: 'mg/dl', range: 'fasting 70 to 110, random below 140' },
        ],
      },
      {
        name: 'Oral Glucose Tolerance Test',
        also: ['OGTT', 'GTT'],
        fields: [
          { name: 'Fasting', unit: 'mg/dl', range: 'below 92 in pregnancy, below 110 otherwise' },
          { name: 'After 1 hour', unit: 'mg/dl', range: 'below 180' },
          { name: 'After 2 hours', unit: 'mg/dl', range: 'below 140' },
        ],
      },
      single('HbA1c', '%', '4.0 to 5.6', ['Glycated haemoglobin', 'A1c']),
      single('Uric Acid', 'mg/dl', '3.5 to 7.2', ['Serum uric acid']),
      single('Serum Calcium', 'mg/dl', '8.5 to 10.5', ['Calcium']),
      single('Serum Amylase', 'u/l', '30 to 110', ['Amylase']),
      single('C Reactive Protein', 'mg/l', 'below 10', ['CRP']),
      single('Serum Ferritin', 'ng/ml', '20 to 300', ['Ferritin']),
      single('Troponin', 'ng/l', 'below 14', ['Troponin I', 'Troponin T']),
    ],
  },
  {
    name: 'Hormones',
    tests: [
      {
        name: 'Hormone Profile',
        also: ['Hormonal profile', 'Female hormone profile', 'Fertility hormone profile'],
        fields: [
          { name: 'Prolactin', unit: 'ng/ml', range: 'men 3.45 to 17.42, women 4.60 to 25.07' },
          {
            name: 'LH',
            unit: 'mIU/ml',
            range:
              'men 1.81 to 8.16; women follicular 2.95 to 13.65, ovulation 13.65 to 95.75, luteal 1.25 to 11.00, menopause 8.74 to 55.00',
          },
          {
            name: 'FSH',
            unit: 'mIU/ml',
            range:
              'men 1.50 to 12.40; women follicular 4.46 to 12.43, ovulation 4.88 to 20.96, luteal 1.95 to 8.04, menopause 20.00 to 98.62',
          },
          {
            name: 'Estradiol (E2)',
            unit: 'pg/ml',
            range:
              'men below 9.0 to 85; women follicular 12 to 262, ovulation 40 to 396, luteal 21 to 381, menopause below 9.0 to 190',
          },
          {
            name: 'Progesterone',
            unit: 'ng/ml',
            range:
              'men below 1.4 to 1.5; women follicular below 1.4 to 1.9, ovulation below 1.4 to 12.0, luteal 1.7 to 28.7, menopause below 1.4',
          },
        ],
      },
      {
        name: 'Thyroid Function Test',
        also: ['TFT', 'Thyroid'],
        fields: [
          { name: 'TSH', unit: 'mIU/l', range: '0.4 to 4.0' },
          { name: 'Free T4', unit: 'pmol/l', range: '12 to 22' },
          { name: 'Free T3', unit: 'pmol/l', range: '3.1 to 6.8' },
        ],
      },
      single('Testosterone', 'ng/ml', undefined),
      single('AMH', 'ng/ml', undefined, ['Anti Mullerian hormone']),
      single('PSA', 'ng/ml', 'below 4.0', ['Prostate specific antigen']),
    ],
  },
  {
    name: 'Semen',
    tests: [
      {
        name: 'Seminal Fluid Analysis (SFA)',
        also: ['SFA', 'Semen analysis', 'Seminal fluid analysis', 'Sperm count'],
        fields: [
          { name: 'Time ejaculated' },
          { name: 'Time received' },
          { name: 'Time examined' },
          { name: 'Appearance', choices: ['Normal', 'Abnormal'] },
          { name: 'Colour', choices: ['Whitish grey', 'Yellowish', 'Brownish'] },
          { name: 'Volume', unit: 'ml', range: '1.5 to 7.6' },
          { name: 'Viscosity', choices: ['Low', 'Normal', 'High'] },
          { name: 'pH', range: '7.2 to 8.0' },
          { name: 'Sperm count', unit: 'million/total ejaculate', range: '39 to 928' },
          { name: 'Total motility', unit: '%', range: '40 to 81' },
          { name: 'Active progressive motility', unit: '%', range: '32 to 75' },
          { name: 'Sluggish progressive motility', unit: '%' },
          { name: 'Non progressive motility', unit: '%' },
          { name: 'Immotile', unit: '%' },
          { name: 'Normal forms', unit: '%', range: '4 or more' },
          { name: 'Abnormal forms (bent tails, no tails, double head, defective head)' },
          { name: 'Pus cells', choices: PER_HPF },
          { name: 'Epithelial cells', choices: PER_HPF },
          { name: 'Growth', choices: GROWTH, heading: 'Isolation' },
          { name: 'Organism', choices: ORGANISMS },
          ...sensitivityBoxes(),
        ],
      },
    ],
  },
  {
    name: 'Scans and tracings',
    tests: [
      {
        name: 'Pregnancy Scan',
        also: ['Pregnancy scan', 'Obstetric scan', 'Obstetric ultrasound'],
        fields: [
          { name: 'Number of babies', choices: ['1', '2', '3 or more'] },
          { name: 'Gestational age', unit: 'weeks' },
          { name: 'Foetal heart', choices: ['Seen', 'Not seen'] },
          { name: 'Presentation', choices: ['Cephalic', 'Breech', 'Transverse', 'Oblique'] },
          { name: 'Placenta' },
          { name: 'Liquor', choices: ['Adequate', 'Reduced', 'Increased'] },
          { name: 'Expected date of delivery' },
          { name: 'Conclusion' },
        ],
      },
      report('Pelvic Scan', ['Pelvic ultrasound', 'TVS', 'Transvaginal scan']),
      report('Abdominal Scan', ['Abdominal ultrasound', 'Abdominopelvic scan']),
      report('Breast Scan', ['Breast ultrasound']),
      report('Prostate Scan', ['Prostate ultrasound']),
      report('Chest X-ray', ['CXR', 'X-ray']),
      report('ECG', ['Electrocardiogram']),
    ],
  },
]

// The Laboratory's most asked tests, most asked first, one tap away on
// Request lab (counted from its own reports, 2026-11-16).
export const COMMON_LAB_TESTS = [
  'Antenatal Screening (ANC)',
  'PCV',
  'Malaria Parasite (MP)',
  'Widal Test',
  'Full Blood Count (FBC)',
  'RVS (HIV 1 & 2)',
  'Pregnancy Test',
  'Blood Group',
  'Urine M/C/S',
  'Urinalysis',
  'H. pylori',
  'Genotype',
]

// ===== 4. Finding a test =====
// Every test in one list, in section order.
export const ALL_LAB_TESTS: LabTest[] = LAB_SECTIONS.flatMap((section) => section.tests)

// The words a test is found by: its name and its other names, in small letters.
function wordsOf(test: LabTest): string[] {
  return [test.name, ...(test.also ?? [])].map((word) => word.toLowerCase())
}

// The test with exactly this name or other name, or undefined.
export function findLabTest(name: string): LabTest | undefined {
  const wanted = name.trim().toLowerCase()
  if (!wanted) return undefined
  return ALL_LAB_TESTS.find((test) => wordsOf(test).includes(wanted))
}

// The tests that match what was typed: names that start with it first, then
// names that contain it. "fb" finds Full Blood Count by its other name FBC.
export function searchLabTests(typed: string, limit = 12): LabTest[] {
  const wanted = typed.trim().toLowerCase()
  if (!wanted) return []
  const starts = ALL_LAB_TESTS.filter((test) =>
    wordsOf(test).some((word) => word.startsWith(wanted)),
  )
  const contains = ALL_LAB_TESTS.filter(
    (test) => !starts.includes(test) && wordsOf(test).some((word) => word.includes(wanted)),
  )
  return [...starts, ...contains].slice(0, limit)
}

// ===== 5. Writing the boxes as the result text =====
// One line per filled box: "HB: 12.5 g/dl (normal M 14 to 18, F 12 to 14)".
// A heading ("Sensitivity:") goes before its group when the group has a
// filled box. Then the comment, if there is one.
export function composeResult(
  test: LabTest,
  values: Record<string, string>,
  comment: string,
): string {
  const lines: string[] = []
  let heading: string | null = null
  let headingWritten = false
  for (const field of test.fields) {
    if (field.heading) {
      heading = field.heading
      headingWritten = false
    }
    const value = (values[field.name] ?? '').trim()
    if (!value) continue
    if (heading && !headingWritten) {
      lines.push(`${heading}:`)
      headingWritten = true
    }
    let line = `${field.name}: ${value}`
    if (field.unit && !field.choices) line += ` ${field.unit}`
    if (field.range) line += ` (normal ${field.range})`
    lines.push(line)
  }
  if (comment.trim()) lines.push(`Comment: ${comment.trim()}`)
  return lines.join('\n')
}
