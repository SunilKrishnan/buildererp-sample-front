import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import DataTable from '../../components/DataTable.jsx'
import Icon from '../../components/Icon.jsx'
import { Badge, Card } from '../../components/UI.jsx'
import * as SF from '../../services/safety.js'
import { formatDate } from '../../utils/format.js'
import { Drawer, FormError, Locked } from '../store-keeper/shared.jsx'
import { AssignAction, SafetyDrawers, siteName, useSafety } from './shared.jsx'

/** Assign a correction from an open hazard, incident or failed inspection. */
function NewAction({ ctx, onClose }) {
  const sources = [
    ...ctx.s.safety.filter((x) => x.status !== 'Verified closed' && x.reviewedBy).map((x) => ({ type: SF.isIncident(x) ? 'Incident' : 'Hazard', id: x.id, siteId: x.siteId, label: `${x.id} · ${x.description}`, proposed: x.proposedAction })),
    ...(ctx.s.safetyInspections || []).filter((q) => ['Failed', 'Requires Follow-up'].includes(q.status)).map((q) => ({ type: 'Inspection', id: q.id, siteId: q.siteId, label: `${q.id} · ${q.category}: ${q.findings}` })),
  ]
  const [src, setSrc] = useState(sources[0]?.id || '')
  const s = sources.find((x) => x.id === src)
  return (
    <Drawer title="Assign a corrective action" sub="From a reviewed hazard or incident, or a failed inspection" onClose={onClose}>
      <label className="field">Linked record<select value={src} onChange={(e) => setSrc(e.target.value)}>{sources.map((x) => <option key={x.id} value={x.id}>{x.type}: {x.label}</option>)}</select></label>
      {s ? <div style={{ marginTop: 10 }}><AssignAction key={s.id} ctx={ctx} sourceType={s.type} sourceId={s.id} siteId={s.siteId} defaultText={s.proposed || ''} onDone={onClose} /></div> : <p className="cell-sub">Nothing open to correct. Review a hazard first.</p>}
      <FormError error={ctx.error} />
    </Drawer>
  )
}

export default function Actions({ notify, search }) {
  const ctx = useSafety(notify)
  const [params, setParams] = useSearchParams()
  const [status, setStatus] = useState(params.get('status') || 'open')
  const [src, setSrc] = useState('all')
  const [act, setAct] = useState(params.get('open'))
  const [rec, setRec] = useState(null)
  const q = (search || '').toLowerCase()
  const rows = (ctx.s.safetyActions || [])
    .filter((a) => status === 'all' || (status === 'open' ? a.status !== 'Closed' : status === 'overdue' ? SF.caOverdue(a, ctx.today) : status === 'mine' ? a.owner === ctx.user.name : a.status === status))
    .filter((a) => src === 'all' || a.sourceType === src)
    .filter((a) => !q || `${a.id} ${a.text} ${a.owner} ${a.sourceId}`.toLowerCase().includes(q))
    .sort((a, b) => a.due.localeCompare(b.due))
  return (
    <>
      <Card title="Corrective actions" sub="The responsible person submits evidence; an authorised verifier checks it on site before the action closes" bodyClass=""
        action={ctx.perms.manage ? <button className="btn btn-primary btn-sm" onClick={() => setParams({ new: '1' })}><Icon name="plus" size={14} />Assign correction</button> : <Locked>View only</Locked>}>
        <div className="toolbar"><div className="filters">
          <label className="field">Status<select value={status} onChange={(e) => setStatus(e.target.value)}><option value="open">Open</option><option value="overdue">Overdue</option><option value="mine">Assigned to me</option><option value="all">All</option>{SF.CA_STATUSES.map((s) => <option key={s}>{s}</option>)}</select></label>
          <label className="field">Linked to<select value={src} onChange={(e) => setSrc(e.target.value)}><option value="all">All</option>{['Hazard', 'Incident', 'Inspection', 'Safety plan task'].map((s) => <option key={s}>{s}</option>)}</select></label>
        </div></div>
        <DataTable dense rows={rows} emptyText="No corrective actions match." columns={[
          { key: 'id', header: 'Action ID', render: (a) => <button className="link-btn" onClick={() => setAct(a.id)}>{a.id}</button> },
          { key: 'l', header: 'Linked record', render: (a) => (a.sourceId && a.sourceType !== 'Inspection' ? <button className="link-btn" onClick={() => setRec(a.sourceId)}>{a.sourceType} {a.sourceId}</button> : <span className="cell-sub">{a.sourceType} {a.sourceId || ''}</span>) },
          { key: 't', header: 'Required correction', render: (a) => <span className="wrap-cell">{a.text}<div className="cell-sub">{siteName(a.siteId)}</div></span> },
          { key: 'o', header: 'Responsible', render: (a) => <>{a.owner}<div className="cell-sub">{a.ownerRole}</div></> },
          { key: 'p', header: 'Priority', render: (a) => <Badge>{a.priority}</Badge> },
          { key: 'd', header: 'Target date', render: (a) => <span className={SF.caOverdue(a, ctx.today) ? 'down' : ''}>{formatDate(a.due)}</span> },
          { key: 'n', header: 'Progress / evidence', render: (a) => <span className="cell-sub wrap-cell">{(a.evidence.slice(-1)[0] || a.notes.slice(-1)[0])?.text || '—'}</span> },
          { key: 's', header: 'Verification status', render: (a) => <><Badge>{a.status}</Badge>{a.verifiedBy && <div className="cell-sub">{a.verifiedBy}{a.closedAt ? ` · ${formatDate(a.closedAt.slice(0, 10))}` : ''}</div>}</> },
        ]} />
      </Card>
      {params.get('new') === '1' && <NewAction ctx={ctx} onClose={() => setParams({})} />}
      <SafetyDrawers ctx={ctx} recordId={rec} actionId={act} onRecord={setRec} onAction={setAct} />
    </>
  )
}

/** Compact "my corrective actions" card for other dashboards (Site Supervisor, Site Engineer). */
export function MySafetyActions({ notify, siteIds }) {
  const ctx = useSafety(notify)
  const [act, setAct] = useState(null)
  const rows = (ctx.s.safetyActions || []).filter((a) => a.owner === ctx.user.name && a.status !== 'Closed' && (!siteIds || !a.siteId || siteIds.includes(a.siteId)))
  return (
    <Card title={<span className="title-with-count">Safety corrections assigned to you <span className="count-pill">{rows.length}</span></span>} sub="Assigned by the Safety Officer. Submit evidence when done; the Safety Officer verifies before closing." bodyClass="" className="mb">
      <DataTable dense rows={rows} emptyText="No safety corrections assigned to you." columns={[
        { key: 'id', header: 'Action', render: (a) => <><button className="link-btn" onClick={() => setAct(a.id)}>{a.id}</button><div className="cell-sub">{a.sourceType} {a.sourceId || ''}</div></> },
        { key: 't', header: 'Correction', render: (a) => <span className="wrap-cell">{a.text}{a.returnNote && a.status === 'Returned for Correction' && <div className="cell-sub down">Returned: {a.returnNote}</div>}</span> },
        { key: 'd', header: 'Due', render: (a) => <span className={SF.caOverdue(a, ctx.today) ? 'down' : ''}>{formatDate(a.due)}</span> },
        { key: 's', header: 'Status', render: (a) => <Badge>{a.status}</Badge> },
        { key: 'x', header: '', render: (a) => <button className="btn btn-sm btn-primary" onClick={() => setAct(a.id)}>{['Assigned', 'In Progress', 'Returned for Correction'].includes(a.status) ? 'Update / evidence' : 'View'}</button> },
      ]} />
      <SafetyDrawers ctx={ctx} recordId={null} actionId={act} onRecord={() => {}} onAction={setAct} />
    </Card>
  )
}
