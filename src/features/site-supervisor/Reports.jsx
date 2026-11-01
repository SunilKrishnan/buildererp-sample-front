import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import DataTable from '../../components/DataTable.jsx'
import { DemoTag } from '../../components/StateViews.jsx'
import { Badge, Card } from '../../components/UI.jsx'
import { siteOf } from '../../services/site.js'
import { addDays, todayISO } from '../../utils/date.js'
import { formatDate } from '../../utils/format.js'
import { downloadCsv } from '../store-keeper/shared.jsx'
import { shortName, supData, useSupervisor, workerOf } from './shared.jsx'

const REPORTS = [
  ['attendance', 'Daily attendance report'], ['allocation', 'Worker allocation report'], ['progress', 'Daily work progress report'],
  ['delays', 'Delayed task report'], ['issues', 'Site issues report'], ['safety', 'Safety observations report'], ['diary', 'Site diary history'],
]
const B = { key: 'status', header: 'Status', render: (r) => <Badge>{r.status}</Badge> }
const D = { key: 'date', header: 'Date', render: (r) => formatDate(r.date), csv: (r) => r.date }
const S = { key: 'siteId', header: 'Site', render: (r) => shortName(siteOf(r.siteId)?.name), csv: (r) => siteOf(r.siteId)?.name }

function build(id, ctx, d) {
  const s = ctx.site.state
  switch (id) {
    case 'attendance': return { rows: d.attendance.map((a) => ({ key: a.id, ...a, worker: workerOf(a.workerId)?.name, trade: workerOf(a.workerId)?.trade, taskId: d.taskOfWorker(a.workerId, a.date)?.taskId || '' })),
      columns: [D, S, { key: 'worker', header: 'Worker' }, { key: 'workerId', header: 'ID' }, { key: 'trade', header: 'Trade' }, B, { key: 'checkIn', header: 'In' }, { key: 'checkOut', header: 'Out' }, { key: 'remarks', header: 'Remarks' }] }
    case 'allocation': return { rows: d.allocations.flatMap((a) => a.workerIds.map((w) => ({ key: `${a.id}-${w}`, date: a.date, siteId: a.siteId, taskId: a.taskId, workerId: w, worker: workerOf(w)?.name, trade: workerOf(w)?.trade, team: a.team, instructions: a.instructions, status: 'Allocated' }))),
      columns: [D, S, { key: 'taskId', header: 'Task' }, { key: 'worker', header: 'Worker' }, { key: 'trade', header: 'Trade' }, { key: 'team', header: 'Team' }, { key: 'instructions', header: 'Instructions' }] }
    case 'progress': return { rows: d.progress.map((p) => ({ key: p.id, ...p, workerId: '', task: d.tasks.find((t) => t.id === p.taskId)?.title, status: p.status === 'Submitted' ? 'Pending Verification' : p.status })),
      columns: [D, { key: 'id', header: 'Entry' }, { key: 'taskId', header: 'Task' }, { key: 'task', header: 'Activity' }, { key: 'workArea', header: 'Work area' }, { key: 'qty', header: 'Qty', align: 'num' }, { key: 'unit', header: 'Unit' }, { key: 'workers', header: 'Workers', align: 'num' }, B, { key: 'reviewedBy', header: 'Verified / returned by' }] }
    case 'delays': return { rows: d.tasks.filter((t) => t.status === 'Delayed').map((t) => ({ key: t.id, date: t.deadline, siteId: t.siteId, taskId: t.id, title: t.title, done: `${t.done} / ${t.plannedQty} ${t.unit}`, late: t.daysLate, reason: t.delayReason, status: t.status })),
      columns: [{ ...D, header: 'Due' }, { key: 'taskId', header: 'Task' }, { key: 'title', header: 'Activity' }, { key: 'done', header: 'Done / planned' }, { key: 'late', header: 'Days late', align: 'num' }, { key: 'reason', header: 'Reason (Site Engineer)' }, B] }
    case 'issues': return { rows: d.issues.map((i) => ({ key: i.id, date: i.reported, siteId: i.siteId, id: i.id, title: i.title, category: i.category, priority: i.priority, reportedBy: i.reportedBy, reviewer: i.assignee?.name, status: i.status, taskId: (i.links || []).find((l) => l.startsWith('TSK')) || '' })),
      columns: [D, { key: 'id', header: 'Issue' }, { key: 'title', header: 'Issue' }, { key: 'category', header: 'Category' }, { key: 'priority', header: 'Severity' }, { key: 'reportedBy', header: 'Reported by' }, { key: 'reviewer', header: 'Reviewing' }, B] }
    case 'safety': return { rows: d.safety.map((x) => ({ key: x.id, ...x, taskId: '' })),
      columns: [D, { key: 'id', header: 'Ref.' }, { key: 'kind', header: 'Type' }, { key: 'description', header: 'Description' }, { key: 'severity', header: 'Severity' }, { key: 'immediateAction', header: 'Immediate action' }, { key: 'actionOwner', header: 'Responsible' }, B] }
    case 'diary': return { rows: s.diary.filter(ctx.inScope).map((x) => ({ key: x.id, ...x, taskId: '' })),
      columns: [D, S, { key: 'id', header: 'Entry' }, { key: 'preparedBy', header: 'By' }, { key: 'activities', header: 'Work performed' }, { key: 'tomorrow', header: 'Next-day plan' }, B] }
    default: return { rows: [], columns: [] }
  }
}

export default function Reports({ notify }) {
  const ctx = useSupervisor(notify)
  const d = supData(ctx)
  const [params, setParams] = useSearchParams()
  const report = REPORTS.find(([id]) => id === params.get('report')) || REPORTS[0]
  const [from, setFrom] = useState(addDays(todayISO(), -6))
  const [to, setTo] = useState(todayISO())
  const [siteId, setSiteId] = useState('all')
  const [task, setTask] = useState('all')
  const [worker, setWorker] = useState('all')
  const [status, setStatus] = useState('all')
  const { rows: all, columns } = build(report[0], ctx, d)
  // Delays are current: the date filter does not hide a task that is still late
  const rows = all
    .filter((r) => report[0] === 'delays' || ((!from || r.date >= from) && (!to || r.date <= to)))
    .filter((r) => siteId === 'all' || r.siteId === siteId)
    .filter((r) => task === 'all' || r.taskId === task)
    .filter((r) => worker === 'all' || r.workerId === worker)
    .filter((r) => status === 'all' || r.status === status)
    .sort((a, b) => String(b.date).localeCompare(String(a.date)))
  const statuses = [...new Set(all.map((r) => r.status).filter(Boolean))]

  return (
    <Card title={report[1]} sub="From the shared site records for your site" bodyClass=""
      action={<div className="cell-actions no-print"><DemoTag /><button className="btn btn-sm" onClick={() => window.print()}>Print</button><button className="btn btn-sm" disabled={!rows.length} onClick={() => { downloadCsv(`supervisor-${report[0]}-demo.csv`, columns, rows); notify?.(`Demo: ${rows.length} rows exported to CSV`) }}>Export CSV</button></div>}>
      <div className="toolbar no-print">
        <div className="filters">
          <label className="field">Report<select value={report[0]} onChange={(e) => { setParams({ report: e.target.value }); setStatus('all') }}>{REPORTS.map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select></label>
          <label className="field">Site<select value={siteId} onChange={(e) => setSiteId(e.target.value)}><option value="all">All</option>{ctx.mySites.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select></label>
          {report[0] !== 'delays' && <><label className="field">From<input type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} /></label><label className="field">To<input type="date" value={to} max={todayISO()} onChange={(e) => setTo(e.target.value)} /></label></>}
          {['allocation', 'progress', 'delays', 'attendance'].includes(report[0]) && <label className="field">Task<select value={task} onChange={(e) => setTask(e.target.value)}><option value="all">All</option>{d.tasks.map((t) => <option key={t.id} value={t.id}>{t.id}</option>)}</select></label>}
          {['attendance', 'allocation'].includes(report[0]) && <label className="field">Worker<select value={worker} onChange={(e) => setWorker(e.target.value)}><option value="all">All</option>{d.workers.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}</select></label>}
          <label className="field">Status<select value={status} onChange={(e) => setStatus(e.target.value)}><option value="all">All</option>{statuses.map((x) => <option key={x}>{x}</option>)}</select></label>
        </div>
      </div>
      <DataTable dense rowKey="key" rows={rows} columns={columns} emptyText="Nothing to report for these filters." />
      <p className="cell-sub" style={{ padding: '8px 18px 14px' }}>{rows.length} rows. Demo data for this browser session; CSV is generated in the browser.</p>
    </Card>
  )
}
