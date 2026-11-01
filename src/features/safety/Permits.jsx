import { useState } from 'react'
import DataTable from '../../components/DataTable.jsx'
import Icon from '../../components/Icon.jsx'
import { Badge, Card } from '../../components/UI.jsx'
import { SITES } from '../../data/demo/inventoryDemo.js'
import { PERMIT_TYPES } from '../../data/demo/safetyDemo.js'
import * as SF from '../../services/safety.js'
import { pmOf, supervisorOf } from '../../services/site.js'
import { addDays, todayISO } from '../../utils/date.js'
import { ConfirmDialog, Drawer, fmtStamp, FormError, HistoryList, Locked } from '../store-keeper/shared.jsx'
import { siteName, useSafety } from './shared.jsx'

const TONE = { Active: 'success', Approved: 'info', 'Pending Approval': 'warning', Draft: 'muted', Suspended: 'danger', Expired: 'danger', Closed: 'muted' }
export const PermitBadge = ({ p }) => { const st = SF.permitStatus(p); return <><Badge tone={TONE[st]}>{st}</Badge>{SF.permitValidNow(p) ? <div className="cell-sub up">Valid for work now</div> : <div className="cell-sub down">Not valid for work</div>}</> }

function PermitForm({ ctx, permit, onClose }) {
  const t = addDays(todayISO(), 1)
  const [f, setF] = useState(permit ? { ...permit, precautions: permit.precautions.join('\n') } : { type: 'Work at height', siteId: 'S-01', workArea: '', activity: '', hazards: '', precautions: '', validFrom: `${t}T08:00`, validTo: `${t}T18:00`, supervisor: supervisorOf('S-01') })
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value })
  return (
    <Drawer title={permit ? `Edit draft ${permit.id}` : 'New permit to work'} sub="Drafts and unapproved permits are not valid for work" onClose={onClose} wide>
      <div className="receipt-form">
        <div className="receipt-grid">
          <label className="field">Activity type<select value={f.type} onChange={set('type')}>{PERMIT_TYPES.map((x) => <option key={x}>{x}</option>)}</select></label>
          <label className="field">Site<select value={f.siteId} onChange={(e) => setF({ ...f, siteId: e.target.value, supervisor: supervisorOf(e.target.value) || '' })}>{SITES.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select></label>
          <label className="field span-2">Work area<input value={f.workArea} onChange={set('workArea')} /></label>
          <label className="field span-2">Activity<input value={f.activity} onChange={set('activity')} /></label>
          <label className="field span-2">Hazard assessment<input value={f.hazards} onChange={set('hazards')} placeholder="Hazards of this job in this place" /></label>
          <label className="field span-2">Required precautions (one per line)<textarea rows={4} value={f.precautions} onChange={set('precautions')} /></label>
          <label className="field">Valid from<input type="datetime-local" value={f.validFrom} onChange={set('validFrom')} /></label>
          <label className="field">Valid to<input type="datetime-local" value={f.validTo} onChange={set('validTo')} /></label>
          <label className="field">Responsible supervisor<input value={f.supervisor} onChange={set('supervisor')} /></label>
          <div className="field">Authorised approver<div className="sk-readonly">{pmOf(f.siteId === 'S-03' ? 'P-102' : 'P-101')} (Project Manager)</div></div>
        </div>
        <div className="sk-form-foot"><FormError error={ctx.error} /><div className="jv-submit"><button className="btn btn-primary" onClick={() => ctx.act('savePermit', { ...f, precautions: f.precautions.split('\n') }) && onClose()}>Save draft</button><button className="btn" onClick={onClose}>Cancel</button></div></div>
      </div>
    </Drawer>
  )
}

export function PermitDrawer({ p, ctx, onClose, onEdit }) {
  const [note, setNote] = useState('')
  const [checked, setChecked] = useState(false)
  const [confirm, setConfirm] = useState(null)
  const st = SF.permitStatus(p)
  const run = (name, args) => { setConfirm(null); return ctx.act(name, { id: p.id, ...args }) && (setNote(''), setChecked(false)) }
  const canApprove = ctx.perms.approvePermit && p.preparedBy !== ctx.user.name && (ctx.role.id !== 'projectmanager' || pmOf(p.projectId) === ctx.user.name)
  return (
    <Drawer title={`${p.id} · ${p.type}`} sub={`${siteName(p.siteId)} · ${p.workArea}`} onClose={onClose} wide>
      {['Expired', 'Suspended'].includes(st) && <div className="se-urgent" role="alert"><span>⚠</span><div><b>{st}: not valid for work.</b> Work under this permit must not continue.</div></div>}
      <dl className="details">
        <dt>Status</dt><dd><PermitBadge p={p} /></dd>
        <dt>Activity</dt><dd>{p.activity}</dd>
        <dt>Hazard assessment</dt><dd>{p.hazards}</dd>
        <dt>Precautions</dt><dd><ul style={{ margin: 0, paddingLeft: 18 }}>{p.precautions.map((x) => <li key={x}>{x}</li>)}</ul></dd>
        <dt>Validity</dt><dd>{p.validFrom.replace('T', ' ')} → {p.validTo.replace('T', ' ')}</dd>
        <dt>Responsible supervisor</dt><dd>{p.supervisor}</dd>
        <dt>Prepared / approved</dt><dd>{p.preparedBy} · {p.approver ? `approved by ${p.approver}, ${fmtStamp(p.approvedAt)}` : `approver: ${pmOf(p.projectId)} (Project Manager)`}</dd>
        {p.closure && <><dt>Closure / handover</dt><dd>{p.closure.handover} ({p.closure.by}, {fmtStamp(p.closure.at)})</dd></>}
      </dl>
      <section className="drawer-section">
        {st === 'Draft' && (ctx.perms.manage ? <div className="cell-actions"><button className="btn btn-sm" onClick={onEdit}>Edit draft</button><button className="btn btn-sm btn-primary" onClick={() => run('submitPermit')}>Submit for approval</button></div> : <Locked>Prepared by the Safety Officer</Locked>)}
        {st === 'Pending Approval' && (canApprove ? <>
          <label className="field">Note (required to return)<input value={note} onChange={(e) => setNote(e.target.value)} /></label>
          <div className="cell-actions" style={{ marginTop: 8 }}><button className="btn btn-sm btn-primary" onClick={() => setConfirm('approve')}>Approve permit</button><button className="btn btn-sm" onClick={() => run('decidePermit', { approve: false, note })}>Return to draft</button></div>
        </> : <Locked>{p.preparedBy === ctx.user.name ? 'You prepared it; the authorised approver decides' : `Waiting for ${pmOf(p.projectId)} (Project Manager)`}</Locked>)}
        {st === 'Approved' && ctx.perms.manage && <>
          <label className="check-row"><input type="checkbox" checked={checked} onChange={(e) => setChecked(e.target.checked)} />I have checked every precaution is in place on site</label>
          <button className="btn btn-sm btn-primary" style={{ marginTop: 8 }} onClick={() => run('activatePermit', { checked })}>Activate permit</button>
        </>}
        {st === 'Suspended' && ctx.perms.manage && <>
          <label className="field">What was corrected<input value={note} onChange={(e) => setNote(e.target.value)} /></label>
          <label className="check-row"><input type="checkbox" checked={checked} onChange={(e) => setChecked(e.target.checked)} />Precautions back in place</label>
          <button className="btn btn-sm btn-primary" style={{ marginTop: 8 }} onClick={() => run('resumePermit', { note, checked })}>Resume</button>
        </>}
        {['Active', 'Approved'].includes(st) && (ctx.perms.manage || ctx.perms.approvePermit) && <>
          <label className="field" style={{ marginTop: 8 }}>Reason to suspend<input value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Fire watch absent" /></label>
          <button className="btn btn-sm" style={{ marginTop: 8 }} onClick={() => run('suspendPermit', { note })}>Suspend (stop work)</button>
        </>}
        {['Active', 'Approved', 'Expired', 'Suspended'].includes(st) && ctx.perms.manage && <>
          <label className="field" style={{ marginTop: 8 }}>Closure and handover<input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Area left safe; handed to …" /></label>
          <button className="btn btn-sm" style={{ marginTop: 8 }} onClick={() => run('closePermit', { handover: note })}>Close permit</button>
        </>}
        <FormError error={ctx.error} />
      </section>
      <section className="drawer-section"><h3>History</h3><HistoryList items={p.history} /></section>
      {confirm === 'approve' && <ConfirmDialog title={`Approve ${p.id}?`} confirmLabel="Approve" onCancel={() => setConfirm(null)} onConfirm={() => run('decidePermit', { approve: true, note })}><p>{p.type}: {p.activity}. The Safety Officer activates it on site after checking the precautions.</p></ConfirmDialog>}
    </Drawer>
  )
}

export default function Permits({ notify }) {
  const ctx = useSafety(notify)
  const [status, setStatus] = useState('all')
  const [open, setOpen] = useState(null)
  const [form, setForm] = useState(null)
  const rows = (ctx.s.permits || []).filter((p) => status === 'all' || SF.permitStatus(p) === status).sort((a, b) => b.validFrom.localeCompare(a.validFrom))
  const current = open && ctx.s.permits.find((p) => p.id === open)
  return (
    <>
      <Card title="Permits to work" sub="Prepared by the Safety Officer, approved by the project's Project Manager (or Admin), activated on site. Expired, suspended and unapproved permits are never valid for work." bodyClass=""
        action={ctx.perms.manage ? <button className="btn btn-primary btn-sm" onClick={() => setForm('new')}><Icon name="plus" size={14} />New permit</button> : null}>
        <div className="toolbar"><label className="field">Status<select value={status} onChange={(e) => setStatus(e.target.value)}><option value="all">All</option>{['Draft', 'Pending Approval', 'Approved', 'Active', 'Suspended', 'Expired', 'Closed'].map((x) => <option key={x}>{x}</option>)}</select></label></div>
        <DataTable dense rows={rows} emptyText="No permits." columns={[
          { key: 'id', header: 'Permit ID', render: (p) => <button className="link-btn" onClick={() => setOpen(p.id)}>{p.id}</button> },
          { key: 'w', header: 'Project / work area', render: (p) => <>{siteName(p.siteId)}<div className="cell-sub">{p.workArea}</div></> },
          { key: 'a', header: 'Activity', render: (p) => <span className="wrap-cell"><b>{p.type}</b><div className="cell-sub">{p.activity}</div></span> },
          { key: 's', header: 'Supervisor', render: (p) => p.supervisor },
          { key: 'v', header: 'Validity', render: (p) => <span className="cell-sub">{p.validFrom.replace('T', ' ')} → {p.validTo.slice(11)}{p.validTo.slice(0, 10) !== p.validFrom.slice(0, 10) ? ` (${p.validTo.slice(0, 10)})` : ''}</span> },
          { key: 'ap', header: 'Approver', render: (p) => p.approver || <span className="cell-sub">{pmOf(p.projectId)} (pending)</span> },
          { key: 'st', header: 'Status', render: (p) => <PermitBadge p={p} /> },
        ]} />
      </Card>
      {form && <PermitForm ctx={ctx} permit={form === 'new' ? null : form} onClose={() => setForm(null)} />}
      {current && !form && <PermitDrawer key={current.id + current.status} p={current} ctx={ctx} onClose={() => setOpen(null)} onEdit={() => setForm(current)} />}
    </>
  )
}
