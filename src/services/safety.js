/**
 * Site safety workflow (pure functions, no React). Works on the shared site state:
 *   safety (hazard / incident register), safetyActions (corrective actions), safetyInspections,
 *   ppeRecords, ppeChecks, trainingSessions, permits, emergencyPoints, fireChecks, drills, readinessNotes.
 *
 *   Anyone with safety.report (Site Engineer, Site Supervisor, Safety Officer): report a hazard or
 *   incident → Safety Officer reviews (severity, category, immediate control) → assigns corrective
 *   actions (owner + target date) → owner records progress and submits evidence → an authorised
 *   verifier (safety.verify, never the person who submitted the evidence) accepts or returns it →
 *   the record is closed by the verifier only when every action is closed (and, for incidents,
 *   once the investigation and root cause are recorded).
 *
 * Every transition is `(state, args, actor) → { state, message } | { error }`, checks the
 * record's status and the actor's permission, and appends to the record history (with previous →
 * new status) and the shared audit trail. Records are never deleted. DEMO: nothing is saved or sent.
 */
import { can, PERMISSIONS as P } from '../auth/demoRoles.js'
import { INCIDENT_KINDS, PERMIT_TYPES, PPE_ITEMS, SAFETY_CHECKLISTS, TRAINING_REQUIREMENTS } from '../data/demo/safetyDemo.js'
import { addDays, diffDays, todayISO } from '../utils/date.js'
import { nextId, nowStamp } from './inventory.js'
import { pmOf, siteOf, supervisorOf, workerOf, workersOf } from './site.js'

const stamp = () => nowStamp()
const fail = (error) => ({ error })
const ok = (state, message) => ({ state, message })
const updateIn = (list, id, fn) => list.map((r) => (r.id === id ? fn(r) : r))
const event = (actor, action, note = '', change = null) => ({ at: stamp(), by: actor.name, role: (actor.role || '') + (actor.simulated ? ' (simulated)' : ''), action, note, ...(change && { from: change[0], to: change[1] }) })
const allowed = (actor, perm) => (actor?.roleId ? can(actor.roleId, perm) : false)
const audit = (state, actor, ref, action, note = '') => [{ id: `SA-${(state.audit?.length || 0) + 1}`, ref, ...event(actor, action, note) }, ...(state.audit || [])]
const filled = (t, min = 5) => (t || '').trim().length >= min
const needManage = (actor) => (allowed(actor, P.SAFETY_MANAGE) ? '' : 'Only the Safety Officer can do this.')
const projectOfSite = (siteId) => (siteOf(siteId)?.project === 'Palm Grove Villas' ? 'P-102' : 'P-101')

export { INCIDENT_KINDS }
export const HAZARD_KINDS = ['Hazard', 'Safety observation', 'PPE compliance', 'Housekeeping', 'Site access', 'Unsafe work']
export const SAFETY_KINDS = [...HAZARD_KINDS, ...INCIDENT_KINDS]
export const isIncident = (x) => INCIDENT_KINDS.includes(x?.kind)
export const HIGH = ['High', 'Critical']
export const CA_STATUSES = ['Assigned', 'In Progress', 'Awaiting Verification', 'Returned for Correction', 'Closed']
export const CA_OPEN = CA_STATUSES.filter((s) => s !== 'Closed')
export const actionsFor = (state, sourceId) => (state.safetyActions || []).filter((a) => a.sourceId === sourceId)
export const caOverdue = (a, today = todayISO()) => a.status !== 'Closed' && a.due < today

/** Hazard / incident status for lists (the register keeps its existing status values) */
export function recordStage(x) {
  if (x.status === 'Verified closed') return 'Closed'
  if (!x.reviewedBy) return 'Awaiting Safety Officer review'
  if (x.status === 'Action done') return 'Awaiting verification'
  return x.status === 'Open' ? 'Reviewed: action to assign' : 'Corrective action in progress'
}

/** Re-derive a register record's status from its corrective actions (never past Action done: closing is a separate verified step) */
function syncRecord(state, sourceId) {
  const rec = state.safety.find((x) => x.id === sourceId)
  if (!rec || rec.status === 'Verified closed') return state
  const acts = actionsFor(state, sourceId)
  const next = !acts.length ? 'Open' : acts.every((a) => ['Awaiting Verification', 'Closed'].includes(a.status)) ? 'Action done' : 'Action in progress'
  if (next === rec.status) return state
  const latest = acts[acts.length - 1]
  return { ...state, safety: updateIn(state.safety, sourceId, (x) => ({ ...x, status: next, action: latest?.text || x.action, actionOwner: latest?.owner || x.actionOwner, actionDue: latest?.due || x.actionDue })) }
}

// =========================== Hazards and incidents ===========================
/**
 * Report a hazard, unsafe condition or incident. A high-risk hazard needs the immediate control
 * recorded (work stopped / area made safe) before it can be reported; the report never says the
 * work may continue. The reporter's suggested correction is kept for the Safety Officer.
 */
export function reportSafety(state, f, actor) {
  if (!allowed(actor, P.SAFETY_REPORT)) return fail('Your role cannot report safety observations here.')
  if (!f.siteId) return fail('Select the site.')
  if (!SAFETY_KINDS.includes(f.kind)) return fail('Select the type.')
  if (!filled(f.description, 10)) return fail('Describe what was seen (at least a sentence).')
  const high = HIGH.includes(f.severity) || ['Incident', 'Lost-time injury', 'Unsafe work'].includes(f.kind)
  if (high && !filled(f.immediateAction)) return fail('High risk: record the immediate action taken (work stopped, area barricaded, first aid…) before reporting.')
  if (state.safety.some((x) => x.siteId === f.siteId && x.date === todayISO() && x.description.trim().toLowerCase() === f.description.trim().toLowerCase())) return fail('This is already reported today (submitted twice?).')
  const id = nextId(state.safety.filter((s) => /^SO-/.test(s.id)), 'SO-')
  const incident = INCIDENT_KINDS.includes(f.kind)
  const escalation = high ? 'Project Manager' : actor.role === 'Site Supervisor' ? 'Site Engineer' : null
  const rec = {
    id, projectId: f.projectId || projectOfSite(f.siteId), siteId: f.siteId, kind: f.kind, category: f.category || 'Other', severity: f.severity || 'Medium',
    description: f.description.trim(), location: f.location?.trim() || '', date: todayISO(), time: stamp().slice(11, 16), reportedBy: actor.name, reporterRole: actor.role,
    immediateAction: f.immediateAction?.trim() || '', workStopped: !!f.workStopped, proposedAction: (f.proposedAction || f.action || '').trim(), responsibleTeam: f.responsibleTeam?.trim() || '',
    action: '', actionOwner: '', actionDue: null, status: 'Open', reviewedBy: null, photos: f.photos || [], linkedNcr: f.linkedNcr || null, escalation, demo: true,
    ...(incident && { incidentStage: 'Reported', peopleInvolved: f.peopleInvolved?.trim() || '', injuryDetails: f.injuryDetails?.trim() || '', witnesses: [], investigation: null }),
    history: [event(actor, `${f.kind} reported`, [f.immediateAction && `Immediate action: ${f.immediateAction.trim()}`, high && 'High risk: escalated to the Safety Officer and the Project Manager'].filter(Boolean).join('. '), ['New', 'Open'])],
  }
  return ok({ ...state, safety: [...state.safety, rec], audit: audit(state, actor, id, `${f.kind} reported`, f.severity) },
    `${id} reported to the Safety Officer${high ? ' and escalated to the Project Manager' : ''}`)
}

/** Safety Officer review: confirm or change severity / category and record the immediate control. */
export function reviewSafetyRecord(state, { id, severity, category, immediateAction, controlled, note, linkedNcr }, actor) {
  const e = needManage(actor)
  if (e) return fail(e)
  const x = state.safety.find((r) => r.id === id)
  if (!x) return fail('Record not found.')
  if (x.status === 'Verified closed') return fail(`${id} is closed.`)
  if (!['Low', 'Medium', 'High', 'Critical'].includes(severity)) return fail('Select the risk severity.')
  if (severity !== x.severity && !filled(note)) return fail('Give the reason for changing the severity.')
  if (HIGH.includes(severity) && !controlled) return fail('High risk: confirm the hazard is controlled (work stopped or area made safe) before continuing. Work must not proceed while it is uncontrolled.')
  if (HIGH.includes(severity) && !filled(immediateAction || x.immediateAction)) return fail('Record the immediate precaution taken.')
  if (linkedNcr && !state.ncrs.some((n) => n.id === linkedNcr)) return fail(`${linkedNcr} is not a quality NCR on record.`)
  const changes = [severity !== x.severity && `Severity ${x.severity} → ${severity}`, category && category !== x.category && `Category ${category}`, linkedNcr && linkedNcr !== x.linkedNcr && `Linked to quality NCR ${linkedNcr}`].filter(Boolean)
  return ok({
    ...state,
    safety: updateIn(state.safety, id, (r) => ({
      ...r, severity, category: category || r.category, immediateAction: immediateAction?.trim() || r.immediateAction, workStopped: r.workStopped || !!controlled, linkedNcr: linkedNcr || r.linkedNcr || null,
      reviewedBy: actor.name, reviewedAt: stamp(), escalation: HIGH.includes(severity) ? 'Project Manager' : r.escalation,
      history: [...(r.history || []), event(actor, 'Reviewed by Safety Officer', [changes.join('; '), note?.trim()].filter(Boolean).join('. '))],
    })),
    audit: audit(state, actor, id, 'Safety record reviewed', `${severity}${changes.length ? `; ${changes.join('; ')}` : ''}`),
  }, `${id} reviewed (${severity})`)
}

/** Incidents: investigation findings, witnesses and root cause are a separate step from reporting and closure. */
export function recordInvestigation(state, { id, findings, rootCause, witnesses, peopleInvolved, injuryDetails, complete }, actor) {
  const e = needManage(actor)
  if (e) return fail(e)
  const x = state.safety.find((r) => r.id === id)
  if (!x || !isIncident(x)) return fail('Incident not found.')
  if (x.status === 'Verified closed') return fail(`${id} is closed.`)
  if (!filled(findings, 10)) return fail('Record the investigation findings.')
  if (complete && !filled(rootCause, 10)) return fail('Record the root cause before completing the investigation.')
  const stage = complete ? 'Investigation Complete' : 'Under Investigation'
  return ok({
    ...state,
    safety: updateIn(state.safety, id, (r) => ({
      ...r, incidentStage: stage, peopleInvolved: peopleInvolved?.trim() ?? r.peopleInvolved, injuryDetails: injuryDetails?.trim() ?? r.injuryDetails,
      witnesses: witnesses?.trim() ? [...(r.witnesses || []), { at: stamp(), text: witnesses.trim() }] : r.witnesses || [],
      investigation: { findings: findings.trim(), rootCause: rootCause?.trim() || '', by: actor.name, at: stamp() }, reviewedBy: r.reviewedBy || actor.name,
      history: [...(r.history || []), event(actor, complete ? 'Investigation completed' : 'Investigation updated', rootCause ? `Root cause: ${rootCause.trim()}` : findings.trim(), [r.incidentStage || 'Reported', stage])],
    })),
    audit: audit(state, actor, id, complete ? 'Incident investigation completed' : 'Incident investigation updated', rootCause || ''),
  }, `${id}: ${stage.toLowerCase()}`)
}

/** Escalate for attention (does not change the record's status). */
export function escalateSafety(state, { id, to, note }, actor) {
  const s = state.safety.find((x) => x.id === id)
  if (!s) return fail('Record not found.')
  if (!allowed(actor, P.SAFETY_REPORT)) return fail('Not permitted.')
  if (!filled(note)) return fail('Say why it is being escalated.')
  return ok({ ...state, safety: updateIn(state.safety, id, (x) => ({ ...x, escalation: to, history: [...x.history, event(actor, `Escalated to ${to}`, note.trim())] })), audit: audit(state, actor, id, `Escalated to ${to}`, note) }, `${id} escalated to ${to} (demo: nobody is notified)`)
}

/**
 * Close a hazard / incident. Only an authorised verifier, only when every corrective action is
 * closed, and for incidents only after the investigation with root cause is complete.
 */
export function closeSafetyRecord(state, { id, note }, actor) {
  const x = state.safety.find((r) => r.id === id)
  if (!x) return fail('Record not found.')
  if (!allowed(actor, P.SAFETY_VERIFY)) return fail('Closure is verified by the authorised safety reviewer.')
  if (x.status === 'Verified closed') return fail(`${id} is already closed.`)
  if (!x.reviewedBy) return fail(`${id} has not been reviewed by the Safety Officer yet.`)
  const acts = actionsFor(state, id)
  if (!acts.length && HIGH.includes(x.severity)) return fail('A high-risk record needs at least one verified corrective action before closure.')
  const open = acts.filter((a) => a.status !== 'Closed')
  if (open.length) return fail(`Verify the corrective actions first: ${open.map((a) => `${a.id} (${a.status})`).join(', ')}.`)
  if (isIncident(x) && x.incidentStage !== 'Investigation Complete') return fail('Complete the incident investigation (findings and root cause) before closing.')
  if (!acts.length && !filled(note)) return fail('No corrective action was needed: record why.')
  return ok({
    ...state,
    safety: updateIn(state.safety, id, (r) => ({ ...r, status: 'Verified closed', verifiedBy: actor.name, closedAt: stamp(), history: [...r.history, event(actor, 'Verified and closed', note?.trim() || '', [r.status, 'Verified closed'])] })),
    audit: audit(state, actor, id, 'Safety record closed after verification', note || ''),
  }, `${id} closed after verification`)
}

/**
 * Older screens' "verify" button: verifies every action awaiting verification (as the verifier,
 * never the submitter) and closes the record, or returns them for correction.
 */
export function verifySafety(state, { id, close, note }, actor) {
  const x = state.safety.find((r) => r.id === id)
  if (!x) return fail('Record not found.')
  if (!allowed(actor, P.SAFETY_VERIFY)) return fail('Closure is verified by the authorised safety reviewer.')
  let s = state
  for (const a of actionsFor(state, id).filter((r) => r.status === 'Awaiting Verification')) {
    const r = verifySafetyAction(s, { id: a.id, accept: close, note: note || (close ? 'Verified on site' : '') }, actor)
    if (r.error) return r
    s = r.state
  }
  if (!close) return ok(s, `${id}: actions returned for correction`)
  const r = closeSafetyRecord({ ...s, safety: updateIn(s.safety, id, (rec) => ({ ...rec, reviewedBy: rec.reviewedBy || actor.name })) }, { id, note: note || 'Verified on site' }, actor)
  return r.error ? r : ok(r.state, r.message)
}

// =========================== Corrective actions ===========================
/** Assign a correction to a responsible person with a target date (from a hazard, incident or inspection). */
export function assignSafetyAction(state, { sourceType, sourceId, text, owner, ownerRole, priority, due }, actor) {
  const e = needManage(actor)
  if (e) return fail(e)
  const src = sourceType === 'Inspection' ? (state.safetyInspections || []).find((q) => q.id === sourceId) : state.safety.find((x) => x.id === sourceId)
  if (sourceType !== 'Safety plan task' && !src) return fail('Select the hazard, incident or inspection this action is for.')
  if (src?.status === 'Verified closed') return fail(`${sourceId} is closed.`)
  if (src && sourceType !== 'Inspection' && !src.reviewedBy) return fail(`Review ${sourceId} first (severity and immediate control).`)
  if (!filled(text, 10)) return fail('Describe the correction required.')
  if (!filled(owner, 3)) return fail('Assign a responsible person.')
  if (!due || due < todayISO()) return fail('Set a target date (today or later).')
  if ((state.safetyActions || []).some((a) => a.sourceId === sourceId && a.status !== 'Closed' && a.text.trim().toLowerCase() === text.trim().toLowerCase())) return fail('The same action is already open on this record.')
  const id = nextId((state.safetyActions || []).filter((a) => /^SCA-/.test(a.id)), 'SCA-')
  const a = {
    id, sourceType, sourceId: sourceId || null, projectId: src?.projectId || 'P-101', siteId: src?.siteId || null, text: text.trim(), owner: owner.trim(), ownerRole: ownerRole || '',
    priority: priority || 'Normal', due, status: 'Assigned', notes: [], evidence: [], submittedBy: null, verifiedBy: null, closedAt: null, assignedBy: actor.name, at: stamp(), demo: true,
    history: [event(actor, 'Corrective action assigned', `${owner.trim()}, due ${due}`, ['New', 'Assigned'])],
  }
  let next = { ...state, safetyActions: [...(state.safetyActions || []), a] }
  if (sourceType === 'Inspection') next = { ...next, safetyInspections: updateIn(next.safetyInspections, sourceId, (q) => ({ ...q, actionIds: [...(q.actionIds || []), id] })) }
  else if (src) next = syncRecord({ ...next, safety: updateIn(next.safety, sourceId, (x) => ({ ...x, history: [...x.history, event(actor, `Corrective action ${id} assigned to ${owner.trim()}`, `Due ${due}`)] })) }, sourceId)
  next.audit = audit(state, actor, id, 'Corrective action assigned', `${sourceId || 'safety plan'} → ${owner.trim()}`)
  return ok(next, `${id} assigned to ${owner.trim()}, due ${due}`)
}

const isOwner = (a, actor) => a.owner === actor.name
/** Owner (or the Safety Officer) records progress. */
export function updateSafetyAction(state, { id, note }, actor) {
  const a = (state.safetyActions || []).find((x) => x.id === id)
  if (!a) return fail('Corrective action not found.')
  if (!isOwner(a, actor) && !allowed(actor, P.SAFETY_MANAGE)) return fail(`${id} is assigned to ${a.owner}; only they or the Safety Officer can update it.`)
  if (['Closed', 'Awaiting Verification'].includes(a.status)) return fail(`${id} is ${a.status.toLowerCase()}.`)
  if (!filled(note)) return fail('Write the progress note.')
  const to = 'In Progress'
  let next = { ...state, safetyActions: updateIn(state.safetyActions, id, (x) => ({ ...x, status: to, notes: [...x.notes, { at: stamp(), by: actor.name, text: note.trim() }], history: [...x.history, event(actor, 'Progress noted', note.trim(), [x.status, to])] })) }
  if (a.sourceType !== 'Inspection' && a.sourceId) next = syncRecord(next, a.sourceId)
  next.audit = audit(state, actor, id, 'Corrective action progress', note)
  return ok(next, `${id} updated`)
}

/** The responsible person submits completion evidence; it then waits for an independent verifier. */
export function submitSafetyEvidence(state, { id, text, photos }, actor) {
  const a = (state.safetyActions || []).find((x) => x.id === id)
  if (!a) return fail('Corrective action not found.')
  if (!isOwner(a, actor)) return fail(`Evidence is submitted by the responsible person (${a.owner}).`)
  if (!['Assigned', 'In Progress', 'Returned for Correction'].includes(a.status)) return fail(`${id} is ${a.status.toLowerCase()}.`)
  if (!filled(text, 10)) return fail('Describe what was done (the verifier checks it on site).')
  const to = 'Awaiting Verification'
  let next = { ...state, safetyActions: updateIn(state.safetyActions, id, (x) => ({ ...x, status: to, submittedBy: actor.name, evidence: [...x.evidence, { at: stamp(), by: actor.name, text: text.trim(), photos: photos || [] }], history: [...x.history, event(actor, 'Completion evidence submitted', text.trim(), [x.status, to])] })) }
  if (a.sourceType !== 'Inspection' && a.sourceId) next = syncRecord(next, a.sourceId)
  next.audit = audit(state, actor, id, 'Corrective action evidence submitted', text)
  return ok(next, `${id}: evidence submitted, awaiting verification`)
}

/** Independent verification: accept (Closed) or return for correction (reason required). */
export function verifySafetyAction(state, { id, accept, note }, actor) {
  const a = (state.safetyActions || []).find((x) => x.id === id)
  if (!a) return fail('Corrective action not found.')
  if (!allowed(actor, P.SAFETY_VERIFY)) return fail('Corrective actions are verified by the authorised safety verifier.')
  if (a.status !== 'Awaiting Verification') return fail(`${id} is ${a.status.toLowerCase()}; there is no evidence to verify.`)
  if (a.submittedBy === actor.name || a.owner === actor.name) return fail('You submitted this correction; another person must verify it.')
  if (!accept && !filled(note)) return fail('Say what still needs correcting.')
  const to = accept ? 'Closed' : 'Returned for Correction'
  let next = { ...state, safetyActions: updateIn(state.safetyActions, id, (x) => ({ ...x, status: to, verifiedBy: accept ? actor.name : null, closedAt: accept ? stamp() : null, returnNote: accept ? x.returnNote : note.trim(), history: [...x.history, event(actor, accept ? 'Verified on site and closed' : 'Returned for correction', note?.trim() || '', [x.status, to])] })) }
  if (a.sourceType !== 'Inspection' && a.sourceId) next = syncRecord(next, a.sourceId)
  next.audit = audit(state, actor, id, accept ? 'Corrective action verified' : 'Corrective action returned', note || '')
  return ok(next, `${id} ${accept ? 'verified and closed' : 'returned for correction'}`)
}

/** Older screens' "update / done" buttons work on the record's own open action(s). */
export function updateSafety(state, { id, done, note }, actor) {
  const x = state.safety.find((r) => r.id === id)
  if (!x) return fail('Record not found.')
  if (!allowed(actor, P.SAFETY_REPORT)) return fail('Not permitted.')
  const mine = actionsFor(state, id).filter((a) => isOwner(a, actor) && ['Assigned', 'In Progress', 'Returned for Correction'].includes(a.status))
  if (!mine.length) return fail(actionsFor(state, id).length ? `No open corrective action on ${id} is assigned to you.` : `${id} has no corrective action yet: the Safety Officer assigns one after review.`)
  let s = state
  for (const a of mine) {
    const r = done ? submitSafetyEvidence(s, { id: a.id, text: note }, actor) : updateSafetyAction(s, { id: a.id, note }, actor)
    if (r.error) return r
    s = r.state
  }
  return ok(s, done ? `${id}: evidence submitted; closure needs safety verification` : `${id} updated`)
}

// =========================== Safety inspections ===========================
export const INSPECTION_STATUSES = ['Scheduled', 'In Progress', 'Passed', 'Failed', 'Requires Follow-up']
export function scheduleSafetyInspection(state, f, actor) {
  const e = needManage(actor)
  if (e) return fail(e)
  if (!f.siteId) return fail('Select the site.')
  if (!SAFETY_CHECKLISTS[f.category]) return fail('Select the inspection category.')
  if (!filled(f.workArea, 3)) return fail('Enter the work area.')
  if (!f.date) return fail('Enter the scheduled date.')
  if (!filled(f.inspector, 3)) return fail('Assign the inspector.')
  if ((state.safetyInspections || []).some((q) => q.siteId === f.siteId && q.category === f.category && q.date === f.date && q.workArea.trim().toLowerCase() === f.workArea.trim().toLowerCase() && ['Scheduled', 'In Progress'].includes(q.status))) return fail('The same inspection is already scheduled.')
  const id = nextId(state.safetyInspections || [], 'SIN-')
  const q = { id, projectId: projectOfSite(f.siteId), siteId: f.siteId, category: f.category, workArea: f.workArea.trim(), inspector: f.inspector.trim(), date: f.date, status: 'Scheduled',
    checklist: SAFETY_CHECKLISTS[f.category].map((item) => ({ item, result: null, note: '' })), findings: '', severity: null, photos: [], actionIds: [], demo: true,
    history: [event(actor, 'Inspection scheduled', `${f.category}, ${f.date}`, ['New', 'Scheduled'])] }
  return ok({ ...state, safetyInspections: [...(state.safetyInspections || []), q], audit: audit(state, actor, id, 'Safety inspection scheduled', f.category) }, `${id} scheduled for ${f.date}`)
}

/** Record the checklist (save as In Progress, or complete with a result from the checklist). */
export function recordSafetyInspection(state, { id, checklist, findings, severity, photos, complete, followUp }, actor) {
  const e = needManage(actor)
  if (e) return fail(e)
  const q = (state.safetyInspections || []).find((x) => x.id === id)
  if (!q) return fail('Inspection not found.')
  if (!['Scheduled', 'In Progress'].includes(q.status)) return fail(`${id} is already ${q.status.toLowerCase()}; results are not overwritten.`)
  if (q.date > todayISO()) return fail(`${id} is scheduled for ${q.date}; record it on the day.`)
  const items = checklist || q.checklist
  let to = 'In Progress'
  if (complete) {
    if (items.some((c) => !c.result)) return fail('Record Pass, Fail or N/A for every checklist item.')
    const failed = items.some((c) => c.result === 'Fail')
    if (failed && !filled(findings, 10)) return fail('Describe the findings for the failed items.')
    if (failed && !['Low', 'Medium', 'High', 'Critical'].includes(severity)) return fail('Select the risk severity of the findings.')
    to = !failed ? 'Passed' : followUp ? 'Requires Follow-up' : 'Failed'
  }
  return ok({
    ...state,
    safetyInspections: updateIn(state.safetyInspections, id, (x) => ({ ...x, checklist: items, findings: findings?.trim() ?? x.findings, severity: severity || x.severity, photos: [...(x.photos || []), ...(photos || [])], status: to, completedAt: complete ? stamp() : null, inspector: x.inspector,
      history: [...x.history, event(actor, complete ? `Result recorded: ${to}` : 'Checklist saved (in progress)', findings?.trim() || '', [x.status, to])] })),
    audit: audit(state, actor, id, complete ? `Safety inspection ${to.toLowerCase()}` : 'Safety inspection in progress', findings || ''),
  }, `${id}: ${to}${complete && to !== 'Passed' ? '. Assign corrective actions for the findings' : ''}`)
}

// =========================== PPE ===========================
export function issuePPE(state, { workerId, item, issueDate, replaceBy }, actor) {
  const e = needManage(actor)
  if (e) return fail(e)
  const w = workerOf(workerId)
  if (!w) return fail('Select the worker (from the worker register).')
  if (!PPE_ITEMS.includes(item)) return fail('Select the PPE item.')
  if (!issueDate || issueDate > todayISO()) return fail('Enter the issue date (not in the future).')
  if (replaceBy && replaceBy <= issueDate) return fail('The replacement date must be after the issue date.')
  if ((state.ppeRecords || []).some((r) => r.workerId === workerId && r.item === item && ['Issued', 'Replacement due'].includes(r.status) && r.condition !== 'Damaged')) return fail(`${w.name} already has a ${item.toLowerCase()} in use. Mark it returned or damaged first.`)
  const id = nextId(state.ppeRecords || [], 'PPE-')
  const rec = { id, workerId, projectId: projectOfSite(w.siteId), siteId: w.siteId, item, issued: issueDate, replaceBy: replaceBy || null, condition: 'Good', status: 'Issued', issuedBy: actor.name, demo: true, history: [event(actor, `${item} issued`, '', ['New', 'Issued'])] }
  return ok({ ...state, ppeRecords: [...(state.ppeRecords || []), rec], audit: audit(state, actor, id, 'PPE issued', `${item} to ${w.name}`) }, `${item} issued to ${w.name} (issue is not proof of use; compliance comes from field checks)`)
}
export function updatePPE(state, { id, condition, status, note }, actor) {
  const e = needManage(actor)
  if (e) return fail(e)
  const r = (state.ppeRecords || []).find((x) => x.id === id)
  if (!r) return fail('PPE record not found.')
  if (['Returned', 'Lost'].includes(r.status)) return fail(`${id} is ${r.status.toLowerCase()}.`)
  if (!filled(note)) return fail('Give the reason for the change.')
  const to = status || (condition === 'Damaged' ? 'Replacement needed' : r.status)
  return ok({ ...state, ppeRecords: updateIn(state.ppeRecords, id, (x) => ({ ...x, condition: condition || x.condition, status: to, history: [...x.history, event(actor, 'PPE record updated', note.trim(), [x.status, to])] })), audit: audit(state, actor, id, 'PPE record updated', note) }, `${id} updated`)
}
/** Field check: how many workers seen at a work front were wearing the required PPE. */
export function recordPPECheck(state, { siteId, workArea, observed, compliant, item, notes }, actor) {
  const e = needManage(actor)
  if (e) return fail(e)
  const o = Number(observed); const c = Number(compliant)
  if (!siteId) return fail('Select the site.')
  if (!Number.isInteger(o) || o <= 0) return fail('Enter how many workers were observed.')
  if (!Number.isInteger(c) || c < 0 || c > o) return fail('Compliant workers must be between 0 and the number observed.')
  if (c < o && !filled(notes)) return fail('Note what was missing.')
  const id = nextId(state.ppeChecks || [], 'PPC-')
  const rec = { id, projectId: projectOfSite(siteId), siteId, date: todayISO(), workArea: workArea?.trim() || '', observed: o, compliant: c, item: item || 'Helmets, shoes, vests', by: actor.name, notes: notes?.trim() || '', demo: true }
  return ok({ ...state, ppeChecks: [...(state.ppeChecks || []), rec], audit: audit(state, actor, id, 'PPE compliance check', `${c}/${o}`) }, `${id}: ${c} of ${o} compliant (${Math.round((c / o) * 100)}%)`)
}

// =========================== Training ===========================
export function recordTraining(state, f, actor) {
  if (!allowed(actor, P.SAFETY_MANAGE) && !(allowed(actor, P.SAFETY_REPORT) && f.type === 'Toolbox talk')) return fail('Training records are kept by the Safety Officer (toolbox talks may be recorded by site staff).')
  if (!f.siteId) return fail('Select the site.')
  if (!filled(f.type, 3) || !filled(f.title, 5)) return fail('Enter the training type and topic.')
  if (!f.date || f.date > todayISO()) return fail('Enter the training date (not in the future).')
  if (!filled(f.trainer, 3)) return fail('Enter the trainer.')
  if (!f.attendees?.length) return fail('Mark the workers who attended.')
  if ((state.trainingSessions || []).some((t) => t.siteId === f.siteId && t.date === f.date && t.title.trim().toLowerCase() === f.title.trim().toLowerCase())) return fail('This session is already recorded.')
  const req = TRAINING_REQUIREMENTS.find((r) => r.type === f.type)
  const id = nextId(state.trainingSessions || [], 'TRN-')
  const rec = { id, type: f.type, title: f.title.trim(), date: f.date, trainer: f.trainer.trim(), projectId: projectOfSite(f.siteId), siteId: f.siteId, attendees: [...new Set(f.attendees)], renewMonths: req?.renewMonths || 0, docs: (f.docs || []).filter(Boolean), by: actor.name, demo: true, history: [event(actor, 'Training recorded', `${f.attendees.length} attended`)] }
  return ok({ ...state, trainingSessions: [...(state.trainingSessions || []), rec], audit: audit(state, actor, id, 'Training recorded', `${f.type}: ${f.attendees.length} attended`) }, `${id} recorded: ${f.attendees.length} attended`)
}
/** For each worker on a site: required training, last completed, renewal due and status. */
export function trainingStatus(state, siteId, today = todayISO()) {
  return workersOf(siteId).flatMap((w) => TRAINING_REQUIREMENTS.filter((r) => r.trades === 'all' || r.trades.includes(w.trade)).map((r) => {
    const last = (state.trainingSessions || []).filter((t) => t.type === r.type && t.attendees.includes(w.id)).sort((a, b) => b.date.localeCompare(a.date))[0]
    const renewal = last && r.renewMonths ? addDays(last.date, Math.round(r.renewMonths * 30.4)) : null
    const status = !last ? 'Not completed' : renewal && renewal < today ? 'Expired' : renewal && diffDays(today, renewal) <= 30 ? 'Due soon' : 'Valid'
    return { key: `${w.id}-${r.type}`, worker: w, type: r.type, last, renewal, status }
  }))
}

// =========================== Permit to work ===========================
/** Status for display: an approved / active permit past its validity is Expired, never valid. */
export function permitStatus(p, now = stamp()) {
  if (['Approved', 'Active'].includes(p.status) && p.validTo && p.validTo < now) return 'Expired'
  return p.status
}
export const permitValidNow = (p, now = stamp()) => permitStatus(p, now) === 'Active' && p.validFrom <= now

export function savePermit(state, f, actor) {
  const e = needManage(actor)
  if (e) return fail(e)
  if (!PERMIT_TYPES.includes(f.type)) return fail('Select the permit type.')
  if (!f.siteId || !filled(f.workArea, 3)) return fail('Enter the site and work area.')
  if (!filled(f.activity, 5)) return fail('Describe the activity.')
  if (!filled(f.hazards, 5)) return fail('Record the hazard assessment.')
  const precautions = (f.precautions || []).map((x) => x.trim()).filter(Boolean)
  if (!precautions.length) return fail('List the required precautions.')
  if (!f.validFrom || !f.validTo || f.validTo <= f.validFrom) return fail('Enter a validity period (end after start).')
  if (!filled(f.supervisor, 3)) return fail('Name the responsible supervisor.')
  const existing = f.id && state.permits.find((p) => p.id === f.id)
  if (existing && existing.status !== 'Draft') return fail(`${existing.id} is ${existing.status.toLowerCase()}; it cannot be edited.`)
  const id = existing?.id || nextId(state.permits || [], 'PTW-')
  const rec = { ...(existing || { history: [event(actor, 'Permit drafted', '', ['New', 'Draft'])], preparedBy: actor.name, approver: null, closure: null }), id, type: f.type, projectId: projectOfSite(f.siteId), siteId: f.siteId, workArea: f.workArea.trim(), activity: f.activity.trim(), hazards: f.hazards.trim(), precautions, validFrom: f.validFrom, validTo: f.validTo, supervisor: f.supervisor.trim(), status: 'Draft', demo: true }
  const permits = existing ? updateIn(state.permits, id, () => ({ ...rec, history: [...existing.history, event(actor, 'Draft edited')] })) : [...(state.permits || []), rec]
  return ok({ ...state, permits, audit: audit(state, actor, id, existing ? 'Permit draft edited' : 'Permit drafted', f.type) }, `${id} saved as a draft (not valid for work)`)
}
function permitMove(state, id, from, to, actor, action, note = '', patch = {}) {
  const p = (state.permits || []).find((x) => x.id === id)
  if (!p) return fail('Permit not found.')
  if (!from.includes(permitStatus(p))) return fail(`${id} is ${permitStatus(p).toLowerCase()}.`)
  return ok({ ...state, permits: updateIn(state.permits, id, (x) => ({ ...x, ...patch, status: to, history: [...x.history, event(actor, action, note, [permitStatus(x), to])] })), audit: audit(state, actor, id, `Permit ${action.toLowerCase()}`, note) }, `${id}: ${to}`)
}
export function submitPermit(state, { id }, actor) {
  const e = needManage(actor)
  if (e) return fail(e)
  return permitMove(state, id, ['Draft'], 'Pending Approval', actor, 'Submitted for approval', `Approver: ${pmOf(state.permits.find((p) => p.id === id)?.projectId)} (Project Manager)`)
}
/** Authorised approver (the project's Project Manager, or Admin): never the person who prepared it. */
export function decidePermit(state, { id, approve, note }, actor) {
  const p = (state.permits || []).find((x) => x.id === id)
  if (!p) return fail('Permit not found.')
  if (!allowed(actor, P.PERMIT_APPROVE)) return fail('Permits are approved by the authorised approver (Project Manager).')
  if (actor.role === 'Project Manager' && pmOf(p.projectId) !== actor.name) return fail(`Only ${pmOf(p.projectId)}, the Project Manager of this project, approves its permits.`)
  if (p.preparedBy === actor.name) return fail('You prepared this permit; another person must approve it.')
  if (!approve && !filled(note)) return fail('Give the reason for returning the permit.')
  if (approve && p.validTo < stamp()) return fail('The validity period has already ended; return it to be re-dated.')
  return approve
    ? permitMove(state, id, ['Pending Approval'], 'Approved', actor, 'Approved', note || '', { approver: actor.name, approvedAt: stamp() })
    : permitMove(state, id, ['Pending Approval'], 'Draft', actor, 'Returned to draft', note.trim())
}
export function activatePermit(state, { id, checked }, actor) {
  const e = needManage(actor)
  if (e) return fail(e)
  const p = (state.permits || []).find((x) => x.id === id)
  if (!p) return fail('Permit not found.')
  if (!checked) return fail('Confirm every precaution is in place on site before activating.')
  if (p.validFrom > stamp()) return fail(`${id} is valid from ${p.validFrom.replace('T', ' ')}.`)
  return permitMove(state, id, ['Approved'], 'Active', actor, 'Activated after precautions checked', '', { activatedAt: stamp() })
}
export function suspendPermit(state, { id, note }, actor) {
  if (!allowed(actor, P.SAFETY_MANAGE) && !allowed(actor, P.PERMIT_APPROVE)) return fail('Permits are suspended by the Safety Officer or the approver.')
  if (!filled(note)) return fail('Give the reason for suspending (work stops immediately).')
  return permitMove(state, id, ['Active', 'Approved'], 'Suspended', actor, 'Suspended: work must stop', note.trim())
}
export function resumePermit(state, { id, note, checked }, actor) {
  const e = needManage(actor)
  if (e) return fail(e)
  if (!checked || !filled(note)) return fail('Record what was corrected and confirm the precautions are back in place.')
  return permitMove(state, id, ['Suspended'], 'Active', actor, 'Resumed after correction', note.trim())
}
export function closePermit(state, { id, handover }, actor) {
  const e = needManage(actor)
  if (e) return fail(e)
  if (!filled(handover, 10)) return fail('Record the closure and handover (area left safe, who took it over).')
  return permitMove(state, id, ['Active', 'Approved', 'Expired', 'Suspended'], 'Closed', actor, 'Closed and handed over', handover.trim(), { closure: { by: actor.name, at: stamp(), handover: handover.trim() } })
}

// =========================== Emergency preparedness ===========================
export function saveEmergencyPoint(state, { id, kind, siteId, location, verified }, actor) {
  const e = needManage(actor)
  if (e) return fail(e)
  if (!filled(kind, 3) || !siteId || !filled(location, 5)) return fail('Enter the type, site and location.')
  const existing = id && state.emergencyPoints.find((x) => x.id === id)
  const rec = { ...(existing || {}), id: existing?.id || nextId(state.emergencyPoints || [], 'EP-'), kind: kind.trim(), projectId: projectOfSite(siteId), siteId, location: location.trim(), verified: !!verified, by: actor.name, at: stamp(), demo: true }
  const emergencyPoints = existing ? updateIn(state.emergencyPoints, id, () => rec) : [...(state.emergencyPoints || []), rec]
  return ok({ ...state, emergencyPoints, audit: audit(state, actor, rec.id, existing ? 'Emergency point updated' : 'Emergency point recorded', `${kind}: ${location}${verified ? ' (verified on site)' : ''}`) }, `${rec.id} ${existing ? 'updated' : 'recorded'}`)
}
export function recordFireCheck(state, { siteId, item, location, result, nextDue }, actor) {
  const e = needManage(actor)
  if (e) return fail(e)
  if (!siteId || !filled(item, 3) || !filled(location, 3) || !filled(result, 3)) return fail('Enter the equipment, location and result.')
  if (!nextDue || nextDue <= todayISO()) return fail('Set the next check date.')
  const id = nextId(state.fireChecks || [], 'FEQ-')
  return ok({ ...state, fireChecks: [...(state.fireChecks || []), { id, projectId: projectOfSite(siteId), siteId, item: item.trim(), location: location.trim(), date: todayISO(), result: result.trim(), nextDue, by: actor.name, demo: true }], audit: audit(state, actor, id, 'Fire equipment checked', result) }, `${id} recorded`)
}
export function scheduleDrill(state, { siteId, type, date }, actor) {
  const e = needManage(actor)
  if (e) return fail(e)
  if (!siteId || !filled(type, 5) || !date || date < todayISO()) return fail('Enter the site, drill type and a date from today.')
  const id = nextId(state.drills || [], 'DRL-')
  return ok({ ...state, drills: [...(state.drills || []), { id, projectId: projectOfSite(siteId), siteId, type: type.trim(), date, status: 'Scheduled', attendance: null, evacuationMinutes: null, outcome: '', by: actor.name, demo: true }], audit: audit(state, actor, id, 'Drill scheduled', type) }, `${id} scheduled for ${date}`)
}
export function recordDrill(state, { id, attendance, evacuationMinutes, outcome }, actor) {
  const e = needManage(actor)
  if (e) return fail(e)
  const d = (state.drills || []).find((x) => x.id === id)
  if (!d) return fail('Drill not found.')
  if (d.status !== 'Scheduled') return fail(`${id} is already recorded.`)
  if (d.date > todayISO()) return fail(`${id} is scheduled for ${d.date}.`)
  if (!(Number(attendance) > 0) || !filled(outcome, 10)) return fail('Enter the attendance and the outcome (what went well, what to fix).')
  return ok({ ...state, drills: updateIn(state.drills, id, (x) => ({ ...x, status: 'Completed', attendance: Number(attendance), evacuationMinutes: Number(evacuationMinutes) || null, outcome: outcome.trim(), recordedBy: actor.name })), audit: audit(state, actor, id, 'Drill outcome recorded', outcome) }, `${id} recorded`)
}
export function addReadinessNote(state, { siteId, text }, actor) {
  if (!allowed(actor, P.SAFETY_REPORT)) return fail('Not permitted.')
  if (!siteId || !filled(text, 10)) return fail('Select the site and describe the observation.')
  const id = nextId(state.readinessNotes || [], 'RN-')
  return ok({ ...state, readinessNotes: [{ id, projectId: projectOfSite(siteId), siteId, date: todayISO(), text: text.trim(), by: actor.name, demo: true }, ...(state.readinessNotes || [])], audit: audit(state, actor, id, 'Emergency readiness observation', text) }, `${id} recorded`)
}

export const SAFETY_TRANSITIONS = [
  'reportSafety', 'reviewSafetyRecord', 'recordInvestigation', 'escalateSafety', 'closeSafetyRecord', 'verifySafety', 'updateSafety',
  'assignSafetyAction', 'updateSafetyAction', 'submitSafetyEvidence', 'verifySafetyAction',
  'scheduleSafetyInspection', 'recordSafetyInspection', 'issuePPE', 'updatePPE', 'recordPPECheck', 'recordTraining',
  'savePermit', 'submitPermit', 'decidePermit', 'activatePermit', 'suspendPermit', 'resumePermit', 'closePermit',
  'saveEmergencyPoint', 'recordFireCheck', 'scheduleDrill', 'recordDrill', 'addReadinessNote',
]
export const supervisorFor = supervisorOf
