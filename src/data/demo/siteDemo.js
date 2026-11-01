/**
 * DEMO SITE RECORDS for the Site Engineer Dashboard: assignments, BOQ, work schedule, daily
 * progress reports, measurements, inspections, safety, drawings, site issues, equipment, diary
 * and Project Manager instructions. Illustrative only; replace with API data in the backend phase.
 *
 * Records that already exist elsewhere are REUSED, not copied by hand:
 *  - quality inspections, defects, corrective actions, safety incidents / tasks, labour roster,
 *    attendance and labour requirements come from the Admin Dashboard fixtures (same ids);
 *  - material requests, stock, issues, GRNs and purchasing stay in the shared inventory state.
 */
import { addDays, todayISO } from '../../utils/date.js'
import { PEOPLE, PROJECT_MANAGERS } from './inventoryDemo.js'
import { labour as WORKERS } from '../mockData.js'
import {
  correctiveActions, defects, inspections as adminInspections, labourRequirements, safetyIncidents, safetyTasks,
} from './adminDashboardDemo.js'

const T = todayISO()
const ago = (n) => addDays(T, -n)
const ahead = (n) => addDays(T, n)
const at = (daysAgo, time = '10:00') => `${addDays(T, -daysAgo)}T${time}`
const PM = PROJECT_MANAGERS['P-101'] // Rahul Mehta
const KJ = PEOPLE.engineerA // Karan Joshi, Site Engineer Tower A (the demo user)
const MP = PEOPLE.engineerB // Meera Pillai, Site Engineer Tower B

/** Site of an existing record from its text ("… Tower B" → S-02); otherwise project-wide. */
const siteFromText = (text = '') => (/Tower A/i.test(text) ? 'S-01' : /Tower B/i.test(text) ? 'S-02' : /V-\d+|villa/i.test(text) ? 'S-03' : null)

// ---------- Assignments: which projects / sites each Site Engineer may see ----------
export const SITE_ASSIGNMENTS = [
  { engineer: KJ, projectId: 'P-101', siteIds: ['S-01'], since: ago(72), phone: '+91 98XXX XX201', email: 'karan.joshi@builddesk.example' },
  { engineer: MP, projectId: 'P-101', siteIds: ['S-02'], since: ago(60), phone: '+91 98XXX XX202', email: 'meera.pillai@builddesk.example' },
  { engineer: PEOPLE.engineerVillas, projectId: 'P-102', siteIds: ['S-03'], since: ago(120), phone: '+91 98XXX XX203', email: 'amol.patil@builddesk.example' },
]

// ---------- BOQ (approved quantities change only through an approved revision) ----------
const boq = (id, siteId, description, unit, approved, extra = {}) => ({ id, projectId: siteId === 'S-03' ? 'P-102' : 'P-101', siteId, description, unit, originalQty: approved, approvedQty: approved, revisions: [], ...extra })
export const BOQ_ITEMS = [
  boq('BOQ-A-01', 'S-01', 'Earthwork excavation in foundation, all soils, up to 4.5 m depth', 'Cu.m', 4200),
  boq('BOQ-A-02', 'S-01', 'PCC M10 (1:3:6) below footings, 100 mm thick', 'Cu.m', 120),
  boq('BOQ-A-03', 'S-01', 'RCC M25 in footings and raft (concrete only)', 'Cu.m', 100),
  boq('BOQ-A-04', 'S-01', 'Reinforcement steel Fe500D in footings and raft', 'Tonnes', 38, {
    originalQty: 36,
    revisions: [{ id: 'REV-01', from: 36, to: 38, reason: 'Extra dowels for column starters (structural RFI-07 response)', requestedBy: KJ, requestedAt: at(20, '11:00'), status: 'Approved', decidedBy: PM, decidedAt: at(18, '16:00') }],
  }),
  boq('BOQ-A-05', 'S-01', 'Shuttering to footings (plywood, including props)', 'Sq.m', 1600),
  boq('BOQ-A-06', 'S-01', 'Anti-termite treatment to foundation and plinth', 'Sq.m', 1350),
  boq('BOQ-A-07', 'S-01', 'Brick masonry in plinth, CM 1:6', 'Cu.m', 85),
  boq('BOQ-A-08', 'S-01', 'Brick masonry 115 mm in CM 1:4, site office and store room partitions', 'Sq.m', 100),
  boq('BOQ-B-01', 'S-02', 'Earthwork excavation in foundation, Tower B', 'Cu.m', 4300),
]

// ---------- Work schedule: tasks assigned by the Project Manager ----------
// `broughtForward` = quantity completed before the daily report register started (kept separately, never mixed with DPRs).
const task = (id, o) => ({ id, projectId: 'P-101', siteId: 'S-01', assignedBy: PM, priority: 'Normal', dependsOn: [], milestone: null, broughtForward: 0, delayReason: '', correctiveAction: '', siteNote: '', blocker: '', observations: [], ...o })
export const TASKS = [
  task('TSK-101', { title: 'Excavation to −4.5 m, grid A1–A8', description: 'Bulk excavation with JCB, trimming by hand, dewatering as needed', location: 'Tower A, full footprint', boqId: 'BOQ-A-01', plannedQty: 4200, start: ago(60), deadline: ago(22), broughtForward: 4200, milestone: 'Excavation complete' }),
  task('TSK-102', { title: 'PCC below footings F1–F12', description: 'M10 PCC, 100 mm, level to drawing S-101', location: 'Tower A, footings F1–F12', boqId: 'BOQ-A-02', plannedQty: 120, start: ago(24), deadline: ago(12), broughtForward: 120, dependsOn: ['TSK-101'] }),
  task('TSK-103', { title: 'Footing reinforcement F1–F12', description: 'Cut, bend and tie per BBS rev 2; cover blocks 50 mm', location: 'Tower A, footings F1–F12', boqId: 'BOQ-A-04', plannedQty: 22, start: ago(15), deadline: ago(3), broughtForward: 10, priority: 'High', dependsOn: ['TSK-102'],
    delayReason: '12 mm bars short at site store (MR-5012); bar benders 2 short', correctiveAction: 'Store to check MR-5012 and forward any shortage; borrow 2 bar benders from Tower B for 3 days',
    blocker: 'Remaining 12 mm steel delivery pending (MR-5012); rebar on F8–F12 stopped',
    observations: [{ at: at(3, '16:30'), by: KJ, kind: 'Blocker', text: 'Remaining 12 mm steel delivery pending (MR-5012); rebar on F8–F12 stopped', photos: [] }, { at: at(5, '11:00'), by: KJ, kind: 'Observation', text: 'Cover blocks 50 mm checked on F1–F4; spacing as per BBS rev 2', photos: [] }] }),
  task('TSK-104', { title: 'Footing concrete F1–F12 (RCC M25)', description: 'Pour in sequence F1→F12 after reinforcement inspection; cubes per pour', location: 'Tower A, footings F1–F12', boqId: 'BOQ-A-03', plannedQty: 60, start: ago(6), deadline: ahead(4), priority: 'High', dependsOn: ['TSK-103'] }),
  task('TSK-107', { title: 'Footing shuttering F1–F12', description: 'Plywood shuttering with props; check line and level before pour', location: 'Tower A, footings F1–F12', boqId: 'BOQ-A-05', plannedQty: 900, start: ago(10), deadline: T, broughtForward: 300, dependsOn: ['TSK-102'] }),
  task('TSK-105', { title: 'Raft foundation reinforcement, grid A5–A8', description: 'Bottom and top mesh, chairs at 1 m c/c', location: 'Tower A, raft A5–A8', boqId: 'BOQ-A-04', plannedQty: 16, start: ahead(2), deadline: ahead(12), dependsOn: ['TSK-103'] }),
  task('TSK-106', { title: 'Raft concrete pour, grid A5–A8', description: 'Continuous pour with 2 transit mixers and pump; curing 14 days', location: 'Tower A, raft A5–A8', boqId: 'BOQ-A-03', plannedQty: 40, start: ahead(12), deadline: ahead(16), dependsOn: ['TSK-105'], milestone: 'Foundation complete, Tower A', priority: 'High' }),
  task('TSK-108', { title: 'Anti-termite treatment, foundation', description: 'Chemical treatment to bottom and sides of excavation before backfill', location: 'Tower A, around footings', boqId: 'BOQ-A-06', plannedQty: 1350, start: ahead(3), deadline: ahead(8), dependsOn: ['TSK-104'] }),
  task('TSK-110', { title: 'Brickwork, site office & store room partitions', description: '115 mm brick partitions in CM 1:4; raking joints for plaster', location: 'Tower A, site office block', boqId: 'BOQ-A-08', plannedQty: 100, start: T, deadline: ahead(2), priority: 'Normal' }),
  task('TSK-109', { title: 'Plinth brick masonry', description: '230 mm brick masonry in CM 1:6 up to plinth', location: 'Tower A, plinth', boqId: 'BOQ-A-07', plannedQty: 85, start: ahead(18), deadline: ahead(35), dependsOn: ['TSK-106'], milestone: 'Plinth complete, Tower A' }),
  task('TSK-201', { siteId: 'S-02', title: 'Excavation Tower B to −4.5 m', description: 'Bulk excavation, Tower B', location: 'Tower B', boqId: 'BOQ-B-01', plannedQty: 4300, start: ago(30), deadline: ahead(6), broughtForward: 3100 }),
]

// ---------- Daily progress reports (DPR) ----------
// Quantities count towards progress once SUBMITTED (Submitted / Reviewed). Drafts and returned reports do not.
const dpr = (id, daysAgo, status, entries, extra = {}) => ({
  id, projectId: 'P-101', siteId: 'S-01', date: ago(daysAgo), entries, photos: [], problems: '', remarks: '', nextDayPlan: '', preparedBy: KJ,
  status, submittedAt: status !== 'Draft' ? at(daysAgo, '18:30') : null,
  reviewedBy: status === 'Reviewed' ? PM : null, reviewedAt: status === 'Reviewed' ? at(daysAgo - 1 < 0 ? 0 : daysAgo - 1, '10:00') : null, reviewNote: '',
  history: [
    ...(status !== 'Draft' ? [{ at: at(daysAgo, '18:30'), by: KJ, role: 'Site Engineer', action: 'Report submitted' }] : [{ at: at(daysAgo, '17:00'), by: KJ, role: 'Site Engineer', action: 'Draft saved' }]),
    ...(status === 'Reviewed' ? [{ at: at(Math.max(0, daysAgo - 1), '10:00'), by: PM, role: 'Project Manager', action: 'Reviewed' }] : []),
  ],
  ...extra,
})
const e = (taskId, qty, workers, status = 'In Progress') => ({ taskId, qty, workers, status })
export const DAILY_REPORTS = [
  dpr('DPR-1101', 7, 'Reviewed', [e('TSK-103', 2, 14), e('TSK-107', 60, 8)], { remarks: 'Rebar for F1–F3 complete', nextDayPlan: 'Continue F4–F6 rebar; shuttering F4' }),
  dpr('DPR-1102', 6, 'Reviewed', [e('TSK-103', 2, 14), e('TSK-107', 60, 8)], { nextDayPlan: 'Rebar F7, shuttering F5' }),
  dpr('DPR-1103', 5, 'Reviewed', [e('TSK-103', 2, 12), e('TSK-104', 8, 10), e('TSK-107', 60, 8)], { remarks: 'First footing pour F1 (8 cu.m); 6 cubes cast', nextDayPlan: 'Pour F2' }),
  dpr('DPR-1104', 4, 'Reviewed', [e('TSK-103', 2, 12), e('TSK-104', 7, 10), e('TSK-107', 60, 8)], { nextDayPlan: 'Pour F3' }),
  dpr('DPR-1105', 3, 'Reviewed', [e('TSK-103', 0, 4, 'Stopped'), e('TSK-104', 8, 10), e('TSK-107', 60, 8)], { problems: '12 mm bars not available at store; rebar on F8–F12 stopped', nextDayPlan: 'Pour F4; follow up MR-5012' }),
  dpr('DPR-1106', 2, 'Reviewed', [e('TSK-104', 6, 10), e('TSK-107', 60, 8)], { problems: 'Rebar still stopped for want of 12 mm bars', reviewNote: 'Noted. Purchase is following up PO-2316.' }),
  dpr('DPR-1107', 1, 'Submitted', [e('TSK-104', 6, 10), e('TSK-107', 60, 8)], { remarks: 'F6 poured; honeycombing at F3 repaired (CA-0011)', nextDayPlan: 'Pour F7 after rebar check; finish shuttering F12' }),
  dpr('DPR-1108', 0, 'Draft', [e('TSK-107', 40, 8)], { remarks: 'Shuttering F11 in progress' }),
  // Tower B (Meera Pillai): not visible to the Tower A engineer
  { ...dpr('DPR-2101', 1, 'Submitted', [e('TSK-201', 180, 22)]), siteId: 'S-02', preparedBy: MP, history: [{ at: at(1, '18:40'), by: MP, role: 'Site Engineer', action: 'Report submitted' }] },
]

// ---------- Measurement book (certifies executed work; never more than executed) ----------
const mb = (id, boqId, daysAgo, qty, details, status, extra = {}) => ({ id, boqId, date: ago(daysAgo), qty, details, sheetRef: `MB-TA/${id.slice(3)}`, photos: [], recordedBy: KJ, status, verifiedBy: status === 'Verified' ? PM : null, ...extra })
export const MEASUREMENTS = [
  mb('MB-401', 'BOQ-A-01', 24, 4200, 'Cross-sections at 5 m grid; level book LB-03 pages 12–18', 'Verified'),
  mb('MB-402', 'BOQ-A-02', 11, 120, '12 footings × avg 10.0 cu.m (L×B×0.1 m per drawing S-101)', 'Verified'),
  mb('MB-403', 'BOQ-A-04', 6, 16, 'Bar bending schedule rev 2, footings F1–F8 (weighbridge slips)', 'Verified'),
  mb('MB-404', 'BOQ-A-03', 4, 15, 'F1 8.0 + F2 7.0 cu.m (from pour cards PC-01, PC-02)', 'Verified'),
  mb('MB-405', 'BOQ-A-03', 2, 12, 'F3 8.0 + F4 4.0 cu.m part (pour cards PC-03, PC-04)', 'Verified'),
  mb('MB-406', 'BOQ-A-03', 0, 8, 'F4 balance 4.0 + F5 4.0 cu.m (pour cards PC-04, PC-05)', 'Pending Verification'),
]

// ---------- Quality: inspections (existing QA / third-party records + engineer's own) ----------
const INSPECTION_TYPE = (text) => (/concrete|cube/i.test(text) ? 'Concrete' : /reinforcement|rebar/i.test(text) ? 'Reinforcement' : /masonry/i.test(text) ? 'Masonry' : /PCC|level/i.test(text) ? 'Levels & PCC' : /excavation|soil/i.test(text) ? 'Excavation & soil' : 'Other')
export const INSPECTIONS = [
  // Existing records from the Admin Dashboard (QA / third-party inspectors own these)
  ...adminInspections.map((q) => ({
    id: q.id, projectId: q.projectId, siteId: siteFromText(q.item), title: q.item, type: INSPECTION_TYPE(q.item), location: siteFromText(q.item) === 'S-01' ? 'Tower A' : siteFromText(q.item) === 'S-02' ? 'Tower B' : 'Project-wide',
    date: q.date, inspector: q.inspector, owner: q.inspector.startsWith('QA') ? 'QA' : 'Third-party', status: q.status, checklist: [], tests: [], photos: [], ncrIds: [], notes: '', source: 'Admin Dashboard record',
  })),
  // Technical inspections recorded by the Site Engineer (await QA review)
  {
    id: 'QI-0301', projectId: 'P-101', siteId: 'S-01', title: 'Reinforcement check before pour, F5–F6', type: 'Reinforcement', location: 'Tower A, F5–F6', date: ago(3), inspector: KJ, owner: 'Site Engineer',
    checklist: [
      { item: 'Bar dia and spacing as per BBS rev 2', result: 'Pass' }, { item: 'Cover blocks 50 mm in place', result: 'Pass' },
      { item: 'Lap length ≥ 50d and staggered', result: 'Pass' }, { item: 'Column starters aligned and tied', result: 'Pass' }, { item: 'Formwork clean, no debris', result: 'Pass' },
    ],
    tests: [], photos: [], ncrIds: [], status: 'Passed', reviewStatus: 'Awaiting QA review', notes: 'Cleared for pour', recordedAt: at(3, '09:30'),
  },
  {
    id: 'QI-0302', projectId: 'P-101', siteId: 'S-01', title: 'Fresh concrete slump test, footing F6', type: 'Concrete', location: 'Tower A, F6', date: ago(1), inspector: KJ, owner: 'Site Engineer',
    checklist: [{ item: 'Delivery ticket matches M25 mix', result: 'Pass' }, { item: 'Slump within 75–100 mm', result: 'Pass' }, { item: '6 cubes cast and tagged', result: 'Pass' }],
    tests: [{ name: 'Slump', value: '90 mm', spec: '75–100 mm', result: 'Pass' }, { name: 'Concrete temperature', value: '29 °C', spec: '≤ 32 °C', result: 'Pass' }],
    photos: [], ncrIds: [], status: 'Passed', reviewStatus: 'Awaiting QA review', notes: '', recordedAt: at(1, '12:15'),
  },
  {
    id: 'QI-0303', projectId: 'P-101', siteId: 'S-01', title: 'Shuttering line & level check, F7–F9', type: 'Finishing / formwork', location: 'Tower A, F7–F9', date: ahead(1), inspector: KJ, owner: 'Site Engineer',
    checklist: [{ item: 'Line and level within ±5 mm', result: null }, { item: 'Props at 0.9 m c/c, braced', result: null }, { item: 'Joints sealed', result: null }],
    tests: [], photos: [], ncrIds: [], status: 'Scheduled', reviewStatus: null, notes: '',
  },
]

// Non-conformances: existing defects with their corrective actions (same ids as the Admin Dashboard)
export const NCRS = defects.map((d) => {
  const ca = correctiveActions.find((c) => c.defectId === d.id)
  return {
    id: d.id, projectId: d.projectId, siteId: siteFromText(d.description) || (d.projectId === 'P-101' && /F\d|C7|raft/.test(d.description) ? 'S-01' : null),
    description: d.description, severity: d.severity, reported: d.reported, status: d.status,
    action: ca ? { id: ca.id, text: ca.action, owner: ca.owner, due: ca.due, status: ca.status } : null,
    reinspectionDate: ca ? ca.due : null, source: 'Admin Dashboard record',
  }
})

// ---------- Safety: existing incidents and safety tasks + engineer observations ----------
export const SAFETY = [
  ...safetyIncidents.map((s) => ({
    id: s.id, projectId: s.projectId, siteId: siteFromText(s.description), kind: s.type, severity: s.type === 'Near miss' || s.type === 'First aid' ? 'Medium' : 'High',
    description: s.description, location: '', date: s.date, reportedBy: 'Site team', action: '', actionOwner: '', actionDue: null,
    status: s.status === 'Closed' ? 'Verified closed' : 'Open', escalation: s.status === 'Closed' ? null : 'Project Manager', photos: [], source: 'Admin Dashboard record',
    history: [{ at: `${s.date}T12:00`, by: 'Site team', role: '', action: `${s.type} reported` }],
  })),
  {
    id: 'SO-401', projectId: 'P-101', siteId: 'S-01', kind: 'Hazard', severity: 'High', description: 'Unprotected rebar ends (starter bars) along ramp walkway at F9–F12', location: 'Tower A, ramp side',
    date: ago(1), reportedBy: KJ, action: 'Fit rebar caps on all starters; re-route walkway', actionOwner: PEOPLE.supervisorA, actionDue: T, status: 'Open', escalation: 'Project Manager', photos: [],
    history: [{ at: at(1, '15:20'), by: KJ, role: 'Site Engineer', action: 'Hazard reported', note: 'High priority: impalement risk' }],
  },
  {
    id: 'SO-402', projectId: 'P-101', siteId: 'S-01', kind: 'PPE compliance', severity: 'Medium', description: '3 carpenters working on shuttering edge without safety harness', location: 'Tower A, F10',
    date: ago(2), reportedBy: KJ, action: 'Stop work until harness issued; toolbox talk on working at edge', actionOwner: PEOPLE.supervisorA, actionDue: ago(1), status: 'Action done', escalation: null, photos: [],
    history: [{ at: at(2, '11:00'), by: KJ, role: 'Site Engineer', action: 'Observation reported' }, { at: at(1, '17:00'), by: KJ, role: 'Site Engineer', action: 'Corrective action done; awaiting safety verification' }],
  },
  {
    id: 'SO-403', projectId: 'P-101', siteId: 'S-01', kind: 'Housekeeping', severity: 'Low', description: 'Cut binding wire and plywood offcuts scattered near F2–F4', location: 'Tower A',
    date: T, reportedBy: KJ, action: 'Daily clean-up at 5 pm by helpers', actionOwner: PEOPLE.supervisorA, actionDue: ahead(1), status: 'Open', escalation: null, photos: [],
    history: [{ at: at(0, '09:10'), by: KJ, role: 'Site Engineer', action: 'Observation reported' }],
  },
]
SAFETY.push({
  id: 'SO-404', projectId: 'P-101', siteId: 'S-01', kind: 'Safety observation', severity: 'Medium', description: 'Loose scaffold board on the F10 shuttering platform', location: 'Tower A, F10 edge',
  date: ago(2), reportedBy: PEOPLE.supervisorA, immediateAction: 'Area cordoned; board removed and replaced by carpenters', action: 'Daily scaffold check by shuttering foreman', actionOwner: PEOPLE.supervisorA, actionDue: ago(1),
  status: 'Action done', escalation: 'Site Engineer', photos: [],
  history: [{ at: at(2, '10:05'), by: PEOPLE.supervisorA, role: 'Site Supervisor', action: 'Safety observation reported', note: 'Immediate action: area cordoned, board replaced' }, { at: at(1, '17:30'), by: PEOPLE.supervisorA, role: 'Site Supervisor', action: 'Corrective action done; awaiting safety verification' }],
})
export const SAFETY_ACTIONS = safetyTasks.map((t) => ({ ...t, siteId: siteFromText(t.task), source: 'Admin Dashboard record' }))

// ---------- Drawings & documents (a revision is "Approved" only with a recorded approval) ----------
const rev = (r, daysAgo, status, approvedBy = null, note = '') => ({ rev: r, date: ago(daysAgo), status, approvedBy, approvedAt: approvedBy ? at(daysAgo, '15:00') : null, note })
const UPLOADER = { Architectural: 'Design coordinator', Structural: 'Design coordinator', Electrical: 'MEP coordinator', Plumbing: 'MEP coordinator', 'Inspection checklist': 'QA/QC engineer' }
const doc = (id, discipline, title, revisions, extra = {}) => ({ id, projectId: 'P-101', siteId: 'S-01', discipline, title, revisions, file: null, uploadedBy: UPLOADER[discipline] || 'Project office', ...extra })
export const DOCUMENTS = [
  doc('A-101', 'Architectural', 'Ground floor plan, Tower A', [rev('R0', 90, 'Superseded', 'Arch. S. Kale'), rev('R1', 40, 'Approved', 'Arch. S. Kale', 'Lift lobby revised')]),
  doc('A-201', 'Architectural', 'Typical floor plan, Tower A', [rev('R0', 90, 'Approved', 'Arch. S. Kale')]),
  doc('S-101', 'Structural', 'Foundation layout and footing schedule, Tower A', [rev('R0', 80, 'Superseded', 'Struct. consultant'), rev('R1', 35, 'Superseded', 'Struct. consultant', 'F9 depth revised'), rev('R2', 9, 'Approved', 'Struct. consultant', 'F9–F12 size increased')]),
  doc('S-102', 'Structural', 'Raft reinforcement details, grid A5–A8', [rev('R0', 30, 'Approved', 'Struct. consultant'), rev('R1', 2, 'Under Review', null, 'Additional top mesh: NOT for construction until approved')]),
  doc('S-110', 'Structural', 'Column starter and plinth beam layout', [rev('R0', 25, 'Approved', 'Struct. consultant')]),
  doc('E-101', 'Electrical', 'Earthing pits and conduit sleeves in foundation', [rev('R0', 20, 'Approved', 'MEP consultant')]),
  doc('P-101', 'Plumbing', 'Underground drainage and sleeves, Tower A', [rev('R0', 18, 'Under Review', null, 'Awaiting MEP sign-off')]),
  doc('SP-03', 'Specification', 'Concrete works specification (M25, curing, cubes)', [rev('R0', 70, 'Approved', 'Project Manager')]),
  doc('BOQ-TA', 'BOQ', 'Bill of quantities, Tower A substructure', [rev('R0', 75, 'Superseded', 'Project Manager'), rev('R1', 18, 'Approved', 'Project Manager', 'Steel 36 → 38 T (REV-01)')]),
  doc('MS-04', 'Method statement', 'Raft concreting: pour sequence, pump and curing', [rev('R0', 6, 'Approved', 'Project Manager')]),
  doc('SI-012', 'Site instruction', 'Stop rebar work at F9–F12 until S-101 R2 is followed', [rev('R0', 9, 'Approved', 'Project Manager')]),
  doc('ITP-02', 'Inspection checklist', 'Reinforcement before concrete pour: inspection checklist', [rev('R0', 40, 'Approved', 'QA/QC manager')]),
  doc('ITP-03', 'Inspection checklist', 'Concrete pour and curing: inspection checklist', [rev('R0', 40, 'Superseded', 'QA/QC manager'), rev('R1', 4, 'Under Review', null, 'Adds cube register sign-off: draft')]),
  doc('RA-01', 'Risk assessment', 'Risk assessment: work at height (shuttering and scaffolds), Tower A', [rev('R0', 50, 'Superseded', 'Project Manager'), rev('R1', 12, 'Approved', 'Project Manager', 'Added F9–F12 edge protection')], { uploadedBy: 'Safety Officer' }),
  doc('RA-02', 'Risk assessment', 'Risk assessment: hot work near shuttering', [rev('R0', 3, 'Under Review', null, 'Draft for column starter welding')], { uploadedBy: 'Safety Officer' }),
  doc('SP-01', 'Safety plan', 'Site safety plan and emergency arrangements, Sunrise Heights', [rev('R0', 80, 'Approved', 'Project Manager')], { siteId: null, uploadedBy: 'Safety Officer' }),
  doc('S-201', 'Structural', 'Foundation layout, Tower B', [rev('R0', 60, 'Approved', 'Struct. consultant')], { siteId: 'S-02' }),
]
export const DOC_DISCIPLINES = ['Architectural', 'Structural', 'Electrical', 'Plumbing', 'Specification', 'BOQ', 'Method statement', 'Site instruction', 'Inspection checklist', 'Risk assessment', 'Safety plan']
/** Register category shown to the engineer (Electrical and Plumbing are MEP drawings) */
export const docCategory = (discipline) => ({ Architectural: 'Architectural drawing', Structural: 'Structural drawing', Electrical: 'MEP drawing', Plumbing: 'MEP drawing' }[discipline] || discipline)

// ---------- Site issues & blockers ----------
const issue = (id, o) => ({ id, projectId: 'P-101', siteId: 'S-01', reportedBy: KJ, photos: [], comments: [], escalated: false, resolution: '', resolvedAt: null, dueBy: null, ...o })
export const SITE_ISSUES = [
  issue('ISS-601', { category: 'Material shortage', title: 'TMT steel delivery delayed: 12 mm bars short for footings F8–F12', description: 'Only part of the 12 mm steel is at Tower A store; 12 T needed (MR-5012). Rebar gang idle since 3 days.', priority: 'High', reported: ago(3), dueBy: ahead(1),
    assignee: { role: 'Purchase Manager', name: PEOPLE.purchaseManager }, impact: 'Raft and footing reinforcement work may stop; pours F8–F12 at risk', proposed: 'Expedite PO-2316 or transfer 4 T from Central Warehouse', status: 'In Progress', escalated: true, links: ['MR-5012', 'PO-2316'],
    comments: [{ at: at(3, '12:00'), by: KJ, role: 'Site Engineer', text: 'Raised; supplier follow-up with the Purchase Manager, schedule impact escalated to the Project Manager.' }, { at: at(2, '10:00'), by: PEOPLE.purchaseManager, role: 'Purchase Manager', text: 'PO-2316 awaiting Admin approval; asked supplier to keep stock ready.' }] }),
  issue('ISS-602', { category: 'Drawing clarification', title: 'Footing F9 depth: drawing vs soil report', description: 'S-101 R1 shows F9 at −4.2 m; soil report needs −4.5 m for bearing. R2 issued with revised size; confirm depth.', priority: 'Medium', reported: ago(10),
    assignee: { role: 'Project Manager', name: PM }, impact: 'F9 excavation on hold 2 days', proposed: 'Follow S-101 R2', status: 'Resolved', resolution: 'S-101 R2 approved: F9 at −4.5 m, size increased.', resolvedAt: ago(9), links: ['S-101'],
    comments: [{ at: at(9, '15:00'), by: PM, role: 'Project Manager', text: 'R2 approved by consultant. Proceed.' }] }),
  issue('ISS-603', { category: 'Equipment problem', title: 'Needle vibrator #2 not starting', description: 'Engine does not start; one vibrator left for pours.', priority: 'Medium', reported: ago(1), dueBy: ahead(2),
    assignee: { role: 'Admin', name: PEOPLE.admin }, impact: 'Pour rate reduced; risk to F7 pour tomorrow', proposed: 'Repair or hire one vibrator for 2 weeks', status: 'Open', links: ['EQ-05'] }),
  issue('ISS-604', { category: 'Labour shortage', title: 'Bar benders: 2 short for raft rebar', description: '14 of 16 bar benders present on average; raft rebar starts in 2 days.', priority: 'Medium', reported: ago(2), dueBy: ahead(2),
    assignee: { role: 'Site Supervisor', name: PEOPLE.supervisorA }, impact: 'Raft reinforcement may slip 2 days', proposed: 'Labour contractor to add 2 bar benders (LR-0121)', status: 'Open', links: ['LR-0121'] }),
  issue('ISS-605', { reportedBy: PEOPLE.supervisorA, reporterRole: 'Site Supervisor', category: 'Work-area obstruction', title: 'Excavated soil heap blocking access to F11–F12', description: 'Spoil heap from the drain trench blocks barrow access to F11–F12; masons carrying by hand.', priority: 'Medium', reported: ago(1), dueBy: ahead(1), workArea: 'Tower A, F11–F12',
    assignee: { role: 'Site Engineer', name: KJ }, impact: 'Shuttering at F11 slowed', proposed: 'Shift heap with JCB after 4 pm', status: 'Open',
    comments: [{ at: at(1, '11:10'), by: PEOPLE.supervisorA, role: 'Site Supervisor', text: 'Raised.' }] }),
  issue('ISS-701', { siteId: 'S-02', reportedBy: MP, category: 'Weather delay', dueBy: ahead(1), title: 'Water logging in Tower B pit', description: 'Dewatering pump undersized after rain.', priority: 'High', reported: ago(4),
    assignee: { role: 'Project Manager', name: PM }, impact: 'Excavation stopped 1 day', proposed: 'Second pump', status: 'In Progress' }),
]
export const ISSUE_CATEGORIES = ['Material shortage', 'Labour shortage', 'Equipment problem', 'Drawing clarification', 'Quality defect', 'Safety concern', 'Weather delay', 'Work-area obstruction', 'Scheduling conflict', 'Other']

// ---------- Equipment & machinery (hired items reference the existing hire PO-2311) ----------
const eq = (id, name, category, o) => ({ id, name, category, projectId: 'P-101', siteId: 'S-01', ownership: 'Company owned', status: 'Working', hoursPerDay: 8, ...o })
export const EQUIPMENT = [
  eq('EQ-01', 'JCB 3DX backhoe loader', 'Earthmoving', { ownership: 'Hired (PO-2311, Earthmovers Rentals)', hoursPerDay: 9 }),
  eq('EQ-02', 'Tipper 10 T #1', 'Transport', { ownership: 'Hired (PO-2311, Earthmovers Rentals)', status: 'Idle', note: 'Excavation done; release planned' }),
  eq('EQ-03', 'Tipper 10 T #2', 'Transport', { ownership: 'Hired (PO-2311, Earthmovers Rentals)', siteId: 'S-02' }),
  eq('EQ-04', 'Concrete mixer 10/7 with hopper', 'Concreting'),
  eq('EQ-05', 'Needle vibrator #2 (petrol)', 'Concreting', { status: 'Breakdown', note: 'Engine not starting (ISS-603)' }),
  eq('EQ-06', 'Needle vibrator #1 (electric)', 'Concreting'),
  eq('EQ-07', 'Bar bending & cutting machine', 'Reinforcement'),
  eq('EQ-08', 'Dewatering pump 5 HP', 'Pumps', { siteId: 'S-02' }),
]
// Daily usage log (hours worked / downtime) for the last 7 days
export const EQUIPMENT_LOGS = EQUIPMENT.flatMap((q, i) => Array.from({ length: 7 }, (_, d) => {
  const day = 7 - d
  const broken = q.id === 'EQ-05' && day <= 1
  const idle = q.id === 'EQ-02' && day <= 3
  const hours = broken || idle ? 0 : Math.max(0, q.hoursPerDay - ((i + d) % 3))
  return { id: `EL-${q.id}-${day}`, equipmentId: q.id, date: ago(day), hours, downtime: broken ? q.hoursPerDay : (i + d) % 5 === 0 ? 1.5 : 0, reason: broken ? 'Breakdown' : idle ? 'Idle (no work)' : (i + d) % 5 === 0 ? 'Minor repair' : '' }
}))
export const EQUIPMENT_REQUESTS = [
  { id: 'EQR-01', kind: 'Requirement', equipmentId: null, name: 'Concrete pump (boom) for raft pour', projectId: 'P-101', siteId: 'S-01', from: ahead(12), to: ahead(13), note: '40 cu.m continuous pour, A5–A8', status: 'Requested', requestedBy: KJ, at: at(1, '16:00') },
  { id: 'EQR-03', kind: 'Requirement', equipmentId: null, name: 'Tower crane (structure stage, Tower A)', projectId: 'P-101', siteId: 'S-01', from: ahead(30), to: ahead(300), note: 'Erect after raft; foundation bolts to be cast with raft A5–A8', status: 'Requested', requestedBy: KJ, at: at(5, '11:00') },
  { id: 'EQR-02', kind: 'Breakdown', equipmentId: 'EQ-05', name: 'Needle vibrator #2 (petrol)', projectId: 'P-101', siteId: 'S-01', from: ago(1), to: null, note: 'Engine not starting', status: 'Reported', requestedBy: KJ, at: at(1, '09:00') },
]

// ---------- Daily site diary (materials come from store records; never typed in twice) ----------
const diary = (id, daysAgo, o) => ({ id, projectId: 'P-101', siteId: 'S-01', date: ago(daysAgo), preparedBy: KJ, status: 'Submitted', photos: [], visitors: '', instructions: '', delays: '', safety: '', remarks: '', ...o })
export const DIARY = [
  diary('DRY-301', 3, { weather: 'Clear, 31 °C', activities: 'Pour F4 (8 cu.m); shuttering F8; rebar stopped (12 mm short)', delays: 'Rebar F8–F12 stopped: steel shortage', visitors: 'Structural consultant (S-101 R2 site check)', safety: 'Toolbox talk: working at edge' }),
  diary('DRY-302', 2, { weather: 'Light rain in the morning, 27 °C', activities: 'Pour F5 (6 cu.m) after 11 am; shuttering F9', delays: 'Pour delayed 2 h by rain', instructions: 'PM: keep cubes for 28-day test per SP-03', safety: 'PPE observation SO-402' }),
  diary('DRY-303', 1, { weather: 'Clear, 30 °C', activities: 'Pour F6 (6 cu.m); shuttering F10; honeycomb repair F3', safety: 'Hazard SO-401 reported: rebar caps', remarks: 'Vibrator #2 broke down' }),
  diary('DRY-304', 0, { weather: 'Clear, 31 °C', activities: 'Shuttering F11', status: 'Draft' }),
  diary('DRY-305', 1, { preparedBy: PEOPLE.supervisorA, role: 'Site Supervisor', weather: 'Clear, 30 °C (as observed on site)', workersPresent: 23, activities: 'F6 pour with masonry gang; shuttering F10', equipment: 'Mixer 10/7, vibrator #1', delays: 'Vibrator #2 not starting (ISS-603)', safety: 'Toolbox talk on edge protection', instructions: 'KJ: cubes for every pour', tomorrow: 'Shuttering F11; start site office brickwork', status: 'Submitted' }),
]

// ---------- Project Manager instructions and clarification requests ----------
export const MESSAGES = [
  { id: 'INS-031', kind: 'Instruction', projectId: 'P-101', siteId: 'S-01', from: PM, to: KJ, at: at(4, '09:00'), subject: 'Pour sequence F7–F12', text: 'Pour F7–F12 only after QA rebar check; max 2 footings per day; cubes for every pour.', status: 'Acknowledged', replies: [{ at: at(4, '10:00'), by: KJ, text: 'Acknowledged.' }] },
  { id: 'INS-032', kind: 'Instruction', projectId: 'P-101', siteId: 'S-01', from: PM, to: KJ, at: at(0, '08:30'), subject: 'Raft pour readiness', text: 'Share pump booking and labour plan for the raft pour by Thursday.', status: 'Open', replies: [] },
  { id: 'CLR-011', kind: 'Clarification', projectId: 'P-101', siteId: 'S-01', from: KJ, to: PM, at: at(2, '14:00'), subject: 'S-102 R1 top mesh', text: 'S-102 R1 adds top mesh but is under review. Proceed with R0 for A5–A6?', status: 'Open', replies: [], ref: 'S-102' },
  { id: 'INS-041', kind: 'Instruction', projectId: 'P-101', siteId: 'S-02', from: PM, to: MP, at: at(1, '09:00'), subject: 'Tower B dewatering', text: 'Hire a second pump.', status: 'Open', replies: [] },
]

// ---------- Labour coordination (requests to the Site Supervisor / PM; no payroll here) ----------
export const LABOUR_REQUESTS = [
  ...labourRequirements.map((r) => ({ id: r.id, kind: 'Requirement', projectId: r.projectId, siteId: siteFromText(r.note), category: r.category, qty: r.qty, note: r.note, neededBy: r.neededBy, requestedBy: r.requestedBy, status: r.status, source: 'Admin Dashboard record' })),
  { id: 'OT-0011', kind: 'Overtime', projectId: 'P-101', siteId: 'S-01', category: 'Bar Bender', qty: 6, hours: 3, note: 'Overtime to recover footing rebar delay (F8–F12)', neededBy: ahead(1), requestedBy: KJ, status: 'Pending' },
]

export const NOTIFICATION_PREFS = { materialUpdates: true, instructions: true, inspections: true, issues: true, safety: true, dailyDigest: false }

// ---------- Site contacts ----------
export const SITE_CONTACTS = {
  'S-01': [
    { role: 'Site office (Tower A)', name: 'Site office', phone: '+91 20 4000 2101' },
    { role: 'Site Supervisor', name: PEOPLE.supervisorA, phone: '+91 98XXX XX301' },
    { role: 'Store Keeper', name: PEOPLE.storeKeeper, phone: '+91 98XXX XX302' },
    { role: 'Project Manager', name: PM, phone: '+91 98XXX XX300' },
    { role: 'Emergency (first aid / ambulance)', name: 'Site first-aid room · 108', phone: '108' },
  ],
  'S-02': [{ role: 'Site Supervisor', name: PEOPLE.supervisorB, phone: '+91 98XXX XX311' }],
  'S-03': [{ role: 'Owners help desk', name: PEOPLE.engineerVillas, phone: '+91 98XXX XX321' }],
}

// ---------- Labour: crew needed per task (planning) and today's allocation by the Site Supervisor ----------
export const TASK_CREWS = {
  'TSK-103': { 'Bar Bender': 12, Helper: 4 },
  'TSK-104': { Mason: 4, Helper: 10, 'Machine Operator': 2 },
  'TSK-107': { Carpenter: 8, Helper: 4 },
  'TSK-105': { 'Bar Bender': 16, Helper: 6 },
  'TSK-106': { Mason: 6, Helper: 20, 'Machine Operator': 3 },
  'TSK-108': { Helper: 4 },
  'TSK-109': { Mason: 12, Helper: 12 },
  'TSK-201': { 'Machine Operator': 2, Helper: 18 },
}
// Recorded by the Site Supervisor from the day's muster (Site Engineer views only)
export const LABOUR_ALLOCATION = [
  { siteId: 'S-01', date: T, by: PEOPLE.supervisorA, crews: { 'Bar Bender': 10, Mason: 4, Carpenter: 8, Helper: 18, 'Machine Operator': 2, Welder: 1, Electrician: 1, Plumber: 0 },
    notes: 'Bar benders on F8–F10 rebar (2 absent); masons + helpers on F7 pour prep; carpenters on F11 shuttering' },
  { siteId: 'S-02', date: T, by: PEOPLE.supervisorB, crews: { Helper: 12, 'Machine Operator': 2 }, notes: 'Excavation' },
]

// ---------- Weather-related work restrictions ----------
export const WEATHER_RESTRICTIONS = [
  { id: 'WX-11', projectId: 'P-101', siteId: 'S-01', date: T, condition: 'Thunderstorm forecast 3 pm – 6 pm (IMD)', restriction: 'No concreting after 2 pm; stop work at height and lifting; cover cement and open rebar', status: 'Active', by: KJ, at: at(0, '07:30') },
  { id: 'WX-10', projectId: 'P-101', siteId: 'S-01', date: ago(2), condition: 'Morning rain', restriction: 'Pour F5 held until 11 am; dewater pits before concreting', status: 'Lifted', by: KJ, at: at(2, '07:15') },
]


// ---------- Site Supervisor records (Ravi Shinde, Tower A) ----------
// Attendance: one record per worker, site and date. Today: 25 expected, 22 present, 2 absent, 1 on leave.
const SUP = PEOPLE.supervisorA
const towerA = WORKERS.filter((w) => w.siteId === 'S-01')
const TODAY_ABSENT = ['L-03', 'L-13']
const TODAY_LEAVE = ['L-19']
function dayStatus(w, daysAgo) {
  if (daysAgo === 0) return TODAY_ABSENT.includes(w.id) ? 'Absent' : TODAY_LEAVE.includes(w.id) ? 'On Leave' : 'Present'
  const n = (Number(w.id.slice(2)) * 7 + daysAgo * 3) % 23
  return n === 0 ? 'Absent' : n === 1 ? 'Half Day' : 'Present'
}
export const ATTENDANCE_RECORDS = [6, 5, 4, 3, 2, 1, 0].flatMap((d) => {
  if (new Date(`${ago(d)}T00:00`).getDay() === 0) return [] // Sunday: site closed
  return towerA.map((w) => {
    const status = dayStatus(w, d)
    const works = status === 'Present' || status === 'Half Day'
    return {
      id: `ATT-${ago(d)}-${w.id}`, workerId: w.id, projectId: 'P-101', siteId: 'S-01', date: ago(d), status,
      workArea: w.team.replace(/ A$/, ''), checkIn: works ? (w.id === 'L-14' && d === 0 ? '08:40' : '08:00') : '', checkOut: works && d > 0 ? (status === 'Half Day' ? '12:30' : '17:30') : '',
      remarks: w.id === 'L-14' && d === 0 ? 'Late: bus delay' : TODAY_LEAVE.includes(w.id) && d === 0 ? 'Approved leave (family function)' : '',
      markedBy: SUP, at: at(d, '08:20'), history: [],
    }
  })
})
// Work allocation: workers on an approved task for a date (none yet today: the supervisor allocates)
export const WORK_ALLOCATIONS = [
  { id: 'WA-101', taskId: 'TSK-107', projectId: 'P-101', siteId: 'S-01', date: ago(1), workerIds: ['L-03', 'L-21', 'L-22', 'L-23'], team: 'Shuttering gang A', instructions: 'Finish F10 shuttering; check line and level before 4 pm', by: SUP, at: at(1, '08:30'), history: [] },
  { id: 'WA-102', taskId: 'TSK-104', projectId: 'P-101', siteId: 'S-01', date: ago(1), workerIds: ['L-01', 'L-16', 'L-17', 'L-24', 'L-25', 'L-26', 'L-28'], team: 'Masonry gang A + helpers', instructions: 'F6 pour; vibrator #1 only, keep cubes', by: SUP, at: at(1, '08:35'), history: [] },
]
// Execution progress recorded by the supervisor, verified by the Site Engineer before it counts
export const SUPERVISOR_PROGRESS = []
// Shortages reported to the Site Engineer (the engineer raises the formal material request)
export const SHORTAGE_REPORTS = [
  { id: 'SR-101', projectId: 'P-101', siteId: 'S-01', sku: 'MAT-BWR', required: 200, available: 0, shortage: 200, neededBy: ahead(2), taskId: null, remarks: 'Binding wire finished at site; plinth beam cages need about 200 kg', status: 'Request raised', requestRef: 'MR-5013', reportedBy: SUP, at: at(2, '08:50'), history: [{ at: at(2, '08:50'), by: SUP, role: 'Site Supervisor', action: 'Shortage reported to the Site Engineer' }, { at: at(2, '09:20'), by: SUP, role: 'Site Supervisor', action: 'Linked to material request MR-5013' }] },
]
