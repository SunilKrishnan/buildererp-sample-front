/**
 * Site Engineer records and rules (pure functions, no React).
 *
 * Quantities:
 *  - A task's completed quantity = brought-forward + quantities in SUBMITTED / REVIEWED daily
 *    reports. Drafts and returned reports never count.
 *  - A BOQ item's executed quantity = the completed quantity of all its tasks. Measurements
 *    certify executed work and can never exceed it. Remaining = approved − executed.
 *  - Approved BOQ quantities change only through a revision approved by the Project Manager.
 *
 * Every transition is `(state, args, actor) → { state, message } | { error }` and checks the
 * record's current status and the actor's permission first. Roles without a login in this demo
 * (Project Manager, Site Supervisor) act through labelled simulations (actor.simulated).
 * DEMO: nothing is saved or sent.
 */
import { can, PERMISSIONS as P } from '../auth/demoRoles.js'
import { projects, sites as SITE_LIST } from '../data/mockData.js'
import { PROJECT_MANAGERS, SITES } from '../data/demo/inventoryDemo.js'
import {
  ATTENDANCE_RECORDS, BOQ_ITEMS, DAILY_REPORTS, DIARY, DOCUMENTS, EQUIPMENT, EQUIPMENT_LOGS, EQUIPMENT_REQUESTS, INSPECTIONS, LABOUR_REQUESTS, MEASUREMENTS,
  LABOUR_ALLOCATION, MESSAGES, NCRS, NOTIFICATION_PREFS, SHORTAGE_REPORTS, SITE_ASSIGNMENTS, SITE_ISSUES, SUPERVISOR_PROGRESS, TASK_CREWS, TASKS,
  WEATHER_RESTRICTIONS, WORK_ALLOCATIONS,
} from '../data/demo/siteDemo.js'
import { CHECKLISTS, MATERIAL_TESTS, QA_INSPECTIONS, QA_NCRS, QA_PREFS, QA_REQUESTS } from '../data/demo/qaDemo.js'
import {
  DRILLS, EMERGENCY_POINTS, FIRE_EQUIPMENT_CHECKS, PERMITS, PPE_CHECKS, PPE_RECORDS, READINESS_NOTES, SAFETY_CORRECTIVE_ACTIONS, SAFETY_INSPECTIONS, SAFETY_REGISTER, TRAINING_SESSIONS,
} from '../data/demo/safetyDemo.js'
import { labour as WORKERS } from '../data/mockData.js'
import { addDays, diffDays, todayISO } from '../utils/date.js'
import { materialOf, nextId, nowStamp, round2 } from './inventory.js'

export const COUNTED_DPR = ['Submitted', 'Reviewed']
const stamp = () => nowStamp()
const fail = (error) => ({ error })
const ok = (state, message) => ({ state, message })
const updateIn = (list, id, fn) => list.map((r) => (r.id === id ? fn(r) : r))
const event = (actor, action, note = '') => ({ at: stamp(), by: actor.name, role: (actor.role || '') + (actor.simulated ? ' (simulated)' : ''), action, note })
const allowed = (actor, perm) => (actor?.roleId ? can(actor.roleId, perm) : false)
const isPM = (actor) => actor?.role === 'Project Manager'
/** The Project Manager of this project (a signed-in PM may act only on projects they manage). */
const isPMFor = (actor, projectId) => isPM(actor) && (actor.simulated || PROJECT_MANAGERS[projectId] === actor.name)
const notMine = (projectId) => `Only ${PROJECT_MANAGERS[projectId] || 'the Project Manager'}, the Project Manager of this project, can decide this.`
const audit = (state, actor, ref, action, note = '') => [{ id: `SA-${(state.audit?.length || 0) + 1}`, ref, ...event(actor, action, note) }, ...(state.audit || [])]
const num = (v) => (v === '' || v == null ? NaN : Number(v))

export function initialSiteState() {
  return {
    assignments: SITE_ASSIGNMENTS, boq: BOQ_ITEMS, tasks: TASKS, reports: DAILY_REPORTS, measurements: MEASUREMENTS,
    // Inspections and NCRs are one shared list for the Site Engineer, Supervisor, PM and QA
    inspections: [...INSPECTIONS, ...QA_INSPECTIONS], ncrs: [...NCRS, ...QA_NCRS], safety: SAFETY_REGISTER, safetyActions: SAFETY_CORRECTIVE_ACTIONS, documents: DOCUMENTS, issues: SITE_ISSUES,
    equipment: EQUIPMENT, equipmentLogs: EQUIPMENT_LOGS, equipmentRequests: EQUIPMENT_REQUESTS, diary: DIARY, messages: MESSAGES,
    labourRequests: LABOUR_REQUESTS, weather: WEATHER_RESTRICTIONS, prefs: NOTIFICATION_PREFS, audit: [],
    // Site Supervisor records
    // QA records (see services/qa.js)
    // Safety records (see services/safety.js)
    safetyInspections: SAFETY_INSPECTIONS, ppeRecords: PPE_RECORDS, ppeChecks: PPE_CHECKS, trainingSessions: TRAINING_SESSIONS, permits: PERMITS,
    emergencyPoints: EMERGENCY_POINTS, fireChecks: FIRE_EQUIPMENT_CHECKS, drills: DRILLS, readinessNotes: READINESS_NOTES,
    qaRequests: QA_REQUESTS, checklists: CHECKLISTS, materialTests: MATERIAL_TESTS, qaDocs: [], qaPrefs: QA_PREFS,
    attendanceRecords: ATTENDANCE_RECORDS, allocations: WORK_ALLOCATIONS, supervisorProgress: SUPERVISOR_PROGRESS, shortageReports: SHORTAGE_REPORTS,
  }
}

// ---------- Scope: only the projects / sites assigned to the signed-in Site Engineer ----------
export const projectOf = (id) => projects.find((p) => p.id === id)
export const siteOf = (id) => SITE_LIST.find((s) => s.id === id)
export const siteStoreOf = (siteId) => SITES.find((s) => s.id === siteId)?.storeId
export const supervisorOf = (siteId) => SITES.find((s) => s.id === siteId)?.supervisor
export const pmOf = (projectId) => PROJECT_MANAGERS[projectId] || 'Project Manager'

/** A Site Supervisor sees the sites where they are the named supervisor; Admin sees all. */
export function supervisorScope(user, role) {
  const all = role?.id === 'admin'
  const sites = SITES.filter((s) => all || s.supervisor === user?.name)
  return { all, siteIds: sites.map((s) => s.id), projectIds: [...new Set(sites.map((s) => s.projectId))], assignments: [] }
}
export const engineerOf = (siteId) => SITE_ASSIGNMENTS.find((a) => a.siteIds.includes(siteId))?.engineer
export const workersOf = (siteId) => WORKERS.filter((w) => w.siteId === siteId)
export const workerOf = (id) => WORKERS.find((w) => w.id === id)

/** Admin sees every site (oversight); a Site Engineer only their assignments. */
export function scopeFor(state, user, role) {
  const all = role?.id === 'admin'
  const mine = all ? state.assignments : state.assignments.filter((a) => a.engineer === user?.name)
  const projectIds = [...new Set(mine.map((a) => a.projectId))]
  const siteIds = [...new Set(mine.flatMap((a) => a.siteIds))]
  return { all, projectIds, siteIds, assignments: mine }
}
/** In scope: the record's project is assigned, and its site (if it has one) is assigned. */
export const inScope = (scope, r) => !!r && scope.projectIds.includes(r.projectId) && (!r.siteId || scope.siteIds.includes(r.siteId))
export const scoped = (scope, list) => list.filter((r) => inScope(scope, r))

// ---------- Quantities ----------
/** Supervisor-recorded quantity on a task that the Site Engineer has verified (optionally up to a date) */
export function verifiedSupervisorQty(state, taskId, upTo = null, excludeDate = null) {
  return round2((state.supervisorProgress || []).filter((p) => p.taskId === taskId && p.status === 'Verified' && (!upTo || p.date <= upTo) && p.date !== excludeDate).reduce((s, p) => s + p.qty, 0))
}
export function taskDone(state, taskId) {
  const t = state.tasks.find((x) => x.id === taskId)
  const fromReports = state.reports.filter((r) => COUNTED_DPR.includes(r.status)).flatMap((r) => r.entries).filter((en) => en.taskId === taskId).reduce((s, en) => s + Number(en.qty || 0), 0)
  return round2((t?.broughtForward || 0) + fromReports + verifiedSupervisorQty(state, taskId))
}

export function boqView(state, item, today = todayISO()) {
  const tasks = state.tasks.filter((t) => t.boqId === item.id)
  const executed = round2(tasks.reduce((s, t) => s + taskDone(state, t.id), 0))
  const weekAgo = addDays(today, -6)
  const thisPeriod = round2(state.reports.filter((r) => COUNTED_DPR.includes(r.status) && r.date >= weekAgo && r.date <= today)
    .flatMap((r) => r.entries).filter((en) => tasks.some((t) => t.id === en.taskId)).reduce((s, en) => s + Number(en.qty || 0), 0))
  const ms = state.measurements.filter((m) => m.boqId === item.id && m.status !== 'Rejected')
  const measuredVerified = round2(ms.filter((m) => m.status === 'Verified').reduce((s, m) => s + m.qty, 0))
  const measuredPending = round2(ms.filter((m) => m.status !== 'Verified').reduce((s, m) => s + m.qty, 0))
  const planned = round2(tasks.reduce((s, t) => s + t.plannedQty, 0))
  const pendingRevision = (item.revisions || []).find((r) => r.status === 'Pending')
  return {
    ...item, tasks, planned, executed, thisPeriod, measuredVerified, measuredPending, unmeasured: round2(executed - measuredVerified - measuredPending),
    remaining: round2(item.approvedQty - executed), pct: item.approvedQty ? Math.round((executed / item.approvedQty) * 1000) / 10 : 0, pendingRevision,
  }
}

/** Task status from quantities and dates (not typed in by hand). */
export function taskView(state, t, today = todayISO()) {
  const done = taskDone(state, t.id)
  const remaining = round2(Math.max(0, t.plannedQty - done))
  const pct = t.plannedQty ? Math.min(100, Math.round((done / t.plannedQty) * 100)) : 0
  const preds = t.dependsOn.map((id) => state.tasks.find((x) => x.id === id)).filter(Boolean)
  const blockedBy = preds.filter((p) => taskDone(state, p.id) < p.plannedQty).map((p) => p.id)
  let status
  if (done >= t.plannedQty) status = 'Completed'
  else if (t.deadline < today) status = 'Delayed'
  else if (blockedBy.length && t.start <= today && done === 0) status = 'Blocked' // cannot start until predecessors finish
  else if (done > 0 || t.start <= today) status = 'In Progress'
  else status = 'Not Started'
  const boqItem = state.boq.find((b) => b.id === t.boqId)
  const daysLate = status === 'Delayed' ? diffDays(t.deadline, today) : 0
  // Planned vs actual: planned-to-date assumes even progress from start to deadline
  const span = Math.max(1, diffDays(t.start, t.deadline))
  const elapsed = Math.min(span, Math.max(0, diffDays(t.start, today)))
  const plannedToDate = t.start > today ? 0 : round2((t.plannedQty * elapsed) / span)
  return { ...t, done, remaining, pct, status, blockedBy, unit: boqItem?.unit || '', boqItem, dueToday: t.deadline === today && status !== 'Completed', daysLate, plannedToDate, variance: round2(done - plannedToDate) }
}

/** DPR line quantities: previous cumulative (excluding this report), today's, cumulative and remaining. */
export function dprLines(state, report) {
  return report.entries.map((en) => {
    const t = state.tasks.find((x) => x.id === en.taskId)
    const before = round2((t?.broughtForward || 0) + verifiedSupervisorQty(state, en.taskId, report.date) + state.reports.filter((r) => r.id !== report.id && COUNTED_DPR.includes(r.status) && r.date <= report.date)
      .flatMap((r) => r.entries).filter((x) => x.taskId === en.taskId).reduce((s, x) => s + Number(x.qty || 0), 0))
    const cumulative = round2(before + Number(en.qty || 0))
    const unit = state.boq.find((b) => b.id === t?.boqId)?.unit || ''
    return { ...en, task: t, unit, planned: t?.plannedQty || 0, before, cumulative, remaining: round2(Math.max(0, (t?.plannedQty || 0) - cumulative)), pct: t?.plannedQty ? Math.round((cumulative / t.plannedQty) * 100) : 0 }
  })
}

// ---------- Validation ----------
const DECIMAL = ['Cu.m', 'Tonnes', 'Sq.m', 'Kg', 'Litres', 'Rmt']

/** Reasons a DPR cannot be submitted. Drafts may be saved with missing figures. */
export function validateDpr(state, f, { submit }) {
  if (!f.siteId) return 'Select the site.'
  if (!f.date) return 'Enter the report date.'
  if (f.date > todayISO()) return 'The report date cannot be in the future.'
  if (state.reports.some((r) => r.id !== f.id && r.siteId === f.siteId && r.date === f.date && r.status !== 'Returned')) return `A daily report for this site on ${f.date} already exists. Open it instead of creating a second one.`
  if (!f.entries?.length) return 'Add at least one work activity.'
  const seen = new Set()
  for (const en of f.entries) {
    const t = state.tasks.find((x) => x.id === en.taskId)
    if (!t) return 'Select the work activity for every line.'
    if (seen.has(en.taskId)) return `${t.title} appears twice; combine the quantities in one line.`
    seen.add(en.taskId)
    // The same day's work must not be counted twice (once by the supervisor, once here)
    const sup = (state.supervisorProgress || []).find((p) => p.taskId === en.taskId && p.date === f.date && p.status !== 'Returned')
    if (sup && Number(en.qty) > 0) return `${t.title}: the Site Supervisor already recorded ${sup.qty} ${state.boq.find((b) => b.id === t.boqId)?.unit} for ${f.date} (${sup.id}, ${sup.status.toLowerCase()}). Verify that entry instead of entering the quantity again.`
    const boqItem = state.boq.find((b) => b.id === t.boqId)
    const q = num(en.qty)
    if (submit || en.qty !== '') {
      if (Number.isNaN(q) || q < 0) return `${t.title}: quantity done today must be 0 or more.`
      if (!DECIMAL.includes(boqItem?.unit) && !Number.isInteger(q)) return `${t.title}: whole ${boqItem?.unit} only.`
    }
    if (submit) {
      const w = num(en.workers)
      if (Number.isNaN(w) || w < 0 || !Number.isInteger(w)) return `${t.title}: enter the number of workers (0 or more).`
      // BOQ ceiling: executed on all tasks of this item (other reports) + this line ≤ approved quantity
      const others = state.tasks.filter((x) => x.boqId === t.boqId)
      const executedElsewhere = others.reduce((s, x) => s + (x.broughtForward || 0) + verifiedSupervisorQty(state, x.id), 0) + state.reports.filter((r) => r.id !== f.id && COUNTED_DPR.includes(r.status))
        .flatMap((r) => r.entries).filter((x) => others.some((o) => o.id === x.taskId)).reduce((s, x) => s + Number(x.qty || 0), 0)
      const sameItemHere = f.entries.filter((x) => others.some((o) => o.id === x.taskId)).reduce((s, x) => s + Number(x.qty || 0), 0)
      if (round2(executedElsewhere + sameItemHere) > boqItem.approvedQty) {
        return `${t.title}: cumulative ${round2(executedElsewhere + sameItemHere)} ${boqItem.unit} would exceed the approved BOQ quantity of ${boqItem.approvedQty} (${boqItem.id}). Request a BOQ revision first.`
      }
    }
  }
  if (submit && f.entries.some((en) => en.status === 'Stopped') && !f.problems?.trim()) return 'A stopped activity needs the delay or blocker described.'
  if (submit && !f.nextDayPlan?.trim()) return 'Add the next-day plan.'
  return ''
}

// ---------- Transitions ----------
const need = (actor, perm, msg) => (allowed(actor, perm) ? '' : msg)

export function saveDpr(state, { report, submit }, actor) {
  const e = need(actor, P.SITE_WORK, 'Daily progress reports are prepared by the Site Engineer.') || validateDpr(state, report, { submit })
  if (e) return fail(e)
  const existing = report.id && state.reports.find((r) => r.id === report.id)
  if (existing && !['Draft', 'Returned'].includes(existing.status)) return fail(`${existing.id} is ${existing.status.toLowerCase()}; it can no longer be edited.`)
  const id = existing ? existing.id : nextId(state.reports, 'DPR-')
  const base = existing || { id, projectId: report.projectId, preparedBy: actor.name, history: [] }
  const next = {
    ...base, siteId: report.siteId, projectId: report.projectId, date: report.date,
    entries: report.entries.map((en) => ({ taskId: en.taskId, qty: en.qty === '' ? 0 : round2(en.qty), workers: en.workers === '' ? 0 : Number(en.workers), status: en.status || 'In Progress' })),
    photos: report.photos || [], problems: report.problems || '', remarks: report.remarks || '', nextDayPlan: report.nextDayPlan || '',
    workArea: report.workArea || '', quality: report.quality || '', materialsNote: report.materialsNote || '',
    status: submit ? 'Submitted' : 'Draft', submittedAt: submit ? stamp() : null, reviewNote: submit ? '' : base.reviewNote || '', demo: true,
    history: [...(base.history || []), event(actor, submit ? 'Report submitted to Project Manager' : 'Draft saved')],
  }
  const reports = existing ? updateIn(state.reports, id, () => next) : [...state.reports, next]
  return ok({ ...state, reports, audit: audit(state, actor, id, submit ? 'Daily report submitted' : 'Daily report draft saved') }, submit ? `${id} submitted to ${pmOf(report.projectId)} for review` : `${id} saved as a draft (does not count towards progress)`)
}

/** Project Manager review (simulated in this demo). Returned reports stop counting until resubmitted. */
export function reviewDpr(state, { id, approve, note }, actor) {
  const r = state.reports.find((x) => x.id === id)
  if (!r) return fail('Report not found.')
  if (!isPM(actor)) return fail('Daily reports are reviewed by the Project Manager.')
  if (!isPMFor(actor, r.projectId)) return fail(notMine(r.projectId))
  if (r.status !== 'Submitted') return fail(`${id} is ${r.status.toLowerCase()}.`)
  if (!approve && (!note?.trim() || note.trim().length < 5)) return fail('Say what needs correcting.')
  return ok({
    ...state,
    reports: updateIn(state.reports, id, (x) => ({ ...x, status: approve ? 'Reviewed' : 'Returned', reviewedBy: actor.name, reviewedAt: stamp(), reviewNote: note?.trim() || '', history: [...x.history, event(actor, approve ? 'Reviewed' : 'Returned for correction', note?.trim() || '')] })),
    audit: audit(state, actor, id, approve ? 'Daily report reviewed' : 'Daily report returned', note || ''),
  }, `${id} ${approve ? 'reviewed' : 'returned to the Site Engineer'}`)
}

/** Fields the Site Engineer may update on an assigned task (never quantities, dates or budget). */
export function updateTaskNotes(state, { id, delayReason, correctiveAction, siteNote }, actor) {
  const t = state.tasks.find((x) => x.id === id)
  if (!t) return fail('Task not found.')
  const e = need(actor, P.SITE_WORK, 'Only the Site Engineer updates task progress notes.')
  if (e) return fail(e)
  const v = taskView(state, t)
  if (v.status === 'Delayed' && (!delayReason?.trim() || !correctiveAction?.trim())) return fail('A delayed task needs both the reason for delay and the proposed corrective action.')
  return ok({
    ...state,
    tasks: updateIn(state.tasks, id, (x) => ({ ...x, delayReason: delayReason?.trim() || '', correctiveAction: correctiveAction?.trim() || '', siteNote: siteNote?.trim() || '', notesUpdatedAt: stamp(), notesUpdatedBy: actor.name })),
    audit: audit(state, actor, id, 'Task progress notes updated', delayReason || siteNote || ''),
  }, `${id} updated; the Project Manager sees it in the schedule`)
}

/**
 * Site observation, blocker or photo record on an assigned task. Technical record only: the
 * planned quantity, dates and budget stay as approved by the Project Manager.
 */
export const TASK_NOTE_KINDS = ['Observation', 'Blocker', 'Blocker cleared']
export function addTaskObservation(state, { id, kind, text, photos }, actor) {
  const t = state.tasks.find((x) => x.id === id)
  if (!t) return fail('Task not found.')
  const e = need(actor, P.SITE_WORK, 'Only the Site Engineer records task observations.')
  if (e) return fail(e)
  if (!TASK_NOTE_KINDS.includes(kind)) return fail('Choose the type of note.')
  if (kind === 'Blocker cleared' && !t.blocker) return fail(`${id} has no open blocker.`)
  if (!text?.trim() || text.trim().length < 10) return fail('Describe what you observed (at least a sentence).')
  const note = { at: stamp(), by: actor.name, kind, text: text.trim(), photos: photos || [] }
  return ok({
    ...state,
    tasks: updateIn(state.tasks, id, (x) => ({ ...x, observations: [note, ...(x.observations || [])], blocker: kind === 'Blocker' ? text.trim() : kind === 'Blocker cleared' ? '' : x.blocker })),
    audit: audit(state, actor, id, `Task ${kind.toLowerCase()} recorded`, text),
  }, kind === 'Blocker' ? `Blocker recorded on ${id}; the Project Manager sees it on the schedule` : `${kind} recorded on ${id}`)
}

export function addMeasurement(state, f, actor) {
  const e = need(actor, P.SITE_WORK, 'Measurements are recorded by the Site Engineer.')
  if (e) return fail(e)
  const item = state.boq.find((b) => b.id === f.boqId)
  if (!item) return fail('Select the BOQ item.')
  const q = num(f.qty)
  if (Number.isNaN(q) || q <= 0) return fail('Measured quantity must be more than 0.')
  if (!f.date || f.date > todayISO()) return fail('Enter the measurement date (not in the future).')
  if (!f.details?.trim()) return fail('Give the measurement details (dimensions / reference).')
  const v = boqView(state, item)
  const free = round2(v.executed - v.measuredVerified - v.measuredPending)
  if (q > free) return fail(`Only ${free} ${item.unit} of executed work is not yet measured. Measurements cannot exceed executed quantity.`)
  const id = nextId(state.measurements, 'MB-')
  const m = { id, boqId: item.id, date: f.date, qty: round2(q), details: f.details.trim(), sheetRef: f.sheetRef?.trim() || `MB-TA/${id.slice(3)}`, photos: f.photos || [], recordedBy: actor.name, status: 'Pending Verification', verifiedBy: null, demo: true }
  return ok({ ...state, measurements: [...state.measurements, m], audit: audit(state, actor, id, 'Measurement recorded', `${item.id}: ${q} ${item.unit}`) }, `${id} recorded: ${q} ${item.unit}, awaiting verification`)
}

export function verifyMeasurement(state, { id, approve, note }, actor) {
  const m = state.measurements.find((x) => x.id === id)
  if (!m) return fail('Measurement not found.')
  if (!isPM(actor)) return fail('Measurements are verified by the Project Manager.')
  const mItem = state.boq.find((b) => b.id === m.boqId)
  if (!isPMFor(actor, mItem?.projectId)) return fail(notMine(mItem?.projectId))
  if (m.status !== 'Pending Verification') return fail(`${id} is ${m.status.toLowerCase()}.`)
  if (!approve && !note?.trim()) return fail('Give the reason for rejecting.')
  return ok({ ...state, measurements: updateIn(state.measurements, id, (x) => ({ ...x, status: approve ? 'Verified' : 'Rejected', verifiedBy: actor.name, verifiedAt: stamp(), note: note || '' })), audit: audit(state, actor, id, approve ? 'Measurement verified' : 'Measurement rejected', note || '') }, `${id} ${approve ? 'verified' : 'rejected'}`)
}

/** Ask to change an approved BOQ quantity. Nothing changes until the Project Manager approves. */
export function requestBoqRevision(state, { id, to, reason }, actor) {
  const e = need(actor, P.SITE_WORK, 'BOQ revision requests come from the Site Engineer.')
  if (e) return fail(e)
  const item = state.boq.find((b) => b.id === id)
  if (!item) return fail('BOQ item not found.')
  if ((item.revisions || []).some((r) => r.status === 'Pending')) return fail(`A revision of ${id} is already waiting for approval.`)
  const q = num(to)
  if (Number.isNaN(q) || q <= 0) return fail('Enter the proposed quantity.')
  if (q === item.approvedQty) return fail('The proposed quantity is the same as the approved quantity.')
  const v = boqView(state, item)
  if (q < v.executed) return fail(`Cannot reduce below the ${v.executed} ${item.unit} already executed.`)
  if (!reason?.trim() || reason.trim().length < 10) return fail('Explain the reason (drawing revision, site condition, instruction reference).')
  const rev = { id: `REV-${String(state.boq.flatMap((b) => b.revisions || []).length + 1).padStart(2, '0')}`, from: item.approvedQty, to: round2(q), reason: reason.trim(), requestedBy: actor.name, requestedAt: stamp(), status: 'Pending' }
  return ok({ ...state, boq: updateIn(state.boq, id, (x) => ({ ...x, revisions: [...(x.revisions || []), rev] })), audit: audit(state, actor, id, 'BOQ revision requested', `${rev.from} → ${rev.to}`) }, `Revision ${rev.id} sent to the Project Manager; approved quantity unchanged until approved`)
}

export function decideBoqRevision(state, { id, approve, note }, actor) {
  const item = state.boq.find((b) => b.id === id)
  const rev = item?.revisions?.find((r) => r.status === 'Pending')
  if (!rev) return fail('No pending revision.')
  if (!isPM(actor)) return fail('BOQ revisions are approved by the Project Manager.')
  if (!isPMFor(actor, item.projectId)) return fail(notMine(item.projectId))
  if (!approve && !note?.trim()) return fail('Give the reason for rejecting.')
  return ok({
    ...state,
    boq: updateIn(state.boq, id, (x) => ({ ...x, approvedQty: approve ? rev.to : x.approvedQty, revisions: x.revisions.map((r) => (r === rev ? { ...r, status: approve ? 'Approved' : 'Rejected', decidedBy: actor.name, decidedAt: stamp(), note: note || '' } : r)) })),
    audit: audit(state, actor, id, approve ? `BOQ revision ${rev.id} approved` : `BOQ revision ${rev.id} rejected`, note || ''),
  }, `${rev.id} ${approve ? `approved: ${id} is now ${rev.to}` : 'rejected'}`)
}

// ----- Quality -----
export function recordInspection(state, f, actor) {
  const e = need(actor, P.QUALITY_INSPECT, 'Technical inspections are recorded by the Site Engineer.')
  if (e) return fail(e)
  if (!f.siteId) return fail('Select the site.')
  if (!f.title?.trim()) return fail('Enter what is being inspected.')
  if (!f.date) return fail('Enter the inspection date.')
  const items = (f.checklist || []).filter((c) => c.item?.trim())
  if (!items.length) return fail('Add at least one checklist item.')
  const done = items.every((c) => c.result)
  if (f.date <= todayISO() && !done) return fail('Record a result (Pass / Fail / N/A) for every checklist item, or set a future date to schedule it.')
  const failed = items.some((c) => c.result === 'Fail') || (f.tests || []).some((t) => t.result === 'Fail')
  if (failed && !f.notes?.trim()) return fail('Describe the failure and the corrective action needed.')
  const id = nextId(state.inspections, 'QI-0')
  const insp = {
    id, projectId: f.projectId, siteId: f.siteId, title: f.title.trim(), type: f.type, location: f.location?.trim() || '', date: f.date, inspector: actor.name, owner: 'Site Engineer',
    checklist: items, tests: (f.tests || []).filter((t) => t.name?.trim()), photos: f.photos || [], ncrIds: [], notes: f.notes?.trim() || '', recordedAt: stamp(), demo: true,
    status: !done ? 'Scheduled' : failed ? 'Failed' : 'Passed', reviewStatus: done ? 'Awaiting QA review' : null, reinspectionDate: failed ? f.reinspectionDate || null : null,
  }
  let next = { ...state, inspections: [...state.inspections, insp] }
  if (failed) {
    const ncrId = nextId(state.ncrs.filter((n) => /^NCR-/.test(n.id)), 'NCR-')
    next = { ...next, ncrs: [...state.ncrs, { id: ncrId, projectId: f.projectId, siteId: f.siteId, description: `${insp.title}: ${insp.notes}`, severity: f.severity || 'Major', reported: todayISO(), status: 'Open', action: { id: `CA-${ncrId.slice(4)}`, text: f.correctiveAction?.trim() || 'Corrective action to be agreed', owner: f.responsible || actor.name, due: f.reinspectionDate || addDays(todayISO(), 3), status: 'Open' }, reinspectionDate: f.reinspectionDate || null, fromInspection: id, demo: true }] }
    next.inspections = updateIn(next.inspections, id, (x) => ({ ...x, ncrIds: [ncrId] }))
  }
  next.audit = audit(state, actor, id, 'Inspection recorded', insp.status)
  return ok(next, failed ? `${id} recorded as Failed; non-conformance raised` : `${id} ${insp.status === 'Scheduled' ? 'scheduled' : 'recorded'}${done ? '; awaiting independent QA review' : ''}`)
}

/** Record results on a scheduled inspection the engineer owns (QA / third-party records are read-only here). */
export function completeInspection(state, { id, checklist, tests, notes, reinspectionDate, photos }, actor) {
  const q = state.inspections.find((x) => x.id === id)
  if (!q) return fail('Inspection not found.')
  if (q.owner !== 'Site Engineer') return fail(`${id} belongs to ${q.inspector}; only they can record its result.`)
  if (q.inspector !== actor.name && !allowed(actor, P.QUALITY_REVIEW)) return fail(`${id} was scheduled by ${q.inspector}.`)
  if (q.status !== 'Scheduled') return fail(`${id} is already ${q.status.toLowerCase()}.`)
  const r = recordInspection({ ...state, inspections: state.inspections.filter((x) => x.id !== id) }, { ...q, checklist, tests, notes, reinspectionDate, photos: [...(q.photos || []), ...(photos || [])], date: todayISO() }, actor)
  if (r.error) return r
  const created = r.state.inspections[r.state.inspections.length - 1]
  const merged = { ...created, id, recordedAt: stamp() }
  const inspections = state.inspections.map((x) => (x.id === id ? merged : x))
  const ncrs = r.state.ncrs.map((n) => (n.fromInspection === created.id ? { ...n, fromInspection: id } : n))
  return ok({ ...r.state, inspections, ncrs }, r.message.replace(created.id, id))
}

/** Independent QA review of a Site Engineer's technical inspection (the QA Engineer holds the permission). */
export function qaReview(state, { id, accept, note }, actor) {
  const q = state.inspections.find((x) => x.id === id)
  if (!q) return fail('Inspection not found.')
  if (!allowed(actor, P.QUALITY_REVIEW)) return fail('QA review is done by the authorised QA reviewer, not the Site Engineer.')
  if (q.inspector === actor.name) return fail('An inspection cannot be QA-reviewed by the person who recorded it.')
  if (q.reviewStatus !== 'Awaiting QA review') return fail(`${id} is not waiting for QA review.`)
  return ok({ ...state, inspections: updateIn(state.inspections, id, (x) => ({ ...x, reviewStatus: accept ? 'QA accepted' : 'QA rejected', reviewer: actor.name, reviewedAt: stamp(), reviewNote: note || '' })), audit: audit(state, actor, id, accept ? 'QA accepted' : 'QA rejected', note || '') }, `${id}: QA ${accept ? 'accepted' : 'rejected'}`)
}

export function updateNcrAction(state, { id, status, note }, actor) {
  const n = state.ncrs.find((x) => x.id === id)
  if (!n?.action) return fail('Corrective action not found.')
  if (n.action.owner !== actor.name && !allowed(actor, P.QUALITY_REVIEW)) return fail(`The corrective action is owned by ${n.action.owner}.`)
  if (!['In Progress', 'Done'].includes(status)) return fail('Choose In Progress or Done.')
  if (status === 'Done' && !note?.trim()) return fail('Describe what was done (reinspection will confirm it).')
  if (['Awaiting Verification', 'Awaiting reinspection', 'Reinspection Required', 'Closed'].includes(n.status)) return fail(`${id} is already with QA (${n.status.toLowerCase()}).`)
  return ok({ ...state, ncrs: updateIn(state.ncrs, id, (x) => ({ ...x, status: status === 'Done' ? 'Awaiting Verification' : 'Correction in Progress', action: { ...x.action, status, note: note || x.action.note, progress: [...(x.action.progress || []), { at: stamp(), by: actor.name, note: note || '' }] }, history: [...(x.history || []), event(actor, status === 'Done' ? 'Correction completed; verification requested' : 'Correction progress updated', note || '')] })), audit: audit(state, actor, id, `Corrective action ${status.toLowerCase()}`, note || '') }, `${id}: corrective action ${status.toLowerCase()}${status === 'Done' ? '; QA verifies it and schedules the reinspection' : ''}`)
}

// ----- Safety: hazards, incidents and corrective actions live in services/safety.js -----


// ----- Site issues -----
export const ASSIGNABLE = (siteId, projectId) => [
  { role: 'Site Engineer', name: engineerOf(siteId) },
  { role: 'Project Manager', name: pmOf(projectId) }, { role: 'Site Supervisor', name: supervisorOf(siteId) }, { role: 'Store Keeper', name: 'Vijay Pawar' },
  { role: 'Purchase Manager', name: 'Deepak Rao' }, { role: 'Admin', name: 'Admin User' },
].filter((a) => a.name)
export function createIssue(state, f, actor) {
  if (!allowed(actor, P.SITE_WORK) && !allowed(actor, P.SITE_SUPERVISE)) return fail('Site issues are reported by the Site Engineer or the Site Supervisor.')
  if (!f.siteId) return fail('Select the site.')
  if (!f.category) return fail('Select the category.')
  if (!f.title?.trim()) return fail('Enter a short title.')
  if (!f.description?.trim() || f.description.trim().length < 15) return fail('Describe the issue (what, where, since when).')
  if (!f.assignee?.name) return fail('Assign it to the responsible person.')
  if (f.dueBy && f.dueBy < todayISO()) return fail('The required resolution date cannot be in the past.')
  if (state.issues.some((x) => x.siteId === f.siteId && !['Resolved', 'Closed'].includes(x.status) && x.title.trim().toLowerCase() === f.title.trim().toLowerCase())) return fail('An open issue with this title already exists for the site (submitted twice?).')
  const id = nextId(state.issues, 'ISS-')
  const escalated = !!f.escalate || f.priority === 'Critical' || (f.priority === 'High' && /delay|stop|idle/i.test(`${f.impact} ${f.description}`))
  const iss = {
    id, projectId: f.projectId, siteId: f.siteId, category: f.category, title: f.title.trim(), description: f.description.trim(), priority: f.priority, reported: todayISO(), reportedBy: actor.name,
    assignee: f.assignee, impact: f.impact?.trim() || '', proposed: f.proposed?.trim() || '', status: 'Open', photos: f.photos || [], links: f.links || [], escalated, resolution: '', resolvedAt: null, dueBy: f.dueBy || null, demo: true,
    workArea: f.workArea?.trim() || '', reporterRole: actor.role,
    comments: [{ at: stamp(), by: actor.name, role: actor.role, text: escalated ? 'Raised; significant delay risk, escalated to the Project Manager.' : 'Raised.' }],
  }
  return ok({ ...state, issues: [...state.issues, iss], audit: audit(state, actor, id, 'Site issue reported', f.title) }, `${id} reported and assigned to ${f.assignee.name}${escalated ? '; escalated to the Project Manager' : ''}`)
}
export function commentIssue(state, { id, text, status, assignee, escalate, resolution }, actor) {
  const i = state.issues.find((x) => x.id === id)
  if (!i) return fail('Issue not found.')
  if (i.status === 'Closed') return fail(`${id} is closed.`)
  const supervisor = allowed(actor, P.SITE_SUPERVISE) && !allowed(actor, P.SITE_WORK)
  const isReporterSide = allowed(actor, P.SITE_WORK) || supervisor || isPMFor(actor, i.projectId) || i.assignee?.name === actor.name
  // A supervisor adds observations and resolution notes; resolving is for the responsible person, closing for the PM
  if (supervisor && status === 'Resolved' && i.assignee?.name !== actor.name) return fail(`Only ${i.assignee?.name} (${i.assignee?.role}) can mark this resolved. Add your resolution notes as a comment.`)
  if (supervisor && (assignee || escalate)) return fail('Reassigning or escalating is done by the Site Engineer.')
  if (!isReporterSide) return fail('Not permitted on this issue.')
  if (!text?.trim() && !assignee && !escalate && !status) return fail('Write a comment or choose an update.')
  if (status === 'Resolved' && !resolution?.trim()) return fail('Give the resolution notes.')
  if (status === 'Closed' && !isPMFor(actor, i.projectId) && i.assignee?.role !== 'Admin') return fail('Issues are closed by the Project Manager after checking the resolution.')
  const changes = []
  if (assignee) changes.push(`Assigned to ${assignee.name} (${assignee.role})`)
  if (escalate) changes.push('Escalated to the Project Manager')
  if (status) changes.push(`Status → ${status}`)
  return ok({
    ...state,
    issues: updateIn(state.issues, id, (x) => ({
      ...x, status: status || x.status, assignee: assignee || x.assignee, escalated: x.escalated || !!escalate,
      resolution: status === 'Resolved' ? resolution.trim() : x.resolution, resolvedAt: status === 'Resolved' ? todayISO() : x.resolvedAt,
      comments: [...x.comments, { at: stamp(), by: actor.name, role: actor.role + (actor.simulated ? ' (simulated)' : ''), text: [text?.trim(), ...changes].filter(Boolean).join(' · ') }],
    })),
    audit: audit(state, actor, id, changes.join(', ') || 'Comment added', text || ''),
  }, `${id} updated`)
}

// ----- Equipment -----
export function requestEquipment(state, f, actor) {
  const e = need(actor, P.SITE_WORK, 'Equipment requests come from the Site Engineer.')
  if (e) return fail(e)
  if (!['Requirement', 'Breakdown', 'Maintenance'].includes(f.kind)) return fail('Select the request type.')
  if (f.kind !== 'Requirement' && !f.equipmentId) return fail('Select the equipment.')
  if (f.kind === 'Requirement' && !f.name?.trim()) return fail('Describe the equipment needed.')
  if (!f.from) return fail(f.kind === 'Requirement' ? 'Enter the date it is needed from.' : 'Enter the date of the problem.')
  if (f.kind === 'Requirement' && f.to && f.to < f.from) return fail('The end date is before the start date.')
  if (!f.note?.trim()) return fail('Add details.')
  if (state.equipmentRequests.some((r) => ['Requested', 'Reported'].includes(r.status) && r.kind === f.kind && r.siteId === f.siteId && (r.equipmentId || r.name) === (f.equipmentId || f.name?.trim()) && r.from === f.from)) return fail('The same equipment request is already open (submitted twice?).')
  const q = state.equipment.find((x) => x.id === f.equipmentId)
  const id = nextId(state.equipmentRequests, 'EQR-')
  const req = { id, kind: f.kind, equipmentId: f.equipmentId || null, name: q?.name || f.name.trim(), projectId: f.projectId, siteId: f.siteId, from: f.from, to: f.to || null, note: f.note.trim(), status: f.kind === 'Breakdown' ? 'Reported' : 'Requested', requestedBy: actor.name, at: stamp(), demo: true }
  const equipment = f.kind === 'Breakdown' ? updateIn(state.equipment, f.equipmentId, (x) => ({ ...x, status: 'Breakdown', note: f.note.trim() })) : state.equipment
  return ok({ ...state, equipment, equipmentRequests: [...state.equipmentRequests, req], audit: audit(state, actor, id, `Equipment ${f.kind.toLowerCase()} raised`, req.name) }, `${id} raised (${f.kind.toLowerCase()})`)
}
export function logEquipment(state, { equipmentId, date, hours, downtime, reason }, actor) {
  const e = need(actor, P.SITE_WORK, 'Usage is logged by the site team.')
  if (e) return fail(e)
  const q = state.equipment.find((x) => x.id === equipmentId)
  if (!q) return fail('Select the equipment.')
  if (!date || date > todayISO()) return fail('Enter the date (not in the future).')
  const h = num(hours); const d = num(downtime || 0)
  if (Number.isNaN(h) || h < 0 || h > 24) return fail('Hours worked must be between 0 and 24.')
  if (Number.isNaN(d) || d < 0 || h + d > 24) return fail('Hours worked + downtime cannot exceed 24.')
  if (d > 0 && !reason?.trim()) return fail('Give the reason for downtime.')
  if (state.equipmentLogs.some((l) => l.equipmentId === equipmentId && l.date === date)) return fail(`Usage for ${q.name} on ${date} is already logged.`)
  const log = { id: `EL-${equipmentId}-${date}`, equipmentId, date, hours: h, downtime: d, reason: reason?.trim() || '', by: actor.name, demo: true }
  return ok({ ...state, equipmentLogs: [...state.equipmentLogs, log], audit: audit(state, actor, equipmentId, 'Usage logged', `${h} h, downtime ${d} h`) }, `Usage logged for ${q.name}`)
}

// ----- Labour coordination (attendance itself is recorded by the Site Supervisor) -----
export function requestLabour(state, f, actor) {
  const e = need(actor, P.SITE_WORK, 'Labour requirements are raised by the Site Engineer.')
  if (e) return fail(e)
  if (!f.category) return fail('Select the trade.')
  const q = num(f.qty)
  if (!Number.isInteger(q) || q <= 0) return fail('Enter the number of workers.')
  if (f.kind === 'Overtime') { const h = num(f.hours); if (Number.isNaN(h) || h <= 0 || h > 4) return fail('Overtime hours must be between 0.5 and 4 per day.') }
  if (!f.neededBy || f.neededBy < todayISO()) return fail('Enter the date needed (today or later).')
  if (!f.note?.trim()) return fail('Give the work activity / reason.')
  if (state.labourRequests.some((r) => r.status === 'Pending' && r.siteId === f.siteId && r.kind === f.kind && r.category === f.category && r.qty === q && r.neededBy === f.neededBy)) return fail('The same request is already pending (submitted twice?).')
  const prefix = f.kind === 'Overtime' ? 'OT-' : 'LR-'
  const id = nextId(state.labourRequests.filter((r) => r.id.startsWith(prefix)), prefix)
  const req = { id, kind: f.kind, projectId: f.projectId, siteId: f.siteId, category: f.category, qty: q, hours: f.kind === 'Overtime' ? Number(f.hours) : null, note: f.note.trim(), neededBy: f.neededBy, requestedBy: actor.name, status: 'Pending', demo: true }
  return ok({ ...state, labourRequests: [...state.labourRequests, req], audit: audit(state, actor, id, `${f.kind} request raised`, `${q} ${f.category}`) }, `${id} sent to the Site Supervisor / Project Manager`)
}

// ----- Diary -----
export function saveDiary(state, { entry, submit }, actor) {
  if (!allowed(actor, P.SITE_WORK) && !allowed(actor, P.SITE_SUPERVISE)) return fail('The site diary is kept by the Site Engineer and the Site Supervisor.')
  if (!entry.siteId) return fail('Select the site.')
  if (!entry.date || entry.date > todayISO()) return fail('Enter the diary date (not in the future).')
  const existing = entry.id && state.diary.find((d) => d.id === entry.id)
  if (existing && existing.preparedBy !== actor.name) return fail(`${existing.id} was written by ${existing.preparedBy}; only they can edit it.`)
  if (existing && existing.status !== 'Draft') return fail(`${existing.id} is ${existing.status.toLowerCase()} and can no longer be edited.`)
  if (state.diary.some((d) => d.id !== entry.id && d.siteId === entry.siteId && d.date === entry.date && d.preparedBy === actor.name)) return fail(`You already have a diary entry for ${entry.date} on this site. Open it instead.`)
  if (submit && allowed(actor, P.SITE_SUPERVISE) && !allowed(actor, P.SITE_WORK) && !entry.tomorrow?.trim()) return fail("Add the next-day plan to submit.")
  if (submit && !entry.activities?.trim()) return fail('Describe the work performed to submit.')
  if (submit && allowed(actor, P.SITE_WORK) && !entry.weather?.trim()) return fail('Weather and work activities are required to submit.')
  const id = existing ? existing.id : nextId(state.diary, 'DRY-')
  const rec = { ...(existing || {}), ...entry, id, preparedBy: existing?.preparedBy || actor.name, role: existing?.role || actor.role, status: submit ? 'Submitted' : 'Draft', submittedAt: submit ? stamp() : null, demo: true }
  const diary = existing ? updateIn(state.diary, id, () => rec) : [...state.diary, rec]
  return ok({ ...state, diary, audit: audit(state, actor, id, submit ? 'Diary submitted' : 'Diary draft saved') }, `${id} ${submit ? 'submitted' : 'saved as a draft'}`)
}

// ----- Communication -----
export function sendClarification(state, f, actor) {
  const e = need(actor, P.SITE_WORK, 'Clarifications are raised by the Site Engineer.')
  if (e) return fail(e)
  if (!f.subject?.trim()) return fail('Enter a subject.')
  if (!f.text?.trim() || f.text.trim().length < 10) return fail('Write the question.')
  const id = nextId(state.messages.filter((m) => m.id.startsWith('CLR-')), 'CLR-')
  const msg = { id, kind: 'Clarification', projectId: f.projectId, siteId: f.siteId, from: actor.name, to: pmOf(f.projectId), at: stamp(), subject: f.subject.trim(), text: f.text.trim(), status: 'Open', replies: [], ref: f.ref || '', demo: true }
  return ok({ ...state, messages: [msg, ...state.messages], audit: audit(state, actor, id, 'Clarification requested', f.subject) }, `${id} sent to ${msg.to} (demo: no message delivered)`)
}
export function replyMessage(state, { id, text, close }, actor) {
  const m = state.messages.find((x) => x.id === id)
  if (!m) return fail('Message not found.')
  if (!text?.trim()) return fail('Write a reply.')
  const isRecipient = m.to === actor.name || (isPM(actor) && m.to === actor.name) || isPM(actor)
  if (!isRecipient && m.from !== actor.name) return fail('Not your conversation.')
  const status = close ? (m.kind === 'Instruction' ? 'Acknowledged' : 'Answered') : m.status
  return ok({ ...state, messages: updateIn(state.messages, id, (x) => ({ ...x, status, replies: [...x.replies, { at: stamp(), by: actor.name + (actor.simulated ? ' (simulated)' : ''), text: text.trim() }] })), audit: audit(state, actor, id, 'Reply', text) }, `Reply added to ${id}`)
}
export function setPrefs(state, prefs, actor) {
  return ok({ ...state, prefs: { ...state.prefs, ...prefs }, audit: audit(state, actor, 'Profile', 'Notification preferences changed') }, 'Preferences updated for this session')
}

// ---------- Derived views ----------
export const latestApproved = (doc) => [...doc.revisions].reverse().find((r) => r.status === 'Approved') || null
export const latestRevision = (doc) => doc.revisions[doc.revisions.length - 1]

// ---------- Project phase (Foundation → Structure → Finishing) ----------
export const PHASES = ['Foundation', 'Structure', 'Finishing', 'Completed']
export function phaseOf(stage = '') {
  if (/complet|handover|defect/i.test(stage)) return 'Completed'
  if (/finish|plaster|paint|tiling|flooring/i.test(stage)) return 'Finishing'
  if (/slab|column|structure|frame|floor \d/i.test(stage)) return 'Structure'
  return 'Foundation'
}

// ---------- Labour need vs the Site Supervisor's allocation ----------
/** Crew required today by your active tasks (planning) against today's allocation, per trade. */
export function labourNeed(state, siteId, today = todayISO()) {
  const active = state.tasks.filter((t) => t.siteId === siteId).map((t) => taskView(state, t, today)).filter((t) => t.start <= today && t.status !== 'Completed' && t.status !== 'Blocked')
  const required = {}
  for (const t of active) for (const [trade, n] of Object.entries(TASK_CREWS[t.id] || {})) required[trade] = (required[trade] || 0) + n
  const own = (state.allocations || []).filter((a) => a.siteId === siteId && a.date === today)
  const alloc = own.length
    ? { by: own[0].by, notes: own.map((a) => `${a.taskId}: ${a.workerIds.length} workers`).join('; '), crews: own.flatMap((a) => a.workerIds).reduce((m, id) => { const t = workerOf(id)?.trade; if (t) m[t] = (m[t] || 0) + 1; return m }, {}) }
    : LABOUR_ALLOCATION.find((a) => a.siteId === siteId && a.date === today)
  const trades = [...new Set([...Object.keys(required), ...Object.keys(alloc?.crews || {})])]
  return {
    allocation: alloc || null,
    rows: trades.map((trade) => {
      const needed = required[trade] || 0
      const have = alloc?.crews[trade] || 0
      return { trade, required: needed, allocated: have, shortage: Math.max(0, needed - have), tasks: active.filter((t) => TASK_CREWS[t.id]?.[trade]).map((t) => t.id) }
    }).sort((a, b) => b.shortage - a.shortage || b.required - a.required),
  }
}
export const crewOf = (taskId) => TASK_CREWS[taskId] || {}

// ---------- Weather-related work restrictions ----------
export function addWeatherRestriction(state, f, actor) {
  const e = need(actor, P.SAFETY_REPORT, 'Weather restrictions are recorded by the site team.')
  if (e) return fail(e)
  if (!f.siteId) return fail('Select the site.')
  if (!f.condition?.trim()) return fail('Describe the weather condition / forecast.')
  if (!f.restriction?.trim() || f.restriction.trim().length < 10) return fail('Say which work is restricted and what precautions apply.')
  const id = nextId(state.weather, 'WX-')
  const rec = { id, projectId: f.projectId, siteId: f.siteId, date: f.date || todayISO(), condition: f.condition.trim(), restriction: f.restriction.trim(), status: 'Active', by: actor.name, at: stamp(), demo: true }
  return ok({ ...state, weather: [rec, ...state.weather], audit: audit(state, actor, id, 'Weather restriction issued', f.condition) }, `${id}: restriction active (demo: crews are not notified automatically)`)
}
export function liftWeatherRestriction(state, { id }, actor) {
  const w = state.weather.find((x) => x.id === id)
  if (!w) return fail('Restriction not found.')
  if (!allowed(actor, P.SAFETY_REPORT)) return fail('Not permitted.')
  if (w.status !== 'Active') return fail(`${id} is already lifted.`)
  return ok({ ...state, weather: updateIn(state.weather, id, (x) => ({ ...x, status: 'Lifted', liftedBy: actor.name, liftedAt: stamp() })), audit: audit(state, actor, id, 'Weather restriction lifted') }, `${id} lifted`)
}

// ---------- Project Manager: instructions and delay reviews ----------
export function sendInstruction(state, f, actor) {
  if (!allowed(actor, P.PROJECT_REVIEW)) return fail('Instructions are issued by the Project Manager.')
  if (!isPMFor(actor, f.projectId)) return fail(notMine(f.projectId))
  if (!f.to) return fail('Choose the Site Engineer.')
  if (!f.subject?.trim() || !f.text?.trim() || f.text.trim().length < 10) return fail('Write a subject and the instruction.')
  const id = nextId(state.messages.filter((m) => m.id.startsWith('INS-')), 'INS-')
  const msg = { id, kind: 'Instruction', projectId: f.projectId, siteId: f.siteId || null, from: actor.name, to: f.to, at: stamp(), subject: f.subject.trim(), text: f.text.trim(), status: 'Open', replies: [], ref: f.ref || '', demo: true }
  return ok({ ...state, messages: [msg, ...state.messages], audit: audit(state, actor, id, 'Instruction issued', f.subject) }, `${id} sent to ${f.to} (demo: shown on their dashboard; nothing emailed)`)
}

/** PM response to a delayed task's reason and corrective action (dates and quantities stay unchanged). */
export function reviewTaskDelay(state, { id, accept, note }, actor) {
  const t = state.tasks.find((x) => x.id === id)
  if (!t) return fail('Task not found.')
  if (!allowed(actor, P.PROJECT_REVIEW)) return fail('Delays are reviewed by the Project Manager.')
  if (!isPMFor(actor, t.projectId)) return fail(notMine(t.projectId))
  if (!note?.trim() || note.trim().length < 5) return fail('Add your comment on the corrective action.')
  const pmReview = { at: stamp(), by: actor.name, accepted: !!accept, note: note.trim() }
  return ok({ ...state, tasks: updateIn(state.tasks, id, (x) => ({ ...x, pmReview })), audit: audit(state, actor, id, accept ? 'Corrective action accepted' : 'Corrective action not accepted', note) }, `${id}: delay review recorded${accept ? '' : '; Site Engineer asked to revise the plan'}`)
}

// ---------- Admin oversight: site records needing Admin action, or worth watching ----------
export function siteAdminItems(state, today = todayISO()) {
  const items = []
  for (const q of state.inspections.filter((x) => x.reviewStatus === 'Awaiting QA review')) {
    items.push({ id: `qa:${q.id}`, kind: 'QA review', ref: q.id, title: `${q.title} (${q.status}) by ${q.inspector}`, amount: null, at: q.recordedAt || `${q.date}T12:00`, needs: 'Admin (QA stand-in)', actionable: true, record: q, site: true })
  }
  // Safety: the Safety Officer verifies; Admin oversees (watch items)
  for (const a of (state.safetyActions || []).filter((x) => x.status === 'Awaiting Verification')) {
    items.push({ id: `sv:${a.id}`, kind: 'Safety verification', ref: `${a.id}${a.sourceId ? ` / ${a.sourceId}` : ''}`, title: `${a.text} (${a.owner})`, amount: null, at: a.evidence.slice(-1)[0]?.at || a.at, needs: 'Safety Officer', actionable: false, watch: true, record: a, site: true })
  }
  for (const a of (state.safetyActions || []).filter((x) => x.status !== 'Closed' && x.due < today)) {
    items.push({ id: `so:${a.id}`, kind: 'Overdue safety action', ref: a.id, title: `${a.text}: due ${a.due}, ${a.owner}`, amount: null, at: `${a.due}T18:00`, needs: a.owner, actionable: false, watch: true, record: a, site: true })
  }
  for (const p of (state.permits || []).filter((x) => x.status === 'Pending Approval')) {
    items.push({ id: `pt:${p.id}`, kind: 'Permit to work', ref: p.id, title: `${p.type}: ${p.workArea} (${p.validFrom.replace('T', ' ')} → ${p.validTo.slice(11)})`, amount: null, at: p.history.slice(-1)[0]?.at || p.validFrom, needs: 'Project Manager / Admin', actionable: true, record: p, site: true })
  }
  for (const x of state.safety.filter((s) => ['High', 'Critical'].includes(s.severity) && !['Verified closed', 'Action done'].includes(s.status))) {
    items.push({ id: `se:${x.id}`, kind: 'Safety escalation', ref: x.id, title: `${x.severity}: ${x.description}${x.reviewedBy ? '' : ' (awaiting Safety Officer review)'}`, amount: null, at: `${x.date}T09:00`, needs: 'Safety Officer / Project Manager', actionable: false, watch: true, record: x, site: true })
  }
  for (const i of state.issues.filter((x) => !['Resolved', 'Closed'].includes(x.status) && (x.assignee?.role === 'Admin' || x.escalated || x.priority === 'Critical'))) {
    const mine = i.assignee?.role === 'Admin'
    items.push({ id: `is:${i.id}`, kind: 'Site issue', ref: i.id, title: `${i.priority}: ${i.title}${i.escalated ? ' (escalated)' : ''}`, amount: null, at: `${i.reported}T09:00`, needs: mine ? 'Admin' : i.assignee?.role, actionable: mine, watch: !mine, record: i, site: true })
  }
  for (const t of state.tasks.map((x) => taskView(state, x, today)).filter((x) => x.status === 'Delayed')) {
    items.push({ id: `dl:${t.id}`, kind: 'Delayed work', ref: t.id, title: `${t.title}: ${t.daysLate} day(s) late, ${t.done}/${t.plannedQty} ${t.unit}${t.delayReason ? `; ${t.delayReason}` : ''}`, amount: null, at: `${t.deadline}T18:00`, needs: 'Project Manager', actionable: false, watch: true, record: t, site: true })
  }
  const waiting = state.reports.filter((r) => r.status === 'Submitted')
  if (waiting.length) items.push({ id: 'dpr:waiting', kind: 'Reports awaiting PM', ref: waiting.map((r) => r.id).join(', '), title: `${waiting.length} daily progress report(s) waiting for Project Manager review`, amount: null, at: waiting[0].submittedAt, needs: 'Project Manager', actionable: false, watch: true, record: waiting[0], site: true })
  return items
}


// =====================================================================================
// Site Supervisor: attendance, work allocation, execution progress (verified by the Site
// Engineer before it counts), shortage reports. Payroll, stock and purchasing stay with
// their own roles; nothing here pays anyone, moves stock or raises a material request.
// =====================================================================================
export const ATTENDANCE_STATUSES = ['Present', 'Absent', 'Half Day', 'On Leave']
const WORKING = ['Present', 'Half Day']
const supervises = (actor, siteId) => allowed(actor, P.ATTENDANCE_EDIT) && (actor.roleId === 'admin' || supervisorOf(siteId) === actor.name)
const timeOk = (t) => /^([01]\d|2[0-3]):[0-5]\d$/.test(t || '')

/** Totals for a site and date from the saved muster (expected = workers on the site list) */
export function attendanceSummary(state, siteId, date) {
  const expected = workersOf(siteId).length
  const recs = (state.attendanceRecords || []).filter((a) => a.siteId === siteId && a.date === date)
  const count = (s) => recs.filter((a) => a.status === s).length
  return { expected, recorded: recs.length, present: count('Present'), halfDay: count('Half Day'), absent: count('Absent'), onLeave: count('On Leave'), notMarked: expected - recs.length }
}
export const attendanceOf = (state, workerId, date) => (state.attendanceRecords || []).find((a) => a.workerId === workerId && a.date === date)

/**
 * Save the muster for one site and date. One record per worker, site and date: saving again
 * updates the same record (never a duplicate), and changing a saved status needs a reason.
 */
export function saveAttendance(state, { siteId, date, rows, reason }, actor) {
  if (!allowed(actor, P.ATTENDANCE_EDIT)) return fail('Attendance is recorded by the Site Supervisor.')
  if (!supervises(actor, siteId)) return fail(`Only ${supervisorOf(siteId) || 'the site supervisor'}, the Site Supervisor of this site, records its attendance.`)
  if (!date || date > todayISO()) return fail('Attendance cannot be recorded for a future date.')
  if (date < addDays(todayISO(), -7)) return fail('Attendance older than 7 days is corrected through the Project Manager.')
  if (!rows?.length) return fail('Mark at least one worker.')
  const crew = workersOf(siteId).map((w) => w.id)
  const changes = []
  for (const r of rows) {
    const w = workerOf(r.workerId)
    if (!crew.includes(r.workerId)) return fail(`${w?.name || r.workerId} is not on this site's worker list.`)
    if (!ATTENDANCE_STATUSES.includes(r.status)) return fail(`Mark ${w.name} as Present, Absent, Half Day or On Leave.`)
    if (WORKING.includes(r.status)) {
      if (!timeOk(r.checkIn)) return fail(`Enter ${w.name}'s check-in time (HH:MM).`)
      if (r.checkOut && !timeOk(r.checkOut)) return fail(`${w.name}: check-out must be HH:MM.`)
      if (r.checkOut && r.checkOut <= r.checkIn) return fail(`${w.name}: check-out must be after check-in.`)
    }
    const old = attendanceOf(state, r.workerId, date)
    if (old && (old.status !== r.status || old.checkIn !== (r.checkIn || '') || old.checkOut !== (r.checkOut || '') || old.remarks !== (r.remarks || ''))) changes.push({ old, r })
  }
  if (new Set(rows.map((r) => r.workerId)).size !== rows.length) return fail('A worker appears twice in this muster.')
  const statusChanged = changes.filter((c) => c.old.status !== c.r.status)
  if (statusChanged.length && (!reason?.trim() || reason.trim().length < 5)) return fail(`Give the reason for changing ${statusChanged.length} saved status${statusChanged.length > 1 ? 'es' : ''} (e.g. late arrival confirmed).`)
  let records = state.attendanceRecords || []
  let added = 0
  for (const r of rows) {
    const old = attendanceOf({ attendanceRecords: records }, r.workerId, date)
    const base = { workerId: r.workerId, projectId: SITES.find((s) => s.id === siteId)?.projectId, siteId, date, status: r.status, workArea: r.workArea?.trim() || old?.workArea || '', checkIn: WORKING.includes(r.status) ? r.checkIn : '', checkOut: WORKING.includes(r.status) ? r.checkOut || '' : '', remarks: r.remarks?.trim() || '' }
    if (!old) { records = [...records, { id: `ATT-${date}-${r.workerId}`, ...base, markedBy: actor.name, at: stamp(), history: [], demo: true }]; added++; continue }
    const ch = changes.find((c) => c.old.id === old.id)
    if (!ch) continue
    records = records.map((x) => (x.id === old.id ? { ...x, ...base, editedBy: actor.name, editedAt: stamp(), history: [...(x.history || []), event(actor, 'Attendance corrected', reason?.trim() || 'Times / remarks updated')] } : x))
  }
  if (!added && !changes.length) return fail('Nothing changed: the muster is already saved as shown.')
  const s = attendanceSummary({ attendanceRecords: records }, siteId, date)
  return ok({ ...state, attendanceRecords: records, audit: audit(state, actor, `ATT ${siteId} ${date}`, added ? 'Attendance recorded' : 'Attendance corrected', `${s.present} present, ${s.halfDay} half day, ${s.absent} absent, ${s.onLeave} on leave${reason ? `. ${reason}` : ''}`) },
    `Attendance saved for ${date}: ${s.present} present, ${s.halfDay} half day, ${s.absent} absent, ${s.onLeave} on leave${s.notMarked ? `, ${s.notMarked} not marked` : ''}`)
}

/**
 * Allocate present workers to an approved activity for a day. Only workers marked Present or
 * Half Day, and each worker on one activity a day. Planned quantities, dates and budget are not changed.
 */
export function allocateWork(state, { taskId, date, workerIds, instructions, reason }, actor) {
  const t = state.tasks.find((x) => x.id === taskId)
  if (!t) return fail('Select the activity.')
  if (!allowed(actor, P.SITE_SUPERVISE)) return fail('Work is allocated by the Site Supervisor.')
  if (!supervises(actor, t.siteId)) return fail(`${taskId} is on a site you do not supervise.`)
  if (!date || date > addDays(todayISO(), 1)) return fail('Allocate for today or tomorrow only.')
  if (t.start > date) return fail(`${taskId} is planned to start on ${t.start}; it cannot be allocated earlier.`)
  const v = taskView(state, t)
  if (v.status === 'Completed') return fail(`${taskId} is already complete.`)
  const ids = [...new Set(workerIds || [])]
  if (!ids.length) return fail('Select at least one worker.')
  for (const id of ids) {
    const w = workerOf(id)
    const att = attendanceOf(state, id, date)
    if (date <= todayISO() && (!att || !WORKING.includes(att.status))) return fail(`${w?.name || id} is not marked present on ${date}. Record attendance first.`)
    const other = (state.allocations || []).find((a) => a.date === date && a.taskId !== taskId && a.workerIds.includes(id))
    if (other) return fail(`${w.name} is already allocated to ${other.taskId} on ${date}.`)
  }
  const existing = (state.allocations || []).find((a) => a.taskId === taskId && a.date === date)
  if (existing && (!reason?.trim() || reason.trim().length < 5)) return fail('Give the reason for changing this allocation.')
  const crew = ids.map(workerOf)
  const team = [...new Set(crew.map((w) => w.team))].join(' + ')
  const rec = { id: existing?.id || nextId(state.allocations || [], 'WA-'), taskId, projectId: t.projectId, siteId: t.siteId, date, workerIds: ids, team, instructions: instructions?.trim() || '', by: actor.name, at: stamp(), demo: true,
    history: [...(existing?.history || []), event(actor, existing ? 'Allocation changed' : 'Workers allocated', existing ? `${existing.workerIds.length} → ${ids.length} workers. ${reason.trim()}` : `${ids.length} workers`)] }
  const allocations = existing ? updateIn(state.allocations, existing.id, () => rec) : [...(state.allocations || []), rec]
  return ok({ ...state, allocations, audit: audit(state, actor, rec.id, existing ? 'Allocation changed' : 'Workers allocated', `${taskId}: ${ids.length} workers on ${date}`) }, `${ids.length} worker${ids.length > 1 ? 's' : ''} allocated to ${taskId} (${t.title}) for ${date}`)
}

/** Remaining planned quantity after verified and still-pending supervisor entries (pending counts against it so nothing is entered twice) */
export function progressPosition(state, taskId, excludeId = null) {
  const t = state.tasks.find((x) => x.id === taskId)
  const done = taskDone(state, taskId)
  const pending = round2((state.supervisorProgress || []).filter((p) => p.taskId === taskId && p.status === 'Submitted' && p.id !== excludeId).reduce((s, p) => s + p.qty, 0))
  return { planned: t?.plannedQty || 0, done, pending, open: round2(Math.max(0, (t?.plannedQty || 0) - done - pending)) }
}

/**
 * Supervisor records the day's completed quantity on an activity. It is SUBMITTED for the Site
 * Engineer to verify and counts towards progress only once verified. One entry per task and day.
 */
export function submitProgress(state, f, actor) {
  const t = state.tasks.find((x) => x.id === f.taskId)
  if (!t) return fail('Select the activity (task reference).')
  if (!allowed(actor, P.SITE_SUPERVISE)) return fail('Execution progress is recorded by the Site Supervisor.')
  if (!supervises(actor, t.siteId)) return fail(`${t.id} is on a site you do not supervise.`)
  if (!f.date || f.date > todayISO()) return fail('The progress date cannot be in the future.')
  if (f.date < t.start) return fail(`${t.id} starts on ${t.start}.`)
  const q = num(f.qty)
  const unit = state.boq.find((b) => b.id === t.boqId)?.unit
  if (Number.isNaN(q) || q <= 0) return fail('Completed quantity today must be more than 0.')
  if (!DECIMAL.includes(unit) && !Number.isInteger(q)) return fail(`Whole ${unit} only.`)
  const w = num(f.workers)
  if (!Number.isInteger(w) || w <= 0) return fail('Enter the number of workers involved.')
  const existing = f.id && state.supervisorProgress.find((p) => p.id === f.id)
  if (existing && existing.status !== 'Returned') return fail(`${existing.id} is ${existing.status.toLowerCase()} and cannot be changed.`)
  const dup = state.supervisorProgress.find((p) => p.id !== f.id && p.taskId === t.id && p.date === f.date && p.status !== 'Returned')
  if (dup) return fail(`Progress for ${t.id} on ${f.date} is already recorded (${dup.id}, ${dup.status.toLowerCase()}). Add to that entry through the Site Engineer, not a second one.`)
  const dpr = state.reports.find((r) => r.date === f.date && r.status !== 'Draft' && r.status !== 'Returned' && r.entries.some((e) => e.taskId === t.id && Number(e.qty) > 0))
  if (dpr) return fail(`The Site Engineer's daily report ${dpr.id} already has ${t.id} for ${f.date}; quantities are not entered twice.`)
  const pos = progressPosition(state, t.id, existing?.id)
  if (q > pos.open) return fail(`Only ${pos.open} ${unit} of ${t.id} remains (planned ${pos.planned}, verified ${pos.done}, awaiting verification ${pos.pending}). Remaining work cannot go below zero.`)
  if (f.workerIds?.length && f.workerIds.some((id) => !WORKING.includes(attendanceOf(state, id, f.date)?.status))) return fail('Some selected workers are not marked present on that date.')
  const id = existing?.id || nextId(state.supervisorProgress.length ? state.supervisorProgress : [{ id: 'SPE-100' }], 'SPE-')
  const rec = {
    id, taskId: t.id, projectId: t.projectId, siteId: t.siteId, date: f.date, qty: round2(q), unit, workers: w, workerIds: f.workerIds || [], workArea: f.workArea?.trim() || t.location,
    remarks: f.remarks?.trim() || '', photos: f.photos || [], status: 'Submitted', by: actor.name, at: stamp(), reviewedBy: null, reviewNote: '', demo: true,
    history: [...(existing?.history || []), event(actor, existing ? 'Corrected and resubmitted for Site Engineer verification' : 'Progress recorded; sent to the Site Engineer for verification', `${q} ${unit} by ${w} workers`)],
  }
  const supervisorProgress = existing ? updateIn(state.supervisorProgress, id, () => rec) : [...state.supervisorProgress, rec]
  return ok({ ...state, supervisorProgress, audit: audit(state, actor, id, 'Supervisor progress submitted', `${t.id}: ${q} ${unit}`) },
    `${id}: ${q} ${unit} on ${t.id} sent to ${engineerOf(t.siteId) || 'the Site Engineer'} for verification (counts once verified)`)
}

/** Site Engineer verifies (counts towards progress) or returns a supervisor entry. Not a quality inspection. */
export function reviewProgress(state, { id, approve, note }, actor) {
  const p = (state.supervisorProgress || []).find((x) => x.id === id)
  if (!p) return fail('Progress entry not found.')
  if (!allowed(actor, P.SITE_WORK)) return fail('Supervisor progress is verified by the Site Engineer.')
  if (p.by === actor.name) return fail('You recorded this entry; another person must verify it.')
  if (p.status !== 'Submitted') return fail(`${id} is already ${p.status.toLowerCase()}.`)
  if (!approve && (!note?.trim() || note.trim().length < 5)) return fail('Say what needs correcting (the supervisor sees it).')
  if (approve) {
    const t = state.tasks.find((x) => x.id === p.taskId)
    const done = taskDone(state, p.taskId)
    if (round2(done + p.qty) > t.plannedQty) return fail(`Verifying would take ${p.taskId} to ${round2(done + p.qty)} of ${t.plannedQty} ${p.unit}. Return it for correction.`)
  }
  return ok({
    ...state,
    supervisorProgress: updateIn(state.supervisorProgress, id, (x) => ({ ...x, status: approve ? 'Verified' : 'Returned', reviewedBy: actor.name, reviewedAt: stamp(), reviewNote: note?.trim() || '', history: [...x.history, event(actor, approve ? 'Verified by Site Engineer: counts towards task progress' : 'Returned for correction', note?.trim() || '')] })),
    audit: audit(state, actor, id, approve ? 'Supervisor progress verified' : 'Supervisor progress returned', note || ''),
  }, `${id} ${approve ? 'verified; task progress updated' : 'returned to the supervisor'}`)
}

/** Supervisor tells the Site Engineer that site stock will not cover the work. Not a material request. */
export function reportShortage(state, f, actor) {
  if (!allowed(actor, P.SITE_SUPERVISE)) return fail('Shortages are reported by the Site Supervisor.')
  if (!supervises(actor, f.siteId)) return fail('Select a site you supervise.')
  const m = materialOf(f.sku)
  if (!m) return fail('Select the material from the material master.')
  const req = num(f.required); const have = num(f.available)
  if (Number.isNaN(req) || req <= 0) return fail('Enter the quantity the work needs.')
  if (Number.isNaN(have) || have < 0) return fail('Enter the usable quantity available on site (0 if none).')
  if (have >= req) return fail('Available covers the requirement: there is no shortage to report.')
  if (!f.neededBy || f.neededBy < todayISO()) return fail('Enter when it is needed (today or later).')
  if (!f.remarks?.trim() || f.remarks.trim().length < 10) return fail('Describe what the material is for and how you counted it.')
  if ((state.shortageReports || []).some((s) => s.siteId === f.siteId && s.sku === f.sku && ['Reported', 'Acknowledged'].includes(s.status))) return fail(`A shortage of ${m.name} is already open with the Site Engineer.`)
  const id = nextId(state.shortageReports || [], 'SR-')
  const rec = { id, projectId: SITES.find((s) => s.id === f.siteId)?.projectId, siteId: f.siteId, sku: f.sku, required: round2(req), available: round2(have), shortage: round2(req - have), neededBy: f.neededBy, taskId: f.taskId || null, remarks: f.remarks.trim(), status: 'Reported', requestRef: null, reportedBy: actor.name, at: stamp(), demo: true,
    history: [event(actor, 'Shortage reported to the Site Engineer', `Needs ${req}, usable on site ${have} ${m.unit}`)] }
  return ok({ ...state, shortageReports: [...(state.shortageReports || []), rec], audit: audit(state, actor, id, 'Material shortage reported', `${round2(req - have)} ${m.unit} ${m.name}`) },
    `${id}: shortage of ${round2(req - have)} ${m.unit} ${m.name} reported to ${engineerOf(f.siteId) || 'the Site Engineer'} (no material request created)`)
}

/** Site Engineer acknowledges a shortage, links the material request they raised for it, or closes it with a reason. */
export function handleShortage(state, { id, action, requestRef, note }, actor) {
  const s = (state.shortageReports || []).find((x) => x.id === id)
  if (!s) return fail('Shortage report not found.')
  if (!allowed(actor, P.SITE_WORK)) return fail('Shortage reports are handled by the Site Engineer.')
  if (['Request raised', 'Closed'].includes(s.status)) return fail(`${id} is already ${s.status.toLowerCase()}.`)
  if (action === 'link' && !requestRef) return fail('Choose the material request.')
  if (action === 'close' && (!note?.trim() || note.trim().length < 5)) return fail('Give the reason for closing (e.g. covered by MR-5012 already).')
  const status = action === 'ack' ? 'Acknowledged' : action === 'link' ? 'Request raised' : 'Closed'
  const text = action === 'ack' ? 'Acknowledged by the Site Engineer' : action === 'link' ? `Material request ${requestRef} raised by the Site Engineer` : 'Closed by the Site Engineer'
  return ok({ ...state, shortageReports: updateIn(state.shortageReports, id, (x) => ({ ...x, status, requestRef: requestRef || x.requestRef, closeNote: action === 'close' ? note.trim() : x.closeNote, history: [...x.history, event(actor, text, note || '')] })), audit: audit(state, actor, id, text, note || '') }, `${id}: ${status.toLowerCase()}`)
}

/** Site Engineer marks a submitted diary entry by someone else (e.g. the Site Supervisor) as reviewed. */
export function reviewDiary(state, { id, note }, actor) {
  const d = state.diary.find((x) => x.id === id)
  if (!d) return fail('Diary entry not found.')
  if (!allowed(actor, P.SITE_WORK)) return fail('Diary entries are reviewed by the Site Engineer.')
  if (d.preparedBy === actor.name) return fail('You cannot review your own diary entry.')
  if (d.status !== 'Submitted') return fail(`${id} is ${d.status.toLowerCase()}.`)
  return ok({ ...state, diary: updateIn(state.diary, id, (x) => ({ ...x, status: 'Reviewed', reviewedBy: actor.name, reviewedAt: stamp(), reviewNote: note?.trim() || '' })), audit: audit(state, actor, id, 'Diary reviewed', note || '') }, `${id} reviewed`)
}
