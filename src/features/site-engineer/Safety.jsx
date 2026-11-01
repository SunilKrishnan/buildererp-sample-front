import { useState } from 'react'
import DataTable from '../../components/DataTable.jsx'
import Icon from '../../components/Icon.jsx'
import { Badge, Card } from '../../components/UI.jsx'
import { siteOf, supervisorOf } from '../../services/site.js'
import { recordStage, SAFETY_KINDS } from '../../services/safety.js'
import { MySafetyActions } from '../safety/Actions.jsx'
import { SiteRestrictions } from '../safety/links.jsx'
import { SafetyDrawers, useSafety } from '../safety/shared.jsx'
import { addDays, todayISO } from '../../utils/date.js'
import { formatDate } from '../../utils/format.js'
import { Drawer, FormError, HistoryList, Locked } from '../store-keeper/shared.jsx'
import { siteData } from './derive.js'
import { PhotoInput, PhotoStrip, projectIdOfSite, SiteSelect, useSiteEngineer } from './shared.jsx'

const SEV_TONE = { Low: 'muted', Medium: 'warning', High: 'danger', Critical: 'danger' }

function ReportForm({ ctx, onClose }) {
  const sites = ctx.mySites
  const first = sites.length === 1 ? sites[0].id : ''
  const [f, setF] = useState({ siteId: first, kind: 'Hazard', severity: 'Medium', description: '', location: '', immediateAction: '', workStopped: false, proposedAction: '', responsibleTeam: '', photos: [] })
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value })
  const high = ['High', 'Critical'].includes(f.severity) || ['Incident', 'Unsafe work'].includes(f.kind)
  return (
    <Drawer title="Report safety observation" sub="Hazards, near misses, incidents, PPE, housekeeping and access" onClose={onClose}>
      <form className="receipt-form" onSubmit={(e) => { e.preventDefault(); if (ctx.act('reportSafety', { ...f, projectId: projectIdOfSite(f.siteId) })) onClose() }} noValidate>
        <div className="receipt-grid">
          <SiteSelect value={f.siteId} sites={sites} onChange={(v) => setF({ ...f, siteId: v })} />
          <label className="field">Type<select value={f.kind} onChange={set('kind')}>{SAFETY_KINDS.map((k) => <option key={k}>{k}</option>)}</select></label>
          <label className="field">Severity<select value={f.severity} onChange={set('severity')}>{['Low', 'Medium', 'High', 'Critical'].map((k) => <option key={k}>{k}</option>)}</select></label>
          <label className="field">Location<input value={f.location} onChange={set('location')} placeholder="e.g. Tower A, ramp side" /></label>
          <label className="field span-2">What was seen<input value={f.description} onChange={set('description')} /></label>
          <label className="field span-2">Immediate action taken{high ? ' (required)' : ''}<input value={f.immediateAction} onChange={set('immediateAction')} /></label>
          <label className="check-row span-2"><input type="checkbox" checked={f.workStopped} onChange={(e) => setF({ ...f, workStopped: e.target.checked })} />Work stopped or the area made safe</label>
          <label className="field span-2">Suggested correction (the Safety Officer assigns it)<input value={f.proposedAction} onChange={set('proposedAction')} /></label>
          <label className="field">Responsible team<input value={f.responsibleTeam} onChange={set('responsibleTeam')} /></label>
          <PhotoInput value={f.photos} onChange={(photos) => setF({ ...f, photos })} label="Evidence photographs" />
        </div>
        {high && <div className="info-note warn sk-inline-note"><span>⚠</span><div><b>High priority:</b> escalated to the Project Manager on submission. Stop the unsafe work first if there is immediate danger.</div></div>}
        <div className="sk-form-foot"><FormError error={ctx.error} /><div className="jv-submit"><button className="btn btn-primary" type="submit">Report</button><button className="btn" type="button" onClick={onClose}>Cancel</button></div></div>
      </form>
    </Drawer>
  )
}

function Weather({ ctx }) {
  const sites = ctx.mySites
  const [f, setF] = useState({ siteId: sites.length === 1 ? sites[0].id : '', condition: '', restriction: '' })
  const rows = (ctx.site.state.weather || []).filter(ctx.inScope)
  return (
    <Card title="Weather-related work restrictions" sub="Stop or limit concreting, lifting and work at height when weather requires it" bodyClass="" className="mb">
      <DataTable dense rows={rows} emptyText="No weather restrictions recorded." columns={[
        { key: 'id', header: 'Ref.', render: (w) => <><div className="cell-main">{w.id}</div><div className="cell-sub">{formatDate(w.date)}</div></> },
        { key: 'c', header: 'Condition', render: (w) => <span className="wrap-cell">{w.condition}</span> },
        { key: 'r', header: 'Restriction / precautions', render: (w) => <span className="wrap-cell">{w.restriction}</span> },
        { key: 'b', header: 'Issued by', render: (w) => w.by },
        { key: 's', header: 'Status', render: (w) => <Badge tone={w.status === 'Active' ? 'warning' : 'muted'}>{w.status}</Badge> },
        { key: 'x', header: '', render: (w) => (w.status === 'Active' && ctx.perms.safety ? <button className="btn btn-sm" onClick={() => ctx.act('liftWeatherRestriction', { id: w.id })}>Lift</button> : null) },
      ]} />
      {ctx.perms.safety && (
        <form className="receipt-form" style={{ margin: 14 }} onSubmit={(e) => { e.preventDefault(); if (ctx.act('addWeatherRestriction', { ...f, projectId: projectIdOfSite(f.siteId) })) setF({ ...f, condition: '', restriction: '' }) }} noValidate>
          <div className="receipt-grid se-grid-4">
            <SiteSelect value={f.siteId} sites={sites} onChange={(v) => setF({ ...f, siteId: v })} />
            <label className="field">Condition / forecast<input value={f.condition} onChange={(e) => setF({ ...f, condition: e.target.value })} placeholder="e.g. Heavy rain from 2 pm" /></label>
            <label className="field span-2">Restricted work and precautions<input value={f.restriction} onChange={(e) => setF({ ...f, restriction: e.target.value })} placeholder="e.g. No concreting; cover cement; stop crane" /></label>
          </div>
          <div className="sk-form-foot"><FormError error={ctx.error} /><div className="jv-submit"><button className="btn" type="submit">Issue restriction</button></div></div>
        </form>
      )}
    </Card>
  )
}

export default function Safety({ notify, search }) {
  const ctx = useSiteEngineer(notify)
  const d = siteData(ctx)
  const [creating, setCreating] = useState(false)
  const [view, setView] = useState(null)
  const [show, setShow] = useState('open')
  const q = (search || '').toLowerCase()
  const urgent = d.safety.filter((x) => ['High', 'Critical'].includes(x.severity) && x.status !== 'Verified closed')
  const rows = [...d.safety]
    .filter((x) => show === 'all' || (show === 'open' ? x.status !== 'Verified closed' : x.status === show))
    .filter((x) => !q || `${x.id} ${x.kind} ${x.description}`.toLowerCase().includes(q))
    .sort((a, b) => ({ Critical: 0, High: 1, Medium: 2, Low: 3 }[a.severity] - { Critical: 0, High: 1, Medium: 2, Low: 3 }[b.severity]) || b.date.localeCompare(a.date))
  const viewing = view && d.safety.find((x) => x.id === view)
  const sctx = useSafety(notify)
  const [act, setAct] = useState(null)

  return (
    <>
      {urgent.length > 0 && (
        <div className="se-urgent" role="alert">
          <Icon name="alert" />
          <div><b>{urgent.length} high-priority safety item{urgent.length > 1 ? 's' : ''} open:</b> {urgent.map((x) => <button key={x.id} className="link-btn" onClick={() => setView(x.id)}>{x.id} {x.description}</button>).reduce((a, b) => [a, '; ', b])}</div>
        </div>
      )}
      <SiteRestrictions notify={notify} siteIds={ctx.scope.siteIds} />
      <MySafetyActions notify={notify} siteIds={ctx.scope.siteIds} />
      <Weather ctx={ctx} />
      <Card title="Safety records" sub="You report hazards and work on corrections assigned to you. The Safety Officer reviews, assigns corrections, verifies them and closes the record; high-risk items also go to the Project Manager." bodyClass=""
        action={ctx.perms.safety ? <button className="btn btn-primary btn-sm" onClick={() => setCreating(true)}><Icon name="plus" size={14} />Report</button> : <Locked>View only</Locked>}>
        <div className="toolbar"><label className="field">Show<select value={show} onChange={(e) => setShow(e.target.value)}><option value="open">Open</option><option value="all">All</option><option>Action done</option><option>Verified closed</option></select></label></div>
        <DataTable dense rows={rows} emptyText="No safety records match." columns={[
          { key: 'id', header: 'Ref.', render: (x) => <><button className="link-btn" onClick={() => setView(x.id)}>{x.id}</button><div className="cell-sub">{formatDate(x.date)}</div></> },
          { key: 'k', header: 'Type', render: (x) => x.kind },
          { key: 's', header: 'Severity', render: (x) => <Badge tone={SEV_TONE[x.severity]}>{x.severity}</Badge> },
          { key: 'd', header: 'Description', render: (x) => <span className="wrap-cell">{x.description}{x.location && <div className="cell-sub">{x.location}</div>}</span> },
          { key: 'a', header: 'Action / owner / due', render: (x) => (x.action ? <span className="wrap-cell">{x.action}<div className={`cell-sub ${x.actionDue && x.actionDue < todayISO() && x.status !== 'Verified closed' ? 'down' : ''}`}>{x.actionOwner} · {x.actionDue ? formatDate(x.actionDue) : '—'}</div></span> : '—') },
          { key: 'st', header: 'Status', render: (x) => <><Badge>{recordStage(x)}</Badge>{x.escalation && <div className="cell-sub">↑ {x.escalation}</div>}</> },
          { key: 'x', header: '', render: (x) => <button className="btn btn-sm" onClick={() => setView(x.id)}>Open</button> },
        ]} />
      </Card>
      <Card title="Safety corrective actions on your sites" sub="From the Safety Officer's register (hazards, incidents, inspections and the project safety plan)" bodyClass="" className="section-gap">
        <DataTable dense rows={(ctx.site.state.safetyActions || []).filter((a) => !a.siteId || ctx.scope.siteIds.includes(a.siteId)).filter((a) => a.status !== 'Closed')} emptyText="No open safety actions." columns={[
          { key: 'id', header: 'Ref.', render: (a) => <button className="link-btn" onClick={() => setAct(a.id)}>{a.id}</button> }, { key: 'task', header: 'Action', render: (a) => <span className="wrap-cell">{a.text}<div className="cell-sub">{a.sourceType} {a.sourceId || ''}</div></span> },
          { key: 'owner', header: 'Owner', render: (a) => a.owner }, { key: 'due', header: 'Due', render: (a) => <span className={a.due < todayISO() ? 'down' : ''}>{formatDate(a.due)}</span> }, { key: 'status', header: 'Status', render: (a) => <Badge>{a.status}</Badge> },
        ]} />
      </Card>
      {creating && <ReportForm ctx={ctx} onClose={() => setCreating(false)} />}
      <SafetyDrawers ctx={sctx} recordId={viewing ? viewing.id : null} actionId={act} onRecord={setView} onAction={setAct} />
    </>
  )
}
