import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import DataTable from '../../components/DataTable.jsx'
import { DemoTag } from '../../components/StateViews.jsx'
import { Badge, Card } from '../../components/UI.jsx'
import { siteOf } from '../../services/site.js'
import { addDays, diffDays, todayISO } from '../../utils/date.js'
import { formatDate } from '../../utils/format.js'
import { downloadCsv } from '../store-keeper/shared.jsx'
import { siteData } from './derive.js'
import { useSiteEngineer } from './shared.jsx'

const REPORTS = [
  ['progress', 'Daily Progress Report'], ['weekly', 'Weekly Progress Summary'], ['completion', 'Task Completion Report'],
  ['materials', 'Material Request History'], ['quality', 'Quality Inspection Report'], ['issues', 'Site Issue Report'],
  // Further analytics from the same records
  ['planned', 'Planned versus actual work'], ['boq', 'BOQ execution'], ['labour', 'Labour availability and productivity'],
  ['safety', 'Safety incidents and open actions'], ['equipment', 'Equipment downtime'], ['delays', 'Delays and outstanding work'],
]
const site = (id) => (id ? siteOf(id)?.name : 'Project-wide')
const B = (k) => ({ key: k, header: 'Status', render: (r) => <Badge>{r[k]}</Badge> })

function build(id, ctx, d, from, to) {
  const s = ctx.site.state
  const inRange = (date) => date >= from && date <= to
  switch (id) {
    case 'progress': return {
      rows: d.reports.filter((r) => inRange(r.date)).flatMap((r) => r.entries.map((e, i) => {
        const t = s.tasks.find((x) => x.id === e.taskId)
        return { key: `${r.id}-${i}`, date: r.date, report: r.id, siteId: r.siteId, activity: t?.title, qty: e.qty, unit: d.boq.find((b) => b.id === t?.boqId)?.unit, workers: e.workers, status: r.status, week: `Week of ${formatDate(addDays(r.date, -((new Date(r.date).getDay() + 6) % 7)))}` }
      })),
      columns: [{ key: 'date', header: 'Date', render: (r) => formatDate(r.date) }, { key: 'week', header: 'Week' }, { key: 'report', header: 'Report' }, { key: 'activity', header: 'Activity' }, { key: 'qty', header: 'Qty', align: 'num' }, { key: 'unit', header: 'Unit' }, { key: 'workers', header: 'Workers', align: 'num' }, B('status')],
      note: 'Only Submitted / Reviewed reports count towards progress; drafts are listed for completeness.',
    }
    case 'weekly': {
      // One row per week and activity: quantity done that week from submitted / reviewed reports
      const by = {}
      for (const rep of d.countedReports.filter((x) => inRange(x.date))) {
        const week = addDays(rep.date, -((new Date(rep.date).getDay() + 6) % 7))
        for (const e of rep.entries) {
          const t = s.tasks.find((x) => x.id === e.taskId)
          const k = `${week}-${e.taskId}`
          by[k] = by[k] || { key: k, week, siteId: rep.siteId, activity: `${e.taskId} ${t?.title}`, unit: d.boq.find((b) => b.id === t?.boqId)?.unit, qty: 0, days: 0, workerDays: 0, status: d.tasks.find((x) => x.id === e.taskId)?.status }
          by[k].qty = Math.round((by[k].qty + Number(e.qty)) * 100) / 100
          by[k].days += 1
          by[k].workerDays += Number(e.workers || 0)
        }
      }
      return {
        rows: Object.values(by).sort((a, b) => b.week.localeCompare(a.week)),
        columns: [{ key: 'week', header: 'Week starting', render: (x) => formatDate(x.week) }, { key: 'activity', header: 'Activity' }, { key: 'qty', header: 'Done in week', align: 'num' }, { key: 'unit', header: 'Unit' }, { key: 'days', header: 'Days worked', align: 'num' }, { key: 'workerDays', header: 'Worker-days', align: 'num' }, B('status')],
        note: 'Only submitted / reviewed daily reports count. Status is the task status today.',
      }
    }
    case 'completion': return {
      rows: [...ctx.myProjects.map((p) => ({ key: p.id, item: p.name, siteId: null, pct: p.progress, basis: 'Project schedule (overall)', status: p.status })),
        ...d.tasks.map((t) => ({ key: t.id, item: `${t.id} ${t.title}`, siteId: t.siteId, pct: t.pct, basis: `${t.done} / ${t.plannedQty} ${t.unit}`, status: t.status }))],
      columns: [{ key: 'item', header: 'Project / task' }, { key: 'siteId', header: 'Site', render: (r) => site(r.siteId), csv: (r) => site(r.siteId) }, { key: 'pct', header: 'Complete %', align: 'num', render: (r) => `${r.pct}%` }, { key: 'basis', header: 'Basis' }, B('status')],
    }
    case 'planned': return {
      rows: d.tasks.filter((t) => t.start <= to).map((t) => {
        const span = Math.max(1, diffDays(t.start, t.deadline))
        const elapsed = Math.min(span, Math.max(0, diffDays(t.start, to)))
        const plannedToDate = Math.round((t.plannedQty * elapsed / span) * 100) / 100
        return { key: t.id, task: `${t.id} ${t.title}`, siteId: t.siteId, unit: t.unit, plannedQty: t.plannedQty, plannedToDate, actual: t.done, variance: Math.round((t.done - plannedToDate) * 100) / 100, status: t.status }
      }),
      columns: [{ key: 'task', header: 'Task' }, { key: 'unit', header: 'Unit' }, { key: 'plannedQty', header: 'Planned total', align: 'num' }, { key: 'plannedToDate', header: `Planned by ${formatDate(to)}`, align: 'num' }, { key: 'actual', header: 'Actual', align: 'num' }, { key: 'variance', header: 'Variance', align: 'num', render: (r) => <span className={r.variance < 0 ? 'down' : 'up'}>{r.variance}</span> }, B('status')],
      note: 'Planned-to-date assumes even progress between start and deadline.',
    }
    case 'boq': return {
      rows: d.boq.map((b) => ({ key: b.id, item: b.id, siteId: b.siteId, description: b.description, unit: b.unit, approved: b.approvedQty, executed: b.executed, remaining: b.remaining, measured: b.measuredVerified, pct: b.pct, status: b.pct >= 100 ? 'Complete' : b.executed ? 'In Progress' : 'Not started' })),
      columns: [{ key: 'item', header: 'BOQ' }, { key: 'description', header: 'Description' }, { key: 'unit', header: 'Unit' }, { key: 'approved', header: 'Approved', align: 'num' }, { key: 'executed', header: 'Executed', align: 'num' }, { key: 'remaining', header: 'Remaining', align: 'num' }, { key: 'measured', header: 'Measured (verified)', align: 'num' }, { key: 'pct', header: '%', align: 'num' }, B('status')],
    }
    case 'materials': return {
      rows: d.requests.filter((r) => inRange(r.at.slice(0, 10)) || r.pending > 0).map((r) => ({ key: r.id, id: r.id, siteId: r.siteId, date: r.at.slice(0, 10), material: r.material.name, unit: r.material.unit, requested: r.requested, approved: r.approved ?? '', issued: r.issued, remaining: r.approved != null ? r.remaining : '', requiredBy: r.requiredBy, status: r.status })),
      columns: [{ key: 'id', header: 'Request' }, { key: 'date', header: 'Date', render: (r) => formatDate(r.date) }, { key: 'material', header: 'Material' }, { key: 'unit', header: 'Unit' }, { key: 'requested', header: 'Requested', align: 'num' }, { key: 'approved', header: 'Approved', align: 'num' }, { key: 'issued', header: 'Issued', align: 'num' }, { key: 'remaining', header: 'Remaining', align: 'num' }, { key: 'requiredBy', header: 'Required by', render: (r) => formatDate(r.requiredBy) }, B('status')],
      note: 'Requests raised in the period plus any still waiting. Issued quantities are the Store Keeper\'s confirmed issues.',
    }
    case 'labour': return {
      rows: d.attendance.filter((a) => inRange(a.date)).sort((a, b) => b.date.localeCompare(a.date)).map((a) => {
        const reps = d.countedReports.filter((r) => r.date === a.date)
        return { key: a.date, date: a.date, siteId: null, present: a.present, absent: a.absent, availability: `${Math.round((a.present / Math.max(1, a.present + a.absent)) * 100)}%`, siteWorkers: reps.reduce((t, r) => t + r.entries.reduce((x, e) => x + Number(e.workers), 0), 0), status: a.present ? 'Recorded' : 'No muster' }
      }),
      columns: [{ key: 'date', header: 'Date', render: (r) => formatDate(r.date) }, { key: 'present', header: 'Present (project)', align: 'num' }, { key: 'absent', header: 'Absent', align: 'num' }, { key: 'availability', header: 'Availability', align: 'num' }, { key: 'siteWorkers', header: 'Workers on your reported activities', align: 'num' }, B('status')],
      note: 'Attendance from the Site Supervisor muster; activity workers from submitted daily reports.',
    }
    case 'quality': return {
      rows: [...d.inspections.filter((q) => inRange(q.date)).map((q) => ({ key: q.id, ref: q.id, kind: `Inspection: ${q.type}`, siteId: q.siteId, date: q.date, text: q.title, by: q.inspector, status: q.reviewStatus ? `${q.status} · ${q.reviewStatus}` : q.status })),
        ...d.ncrs.map((n) => ({ key: n.id, ref: n.id, kind: `Defect (${n.severity})`, siteId: n.siteId, date: n.reported, text: n.description, by: n.action?.owner || '', status: n.status }))],
      columns: [{ key: 'ref', header: 'Ref.' }, { key: 'kind', header: 'Type' }, { key: 'date', header: 'Date', render: (r) => formatDate(r.date) }, { key: 'text', header: 'Item' }, { key: 'by', header: 'Inspector / owner' }, B('status')],
    }
    case 'safety': return {
      rows: [...d.safety.filter((x) => inRange(x.date) || x.status !== 'Verified closed').map((x) => ({ key: x.id, ref: x.id, kind: x.kind, severity: x.severity, siteId: x.siteId, date: x.date, text: x.description, due: x.actionDue || '', status: x.status })),
        ...(s.safetyActions || []).filter((t) => (!t.siteId || ctx.scope.siteIds.includes(t.siteId)) && t.status !== 'Closed').map((t) => ({ key: t.id, ref: t.id, kind: 'Safety action', severity: t.priority, siteId: t.siteId, date: t.due, text: t.text, due: t.due, status: t.status }))],
      columns: [{ key: 'ref', header: 'Ref.' }, { key: 'kind', header: 'Type' }, { key: 'severity', header: 'Severity' }, { key: 'date', header: 'Date', render: (r) => formatDate(r.date) }, { key: 'text', header: 'Description' }, { key: 'due', header: 'Action due', render: (r) => (r.due ? formatDate(r.due) : '—') }, B('status')],
    }
    case 'equipment': return {
      rows: d.equipment.map((q) => {
        const logs = s.equipmentLogs.filter((l) => l.equipmentId === q.id && inRange(l.date))
        return { key: q.id, name: `${q.id} ${q.name}`, siteId: q.siteId, hours: logs.reduce((t, l) => t + l.hours, 0), downtime: logs.reduce((t, l) => t + l.downtime, 0), reasons: [...new Set(logs.map((l) => l.reason).filter(Boolean))].join(', '), status: q.status }
      }),
      columns: [{ key: 'name', header: 'Equipment' }, { key: 'siteId', header: 'Site', render: (r) => site(r.siteId), csv: (r) => site(r.siteId) }, { key: 'hours', header: 'Hours worked', align: 'num' }, { key: 'downtime', header: 'Downtime (h)', align: 'num' }, { key: 'reasons', header: 'Downtime reasons' }, B('status')],
    }
    case 'delays': return {
      rows: d.tasks.filter((t) => t.status !== 'Completed').map((t) => ({ key: t.id, task: `${t.id} ${t.title}`, siteId: t.siteId, deadline: t.deadline, outstanding: `${t.remaining} ${t.unit}`, late: t.daysLate, reason: t.delayReason, action: t.correctiveAction, status: t.status })),
      columns: [{ key: 'task', header: 'Task' }, { key: 'deadline', header: 'Deadline', render: (r) => formatDate(r.deadline) }, { key: 'outstanding', header: 'Outstanding' }, { key: 'late', header: 'Days late', align: 'num' }, { key: 'reason', header: 'Reason' }, { key: 'action', header: 'Corrective action' }, B('status')],
    }
    case 'issues': return {
      rows: d.issues.map((i) => ({ key: i.id, id: i.id, siteId: i.siteId, title: i.title, category: i.category, priority: i.priority, reported: i.reported, days: diffDays(i.reported, i.resolvedAt || todayISO()), assignee: i.assignee?.name, status: i.status })),
      columns: [{ key: 'id', header: 'Ref.' }, { key: 'title', header: 'Issue' }, { key: 'category', header: 'Category' }, { key: 'priority', header: 'Priority' }, { key: 'reported', header: 'Reported', render: (r) => formatDate(r.reported) }, { key: 'days', header: 'Days open / to resolve', align: 'num' }, { key: 'assignee', header: 'Assigned to' }, B('status')],
    }
    default: return { rows: [], columns: [] }
  }
}

export default function Reports({ notify }) {
  const ctx = useSiteEngineer(notify)
  const d = siteData(ctx)
  const [params, setParams] = useSearchParams()
  const report = REPORTS.find(([id]) => id === params.get('report')) || REPORTS[0]
  const [from, setFrom] = useState(addDays(todayISO(), -6))
  const [to, setTo] = useState(todayISO())
  const [project, setProject] = useState('all')
  const [siteId, setSiteId] = useState('all')
  const [status, setStatus] = useState('all')
  const { rows: all, columns, note } = build(report[0], ctx, d, from, to)
  const projectOfSite = (id) => (id ? (siteOf(id)?.project === 'Palm Grove Villas' ? 'P-102' : 'P-101') : null)
  const rows = all
    .filter((r) => project === 'all' || !r.siteId || projectOfSite(r.siteId) === project)
    .filter((r) => siteId === 'all' || r.siteId === siteId)
    .filter((r) => status === 'all' || String(r.status).startsWith(status))
  const statuses = [...new Set(all.map((r) => String(r.status).split(' · ')[0]).filter(Boolean))]

  return (
    <Card title={report[1]} sub="From the same site and store records as the dashboard, limited to your sites" bodyClass=""
      action={<div className="cell-actions no-print"><DemoTag /><button className="btn btn-sm" onClick={() => window.print()}>Print</button><button className="btn btn-sm" disabled={!rows.length} onClick={() => downloadCsv(`site-${report[0]}-report-demo.csv`, columns, rows)}>Export CSV</button></div>}>
      <div className="toolbar no-print">
        <div className="filters">
          <label className="field">Report<select value={report[0]} onChange={(e) => setParams((p) => { p.set('report', e.target.value); return p })}>{REPORTS.map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select></label>
          <label className="field">From<input type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value || from)} /></label>
          <label className="field">To<input type="date" value={to} max={todayISO()} onChange={(e) => setTo(e.target.value || to)} /></label>
          <label className="field">Project<select value={project} onChange={(e) => setProject(e.target.value)}><option value="all">All assigned</option>{ctx.myProjects.map((p) => <option key={p.id} value={p.id}>{p.short}</option>)}</select></label>
          <label className="field">Site<select value={siteId} onChange={(e) => setSiteId(e.target.value)}><option value="all">All assigned</option>{ctx.mySites.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select></label>
          <label className="field">Status<select value={status} onChange={(e) => setStatus(e.target.value)}><option value="all">All</option>{statuses.map((x) => <option key={x}>{x}</option>)}</select></label>
        </div>
      </div>
      {note && <div className="filter-note" style={{ padding: '0 18px' }}>{note}</div>}
      <DataTable dense rowKey="key" rows={rows} columns={columns} emptyText="Nothing to report for these filters." />
    </Card>
  )
}
