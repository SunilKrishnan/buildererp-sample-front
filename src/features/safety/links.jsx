import { useState } from 'react'
import { Link } from 'react-router-dom'
import DataTable from '../../components/DataTable.jsx'
import StatGrid from '../../components/StatGrid.jsx'
import { Badge, Card } from '../../components/UI.jsx'
import * as SF from '../../services/safety.js'
import { formatDate } from '../../utils/format.js'
import { safetyFigures } from './data.js'
import { PermitBadge, PermitDrawer } from './Permits.jsx'
import { SafetyDrawers, SevBadge, siteName, useSafety } from './shared.jsx'

/**
 * Read views of the safety records for other dashboards (same records the Safety Officer uses).
 * Actions offered here are only those the viewer's role is allowed (e.g. a PM approving a permit).
 */

/** Project Manager / Admin: safety alerts, major risks, overdue actions and permits waiting for approval. */
export function SafetySummary({ notify, projectIds = null, title = 'Safety (Safety Officer records)' }) {
  const ctx = useSafety(notify)
  const f = safetyFigures(ctx.s, { projectIds })
  const [rec, setRec] = useState(null)
  const [act, setAct] = useState(null)
  const [permit, setPermit] = useState(null)
  const pending = f.permits.filter((p) => p.status === 'Pending Approval')
  const watch = [...f.highRisk, ...f.records.filter((x) => SF.isIncident(x) && x.status !== 'Verified closed' && x.kind !== 'Near miss')]
  const p = permit && ctx.s.permits.find((x) => x.id === permit)
  return (
    <Card title={title} sub="Hazards, incidents, corrective actions and permits from the shared safety records" bodyClass="" className="section-gap" action={<Link className="btn btn-sm" to="/dashboards/safety-officer">Safety dashboard</Link>}>
      <div style={{ padding: '12px 18px 0' }}>
        <StatGrid items={[
          { label: 'Open hazards', value: f.openHazards.length, sub: `${f.awaitingReview.length} awaiting Safety Officer review` },
          { label: 'High-risk open', value: f.highRisk.length, tone: f.highRisk.length ? 'danger' : undefined },
          { label: 'Overdue corrective actions', value: f.overdue.length, tone: f.overdue.length ? 'danger' : undefined },
          { label: 'Permits awaiting approval', value: pending.length, tone: pending.length ? 'warning' : undefined },
        ]} />
      </div>
      <DataTable dense rows={watch} emptyText="No major safety risks open." columns={[
        { key: 'id', header: 'Record', render: (x) => <><button className="link-btn" onClick={() => setRec(x.id)}>{x.id}</button><div className="cell-sub">{x.kind}</div></> },
        { key: 'd', header: 'Major risk', render: (x) => <span className="wrap-cell">{x.description}<div className="cell-sub">{siteName(x.siteId)}</div></span> },
        { key: 's', header: 'Severity', render: (x) => <SevBadge s={x.severity} /> },
        { key: 'st', header: 'Status', render: (x) => <Badge>{SF.recordStage(x)}</Badge> },
      ]} />
      {f.overdue.length > 0 && <DataTable dense rows={f.overdue} columns={[
        { key: 'id', header: 'Overdue action', render: (a) => <button className="link-btn" onClick={() => setAct(a.id)}>{a.id}</button> },
        { key: 't', header: 'Correction', render: (a) => <span className="wrap-cell">{a.text}</span> },
        { key: 'o', header: 'Responsible / due', render: (a) => <>{a.owner}<div className="cell-sub down">{formatDate(a.due)}</div></> },
        { key: 's', header: 'Status', render: (a) => <Badge>{a.status}</Badge> },
      ]} />}
      {pending.length > 0 && <DataTable dense rows={pending} columns={[
        { key: 'id', header: 'Permit to approve', render: (x) => <button className="link-btn" onClick={() => setPermit(x.id)}>{x.id}</button> },
        { key: 'a', header: 'Activity', render: (x) => <span className="wrap-cell">{x.type}: {x.activity}<div className="cell-sub">{x.workArea}</div></span> },
        { key: 'v', header: 'Validity', render: (x) => <span className="cell-sub">{x.validFrom.replace('T', ' ')} → {x.validTo.slice(11)}</span> },
        { key: 'x', header: '', render: (x) => <button className="btn btn-sm btn-primary" onClick={() => setPermit(x.id)}>{ctx.perms.approvePermit ? 'Review' : 'View'}</button> },
      ]} />}
      <SafetyDrawers ctx={ctx} recordId={rec} actionId={act} onRecord={setRec} onAction={setAct} />
      {p && <PermitDrawer key={p.id + p.status} p={p} ctx={ctx} onClose={() => setPermit(null)} onEdit={() => {}} />}
    </Card>
  )
}

/** Site Engineer / Supervisor: permits and safety restrictions that affect work on the site today. */
export function SiteRestrictions({ notify, siteIds }) {
  const ctx = useSafety(notify)
  const permits = (ctx.s.permits || []).filter((p) => siteIds.includes(p.siteId) && !['Closed', 'Draft'].includes(SF.permitStatus(p)))
  const high = ctx.s.safety.filter((x) => siteIds.includes(x.siteId) && SF.HIGH.includes(x.severity) && x.status !== 'Verified closed')
  if (!permits.length && !high.length) return null
  return (
    <Card title="Safety restrictions on your site" sub="Work covered by a permit may go ahead only while the permit shows Valid for work; high-risk hazards must be controlled before work continues" bodyClass="" className="mb">
      <DataTable dense rows={permits} emptyText="No current permits." columns={[
        { key: 'id', header: 'Permit', render: (p) => <><div className="cell-main">{p.id}</div><div className="cell-sub">{p.type}</div></> },
        { key: 'w', header: 'Work area / activity', render: (p) => <span className="wrap-cell">{p.workArea}<div className="cell-sub">{p.activity}</div></span> },
        { key: 'v', header: 'Validity', render: (p) => <span className="cell-sub">{p.validFrom.replace('T', ' ')} → {p.validTo.replace('T', ' ')}</span> },
        { key: 's', header: 'Status', render: (p) => <PermitBadge p={p} /> },
      ]} />
      {high.length > 0 && <div className="se-urgent" role="alert" style={{ margin: 14 }}><span>⚠</span><div><b>High-risk hazards open:</b> {high.map((x) => `${x.id} ${x.description}${x.workStopped ? ' (controlled)' : ' (control not confirmed: work must not continue)'}`).join('; ')}</div></div>}
    </Card>
  )
}
