/**
 * DEMO SAFETY RECORDS for the Safety Officer Dashboard (Sunrise Heights Apartments, Tower A).
 * Illustrative only; replace with API data in the backend phase.
 *
 * Existing records are REUSED, never copied:
 *  - hazards / observations / incidents are the existing safety register (SAFETY in siteDemo.js,
 *    which already includes the Admin Dashboard incidents with the same ids);
 *  - corrective actions are built from the actions already on those records and from the
 *    existing safety tasks (same ids kept as references), so each action exists once;
 *  - workers come from the one worker register (data/mockData.js), contacts from SITE_CONTACTS.
 *
 * Checklists below are a DEMO company template, not a technical standard: replace them with the
 * company's approved safety checklists. Emergency points and contacts are placeholders to be
 * confirmed on site; no real phone numbers or addresses are invented here.
 */
import { addDays, todayISO } from '../../utils/date.js'
import { labour as WORKERS } from '../mockData.js'
import { PEOPLE } from './inventoryDemo.js'
import { SAFETY, SAFETY_ACTIONS } from './siteDemo.js'

const T = todayISO()
const ago = (n) => addDays(T, -n)
const ahead = (n) => addDays(T, n)
const at = (daysAgo, time = '10:00') => `${addDays(T, -daysAgo)}T${time}`
const KJ = PEOPLE.engineerA
const SUP = PEOPLE.supervisorA
export const SAFETY_OFFICER = 'Sneha Kulkarni' // demo user of the Safety Officer role

export const HAZARD_CATEGORIES = ['Scaffolding', 'Work at height', 'Electrical', 'Excavation & trench', 'Ladders & access', 'PPE', 'Fire', 'Tools & equipment', 'Lifting & machinery', 'Housekeeping', 'Other']
export const INCIDENT_KINDS = ['Incident', 'Near miss', 'First aid', 'Lost-time injury', 'Property damage']
export const INSPECTION_CATEGORIES = ['Scaffolding', 'Work at height', 'Electrical safety', 'Excavation & trench', 'Ladders & access routes', 'PPE compliance', 'Fire safety', 'Tools & equipment', 'Housekeeping', 'Other']

/** DEMO checklist template per category (to be replaced by the company's approved checklists). */
export const SAFETY_CHECKLISTS = {
  Scaffolding: ['Scaffold tag shows the latest inspection', 'Base plates and sole boards in place', 'Working platform fully boarded, boards secured', 'Guard rails and toe boards in place', 'Safe access ladder provided'],
  'Work at height': ['Edge protection in place', 'Harnesses worn and anchored where required', 'Openings covered or barricaded', 'Permit to work in force where required'],
  'Electrical safety': ['Distribution boards closed and labelled', 'Cables routed clear of water and traffic', 'Earth leakage protection working', 'Portable tools and leads in good condition'],
  'Excavation & trench': ['Edges barricaded', 'Spoil kept back from the edge', 'Safe access and egress', 'Sides supported or sloped as planned', 'Water controlled'],
  'Ladders & access routes': ['Ladders in good condition and secured', 'Access routes clear and lit', 'Walkways separated from vehicle routes'],
  'PPE compliance': ['Helmets worn', 'Safety shoes worn', 'High-visibility vests worn', 'Task-specific PPE worn (harness, gloves, eye / hearing protection)'],
  'Fire safety': ['Extinguishers present, accessible and in date', 'Flammables stored away from ignition sources', 'Hot work areas cleared of combustibles', 'Emergency exits and routes clear'],
  'Tools & equipment': ['Guards fitted', 'Inspection tags current', 'Operators authorised for the equipment'],
  Housekeeping: ['Walkways free of debris', 'Rebar and wire offcuts collected', 'Materials stacked safely', 'Waste removed daily'],
  Other: ['Item checked'],
}

// ---------- Hazard / incident register: the existing SAFETY records with a category ----------
const categoryOf = (x) => {
  const t = `${x.kind} ${x.description}`.toLowerCase()
  if (/scaffold/.test(t)) return 'Scaffolding'
  if (/harness|edge|height/.test(t)) return 'Work at height'
  if (/excavat|trench|pit/.test(t)) return 'Excavation & trench'
  if (/cable|electric/.test(t)) return 'Electrical'
  if (/helmet|ppe/.test(t)) return 'PPE'
  if (/jcb|crane|lift/.test(t)) return 'Lifting & machinery'
  if (/rebar|starter/.test(t)) return 'Tools & equipment'
  if (/offcut|housekeeping|debris/.test(t)) return 'Housekeeping'
  return 'Other'
}
export const SAFETY_REGISTER = SAFETY.map((x) => {
  const incident = INCIDENT_KINDS.includes(x.kind)
  return {
    ...x, category: x.category || categoryOf(x), time: x.time || '10:00', responsibleTeam: x.responsibleTeam || (x.siteId === 'S-01' ? 'Tower A site team' : 'Site team'),
    reviewedBy: x.reviewedBy || (x.status !== 'Open' || x.source ? SAFETY_OFFICER : null), proposedAction: x.action || '',
    ...(incident && { incidentStage: x.status === 'Verified closed' ? 'Investigation Complete' : 'Under Investigation', peopleInvolved: x.kind === 'Near miss' ? 'None injured' : 'Restricted: held by the Safety Officer', investigation: x.status === 'Verified closed' ? { findings: 'Recorded on the original Admin record', rootCause: 'See original investigation', by: SAFETY_OFFICER, at: `${x.date}T16:00` } : null }),
  }
})
// The unsafe scaffolding example (reported by the Site Supervisor, waiting for the Safety Officer)
SAFETY_REGISTER.push({
  id: 'SO-410', projectId: 'P-101', siteId: 'S-01', kind: 'Hazard', category: 'Scaffolding', severity: 'Medium', time: '09:40',
  description: 'Two scaffold boards loose and one guard rail missing on the F11 shuttering scaffold', location: 'Tower A, F11 north face',
  date: T, reportedBy: SUP, reporterRole: 'Site Supervisor', immediateAction: 'Carpenters moved off the scaffold; area taped off', workStopped: true,
  proposedAction: 'Re-fix boards and guard rail; scaffold to be re-tagged', action: '', actionOwner: '', actionDue: null, responsibleTeam: 'Shuttering gang A',
  status: 'Open', escalation: 'Site Engineer', reviewedBy: null, photos: [],
  history: [{ at: at(0, '09:40'), by: SUP, role: 'Site Supervisor', action: 'Hazard reported', note: 'Immediate action: work stopped, area taped off', from: 'New', to: 'Open' }],
})

// ---------- Corrective actions: one record per action, linked to its source ----------
const CA_STATUS = { Open: 'Assigned', 'Action in progress': 'In Progress', 'Action done': 'Awaiting Verification', 'Verified closed': 'Closed' }
let n = 200
export const SAFETY_CORRECTIVE_ACTIONS = [
  ...SAFETY.filter((x) => x.action).map((x) => ({
    id: `SCA-${++n}`, sourceType: INCIDENT_KINDS.includes(x.kind) ? 'Incident' : 'Hazard', sourceId: x.id, projectId: x.projectId, siteId: x.siteId,
    text: x.action, owner: x.actionOwner || SUP, ownerRole: x.actionOwner === KJ ? 'Site Engineer' : 'Site Supervisor', priority: ['High', 'Critical'].includes(x.severity) ? 'High' : 'Normal',
    due: x.actionDue || ahead(2), status: CA_STATUS[x.status] || 'Assigned', notes: [],
    evidence: x.status === 'Action done' || x.status === 'Verified closed' ? [{ at: (x.history || []).slice(-1)[0]?.at || `${x.date}T17:00`, by: x.actionOwner || SUP, text: 'Corrective action done (recorded on the original safety record)', photos: [] }] : [],
    submittedBy: x.status === 'Action done' ? x.actionOwner || SUP : null, verifiedBy: x.status === 'Verified closed' ? SAFETY_OFFICER : null, closedAt: x.status === 'Verified closed' ? `${x.date}T18:00` : null,
    assignedBy: SAFETY_OFFICER, at: `${x.date}T11:00`, history: [{ at: `${x.date}T11:00`, by: SAFETY_OFFICER, role: 'Safety Officer', action: 'Corrective action assigned (from the safety record)', from: 'New', to: 'Assigned' }],
  })),
  // The existing project safety tasks keep their own ids
  ...SAFETY_ACTIONS.map((t) => ({
    id: t.id, sourceType: 'Safety plan task', sourceId: null, projectId: t.projectId, siteId: t.siteId, text: t.task, owner: t.owner, ownerRole: 'Site Engineer', priority: 'Normal',
    due: t.due, status: 'Assigned', notes: [], evidence: [], submittedBy: null, verifiedBy: null, closedAt: null, assignedBy: 'Project safety plan', at: `${addDays(t.due, -7)}T09:00`, source: 'Admin Dashboard record',
    history: [{ at: `${addDays(t.due, -7)}T09:00`, by: 'Project safety plan', role: '', action: 'Safety task created', from: 'New', to: 'Assigned' }],
  })),
]

// ---------- Safety inspections (separate from QA quality inspections) ----------
const towerA = WORKERS.filter((w) => w.siteId === 'S-01')
const chk = (cat, results) => SAFETY_CHECKLISTS[cat].map((item, i) => ({ item, result: results ? results[i] || 'Pass' : null, note: '' }))
const insp = (id, o) => ({ id, projectId: 'P-101', siteId: 'S-01', inspector: SAFETY_OFFICER, photos: [], findings: '', severity: null, history: [], actionIds: [], ...o })
export const SAFETY_INSPECTIONS = [
  insp('SIN-301', { category: 'Excavation & trench', workArea: 'Tower A, drain trench (east)', date: ago(3), status: 'Passed', checklist: chk('Excavation & trench', []), findings: 'Edges barricaded, spoil set back, ladder access in place', completedAt: at(3, '11:30') }),
  insp('SIN-302', { category: 'Electrical safety', workArea: 'Tower A, DB-2 near batching point', date: ago(2), status: 'Failed', severity: 'High', checklist: chk('Electrical safety', ['Fail', 'Fail', 'Pass', 'Pass']), findings: 'DB-2 door broken open; cable lying in water near the mixer', completedAt: at(2, '15:00'), actionIds: ['SCA-301'] }),
  insp('SIN-303', { category: 'PPE compliance', workArea: 'Tower A, F7–F10 work front', date: ago(1), status: 'Requires Follow-up', severity: 'Medium', checklist: chk('PPE compliance', ['Fail', 'Pass', 'Fail', 'Pass']), findings: '4 of 22 workers without helmets; 6 without hi-vis vests', completedAt: at(1, '10:15'), actionIds: ['SCA-302'] }),
  insp('SIN-304', { category: 'Housekeeping', workArea: 'Tower A, F2–F6', date: T, status: 'In Progress', checklist: chk('Housekeeping') }),
  insp('SIN-305', { category: 'Scaffolding', workArea: 'Tower A, F9–F12 shuttering scaffolds', date: T, status: 'Scheduled', checklist: chk('Scaffolding') }),
  insp('SIN-306', { category: 'Fire safety', workArea: 'Tower A, diesel bay and site office', date: ahead(2), status: 'Scheduled', checklist: chk('Fire safety') }),
]
SAFETY_CORRECTIVE_ACTIONS.push(
  { id: 'SCA-301', sourceType: 'Inspection', sourceId: 'SIN-302', projectId: 'P-101', siteId: 'S-01', text: 'Replace DB-2 door and lock; lift the cable on stands away from the mixer', owner: KJ, ownerRole: 'Site Engineer', priority: 'High', due: ago(1), status: 'In Progress', notes: [{ at: at(1, '12:00'), by: KJ, text: 'Electrician booked; cable lifted temporarily' }], evidence: [], submittedBy: null, verifiedBy: null, closedAt: null, assignedBy: SAFETY_OFFICER, at: at(2, '15:10'), history: [{ at: at(2, '15:10'), by: SAFETY_OFFICER, role: 'Safety Officer', action: 'Corrective action assigned', from: 'New', to: 'Assigned' }, { at: at(1, '12:00'), by: KJ, role: 'Site Engineer', action: 'Work started', from: 'Assigned', to: 'In Progress' }] },
  { id: 'SCA-302', sourceType: 'Inspection', sourceId: 'SIN-303', projectId: 'P-101', siteId: 'S-01', text: 'Issue missing helmets and vests; toolbox talk on PPE; gate check each morning', owner: SUP, ownerRole: 'Site Supervisor', priority: 'Normal', due: ahead(1), status: 'Assigned', notes: [], evidence: [], submittedBy: null, verifiedBy: null, closedAt: null, assignedBy: SAFETY_OFFICER, at: at(1, '10:30'), history: [{ at: at(1, '10:30'), by: SAFETY_OFFICER, role: 'Safety Officer', action: 'Corrective action assigned', from: 'New', to: 'Assigned' }] },
)

// ---------- PPE: issue records against the worker register, and field compliance checks ----------
export const PPE_ITEMS = ['Safety helmet', 'Safety shoes', 'High-visibility vest', 'Safety harness', 'Gloves', 'Eye protection', 'Hearing protection']
const atHeight = ['Bar Bender', 'Carpenter', 'Welder']
let p = 500
export const PPE_RECORDS = towerA.flatMap((w, i) => [
  { item: 'Safety helmet', issued: ago(60), replaceBy: ahead(305), condition: i === 4 ? 'Damaged' : 'Good' },
  { item: 'Safety shoes', issued: ago(60), replaceBy: i % 9 === 0 ? ago(2) : ahead(120), condition: i % 9 === 0 ? 'Worn' : 'Good' },
  ...(i % 3 === 0 ? [] : [{ item: 'High-visibility vest', issued: ago(45), replaceBy: ahead(135), condition: 'Good' }]),
  ...(atHeight.includes(w.trade) ? [{ item: 'Safety harness', issued: ago(90), replaceBy: w.id === 'L-12' ? ago(5) : ahead(90), condition: 'Good' }] : []),
  ...(w.trade === 'Welder' ? [{ item: 'Eye protection', issued: ago(30), replaceBy: ahead(60), condition: 'Good' }] : []),
].map((r) => ({ id: `PPE-${++p}`, workerId: w.id, projectId: 'P-101', siteId: 'S-01', ...r, status: r.condition === 'Damaged' ? 'Replacement needed' : r.replaceBy < T ? 'Replacement due' : 'Issued', issuedBy: SUP, history: [] })))
/** Field checks: compliance is what was SEEN worn, not what was issued */
export const PPE_CHECKS = [
  { id: 'PPC-21', projectId: 'P-101', siteId: 'S-01', date: ago(3), workArea: 'F1–F6', observed: 24, compliant: 23, item: 'Helmets, shoes, vests', by: SAFETY_OFFICER, notes: '1 worker without vest' },
  { id: 'PPC-22', projectId: 'P-101', siteId: 'S-01', date: ago(1), workArea: 'F7–F10', observed: 22, compliant: 16, item: 'Helmets, shoes, vests', by: SAFETY_OFFICER, notes: '4 without helmets, 2 without vests (SIN-303)' },
]

// ---------- Training (requirements by trade; sessions with attendance) ----------
export const TRAINING_TYPES = ['Site safety induction', 'Toolbox talk', 'Work-at-height training', 'Electrical safety training', 'Equipment-specific training', 'Fire & emergency training']
/** Required training per trade, with renewal in months (0 = once). DEMO policy, to be set by the company. */
export const TRAINING_REQUIREMENTS = [
  { type: 'Site safety induction', trades: 'all', renewMonths: 12 },
  { type: 'Work-at-height training', trades: ['Bar Bender', 'Carpenter', 'Welder'], renewMonths: 12 },
  { type: 'Electrical safety training', trades: ['Welder'], renewMonths: 12 },
  { type: 'Equipment-specific training', trades: ['Machine Operator'], renewMonths: 24 },
]
const notInducted = ['L-27', 'L-28', 'L-26']
export const TRAINING_SESSIONS = [
  { id: 'TRN-401', type: 'Site safety induction', title: 'Tower A site induction (batch 1)', date: ago(70), trainer: SAFETY_OFFICER, projectId: 'P-101', siteId: 'S-01', attendees: towerA.filter((w) => !notInducted.includes(w.id)).map((w) => w.id), renewMonths: 12, docs: ['Induction attendance sheet'], history: [] },
  { id: 'TRN-402', type: 'Work-at-height training', title: 'Harness use and anchorage', date: ago(330), trainer: 'External trainer (demo)', projectId: 'P-101', siteId: 'S-01', attendees: towerA.filter((w) => ['Bar Bender', 'Carpenter'].includes(w.trade) && w.id !== 'L-15').map((w) => w.id), renewMonths: 12, docs: ['Training certificate list'], history: [] },
  { id: 'TRN-403', type: 'Toolbox talk', title: 'Working at the shuttering edge', date: ago(2), trainer: SUP, projectId: 'P-101', siteId: 'S-01', attendees: towerA.filter((w) => ['Carpenter', 'Helper'].includes(w.trade)).map((w) => w.id), renewMonths: 0, docs: [], history: [] },
  { id: 'TRN-404', type: 'Equipment-specific training', title: 'Backhoe loader operation', date: ago(400), trainer: 'Equipment supplier (demo)', projectId: 'P-101', siteId: 'S-01', attendees: ['L-28'], renewMonths: 24, docs: [], history: [] },
]

// ---------- Permit to work ----------
export const PERMIT_TYPES = ['Hot work', 'Work at height', 'Confined-space entry', 'Excavation', 'Electrical isolation']
const permit = (id, o) => ({ id, projectId: 'P-101', siteId: 'S-01', preparedBy: SAFETY_OFFICER, supervisor: SUP, approver: null, approvedAt: null, history: [], closure: null, ...o })
export const PERMITS = [
  permit('PTW-101', { type: 'Hot work', workArea: 'Tower A, F4 column starters', activity: 'Welding couplers on column starter bars', hazards: 'Sparks onto plywood shuttering; burns', precautions: ['Fire extinguisher at the work point', 'Shuttering wetted / shielded', 'Fire watch for 30 minutes after work'], validFrom: `${T}T08:00`, validTo: `${T}T18:00`, status: 'Active', approver: 'Rahul Mehta', approvedAt: at(1, '17:00'), activatedAt: at(0, '08:10'),
    history: [{ at: at(1, '16:00'), by: SAFETY_OFFICER, role: 'Safety Officer', action: 'Submitted for approval', from: 'Draft', to: 'Pending Approval' }, { at: at(1, '17:00'), by: 'Rahul Mehta', role: 'Project Manager', action: 'Approved', from: 'Pending Approval', to: 'Approved' }, { at: at(0, '08:10'), by: SAFETY_OFFICER, role: 'Safety Officer', action: 'Activated after precautions checked', from: 'Approved', to: 'Active' }] }),
  permit('PTW-102', { type: 'Work at height', workArea: 'Tower A, F10 shuttering edge', activity: 'Edge shuttering and props above 2 m', hazards: 'Fall from the edge; falling objects', precautions: ['Harness anchored to the lifeline', 'Toe boards and barricade below', 'Scaffold tag current'], validFrom: `${ahead(1)}T08:00`, validTo: `${ahead(1)}T18:00`, status: 'Pending Approval',
    history: [{ at: at(0, '09:00'), by: SAFETY_OFFICER, role: 'Safety Officer', action: 'Submitted for approval', from: 'Draft', to: 'Pending Approval' }] }),
  permit('PTW-103', { type: 'Excavation', workArea: 'Tower A, drain trench (east)', activity: 'Trench to 1.8 m for storm drain', hazards: 'Collapse of sides; fall into trench', precautions: ['Sides sloped / supported as planned', 'Barricade and ladder access', 'Spoil 1 m back from edge'], validFrom: `${ago(3)}T08:00`, validTo: `${ago(1)}T18:00`, status: 'Active', approver: 'Rahul Mehta', approvedAt: at(4, '17:00'), activatedAt: at(3, '08:15'),
    history: [{ at: at(4, '17:00'), by: 'Rahul Mehta', role: 'Project Manager', action: 'Approved', from: 'Pending Approval', to: 'Approved' }, { at: at(3, '08:15'), by: SAFETY_OFFICER, role: 'Safety Officer', action: 'Activated', from: 'Approved', to: 'Active' }] }),
  permit('PTW-104', { type: 'Electrical isolation', workArea: 'Tower A, DB-2', activity: 'Isolate DB-2 to replace the door and re-route cables (SCA-301)', hazards: 'Electric shock', precautions: ['Lock-out / tag-out at the main board', 'Test for dead before work'], validFrom: `${ahead(1)}T09:00`, validTo: `${ahead(1)}T13:00`, status: 'Draft' }),
  permit('PTW-100', { type: 'Confined-space entry', workArea: 'Tower A, dewatering sump', activity: 'Sump cleaning', hazards: 'Low oxygen; water ingress', precautions: ['Gas test before entry', 'Standby person at the opening'], validFrom: `${ago(9)}T08:00`, validTo: `${ago(9)}T12:00`, status: 'Closed', approver: 'Rahul Mehta', approvedAt: at(10, '16:00'),
    closure: { by: SAFETY_OFFICER, at: at(9, '12:10'), handover: 'Sump cleaned; cover replaced; area handed back to the site team' },
    history: [{ at: at(9, '12:10'), by: SAFETY_OFFICER, role: 'Safety Officer', action: 'Closed and handed over', from: 'Active', to: 'Closed' }] }),
]

// ---------- Emergency preparedness (placeholders to verify on site; no invented numbers) ----------
export const EMERGENCY_POINTS = [
  { id: 'EP-1', kind: 'Assembly point', projectId: 'P-101', siteId: 'S-01', location: 'Open yard inside the main gate (as marked on the site logistics plan)', verified: false, by: SAFETY_OFFICER, at: at(20, '10:00') },
  { id: 'EP-2', kind: 'First-aid room', projectId: 'P-101', siteId: 'S-01', location: 'Site office block, ground floor', verified: true, by: SAFETY_OFFICER, at: at(20, '10:00') },
  { id: 'EP-3', kind: 'First-aid kit', projectId: 'P-101', siteId: 'S-01', location: 'Batching point store', verified: false, by: SAFETY_OFFICER, at: at(20, '10:00') },
]
export const FIRE_EQUIPMENT_CHECKS = [
  { id: 'FEQ-11', projectId: 'P-101', siteId: 'S-01', item: 'Fire extinguisher (dry powder)', location: 'Diesel bay', date: ago(25), result: 'Satisfactory', nextDue: ahead(5), by: SAFETY_OFFICER },
  { id: 'FEQ-12', projectId: 'P-101', siteId: 'S-01', item: 'Fire extinguisher (CO2)', location: 'Site office DB room', date: ago(35), result: 'Pressure low: refill arranged', nextDue: ago(5), by: SAFETY_OFFICER },
]
export const DRILLS = [
  { id: 'DRL-07', projectId: 'P-101', siteId: 'S-01', type: 'Fire evacuation drill', date: ago(30), status: 'Completed', attendance: 41, evacuationMinutes: 6, outcome: 'All mustered; 2 workers used the blocked north exit; route re-marked', by: SAFETY_OFFICER },
  { id: 'DRL-08', projectId: 'P-101', siteId: 'S-01', type: 'Emergency rescue from height drill', date: ahead(5), status: 'Scheduled', attendance: null, evacuationMinutes: null, outcome: '', by: SAFETY_OFFICER },
]
export const READINESS_NOTES = [
  { id: 'RN-3', projectId: 'P-101', siteId: 'S-01', date: ago(4), text: 'Assembly point sign faded; repaint requested', by: SAFETY_OFFICER },
]
