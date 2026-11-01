import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import DataTable from '../../components/DataTable.jsx'
import Icon from '../../components/Icon.jsx'
import { Badge, Card } from '../../components/UI.jsx'
import { STORES } from '../../data/demo/inventoryDemo.js'
import { ACTIVE_REQUEST_STATUSES, EDITABLE_REQUEST_STATUSES, findStock, materialOf, MR, nextId, REQUEST_STATUSES } from '../../services/inventory.js'
import { validateNewRequest } from '../../services/procurement.js'
import { pmOf, projectOf, siteStoreOf } from '../../services/site.js'
import { addDays, todayISO } from '../../utils/date.js'
import { formatDate } from '../../utils/format.js'
import { ConfirmDialog, Drawer, fmtQty, fmtStamp, FormError, HistoryList, Locked, qtyStep } from '../store-keeper/shared.jsx'
import { siteData } from './derive.js'
import { PhotoInput, projectIdOfSite, SiteSelect, useSiteEngineer } from './shared.jsx'

/** New request, or edit of your own Draft / Returned request (same reference). */
function RequestForm({ ctx, d, existing, presetTask, shortage, onClose }) {
  const sites = ctx.mySites
  const first = sites.length === 1 ? sites[0].id : ''
  const preset = (presetTask || shortage?.taskId) && d.tasks.find((t) => t.id === (presetTask || shortage?.taskId))
  const [f, setF] = useState(existing
    ? { id: existing.id, siteId: existing.siteId, storeId: existing.storeId, sku: existing.sku, qty: existing.requested ? String(existing.requested) : '', requiredBy: existing.requiredBy, priority: existing.priority, purpose: existing.purpose, workArea: existing.workArea || '', taskId: existing.taskId || '', remarks: existing.remarks || '', attachments: [] }
    : shortage
      ? { siteId: shortage.siteId, storeId: siteStoreOf(shortage.siteId) || '', sku: shortage.sku, qty: String(shortage.shortage), requiredBy: shortage.neededBy, priority: 'High', purpose: preset ? preset.title : shortage.remarks, workArea: preset?.location || '', taskId: preset?.id || '', remarks: `Shortage ${shortage.id} reported by ${shortage.reportedBy}: needs ${shortage.required}, usable on site ${shortage.available}`, attachments: [] }
      : { siteId: preset?.siteId || first, storeId: siteStoreOf(preset?.siteId || first) || '', sku: '', qty: '', requiredBy: addDays(todayISO(), 2), priority: 'Normal', purpose: preset ? preset.title : '', workArea: preset?.location || '', taskId: preset?.id || '', remarks: '', attachments: [] })
  const [error, setError] = useState('')
  const [find, setFind] = useState('')
  const [missing, setMissing] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const set = (k) => (e) => { setF({ ...f, [k]: e.target.value, ...(k === 'siteId' ? { storeId: siteStoreOf(e.target.value) || '', taskId: '' } : {}) }); setError('') }
  const m = f.sku ? materialOf(f.sku) : null
  const row = f.sku && f.storeId ? findStock(ctx.inv.stock, f.sku, f.storeId) : null
  const stores = STORES.filter((s) => !s.projectId || s.id === siteStoreOf(f.siteId))
  const tasks = d.tasks.filter((t) => t.siteId === f.siteId && t.status !== 'Completed')
  const materials = ctx.inv.state.materials.filter((x) => !find || `${x.name} ${x.sku} ${x.category}`.toLowerCase().includes(find.toLowerCase()) || x.sku === f.sku)
  const pickTask = (e) => {
    const t = tasks.find((x) => x.id === e.target.value)
    setF({ ...f, taskId: e.target.value, purpose: f.purpose || t?.title || '', workArea: f.workArea || t?.location || '' })
  }
  const check = (draft) => {
    if (!ctx.scope.siteIds.includes(f.siteId)) return 'You can request material only for your assigned sites.'
    return validateNewRequest(f, { draft })
  }
  const saveDraft = () => { const e = check(true); if (e) { setError(e); return } if (ctx.actInv('submitRequest', { ...f, draft: true })) onClose() }
  const review = (e) => { e.preventDefault(); const v = check(false); if (v) { setError(v); return } setConfirming(true) }

  return (
    <Drawer title={existing ? `${existing.status === MR.RETURNED ? 'Correct and resubmit' : 'Edit draft'} ${existing.id}` : 'New material request'} sub={existing ? `Raised by ${existing.requestedBy}` : `Raised by ${ctx.user.name}. The request number is assigned when you save or submit.`} onClose={onClose} wide>
      {existing?.status === MR.RETURNED && <div className="info-note warn"><span>⚠</span><div><b>Returned by {existing.reviewedBy || 'the Project Manager'}:</b> {existing.reason}</div></div>}
      <form className="receipt-form" onSubmit={review} noValidate>
        <div className="receipt-grid">
          <div className="field">Project<div className="sk-readonly">{f.siteId ? projectOf(projectIdOfSite(f.siteId))?.name : '—'}</div></div>
          <SiteSelect value={f.siteId} sites={sites} onChange={(v) => set('siteId')({ target: { value: v } })} label="Site / tower" />
          <label className="field">Floor / work area<input value={f.workArea} onChange={set('workArea')} placeholder="e.g. Raft, grid A5–A8" /></label>
          <label className="field">Related task / work activity<select value={f.taskId} onChange={pickTask}><option value="">None</option>{tasks.map((t) => <option key={t.id} value={t.id}>{t.id} · {t.title}</option>)}</select></label>
          <label className="field">Find material<input value={find} onChange={(e) => setFind(e.target.value)} placeholder="Type to filter, e.g. cement" /></label>
          <label className="field">Material (material master)
            <select value={f.sku} onChange={set('sku')}><option value="">Select…</option>{materials.map((x) => <option key={x.sku} value={x.sku}>{x.name} ({x.unit})</option>)}</select>
          </label>
          <div className="field span-2"><button type="button" className="link-btn" onClick={() => setMissing(!missing)}>Material not in the list?</button>
            {missing && <div className="info-note sk-inline-note"><span>ℹ</span><div>Requests can only be raised for materials in the <b>material master</b>, so the same material is never created twice under different names. Ask the Store Keeper (Vijay Pawar) to add it; it appears here once added. Demo: no message is sent.</div></div>}
          </div>
          <label className="field">Requested quantity<input type="number" min="0" step={qtyStep(m?.unit)} value={f.qty} onChange={set('qty')} /></label>
          <div className="field">Unit<div className="sk-readonly">{m?.unit || '—'}</div></div>
          <label className="field">Required by<input type="date" min={todayISO()} value={f.requiredBy} onChange={set('requiredBy')} /></label>
          <label className="field">Priority<select value={f.priority} onChange={set('priority')}>{['Normal', 'High', 'Urgent'].map((p) => <option key={p}>{p}</option>)}</select></label>
          <label className="field">Issue from store<select value={f.storeId} onChange={set('storeId')}><option value="">Select…</option>{stores.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
          <label className="field span-2">Reason for requirement<input value={f.purpose} onChange={set('purpose')} placeholder="e.g. Raft foundation work" /></label>
          <label className="field span-2">Notes (optional)<input value={f.remarks} onChange={set('remarks')} /></label>
          <PhotoInput label="Supporting photos (optional)" value={f.attachments} onChange={(attachments) => setF({ ...f, attachments })} />
        </div>
        {m && (
          <div className="info-note sk-inline-note"><span>ℹ</span><div>
            <b>Indicative stock</b> at {STORES.find((s) => s.id === f.storeId)?.name || 'the store'}: {row ? `${fmtQty(row.availableForIssue, m.unit)} free (${fmtQty(row.onHand)} on hand, ${fmtQty(row.reserved)} reserved)` : 'not stocked here'}.
            {' '}This is not a promise of supply: the Store Keeper records the actual stock check, and nothing is reserved until the Project Manager approves.
          </div></div>
        )}
        <div className="sk-form-foot">
          <FormError error={error || ctx.error} />
          <div className="jv-submit">
            <button className="btn btn-primary" type="submit">Review & submit</button>
            <button className="btn" type="button" onClick={saveDraft}>Save draft</button>
            <button className="btn" type="button" onClick={onClose}>Cancel</button>
          </div>
          <p className="cell-sub">Next: Store Keeper checks usable stock → Project Manager reviews need, quantity, urgency and budget → Store Keeper issues, or forwards any shortage to the Purchase Manager. You cannot approve your own request, change stock or create purchase orders.</p>
        </div>
      </form>
      {confirming && (
        <ConfirmDialog title={`Submit ${fmtQty(Number(f.qty), m?.unit)} of ${m?.name}?`} confirmLabel="Submit request" onCancel={() => setConfirming(false)}
          onConfirm={() => {
            const newId = f.id || nextId(ctx.inv.state.requests, 'MR-')
            const ok = ctx.actInv('submitRequest', { ...f, draft: false })
            setConfirming(false)
            if (ok && shortage) ctx.act('handleShortage', { id: shortage.id, action: 'link', requestRef: newId })
            if (ok) onClose()
          }}>
          <dl className="details">
            <dt>Site / area</dt><dd>{ctx.mySites.find((s) => s.id === f.siteId)?.name}{f.workArea ? ` · ${f.workArea}` : ''}</dd>
            <dt>Required by</dt><dd>{formatDate(f.requiredBy)} · {f.priority}</dd>
            <dt>Reason</dt><dd>{f.purpose}{f.taskId ? ` (${f.taskId})` : ''}</dd>
            <dt>Goes to</dt><dd>Store Keeper (stock check), then {pmOf(projectIdOfSite(f.siteId))} (Project Manager) · status <b>{MR.SUBMITTED}</b></dd>
          </dl>
        </ConfirmDialog>
      )}
    </Drawer>
  )
}

/** Where the request is now, step by step, from the shared records. A step is ticked only when it has happened. */
function Tracker({ r, ctx }) {
  const issues = ctx.inv.state.issues.filter((i) => i.requestId === r.id)
  const pr = r.forwarded || ctx.inv.state.purchaseRequests.find((p) => p.requestRef === r.id)
  const po = pr?.poId ? ctx.inv.poViews.find((p) => p.id === pr.poId) : null
  const decided = r.approved != null || [MR.REJECTED].includes(r.status)
  const steps = [
    { label: 'Submitted', done: r.status !== MR.DRAFT, text: r.status === MR.DRAFT ? 'Draft: not sent to anyone yet' : `${r.requestedBy}, ${fmtStamp(r.at)}` },
    { label: 'Store Keeper stock check', done: !!r.checkedBy, text: r.checkedBy ? `${r.checkedBy}: ${r.checkNote || 'checked'}` : r.status === MR.SUBMITTED ? `Waiting for ${r.store.name}` : '—' },
    {
      label: 'Project Manager review', done: decided, bad: [MR.REJECTED, MR.RETURNED].includes(r.status),
      text: r.status === MR.REJECTED ? `Rejected: ${r.reason}` : r.status === MR.RETURNED ? `Returned for clarification: ${r.reason}` : r.approved != null ? `Approved ${r.approved} of ${r.requested} ${r.material.unit} by ${r.approvedBy}` : r.status === MR.PM_REVIEW ? `Waiting for ${pmOf(r.site?.projectId)}` : '—',
    },
    ...(pr ? [
      { label: 'Shortage to purchasing', done: true, text: `${pr.id}: ${pr.qty} ${r.material.unit} · ${pr.status}` },
      { label: 'Purchase order', done: !!po, text: po ? `${po.id} · ${po.vendor} · ${po.status}` : 'Purchase Manager is getting quotations (no order yet)' },
      { label: 'Delivery received (GRN)', done: !!po?.grns.length, text: po?.grns.length ? po.grns.map((g) => `${g.id}: ${g.status === 'Accepted' ? `${g.accepted} accepted` : 'inspection pending'}`).join(', ') : po ? `Expected ${formatDate(po.expected)}` : '—' },
    ] : []),
    { label: r.status === MR.CLOSED ? 'Closed' : 'Issued to site', done: [MR.ISSUED, MR.CLOSED].includes(r.status), text: r.status === MR.CLOSED ? `Balance closed: ${r.reason}${issues.length ? ` · issued ${issues.reduce((t, i) => t + i.qty, 0)}` : ''}` : issues.length ? `${issues.map((i) => `${i.id}: ${i.qty} (${formatDate(i.at.slice(0, 10))}, received by ${i.receivedBy})`).join('; ')} · remaining ${r.remaining} ${r.material.unit}` : 'Nothing issued yet' },
  ]
  return (
    <ol className="se-track">
      {steps.map((s, i) => <li key={i} className={s.done && !s.bad ? 'done' : ''}><b>{s.label}</b><span className={s.bad ? 'down' : ''}>{s.text}</span></li>)}
    </ol>
  )
}

/** Ask for more than was approved, with a justification; creates a linked request through the same workflow. */
function AdditionalQty({ r, ctx, onDone }) {
  const [f, setF] = useState({ qty: '', reason: '', requiredBy: addDays(todayISO(), 2) })
  const [error, setError] = useState('')
  const submit = () => {
    if (!f.reason.trim() || f.reason.trim().length < 15) { setError('Justify the additional quantity (what changed: drawing revision, wastage, extra work…).'); return }
    const ok = ctx.actInv('submitRequest', { siteId: r.siteId, storeId: r.storeId, sku: r.sku, qty: f.qty, requiredBy: f.requiredBy, priority: r.priority, purpose: `Additional to ${r.id}: ${f.reason.trim()}`, workArea: r.workArea, taskId: r.taskId, supplementTo: r.id })
    if (ok) onDone()
  }
  return (
    <section className="drawer-section">
      <h3>Request additional quantity</h3>
      <p className="cell-sub">Only when justified. It goes through the same Project Manager review and store check as a new request.</p>
      <div className="receipt-grid" style={{ padding: 0 }}>
        <label className="field">Additional quantity ({r.material.unit})<input type="number" min="0" step={qtyStep(r.material.unit)} value={f.qty} onChange={(e) => setF({ ...f, qty: e.target.value })} /></label>
        <label className="field">Required by<input type="date" min={todayISO()} value={f.requiredBy} onChange={(e) => setF({ ...f, requiredBy: e.target.value })} /></label>
        <label className="field span-2">Justification<input value={f.reason} onChange={(e) => setF({ ...f, reason: e.target.value })} placeholder="e.g. S-101 R2 increased footing F9–F12 size" /></label>
      </div>
      <button className="btn btn-sm" style={{ marginTop: 8 }} onClick={submit}>Submit additional request</button>
      <FormError error={error || ctx.error} />
    </section>
  )
}

function CancelDialog({ r, ctx, onDone, onCancel }) {
  const [reason, setReason] = useState('')
  return (
    <ConfirmDialog title={`Cancel ${r.id}?`} confirmLabel="Cancel request" onCancel={onCancel}
      onConfirm={() => { const ok = ctx.actInv('cancelRequest', { id: r.id, reason }); if (ok) onDone(); return ok }}>
      <p>{fmtQty(r.requested, r.material.unit)} of {r.material.name} for {r.site?.name}. {r.status !== MR.DRAFT && `${pmOf(r.site?.projectId)} will see it as cancelled.`}</p>
      {r.status !== MR.DRAFT && <label className="field">Reason<input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Work re-sequenced; not needed this week" /></label>}
      <FormError error={ctx.error} />
    </ConfirmDialog>
  )
}

/** Shortages reported by the Site Supervisor: the engineer raises the formal request, links an existing one, or closes the report. */
function ShortageReports({ ctx, d, onRaise }) {
  const [note, setNote] = useState({})
  const rows = (ctx.site.state.shortageReports || []).filter(ctx.inScope).sort((a, b) => b.at.localeCompare(a.at))
  if (!rows.length) return null
  const open = rows.filter((r) => ['Reported', 'Acknowledged'].includes(r.status))
  return (
    <Card title={<span className="title-with-count">Shortages reported by the Site Supervisor <span className="count-pill">{open.length}</span></span>} sub="A report is not a material request. Raise one from it (it then goes to the Store Keeper and Project Manager), link an existing request, or close it with a reason." bodyClass="" className="mb">
      <DataTable dense rows={rows} columns={[
        { key: 'id', header: 'Report', render: (r) => <><div className="cell-main">{r.id}</div><div className="cell-sub">{r.reportedBy} · {formatDate(r.at.slice(0, 10))}</div></> },
        { key: 'm', header: 'Material', render: (r) => <span className="wrap-cell">{materialOf(r.sku)?.name}<div className="cell-sub">{r.remarks}</div></span> },
        { key: 'q', header: 'Needed / on site / short', align: 'num', render: (r) => <>{r.required} / {r.available} / <b className="down">{r.shortage}</b> {materialOf(r.sku)?.unit}</> },
        { key: 'n', header: 'Needed by', render: (r) => formatDate(r.neededBy) },
        { key: 's', header: 'Status', render: (r) => <><Badge>{r.status}</Badge>{r.requestRef && <div className="cell-sub">{r.requestRef}</div>}{r.closeNote && <div className="cell-sub">{r.closeNote}</div>}</> },
        { key: 'x', header: '', render: (r) => (['Reported', 'Acknowledged'].includes(r.status) && ctx.perms.request ? (
          <div className="cell-actions">
            <button className="btn btn-sm btn-primary" onClick={() => onRaise(r.id)}>Raise request</button>
            {r.status === 'Reported' && <button className="btn btn-sm" onClick={() => ctx.act('handleShortage', { id: r.id, action: 'ack' })}>Acknowledge</button>}
            <select className="inline-input" value="" onChange={(e) => e.target.value && ctx.act('handleShortage', { id: r.id, action: 'link', requestRef: e.target.value })} aria-label={`Link ${r.id} to a request`}>
              <option value="">Link existing…</option>
              {d.requests.filter((x) => x.sku === r.sku && x.siteId === r.siteId && ![MR.CANCELLED, MR.REJECTED, MR.CLOSED].includes(x.status)).map((x) => <option key={x.id} value={x.id}>{x.id} ({x.status})</option>)}
            </select>
            <input className="inline-input" placeholder="Reason to close" value={note[r.id] || ''} onChange={(e) => setNote({ ...note, [r.id]: e.target.value })} aria-label={`Reason to close ${r.id}`} />
            <button className="btn btn-sm" onClick={() => ctx.act('handleShortage', { id: r.id, action: 'close', note: note[r.id] })}>Close</button>
          </div>
        ) : null) },
      ]} />
      <div style={{ padding: '0 18px 12px' }}><FormError error={ctx.error} /></div>
    </Card>
  )
}

export default function MaterialRequests({ notify, search }) {
  const ctx = useSiteEngineer(notify)
  const d = siteData(ctx)
  const [params, setParams] = useSearchParams()
  const [status, setStatus] = useState(params.get('status') || 'open')
  const [siteId, setSiteId] = useState('all')
  const [mine, setMine] = useState(false)
  const [openId, setOpenId] = useState(params.get('open'))
  const [editId, setEditId] = useState(null)
  const [cancelId, setCancelId] = useState(null)
  const creating = params.get('new') === '1'
  const q = (search || '').toLowerCase()
  const statusList = status.includes(',') ? status.split(',') : null
  const rows = d.requests
    .filter((r) => status === 'all' || (status === 'open' ? [MR.DRAFT, ...ACTIVE_REQUEST_STATUSES].includes(r.status) : statusList ? statusList.includes(r.status) : r.status === status))
    .filter((r) => siteId === 'all' || r.siteId === siteId)
    .filter((r) => !mine || r.requestedBy === ctx.user.name)
    .filter((r) => !q || `${r.id} ${r.material.name} ${r.purpose} ${r.workArea || ''}`.toLowerCase().includes(q))
    .sort((a, b) => b.at.localeCompare(a.at))
  const current = openId && d.requests.find((r) => r.id === openId)
  const editing = editId && d.requests.find((r) => r.id === editId)
  const cancelling = cancelId && d.requests.find((r) => r.id === cancelId)
  const own = (r) => r.requestedBy === ctx.user.name && ctx.perms.request
  const closeForm = () => { setEditId(null); if (creating) setParams({}) }

  return (
    <>
      {d.requests.some((r) => own(r) && r.status === MR.RETURNED) && (
        <div className="info-note warn"><span>⚠</span><div><b>Returned for clarification:</b> {d.requests.filter((r) => own(r) && r.status === MR.RETURNED).map((r) => `${r.id} (${r.reason})`).join('; ')}. Correct and resubmit, or cancel.</div></div>
      )}
      <ShortageReports ctx={ctx} d={d} onRaise={(id) => setParams({ new: '1', shortage: id })} />
      <Card title="Material requests" sub="One shared record per request: the Project Manager, Store Keeper and Purchase Manager see the same status" bodyClass=""
        action={ctx.perms.request ? <button className="btn btn-primary btn-sm" onClick={() => setParams({ new: '1' })}><Icon name="plus" size={14} />New request</button> : <Locked>View only</Locked>}>
        <div className="toolbar">
          <div className="filters">
            <label className="field">Status<select value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="open">Open (not finished)</option><option value="all">All</option>
              {statusList && <option value={status}>{statusList.join(' / ')}</option>}
              {REQUEST_STATUSES.map((s) => <option key={s}>{s}</option>)}
            </select></label>
            <label className="field">Site<select value={siteId} onChange={(e) => setSiteId(e.target.value)}><option value="all">All assigned</option>{ctx.mySites.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
            <label className="check-row" style={{ alignSelf: 'center' }}><input type="checkbox" checked={mine} onChange={(e) => setMine(e.target.checked)} />Raised by me only</label>
          </div>
        </div>
        <DataTable dense rows={rows} emptyText="No material requests match these filters." columns={[
          { key: 'id', header: 'Request no.', render: (r) => <><button className="link-btn" onClick={() => setOpenId(r.id)}>{r.id}</button><div className="cell-sub">{formatDate(r.at.slice(0, 10))} · {r.requestedBy}</div></> },
          { key: 'site', header: 'Project / site', render: (r) => <>{r.site?.name}<div className="cell-sub">{r.workArea || '—'}</div></> },
          { key: 'm', header: 'Material', render: (r) => <>{r.material.name}{r.supplementTo && <div className="cell-sub">Additional to {r.supplementTo}</div>}<div className="cell-sub wrap-cell">{r.purpose}{r.taskId ? ` · ${r.taskId}` : ''}</div></> },
          { key: 'rq', header: 'Requested', align: 'num', render: (r) => fmtQty(r.requested, r.material.unit) },
          { key: 'ap', header: 'Approved', align: 'num', render: (r) => fmtQty(r.approved) },
          { key: 'is', header: 'Issued', align: 'num', render: (r) => fmtQty(r.issued) },
          { key: 'pe', header: 'Remaining', align: 'num', render: (r) => (r.approved != null ? <b>{fmtQty(r.remaining)}</b> : '—') },
          { key: 'rb', header: 'Required by', render: (r) => <span className={r.requiredBy < todayISO() && r.pending > 0 ? 'down' : ''}>{formatDate(r.requiredBy)}</span> },
          { key: 'p', header: 'Priority', render: (r) => <Badge>{r.priority}</Badge> },
          { key: 's', header: 'Status', render: (r) => <><Badge>{r.status}</Badge>{r.forwarded && <div className="cell-sub">{r.forwarded.id}{r.forwarded.poId ? ` → ${r.forwarded.poId}` : ''}</div>}</> },
          { key: 'x', header: 'Actions', render: (r) => (
            <div className="cell-actions">
              <button className="btn btn-sm" onClick={() => setOpenId(r.id)}>Track</button>
              {own(r) && EDITABLE_REQUEST_STATUSES.includes(r.status) && <button className="btn btn-sm btn-primary" onClick={() => setEditId(r.id)}>{r.status === MR.RETURNED ? 'Correct' : 'Edit'}</button>}
              {own(r) && [MR.DRAFT, MR.SUBMITTED, MR.PM_REVIEW, MR.RETURNED].includes(r.status) && <button className="btn btn-sm" onClick={() => setCancelId(r.id)}>Cancel</button>}
            </div>
          ) },
        ]} />
        <p className="cell-sub" style={{ padding: '8px 18px 14px' }}>Status changes only when the matching action happens: Submitted → Store Keeper stock check → Pending Project Manager Review → Approved / Returned / Rejected → Partially Issued / Issued (or Closed). A shortage goes to purchasing as a linked requisition. Demo: kept for this browser session only.</p>
      </Card>

      {(creating || editing) && <RequestForm key={editId || `new-${params.get('shortage') || ''}`} ctx={ctx} d={d} existing={editing} presetTask={params.get('task')} shortage={params.get('shortage') ? (ctx.site.state.shortageReports || []).find((x) => x.id === params.get('shortage')) : null} onClose={closeForm} />}
      {cancelling && <CancelDialog r={cancelling} ctx={ctx} onCancel={() => setCancelId(null)} onDone={() => { setCancelId(null); setOpenId(null) }} />}
      {current && !editing && (
        <Drawer title={`${current.id} · ${current.material.name}`} sub={`${current.site?.name} · ${fmtQty(current.requested, current.material.unit)} · ${current.priority}`} onClose={() => { setOpenId(null); if (params.get('open')) setParams({}) }} wide
          foot={<span className="cell-sub">Shared with the Store Keeper, Project Manager and Purchase Manager. <Link className="link-btn" to="/dashboards/store-keeper?tab=requests">Store view</Link></span>}>
          <dl className="details">
            <dt>Status</dt><dd><Badge>{current.status}</Badge></dd>
            <dt>Quantities</dt><dd>Requested {current.requested} · approved {current.approved ?? '—'} · issued {current.issued} · remaining <b>{current.approved != null ? current.remaining : '—'}</b> {current.material.unit}</dd>
            <dt>Required by</dt><dd>{formatDate(current.requiredBy)}</dd>
            <dt>Reason</dt><dd>{current.purpose}{current.workArea ? ` · ${current.workArea}` : ''}{current.taskId ? ` · task ${current.taskId}` : ''}</dd>
            {current.remarks && <><dt>Notes</dt><dd>{current.remarks}</dd></>}
            {current.attachments?.length > 0 && <><dt>Attachments</dt><dd>{current.attachments.join(', ')}</dd></>}
            {[MR.REJECTED, MR.RETURNED, MR.CANCELLED].includes(current.status) && <><dt>{current.status === MR.RETURNED ? 'Clarification needed' : current.status === MR.CANCELLED ? 'Cancelled' : 'Rejection reason'}</dt><dd className="down">{current.reason}</dd></>}
          </dl>
          {own(current) && EDITABLE_REQUEST_STATUSES.includes(current.status) && (
            <div className="cell-actions" style={{ marginTop: 10 }}>
              <button className="btn btn-primary btn-sm" onClick={() => setEditId(current.id)}>{current.status === MR.RETURNED ? 'Correct and resubmit' : 'Edit and submit'}</button>
              <button className="btn btn-sm" onClick={() => setCancelId(current.id)}>Cancel request</button>
            </div>
          )}
          <section className="drawer-section"><h3>Tracking</h3><Tracker r={current} ctx={ctx} /></section>
          {current.status === MR.SUBMITTED && <div className="info-note" style={{ marginTop: 12 }}><span>ℹ</span><div>With the Store Keeper for a stock check; it then goes to <b>{pmOf(current.site?.projectId)}</b> (Project Manager) whatever the stock.</div></div>}
          {current.status === MR.PM_REVIEW && <div className="info-note" style={{ marginTop: 12 }}><span>ℹ</span><div>With <b>{pmOf(current.site?.projectId)}</b> (Project Manager) for review of need, quantity, urgency and budget. You cannot approve it yourself.</div></div>}
          {ctx.perms.request && [MR.APPROVED, MR.PARTIAL, MR.ISSUED].includes(current.status) && <AdditionalQty key={current.id} r={current} ctx={ctx} onDone={() => setOpenId(null)} />}
          <section className="drawer-section"><h3>History</h3>{current.history?.length ? <HistoryList items={current.history} /> : <p className="cell-sub">Earlier demo record: summarised above.</p>}</section>
        </Drawer>
      )}
    </>
  )
}
