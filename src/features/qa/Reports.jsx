import { useState } from 'react'
import DataTable from '../../components/DataTable.jsx'
import StatGrid from '../../components/StatGrid.jsx'
import { Card } from '../../components/UI.jsx'
import { projects } from '../../data/mockData.js'
import { QA_INSPECTORS } from '../../data/demo/qaDemo.js'
import * as Q from '../../services/qa.js'
import { formatDate } from '../../utils/format.js'
import { downloadCsv } from '../store-keeper/shared.jsx'
import { INSPECTION_TYPES } from './Schedule.jsx'
import { materialName, siteName, useQA } from './shared.jsx'

const pct = (a, b) => (b ? `${Math.round((a / b) * 100)}%` : '—')

/** Figures calculated from the recorded inspections, NCRs and tests (session demo records). */
export default function Reports({ notify }) {
  const ctx = useQA(notify)
  const { s, today } = ctx
  const [f, setF] = useState({ project: 'all', from: '', to: '', type: 'all', inspector: 'all' })
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value })
  const inRange = (d) => (!f.from || d >= f.from) && (!f.to || d <= f.to)
  const insp = ctx.qaInspections
    .filter((x) => (f.project === 'all' || x.projectId === f.project) && inRange(x.date) && (f.type === 'all' || x.type === f.type) && (f.inspector === 'all' || Q.inspectorName(x.inspector) === f.inspector))
  const due = insp.filter((x) => x.date <= today)
  const done = insp.filter((x) => ['Passed', 'Failed', 'Conditional'].includes(x.status))
  const passed = done.filter((x) => x.status === 'Passed')
  const ncrs = s.ncrs.filter((n) => (f.project === 'all' || n.projectId === f.project) && inRange(n.reported))
  const closed = ncrs.filter((n) => Q.ncrStatus(n) === 'Closed')
  const overdue = ncrs.filter((n) => n.action && n.action.status !== 'Done' && n.action.due < today && Q.ncrStatus(n) !== 'Closed')
  const re = insp.filter((x) => x.parentId)
  const tests = s.materialTests.filter((t) => (f.project === 'all' || t.projectId === f.project) && inRange(t.sampleDate))
  const byStatus = (list, key) => Object.entries(list.reduce((m, r) => ({ ...m, [key(r)]: (m[key(r)] || 0) + 1 }), {})).map(([k, v]) => ({ id: k, k, v }))
  const trend = Object.values(ncrs.reduce((m, n) => {
    const k = `${n.projectId}|${n.reported.slice(0, 7)}`
    m[k] = m[k] || { id: k, project: projects.find((p) => p.id === n.projectId)?.name || n.projectId, month: n.reported.slice(0, 7), opened: 0, closed: 0, major: 0 }
    m[k].opened += 1
    if (Q.ncrStatus(n) === 'Closed') m[k].closed += 1
    if (n.severity !== 'Minor') m[k].major += 1
    return m
  }, {})).sort((a, b) => b.month.localeCompare(a.month) || a.project.localeCompare(b.project))
  const byActivity = byStatus(done, (x) => x.type).map((r) => ({ ...r, passed: done.filter((x) => x.type === r.k && x.status === 'Passed').length }))
  const byInspector = byStatus(done, (x) => Q.inspectorName(x.inspector)).map((r) => ({ ...r, passed: done.filter((x) => Q.inspectorName(x.inspector) === r.k && x.status === 'Passed').length }))
  const history = [...insp].sort((a, b) => b.date.localeCompare(a.date))
  const csvCols = [
    { header: 'Inspection', key: 'id' }, { header: 'Date', key: 'date' }, { header: 'Project', csv: (x) => x.projectId }, { header: 'Site', csv: (x) => siteName(x.siteId) },
    { header: 'Location', key: 'location' }, { header: 'Activity', key: 'title' }, { header: 'Type', key: 'type' }, { header: 'Inspector', key: 'inspector' },
    { header: 'Status', csv: (x) => Q.inspectionStatus(x, today) }, { header: 'Original', csv: (x) => x.parentId || '' }, { header: 'NCRs', csv: (x) => (x.ncrIds || []).join(' ') },
  ]
  return (
    <>
      <div className="info-note"><span>ℹ</span><div>Calculated from the inspection, NCR and test records in this demo session (not live analytics). Change a record and these figures change with it.</div></div>
      <div className="toolbar" style={{ marginBottom: 12 }}><div className="filters">
        <label className="field">Project<select value={f.project} onChange={set('project')}><option value="all">All</option>{projects.map((p) => <option key={p.id} value={p.id}>{p.short || p.name}</option>)}</select></label>
        <label className="field">From<input type="date" value={f.from} onChange={set('from')} /></label>
        <label className="field">To<input type="date" value={f.to} onChange={set('to')} /></label>
        <label className="field">Activity<select value={f.type} onChange={set('type')}><option value="all">All</option>{INSPECTION_TYPES.map((t) => <option key={t}>{t}</option>)}</select></label>
        <label className="field">Inspector<select value={f.inspector} onChange={set('inspector')}><option value="all">All</option>{QA_INSPECTORS.map((i) => <option key={i.name}>{i.name}</option>)}</select></label>
      </div></div>
      <StatGrid items={[
        { label: 'Inspection completion', value: pct(due.filter((x) => ['Passed', 'Failed', 'Conditional'].includes(x.status)).length, due.length), sub: `${done.length} of ${due.length} due to date` },
        { label: 'Pass / fail', value: `${passed.length} / ${done.length - passed.length}`, sub: `pass rate ${pct(passed.length, done.length)}` },
        { label: 'NCRs open / closed', value: `${ncrs.length - closed.length} / ${closed.length}`, tone: ncrs.length - closed.length ? 'warning' : undefined },
        { label: 'Corrective actions overdue', value: overdue.length, tone: overdue.length ? 'danger' : undefined },
        { label: 'Reinspections', value: re.length, sub: `${re.filter((x) => x.status === 'Passed').length} passed` },
        { label: 'Material tests', value: tests.length, sub: `${tests.filter((t) => t.status === 'Accepted').length} accepted · ${tests.filter((t) => t.status === 'Rejected').length} rejected` },
      ]} />
      <div className="grid halves">
        <Card title="By activity" bodyClass=""><DataTable dense rows={byActivity} emptyText="No completed inspections." columns={[{ key: 'k', header: 'Activity', render: (r) => r.k }, { key: 'v', header: 'Completed', align: 'num', render: (r) => r.v }, { key: 'p', header: 'Pass rate', align: 'num', render: (r) => pct(r.passed, r.v) }]} /></Card>
        <Card title="By inspector" bodyClass=""><DataTable dense rows={byInspector} emptyText="No completed inspections." columns={[{ key: 'k', header: 'Inspector', render: (r) => r.k }, { key: 'v', header: 'Completed', align: 'num', render: (r) => r.v }, { key: 'p', header: 'Pass rate', align: 'num', render: (r) => pct(r.passed, r.v) }]} /></Card>
      </div>
      <div className="grid halves section-gap">
        <Card title="Defect trend by project" sub="NCRs by month reported" bodyClass=""><DataTable dense rows={trend} emptyText="No NCRs in range." columns={[{ key: 'p', header: 'Project', render: (r) => r.project }, { key: 'm', header: 'Month', render: (r) => r.month }, { key: 'o', header: 'Raised', align: 'num', render: (r) => r.opened }, { key: 'mj', header: 'Major / critical', align: 'num', render: (r) => r.major }, { key: 'c', header: 'Closed', align: 'num', render: (r) => r.closed }]} /></Card>
        <Card title="Material test status" bodyClass=""><DataTable dense rows={byStatus(tests, (t) => t.status)} emptyText="No tests in range." columns={[{ key: 'k', header: 'Status', render: (r) => r.k }, { key: 'v', header: 'Tests', align: 'num', render: (r) => r.v }, { key: 'm', header: 'Materials', render: (r) => <span className="cell-sub wrap-cell">{tests.filter((t) => t.status === r.k).map(materialName).join(', ')}</span> }]} /></Card>
      </div>
      <Card title="Inspection history" sub="By date, project, activity and inspector" bodyClass="" className="section-gap"
        action={<button className="btn btn-sm" onClick={() => downloadCsv(`qa-inspections-${today}.csv`, csvCols, history)}>Export CSV</button>}>
        <DataTable dense rows={history} limit={40} emptyText="No inspections in range." columns={[
          { key: 'id', header: 'Inspection', render: (x) => <span className="cell-main">{x.id}</span> },
          { key: 'd', header: 'Date', render: (x) => formatDate(x.date) },
          { key: 'a', header: 'Activity', render: (x) => <span className="wrap-cell">{x.title}<div className="cell-sub">{x.type}</div></span> },
          { key: 'i', header: 'Inspector', render: (x) => x.inspector },
          { key: 's', header: 'Status', render: (x) => Q.inspectionStatus(x, today) },
          { key: 'n', header: 'NCRs', render: (x) => <span className="cell-sub">{(x.ncrIds || []).join(', ') || '—'}</span> },
        ]} />
      </Card>
    </>
  )
}
