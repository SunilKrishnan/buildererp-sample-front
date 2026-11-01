/**
 * Quality assurance workflow (pure functions, no React). Works on the shared site records
 * (state.inspections, state.ncrs, state.documents) plus the QA lists added in initialSiteState
 * (qaRequests, checklists, materialTests, qaDocs).
 *
 *   Site Supervisor: work ready → Site Engineer: inspection request → QA: schedule (authorised
 *   inspector) → QA: checklist results → Pass | Fail (NCR + corrective action) → responsible
 *   person: correction + evidence → QA: verify → reinspection (a NEW linked inspection; the
 *   failed one is kept unchanged) → Pass → NCR closed → QA clearance (e.g. concrete pour).
 *
 * Every transition is `(state, args, actor) → { state, message } | { error }`, checks the
 * record's current status and the actor's permission, and appends to the record history and
 * the shared audit trail. Nothing here touches stock, purchase prices or financial records.
 * DEMO: nothing is saved or sent.
 */
import { can, PERMISSIONS as P } from '../auth/demoRoles.js'
import { QA_INSPECTORS } from '../data/demo/qaDemo.js'
import { addDays, todayISO } from '../utils/date.js'
import { nextId, nowStamp } from './inventory.js'
import { engineerOf, latestApproved, pmOf, supervisorOf } from './site.js'

const stamp = () => nowStamp()
const fail = (error) => ({ error })
const ok = (state, message) => ({ state, message })
const updateIn = (list, id, fn) => list.map((r) => (r.id === id ? fn(r) : r))
const event = (actor, action, note = '') => ({ at: stamp(), by: actor.name, role: (actor.role || '') + (actor.simulated ? ' (simulated)' : ''), action, note })
const allowed = (actor, perm) => (actor?.roleId ? can(actor.roleId, perm) : false)
const audit = (state, actor, ref, action, note = '') => [{ id: `SA-${(state.audit?.length || 0) + 1}`, ref, ...event(actor, action, note) }, ...(state.audit || [])]
const needQA = (actor) => (allowed(actor, P.QA_MANAGE) ? '' : 'Only an authorised QA engineer can do this.')
const reason = (text, min = 5) => (text || '').trim().length >= min

/** "QA: R. Banerjee" (older records) → "R. Banerjee" */
export const inspectorName = (s = '') => s.replace(/^(QA|Third-party):\s*/, '')
export const isAuthorisedInspector = (name) => QA_INSPECTORS.some((i) => i.name === inspectorName(name))

// ---------- Derived views ----------
export const OPEN_INSPECTION = ['Scheduled', 'Overdue', 'In Progress']
/** Status for lists: a scheduled inspection whose date has passed without a result is Overdue. */
export function inspectionStatus(q, today = todayISO()) {
  if (q.status === 'Scheduled' && q.date < today) return 'Overdue'
  return q.status
}
// Older NCR statuses (site / admin records) mapped onto the QA status list
const NCR_ALIASES = { 'In Progress': 'Correction in Progress', 'Awaiting reinspection': 'Awaiting Verification', Done: 'Awaiting Verification', Resolved: 'Closed' }
export const ncrStatus = (n) => NCR_ALIASES[n.status] || n.status
export const NCR_STATUSES = ['Open', 'Assigned', 'Correction in Progress', 'Awaiting Verification', 'Reinspection Required', 'Returned for Correction', 'Closed']
export const NCR_OPEN = NCR_STATUSES.filter((s) => s !== 'Closed')

/** Checklist template is usable only when every source document has an approved revision. */
export function checklistBasis(state, cl) {
  const docs = (cl.basis || []).map((id) => state.documents.find((d) => d.id === id)).filter(Boolean)
  const rows = docs.map((d) => ({ id: d.id, title: d.title, approved: latestApproved(d) }))
  const missing = rows.filter((r) => !r.approved)
  const usable = rows.length > 0 && missing.length === 0 && !cl.withdrawn
  return { rows, missing, usable, label: cl.withdrawn ? 'Withdrawn' : !rows.length ? 'Draft: no approved source document' : missing.length ? `Draft: ${missing.map((m) => m.id).join(', ')} not approved` : 'In use' }
}

/** The inspection chain: original → reinspection(s), oldest first. */
export function chainOf(state, q) {
  let root = q
  while (root?.parentId) root = state.inspections.find((x) => x.id === root.parentId) || null
  if (!root) return [q]
  const out = [root]
  let cur = root
  for (;;) {
    const next = state.inspections.find((x) => x.parentId === cur.id)
    if (!next) break
    out.push(next)
    cur = next
  }
  return out
}
export const latestInChain = (state, q) => chainOf(state, q).slice(-1)[0]

/** People who can be made responsible for a correction on this site (existing roles only). */
export function responsibleOptions(siteId, projectId) {
  return [
    { role: 'Site Engineer', name: engineerOf(siteId) },
    { role: 'Site Supervisor', name: supervisorOf(siteId) },
    { role: 'Project Manager', name: pmOf(projectId) },
  ].filter((o) => o.name)
}

// ---------- Inspection requests ----------
/** Site Supervisor reports that work is ready for inspection (goes to the Site Engineer). */
export function reportWorkReady(state, f, actor) {
  if (!allowed(actor, P.SITE_SUPERVISE)) return fail('Work readiness is reported by the Site Supervisor.')
  if (!f.siteId) return fail('Select the site.')
  if (!f.activity?.trim()) return fail('Describe the work that is ready.')
  if (!f.location?.trim()) return fail('Enter the work location (tower, floor, grid).')
  if (!reason(f.note, 3)) return fail('Add a short site observation (what was completed).')
  const id = nextId(state.qaRequests, 'IR-')
  const r = {
    id, projectId: f.projectId || 'P-101', siteId: f.siteId, location: f.location.trim(), activity: f.activity.trim(), taskId: f.taskId || null, checklistId: null, drawingRefs: [],
    readiness: { by: actor.name, at: stamp(), note: f.note.trim() }, requiredDate: f.requiredDate || addDays(todayISO(), 1), readinessConfirmed: false,
    photos: f.photos || [], docs: [], status: 'Ready – awaiting Site Engineer', demo: true, history: [event(actor, 'Work reported ready', f.note.trim())],
  }
  return ok({ ...state, qaRequests: [...state.qaRequests, r], audit: audit(state, actor, id, 'Work reported ready for inspection', r.activity) }, `${id}: work reported ready; the Site Engineer checks it before requesting QA`)
}

export function validateRequest(state, f) {
  if (!f.siteId) return 'Select the site.'
  if (!f.activity?.trim()) return 'Enter the activity ready for inspection.'
  if (!f.location?.trim()) return 'Enter the work location.'
  if (!f.checklistId) return 'Choose the applicable checklist.'
  const cl = state.checklists.find((c) => c.id === f.checklistId)
  if (!cl || !checklistBasis(state, cl).usable) return 'That checklist is a draft (its source document is not approved) and cannot be used yet.'
  if (!(f.drawingRefs || []).length) return 'Add the drawing / specification reference.'
  const notApproved = f.drawingRefs.filter((id) => !latestApproved(state.documents.find((d) => d.id === id) || { revisions: [] }))
  if (notApproved.length) return `${notApproved.join(', ')} has no approved revision; it cannot be the basis for inspection.`
  if (!f.requiredDate) return 'Enter the required inspection date.'
  if (f.requiredDate < todayISO()) return 'The required date cannot be in the past.'
  if (!f.readinessConfirmed) return 'Confirm that the work is technically ready for inspection.'
  return ''
}

/** Site Engineer submits (or completes a supervisor's ready notice into) an inspection request. */
export function submitInspectionRequest(state, f, actor) {
  if (!allowed(actor, P.QUALITY_INSPECT)) return fail('Inspection requests are submitted by the Site Engineer.')
  const e = validateRequest(state, f)
  if (e) return fail(e)
  const base = f.id && state.qaRequests.find((r) => r.id === f.id)
  if (f.id && !base) return fail('Request not found.')
  if (base && !['Ready – awaiting Site Engineer', 'Returned to Site Engineer'].includes(base.status)) return fail(`${base.id} is already ${base.status.toLowerCase()}.`)
  // Same location + activity already open with QA → refuse the duplicate
  const dup = state.qaRequests.find((r) => r.id !== f.id && r.siteId === f.siteId && r.activity.trim().toLowerCase() === f.activity.trim().toLowerCase() && ['Submitted', 'Scheduled'].includes(r.status))
  if (dup) return fail(`${dup.id} for this activity is already with QA (${dup.status.toLowerCase()}).`)
  const fields = {
    siteId: f.siteId, projectId: f.projectId || base?.projectId || 'P-101', location: f.location.trim(), activity: f.activity.trim(), taskId: f.taskId || base?.taskId || null,
    checklistId: f.checklistId, drawingRefs: f.drawingRefs, requiredDate: f.requiredDate, readinessConfirmed: true, docs: f.docs || base?.docs || [],
    photos: [...(base?.photos || []), ...(f.photos || [])], note: f.note?.trim() || '', submittedBy: actor.name, submittedAt: stamp(), status: 'Submitted', returnReason: '',
  }
  if (base) {
    return ok({
      ...state, qaRequests: updateIn(state.qaRequests, base.id, (x) => ({ ...x, ...fields, history: [...x.history, event(actor, 'Technical readiness checked; inspection requested')] })),
      audit: audit(state, actor, base.id, 'Inspection requested'),
    }, `${base.id} sent to QA for scheduling`)
  }
  const id = nextId(state.qaRequests, 'IR-')
  const r = { id, ...fields, readiness: { by: actor.name, at: stamp(), note: f.readinessNote?.trim() || 'Checked by Site Engineer' }, demo: true, history: [event(actor, 'Inspection requested')] }
  return ok({ ...state, qaRequests: [...state.qaRequests, r], audit: audit(state, actor, id, 'Inspection requested', r.activity) }, `${id} sent to QA for scheduling`)
}

export function returnInspectionRequest(state, { id, note }, actor) {
  const e = needQA(actor)
  if (e) return fail(e)
  const r = state.qaRequests.find((x) => x.id === id)
  if (!r) return fail('Request not found.')
  if (r.status !== 'Submitted') return fail(`${id} is ${r.status.toLowerCase()}; only a submitted request can be returned.`)
  if (!reason(note)) return fail('Give the reason for returning the request.')
  return ok({ ...state, qaRequests: updateIn(state.qaRequests, id, (x) => ({ ...x, status: 'Returned to Site Engineer', returnReason: note.trim(), history: [...x.history, event(actor, 'Returned to Site Engineer', note.trim())] })), audit: audit(state, actor, id, 'Inspection request returned', note.trim()) }, `${id} returned to the Site Engineer`)
}

// ---------- Scheduling ----------
function validateSchedule(f) {
  if (!f.date) return 'Enter the inspection date.'
  if (f.date < todayISO()) return 'An inspection cannot be scheduled in the past.'
  if (!f.time) return 'Enter the inspection time.'
  if (!isAuthorisedInspector(f.inspector)) return 'Assign an authorised QA inspector.'
  return ''
}

/** Schedule from a request (or directly). Scheduling never marks anything completed. */
export function scheduleInspection(state, f, actor) {
  const e = needQA(actor) || validateSchedule(f)
  if (e) return fail(e)
  const r = f.requestId && state.qaRequests.find((x) => x.id === f.requestId)
  if (f.requestId && !r) return fail('Request not found.')
  if (r && r.status !== 'Submitted') return fail(`${r.id} is ${r.status.toLowerCase()}; it has already been handled.`)
  const src = r || f
  if (!r) {
    if (!f.siteId) return fail('Select the site.')
    if (!f.title?.trim()) return fail('Enter the work activity to inspect.')
    if (!f.location?.trim()) return fail('Enter the work location.')
  }
  const cl = state.checklists.find((c) => c.id === (src.checklistId || f.checklistId))
  if (!cl || !checklistBasis(state, cl).usable) return fail('Choose a checklist that is in use (approved source documents).')
  const id = nextId(state.inspections.filter((x) => /^QI-0\d+$/.test(x.id)), 'QI-0')
  const insp = {
    id, projectId: src.projectId || 'P-101', siteId: src.siteId, title: (r ? r.activity : f.title).trim(), type: f.type || 'Other', location: src.location.trim(),
    taskId: src.taskId || null, requestId: r?.id || null, checklistId: cl.id, drawingRefs: src.drawingRefs || f.drawingRefs || [], date: f.date, time: f.time,
    inspector: f.inspector, owner: 'QA', priority: f.priority || 'Normal', requestedBy: r?.submittedBy || actor.name, attempt: 1, status: 'Scheduled',
    checklist: cl.items.map((x) => ({ ...x, result: null, observation: '' })), tests: [], measurements: [], photos: [], ncrIds: [], notes: '', demo: true,
    history: [event(actor, `Scheduled for ${f.date} ${f.time} · ${f.inspector}`)],
  }
  let next = { ...state, inspections: [...state.inspections, insp] }
  if (r) next = { ...next, qaRequests: updateIn(next.qaRequests, r.id, (x) => ({ ...x, status: 'Scheduled', inspectionId: id, history: [...x.history, event(actor, `Inspection ${id} scheduled`, `${f.date} ${f.time}`)] })) }
  next.audit = audit(state, actor, id, 'Inspection scheduled', `${insp.title} · ${f.date} ${f.time}`)
  return ok(next, `${id} scheduled for ${f.date} at ${f.time} with ${f.inspector}`)
}

export function rescheduleInspection(state, { id, date, time, inspector, note }, actor) {
  const e = needQA(actor)
  if (e) return fail(e)
  const q = state.inspections.find((x) => x.id === id)
  if (!q) return fail('Inspection not found.')
  if (q.owner !== 'QA') return fail(`${id} is not a QA inspection.`)
  if (!OPEN_INSPECTION.includes(q.status)) return fail(`${id} is already ${q.status.toLowerCase()}; its result cannot be rescheduled.`)
  const v = validateSchedule({ date, time, inspector: inspector || q.inspector })
  if (v) return fail(v)
  if (!reason(note)) return fail('Give the reason for rescheduling / reassigning.')
  const who = inspector || q.inspector
  return ok({
    ...state,
    inspections: updateIn(state.inspections, id, (x) => ({ ...x, date, time, inspector: who, status: x.status === 'Overdue' ? 'Scheduled' : x.status, history: [...(x.history || []), event(actor, `Rescheduled to ${date} ${time}${who !== q.inspector ? ` · reassigned to ${who}` : ''}`, note.trim())] })),
    audit: audit(state, actor, id, 'Inspection rescheduled', note.trim()),
  }, `${id} moved to ${date} ${time}${who !== q.inspector ? ` (${who})` : ''}`)
}

// ---------- Results ----------
export const RESULT_OPTIONS = ['Pass', 'Fail', 'N/A']
/** Company policy (demo setting): a conditional pass is allowed only with a recorded required action. */
export const ALLOW_CONDITIONAL = true

export function saveInspectionDraft(state, { id, checklist, measurements, notes, photos }, actor) {
  const e = needQA(actor)
  if (e) return fail(e)
  const q = state.inspections.find((x) => x.id === id)
  if (!q) return fail('Inspection not found.')
  if (!OPEN_INSPECTION.includes(q.status)) return fail(`${id} already has a submitted result; it cannot be changed.`)
  if (q.date > todayISO()) return fail(`${id} is scheduled for ${q.date}; record results on or after the inspection date.`)
  return ok({ ...state, inspections: updateIn(state.inspections, id, (x) => ({ ...x, checklist, measurements: measurements || x.measurements, notes: notes ?? x.notes, photos: [...(x.photos || []), ...(photos || [])], status: 'In Progress', draftBy: actor.name, draftAt: stamp(), history: [...(x.history || []), event(actor, 'Draft saved')] })) }, `${id}: draft saved (not submitted)`)
}

/**
 * Submit the result. Fail (or a conditional pass) must give the reason and creates a linked
 * NCR with its corrective action. The submitted result is final: a later reinspection is a new
 * record, never an edit of this one.
 */
export function submitInspectionResult(state, f, actor) {
  const e = needQA(actor)
  if (e) return fail(e)
  const q = state.inspections.find((x) => x.id === f.id)
  if (!q) return fail('Inspection not found.')
  if (q.owner !== 'QA') return fail(`${q.id} is recorded by ${q.inspector}.`)
  if (!OPEN_INSPECTION.includes(q.status)) return fail(`${q.id} already has a submitted result (${q.status}). Results are never overwritten; schedule a reinspection instead.`)
  if (q.date > todayISO()) return fail(`${q.id} is scheduled for ${q.date}; results can be recorded only on or after that date.`)
  const items = f.checklist || []
  if (!items.length || items.some((c) => !RESULT_OPTIONS.includes(c.result))) return fail('Record Pass, Fail or N/A for every checklist item.')
  const failedItems = items.filter((c) => c.result === 'Fail')
  if (failedItems.some((c) => !reason(c.observation, 3))) return fail('Add an observation for every failed item.')
  if (items.every((c) => c.result === 'N/A')) return fail('At least one item must be inspected (not all N/A).')
  let result = f.result
  if (!['Pass', 'Fail', 'Conditional'].includes(result)) return fail('Choose the overall result.')
  if (result === 'Pass' && failedItems.length) return fail('An inspection with a failed item cannot pass. Record Fail, or a conditional result if policy allows.')
  if (result === 'Conditional' && !ALLOW_CONDITIONAL) return fail('Conditional results are not allowed by company policy.')
  if (result === 'Fail' && !failedItems.length) return fail('Mark the failed checklist item(s).')
  const needsNcr = result !== 'Pass'
  if (needsNcr && !reason(f.comments)) return fail(`Give the reason for the ${result === 'Fail' ? 'failure' : 'conditional result'}.`)
  if (needsNcr && (!f.ncr?.responsible || !f.ncr?.requiredAction?.trim() || !f.ncr?.target)) return fail('Assign the responsible person, the required corrective action and the target date.')
  if (needsNcr && f.ncr.target < todayISO()) return fail('The target date cannot be in the past.')

  const status = result === 'Pass' ? 'Passed' : result === 'Fail' ? 'Failed' : 'Conditional'
  let next = {
    ...state,
    inspections: updateIn(state.inspections, q.id, (x) => ({
      ...x, checklist: items, checklistId: f.checklistId || x.checklistId, measurements: f.measurements || x.measurements || [], notes: f.comments?.trim() || '', photos: [...(x.photos || []), ...(f.photos || [])],
      status, result, recordedAt: stamp(), recordedBy: actor.name, history: [...(x.history || []), event(actor, `Result recorded: ${result}`, f.comments?.trim() || '')],
    })),
  }
  let ncrId = null
  if (needsNcr) {
    ncrId = nextId(state.ncrs.filter((n) => /^NCR-\d+$/.test(n.id)), 'NCR-')
    const resp = f.ncr
    next.ncrs = [...state.ncrs, {
      id: ncrId, projectId: q.projectId, siteId: q.siteId, location: q.location, fromInspection: q.id, category: resp.category || q.type, severity: resp.severity || 'Major',
      description: `${q.title}: ${f.comments.trim()}`, reported: todayISO(), reportedBy: actor.name, responsibleRole: resp.responsibleRole, responsible: resp.responsible,
      drawingRef: (q.drawingRefs || [])[0] || '', rootCause: '', reinspectionRequired: true, status: 'Assigned',
      action: { id: `CA-${ncrId.slice(4)}`, text: resp.requiredAction.trim(), owner: resp.responsible, role: resp.responsibleRole, due: resp.target, priority: resp.severity === 'Critical' || resp.severity === 'Major' ? 'High' : 'Normal', status: 'Open', progress: [], evidence: [] },
      history: [event(actor, `NCR raised from ${q.id}`), event(actor, `Assigned to ${resp.responsible} (${resp.responsibleRole})`)], demo: true,
    }]
    next.inspections = updateIn(next.inspections, q.id, (x) => ({ ...x, ncrIds: [...(x.ncrIds || []), ncrId] }))
  }
  // A reinspection: the NCR it was raised for closes on Pass, goes back for correction on Fail
  if (q.parentId && q.forNcr) {
    next.ncrs = updateIn(next.ncrs, q.forNcr, (n) => (result === 'Pass'
      ? { ...n, status: 'Closed', closedAt: stamp(), verification: { by: actor.name, at: stamp(), inspectionId: q.id, note: f.comments?.trim() || 'Reinspection passed' }, history: [...(n.history || []), event(actor, `Closed: reinspection ${q.id} passed`)] }
      : { ...n, status: 'Returned for Correction', action: { ...n.action, status: 'In Progress' }, history: [...(n.history || []), event(actor, `Reinspection ${q.id} ${result.toLowerCase()}: returned for correction`, f.comments?.trim() || '')] }))
  }
  if (q.requestId) next.qaRequests = updateIn(next.qaRequests, q.requestId, (x) => ({ ...x, status: 'Inspected', history: [...x.history, event(actor, `${q.id}: ${result}`)] }))
  next.audit = audit(state, actor, q.id, `Inspection result: ${result}`, f.comments?.trim() || '')
  return ok(next, `${q.id} recorded as ${result}${ncrId ? `; ${ncrId} raised and assigned to ${f.ncr.responsible}` : ''}${q.forNcr && result === 'Pass' ? `; ${q.forNcr} closed` : ''}`)
}

/**
 * QA clearance for the next activity (e.g. concrete pour). Only on the latest inspection in the
 * chain, when it passed, nothing in the chain is open, and all its NCRs are closed.
 */
export function recordClearance(state, { id, activity, note }, actor) {
  if (!allowed(actor, P.QA_CLEARANCE)) return fail('QA clearance is recorded by the authorised QA engineer.')
  const q = state.inspections.find((x) => x.id === id)
  if (!q) return fail('Inspection not found.')
  if (q.clearance) return fail(`${id} is already cleared for ${q.clearance.activity.toLowerCase()}.`)
  if (q.status !== 'Passed') return fail(`${id} has not passed (${q.status}). Clearance needs a passed inspection.`)
  const chain = chainOf(state, q)
  if (chain[chain.length - 1].id !== id) return fail(`A later inspection (${chain[chain.length - 1].id}) exists for this work; clear that one.`)
  const open = chain.flatMap((x) => x.ncrIds || []).map((n) => state.ncrs.find((r) => r.id === n)).filter((n) => n && ncrStatus(n) !== 'Closed')
  if (open.length) return fail(`${open.map((n) => n.id).join(', ')} still open; close it before clearance.`)
  if (!activity?.trim()) return fail('Enter the activity being cleared (e.g. Concrete pour).')
  return ok({
    ...state,
    inspections: updateIn(state.inspections, id, (x) => ({ ...x, clearance: { activity: activity.trim(), by: actor.name, at: stamp(), note: note?.trim() || '' }, history: [...(x.history || []), event(actor, `QA clearance recorded: ${activity.trim()}`, note?.trim() || '')] })),
    qaRequests: q.requestId ? updateIn(state.qaRequests, chain[0].requestId || q.requestId, (x) => ({ ...x, status: 'Cleared', history: [...x.history, event(actor, `Cleared for ${activity.trim().toLowerCase()} (${id})`)] })) : state.qaRequests,
    audit: audit(state, actor, id, `QA clearance: ${activity.trim()}`, note?.trim() || ''),
  }, `${id}: QA clearance for ${activity.trim().toLowerCase()} recorded`)
}

// ---------- NCRs and corrective actions ----------
export const DEFECT_CATEGORIES = ['Reinforcement', 'Formwork', 'Concrete', 'Masonry', 'Plastering', 'Waterproofing', 'Flooring / tiling', 'Painting / finishing', 'Electrical', 'Plumbing', 'Levels & dimensions', 'Material', 'Other']
export const SEVERITIES = ['Minor', 'Major', 'Critical']

/** Record a defect found outside an inspection (walk-round, complaint). */
export function createNcr(state, f, actor) {
  const e = needQA(actor)
  if (e) return fail(e)
  if (!f.siteId) return fail('Select the site.')
  if (!f.location?.trim()) return fail('Enter the work location.')
  if (!reason(f.description, 10)) return fail('Describe the defect (at least 10 characters).')
  if (!SEVERITIES.includes(f.severity)) return fail('Choose the severity.')
  if (!f.responsible || !f.requiredAction?.trim() || !f.target) return fail('Assign the responsible person, the required corrective action and the target date.')
  if (f.target < todayISO()) return fail('The target date cannot be in the past.')
  const id = nextId(state.ncrs.filter((n) => /^NCR-\d+$/.test(n.id)), 'NCR-')
  const n = {
    id, projectId: f.projectId || 'P-101', siteId: f.siteId, location: f.location.trim(), fromInspection: f.inspectionId || null, category: f.category || 'Other', severity: f.severity,
    description: f.description.trim(), reported: todayISO(), reportedBy: actor.name, responsibleRole: f.responsibleRole, responsible: f.responsible, drawingRef: f.drawingRef || '',
    rootCause: '', reinspectionRequired: f.reinspectionRequired !== false, status: 'Assigned', photos: f.photos || [],
    action: { id: `CA-${id.slice(4)}`, text: f.requiredAction.trim(), owner: f.responsible, role: f.responsibleRole, due: f.target, priority: f.severity === 'Minor' ? 'Normal' : 'High', status: 'Open', progress: [], evidence: [] },
    history: [event(actor, 'NCR raised'), event(actor, `Assigned to ${f.responsible} (${f.responsibleRole})`)], demo: true,
  }
  return ok({ ...state, ncrs: [...state.ncrs, n], audit: audit(state, actor, id, 'NCR raised', n.description) }, `${id} raised and assigned to ${f.responsible}`)
}

export function updateNcrDetails(state, { id, rootCause, responsible, responsibleRole, target, note }, actor) {
  const e = needQA(actor)
  if (e) return fail(e)
  const n = state.ncrs.find((x) => x.id === id)
  if (!n) return fail('NCR not found.')
  if (ncrStatus(n) === 'Closed') return fail(`${id} is closed.`)
  if (target && target < todayISO()) return fail('The target date cannot be in the past.')
  const changes = [rootCause !== undefined && rootCause !== n.rootCause && 'root cause', responsible && responsible !== n.responsible && `reassigned to ${responsible}`, target && target !== n.action?.due && `target ${target}`].filter(Boolean)
  if (!changes.length) return fail('Nothing changed.')
  if (responsible && responsible !== n.responsible && !reason(note)) return fail('Give the reason for reassigning.')
  return ok({
    ...state,
    ncrs: updateIn(state.ncrs, id, (x) => ({
      ...x, rootCause: rootCause ?? x.rootCause, responsible: responsible || x.responsible, responsibleRole: responsibleRole || x.responsibleRole,
      status: ncrStatus(x) === 'Open' && (responsible || x.responsible) ? 'Assigned' : x.status,
      action: x.action ? { ...x.action, owner: responsible || x.action.owner, role: responsibleRole || x.action.role, due: target || x.action.due } : x.action,
      history: [...(x.history || []), event(actor, `Updated: ${changes.join(', ')}`, note || '')],
    })),
    audit: audit(state, actor, id, 'NCR updated', changes.join(', ')),
  }, `${id} updated`)
}

/** Responsible person (or the site's engineer / supervisor / PM) records progress or completion with evidence. */
export function updateCorrectiveAction(state, { id, note, evidence, done }, actor) {
  const n = state.ncrs.find((x) => x.id === id)
  if (!n?.action) return fail('Corrective action not found.')
  const team = [n.action.owner, engineerOf(n.siteId), supervisorOf(n.siteId), pmOf(n.projectId)].filter(Boolean)
  if (!team.includes(actor.name)) return fail(`Progress is updated by ${n.action.owner} or the site team; QA verifies the result.`)
  if (ncrStatus(n) === 'Closed') return fail(`${id} is closed.`)
  if (['Awaiting Verification', 'Reinspection Required'].includes(ncrStatus(n))) return fail(`${id} is already with QA (${ncrStatus(n).toLowerCase()}).`)
  if (!reason(note, 3)) return fail('Add a progress note.')
  const ev = (evidence || []).filter(Boolean)
  if (done && !ev.length && !(n.action.evidence || []).length) return fail('Attach evidence of the correction (photo or document) before marking it complete.')
  return ok({
    ...state,
    ncrs: updateIn(state.ncrs, id, (x) => ({
      ...x, status: done ? 'Awaiting Verification' : 'Correction in Progress',
      action: { ...x.action, status: done ? 'Done' : 'In Progress', note: note.trim(), progress: [...(x.action.progress || []), { at: stamp(), by: actor.name, note: note.trim() }], evidence: [...(x.action.evidence || []), ...ev], completedAt: done ? stamp() : x.action.completedAt },
      history: [...(x.history || []), event(actor, done ? 'Correction completed; verification requested' : 'Correction progress updated', note.trim())],
    })),
    audit: audit(state, actor, id, done ? 'Correction completed' : 'Correction progress', note.trim()),
  }, done ? `${id}: correction recorded; QA verifies it` : `${id}: progress updated`)
}

/**
 * QA verification of a correction. Accept → reinspection required (scheduled as a new record) or,
 * for an NCR that needs no reinspection, closed. Reject → returned for correction with the reason.
 */
export function verifyCorrection(state, { id, accept, note }, actor) {
  if (!allowed(actor, P.QUALITY_REVIEW)) return fail('Only the authorised QA verifier can verify a correction.')
  const n = state.ncrs.find((x) => x.id === id)
  if (!n) return fail('NCR not found.')
  if (ncrStatus(n) !== 'Awaiting Verification') return fail(`${id} is ${ncrStatus(n).toLowerCase()}; nothing to verify.`)
  if (n.action?.owner === actor.name) return fail('You did the correction; another QA engineer must verify it.')
  if (!accept && !reason(note)) return fail('Give the reason for returning the correction.')
  const status = !accept ? 'Returned for Correction' : n.reinspectionRequired ? 'Reinspection Required' : 'Closed'
  return ok({
    ...state,
    ncrs: updateIn(state.ncrs, id, (x) => ({
      ...x, status, closedAt: status === 'Closed' ? stamp() : x.closedAt,
      action: { ...x.action, status: accept ? 'Done' : 'In Progress' },
      verification: accept ? { by: actor.name, at: stamp(), note: note?.trim() || '' } : x.verification,
      history: [...(x.history || []), event(actor, accept ? (status === 'Closed' ? 'Correction verified; closed' : 'Correction verified; reinspection required') : 'Correction returned', note?.trim() || '')],
    })),
    audit: audit(state, actor, id, accept ? 'Correction verified' : 'Correction returned', note?.trim() || ''),
  }, `${id}: ${accept ? (status === 'Closed' ? 'verified and closed' : 'verified; schedule the reinspection') : 'returned for correction'}`)
}

/** New inspection linked to the failed one; the original record is left exactly as recorded. */
export function scheduleReinspection(state, { ncrId, date, time, inspector }, actor) {
  const e = needQA(actor) || validateSchedule({ date, time, inspector })
  if (e) return fail(e)
  const n = state.ncrs.find((x) => x.id === ncrId)
  if (!n) return fail('NCR not found.')
  if (ncrStatus(n) !== 'Reinspection Required') return fail(`${ncrId} is ${ncrStatus(n).toLowerCase()}; verify the correction before scheduling the reinspection.`)
  if (n.reinspectionId && OPEN_INSPECTION.includes(state.inspections.find((x) => x.id === n.reinspectionId)?.status)) return fail(`Reinspection ${n.reinspectionId} is already scheduled.`)
  const orig = state.inspections.find((x) => x.id === n.fromInspection)
  if (!orig) return fail(`${ncrId} has no original inspection to reinspect.`)
  const parent = latestInChain(state, orig)
  const id = nextId(state.inspections.filter((x) => /^QI-0\d+$/.test(x.id)), 'QI-0')
  const cl = state.checklists.find((c) => c.id === orig.checklistId)
  const reinsp = {
    ...orig, id, parentId: parent.id, forNcr: ncrId, attempt: (parent.attempt || 1) + 1, title: `Reinspection: ${orig.title}`, date, time, inspector, owner: 'QA', status: 'Scheduled',
    result: undefined, recordedAt: undefined, recordedBy: undefined, clearance: undefined, requestId: orig.requestId || null, ncrIds: [], notes: '', photos: [], measurements: [],
    checklist: (cl ? cl.items : orig.checklist).map((x) => ({ id: x.id, item: x.item, criteria: x.criteria, result: null, observation: '' })), demo: true,
    history: [event(actor, `Reinspection of ${parent.id} for ${ncrId} scheduled`, `${date} ${time} · ${inspector}`)],
  }
  return ok({
    ...state,
    inspections: [...state.inspections, reinsp],
    ncrs: updateIn(state.ncrs, ncrId, (x) => ({ ...x, reinspectionId: id, reinspectionDate: date, history: [...(x.history || []), event(actor, `Reinspection ${id} scheduled`, `${date} ${time}`)] })),
    audit: audit(state, actor, id, 'Reinspection scheduled', `${parent.id} · ${ncrId}`),
  }, `Reinspection ${id} scheduled for ${date} ${time}; ${parent.id} keeps its original result`)
}

// ---------- Checklists ----------
export function saveChecklist(state, f, actor) {
  const e = needQA(actor)
  if (e) return fail(e)
  if (!f.title?.trim()) return fail('Enter the checklist title.')
  if (!f.category) return fail('Choose the category.')
  const items = (f.items || []).filter((x) => x.item?.trim())
  if (!items.length) return fail('Add at least one check item.')
  if (items.some((x) => !x.criteria?.trim())) return fail('Give the acceptance criteria (or its source reference) for every item.')
  const dup = state.checklists.find((c) => c.id !== f.id && c.title.trim().toLowerCase() === f.title.trim().toLowerCase())
  if (dup) return fail(`A checklist named "${dup.title}" already exists (${dup.id}).`)
  const clean = items.map((x, i) => ({ id: String(i + 1), item: x.item.trim(), criteria: x.criteria.trim() }))
  if (f.id) {
    const cur = state.checklists.find((c) => c.id === f.id)
    if (!cur) return fail('Checklist not found.')
    return ok({ ...state, checklists: updateIn(state.checklists, f.id, (c) => ({ ...c, title: f.title.trim(), category: f.category, basis: f.basis || [], items: clean, version: c.version + 1, history: [...c.history, event(actor, `Revised to version ${c.version + 1}`, f.note || '')] })), audit: audit(state, actor, f.id, 'Checklist revised') }, `${f.id} revised (version ${cur.version + 1}); inspections already scheduled keep the items they were issued with`)
  }
  const id = nextId(state.checklists.filter((c) => /^CL-\d+$/.test(c.id)), 'CL-')
  const c = { id, category: f.category, title: f.title.trim(), basis: f.basis || [], items: clean, version: 1, createdBy: actor.name, createdAt: stamp(), demo: true, history: [event(actor, 'Checklist created')] }
  return ok({ ...state, checklists: [...state.checklists, c], audit: audit(state, actor, id, 'Checklist created', c.title) }, `${id} created${checklistBasis(state, c).usable ? '' : ' as a draft (link an approved source document to use it)'}`)
}

// ---------- Material quality & tests (stock is never changed here) ----------
export const TEST_STATUSES = ['Sample Taken', 'Awaiting Report', 'Report Received', 'Accepted', 'Rejected', 'Retest Required']

/** Register a sample / certificate against an existing GRN (references only). */
export function registerMaterialTest(state, f, actor) {
  const receipts = f.receipts || [] // the Store Keeper's GRNs (shared inventory records), passed by the page
  const e = needQA(actor)
  if (e) return fail(e)
  const grn = receipts.find((g) => g.id === f.grnId)
  if (!grn) return fail('Select the goods receipt (GRN) the sample is from.')
  if (!f.testType) return fail('Choose the test type.')
  if (!f.lab?.trim()) return fail('Enter the laboratory or testing organisation.')
  if (!f.sampleRef?.trim()) return fail('Enter the sample / test reference.')
  if (state.materialTests.some((t) => t.sampleRef.trim().toLowerCase() === f.sampleRef.trim().toLowerCase())) return fail(`Sample reference ${f.sampleRef.trim()} is already registered.`)
  if (!f.sampleDate || f.sampleDate > todayISO()) return fail('Enter the sample date (not in the future).')
  const id = nextId(state.materialTests, 'MT-')
  const t = {
    id, projectId: f.projectId || 'P-101', sku: grn.sku, grnId: grn.id, poId: grn.po, batch: f.batch?.trim() || '', sampleRef: f.sampleRef.trim(), testType: f.testType, lab: f.lab.trim(),
    sampleDate: f.sampleDate, testDate: null, spec: f.spec || null, status: f.external ? 'Awaiting Report' : 'Sample Taken', results: [], reportRef: '', reportFile: null, reviewer: null, recordedBy: actor.name, demo: true,
    history: [event(actor, `Registered against ${grn.id} / ${grn.po}`, f.batch || '')],
  }
  return ok({ ...state, materialTests: [...state.materialTests, t], audit: audit(state, actor, id, 'Material sample registered', `${grn.id} · ${f.testType}`) }, `${id} registered against ${grn.id}`)
}

/** Record the lab report / certificate as received (values come from the report; nothing is calculated here). */
export function recordTestReport(state, { id, testDate, results, reportRef, reportFile }, actor) {
  const e = needQA(actor)
  if (e) return fail(e)
  const t = state.materialTests.find((x) => x.id === id)
  if (!t) return fail('Test record not found.')
  if (!['Sample Taken', 'Awaiting Report', 'Retest Required'].includes(t.status)) return fail(`${id} is ${t.status.toLowerCase()}.`)
  if (!testDate || testDate > todayISO()) return fail('Enter the test date (not in the future).')
  if (testDate < t.sampleDate) return fail('The test date cannot be before the sample date.')
  if (!reportRef?.trim()) return fail('Enter the report / certificate reference: results are recorded only from a report.')
  const rows = (results || []).filter((r) => r.parameter?.trim())
  if (!rows.length || rows.some((r) => !String(r.value ?? '').trim())) return fail('Enter each result as stated in the report.')
  return ok({
    ...state,
    materialTests: updateIn(state.materialTests, id, (x) => ({ ...x, testDate, results: rows, reportRef: reportRef.trim(), reportFile: reportFile || x.reportFile, status: 'Report Received', history: [...x.history, event(actor, 'Report received', reportRef.trim())] })),
    audit: audit(state, actor, id, 'Test report received', reportRef.trim()),
  }, `${id}: report ${reportRef.trim()} recorded; awaiting QA review`)
}

/** QA decision on the evidence. Rejection needs a reason; it does NOT change any stock quantity. */
export function reviewMaterialTest(state, { id, decision, note }, actor) {
  if (!allowed(actor, P.QUALITY_REVIEW)) return fail('Material test results are reviewed by the authorised QA reviewer.')
  const t = state.materialTests.find((x) => x.id === id)
  if (!t) return fail('Test record not found.')
  if (t.status !== 'Report Received') return fail(`${id} is ${t.status.toLowerCase()}; a report must be received before review.`)
  if (!t.reportRef) return fail('No report reference recorded: the material cannot be reviewed without evidence.')
  if (!['Accepted', 'Rejected', 'Retest Required'].includes(decision)) return fail('Choose the decision.')
  if (decision !== 'Accepted' && !reason(note)) return fail(`Give the reason for ${decision === 'Rejected' ? 'rejecting' : 'asking for a retest'}.`)
  return ok({
    ...state,
    materialTests: updateIn(state.materialTests, id, (x) => ({ ...x, status: decision, reviewer: actor.name, reviewedAt: stamp(), reviewNote: note?.trim() || '', history: [...x.history, event(actor, `Reviewed: ${decision}`, note?.trim() || '')] })),
    audit: audit(state, actor, id, `Material test ${decision.toLowerCase()}`, note?.trim() || ''),
  }, `${id}: ${decision}${decision === 'Rejected' ? '. The Store Keeper and Purchase Manager see the result; stock is unchanged' : ''}`)
}

// ---------- Quality documents (demo: file names only, nothing uploaded) ----------
export const QA_DOC_TYPES = ['Inspection report', 'Material test certificate', 'Laboratory report', 'Concrete test record', 'Supplier quality certificate', 'NCR report', 'Corrective action evidence', 'Reinspection report', 'Other']
export function addQaDocument(state, f, actor) {
  const e = needQA(actor)
  if (e) return fail(e)
  if (!f.title?.trim()) return fail('Enter the document title.')
  if (!QA_DOC_TYPES.includes(f.type)) return fail('Choose the document type.')
  if (!f.ref?.trim()) return fail('Link the document to a record (inspection, NCR, test or GRN reference).')
  if (!f.fileName) return fail('Choose the file to attach.')
  const id = nextId(state.qaDocs, 'QD-')
  const d = { id, title: f.title.trim(), type: f.type, ref: f.ref.trim(), fileName: f.fileName, addedBy: actor.name, at: stamp(), verified: false, demo: true }
  return ok({ ...state, qaDocs: [...state.qaDocs, d], audit: audit(state, actor, id, 'Quality document attached', `${d.type} · ${d.ref}`) }, `${id} attached (demo: file name recorded only, nothing uploaded)`)
}
export function verifyQaDocument(state, { id }, actor) {
  if (!allowed(actor, P.QUALITY_REVIEW)) return fail('Documents are verified by the QA reviewer.')
  const d = state.qaDocs.find((x) => x.id === id)
  if (!d) return fail('Document not found.')
  if (d.verified) return fail(`${id} is already verified.`)
  if (d.addedBy === actor.name) return fail('You attached this document; another QA engineer verifies it.')
  return ok({ ...state, qaDocs: updateIn(state.qaDocs, id, (x) => ({ ...x, verified: true, verifiedBy: actor.name, verifiedAt: stamp() })), audit: audit(state, actor, id, 'Quality document verified') }, `${id} verified`)
}

export function setQaPrefs(state, prefs, actor) {
  return ok({ ...state, qaPrefs: { ...state.qaPrefs, ...prefs }, audit: audit(state, actor, 'QA-PREFS', 'Notification preferences updated') }, 'Notification preferences saved for this session')
}

// Names registered with SiteContext (run as guarded transitions)
export const QA_TRANSITIONS = [
  'reportWorkReady', 'submitInspectionRequest', 'returnInspectionRequest', 'scheduleInspection', 'rescheduleInspection', 'saveInspectionDraft', 'submitInspectionResult',
  'recordClearance', 'createNcr', 'updateNcrDetails', 'updateCorrectiveAction', 'verifyCorrection', 'scheduleReinspection', 'saveChecklist', 'registerMaterialTest',
  'recordTestReport', 'reviewMaterialTest', 'addQaDocument', 'verifyQaDocument', 'setQaPrefs',
]
