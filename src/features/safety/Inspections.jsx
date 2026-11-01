import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import DataTable from '../../components/DataTable.jsx'
import Icon from '../../components/Icon.jsx'
import { Badge, Card } from '../../components/UI.jsx'
import { SITES } from '../../data/demo/inventoryDemo.js'
import { INSPECTION_CATEGORIES, SAFETY_OFFICER } from '../../data/demo/safetyDemo.js'
import * as SF from '../../services/safety.js'
import { todayISO } from '../../utils/date.js'
import { formatDate } from '../../utils/format.js'
import { ConfirmDialog, Drawer, FormError, HistoryList, Locked } from '../store-keeper/shared.jsx'
import { PhotoInput, PhotoStrip } from '../site-engineer/shared.jsx'
import { AssignAction, SafetyDrawers, SevBadge, siteName, useSafety } from './shared.jsx'

function ScheduleForm({ ctx, onClose }) {
  const [f, setF] = useState({ siteId: 'S-01', category: 'Scaffolding', workArea: '', inspector: SAFETY_OFFICER, date: todayISO() })
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value })
  return (
    <Drawer title="Schedule a safety inspection" sub="The checklist comes from the company template for the category" onClose={onClose}>
      <div className="receipt-form">
        <div className="receipt-grid">
          <label className="field">Site<select value={f.siteId} onChange={set('siteId')}>{SITES.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select></label>
          <label className="field">Category<select value={f.category} onChange={set('category')}>{INSPECTION_CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select></label>
          <label className="field span-2">Work area<input value={f.workArea} onChange={set('workArea')} placeholder="e.g. Tower A, F9–F12 shuttering scaffolds" /></label>
          <label className="field">Assigned inspector<input value={f.inspector} onChange={set('inspector')} /></label>
          <label className="field">Scheduled date<input type="date" min={todayISO()} value={f.date} onChange={set('date')} /></label>
        </div>
        <div className="sk-form-foot"><FormError error={ctx.error} /><div className="jv-submit"><button className="btn btn-primary" onClick={() => ctx.act('scheduleSafetyInspection', f) && onClose()}>Schedule</button><button className="btn" onClick={onClose}>Cancel</button></div></div>
      </div>
    </Drawer>
  )
}

function InspectionDrawer({ q, ctx, onClose, onAction }) {
  const editable = ctx.perms.manage && ['Scheduled', 'In Progress'].includes(q.status)
  const [items, setItems] = useState(q.checklist)
  const [f, setF] = useState({ findings: q.findings || '', severity: q.severity || '', followUp: false, photos: [] })
  const [confirming, setConfirming] = useState(false)
  const failed = items.some((c) => c.result === 'Fail')
  const setItem = (i, k, v) => setItems(items.map((c, j) => (j === i ? { ...c, [k]: v } : c)))
  const acts = (ctx.s.safetyActions || []).filter((a) => a.sourceId === q.id)
  const save = (complete) => { setConfirming(false); ctx.act('recordSafetyInspection', { id: q.id, checklist: items, ...f, complete }) && complete && onClose() }
  return (
    <Drawer title={`${q.id} · ${q.category}`} sub={`${siteName(q.siteId)} · ${q.workArea} · ${formatDate(q.date)} · ${q.inspector}`} onClose={onClose} wide>
      <dl className="details"><dt>Status</dt><dd><Badge>{q.status}</Badge>{q.severity ? <> <SevBadge s={q.severity} /></> : null}</dd><dt>Findings</dt><dd>{q.findings || '—'}</dd></dl>
      <section className="drawer-section">
        <h3>Checklist</h3>
        <p className="cell-sub">Company checklist template (demo). Replace with the company's approved safety checklist; no technical limits are invented here.</p>
        {items.map((c, i) => (
          <div key={i} className="se-check">
            <span className="wrap-cell" style={{ flex: 1 }}>{c.item}</span>
            {editable ? <div className="chips">{['Pass', 'Fail', 'N/A'].map((r) => <button type="button" key={r} className={`chip ${c.result === r ? 'active' : ''}`} onClick={() => setItem(i, 'result', c.result === r ? null : r)}>{r}</button>)}</div> : <Badge>{c.result || 'Not checked'}</Badge>}
          </div>
        ))}
      </section>
      {editable && (
        <section className="drawer-section">
          <div className="receipt-grid" style={{ padding: 0 }}>
            <label className="field span-2">Findings and observations{failed ? ' (required)' : ''}<input value={f.findings} onChange={(e) => setF({ ...f, findings: e.target.value })} /></label>
            <label className="field">Risk severity of findings<select value={f.severity} onChange={(e) => setF({ ...f, severity: e.target.value })}><option value="">—</option>{['Low', 'Medium', 'High', 'Critical'].map((v) => <option key={v}>{v}</option>)}</select></label>
            <label className="check-row" style={{ alignSelf: 'end' }}><input type="checkbox" checked={f.followUp} onChange={(e) => setF({ ...f, followUp: e.target.checked })} />Failures can be corrected on follow-up (Requires Follow-up)</label>
            <PhotoInput label="Photos (optional)" value={f.photos} onChange={(photos) => setF({ ...f, photos })} />
          </div>
          <div className="cell-actions" style={{ marginTop: 8 }}>
            <button className="btn btn-sm" onClick={() => save(false)}>Save in progress</button>
            <button className="btn btn-sm btn-primary" onClick={() => setConfirming(true)}>Record result</button>
          </div>
        </section>
      )}
      <PhotoStrip photos={q.photos} />
      <section className="drawer-section">
        <h3>Follow-up actions ({acts.length})</h3>
        <ol className="audit-list">{acts.map((a) => <li key={a.id}><button className="link-btn" onClick={() => onAction(a.id)}>{a.id}</button> <Badge>{a.status}</Badge> {a.text}<div className="cell-sub">{a.owner} · due {formatDate(a.due)}</div></li>)}</ol>
        {ctx.perms.manage && ['Failed', 'Requires Follow-up'].includes(q.status) && <AssignAction ctx={ctx} sourceType="Inspection" sourceId={q.id} siteId={q.siteId} />}
      </section>
      <FormError error={ctx.error} />
      <section className="drawer-section"><h3>History</h3><HistoryList items={q.history} /></section>
      {confirming && (
        <ConfirmDialog title={`Record the result of ${q.id}?`} confirmLabel="Record result" onCancel={() => setConfirming(false)} onConfirm={() => save(true)}>
          <p>{items.filter((c) => c.result === 'Pass').length} pass · {items.filter((c) => c.result === 'Fail').length} fail · {items.filter((c) => !c.result).length} not checked. Result: <b>{items.some((c) => !c.result) ? '—' : failed ? (f.followUp ? 'Requires Follow-up' : 'Failed') : 'Passed'}</b>. Results are not overwritten afterwards.</p>
        </ConfirmDialog>
      )}
    </Drawer>
  )
}

export default function Inspections({ notify, search }) {
  const ctx = useSafety(notify)
  const [params, setParams] = useSearchParams()
  const [status, setStatus] = useState(params.get('status') || 'all')
  const [cat, setCat] = useState('all')
  const [open, setOpen] = useState(null)
  const [act, setAct] = useState(null)
  const q = (search || '').toLowerCase()
  const rows = (ctx.s.safetyInspections || [])
    .filter((x) => status === 'all' || (status === 'due' ? ['Scheduled', 'In Progress'].includes(x.status) && x.date <= ctx.today : x.status === status))
    .filter((x) => (cat === 'all' || x.category === cat) && (!q || `${x.id} ${x.workArea} ${x.findings}`.toLowerCase().includes(q)))
    .sort((a, b) => b.date.localeCompare(a.date))
  const current = open && (ctx.s.safetyInspections || []).find((x) => x.id === open)
  return (
    <>
      <Card title="Safety inspections" sub="Separate from QA quality inspections. Failed items lead to corrective actions." bodyClass=""
        action={ctx.perms.manage ? <button className="btn btn-primary btn-sm" onClick={() => setParams({ new: '1' })}><Icon name="plus" size={14} />Schedule inspection</button> : <Locked>View only</Locked>}>
        <div className="toolbar"><div className="filters">
          <label className="field">Status<select value={status} onChange={(e) => setStatus(e.target.value)}><option value="all">All</option><option value="due">Due (today or earlier)</option>{SF.INSPECTION_STATUSES.map((s) => <option key={s}>{s}</option>)}</select></label>
          <label className="field">Category<select value={cat} onChange={(e) => setCat(e.target.value)}><option value="all">All</option>{INSPECTION_CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select></label>
        </div></div>
        <DataTable dense rows={rows} emptyText="No inspections match." columns={[
          { key: 'id', header: 'Inspection ID', render: (x) => <><button className="link-btn" onClick={() => setOpen(x.id)}>{x.id}</button><div className="cell-sub">{formatDate(x.date)}</div></> },
          { key: 's', header: 'Project / site', render: (x) => siteName(x.siteId) },
          { key: 'w', header: 'Work area', render: (x) => x.workArea },
          { key: 'c', header: 'Category', render: (x) => x.category },
          { key: 'i', header: 'Inspector', render: (x) => x.inspector },
          { key: 'k', header: 'Checklist', align: 'num', render: (x) => `${x.checklist.filter((c) => c.result === 'Pass').length}/${x.checklist.length} pass` },
          { key: 'f', header: 'Findings', render: (x) => <span className="cell-sub wrap-cell">{x.findings || '—'}</span> },
          { key: 'sv', header: 'Severity', render: (x) => <SevBadge s={x.severity} /> },
          { key: 'st', header: 'Result', render: (x) => <><Badge>{x.status}</Badge>{x.actionIds?.length > 0 && <div className="cell-sub">{x.actionIds.join(', ')}</div>}</> },
        ]} />
      </Card>
      {params.get('new') === '1' && <ScheduleForm ctx={ctx} onClose={() => setParams({})} />}
      {current && !act && <InspectionDrawer key={current.id + current.status + (current.actionIds || []).length} q={current} ctx={ctx} onClose={() => setOpen(null)} onAction={setAct} />}
      <SafetyDrawers ctx={ctx} recordId={null} actionId={act} onRecord={() => {}} onAction={setAct} />
    </>
  )
}
