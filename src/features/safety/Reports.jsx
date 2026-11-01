import { useState } from 'react'
import DataTable from '../../components/DataTable.jsx'
import { DemoTag } from '../../components/StateViews.jsx'
import StatGrid from '../../components/StatGrid.jsx'
import { Card } from '../../components/UI.jsx'
import * as SF from '../../services/safety.js'
import { addDays } from '../../utils/date.js'
import { downloadCsv } from '../store-keeper/shared.jsx'
import { safetyFigures } from './data.js'
import { PROJECT_NAMES, useSafety } from './shared.jsx'

const count = (rows, key) => Object.entries(rows.reduce((m, r) => { m[key(r)] = (m[key(r)] || 0) + 1; return m }, {})).map(([k, n]) => ({ key: k, k, n }))

export default function Reports({ notify }) {
  const ctx = useSafety(notify)
  const [project, setProject] = useState('all')
  const [from, setFrom] = useState(addDays(ctx.today, -89))
  const [to, setTo] = useState(ctx.today)
  const f = safetyFigures(ctx.s, { projectIds: project === 'all' ? null : [project] }, ctx.today)
  const inR = (d) => d >= from && d <= to
  const hazards = f.hazards.filter((x) => inR(x.date))
  const incidents = f.incidents.filter((x) => inR(x.date))
  const insp = f.inspections.filter((q) => ['Passed', 'Failed', 'Requires Follow-up'].includes(q.status) && inR(q.date))
  const passRate = insp.length ? Math.round((insp.filter((q) => q.status === 'Passed').length / insp.length) * 100) : null
  const trained = f.training.filter((t) => t.status === 'Valid' || t.status === 'Due soon').length
  const byMonth = count(incidents, (x) => `${x.date.slice(0, 7)} · ${x.kind === 'Near miss' ? 'Near miss' : 'Incident'}`).sort((a, b) => a.k.localeCompare(b.k))
  const sev = ['Critical', 'High', 'Medium', 'Low'].map((s) => ({ key: s, sev: s, open: hazards.filter((x) => x.severity === s && x.status !== 'Verified closed').length, closed: hazards.filter((x) => x.severity === s && x.status === 'Verified closed').length }))
  const projects = Object.keys(PROJECT_NAMES).map((id) => { const p = safetyFigures(ctx.s, { projectIds: [id] }, ctx.today); return { key: id, project: PROJECT_NAMES[id], hazards: p.hazards.filter((x) => inR(x.date)).length, high: p.highRisk.length, incidents: p.incidents.filter((x) => inR(x.date) && x.kind !== 'Near miss').length, nearMisses: p.incidents.filter((x) => inR(x.date) && x.kind === 'Near miss').length, overdue: p.overdue.length, ppe: p.ppeCompliance == null ? '—' : `${p.ppeCompliance}%` } })
  const permits = count(f.permits, (p) => SF.permitStatus(p))
  const exportAll = () => downloadCsv('safety-summary-demo.csv', [{ key: 'section', header: 'Section' }, { key: 'item', header: 'Item' }, { key: 'value', header: 'Value' }], [
    ...sev.map((r) => ({ section: 'Hazards by severity', item: r.sev, value: `${r.open} open / ${r.closed} closed` })),
    ...byMonth.map((r) => ({ section: 'Incidents by month', item: r.k, value: r.n })),
    { section: 'Inspections', item: 'Pass rate', value: passRate == null ? '' : `${passRate}%` },
    ...f.overdue.map((a) => ({ section: 'Overdue actions', item: a.id, value: `${a.owner}, due ${a.due}` })),
    { section: 'PPE', item: 'Latest field compliance', value: f.ppeCompliance == null ? '' : `${f.ppeCompliance}%` },
    { section: 'Training', item: 'Requirements valid', value: `${trained}/${f.training.length}` },
    ...permits.map((r) => ({ section: 'Permits', item: r.k, value: r.n })),
    ...projects.map((r) => ({ section: 'Projects', item: r.project, value: `${r.hazards} hazards, ${r.incidents} incidents, ${r.overdue} overdue actions` })),
  ])

  return (
    <>
      <div className="toolbar plain"><div className="filters">
        <label className="field">Project<select value={project} onChange={(e) => setProject(e.target.value)}><option value="all">All</option>{Object.entries(PROJECT_NAMES).map(([id, n]) => <option key={id} value={id}>{n}</option>)}</select></label>
        <label className="field">From<input type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value || from)} /></label>
        <label className="field">To<input type="date" value={to} max={ctx.today} onChange={(e) => setTo(e.target.value || to)} /></label>
        <div className="field" style={{ alignSelf: 'end' }}><div className="cell-actions"><DemoTag /><button className="btn btn-sm" onClick={exportAll}>Export CSV</button></div></div>
      </div></div>
      <StatGrid items={[
        { label: 'Hazards reported', value: hazards.length, sub: `${hazards.filter((x) => x.status !== 'Verified closed').length} still open` },
        { label: 'Incidents / near misses', value: `${incidents.filter((x) => x.kind !== 'Near miss').length} / ${incidents.filter((x) => x.kind === 'Near miss').length}` },
        { label: 'Inspection pass rate', value: passRate == null ? '—' : `${passRate}%`, sub: `${insp.length} inspections completed` },
        { label: 'Overdue corrective actions', value: f.overdue.length, tone: f.overdue.length ? 'danger' : undefined },
        { label: 'PPE compliance (latest check)', value: f.ppeCompliance == null ? '—' : `${f.ppeCompliance}%` },
        { label: 'Training requirements valid', value: f.training.length ? `${Math.round((trained / f.training.length) * 100)}%` : '—', sub: `${trained} of ${f.training.length}` },
      ]} />
      <div className="grid halves">
        <Card title="Hazards by severity and status" bodyClass=""><DataTable dense rows={sev} columns={[{ key: 'sev', header: 'Severity' }, { key: 'open', header: 'Open', align: 'num' }, { key: 'closed', header: 'Closed', align: 'num' }]} /></Card>
        <Card title="Incident and near-miss trend" sub="By month, in the date range" bodyClass=""><DataTable dense rows={byMonth} emptyText="None in this range." columns={[{ key: 'k', header: 'Month · type' }, { key: 'n', header: 'Count', align: 'num' }]} /></Card>
      </div>
      <div className="grid halves">
        <Card title="Overdue corrective actions" bodyClass=""><DataTable dense rows={f.overdue} emptyText="Nothing overdue." columns={[{ key: 'id', header: 'Action' }, { key: 'text', header: 'Correction' }, { key: 'owner', header: 'Responsible' }, { key: 'due', header: 'Due' }, { key: 'status', header: 'Status' }]} /></Card>
        <Card title="Permit status" bodyClass=""><DataTable dense rows={permits} columns={[{ key: 'k', header: 'Status' }, { key: 'n', header: 'Permits', align: 'num' }]} /></Card>
      </div>
      <Card title="Project-wise safety performance" sub="From the records in the date range (counts, not live statistics)" bodyClass="">
        <DataTable dense rows={projects} columns={[{ key: 'project', header: 'Project' }, { key: 'hazards', header: 'Hazards', align: 'num' }, { key: 'high', header: 'Open high risk', align: 'num' }, { key: 'incidents', header: 'Incidents', align: 'num' }, { key: 'nearMisses', header: 'Near misses', align: 'num' }, { key: 'overdue', header: 'Overdue actions', align: 'num' }, { key: 'ppe', header: 'PPE compliance', align: 'num' }]} />
      </Card>
      <p className="cell-sub" style={{ marginTop: 10 }}>All figures are calculated from the demo records in this session; they are not real or live safety statistics.</p>
    </>
  )
}
