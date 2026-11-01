// Everything the Site Engineer pages show, computed once from the shared records and limited to
// the signed-in engineer's scope. Overview, Reports and Communication all use these numbers.
import { attendanceDaily, attendanceVerification, labourRoster } from '../../data/demo/adminDashboardDemo.js'
import { labour as namedWorkers } from '../../data/mockData.js'
import { ACTIVE_REQUEST_STATUSES, materialOf as materialOfSku, MR } from '../../services/inventory.js'
import { boqView, COUNTED_DPR, labourNeed, latestApproved, latestRevision, siteOf, taskView } from '../../services/site.js'
import { addDays, todayISO } from '../../utils/date.js'

/** Notification type for a request history event recorded by someone else */
function requestNoteKind(action = '') {
  if (/^Returned/.test(action)) return 'Request returned for clarification'
  if (/^Rejected/.test(action)) return 'Material request rejected'
  if (/^Approved/.test(action)) return 'Material request reviewed by Project Manager'
  if (/^Stock checked/.test(action)) return 'Material stock checked'
  if (/shortage/i.test(action)) return 'Material shortage forwarded'
  if (/^Balance closed/.test(action)) return 'Material request closed'
  if (/^Issued/.test(action)) return 'Material issued'
  return 'Material request update'
}

export function siteData(ctx, today = todayISO()) {
  const { site, inv, scope, user } = ctx
  const s = site.state
  const inS = ctx.inScope
  const tasks = s.tasks.filter(inS).map((t) => taskView(s, t, today))
  const boq = s.boq.filter(inS).map((b) => boqView(s, b, today))
  const reports = s.reports.filter(inS)
  // Material requests: the shared inventory records for the assigned sites (site → project)
  // (another engineer's drafts are private to them)
  const requests = inv.requests.filter((r) => scope.siteIds.includes(r.siteId) && (r.status !== MR.DRAFT || r.requestedBy === user.name || scope.all)).map((r) => ({
    ...r, projectId: r.site?.projectId, pending: r.approved != null ? r.remaining : [MR.REJECTED, MR.CANCELLED].includes(r.status) ? 0 : r.requested,
  }))
  const issues = s.issues.filter(inS)
  const inspections = s.inspections.filter(inS)
  const ncrs = s.ncrs.filter(inS)
  const safety = s.safety.filter(inS)
  const equipment = s.equipment.filter(inS)
  const docs = s.documents.filter(inS)
  const projectIds = scope.projectIds
  const attendanceToday = attendanceDaily.filter((a) => projectIds.includes(a.projectId) && a.date === today)
  const presentToday = attendanceToday.reduce((t, a) => t + a.present, 0)

  const delayed = tasks.filter((t) => t.status === 'Delayed')
  const dueToday = tasks.filter((t) => t.dueToday)
  const activeToday = tasks.filter((t) => t.start <= today && t.status !== 'Completed')
  const openIssues = issues.filter((i) => !['Resolved', 'Closed'].includes(i.status))
  const pendingRequests = requests.filter((r) => ACTIVE_REQUEST_STATUSES.includes(r.status))
  const workPct = tasks.length ? Math.round(tasks.reduce((t, x) => t + x.pct, 0) / tasks.length) : 0
  // Planned progress to date (even progress between start and deadline) for comparison
  const plannedPct = tasks.length ? Math.round(tasks.reduce((t, x) => t + (x.plannedQty ? Math.min(100, (x.plannedToDate / x.plannedQty) * 100) : 0), 0) / tasks.length) : 0
  const pendingInspections = inspections.filter((q) => ['Scheduled', 'Overdue'].includes(q.status))
  const awaitingQa = inspections.filter((q) => q.reviewStatus === 'Awaiting QA review')

  const alerts = [
    ...safety.filter((x) => ['High', 'Critical'].includes(x.severity) && x.status !== 'Verified closed').map((x) => ({ id: x.id, tone: 'danger', text: `${x.kind}: ${x.description}`, section: 'safety' })),
    ...issues.filter((i) => ['High', 'Critical'].includes(i.priority) && !['Resolved', 'Closed'].includes(i.status)).map((i) => ({ id: i.id, tone: 'danger', text: `${i.category}: ${i.title}`, section: 'issues' })),
    ...delayed.map((t) => ({ id: t.id, tone: 'warning', text: `${t.title} is ${t.daysLate} day${t.daysLate > 1 ? 's' : ''} late (${t.done}/${t.plannedQty} ${t.unit})`, section: 'schedule' })),
    ...requests.filter((r) => [MR.APPROVED, MR.PARTIAL].includes(r.status) && r.shortage > 0 && !r.forwarded).map((r) => ({ id: r.id, tone: 'warning', text: `${r.material.name}: ${r.shortage} ${r.material.unit} short at ${r.store.name}`, section: 'materials' })),
    ...inspections.filter((q) => q.status === 'Overdue').map((q) => ({ id: q.id, tone: 'warning', text: `Inspection overdue: ${q.title}`, section: 'quality' })),
    ...equipment.filter((q) => q.status === 'Breakdown').map((q) => ({ id: q.id, tone: 'warning', text: `${q.name} broken down`, section: 'equipment' })),
    ...scope.siteIds.flatMap((id) => labourNeed(s, id, today).rows.filter((r) => r.shortage > 0).map((r) => ({ id: `${id}-${r.trade}`, tone: 'warning', text: `Labour shortage: ${r.trade} short by ${r.shortage} at ${siteOf(id)?.name}`, section: 'labour' }))),
    ...(s.weather || []).filter((w) => inS(w) && w.status === 'Active').map((w) => ({ id: w.id, tone: 'warning', text: `Weather restriction: ${w.restriction}`, section: 'safety' })),
  ]

  const horizon = addDays(today, 14)
  const deadlines = [
    ...tasks.filter((t) => t.status !== 'Completed' && t.deadline >= today && t.deadline <= horizon).map((t) => ({ id: t.id, date: t.deadline, text: t.milestone ? `Milestone: ${t.milestone}` : `Task due: ${t.title}`, section: 'schedule' })),
    ...inspections.filter((q) => q.status === 'Scheduled' && q.date >= today && q.date <= horizon).map((q) => ({ id: q.id, date: q.date, text: `Inspection: ${q.title}`, section: 'quality' })),
    ...requests.filter((r) => ACTIVE_REQUEST_STATUSES.includes(r.status) && r.requiredBy >= today && r.requiredBy <= horizon).map((r) => ({ id: r.id, date: r.requiredBy, text: `Material needed: ${r.material.name} (${r.id})`, section: 'materials' })),
    ...safety.filter((x) => x.status !== 'Verified closed' && x.actionDue && x.actionDue >= today && x.actionDue <= horizon).map((x) => ({ id: x.id, date: x.actionDue, text: `Safety action due: ${x.action}`, section: 'safety' })),
  ].sort((a, b) => a.date.localeCompare(b.date))

  // Notifications for this user only: instructions to them, updates on their requests / reports / issues
  const mine = (name) => name === user.name
  const notes = [
    ...s.messages.filter((m) => inS(m) && (mine(m.to) || mine(m.from) || scope.all)).map((m) => ({ at: m.replies.length ? m.replies[m.replies.length - 1].at : m.at, kind: m.kind === 'Instruction' ? 'Project Manager instruction' : 'Clarification', ref: m.id, text: `${m.subject}${m.replies.length ? `: ${m.replies[m.replies.length - 1].text}` : ''}`, section: 'communication' })),
    ...tasks.map((t) => ({ at: `${t.start}T08:00`, kind: 'Task assigned', ref: t.id, text: `${t.assignedBy} assigned “${t.title}” (due ${t.deadline})`, section: 'schedule' })).filter((n) => n.at.slice(0, 10) >= addDays(today, -14)),
    ...requests.flatMap((r) => (r.history || []).filter((h) => !mine(h.by)).map((h) => ({ at: h.at, kind: requestNoteKind(h.action), ref: r.id, text: `${h.action}${h.note ? `: ${h.note}` : ''} (${h.by})`, section: 'materials' }))),
    ...reports.filter((r) => r.reviewedBy && (mine(r.preparedBy) || scope.all)).map((r) => ({ at: r.reviewedAt, kind: r.status === 'Returned' ? 'Report returned' : 'Report reviewed', ref: r.id, text: `${r.reviewedBy}: ${r.reviewNote || (r.status === 'Returned' ? 'returned' : 'reviewed, no comments')}`, section: 'progress' })),
    ...issues.flatMap((i) => i.comments.filter((c) => !mine(c.by)).map((c) => ({ at: c.at, kind: 'Site issue updated', ref: i.id, text: `${c.by}: ${c.text}`, section: 'issues' }))),
    ...inspections.filter((q) => q.status === 'Failed').map((q) => ({ at: q.recordedAt || `${q.date}T12:00`, kind: 'Inspection needs correction', ref: q.id, text: `${q.title}: ${q.notes || 'see non-conformance'}${q.reinspectionDate ? ` · reinspection ${q.reinspectionDate}` : ''}`, section: 'quality' })),
    ...tasks.filter((t) => t.status !== 'Completed' && t.deadline >= today && t.deadline <= addDays(today, 2)).map((t) => ({ at: `${today}T07:00`, kind: 'Task deadline approaching', ref: t.id, text: `${t.title} due ${t.deadline === today ? 'today' : t.deadline}: ${t.done} of ${t.plannedQty} ${t.unit} done`, section: 'schedule' })),
    ...inspections.filter((q) => q.reviewStatus && q.reviewStatus !== 'Awaiting QA review').map((q) => ({ at: q.reviewedAt || `${q.date}T12:00`, kind: 'Inspection follow-up', ref: q.id, text: `${q.reviewStatus}${q.reviewNote ? `: ${q.reviewNote}` : ''}`, section: 'quality' })),
    ...s.boq.filter(inS).flatMap((b) => (b.revisions || []).filter((r) => r.decidedBy).map((r) => ({ at: r.decidedAt, kind: `BOQ revision ${r.status.toLowerCase()}`, ref: `${b.id} / ${r.id}`, text: `${r.from} → ${r.to} ${b.unit}${r.note ? `: ${r.note}` : ''} (${r.decidedBy})`, section: 'measurements' }))),
  ].filter((n) => n.at).sort((a, b) => b.at.localeCompare(a.at))

  // What the signed-in engineer has to do next (each item opens the place to do it)
  const myReq = requests.filter((r) => mine(r.requestedBy))
  const actions = [
    ...myReq.filter((r) => r.status === MR.RETURNED).map((r) => ({ id: r.id, tone: 'warning', text: `Correct and resubmit ${r.id} (${r.material.name}): ${r.reason}`, section: 'materials', query: `open=${r.id}` })),
    ...myReq.filter((r) => r.status === MR.DRAFT).map((r) => ({ id: r.id, tone: 'info', text: `Draft material request ${r.id} (${r.material.name}) is not submitted yet`, section: 'materials', query: `open=${r.id}` })),
    ...reports.filter((r) => mine(r.preparedBy) && r.status === 'Returned').map((r) => ({ id: r.id, tone: 'warning', text: `Daily report ${r.id} returned: ${r.reviewNote}`, section: 'progress' })),
    ...reports.filter((r) => mine(r.preparedBy) && r.status === 'Draft').map((r) => ({ id: r.id, tone: 'info', text: `Daily report ${r.id} (${r.date}) is a draft: submit it so the progress counts`, section: 'progress' })),
    ...(!scope.all && scope.siteIds.some((id) => !reports.some((r) => r.siteId === id && r.date === today)) ? [{ id: 'DPR-today', tone: 'info', text: "Today's daily progress report is not started yet", section: 'progress', query: 'new=1' }] : []),
    ...delayed.filter((t) => !t.delayReason || !t.correctiveAction).map((t) => ({ id: t.id, tone: 'danger', text: `${t.title} is late: record the delay reason and corrective action`, section: 'schedule', query: `task=${t.id}` })),
    ...inspections.filter((q) => q.owner === 'Site Engineer' && (mine(q.inspector) || scope.all) && ['Scheduled', 'Overdue'].includes(q.status) && q.date <= addDays(today, 1)).map((q) => ({ id: q.id, tone: 'info', text: `Record the result of inspection: ${q.title} (${q.date})`, section: 'quality' })),
    ...ncrs.filter((n) => n.action && mine(n.action.owner) && n.action.status !== 'Done').map((n) => ({ id: n.id, tone: 'warning', text: `Corrective action ${n.action.id}: ${n.action.text}`, section: 'quality' })),
    ...(s.supervisorProgress || []).filter((p) => inS(p) && p.status === 'Submitted').map((p) => ({ id: p.id, tone: 'warning', text: `Verify supervisor progress: ${p.qty} ${p.unit} on ${p.taskId} (${p.date}, ${p.by})`, section: 'progress' })),
    ...(s.shortageReports || []).filter((r) => inS(r) && ['Reported', 'Acknowledged'].includes(r.status)).map((r) => ({ id: r.id, tone: 'warning', text: `Shortage reported by ${r.reportedBy}: ${r.shortage} ${materialOfSku(r.sku)?.unit} ${materialOfSku(r.sku)?.name}, needed ${r.neededBy}`, section: 'materials' })),
    ...s.diary.filter((x) => inS(x) && x.status === 'Submitted' && !mine(x.preparedBy)).map((x) => ({ id: x.id, tone: 'info', text: `Review ${x.preparedBy}'s site diary for ${x.date}`, section: 'diary' })),
    ...s.messages.filter((m) => inS(m) && m.kind === 'Instruction' && mine(m.to) && m.status === 'Open').map((m) => ({ id: m.id, tone: 'info', text: `Acknowledge Project Manager instruction: ${m.subject}`, section: 'communication' })),
  ]

  return {
    tasks, boq, reports, requests, issues, inspections, ncrs, safety, equipment, docs, delayed, dueToday, activeToday, openIssues, pendingRequests,
    workPct, plannedPct, pendingInspections, awaitingQa, actions, alerts, deadlines, notes, presentToday, attendanceToday,
    attendance: attendanceDaily.filter((a) => projectIds.includes(a.projectId)),
    musterRolls: attendanceVerification.filter((a) => projectIds.includes(a.projectId)),
    roster: labourRoster.filter((r) => projectIds.includes(r.projectId)),
    // Today's attendance from the Site Supervisor's muster when it has been recorded
    workers: namedWorkers.filter((w) => scope.siteIds.some((id) => siteOf(id)?.name === w.site)).map((w) => {
      const a = (s.attendanceRecords || []).find((x) => x.workerId === w.id && x.date === today)
      return a ? { ...w, present: ['Present', 'Half Day'].includes(a.status), hours: a.status === 'Half Day' ? 4 : a.status === 'Present' ? 8 : 0, attendance: a.status } : w
    }),
    countedReports: reports.filter((r) => COUNTED_DPR.includes(r.status)),
    latestApproved, latestRevision,
  }
}
