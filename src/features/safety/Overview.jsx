import { useState } from 'react'
import DataTable from '../../components/DataTable.jsx'
import Icon from '../../components/Icon.jsx'
import SummaryCard from '../../components/SummaryCard.jsx'
import { Badge, Card } from '../../components/UI.jsx'
import * as SF from '../../services/safety.js'
import { formatDate } from '../../utils/format.js'
import { safetyFigures } from './data.js'
import { PROJECT_NAMES, SafetyDrawers, SevBadge, siteName, useSafety } from './shared.jsx'

export default function Overview({ notify, go }) {
  const ctx = useSafety(notify)
  const f = safetyFigures(ctx.s)
  const [rec, setRec] = useState(null)
  const [act, setAct] = useState(null)
  const cards = [
    { label: 'Open Hazards', value: f.openHazards.length, sub: `${f.awaitingReview.length} awaiting your review`, icon: 'alert', to: ['hazards', 'status=open'], tone: f.awaitingReview.length ? 'warning' : undefined },
    { label: 'High-Risk Hazards', value: f.highRisk.length, sub: f.highRisk.map((x) => x.id).join(', ') || 'None open', icon: 'alert', to: ['hazards', 'severity=high'], tone: f.highRisk.length ? 'danger' : undefined },
    { label: 'Inspections Due', value: f.inspectionsDue.length, sub: `${f.inspections.filter((q) => q.status === 'Scheduled' && q.date > ctx.today).length} scheduled later`, icon: 'check', to: ['inspections', 'status=due'] },
    { label: 'Overdue Corrective Actions', value: f.overdue.length, sub: `${f.awaitingVerification.length} awaiting your verification`, icon: 'trend', to: ['actions', 'status=overdue'], tone: f.overdue.length ? 'danger' : undefined },
    { label: 'Incidents This Month', value: f.monthIncidents.filter((x) => x.kind !== 'Near miss').length, sub: 'Injuries, first aid and property damage (near misses counted separately)', icon: 'clipboard', to: ['incidents'] },
    { label: 'Near Misses', value: f.nearMisses.length, sub: 'This month (no injury)', icon: 'clipboard', to: ['incidents', 'kind=Near miss'] },
    { label: 'PPE Compliance', value: f.ppeCompliance == null ? '—' : `${f.ppeCompliance}%`, sub: f.latestCheck ? `Latest field check ${formatDate(f.latestCheck.date)}: ${f.latestCheck.compliant}/${f.latestCheck.observed} seen wearing PPE` : 'No field check yet', icon: 'hardhat', to: ['ppe'], tone: f.ppeCompliance != null && f.ppeCompliance < 90 ? 'warning' : undefined },
    { label: 'Safety Training Due', value: f.trainingDue.length, sub: `${f.trainingDue.filter((t) => t.status === 'Not completed').length} not completed · ${f.trainingDue.filter((t) => t.status === 'Expired').length} expired`, icon: 'users', to: ['training'], tone: f.trainingDue.length ? 'warning' : undefined },
  ]
  const alerts = [
    ...f.highRisk.map((x) => ({ id: x.id, tone: 'danger', text: `${x.severity}: ${x.description}${x.workStopped ? '' : ' (control not yet confirmed)'}`, open: () => setRec(x.id) })),
    ...f.records.filter((x) => SF.isIncident(x) && x.status !== 'Verified closed' && x.kind !== 'Near miss').map((x) => ({ id: x.id, tone: 'danger', text: `${x.kind}: ${x.description} (${x.incidentStage})`, open: () => setRec(x.id) })),
    ...f.permits.filter((p) => SF.permitStatus(p) === 'Expired').map((p) => ({ id: p.id, tone: 'warning', text: `Permit expired, not valid for work: ${p.type} at ${p.workArea}`, open: () => go('permits') })),
    ...f.awaitingReview.map((x) => ({ id: x.id, tone: 'warning', text: `New ${x.kind.toLowerCase()} awaiting review: ${x.description}`, open: () => setRec(x.id) })),
  ]
  const projects = Object.keys(PROJECT_NAMES).map((id) => { const p = safetyFigures(ctx.s, { projectIds: [id] }); return { id, name: PROJECT_NAMES[id], open: p.openHazards.length, high: p.highRisk.length, overdue: p.overdue.length, incidents: p.incidents.filter((x) => x.status !== 'Verified closed').length, permits: p.permits.filter((x) => SF.permitStatus(x) === 'Active').length } })

  return (
    <>
      <div className="se-quick">
        <button className="btn btn-primary" onClick={() => go('hazards', 'new=1')} disabled={!ctx.perms.report}><Icon name="alert" />Report hazard</button>
        <button className="btn" onClick={() => go('incidents', 'new=1')} disabled={!ctx.perms.report}><Icon name="clipboard" />Record incident</button>
        <button className="btn" onClick={() => go('inspections', 'new=1')} disabled={!ctx.perms.manage}><Icon name="check" />Schedule inspection</button>
        <button className="btn" onClick={() => go('actions', 'new=1')} disabled={!ctx.perms.manage}><Icon name="trend" />Assign correction</button>
      </div>
      <div className="summary-grid">{cards.map((c) => <SummaryCard key={c.label} {...c} onClick={() => go(...c.to)} />)}</div>

      <div className="grid halves">
        <Card title={<span className="title-with-count">High-priority safety alerts <span className="count-pill">{alerts.length}</span></span>} sub="Shown on screen only; nothing is sent" bodyClass="">
          {alerts.length === 0 ? <div className="empty sm">No high-priority alerts.</div> : (
            <ul className="list sk-alerts">{alerts.map((a) => <li key={a.id} className="se-click" onClick={a.open}><div className={`dot-ico sk-sev-${a.tone}`}><Icon name="alert" /></div><div style={{ minWidth: 0 }}><div className="t">{a.text}</div><div className="s">{a.id}</div></div></li>)}</ul>
          )}
        </Card>
        <Card title="Today's inspection schedule" sub={formatDate(ctx.today)} bodyClass="" action={<button className="btn btn-sm" onClick={() => go('inspections')}>All inspections</button>}>
          <DataTable dense rows={f.inspections.filter((q) => q.date === ctx.today || (['Scheduled', 'In Progress'].includes(q.status) && q.date < ctx.today))} emptyText="No inspections due today." columns={[
            { key: 'id', header: 'Inspection', render: (q) => <><div className="cell-main">{q.id} · {q.category}</div><div className="cell-sub">{q.workArea}</div></> },
            { key: 'i', header: 'Inspector', render: (q) => q.inspector },
            { key: 's', header: 'Status', render: (q) => <Badge>{q.status}</Badge> },
          ]} />
        </Card>
      </div>

      <div className="grid halves">
        <Card title="Recently reported hazards" bodyClass="" action={<button className="btn btn-sm" onClick={() => go('hazards')}>All hazards</button>}>
          <DataTable dense rows={[...f.hazards].sort((a, b) => `${b.date}${b.time}`.localeCompare(`${a.date}${a.time}`)).slice(0, 6)} columns={[
            { key: 'id', header: 'Ref.', render: (x) => <><button className="link-btn" onClick={() => setRec(x.id)}>{x.id}</button><div className="cell-sub">{formatDate(x.date)}</div></> },
            { key: 'd', header: 'Hazard', render: (x) => <span className="wrap-cell">{x.description}<div className="cell-sub">{x.category} · {x.reportedBy}</div></span> },
            { key: 's', header: 'Severity', render: (x) => <SevBadge s={x.severity} /> },
            { key: 'st', header: 'Status', render: (x) => <Badge>{SF.recordStage(x)}</Badge> },
          ]} />
        </Card>
        <Card title="Overdue corrective actions" bodyClass="" action={<button className="btn btn-sm" onClick={() => go('actions', 'status=overdue')}>All actions</button>}>
          <DataTable dense rows={f.overdue} emptyText="Nothing overdue." columns={[
            { key: 'id', header: 'Action', render: (a) => <><button className="link-btn" onClick={() => setAct(a.id)}>{a.id}</button><div className="cell-sub">{a.sourceId || a.sourceType}</div></> },
            { key: 't', header: 'Correction', render: (a) => <span className="wrap-cell">{a.text}</span> },
            { key: 'o', header: 'Responsible / due', render: (a) => <>{a.owner}<div className="cell-sub down">{formatDate(a.due)}</div></> },
            { key: 's', header: 'Status', render: (a) => <Badge>{a.status}</Badge> },
          ]} />
        </Card>
      </div>

      <div className="grid halves">
        <Card title="Recent incidents & near misses" bodyClass="" action={<button className="btn btn-sm" onClick={() => go('incidents')}>All incidents</button>}>
          <DataTable dense rows={[...f.incidents].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 6)} emptyText="No incidents recorded." columns={[
            { key: 'id', header: 'Ref.', render: (x) => <><button className="link-btn" onClick={() => setRec(x.id)}>{x.id}</button><div className="cell-sub">{formatDate(x.date)}</div></> },
            { key: 'k', header: 'Type', render: (x) => <Badge tone={x.kind === 'Near miss' ? 'warning' : 'danger'}>{x.kind}</Badge> },
            { key: 'd', header: 'Description', render: (x) => <span className="wrap-cell">{x.description}</span> },
            { key: 'st', header: 'Stage', render: (x) => <Badge>{x.status === 'Verified closed' ? 'Closed' : x.incidentStage || 'Reported'}</Badge> },
          ]} />
        </Card>
        <Card title="Project-wise safety status" sub="From the safety records" bodyClass="">
          <DataTable dense rows={projects} columns={[
            { key: 'name', header: 'Project' }, { key: 'open', header: 'Open hazards', align: 'num' }, { key: 'high', header: 'High risk', align: 'num', render: (p) => (p.high ? <b className="down">{p.high}</b> : 0) },
            { key: 'overdue', header: 'Overdue actions', align: 'num' }, { key: 'incidents', header: 'Open incidents', align: 'num' }, { key: 'permits', header: 'Active permits', align: 'num' },
          ]} />
        </Card>
      </div>
      <p className="cell-sub" style={{ marginTop: 10 }}>Demo data for Sunrise Heights Apartments. Figures are calculated from the demo records in this browser session; they are not live statistics and nothing is saved to a server. Site: {siteName('S-01')}.</p>
      <SafetyDrawers ctx={ctx} recordId={rec} actionId={act} onRecord={setRec} onAction={setAct} />
    </>
  )
}
