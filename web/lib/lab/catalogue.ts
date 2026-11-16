/*
 * lib/lab/catalogue.ts: every lab test the hospital usually does, by
 * section, with the boxes the Laboratory fills in for each one.
 *
 * Why: Anthony, 2026-11-16 (request 196a): "take what is in Swift practice
 * EMR and add it... later when I bring the list, check if anyone is
 * missing... rewrite it the way our list is." This is a standard test menu
 * for a Nigerian hospital laboratory, written from general knowledge, until
 * the hospital's own list arrives. Then this file is changed to match it.
 *
 * How it is used:
 *   - Request lab: search every test by its first letters, or browse a
 *     section. A test that is not here can still be typed and added.
 *   - Enter results: a test found here shows its own boxes (a number with
 *     its unit and usual range, or a pick such as Negative or +). What is
 *     filled in is written as plain lines of text, which is what the record
 *     already shows. A test not found here keeps the one free text box.
 *
 * The usual ranges are a guide for adults. Each laboratory's own ranges win,
 * and they come with the hospital's list.
 *
 * Never: decide a diagnosis, or mark a value as good or bad. It only writes
 * what the Laboratory entered, with the unit and the usual range beside it.
 */

// ===== 1. Shapes =====
// A box for one value. A number has a unit; a pick has choices; anything
// else is a short line of text.
export type LabField = {
  name: string
  unit?: string
  range?: string
  choices?: string[]
}

export type LabTest = {
  name: string
  // Other names people search by, such as FBC or E/U/Cr.
  also?: string[]
  fields: LabField[]
}

export type LabSection = {
  name: string
  tests: LabTest[]
}

// ===== 2. Words used by many tests =====
const POS_NEG = ['Negative', 'Positive']
const REACTIVE = ['Non reactive', 'Reactive']
const DIPSTICK = ['Nil', 'Trace', '+', '++', '+++']
const GROWTH = ['No growth after 48 hours', 'Growth seen']
const TITRE = ['Below 1/20', '1/20', '1/40', '1/80', '1/160', '1/320']

// One culture test: what was seen, what grew, and what works against it.
function culture(name: string, also: string[] = []): LabTest {
  return {
    name,
    also,
    fields: [
      { name: 'Appearance' },
      { name: 'Microscopy' },
      { name: 'Culture', choices: GROWTH },
      { name: 'Organism' },
      { name: 'Sensitive to' },
      { name: 'Resistant to' },
    ],
  }
}

// One hormone or single value test.
function single(name: string, unit: string, range?: string, also: string[] = []): LabTest {
  return { name, also, fields: [{ name: 'Result', unit, range }] }
}

// One positive or negative test.
function screen(name: string, choices: string[], also: string[] = []): LabTest {
  return { name, also, fields: [{ name: 'Result', choices }] }
}

// A scan or a tracing: what was found, and what it means.
function report(name: string, also: string[] = []): LabTest {
  return { name, also, fields: [{ name: 'Findings' }, { name: 'Conclusion' }] }
}

// ===== 3. The sections and their tests =====
export const LAB_SECTIONS: LabSection[] = [
  {
    name: 'Haematology',
    tests: [
      {
        name: 'Full Blood Count',
        also: ['FBC', 'CBC', 'Complete blood count', 'Blood count'],
        fields: [
          { name: 'Haemoglobin (Hb)', unit: 'g/dL', range: '11.5 to 16.5' },
          { name: 'Packed cell volume (PCV)', unit: '%', range: '35 to 50' },
          { name: 'White cells (WBC)', unit: 'x10⁹/L', range: '4.0 to 11.0' },
          { name: 'Neutrophils', unit: '%', range: '40 to 75' },
          { name: 'Lymphocytes', unit: '%', range: '20 to 45' },
          { name: 'Monocytes', unit: '%', range: '2 to 10' },
          { name: 'Eosinophils', unit: '%', range: '1 to 6' },
          { name: 'Basophils', unit: '%', range: '0 to 1' },
          { name: 'Platelets', unit: 'x10⁹/L', range: '150 to 400' },
          { name: 'Red cells (RBC)', unit: 'x10¹²/L', range: '3.8 to 5.8' },
          { name: 'MCV', unit: 'fL', range: '80 to 100' },
          { name: 'MCH', unit: 'pg', range: '27 to 32' },
          { name: 'MCHC', unit: 'g/dL', range: '32 to 36' },
        ],
      },
      single('Packed Cell Volume', '%', '35 to 50', ['PCV', 'Haematocrit']),
      single('Haemoglobin', 'g/dL', '11.5 to 16.5', ['Hb']),
      single('White Blood Cell Count', 'x10⁹/L', '4.0 to 11.0', ['WBC', 'Total white count']),
      {
        name: 'White Cell Differential',
        also: ['Differential count'],
        fields: [
          { name: 'Neutrophils', unit: '%', range: '40 to 75' },
          { name: 'Lymphocytes', unit: '%', range: '20 to 45' },
          { name: 'Monocytes', unit: '%', range: '2 to 10' },
          { name: 'Eosinophils', unit: '%', range: '1 to 6' },
          { name: 'Basophils', unit: '%', range: '0 to 1' },
        ],
      },
      single('Platelet Count', 'x10⁹/L', '150 to 400', ['Platelets']),
      single('ESR', 'mm/hour', '0 to 20', ['Erythrocyte sedimentation rate']),
      single('Reticulocyte Count', '%', '0.5 to 2.5', ['Retic']),
      {
        name: 'Blood Group and Rhesus',
        also: ['Blood group', 'Grouping', 'Rhesus'],
        fields: [
          { name: 'Blood group', choices: ['A', 'B', 'AB', 'O'] },
          { name: 'Rhesus', choices: ['Positive', 'Negative'] },
        ],
      },
      screen(
        'Haemoglobin Genotype',
        ['AA', 'AS', 'AC', 'SS', 'SC', 'CC'],
        ['Genotype', 'Hb electrophoresis'],
      ),
      screen('Sickling Test', POS_NEG, ['Sickle cell test']),
      {
        name: 'Grouping and Cross Matching',
        also: ['Cross match', 'Crossmatch', 'Blood transfusion'],
        fields: [
          { name: 'Blood group', choices: ['A', 'B', 'AB', 'O'] },
          { name: 'Rhesus', choices: ['Positive', 'Negative'] },
          { name: 'Cross match', choices: ['Compatible', 'Not compatible'] },
          { name: 'Units ready' },
        ],
      },
      {
        name: 'Clotting Profile',
        also: ['PT', 'INR', 'APTT', 'Coagulation'],
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
    name: 'Parasitology',
    tests: [
      {
        name: 'Malaria test',
        also: ['Malaria parasite', 'MP', 'Blood film for malaria', 'Thick and thin film'],
        fields: [
          { name: 'Malaria parasite', choices: ['Not seen', '+', '++', '+++', '++++'] },
          {
            name: 'Species',
            choices: [
              'Plasmodium falciparum',
              'Plasmodium malariae',
              'Plasmodium ovale',
              'Plasmodium vivax',
              'Mixed',
            ],
          },
        ],
      },
      screen('Malaria Rapid Test', POS_NEG, ['RDT', 'mRDT']),
      {
        name: 'Stool Microscopy',
        also: ['Stool analysis', 'Stool for ova and cysts', 'Stool O/C'],
        fields: [
          {
            name: 'Appearance',
            choices: ['Formed', 'Semi formed', 'Loose', 'Watery', 'Mucoid', 'Bloody'],
          },
          { name: 'Ova or cysts' },
          { name: 'Pus cells' },
          { name: 'Red cells' },
        ],
      },
      screen('Stool Occult Blood', POS_NEG, ['FOBT', 'Faecal occult blood']),
      screen('Skin Snip for Microfilaria', ['Not seen', 'Seen'], ['Microfilaria']),
      screen('Urine for Schistosoma', ['Not seen', 'Seen'], ['Schistosomiasis', 'Bilharzia']),
    ],
  },
  {
    name: 'Urine',
    tests: [
      {
        name: 'Urinalysis',
        also: ['Urine test', 'Dipstick', 'Urine routine'],
        fields: [
          { name: 'Colour', choices: ['Pale yellow', 'Yellow', 'Amber', 'Dark', 'Red', 'Cloudy'] },
          { name: 'Appearance', choices: ['Clear', 'Slightly cloudy', 'Cloudy'] },
          { name: 'pH', range: '4.5 to 8.0' },
          { name: 'Specific gravity', range: '1.005 to 1.030' },
          { name: 'Protein', choices: DIPSTICK },
          { name: 'Glucose', choices: DIPSTICK },
          { name: 'Ketones', choices: DIPSTICK },
          { name: 'Blood', choices: DIPSTICK },
          { name: 'Bilirubin', choices: DIPSTICK },
          { name: 'Urobilinogen', choices: ['Normal', '+', '++', '+++'] },
          { name: 'Nitrite', choices: POS_NEG },
          { name: 'Leucocytes', choices: DIPSTICK },
        ],
      },
      {
        name: 'Urine Microscopy',
        also: ['Urine deposits'],
        fields: [
          { name: 'Pus cells', unit: 'per high power field' },
          { name: 'Red cells', unit: 'per high power field' },
          { name: 'Epithelial cells' },
          { name: 'Casts' },
          { name: 'Crystals' },
          { name: 'Others' },
        ],
      },
      screen('Pregnancy Test (Urine)', POS_NEG, ['Urine hCG', 'Pregnancy test']),
      single('Urine Protein (24 hours)', 'g/24 hours', 'Below 0.15', ['24 hour urine protein']),
      single('Urine Albumin to Creatinine Ratio', 'mg/mmol', 'Below 3', ['ACR', 'Microalbumin']),
    ],
  },
  {
    name: 'Chemistry',
    tests: [
      {
        name: 'Blood sugar',
        also: ['Glucose', 'FBS', 'RBS', 'Fasting blood sugar', 'Random blood sugar', 'Sugar'],
        fields: [
          { name: 'Type', choices: ['Fasting', 'Random', '2 hours after a meal'] },
          { name: 'Blood glucose', unit: 'mg/dL', range: 'fasting 70 to 110, random below 140' },
        ],
      },
      single('Fasting Blood Sugar', 'mg/dL', '70 to 110', ['FBS', 'Fasting glucose']),
      single('Random Blood Sugar', 'mg/dL', 'Below 140', ['RBS', 'Random glucose']),
      {
        name: 'Oral Glucose Tolerance Test',
        also: ['OGTT', 'GTT'],
        fields: [
          { name: 'Fasting', unit: 'mg/dL', range: 'Below 92 in pregnancy, below 110 otherwise' },
          { name: 'After 1 hour', unit: 'mg/dL', range: 'Below 180' },
          { name: 'After 2 hours', unit: 'mg/dL', range: 'Below 140' },
        ],
      },
      single('HbA1c', '%', '4.0 to 5.6', ['Glycated haemoglobin', 'A1c']),
      {
        name: 'Electrolytes, Urea and Creatinine',
        also: ['E/U/Cr', 'EUCr', 'U&E', 'Electrolytes', 'Kidney function', 'Renal function'],
        fields: [
          { name: 'Sodium', unit: 'mmol/L', range: '135 to 145' },
          { name: 'Potassium', unit: 'mmol/L', range: '3.5 to 5.0' },
          { name: 'Chloride', unit: 'mmol/L', range: '96 to 106' },
          { name: 'Bicarbonate', unit: 'mmol/L', range: '22 to 29' },
          { name: 'Urea', unit: 'mmol/L', range: '2.5 to 7.1' },
          { name: 'Creatinine', unit: 'µmol/L', range: '53 to 115' },
        ],
      },
      {
        name: 'Liver Function Test',
        also: ['LFT', 'Liver tests'],
        fields: [
          { name: 'Total bilirubin', unit: 'µmol/L', range: '3 to 21' },
          { name: 'Direct bilirubin', unit: 'µmol/L', range: '0 to 5' },
          { name: 'ALT', unit: 'U/L', range: '7 to 56' },
          { name: 'AST', unit: 'U/L', range: '5 to 40' },
          { name: 'ALP', unit: 'U/L', range: '44 to 147' },
          { name: 'GGT', unit: 'U/L', range: '9 to 48' },
          { name: 'Total protein', unit: 'g/L', range: '60 to 83' },
          { name: 'Albumin', unit: 'g/L', range: '35 to 50' },
        ],
      },
      {
        name: 'Lipid Profile',
        also: ['Cholesterol', 'Lipids', 'Fasting lipid profile'],
        fields: [
          { name: 'Total cholesterol', unit: 'mmol/L', range: 'Below 5.2' },
          { name: 'Triglycerides', unit: 'mmol/L', range: 'Below 1.7' },
          { name: 'HDL cholesterol', unit: 'mmol/L', range: 'Above 1.0' },
          { name: 'LDL cholesterol', unit: 'mmol/L', range: 'Below 3.4' },
        ],
      },
      single('Uric Acid', 'µmol/L', '150 to 420', ['Serum uric acid']),
      single('Serum Calcium', 'mmol/L', '2.2 to 2.6', ['Calcium']),
      single('Serum Magnesium', 'mmol/L', '0.7 to 1.0', ['Magnesium']),
      single('Serum Phosphate', 'mmol/L', '0.8 to 1.5', ['Phosphate']),
      single('Serum Amylase', 'U/L', '30 to 110', ['Amylase']),
      single('C Reactive Protein', 'mg/L', 'Below 10', ['CRP']),
      single('Serum Iron', 'µmol/L', '10 to 30', ['Iron']),
      single('Serum Ferritin', 'ng/mL', '20 to 300', ['Ferritin']),
      single('Total Protein', 'g/L', '60 to 83'),
      single('Serum Albumin', 'g/L', '35 to 50', ['Albumin']),
      single('CSF Glucose', 'mg/dL', '40 to 70'),
      single('Troponin', 'ng/L', 'Below 14', ['Troponin I', 'Troponin T']),
    ],
  },
  {
    name: 'Serology',
    tests: [
      screen('HIV Screening', REACTIVE, ['HIV', 'RVS', 'Retroviral screening', 'HIV 1 and 2']),
      screen('Hepatitis B (HBsAg)', POS_NEG, ['HBsAg', 'Hepatitis B']),
      screen('Hepatitis C (HCV)', POS_NEG, ['HCV', 'Hepatitis C']),
      screen('Syphilis (VDRL)', REACTIVE, ['VDRL', 'RPR', 'Syphilis']),
      {
        name: 'Widal Test',
        also: ['Widal', 'Typhoid test'],
        fields: [
          { name: 'S. typhi O', choices: TITRE },
          { name: 'S. typhi H', choices: TITRE },
          { name: 'S. paratyphi A O', choices: TITRE },
          { name: 'S. paratyphi A H', choices: TITRE },
          { name: 'S. paratyphi B O', choices: TITRE },
          { name: 'S. paratyphi B H', choices: TITRE },
        ],
      },
      screen('Typhoid Rapid Test', POS_NEG, ['Typhidot']),
      screen('H. pylori', POS_NEG, ['Helicobacter pylori', 'H pylori']),
      screen('Pregnancy Test (Blood)', POS_NEG, ['Serum pregnancy test', 'Serum hCG']),
      single('Beta hCG (Quantitative)', 'mIU/mL', undefined, ['Beta hCG', 'Quantitative hCG']),
      screen('Rheumatoid Factor', POS_NEG, ['RF']),
      single('ASO Titre', 'IU/mL', 'Below 200', ['ASO', 'Antistreptolysin O']),
      screen('Chlamydia', POS_NEG),
      screen('Gonorrhoea', POS_NEG),
      screen('Toxoplasma', POS_NEG, ['Toxoplasmosis']),
      screen('Rubella', POS_NEG),
      screen('COVID 19 Rapid Test', POS_NEG, ['COVID', 'Coronavirus']),
      screen('Hepatitis B Profile', ['See the comment'], ['HBV profile', 'HBeAg']),
      single('Hepatitis B Viral Load', 'copies/mL', undefined, ['HBV DNA']),
      single('HIV Viral Load', 'copies/mL', undefined, ['Viral load']),
      single('CD4 Count', 'cells/µL', '500 to 1500', ['CD4']),
    ],
  },
  {
    name: 'Microbiology',
    tests: [
      culture('Urine Culture', ['Urine MCS', 'Urine M/C/S']),
      culture('Stool Culture', ['Stool MCS', 'Stool M/C/S']),
      culture('High Vaginal Swab', ['HVS', 'HVS MCS']),
      culture('Endocervical Swab', ['ECS', 'ECS MCS']),
      culture('Urethral Swab', ['Urethral MCS']),
      culture('Wound Swab', ['Wound MCS', 'Wound culture']),
      culture('Ear Swab', ['Ear MCS']),
      culture('Throat Swab', ['Throat MCS']),
      culture('Eye Swab', ['Eye MCS']),
      culture('Sputum Culture', ['Sputum MCS']),
      culture('Blood Culture'),
      culture('CSF Analysis', ['Cerebrospinal fluid', 'Lumbar puncture']),
      culture('Semen Culture', ['Semen MCS']),
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
        name: 'Semen Analysis',
        also: ['Seminal fluid analysis', 'SFA', 'Sperm count'],
        fields: [
          { name: 'Volume', unit: 'ml', range: '1.5 or more' },
          { name: 'Sperm count', unit: 'million/ml', range: '15 or more' },
          { name: 'Motility (moving)', unit: '%', range: '40 or more' },
          { name: 'Normal forms', unit: '%', range: '4 or more' },
          { name: 'Pus cells' },
          { name: 'Liquefaction time', unit: 'minutes', range: 'Within 60' },
        ],
      },
    ],
  },
  {
    name: 'Hormones',
    tests: [
      {
        name: 'Thyroid Function Test',
        also: ['TFT', 'Thyroid'],
        fields: [
          { name: 'TSH', unit: 'mIU/L', range: '0.4 to 4.0' },
          { name: 'Free T4', unit: 'pmol/L', range: '12 to 22' },
          { name: 'Free T3', unit: 'pmol/L', range: '3.1 to 6.8' },
        ],
      },
      single('TSH', 'mIU/L', '0.4 to 4.0', ['Thyroid stimulating hormone']),
      single('FSH', 'IU/L', undefined, ['Follicle stimulating hormone']),
      single('LH', 'IU/L', undefined, ['Luteinising hormone']),
      single('Prolactin', 'ng/mL', undefined),
      single('Progesterone', 'nmol/L', undefined, ['Day 21 progesterone']),
      single('Oestradiol', 'pmol/L', undefined, ['Estradiol', 'E2']),
      single('Testosterone', 'nmol/L', undefined),
      single('AMH', 'ng/mL', undefined, ['Anti Mullerian hormone']),
      single('PSA', 'ng/mL', 'Below 4.0', ['Prostate specific antigen']),
      single('Cortisol', 'nmol/L', undefined),
      {
        name: 'Fertility Hormone Profile',
        also: ['Hormonal profile', 'Female hormone profile'],
        fields: [
          { name: 'FSH', unit: 'IU/L' },
          { name: 'LH', unit: 'IU/L' },
          { name: 'Prolactin', unit: 'ng/mL' },
          { name: 'Progesterone', unit: 'nmol/L' },
          { name: 'Oestradiol', unit: 'pmol/L' },
        ],
      },
    ],
  },
  {
    name: 'Scans and tracings',
    tests: [
      {
        name: 'Pregnancy scan',
        also: ['Obstetric scan', 'Obstetric ultrasound', 'Pregnancy ultrasound'],
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
      report('Thyroid Scan', ['Neck ultrasound']),
      report('Prostate Scan', ['Prostate ultrasound']),
      report('Chest X-ray', ['CXR', 'X-ray']),
      report('ECG', ['Electrocardiogram']),
      report('Echocardiogram', ['Echo']),
    ],
  },
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
// One line per filled box: "Haemoglobin (Hb): 12.5 g/dL (usual 11.5 to 16.5)".
// Then the comment, if there is one.
export function composeResult(
  test: LabTest,
  values: Record<string, string>,
  comment: string,
): string {
  const lines: string[] = []
  for (const field of test.fields) {
    const value = (values[field.name] ?? '').trim()
    if (!value) continue
    let line = `${field.name}: ${value}`
    if (field.unit && !field.choices) line += ` ${field.unit}`
    if (field.range) line += ` (usual ${field.range})`
    lines.push(line)
  }
  if (comment.trim()) lines.push(`Comment: ${comment.trim()}`)
  return lines.join('\n')
}
