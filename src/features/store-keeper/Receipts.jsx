import { useState } from 'react'
import DataTable from '../../components/DataTable.jsx'
import { Badge, Card } from '../../components/UI.jsx'
import {
  findStock, materialOf, poLines, poReceiptStatus, RECEIVABLE_PO_STATUSES, receiptDiscrepancies, round2, storeOf, storeProjectLabel, validateInspection, validateReceipt,
} from '../../services/inventory.js'
import { todayISO } from '../../utils/date.js'
import { formatDate } from '../../utils/format.js'
import { GrnQuality } from '../qa/links.jsx'
import { ConfirmDialog, Drawer, fmtQty, FormError, GLOSSARY, Locked, qtyStep, StockChange, Term } from './shared.jsx'

const RECEIVABLE = RECEIVABLE_PO_STATUSES // a PO awaiting approval (or rejected) cannot be received against

function ReceiptForm({ inv, perms, initialPo, onDone, notify }) {
  const openPos = poLines(inv.state).map((l) => poReceiptStatus(inv.state, l.po)).filter((p) => RECEIVABLE.includes(p.poStatus) && p.remaining > 0)
  const first = openPos.find((p) => p.po === initialPo) || openPos[0]
  const line0 = first ? findStock(inv.stock, first.sku, first.storeId) : null
  const [f, setF] = useState({
    po: first?.po || '', deliveryDate: todayISO(), delivered: '', inspected: true, accepted: '', rejected: '0', rejectionReason: '',
    deliveryNote: '', invoiceRef: '', location: line0?.location || '', receivedBy: perms.user.name, notes: '', docs: '',
  })
  const [touched, setTouched] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const po = openPos.find((p) => p.po === f.po)
  const m = po ? materialOf(po.sku) : null
  const row = po ? findStock(inv.stock, po.sku, po.storeId) : null
  const set = (k) => (e) => setF({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value })
  const choosePo = (e) => {
    const p = openPos.find((x) => x.po === e.target.value)
    setF({ ...f, po: e.target.value, location: (p && findStock(inv.stock, p.sku, p.storeId)?.location) || '' })
  }
  // Accepted defaults to delivered − rejected while the user has not typed it
  const accepted = f.accepted === '' && f.delivered !== '' ? String(round2(Number(f.delivered) - Number(f.rejected || 0))) : f.accepted
  const form = { ...f, accepted }
  const error = validateReceipt(form, inv.state)
  const preview = po && f.delivered !== '' ? receiptDiscrepancies({ ordered: po.remaining, delivered: Number(f.delivered), rejected: f.inspected ? Number(f.rejected || 0) : 0 }) : []

  if (!openPos.length) return <div className="empty sm">No approved purchase orders are waiting for delivery.</div>

  const submit = (e) => {
    e.preventDefault()
    setTouched(true)
    if (!error) setConfirming(true)
  }
  const confirm = () => {
    if (!inv.actions.recordReceipt({ ...form, storeId: po.storeId }, perms.user)) { notify('This delivery is already recorded.'); onDone(); return }
    notify(f.inspected
      ? `Demo: receipt recorded. ${accepted} ${m.unit} added to usable stock${Number(f.rejected) ? `, ${f.rejected} rejected kept out of stock` : ''} (not saved)`
      : `Demo: delivery recorded as pending inspection. Not added to stock yet (not saved)`)
    onDone()
  }

  return (
    <form className="receipt-form" onSubmit={submit} noValidate>
      <div className="sub-panel-head"><b>Material receipt (GRN)</b><span className="cell-sub">Reference number is assigned on save</span></div>
      <div className="receipt-grid">
        <label className="field span-2">Purchase order
          <select value={f.po} onChange={choosePo}>
            {openPos.map((p) => <option key={p.po} value={p.po}>{p.po} · {materialOf(p.sku).name} · {p.vendor}{p.overdue ? ' · OVERDUE' : ''}</option>)}
          </select>
        </label>
        <div className="field">Supplier<div className="sk-readonly">{po?.vendor}</div></div>
        <div className="field">Project / store<div className="sk-readonly">{storeOf(po.storeId).name}<span className="cell-sub"> · {storeProjectLabel(storeOf(po.storeId))}</span></div></div>
        <div className="field">Material<div className="sk-readonly">{m.name} ({m.unit})</div></div>
        <div className="field">Ordered (still to deliver)<div className="sk-readonly">{fmtQty(po.remaining, m.unit)}<span className="cell-sub"> of {fmtQty(po.qty)} on PO</span></div></div>
        <label className="field">Delivery date<input type="date" value={f.deliveryDate} max={todayISO()} onChange={set('deliveryDate')} /></label>
        <label className="field">Delivered quantity ({m.unit})<input type="number" min="0" step={qtyStep(m.unit)} value={f.delivered} onChange={set('delivered')} placeholder="As counted at the gate" /></label>
        <label className="field span-2">Inspection / verification
          <select value={f.inspected ? 'yes' : 'no'} onChange={(e) => setF({ ...f, inspected: e.target.value === 'yes' })}>
            <option value="yes">Inspected now: record accepted and rejected quantities</option>
            <option value="no">Pending inspection: keep out of usable stock for now</option>
          </select>
        </label>
        {f.inspected && <>
          <label className="field">Accepted quantity<input type="number" min="0" step={qtyStep(m.unit)} value={accepted} onChange={set('accepted')} /></label>
          <label className="field">Rejected / damaged quantity<input type="number" min="0" step={qtyStep(m.unit)} value={f.rejected} onChange={set('rejected')} /></label>
          {Number(f.rejected) > 0 && <label className="field span-2">Reason for rejection / damage<input value={f.rejectionReason} onChange={set('rejectionReason')} placeholder="e.g. 10 bags torn, cement set hard" /></label>}
        </>}
        <label className="field">Delivery note no.<input value={f.deliveryNote} onChange={set('deliveryNote')} placeholder="e.g. CT/DN/5640" /></label>
        <label className="field">Supplier invoice ref. (if available)<input value={f.invoiceRef} onChange={set('invoiceRef')} placeholder="Optional" /></label>
        <label className="field">Storage location<input value={f.location} onChange={set('location')} /></label>
        <label className="field">Received by<input value={f.receivedBy} onChange={set('receivedBy')} /></label>
        <label className="field span-2">Supporting document references<input value={f.docs} onChange={set('docs')} placeholder="Comma separated, e.g. Delivery note scan, Weighbridge slip WB-2231" /></label>
        <label className="field span-2">Notes<input value={f.notes} onChange={set('notes')} placeholder="Optional" /></label>
      </div>
      {preview.length > 0 && (
        <div className="info-note warn sk-inline-note"><span>⚠</span><div><b>Discrepancy will be flagged for review:</b> {preview.join('; ')}.</div></div>
      )}
      <div className="sk-form-foot">
        <FormError error={error} show={touched} />
        <div className="jv-submit">
          <button className="btn btn-primary" type="submit">{f.inspected ? 'Review & confirm receipt' : 'Record as pending inspection'}</button>
          <button className="btn" type="button" onClick={onDone}>Cancel</button>
        </div>
        <p className="cell-sub">Only the accepted quantity becomes usable stock. Rejected or damaged material is recorded separately and never added. A receipt cannot create a purchase order or a supplier payment.</p>
      </div>

      {confirming && (
        <ConfirmDialog title={f.inspected ? `Confirm receipt against ${po.po}?` : 'Record delivery pending inspection?'} confirmLabel="Confirm receipt" onCancel={() => setConfirming(false)} onConfirm={confirm}>
          <p>{fmtQty(Number(f.delivered), m.unit)} of {m.name} from {po.vendor} into {storeOf(po.storeId).name}.</p>
          {f.inspected
            ? <StockChange label="Usable stock" before={row?.onHand || 0} after={round2((row?.onHand || 0) + Number(accepted))} unit={m.unit} />
            : <StockChange label="Usable stock (unchanged until inspected)" before={row?.onHand || 0} after={row?.onHand || 0} unit={m.unit} />}
          {f.inspected && Number(f.rejected) > 0 && <p className="cell-sub">{f.rejected} {m.unit} rejected / damaged: recorded in the damaged register, not added to stock.</p>}
          {preview.length > 0 && <p className="cell-sub">Discrepancy flagged: {preview.join('; ')}.</p>}
        </ConfirmDialog>
      )}
    </form>
  )
}

export function InspectForm({ total, unit, label, onSubmit, onCancel, stockBefore }) {
  const [v, setV] = useState({ accepted: String(total), rejected: '0', reason: '' })
  const [touched, setTouched] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const error = validateInspection({ total, ...v }, unit)
  return (
    <form className="receipt-form" onSubmit={(e) => { e.preventDefault(); setTouched(true); if (!error) setConfirming(true) }} noValidate>
      <div className="sub-panel-head"><b>Inspection</b><span className="cell-sub">{label}: {fmtQty(total, unit)}</span></div>
      <div className="receipt-grid">
        <label className="field">Accepted ({unit})<input type="number" min="0" step={qtyStep(unit)} value={v.accepted} onChange={(e) => setV({ ...v, accepted: e.target.value })} /></label>
        <label className="field">Rejected / damaged ({unit})<input type="number" min="0" step={qtyStep(unit)} value={v.rejected} onChange={(e) => setV({ ...v, rejected: e.target.value })} /></label>
        <label className="field span-2">Reason / inspection notes<input value={v.reason} onChange={(e) => setV({ ...v, reason: e.target.value })} placeholder="Required if anything is rejected" /></label>
      </div>
      <div className="sk-form-foot">
        <FormError error={error} show={touched} />
        <div className="jv-submit">
          <button className="btn btn-primary" type="submit">Complete inspection</button>
          <button className="btn" type="button" onClick={onCancel}>Cancel</button>
        </div>
      </div>
      {confirming && (
        <ConfirmDialog title="Complete inspection?" confirmLabel="Confirm" onCancel={() => setConfirming(false)} onConfirm={() => onSubmit(v)}>
          <StockChange label="Usable stock" before={stockBefore} after={round2(stockBefore + Number(v.accepted))} unit={unit} />
          {Number(v.rejected) > 0 && <p className="cell-sub">{v.rejected} {unit} rejected / damaged are kept out of usable stock.</p>}
        </ConfirmDialog>
      )}
    </form>
  )
}

function DiscrepancyForm({ label, onSubmit, onCancel, placeholder }) {
  const [note, setNote] = useState('')
  return (
    <form className="receipt-form" onSubmit={(e) => { e.preventDefault(); if (note.trim()) onSubmit(note.trim()) }}>
      <div className="sub-panel-head"><b>{label}</b></div>
      <label className="field span-2">Note<input value={note} onChange={(e) => setNote(e.target.value)} placeholder={placeholder} autoFocus /></label>
      <div className="jv-submit">
        <button className="btn btn-primary" type="submit" disabled={!note.trim()}>{label}</button>
        <button className="btn" type="button" onClick={onCancel}>Cancel</button>
      </div>
    </form>
  )
}

function ReceiptDetail({ g, inv, perms, notify, onClose }) {
  const [mode, setMode] = useState(null)
  const m = materialOf(g.sku)
  const row = findStock(inv.stock, g.sku, g.storeId)
  const issues = g.status === 'Accepted' ? receiptDiscrepancies(g) : []
  return (
    <Drawer title={g.id} sub={`${g.po} · ${g.supplier} · ${formatDate(g.deliveryDate)}`} onClose={onClose}>
      <dl className="details">
        <dt>Material</dt><dd>{m.name} ({m.unit})</dd>
        <dt>Project / store</dt><dd>{storeOf(g.storeId).name} · {storeProjectLabel(storeOf(g.storeId))}</dd>
        <dt>Ordered (on this delivery)</dt><dd>{fmtQty(g.ordered, m.unit)}</dd>
        <dt>Delivered</dt><dd>{fmtQty(g.delivered, m.unit)}</dd>
        <dt>Accepted</dt><dd>{g.accepted == null ? 'Not inspected yet' : fmtQty(g.accepted, m.unit)}</dd>
        <dt>Rejected / damaged</dt><dd>{g.rejected == null ? '—' : fmtQty(g.rejected, m.unit)}{g.rejectionReason ? ` · ${g.rejectionReason}` : ''}</dd>
        <dt>Delivery note</dt><dd>{g.deliveryNote}</dd>
        <dt>Supplier invoice</dt><dd>{g.invoiceRef || 'Not received'}</dd>
        <dt>Storage location</dt><dd>{g.location}</dd>
        <dt>Received by</dt><dd>{g.receivedBy}</dd>
        <dt>Inspected by</dt><dd>{g.inspectedBy || '—'}</dd>
        <dt>Status</dt><dd><Badge>{g.status}</Badge></dd>
        <dt>Discrepancy</dt><dd>{g.discrepancy ? <><Badge>{g.discrepancy}</Badge> {issues.join('; ')}{g.discrepancyNote && <div className="cell-sub">{g.discrepancyNote}</div>}</> : 'None'}</dd>
        <dt>Documents</dt><dd>{g.docs?.length ? g.docs.join(', ') : '—'}</dd>
        <dt>Notes</dt><dd>{g.notes || '—'}</dd>
        <GrnQuality grnId={g.id} />
      </dl>

      <div className="drawer-section">
        {g.status === 'Pending Inspection' && (perms.receive
          ? mode === 'inspect'
            ? <InspectForm total={g.delivered} unit={m.unit} label="Delivered" stockBefore={row?.onHand || 0} onCancel={() => setMode(null)}
                onSubmit={(v) => { inv.actions.inspectReceipt(g.id, v, perms.user); notify(`Demo: ${g.id} inspected. ${v.accepted} ${m.unit} added to usable stock (not saved)`); onClose() }} />
            : <button className="btn btn-primary" onClick={() => setMode('inspect')}>Inspect delivery</button>
          : <Locked>Inspection is done by the Store Keeper</Locked>)}

        {g.discrepancy === 'Open' && perms.receive && (mode === 'report'
          ? <DiscrepancyForm label="Report to Purchase Manager" placeholder="e.g. Short by 900 bags; supplier says lots 2 and 3 follow" onCancel={() => setMode(null)}
              onSubmit={(note) => { inv.actions.reportDiscrepancy(g.id, note, perms.user); notify(`Demo: discrepancy on ${g.id} marked as reported. No message was sent`); setMode(null) }} />
          : <button className="btn" onClick={() => setMode('report')}>Report discrepancy</button>)}

        {g.discrepancy && g.discrepancy !== 'Resolved' && (perms.discrepancyReview
          ? mode === 'resolve'
            ? <DiscrepancyForm label="Mark reviewed" placeholder="Outcome, e.g. credit note agreed for 10 bags" onCancel={() => setMode(null)}
                onSubmit={(note) => { inv.actions.resolveDiscrepancy(g.id, note, perms.user); notify(`Demo: discrepancy on ${g.id} marked reviewed (not saved)`); setMode(null) }} />
            : <button className="btn" onClick={() => setMode('resolve')} style={{ marginLeft: 8 }}>Mark discrepancy reviewed</button>
          : <div style={{ marginTop: 8 }}><Locked>Closed by the Purchase Manager / Admin after review</Locked></div>)}
      </div>
    </Drawer>
  )
}

export default function Receipts({ inv, perms, notify, search }) {
  const [form, setForm] = useState(null) // PO number to receive against
  const [detail, setDetail] = useState(null)
  const [status, setStatus] = useState('all')
  const poRows = poLines(inv.state).map((l) => poReceiptStatus(inv.state, l.po))
  const q = (search || '').toLowerCase()
  const receipts = [...inv.state.receipts]
    .filter((g) => status === 'all' || (status === 'disc' ? g.discrepancy && g.discrepancy !== 'Resolved' : g.status === status))
    .filter((g) => !q || `${g.id} ${g.po} ${g.supplier} ${materialOf(g.sku).name}`.toLowerCase().includes(q))
    .sort((a, b) => b.at.localeCompare(a.at))
  const current = detail && inv.state.receipts.find((g) => g.id === detail)

  return (
    <>
      <Card title="Expected deliveries" sub="Purchase order lines and what has arrived. Purchase orders are created by the Purchase Manager, not here." bodyClass=""
        action={perms.receive ? <button className="btn btn-primary" onClick={() => setForm('')}>Record delivery</button> : <Locked>Recorded by the Store Keeper</Locked>}>
        <DataTable
          dense
          rowKey="po"
          rows={poRows}
          columns={[
            { key: 'po', header: 'PO', render: (p) => <><div className="cell-main">{p.po}</div><div className="cell-sub">{p.vendor}</div></> },
            { key: 'm', header: 'Material', render: (p) => <><div>{materialOf(p.sku).name}</div><div className="cell-sub">{storeOf(p.storeId).name}</div></> },
            { key: 'o', header: 'Ordered', align: 'num', render: (p) => fmtQty(p.qty, materialOf(p.sku).unit) },
            { key: 'd', header: 'Delivered', align: 'num', render: (p) => fmtQty(p.delivered) },
            { key: 'a', header: 'Accepted', align: 'num', render: (p) => fmtQty(p.accepted) },
            { key: 'r', header: 'Still to come', align: 'num', render: (p) => fmtQty(p.remaining) },
            { key: 'e', header: 'Expected', render: (p) => <span className={p.overdue ? 'down' : ''}>{formatDate(p.expected)}{p.overdue ? ' · overdue' : ''}</span> },
            { key: 's', header: 'PO status', render: (p) => <Badge>{p.remaining === 0 ? 'Received' : p.delivered > 0 ? 'Partially Received' : p.poStatus}</Badge> },
            {
              key: 'x', header: '', render: (p) => p.remaining > 0 && RECEIVABLE.includes(p.poStatus) && perms.receive
                ? <button className="btn btn-sm" onClick={() => setForm(p.po)}>Receive</button>
                : p.poStatus === 'Pending Approval' ? <span className="cell-sub">PO not approved yet</span> : p.poStatus === 'Rejected' ? <span className="cell-sub">PO rejected</span> : null,
            },
          ]}
        />
      </Card>

      <Card title="Material receipts (GRN)" sub={<>Every supplier delivery recorded at a store. <Term tip={GLOSSARY.grn}>GRN</Term></>} bodyClass="" className="section-gap">
        <div className="toolbar">
          <label className="field">Show
            <select value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="all">All receipts</option>
              <option value="Pending Inspection">Pending inspection</option>
              <option value="Accepted">Accepted</option>
              <option value="disc">With open discrepancy</option>
            </select>
          </label>
        </div>
        <DataTable
          dense
          rows={receipts}
          emptyText="No receipts match."
          columns={[
            { key: 'id', header: 'Receipt ref.', render: (g) => <><button className="link-btn" onClick={() => setDetail(g.id)}>{g.id}</button><div className="cell-sub">{formatDate(g.deliveryDate)}</div></> },
            { key: 'po', header: 'PO / supplier', render: (g) => <><div>{g.po}</div><div className="cell-sub">{g.supplier}</div></> },
            { key: 'm', header: 'Material', render: (g) => <><div>{materialOf(g.sku).name}</div><div className="cell-sub">{storeOf(g.storeId).name}</div></> },
            { key: 'o', header: 'Ordered', align: 'num', render: (g) => fmtQty(g.ordered) },
            { key: 'd', header: 'Delivered', align: 'num', render: (g) => fmtQty(g.delivered) },
            { key: 'a', header: 'Accepted', align: 'num', render: (g) => fmtQty(g.accepted) },
            { key: 'r', header: 'Rejected', align: 'num', render: (g) => <span className={g.rejected ? 'down' : ''}>{fmtQty(g.rejected)}</span> },
            { key: 'u', header: 'Unit', render: (g) => materialOf(g.sku).unit },
            { key: 'by', header: 'Received by', render: (g) => <><div>{g.receivedBy}</div><div className="cell-sub">DN {g.deliveryNote}</div></> },
            { key: 's', header: 'Inspection', render: (g) => <Badge>{g.status}</Badge> },
            { key: 'dc', header: 'Discrepancy', render: (g) => (g.discrepancy ? <Badge>{g.discrepancy}</Badge> : <span className="cell-sub">None</span>) },
            { key: 'x', header: '', render: (g) => <button className="btn btn-sm" onClick={() => setDetail(g.id)}>{g.status === 'Pending Inspection' && perms.receive ? 'Inspect' : 'View'}</button> },
          ]}
        />
      </Card>

      {form !== null && (
        <Drawer title="Record material receipt" sub="Supplier delivery against an approved purchase order" onClose={() => setForm(null)} wide>
          <ReceiptForm inv={inv} perms={perms} initialPo={form} notify={notify} onDone={() => setForm(null)} />
        </Drawer>
      )}
      {current && <ReceiptDetail g={current} inv={inv} perms={perms} notify={notify} onClose={() => setDetail(null)} />}
    </>
  )
}
