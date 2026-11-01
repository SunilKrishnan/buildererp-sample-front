import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import DataTable from '../../components/DataTable.jsx'
import Icon from '../../components/Icon.jsx'
import { Badge, Card } from '../../components/UI.jsx'
import { siteOf } from '../../services/site.js'
import { addDays, todayISO } from '../../utils/date.js'
import { formatDate } from '../../utils/format.js'
import { ConfirmDialog, Drawer, FormError, HistoryList, Locked } from '../store-keeper/shared.jsx'
import { PhotoInput, PhotoStrip } from '../site-engineer/shared.jsx'
import { engineerOf, shortName, supData, useSupervisor } from './shared.jsx'
import { HAZARD_CATEGORIES } from '../../data/demo/safetyDemo.js'
import { recordStage } from '../../services/safety.js'
import { MySafetyActions } from '../safety/Actions.jsx'
import { SafetyDrawers, useSafety } from '../safety/shared.jsx'

// Observations (unsafe acts / conditions) are kept apart from confirmed incidents
const KINDS = [
  { kind: 'Hazard', label: 'Hazard (unsafe condition, e.g. scaffold, edge, electrical)' },
  { kind: 'Safety observation', label: 'Safety observation (unsafe condition)' },
  { kind: 'PPE compliance', label: 'PPE not worn / unsafe act' },
  { kind: 'Housekeeping', label: 'Housekeeping' },
  { kind: 'Near miss', label: 'Near miss (no injury)' },
  { kind: 'Incident', label: 'Incident: confirmed accident or injury' },
]

function SafetyForm({ ctx, onClose }) {
  const siteId = ctx.mySites[0]?.id || ''
  const [f, setF] = useState({ siteId, kind: 'Hazard', category: 'Scaffolding', location: '', description: '', severity: 'Medium', immediateAction: '', workStopped: false, proposedAction: '', responsibleTeam: '', photos: [] })
  const [confirming, setConfirming] = useState(false)
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value })
  const incident = f.kind === 'Incident'
  const high = incident || ['High', 'Critical'].includes(f.severity)
  const save = () => { const ok = ctx.act('reportSafety', { ...f, projectId: siteOf(f.siteId)?.project === 'Palm Grove Villas' ? 'P-102' : 'P-101' }); setConfirming(false); if (ok) onClose() }
  return (
    <Drawer title="Report a hazard or safety observation" sub="Goes to the Safety Officer for review; the Site Engineer is informed, and high severity and incidents also go to the Project Manager" onClose={onClose}>
      <div className="receipt-form">
        <div className="receipt-grid">
          <label className="field">Site<select value={f.siteId} onChange={set('siteId')}>{ctx.mySites.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select></label>
          <label className="field">Type<select value={f.kind} onChange={set('kind')}>{KINDS.map((k) => <option key={k.kind} value={k.kind}>{k.label}</option>)}</select></label>
          <label className="field">Category<select value={f.category} onChange={set('category')}>{HAZARD_CATEGORIES.map((x) => <option key={x}>{x}</option>)}</select></label>
          <label className="field">Location<input value={f.location} onChange={set('location')} placeholder="e.g. Tower A, F11 north face scaffold" /></label>
          <label className="field">Severity<select value={f.severity} onChange={set('severity')}>{['Low', 'Medium', 'High', 'Critical'].map((x) => <option key={x}>{x}</option>)}</select></label>
          <label className="field span-2">Description<input value={f.description} onChange={set('description')} placeholder="e.g. 4 workers carrying bricks at F10 without helmets" /></label>
          <label className="field span-2">Immediate action taken{high ? ' (required)' : ''}<input value={f.immediateAction} onChange={set('immediateAction')} placeholder="e.g. Carpenters moved off the scaffold; area taped off" /></label>
          <label className="check-row span-2"><input type="checkbox" checked={f.workStopped} onChange={(e) => setF({ ...f, workStopped: e.target.checked })} />Work stopped or the area made safe</label>
          <label className="field span-2">Suggested correction (the Safety Officer assigns it)<input value={f.proposedAction} onChange={set('proposedAction')} placeholder="e.g. Re-fix boards and guard rail; re-tag the scaffold" /></label>
          <label className="field">Responsible team<input value={f.responsibleTeam} onChange={set('responsibleTeam')} placeholder="e.g. Shuttering gang A" /></label>
          <PhotoInput label="Photo evidence (optional)" value={f.photos} onChange={(photos) => setF({ ...f, photos })} />
        </div>
        {incident && <div className="info-note warn sk-inline-note"><span>⚠</span><div>An <b>incident</b> is a confirmed accident or injury. It is escalated to the Project Manager. Give first aid and inform the Site Engineer by phone first; this record does not replace that.</div></div>}
        <div className="sk-form-foot">
          <FormError error={ctx.error} />
          <div className="jv-submit"><button className="btn btn-primary" onClick={() => setConfirming(true)}>Review & report</button><button className="btn" onClick={onClose}>Cancel</button></div>
          {high && <p className="down">High risk: stop the work and make the area safe first; it must not continue until controlled.</p>}
          <p className="cell-sub">Reporting does not close anything: the Safety Officer reviews it, assigns the correction and verifies it before closing.</p>
        </div>
      </div>
      {confirming && (
        <ConfirmDialog title={`Report this ${incident ? 'incident' : 'observation'}?`} confirmLabel="Report" onCancel={() => setConfirming(false)} onConfirm={save}>
          <p>{f.description || '—'} · {f.severity}. Goes to the Safety Officer and {engineerOf(f.siteId)} (Site Engineer){high ? ', and the Project Manager' : ''}.</p>
        </ConfirmDialog>
      )}
    </Drawer>
  )
}

export default function Safety({ notify }) {
  const ctx = useSupervisor(notify)
  const sctx = useSafety(notify)
  const [act, setAct] = useState(null)
  const d = supData(ctx)
  const [params, setParams] = useSearchParams()
  const [status, setStatus] = useState(params.get('status') || 'all')
  const [view, setView] = useState(null)
  const rows = [...d.safety].filter((x) => status === 'all' || (status === 'open' ? ['Open', 'Action in progress'].includes(x.status) : x.status === status)).sort((a, b) => b.date.localeCompare(a.date))
  const viewing = view && d.safety.find((x) => x.id === view)
  return (
    <>
      <MySafetyActions notify={notify} siteIds={ctx.scope.siteIds} />
      <Card title="Safety observations & incidents" sub="Observations are unsafe acts or conditions; incidents are confirmed accidents. A report does not resolve anything by itself." bodyClass=""
        action={ctx.perms.safety ? <button className="btn btn-primary btn-sm" onClick={() => setParams({ new: '1' })}><Icon name="plus" size={14} />Record observation</button> : <Locked>View only</Locked>}>
        <div className="toolbar"><label className="field">Status<select value={status} onChange={(e) => setStatus(e.target.value)}><option value="all">All</option><option value="open">Requiring action</option>{['Open', 'Action in progress', 'Action done', 'Verified closed'].map((x) => <option key={x}>{x}</option>)}</select></label></div>
        <DataTable dense rows={rows} emptyText="No safety records." columns={[
          { key: 'id', header: 'Ref.', render: (x) => <><button className="link-btn" onClick={() => setView(x.id)}>{x.id}</button><div className="cell-sub">{formatDate(x.date)}</div></> },
          { key: 'k', header: 'Type', render: (x) => <Badge tone={x.kind === 'Incident' ? 'danger' : 'muted'}>{x.kind}</Badge> },
          { key: 'l', header: 'Location', render: (x) => x.location || shortName(siteOf(x.siteId)?.name) },
          { key: 'd', header: 'Description', render: (x) => <span className="wrap-cell">{x.description}</span> },
          { key: 's', header: 'Severity', render: (x) => <Badge>{x.severity}</Badge> },
          { key: 'i', header: 'Immediate action', render: (x) => <span className="cell-sub wrap-cell">{x.immediateAction || '—'}</span> },
          { key: 'r', header: 'Responsible', render: (x) => x.actionOwner || '—' },
          { key: 'st', header: 'Status', render: (x) => <Badge>{recordStage(x)}</Badge> },
        ]} />
      </Card>
      {params.get('new') === '1' && <SafetyForm ctx={ctx} onClose={() => setParams({})} />}
      <SafetyDrawers ctx={sctx} recordId={view} actionId={act} onRecord={setView} onAction={setAct} />
    </>
  )
}
