import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import DataTable from '../../components/DataTable.jsx'
import Icon from '../../components/Icon.jsx'
import { Badge, Card } from '../../components/UI.jsx'
import { SITES } from '../../data/demo/inventoryDemo.js'
import { HAZARD_CATEGORIES } from '../../data/demo/safetyDemo.js'
import * as SF from '../../services/safety.js'
import { formatDate } from '../../utils/format.js'
import { ConfirmDialog, Drawer, FormError, Locked } from '../store-keeper/shared.jsx'
import { PhotoInput } from '../site-engineer/shared.jsx'
import { PROJECT_NAMES, SafetyDrawers, SevBadge, siteName, useSafety } from './shared.jsx'

/** Report a hazard (unsafe condition / act) or an incident. High risk needs the immediate control first. */
export function ReportForm({ ctx, incident, onClose }) {
  const [f, setF] = useState({ siteId: 'S-01', kind: incident ? 'Near miss' : 'Hazard', category: 'Scaffolding', severity: incident ? 'Medium' : 'Medium', location: '', description: '', immediateAction: '', workStopped: false, responsibleTeam: '', proposedAction: '', peopleInvolved: '', injuryDetails: '', photos: [] })
  const [confirming, setConfirming] = useState(false)
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value })
  const high = SF.HIGH.includes(f.severity) || ['Incident', 'Lost-time injury', 'Unsafe work'].includes(f.kind)
  const kinds = incident ? SF.INCIDENT_KINDS : SF.HAZARD_KINDS
  const save = () => { const ok = ctx.act('reportSafety', f); setConfirming(false); if (ok) onClose() }
  return (
    <Drawer title={incident ? 'Record an incident or near miss' : 'Report a hazard'} sub="Reference, date and time are recorded on submission" onClose={onClose} wide>
      <div className="receipt-form">
        <div className="receipt-grid">
          <label className="field">Site<select value={f.siteId} onChange={set('siteId')}>{SITES.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select></label>
          <label className="field">Type<select value={f.kind} onChange={set('kind')}>{kinds.map((k) => <option key={k}>{k}</option>)}</select></label>
          <label className="field">Category<select value={f.category} onChange={set('category')}>{HAZARD_CATEGORIES.map((k) => <option key={k}>{k}</option>)}</select></label>
          <label className="field">Risk severity<select value={f.severity} onChange={set('severity')}>{['Low', 'Medium', 'High', 'Critical'].map((k) => <option key={k}>{k}</option>)}</select></label>
          <label className="field span-2">Exact location<input value={f.location} onChange={set('location')} placeholder="e.g. Tower A, F11 north face scaffold" /></label>
          <label className="field span-2">Description<input value={f.description} onChange={set('description')} placeholder={incident ? 'What happened, to what / whom (details of people go in the restricted fields)' : 'e.g. Worker at the F10 edge without fall protection'} /></label>
          <label className="field span-2">Immediate action / response taken{high ? ' (required)' : ''}<input value={f.immediateAction} onChange={set('immediateAction')} placeholder="e.g. Work stopped, worker brought down, area barricaded" /></label>
          <label className="check-row span-2"><input type="checkbox" checked={f.workStopped} onChange={(e) => setF({ ...f, workStopped: e.target.checked })} />Work stopped or the area made safe</label>
          {incident && <>
            <label className="field">People involved (restricted)<input value={f.peopleInvolved} onChange={set('peopleInvolved')} placeholder="Names / worker IDs; seen only by safety reviewers" /></label>
            <label className="field">Injury or damage details (restricted)<input value={f.injuryDetails} onChange={set('injuryDetails')} placeholder="None for a near miss" /></label>
          </>}
          <label className="field">Responsible team<input value={f.responsibleTeam} onChange={set('responsibleTeam')} placeholder="e.g. Shuttering gang A" /></label>
          <label className="field">Suggested correction (optional)<input value={f.proposedAction} onChange={set('proposedAction')} /></label>
          <PhotoInput label="Supporting photos (optional)" value={f.photos} onChange={(photos) => setF({ ...f, photos })} />
        </div>
        {high && <div className="info-note warn sk-inline-note"><span>⚠</span><div><b>High risk:</b> stop the work and make the area safe first. It is escalated to the Safety Officer and the Project Manager; the work must not continue until it is controlled.</div></div>}
        {incident && f.kind === 'Near miss' && <p className="cell-sub" style={{ padding: '0 14px' }}>A near miss is recorded as no injury. If anyone was hurt, choose First aid, Lost-time injury or Incident.</p>}
        <div className="sk-form-foot"><FormError error={ctx.error} /><div className="jv-submit"><button className="btn btn-primary" onClick={() => setConfirming(true)}>Review & submit</button><button className="btn" onClick={onClose}>Cancel</button></div></div>
      </div>
      {confirming && (
        <ConfirmDialog title={`Report this ${f.kind.toLowerCase()}?`} confirmLabel="Report" onCancel={() => setConfirming(false)} onConfirm={save}>
          <p>{f.description || '—'} · <b>{f.severity}</b> at {f.location || siteName(f.siteId)}.</p>
          {high && !f.immediateAction && <p className="down">The immediate action is required for a high-risk report.</p>}
        </ConfirmDialog>
      )}
    </Drawer>
  )
}

/** Hazard or incident register with filters; both share the one safety register. */
export function Register({ notify, search, incident }) {
  const ctx = useSafety(notify)
  const [params, setParams] = useSearchParams()
  const [project, setProject] = useState('all')
  const [loc, setLoc] = useState('')
  const [cat, setCat] = useState('all')
  const [sev, setSev] = useState(params.get('severity') || 'all')
  const [status, setStatus] = useState(params.get('status') || 'all')
  const [kind, setKind] = useState(params.get('kind') || 'all')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [rec, setRec] = useState(params.get('open'))
  const [act, setAct] = useState(null)
  const q = `${search || ''} ${loc}`.trim().toLowerCase()
  const rows = ctx.s.safety.filter((x) => SF.isIncident(x) === incident)
    .filter((x) => (project === 'all' || x.projectId === project) && (cat === 'all' || x.category === cat) && (kind === 'all' || x.kind === kind))
    .filter((x) => sev === 'all' || (sev === 'high' ? SF.HIGH.includes(x.severity) : x.severity === sev))
    .filter((x) => status === 'all' || (status === 'open' ? x.status !== 'Verified closed' : SF.recordStage(x) === status))
    .filter((x) => (!from || x.date >= from) && (!to || x.date <= to))
    .filter((x) => !q || `${x.id} ${x.description} ${x.location} ${siteName(x.siteId)}`.toLowerCase().includes(q))
    .sort((a, b) => `${b.date}${b.time || ''}`.localeCompare(`${a.date}${a.time || ''}`))
  const stages = [...new Set(ctx.s.safety.filter((x) => SF.isIncident(x) === incident).map(SF.recordStage))]
  return (
    <>
      <Card title={incident ? 'Incident register' : 'Hazard register'} sub={incident ? 'Reporting, investigation and closure are separate steps. People and injury details are restricted to safety reviewers.' : 'Unsafe conditions and acts. High-risk hazards must be controlled before work continues.'} bodyClass=""
        action={ctx.perms.report ? <button className="btn btn-primary btn-sm" onClick={() => setParams({ new: '1' })}><Icon name="plus" size={14} />{incident ? 'Record incident' : 'Report hazard'}</button> : <Locked>View only</Locked>}>
        <div className="toolbar"><div className="filters">
          <label className="field">Project<select value={project} onChange={(e) => setProject(e.target.value)}><option value="all">All</option>{Object.entries(PROJECT_NAMES).map(([id, n]) => <option key={id} value={id}>{n}</option>)}</select></label>
          <label className="field">Location<input value={loc} onChange={(e) => setLoc(e.target.value)} placeholder="e.g. F11" /></label>
          {incident
            ? <label className="field">Type<select value={kind} onChange={(e) => setKind(e.target.value)}><option value="all">All</option>{SF.INCIDENT_KINDS.map((k) => <option key={k}>{k}</option>)}</select></label>
            : <label className="field">Category<select value={cat} onChange={(e) => setCat(e.target.value)}><option value="all">All</option>{HAZARD_CATEGORIES.map((k) => <option key={k}>{k}</option>)}</select></label>}
          <label className="field">Severity<select value={sev} onChange={(e) => setSev(e.target.value)}><option value="all">All</option><option value="high">High & critical</option>{['Low', 'Medium', 'High', 'Critical'].map((k) => <option key={k}>{k}</option>)}</select></label>
          <label className="field">Status<select value={status} onChange={(e) => setStatus(e.target.value)}><option value="all">All</option><option value="open">Open</option>{stages.map((k) => <option key={k}>{k}</option>)}</select></label>
          <label className="field">From<input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></label>
          <label className="field">To<input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></label>
        </div></div>
        <DataTable dense rows={rows} emptyText="No records match these filters." columns={[
          { key: 'id', header: incident ? 'Incident ID' : 'Hazard ID', render: (x) => <><button className="link-btn" onClick={() => setRec(x.id)}>{x.id}</button><div className="cell-sub">{formatDate(x.date)} {x.time || ''}</div></> },
          { key: 'p', header: 'Project / location', render: (x) => <>{siteName(x.siteId)}<div className="cell-sub">{x.location || '—'}</div></> },
          { key: 'c', header: incident ? 'Type' : 'Category', render: (x) => (incident ? <Badge tone={x.kind === 'Near miss' ? 'warning' : 'danger'}>{x.kind}</Badge> : x.category) },
          { key: 'd', header: 'Description', render: (x) => <span className="wrap-cell">{x.description}{x.linkedNcr && <div className="cell-sub">Linked quality NCR {x.linkedNcr}</div>}</span> },
          { key: 'r', header: 'Reported by', render: (x) => <>{x.reportedBy}<div className="cell-sub">{x.reporterRole || ''}</div></> },
          { key: 's', header: 'Severity', render: (x) => <SevBadge s={x.severity} /> },
          { key: 'i', header: 'Immediate action', render: (x) => <span className="cell-sub wrap-cell">{x.immediateAction || '—'}{SF.HIGH.includes(x.severity) && !x.workStopped && x.status !== 'Verified closed' ? <div className="down">Control not confirmed</div> : null}</span> },
          { key: 't', header: incident ? 'Investigation' : 'Responsible / target', render: (x) => (incident ? <Badge>{x.incidentStage || 'Reported'}</Badge> : <span className="cell-sub">{x.actionOwner || x.responsibleTeam || '—'}{x.actionDue ? ` · ${formatDate(x.actionDue)}` : ''}</span>) },
          { key: 'st', header: 'Status', render: (x) => <Badge>{SF.recordStage(x)}</Badge> },
        ]} />
      </Card>
      {params.get('new') === '1' && <ReportForm ctx={ctx} incident={incident} onClose={() => setParams({})} />}
      <SafetyDrawers ctx={ctx} recordId={rec} actionId={act} onRecord={setRec} onAction={setAct} />
    </>
  )
}

export default function Hazards(props) { return <Register {...props} incident={false} /> }
