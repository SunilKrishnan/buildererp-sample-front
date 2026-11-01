import { useState } from 'react'
import DataTable from '../../components/DataTable.jsx'
import { Badge, Card } from '../../components/UI.jsx'
import { formatDate } from '../../utils/format.js'
import { PhotoStrip } from '../site-engineer/shared.jsx'
import { Drawer, FormError, HistoryList, fmtStamp } from '../store-keeper/shared.jsx'
import { INSPECTION_TYPES } from './Schedule.jsx'
import { InspectorSelect, docRefLabel, siteName, useQA } from './shared.jsx'

export const REQUEST_STATUSES = ['Ready – awaiting Site Engineer', 'Submitted', 'Scheduled', 'Inspected', 'Cleared', 'Returned to Site Engineer']
const guessType = (text) => (/reinforcement|rebar/i.test(text) ? 'Reinforcement' : /shutter|formwork/i.test(text) ? 'Finishing / formwork' : /concrete|pour|curing/i.test(text) ? 'Concrete' : /masonry|brick/i.test(text) ? 'Masonry' : /earthing|electric/i.test(text) ? 'Electrical' : 'Other')

function RequestDrawer({ ctx, r, onClose, go }) {
  const [mode, setMode] = useState(null) // 'schedule' | 'return'
  const [f, setF] = useState({ date: r.requiredDate >= ctx.today ? r.requiredDate : ctx.today, time: '10:00', inspector: ctx.user.name, type: guessType(r.activity), priority: 'Normal', note: '' })
  const cl = r.checklistId && ctx.s.checklists.find((c) => c.id === r.checklistId)
  const task = r.taskId && ctx.s.tasks.find((t) => t.id === r.taskId)
  return (
    <Drawer title={`${r.id} · ${r.activity}`} sub={`${siteName(r.siteId)} · ${r.location}`} onClose={() => { ctx.setError(''); onClose() }}>
      <dl className="details">
        <dt>Status</dt><dd><Badge>{r.status}</Badge>{r.returnReason ? <div className="cell-sub">Returned: {r.returnReason}</div> : null}</dd>
        <dt>Work ready (Supervisor)</dt><dd>{r.readiness ? `${r.readiness.by} · ${fmtStamp(r.readiness.at)} · ${r.readiness.note}` : '—'}</dd>
        <dt>Requested by (Engineer)</dt><dd>{r.submittedBy ? `${r.submittedBy} · ${fmtStamp(r.submittedAt)}` : 'Not yet requested'}</dd>
        <dt>Readiness confirmed</dt><dd>{r.readinessConfirmed ? 'Yes, technical readiness checked by the Site Engineer' : 'Not yet'}</dd>
        <dt>Required by</dt><dd>{formatDate(r.requiredDate)}</dd>
        <dt>Related task</dt><dd>{task ? `${task.id} · ${task.title}` : '—'}</dd>
        <dt>Checklist</dt><dd>{cl ? `${cl.id} · ${cl.title}` : '—'}</dd>
        <dt>Drawings / specs</dt><dd>{r.drawingRefs.map((d) => docRefLabel(ctx.s, d)).join(', ') || '—'}</dd>
        <dt>Supporting documents</dt><dd>{r.docs?.join(', ') || '—'}</dd>
        {r.note && <><dt>Note</dt><dd>{r.note}</dd></>}
        {r.inspectionId && <><dt>Inspection</dt><dd><button className="link-btn" onClick={() => go('records', `open=${r.inspectionId}`)}>{r.inspectionId}</button></dd></>}
      </dl>
      <PhotoStrip photos={r.photos} />
      {ctx.perms.manage && r.status === 'Submitted' && !mode && (
        <div className="jv-submit" style={{ marginTop: 14 }}>
          <button className="btn btn-primary" onClick={() => setMode('schedule')}>Schedule inspection</button>
          <button className="btn" onClick={() => setMode('return')}>Return to Site Engineer</button>
        </div>
      )}
      {mode === 'schedule' && (
        <div className="receipt-form" style={{ marginTop: 14 }}>
          <div className="receipt-grid">
            <label className="field">Date<input type="date" min={ctx.today} value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} /></label>
            <label className="field">Time<input type="time" value={f.time} onChange={(e) => setF({ ...f, time: e.target.value })} /></label>
            <InspectorSelect value={f.inspector} onChange={(v) => setF({ ...f, inspector: v })} />
            <label className="field">Inspection type<select value={f.type} onChange={(e) => setF({ ...f, type: e.target.value })}>{INSPECTION_TYPES.map((t) => <option key={t}>{t}</option>)}</select></label>
            <label className="field">Priority<select value={f.priority} onChange={(e) => setF({ ...f, priority: e.target.value })}><option>Normal</option><option>High</option><option>Urgent</option></select></label>
          </div>
          <div className="sk-form-foot"><FormError error={ctx.error} /><div className="jv-submit"><button className="btn btn-primary" onClick={() => ctx.act('scheduleInspection', { requestId: r.id, ...f }) && onClose()}>Confirm schedule</button><button className="btn" onClick={() => setMode(null)}>Cancel</button></div></div>
        </div>
      )}
      {mode === 'return' && (
        <div className="receipt-form" style={{ marginTop: 14 }}>
          <div className="receipt-grid"><label className="field span-2">Reason (sent to the Site Engineer)<input value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} placeholder="e.g. drawing S-102 R1 not approved; use R0 or wait" /></label></div>
          <div className="sk-form-foot"><FormError error={ctx.error} /><div className="jv-submit"><button className="btn btn-primary" onClick={() => ctx.act('returnInspectionRequest', { id: r.id, note: f.note }) && onClose()}>Return request</button><button className="btn" onClick={() => setMode(null)}>Cancel</button></div></div>
        </div>
      )}
      <div className="sub-panel-head" style={{ marginTop: 14 }}><b>History</b></div>
      <HistoryList items={[...(r.history || [])].reverse()} />
    </Drawer>
  )
}

export default function Requests({ notify, search, go }) {
  const ctx = useQA(notify)
  const [status, setStatus] = useState('open')
  const [openId, setOpenId] = useState(null)
  const q = (search || '').toLowerCase()
  const rows = ctx.s.qaRequests
    .filter((r) => status === 'all' || (status === 'open' ? ['Submitted', 'Ready – awaiting Site Engineer', 'Returned to Site Engineer'].includes(r.status) : r.status === status))
    .filter((r) => !q || `${r.id} ${r.activity} ${r.location} ${r.submittedBy || ''}`.toLowerCase().includes(q))
    .sort((a, b) => (b.submittedAt || b.readiness?.at || '').localeCompare(a.submittedAt || a.readiness?.at || ''))
  const current = openId && ctx.s.qaRequests.find((r) => r.id === openId)
  const waiting = ctx.s.qaRequests.filter((r) => r.status === 'Submitted').length
  return (
    <>
      <div className="info-note"><span>ℹ</span><div>Site Supervisor reports work ready → Site Engineer checks technical readiness and requests inspection → QA schedules it. {waiting ? <b>{waiting} request{waiting > 1 ? 's' : ''} waiting to be scheduled.</b> : 'No requests waiting.'}</div></div>
      <Card title="Inspection requests" bodyClass="">
        <div className="toolbar"><label className="field">Show<select value={status} onChange={(e) => setStatus(e.target.value)}><option value="open">Open</option><option value="all">All</option>{REQUEST_STATUSES.map((s) => <option key={s}>{s}</option>)}</select></label></div>
        <DataTable dense rows={rows} emptyText="No inspection requests match." columns={[
          { key: 'id', header: 'Request', render: (r) => <><button className="link-btn" onClick={() => setOpenId(r.id)}>{r.id}</button><div className="cell-sub">{r.submittedAt ? fmtStamp(r.submittedAt) : 'not submitted'}</div></> },
          { key: 'l', header: 'Site / location', render: (r) => <>{siteName(r.siteId)}<div className="cell-sub">{r.location}</div></> },
          { key: 'a', header: 'Activity ready', render: (r) => <span className="wrap-cell">{r.activity}</span> },
          { key: 'b', header: 'Requested by', render: (r) => <>{r.submittedBy || '—'}<div className="cell-sub">ready: {r.readiness?.by}</div></> },
          { key: 'd', header: 'Required', render: (r) => <span className={r.requiredDate < ctx.today && r.status === 'Submitted' ? 'down' : ''}>{formatDate(r.requiredDate)}</span> },
          { key: 'c', header: 'Checklist / drawing', render: (r) => <span className="cell-sub wrap-cell">{[r.checklistId, ...r.drawingRefs].filter(Boolean).join(' · ') || '—'}</span> },
          { key: 'e', header: 'Evidence', render: (r) => <span className="cell-sub">{(r.photos?.length || 0)} photo{r.photos?.length === 1 ? '' : 's'} · {r.docs?.length || 0} doc{r.docs?.length === 1 ? '' : 's'}</span> },
          { key: 'rc', header: 'Ready', render: (r) => (r.readinessConfirmed ? <Badge tone="success">Confirmed</Badge> : <Badge tone="warning">Not confirmed</Badge>) },
          { key: 's', header: 'Status', render: (r) => <><Badge>{r.status}</Badge>{r.inspectionId && <div className="cell-sub">{r.inspectionId}</div>}</> },
          { key: 'x', header: '', render: (r) => <button className={`btn btn-sm ${r.status === 'Submitted' && ctx.perms.manage ? 'btn-primary' : ''}`} onClick={() => setOpenId(r.id)}>{r.status === 'Submitted' && ctx.perms.manage ? 'Schedule' : 'View'}</button> },
        ]} />
      </Card>
      {current && <RequestDrawer key={current.id} ctx={ctx} r={current} go={go} onClose={() => setOpenId(null)} />}
    </>
  )
}
