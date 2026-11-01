/**
 * DEMO QUALITY RECORDS for the QA Dashboard (Sunrise Heights, Tower A). Illustrative only:
 * nothing is saved, and every value here is demo data, not a real test or inspection result.
 *
 * Records are linked, not copied:
 *  - inspections and non-conformances join the shared site records (site.js: state.inspections,
 *    state.ncrs), so the Site Engineer, Site Supervisor and Project Manager see the same ones;
 *  - drawings / specifications are the shared document register (siteDemo DOCUMENTS);
 *  - material tests reference GRNs and POs in the shared inventory / purchase records by id only.
 *
 * Acceptance criteria are never written here as numbers: each checklist item points to the
 * approved drawing / specification that defines it. A checklist whose source document has no
 * approved revision stays a draft and cannot be used for an inspection.
 */
import { addDays, todayISO } from '../../utils/date.js'
import { PEOPLE } from './inventoryDemo.js'

const T = todayISO()
const ago = (n) => addDays(T, -n)
const ahead = (n) => addDays(T, n)
const at = (daysAgo, time = '10:00') => `${addDays(T, -daysAgo)}T${time}`

export const QA_LEAD = 'R. Banerjee' // the demo QA user (existing records name "QA: R. Banerjee")
const QA2 = 'S. Kulkarni'
const KJ = PEOPLE.engineerA // Karan Joshi, Site Engineer, Tower A
const RS = PEOPLE.supervisorA // Ravi Shinde, Site Supervisor, Tower A

/** People authorised to carry out QA inspections (company QA/QC and the appointed third-party agency). */
export const QA_INSPECTORS = [
  { name: QA_LEAD, org: 'QA/QC, BuildDesk', kind: 'QA' },
  { name: QA2, org: 'QA/QC, BuildDesk', kind: 'QA' },
  { name: 'TPI Labs', org: 'Third-party inspection agency', kind: 'Third-party' },
]

export const CHECKLIST_CATEGORIES = [
  'Foundation and excavation', 'Reinforcement and formwork', 'Concrete pouring', 'Masonry and plastering', 'Waterproofing',
  'Flooring and tiling', 'Painting and finishing', 'Electrical installation', 'Plumbing installation', 'Other',
]

// Criteria point to the approved source document; the inspector reads the requirement there.
const item = (id, text, criteria) => ({ id, item: text, criteria })
const cl = (id, category, title, basis, items, extra = {}) => ({ id, category, title, basis, items, version: 1, createdBy: QA_LEAD, createdAt: at(40, '10:00'), history: [{ at: at(40, '10:00'), by: QA_LEAD, role: 'QA Engineer', action: 'Checklist created' }], ...extra })
export const CHECKLISTS = [
  cl('CL-REB', 'Reinforcement and formwork', 'Reinforcement and formwork before concrete pour', ['ITP-02', 'S-102', 'S-101'], [
    item('1', 'Bar diameter, number and spacing', 'As shown on the approved structural drawing and bar bending schedule for the location'),
    item('2', 'Laps, anchorage and staggering', 'As per the approved structural drawing notes'),
    item('3', 'Cover blocks: size, spacing and fixing', 'Cover as specified on the approved structural drawing'),
    item('4', 'Column / wall starters: position and tying', 'As per the approved structural drawing'),
    item('5', 'Formwork: line, level, props and joints', 'As per approved method statement / drawing; inspector records measured values'),
    item('6', 'Embedded services (sleeves, earthing) in place', 'As per approved MEP drawings for the location'),
    item('7', 'Area clean, free of debris and standing water', 'ITP-02 hold-point requirement'),
  ]),
  cl('CL-CON', 'Concrete pouring', 'Concrete pour and curing', ['SP-03', 'MS-04'], [
    item('1', 'Pre-pour reinforcement inspection passed and cleared', 'Linked QA inspection passed with clearance recorded'),
    item('2', 'Delivery ticket: grade and mix as specified', 'Concrete works specification SP-03'),
    item('3', 'Fresh concrete tests (slump, temperature) recorded', 'Values and limits as per SP-03; record measured values'),
    item('4', 'Cube samples cast, tagged and logged', 'Sampling frequency as per SP-03'),
    item('5', 'Placing and compaction per method statement', 'Method statement MS-04'),
    item('6', 'Curing arranged', 'Curing method and duration as per SP-03'),
  ], { note: 'ITP-03 R1 (adds cube register sign-off) is under review; until it is approved this checklist follows SP-03 and MS-04.' }),
  cl('CL-EXC', 'Foundation and excavation', 'Excavation and founding level', ['S-101'], [
    item('1', 'Excavation size and depth', 'As per approved foundation drawing S-101 (latest approved revision)'),
    item('2', 'Founding strata', 'As stated in the approved soil investigation / structural notes'),
    item('3', 'Dewatering and edge protection', 'As per site method statement'),
  ]),
  cl('CL-ELE', 'Electrical installation', 'Earthing pits and conduit sleeves in foundation', ['E-101'], [
    item('1', 'Earthing pit locations', 'As per approved drawing E-101'),
    item('2', 'Conduit sleeves: size and position', 'As per approved drawing E-101'),
    item('3', 'Sleeves sealed and protected before pour', 'As per approved drawing E-101 notes'),
  ]),
  cl('CL-PLB', 'Plumbing installation', 'Underground drainage and sleeves', ['P-101'], [
    item('1', 'Pipe routes and levels', 'As per drawing P-101 (approval pending)'),
    item('2', 'Sleeves through foundation', 'As per drawing P-101 (approval pending)'),
  ]),
  cl('CL-MAS', 'Masonry and plastering', 'Brick masonry', [], [
    item('1', 'Brick quality and soaking', 'To be confirmed from the approved masonry specification'),
    item('2', 'Mortar mix', 'To be confirmed from the approved masonry specification'),
    item('3', 'Joints, plumb and line', 'To be confirmed from the approved masonry specification'),
  ], { note: 'No approved masonry specification in the document register yet: criteria must be confirmed before use.' }),
  cl('CL-WPF', 'Waterproofing', 'Waterproofing of sunken areas and terraces', [], [
    item('1', 'Surface preparation', 'To be confirmed from the approved waterproofing specification'),
    item('2', 'Membrane / coating application', 'To be confirmed from the approved waterproofing specification'),
    item('3', 'Flood / ponding test', 'To be confirmed from the approved waterproofing specification'),
  ]),
]

// ---------- Inspection requests (Site Supervisor ready → Site Engineer request → QA) ----------
const ev = (daysAgo, time, by, role, action, note = '') => ({ at: at(daysAgo, time), by, role, action, note })
const req = (id, o) => ({ id, projectId: 'P-101', siteId: 'S-01', photos: [], docs: [], drawingRefs: [], ...o })
export const QA_REQUESTS = [
  req('IR-1101', {
    location: 'Tower A, raft A5–A8', activity: 'Raft foundation reinforcement, grid A5–A8', taskId: 'TSK-105', checklistId: 'CL-REB', drawingRefs: ['S-102'],
    readiness: { by: RS, at: at(1, '17:00'), note: 'Bar tying complete; cover blocks placed' }, submittedBy: KJ, submittedAt: at(1, '18:00'), requiredDate: ahead(1),
    readinessConfirmed: true, docs: ['BBS raft A5–A8 rev 2'], status: 'Scheduled', inspectionId: 'QI-0410', note: 'Inspection needed before concrete pouring (TSK-106)',
    history: [ev(1, '17:00', RS, 'Site Supervisor', 'Work reported ready'), ev(1, '18:00', KJ, 'Site Engineer', 'Inspection requested'), ev(0, '09:15', QA_LEAD, 'QA Engineer', 'Inspection QI-0410 scheduled')],
  }),
  req('IR-1102', {
    location: 'Tower A, footings F7–F9', activity: 'Footing reinforcement F7–F9', taskId: 'TSK-103', checklistId: 'CL-REB', drawingRefs: ['S-101'],
    readiness: { by: RS, at: at(2, '16:30'), note: 'F7–F9 tied' }, submittedBy: KJ, submittedAt: at(2, '17:30'), requiredDate: T, readinessConfirmed: true,
    status: 'Scheduled', inspectionId: 'QI-0401', history: [ev(2, '16:30', RS, 'Site Supervisor', 'Work reported ready'), ev(2, '17:30', KJ, 'Site Engineer', 'Inspection requested'), ev(1, '10:00', QA_LEAD, 'QA Engineer', 'Inspection QI-0401 scheduled')],
  }),
  req('IR-1103', {
    location: 'Tower A, footings F10–F12', activity: 'Footing reinforcement F10–F12', taskId: 'TSK-103', checklistId: 'CL-REB', drawingRefs: ['S-101'],
    readiness: { by: RS, at: at(0, '09:00'), note: 'Ready after S-101 R2 change at F9–F12' }, submittedBy: KJ, submittedAt: at(0, '10:20'), requiredDate: ahead(2), readinessConfirmed: true,
    docs: ['Site instruction SI-012'], status: 'Submitted', history: [ev(0, '09:00', RS, 'Site Supervisor', 'Work reported ready'), ev(0, '10:20', KJ, 'Site Engineer', 'Inspection requested')],
  }),
  req('IR-1104', {
    location: 'Tower A, plinth grid A1–A4', activity: 'Plinth brick masonry, first lift', taskId: 'TSK-109', checklistId: null,
    readiness: { by: RS, at: at(0, '11:30'), note: 'First lift complete, curing started' }, requiredDate: ahead(3), readinessConfirmed: false,
    status: 'Ready – awaiting Site Engineer', history: [ev(0, '11:30', RS, 'Site Supervisor', 'Work reported ready', 'First lift complete, curing started')],
  }),
]

// ---------- QA inspections (join state.inspections) ----------
const pass = (cl, n = 7) => cl.slice(0, n).map((x) => ({ ...x, result: 'Pass', observation: '' }))
const REB = CHECKLISTS[0].items
const qa = (id, o) => ({
  id, projectId: 'P-101', siteId: 'S-01', owner: 'QA', checklist: [], tests: [], photos: [], ncrIds: [], notes: '', measurements: [], priority: 'Normal', attempt: 1,
  requestedBy: KJ, checklistId: 'CL-REB', drawingRefs: [], history: [], source: 'QA record (demo)', ...o,
})
const sched = (daysAgo, by = QA_LEAD) => ev(daysAgo, '09:00', by, 'QA Engineer', 'Inspection scheduled')
export const QA_INSPECTIONS = [
  // Today: two QA inspections (plus the third-party footing check QI-0202 from the existing records = three today)
  qa('QI-0401', { title: 'Footing reinforcement F7–F9 before pour', type: 'Reinforcement', location: 'Tower A, footings F7–F9', taskId: 'TSK-103', requestId: 'IR-1102', drawingRefs: ['S-101'], date: T, time: '10:30', inspector: QA_LEAD, priority: 'High', status: 'Scheduled', checklist: REB.map((x) => ({ ...x, result: null })), history: [sched(1)] }),
  qa('QI-0402', { title: 'Footing shuttering F7–F9', type: 'Finishing / formwork', location: 'Tower A, footings F7–F9', taskId: 'TSK-107', drawingRefs: ['S-101'], date: T, time: '14:30', inspector: QA2, status: 'Scheduled', checklist: REB.slice(4, 7).map((x) => ({ ...x, result: null })), history: [sched(2)] }),
  qa('QI-0403', { title: 'Earthing pits and conduit sleeves, raft A5–A8', type: 'Other', location: 'Tower A, raft A5–A8', taskId: 'TSK-105', checklistId: 'CL-ELE', drawingRefs: ['E-101'], date: ahead(1), time: '14:00', inspector: QA_LEAD, status: 'Scheduled', checklist: CHECKLISTS[3].items.map((x) => ({ ...x, result: null })), history: [sched(2)] }),
  // Yesterday: not yet recorded (pending)
  qa('QI-0404', { title: 'Curing check, footings F5–F6', type: 'Concrete', location: 'Tower A, footings F5–F6', taskId: 'TSK-104', checklistId: 'CL-CON', drawingRefs: ['SP-03'], date: ago(1), time: '11:00', inspector: QA2, status: 'Scheduled', checklist: CHECKLISTS[1].items.slice(5).map((x) => ({ ...x, result: null })), history: [sched(3)] }),
  // Failed: formwork needs correction → NCR-201 (correction done, awaiting QA verification)
  qa('QI-0405', {
    title: 'Footing shuttering F4–F6 before pour', type: 'Finishing / formwork', location: 'Tower A, footings F4–F6', taskId: 'TSK-107', drawingRefs: ['S-101'], date: ago(3), time: '10:00', inspector: QA_LEAD,
    status: 'Failed', result: 'Fail', recordedAt: at(3, '11:40'), ncrIds: ['NCR-201'],
    checklist: [{ ...REB[4], result: 'Fail', observation: 'Gaps at plywood joints, F5 east face; two props missing at F6' }, { ...REB[5], result: 'N/A', observation: '' }, { ...REB[6], result: 'Pass', observation: '' }],
    measurements: [{ name: 'Joint gap, F5 east face', value: 'Visible gap (demo observation)', ref: 'MS-04' }],
    notes: 'Formwork not ready: joints open and props missing. Pour on hold until corrected and reinspected.',
    history: [sched(5), ev(3, '11:40', QA_LEAD, 'QA Engineer', 'Result recorded: Fail', 'NCR-201 raised')],
  }),
  // Failed: masonry defect → NCR-202 (assigned, correction pending)
  qa('QI-0407', {
    title: 'Brickwork, store room partition walls', type: 'Masonry', location: 'Tower A, site office block, store room', taskId: 'TSK-110', checklistId: null, drawingRefs: ['A-101'], date: ago(5), time: '15:00', inspector: QA2,
    status: 'Failed', result: 'Fail', recordedAt: at(5, '16:10'), ncrIds: ['NCR-202'],
    checklist: [{ id: '1', item: 'Mortar joints filled', criteria: 'As per approved drawing A-101 notes', result: 'Fail', observation: 'Vertical joints not filled on two courses' }, { id: '2', item: 'Wall plumb', criteria: 'Inspector records measured value', result: 'Fail', observation: 'Out of plumb at corner (demo observation)' }],
    notes: 'Rework the affected courses.', history: [sched(7, QA2), ev(5, '16:10', QA2, 'QA Engineer', 'Result recorded: Fail', 'NCR-202 raised')],
  }),
  // Passed
  qa('QI-0408', { title: 'PCC levels, raft A5–A8', type: 'Levels & PCC', location: 'Tower A, raft A5–A8', taskId: 'TSK-102', checklistId: 'CL-EXC', drawingRefs: ['S-101'], date: ago(6), time: '10:00', inspector: QA_LEAD, status: 'Passed', result: 'Pass', recordedAt: at(6, '11:00'), checklist: pass(CHECKLISTS[2].items, 3), history: [sched(8), ev(6, '11:00', QA_LEAD, 'QA Engineer', 'Result recorded: Pass')] }),
  qa('QI-0409', {
    title: 'Footing reinforcement F1–F4 before pour', type: 'Reinforcement', location: 'Tower A, footings F1–F4', taskId: 'TSK-103', drawingRefs: ['S-101'], date: ago(14), time: '10:00', inspector: QA_LEAD, status: 'Passed', result: 'Pass', recordedAt: at(14, '11:30'),
    checklist: pass(REB), clearance: { activity: 'Concrete pour', by: QA_LEAD, at: at(14, '11:45'), note: 'Cleared for pour of F1–F4' },
    history: [sched(16), ev(14, '11:30', QA_LEAD, 'QA Engineer', 'Result recorded: Pass'), ev(14, '11:45', QA_LEAD, 'QA Engineer', 'QA clearance recorded: Concrete pour')],
  }),
  // Tomorrow: the raft reinforcement inspection requested before pouring
  qa('QI-0410', { title: 'Raft foundation reinforcement, grid A5–A8', type: 'Reinforcement', location: 'Tower A, raft A5–A8', taskId: 'TSK-105', requestId: 'IR-1101', drawingRefs: ['S-102'], date: ahead(1), time: '10:00', inspector: QA_LEAD, priority: 'High', status: 'Scheduled', checklist: REB.map((x) => ({ ...x, result: null })), history: [sched(0)] }),
]

// ---------- Non-conformances raised by QA (join state.ncrs) ----------
export const QA_NCRS = [
  {
    id: 'NCR-201', projectId: 'P-101', siteId: 'S-01', location: 'Tower A, footings F4–F6', fromInspection: 'QI-0405', category: 'Formwork', severity: 'Major',
    description: 'Shuttering F4–F6: open plywood joints at F5 and two props missing at F6', reported: ago(3), reportedBy: QA_LEAD, responsibleRole: 'Site Engineer', responsible: KJ,
    drawingRef: 'S-101', rootCause: 'Shuttering crew short; joints not taped before inspection', reinspectionRequired: true, status: 'Awaiting Verification',
    action: {
      id: 'CA-201', text: 'Seal joints, add the missing props, then request reinspection', owner: KJ, role: 'Site Engineer', due: ahead(1), priority: 'High', status: 'Done',
      progress: [{ at: at(2, '17:00'), by: KJ, note: 'Joints sealed with tape, props added at F6' }], evidence: ['Photo: F5 east face after sealing (demo)'], note: 'Joints sealed with tape, props added at F6',
    },
    history: [ev(3, '11:40', QA_LEAD, 'QA Engineer', 'NCR raised from QI-0405'), ev(3, '12:00', QA_LEAD, 'QA Engineer', 'Assigned to Karan Joshi (Site Engineer)'), ev(2, '17:00', KJ, 'Site Engineer', 'Correction completed', 'Joints sealed, props added')],
    source: 'QA record (demo)',
  },
  {
    id: 'NCR-202', projectId: 'P-101', siteId: 'S-01', location: 'Tower A, site office block, store room', fromInspection: 'QI-0407', category: 'Masonry', severity: 'Minor',
    description: 'Store room partition: vertical joints not filled on two courses; corner out of plumb', reported: ago(5), reportedBy: QA2, responsibleRole: 'Site Supervisor', responsible: RS,
    drawingRef: 'A-101', rootCause: '', reinspectionRequired: true, status: 'Assigned',
    action: { id: 'CA-202', text: 'Rake out and refill joints; rebuild the corner section', owner: RS, role: 'Site Supervisor', due: ahead(2), priority: 'Normal', status: 'Open', progress: [], evidence: [] },
    history: [ev(5, '16:10', QA2, 'QA Engineer', 'NCR raised from QI-0407'), ev(5, '16:20', QA2, 'QA Engineer', 'Assigned to Ravi Shinde (Site Supervisor)')],
    source: 'QA record (demo)',
  },
]

// ---------- Material quality & test records (references to GRN / PO only) ----------
const mt = (id, o) => ({ id, projectId: 'P-101', results: [], reportRef: '', reportFile: null, reviewer: null, history: [], ...o })
export const MATERIAL_TESTS = [
  mt('MT-501', {
    sku: 'MAT-CEM-53', grnId: 'GRN-7002', poId: 'PO-2310', batch: 'Week 41 dispatch (as on bags)', sampleRef: 'S-CEM-0412', testType: 'Manufacturer test certificate review', lab: 'Supplier certificate',
    sampleDate: ago(6), testDate: ago(5), reportRef: 'MTC CT/8840', reportFile: 'mtc-ct-8840.pdf', spec: 'SP-03', status: 'Report Received', recordedBy: QA_LEAD,
    results: [{ parameter: 'Certificate covers the delivered batch', value: 'Yes (demo)', unit: '' }],
    history: [ev(6, '13:00', QA_LEAD, 'QA Engineer', 'Sample / document registered against GRN-7002'), ev(5, '11:00', QA_LEAD, 'QA Engineer', 'Report received', 'MTC CT/8840')],
  }),
  mt('MT-502', {
    sku: 'MAT-CEM-53', grnId: 'GRN-7004', poId: 'PO-2314', batch: 'Lot 1 of 3', sampleRef: 'S-CEM-0418', testType: 'Cement mortar cube test (lab)', lab: 'TPI Labs',
    sampleDate: T, testDate: null, spec: 'SP-03', status: 'Awaiting Report', recordedBy: QA_LEAD,
    history: [ev(0, '10:30', QA_LEAD, 'QA Engineer', 'Sample taken and sent to TPI Labs', 'Lot 1 of PO-2314')],
  }),
  mt('MT-503', {
    sku: 'MAT-PLY-12', grnId: 'GRN-7001', poId: 'PO-2312', batch: 'FD/DN/1182', sampleRef: 'S-PLY-0399', testType: 'Visual and thickness check', lab: 'Site QA',
    sampleDate: ago(13), testDate: ago(13), reportRef: 'QA-VC-0399', spec: 'MS-04', status: 'Accepted', recordedBy: QA_LEAD, reviewer: QA_LEAD, reviewedAt: at(12, '10:00'), reviewNote: 'Accepted sheets fit for use; 4 warped sheets already rejected at the store (GRN-7001)',
    results: [{ parameter: 'Visual condition of accepted sheets', value: 'No warping (demo)', unit: '' }],
    history: [ev(13, '15:00', QA_LEAD, 'QA Engineer', 'Check recorded'), ev(12, '10:00', QA_LEAD, 'QA Engineer', 'Reviewed: Accepted')],
  }),
  mt('MT-504', {
    sku: 'MAT-BRK-RED', grnId: 'GRN-7005', poId: 'PO-2309', batch: 'SB/DN/311', sampleRef: 'S-BRK-0420', testType: 'Compressive strength and water absorption (lab)', lab: 'TPI Labs',
    sampleDate: T, testDate: null, spec: null, status: 'Sample Taken', recordedBy: QA2, history: [ev(0, '12:00', QA2, 'QA Engineer', 'Sample taken at the store (delivery awaiting store inspection)')],
  }),
  mt('MT-505', {
    sku: null, material: 'Concrete M25 (cube samples)', source: 'Pour cards PC-01, PC-02 · footings F1–F2', sampleRef: 'CUBE-F1F2-07D', testType: '7-day cube compressive strength', lab: 'TPI Labs',
    sampleDate: ago(9), testDate: ago(2), reportRef: 'TPI/CT/2291', reportFile: 'tpi-ct-2291.pdf', spec: 'SP-03', status: 'Report Received', recordedBy: QA_LEAD,
    results: [{ parameter: '7-day average (3 cubes)', value: 'As per attached report (demo)', unit: 'N/mm²' }],
    history: [ev(9, '16:00', QA_LEAD, 'QA Engineer', 'Cubes cast and logged'), ev(2, '14:00', QA_LEAD, 'QA Engineer', 'Report received', 'TPI/CT/2291')],
  }),
  mt('MT-506', {
    sku: 'MAT-STL-08', grnId: null, poId: 'PO-2302', batch: 'Heat no. on tags', sampleRef: 'MTC-STL-6533', testType: 'Mill test certificate review', lab: 'Supplier certificate',
    sampleDate: ago(57), testDate: ago(57), reportRef: 'MTC STEE/6533', spec: 'S-101', status: 'Accepted', recordedBy: QA_LEAD, reviewer: QA_LEAD, reviewedAt: at(56, '10:00'), reviewNote: 'Received before stock records began',
    results: [{ parameter: 'Certificate matches heat numbers on tags', value: 'Yes (demo)', unit: '' }],
    history: [ev(57, '12:00', QA_LEAD, 'QA Engineer', 'Certificate recorded'), ev(56, '10:00', QA_LEAD, 'QA Engineer', 'Reviewed: Accepted')],
  }),
]
export const TEST_TYPES = [
  'Manufacturer test certificate review', 'Mill test certificate review', 'Cement mortar cube test (lab)', '7-day cube compressive strength', '28-day cube compressive strength',
  'Slump test', 'Sieve analysis', 'Compressive strength and water absorption (lab)', 'Visual and thickness check', 'Other',
]
export const QA_PREFS = { requests: true, assigned: true, upcoming: true, failed: true, ncr: true, deadlines: true, reinspection: true, materials: true }
