import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import DataTable from '../../components/DataTable.jsx'
import Icon from '../../components/Icon.jsx'
import { Badge, Card } from '../../components/UI.jsx'
import { sites } from '../../data/mockData.js'
import * as Q from '../../services/qa.js'
import { formatDate } from '../../utils/format.js'
import { PhotoInput, PhotoStrip } from '../site-engineer/shared.jsx'
import { Drawer, FormError, HistoryList, Locked, fmtStamp } from '../store-keeper/shared.jsx'
import { docRefLabel, printRecord, siteName, useQA } from './shared.jsx'

const SITE_PROJECT = { 'S-01': 'P-101', 'S-02': 'P-101', 'S-03': 'P-102' }

function NewNcr({ ctx, onClose }) {
  const [f, setF] = useState({ siteId: 'S-01', location: '', category: 'Other', severity: 'Major', description: '', responsible: '', requiredAction: '', target: '', drawingRef: '', reinspectionRequired: true, photos: [] })
  const resp = Q.responsibleOptions(f.siteId, SITE_PROJECT[f.siteId])
  const set = (k) => (e) => setF({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value })
  const role = resp.find((r) => r.name === (f.responsible || resp[0]?.name))?.role
  return (
    <Drawer title="Record defect / NCR" sub="For defects found outside a scheduled inspection (failed inspections raise their NCR automatically)" onClose={() => { ctx.setError(''); onClose() }}>
      <div className="receipt-form">
        <div className="receipt-grid">
          <label className="field">Site<select value={f.siteId} onChange={set('siteId')}>{sites.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select></label>
          <label className="field">Work location<input value={f.location} onChange={set('location')} placeholder="Tower, floor, grid" /></label>
          <label className="field">Category<select value={f.category} onChange={set('category')}>{Q.DEFECT_CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select></label>
          <label className="field">Severity<select value={f.severity} onChange={set('severity')}>{Q.SEVERITIES.map((c) => <option key={c}>{c}</option>)}</select></label>
          <label className="field span-2">Description<input value={f.description} onChange={set('description')} /></label>
          <label className="field">Drawing / spec<select value={f.drawingRef} onChange={set('drawingRef')}><option value="">—</option>{ctx.s.documents.map((d) => <option key={d.id} value={d.id}>{docRefLabel(ctx.s, d.id)}</option>)}</select></label>
          <label className="field">Responsible<select value={f.responsible || resp[0]?.name || ''} onChange={set('responsible')}>{resp.map((r) => <option key={r.name} value={r.name}>{r.name} ({r.role})</option>)}</select></label>
          <label className="field span-2">Required corrective action<input value={f.requiredAction} onChange={set('requiredAction')} /></label>
          <label className="field">Target date<input type="date" min={ctx.today} value={f.target} onChange={set('target')} /></label>
          <label className="check-row"><input type="checkbox" checked={f.reinspectionRequired} onChange={set('reinspectionRequired')} /> Reinspection required before closure</label>
          <PhotoInput value={f.photos} onChange={(photos) => setF({ ...f, photos })} label="Supporting photographs" />
        </div>
        <div className="sk-form-foot"><FormError error={ctx.error} /><div className="jv-submit"><button className="btn btn-primary" onClick={() => ctx.act('createNcr', { ...f, projectId: SITE_PROJECT[f.siteId], responsible: f.responsible || resp[0]?.name, responsibleRole: role }) && onClose()}>Raise NCR</button><button className="btn" onClick={onClose}>Cancel</button></div></div>
      </div>
    </Drawer>
  )
}

export function NcrDrawer({ ctx, n, onClose, go }) {
  const [mode, setMode] = useState(null) // 'edit' | 'verify'
  const [e, setE] = useState({ rootCause: n.rootCause || '', responsible: n.responsible || n.action?.owner || '', target: n.action?.due || '', note: '' })
  const [v, setV] = useState({ accept: true, note: '' })
  const status = Q.ncrStatus(n)
  const resp = Q.responsibleOptions(n.siteId, n.projectId)
  const insp = n.fromInspection && ctx.s.inspections.find((x) => x.id === n.fromInspection)
  const html = () => `<h1>NCR ${n.id}</h1><p>${n.description}</p><p>Location: ${siteName(n.siteId)} · ${n.location || ''}<br>Severity: ${n.severity} · Category: ${n.category || '—'} · Status: ${status}<br>Reported ${n.reported} by ${n.reportedBy || '—'} · Inspection: ${n.fromInspection || '—'}<br>Responsible: ${n.responsible || n.action?.owner || '—'} · Target ${n.action?.due || '—'}<br>Root cause: ${n.rootCause || 'Not yet determined'}<br>Corrective action: ${n.action?.text || '—'} (${n.action?.status || ''})<br>Verification: ${n.verification ? `${n.verification.by} ${n.verification.at}` : '—'}</p>`
  return (
    <Drawer title={`${n.id} · ${n.category || 'Non-conformance'}`} sub={`${siteName(n.siteId)}${n.location ? ` · ${n.location}` : ''}`} onClose={() => { ctx.setError(''); onClose() }} wide>
      <dl className="details">
        <dt>Status</dt><dd><Badge>{status}</Badge></dd>
        <dt>Description</dt><dd>{n.description}</dd>
        <dt>Severity</dt><dd><Badge>{n.severity}</Badge></dd>
        <dt>Identified</dt><dd>{formatDate(n.reported)} by {n.reportedBy || 'site / admin record'}</dd>
        <dt>Related inspection</dt><dd>{insp ? <button className="link-btn" onClick={() => go('records', `open=${insp.id}`)}>{insp.id} · {insp.title} ({insp.status})</button> : '—'}</dd>
        <dt>Drawing / spec</dt><dd>{n.drawingRef ? docRefLabel(ctx.s, n.drawingRef) : '—'}</dd>
        <dt>Responsible</dt><dd>{n.responsible || n.action?.owner || '—'}{n.responsibleRole ? ` (${n.responsibleRole})` : ''}</dd>
        <dt>Root cause</dt><dd>{n.rootCause || <span className="cell-sub">Not yet determined</span>}</dd>
        {ctx.s.safety.some((x) => x.linkedNcr === n.id) && <><dt>Linked safety records</dt><dd>{ctx.s.safety.filter((x) => x.linkedNcr === n.id).map((x) => `${x.id} (${x.kind}, ${x.severity}, ${x.status})`).join('; ')} <span className="cell-sub">· separate safety record, handled by the Safety Officer</span></dd></>}
        <dt>Corrective action</dt><dd>{n.action ? `${n.action.id} · ${n.action.text} · due ${formatDate(n.action.due)} · ${n.action.status}` : '—'}</dd>
        <dt>Evidence</dt><dd>{n.action?.evidence?.length ? n.action.evidence.map((x) => (typeof x === 'string' ? x : x.name)).join(', ') : '—'}</dd>
        <dt>Reinspection</dt><dd>{n.reinspectionRequired === false ? 'Not required' : n.reinspectionId ? `${n.reinspectionId} on ${formatDate(n.reinspectionDate)}` : 'Required before closure'}</dd>
        <dt>Verification / closure</dt><dd>{n.verification ? `${n.verification.by} · ${fmtStamp(n.verification.at)}${n.verification.inspectionId ? ` · ${n.verification.inspectionId}` : ''}${n.verification.note ? ` · ${n.verification.note}` : ''}` : '—'}</dd>
      </dl>
      <PhotoStrip photos={n.photos} />
      {!mode && (
        <div className="jv-submit" style={{ marginTop: 12, flexWrap: 'wrap' }}>
          {ctx.perms.manage && status !== 'Closed' && <button className="btn" onClick={() => setMode('edit')}>Root cause / assignment</button>}
          {ctx.perms.review && status === 'Awaiting Verification' && <button className="btn btn-primary" onClick={() => setMode('verify')}>Verify correction</button>}
          {ctx.perms.manage && status === 'Reinspection Required' && <button className="btn btn-primary" onClick={() => go('reinspection', `ncr=${n.id}`)}>Schedule reinspection</button>}
          <button className="btn" onClick={() => printRecord(`NCR ${n.id}`, html())}>Print NCR</button>
        </div>
      )}
      {mode === 'edit' && (
        <div className="receipt-form" style={{ marginTop: 12 }}>
          <div className="receipt-grid">
            <label className="field span-2">Root cause<input value={e.rootCause} onChange={(x) => setE({ ...e, rootCause: x.target.value })} /></label>
            <label className="field">Responsible<select value={e.responsible} onChange={(x) => setE({ ...e, responsible: x.target.value })}>{resp.map((r) => <option key={r.name} value={r.name}>{r.name} ({r.role})</option>)}</select></label>
            <label className="field">Target date<input type="date" min={ctx.today} value={e.target} onChange={(x) => setE({ ...e, target: x.target.value })} /></label>
            <label className="field span-2">Note (required when reassigning)<input value={e.note} onChange={(x) => setE({ ...e, note: x.target.value })} /></label>
          </div>
          <div className="sk-form-foot"><FormError error={ctx.error} /><div className="jv-submit"><button className="btn btn-primary" onClick={() => ctx.act('updateNcrDetails', { id: n.id, ...e, responsible: e.responsible !== (n.responsible || n.action?.owner) ? e.responsible : undefined, responsibleRole: resp.find((r) => r.name === e.responsible)?.role }) && setMode(null)}>Save</button><button className="btn" onClick={() => setMode(null)}>Cancel</button></div></div>
        </div>
      )}
      {mode === 'verify' && (
        <div className="receipt-form" style={{ marginTop: 12 }}>
          <p className="cell-sub" style={{ padding: '0 18px' }}>{n.action?.note ? `Correction reported: ${n.action.note}` : ''}</p>
          <div className="receipt-grid">
            <label className="field">Decision<select value={v.accept ? 'yes' : 'no'} onChange={(x) => setV({ ...v, accept: x.target.value === 'yes' })}><option value="yes">Correction acceptable{n.reinspectionRequired === false ? ': close NCR' : ': reinspect'}</option><option value="no">Return for correction</option></select></label>
            <label className="field">{v.accept ? 'Note' : 'Reason (required)'}<input value={v.note} onChange={(x) => setV({ ...v, note: x.target.value })} /></label>
          </div>
          <div className="sk-form-foot"><FormError error={ctx.error} /><div className="jv-submit"><button className="btn btn-primary" onClick={() => ctx.act('verifyCorrection', { id: n.id, ...v }) && setMode(null)}>Record verification</button><button className="btn" onClick={() => setMode(null)}>Cancel</button></div></div>
        </div>
      )}
      {!mode && <FormError error={ctx.error} />}
      <div className="sub-panel-head" style={{ marginTop: 14 }}><b>History</b></div>
      {n.history?.length ? <HistoryList items={[...n.history].reverse()} /> : <p className="cell-sub">Earlier record: history before this session is summarised above.</p>}
    </Drawer>
  )
}

export default function Ncrs({ notify, search, go }) {
  const ctx = useQA(notify)
  const [params, setParams] = useSearchParams()
  const [status, setStatus] = useState(params.get('status') || 'open')
  const [severity, setSeverity] = useState('all')
  const [creating, setCreating] = useState(params.get('new') === '1')
  const openId = params.get('open')
  const q = (search || '').toLowerCase()
  const rows = ctx.s.ncrs
    .filter((n) => status === 'all' || (status === 'open' ? Q.ncrStatus(n) !== 'Closed' : Q.ncrStatus(n) === status))
    .filter((n) => severity === 'all' || n.severity === severity)
    .filter((n) => !q || `${n.id} ${n.description} ${n.location || ''} ${n.responsible || n.action?.owner || ''}`.toLowerCase().includes(q))
    .sort((a, b) => b.reported.localeCompare(a.reported))
  const current = openId && ctx.s.ncrs.find((n) => n.id === openId)
  return (
    <>
      <Card title="Defects & non-conformance reports" sub="Open → Assigned → Correction in Progress → Awaiting Verification → Reinspection Required → Closed (or Returned for Correction)" bodyClass=""
        action={ctx.perms.manage ? <button className="btn btn-primary btn-sm" onClick={() => setCreating(true)}><Icon name="plus" size={14} />Record defect</button> : <Locked>View only</Locked>}>
        <div className="toolbar"><div className="filters">
          <label className="field">Status<select value={status} onChange={(e) => setStatus(e.target.value)}><option value="open">Open (not closed)</option><option value="all">All</option>{Q.NCR_STATUSES.map((s) => <option key={s}>{s}</option>)}</select></label>
          <label className="field">Severity<select value={severity} onChange={(e) => setSeverity(e.target.value)}><option value="all">All</option>{Q.SEVERITIES.map((s) => <option key={s}>{s}</option>)}</select></label>
        </div></div>
        <DataTable dense rows={rows} emptyText="No NCRs match these filters." columns={[
          { key: 'id', header: 'NCR', render: (n) => <><button className="link-btn" onClick={() => setParams({ open: n.id })}>{n.id}</button><div className="cell-sub">{formatDate(n.reported)}</div></> },
          { key: 'l', header: 'Location', render: (n) => <>{siteName(n.siteId)}<div className="cell-sub">{n.location || ''}</div></> },
          { key: 'd', header: 'Defect', render: (n) => <span className="wrap-cell">{n.description}<div className="cell-sub">{n.category || ''}{n.fromInspection ? ` · ${n.fromInspection}` : ''}</div></span> },
          { key: 's', header: 'Severity', render: (n) => <Badge>{n.severity}</Badge> },
          { key: 'r', header: 'Responsible', render: (n) => <>{n.responsible || n.action?.owner || '—'}<div className="cell-sub">{n.responsibleRole || ''}</div></> },
          { key: 't', header: 'Target', render: (n) => <span className={n.action?.due < ctx.today && Q.ncrStatus(n) !== 'Closed' ? 'down' : ''}>{n.action?.due ? formatDate(n.action.due) : '—'}</span> },
          { key: 'st', header: 'Status', render: (n) => <Badge>{Q.ncrStatus(n)}</Badge> },
          { key: 'x', header: '', render: (n) => <button className={`btn btn-sm ${Q.ncrStatus(n) === 'Awaiting Verification' && ctx.perms.review ? 'btn-primary' : ''}`} onClick={() => setParams({ open: n.id })}>{Q.ncrStatus(n) === 'Awaiting Verification' && ctx.perms.review ? 'Verify' : 'View'}</button> },
        ]} />
      </Card>
      {creating && <NewNcr ctx={ctx} onClose={() => { setCreating(false); if (params.get('new')) setParams({}) }} />}
      {current && <NcrDrawer key={current.id} ctx={ctx} n={current} go={go} onClose={() => setParams({})} />}
    </>
  )
}
