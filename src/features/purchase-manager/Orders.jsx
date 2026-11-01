import { useState } from 'react'
import DataTable from '../../components/DataTable.jsx'
import Icon from '../../components/Icon.jsx'
import { Badge, Card } from '../../components/UI.jsx'
import { STORES } from '../../data/demo/inventoryDemo.js'
import { materialOf, storeOf, storeProjectLabel } from '../../services/inventory.js'
import { compareQuotes, PO_STATUSES, POLICY, poTotals, validatePODraft } from '../../services/procurement.js'
import { addDays, todayISO } from '../../utils/date.js'
import { amountInWordsINR, formatDate } from '../../utils/format.js'
import { Drawer, fmtQty, fmtStamp, FormError, HistoryList, Locked } from '../store-keeper/shared.jsx'
import { money, useAct } from './shared.jsx'

/** Create a PO from a requisition with a selected supplier, or edit a draft PO. */
function POForm({ inv, perms, notify, pr, po, onClose }) {
  const quote = pr ? (pr.quotes || []).find((q) => q.id === pr.chosenId) : null
  const base = po || {
    vendor: quote.vendor, sku: pr.sku, qty: pr.qty, rate: quote.rate, gstRate: quote.gstRate,
    storeId: pr.storeId, transport: quote.transport, paymentTerms: quote.paymentTerms, advancePct: 0, note: '',
    expected: addDays(todayISO(), Math.max(1, quote.deliveryDays)),
  }
  const [f, setF] = useState({ storeId: base.storeId, expected: base.expected, transport: String(base.transport ?? 0), advancePct: String(base.advancePct ?? 0), paymentTerms: base.paymentTerms || '', note: base.note || '' })
  const [tried, setTried] = useState(false)
  const { act, error } = useAct(inv, perms, notify)
  const m = materialOf(base.sku)
  const totals = poTotals({ amount: Math.round(base.qty * base.rate), gstRate: base.gstRate, transport: Number(f.transport) || 0, advancePct: Number(f.advancePct) || 0 })
  const local = validatePODraft(f)
  const needsAdmin = totals.goods > POLICY.PO_PM_APPROVAL_LIMIT
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value })
  const save = (e) => {
    e.preventDefault()
    setTried(true)
    if (local) return
    if (po ? act('updatePODraft', { id: po.id, ...f }) : act('raisePurchaseOrder', { id: pr.id, ...f })) onClose()
  }
  return (
    <Drawer title={po ? `Edit draft ${po.id}` : `New purchase order from ${pr.id}`} sub={`${base.vendor} · ${fmtQty(base.qty, m?.unit)} ${m?.name}`} onClose={onClose}>
      <form className="receipt-form" onSubmit={save} noValidate>
        <div className="sub-panel-head"><b>Purchase order</b><span className="cell-sub">Reference number is assigned when created · saved as a draft</span></div>
        <div className="receipt-grid">
          <div className="field">Supplier<div className="sk-readonly">{base.vendor}</div></div>
          <div className="field">Material<div className="sk-readonly">{m?.name}</div></div>
          <div className="field">Quantity<div className="sk-readonly">{fmtQty(base.qty, m?.unit)}</div></div>
          <div className="field">Rate (from quotation)<div className="sk-readonly">{money(base.rate)} + {base.gstRate}% GST</div></div>
          <label className="field">Delivery location
            <select value={f.storeId} onChange={set('storeId')}>{STORES.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select>
          </label>
          <label className="field">Expected delivery date<input type="date" min={todayISO()} value={f.expected} onChange={set('expected')} /></label>
          <label className="field">Transport (₹)<input type="number" min="0" step="1" value={f.transport} onChange={set('transport')} /></label>
          <label className="field">Advance (% of total, if any)<input type="number" min="0" max="100" step="1" value={f.advancePct} onChange={set('advancePct')} /></label>
          <label className="field span-2">Payment terms<input value={f.paymentTerms} onChange={set('paymentTerms')} /></label>
          <label className="field span-2">Notes to supplier<input value={f.note} onChange={set('note')} placeholder="Optional, e.g. deliver in lots of 500 bags" /></label>
        </div>
        <dl className="details pm-totals">
          <dt>Goods value</dt><dd>{money(totals.goods)}</dd>
          <dt>GST ({base.gstRate}%)</dt><dd>{money(totals.gst)}</dd>
          <dt>Transport</dt><dd>{money(totals.transport)}</dd>
          <dt><b>PO total</b></dt><dd><b>{money(totals.total)}</b></dd>
          {totals.advance > 0 && <><dt>Advance terms</dt><dd>{money(totals.advance)} ({f.advancePct}%) · paid by Accounts, not from here</dd></>}
        </dl>
        <div className={`info-note ${needsAdmin ? 'warn' : ''} sk-inline-note`}><span>{needsAdmin ? '⚠' : 'ℹ'}</span><div>
          {needsAdmin
            ? `Goods value is above ${money(POLICY.PO_PM_APPROVAL_LIMIT)}: after you submit, Admin must approve before the order is sent.`
            : `Within your ${money(POLICY.PO_PM_APPROVAL_LIMIT)} approval limit: approved when you submit, then you send it to the supplier.`}
        </div></div>
        <div className="sk-form-foot">
          <FormError error={(tried && local) || error} />
          <div className="jv-submit">
            <button className="btn btn-primary" type="submit">{po ? 'Save draft' : 'Create draft PO'}</button>
            <button className="btn" type="button" onClick={onClose}>Cancel</button>
          </div>
        </div>
      </form>
      {pr && quote && (
        <p className="cell-sub" style={{ marginTop: 10, whiteSpace: 'normal' }}>
          Selected from {compareQuotes(pr).length} quotations: {pr.selectionReason}
        </p>
      )}
    </Drawer>
  )
}

/** Printable purchase order (reuses the voucher layout). Download saves an HTML copy in the browser. */
function PODocument({ po, onClose }) {
  const m = po.material
  const download = () => {
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>${po.id}</title><style>body{font-family:system-ui,sans-serif;max-width:760px;margin:24px auto;color:#111}table{width:100%;border-collapse:collapse}td,th{border-bottom:1px solid #ddd;padding:6px;text-align:left}.num{text-align:right}.demo{color:#b45309;font-weight:700}</style></head><body>${document.getElementById('po-doc').innerHTML}</body></html>`
    const url = URL.createObjectURL(new Blob([html], { type: 'text/html' }))
    const a = document.createElement('a')
    a.href = url; a.download = `${po.id}-demo.html`; a.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }
  return (
    <div className="voucher-scrim" onClick={onClose}>
      <div className="voucher-dialog" role="dialog" aria-modal="true" aria-labelledby="po-doc-title" onClick={(e) => e.stopPropagation()}>
        <div className="voucher-actions no-print">
          <button className="btn" onClick={() => window.print()}><Icon name="file" />Print</button>
          <button className="btn" onClick={download}><Icon name="download" />Download</button>
          <button className="btn" onClick={onClose}>Close</button>
        </div>
        <div className="voucher" id="po-doc">
          <div className="voucher-watermark">DEMO</div>
          <div className="voucher-head">
            <div><div className="voucher-company">BuildDesk Constructions</div><div className="cell-sub">Purchase department · Pune</div></div>
            <div className="voucher-no"><div className="voucher-title" id="po-doc-title">Purchase Order</div><b>{po.id}</b><div className="cell-sub">Date {formatDate(po.date)} · {po.status}</div></div>
          </div>
          <p className="voucher-line"><b>To:</b> {po.vendor}<br /><b>Deliver to:</b> {po.store?.name || '—'} ({storeProjectLabel(po.store)}) by <b>{formatDate(po.expected)}</b></p>
          <table className="doc-lines">
            <thead><tr><th>Material</th><th className="num">Qty</th><th className="num">Rate</th><th className="num">Amount</th></tr></thead>
            <tbody><tr><td>{m?.name || po.item} {po.sku ? `(${po.sku})` : ''}</td><td className="num">{fmtQty(po.qty, m?.unit)}</td><td className="num">{money(po.rate)}</td><td className="num">{money(po.goods)}</td></tr></tbody>
            <tfoot>
              <tr><td colSpan="3">GST {po.gstRate}%</td><td className="num">{money(po.gst)}</td></tr>
              <tr><td colSpan="3">Transport</td><td className="num">{money(po.transport)}</td></tr>
              <tr className="total"><td colSpan="3">PO total</td><td className="num">{money(po.total)}</td></tr>
            </tfoot>
          </table>
          <p className="cell-sub">{amountInWordsINR(po.total)}</p>
          <p className="voucher-line"><b>Payment terms:</b> {po.paymentTerms}{po.advancePct ? ` · Advance ${po.advancePct}% (${money(po.advance)})` : ''}<br />
            {po.note && <><b>Notes:</b> {po.note}<br /></>}
            <b>Requisition:</b> {po.requisitionId || '—'} · <b>Raised by:</b> {po.raisedBy} · <b>Approved by:</b> {po.approvedBy || 'Not yet approved'}</p>
          <p className="voucher-demo">DEMO DOCUMENT: illustrative only, not a valid purchase order. Nothing has been sent to the supplier.</p>
        </div>
      </div>
    </div>
  )
}

function PODetail({ po, inv, perms, notify, onClose, onEdit, onPrint, go }) {
  const { act, error } = useAct(inv, perms, notify)
  const [reason, setReason] = useState('')
  const own = po.raisedBy === perms.user.name
  return (
    <Drawer title={po.id} sub={`${po.vendor} · ${po.material?.name || po.item}`} onClose={onClose}
      foot={<button className="btn" onClick={onPrint}><Icon name="file" />Print / download</button>}>
      <dl className="details">
        <dt>Status</dt><dd><Badge>{po.status}</Badge></dd>
        <dt>Material</dt><dd>{po.material ? `${fmtQty(po.qty, po.unit)} ${po.material.name} @ ${money(po.rate)}` : po.item}</dd>
        <dt>Totals</dt><dd>Goods {money(po.goods)} + GST {money(po.gst)} + transport {money(po.transport)} = <b>{money(po.total)}</b></dd>
        <dt>Deliver to</dt><dd>{po.store?.name || '—'} by {formatDate(po.expected)}{po.originalExpected && po.originalExpected !== po.expected ? ` (originally ${formatDate(po.originalExpected)})` : ''}</dd>
        <dt>Payment terms</dt><dd>{po.paymentTerms}{po.advancePct ? ` · ${po.advancePct}% advance (${money(po.advance)})` : ''}</dd>
        <dt>Requisition</dt><dd>{po.requisitionId ? <button className="link-btn" onClick={() => go('quotations', { pr: po.requisitionId })}>{po.requisitionId} (comparison)</button> : '—'}{po.requestRef ? ` · site request ${po.requestRef}` : po.requisitionId ? ' · Reorder — no site request' : ''}</dd>
        <dt>Delivery (from GRNs)</dt><dd>Ordered {po.qty} · delivered {po.delivered} · accepted {po.accepted} · rejected {po.rejected} · pending {po.pending}{po.pendingInspection ? ` · ${po.pendingInspection} GRN awaiting inspection` : ''}</dd>
        <dt>Raised / approved</dt><dd>{po.raisedBy} · {po.approvedBy ? `approved by ${po.approvedBy}` : `needs ${po.needs} approval`}</dd>
        <dt>Sent to supplier</dt><dd>{po.sentAt ? `${fmtStamp(po.sentAt)} by ${po.sentBy}` : 'Not sent'}</dd>
        {po.cancelReason && <><dt>Cancelled</dt><dd>{po.cancelReason}</dd></>}
        {po.decisionNote && <><dt>Approver note</dt><dd>{po.decisionNote}{po.decidedBy ? ` (${po.decidedBy}, ${fmtStamp(po.decidedAt)})` : ''}</dd></>}
      </dl>
      {po.status === 'Draft' && po.returnNote && <div className="info-note warn" style={{ marginTop: 10 }}><span>⚠</span><div><b>Returned for correction:</b> {po.returnNote}. Edit the draft and submit again.</div></div>}

      {po.status === 'Pending Approval' && (perms.approvePO && !own ? (
        <section className="drawer-section">
          <h3>Admin approval</h3>
          <label className="field">Note (required to return or reject)<input value={reason} onChange={(e) => setReason(e.target.value)} /></label>
          <div className="jv-submit" style={{ marginTop: 8 }}>
            <button className="btn btn-primary" onClick={() => act('decidePurchaseOrder', { id: po.id, approve: true, reason }) && onClose()}>Approve PO</button>
            <button className="btn" onClick={() => act('decidePurchaseOrder', { id: po.id, decision: 'return', reason }) && onClose()}>Return for correction</button>
            <button className="btn" onClick={() => act('decidePurchaseOrder', { id: po.id, approve: false, reason }) && onClose()}>Reject</button>
          </div>
        </section>
      ) : <div className="drawer-section"><Locked>{own ? 'Raised by you. Another approver must decide' : `Waiting for Admin approval (above ${money(POLICY.PO_PM_APPROVAL_LIMIT)})`}</Locked></div>)}

      {perms.manage && ['Draft', 'Pending Approval', 'Approved'].includes(po.status) && (
        <section className="drawer-section">
          <h3>Actions</h3>
          <div className="cell-actions">
            {po.status === 'Draft' && <button className="btn" onClick={onEdit}>Edit draft</button>}
            {po.status === 'Draft' && <button className="btn btn-primary" onClick={() => act('submitPurchaseOrder', { id: po.id })}>Submit</button>}
            {po.status === 'Approved' && <button className="btn btn-primary" onClick={() => act('sendPurchaseOrder', { id: po.id })}>Send to supplier</button>}
          </div>
          {!po.grns.length && (
            <div style={{ marginTop: 12 }}>
              <label className="field">Cancel reason<input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. supplier withdrew quotation" /></label>
              <button className="btn btn-sm" style={{ marginTop: 6 }} onClick={() => act('cancelPurchaseOrder', { id: po.id, reason }) && onClose()}>Cancel PO</button>
            </div>
          )}
        </section>
      )}
      <FormError error={error} />
      <section className="drawer-section"><h3>History</h3><HistoryList items={po.history} /></section>
    </Drawer>
  )
}

export default function Orders({ inv, perms, notify, go, params, setParams, search }) {
  const [status, setStatus] = useState('all')
  const [edit, setEdit] = useState(null)
  const [print, setPrint] = useState(null)
  const { act, error } = useAct(inv, perms, notify)
  const createId = params.get('create')
  const openId = params.get('po')
  const close = () => setParams({ tab: 'orders' })
  const createPR = createId && inv.state.purchaseRequests.find((p) => p.id === createId && p.status === 'Supplier Selected')
  const ready = inv.state.purchaseRequests.filter((p) => p.status === 'Supplier Selected')
  const q = (search || '').toLowerCase()
  const rows = inv.poViews
    .filter((p) => status === 'all' || p.status === status)
    .filter((p) => !q || `${p.id} ${p.vendor} ${p.material?.name || p.item}`.toLowerCase().includes(q))
    .sort((a, b) => b.id.localeCompare(a.id))
  const current = openId && inv.poViews.find((p) => p.id === openId)
  const editing = edit && inv.poViews.find((p) => p.id === edit)

  const action = (p) => {
    const out = []
    if (p.status === 'Draft' && perms.manage) out.push(<button key="s" className="btn btn-sm btn-primary" onClick={() => act('submitPurchaseOrder', { id: p.id })}>Submit</button>)
    if (p.status === 'Pending Approval') out.push(perms.approvePO && p.raisedBy !== perms.user.name ? <button key="a" className="btn btn-sm btn-primary" onClick={() => setParams({ tab: 'orders', po: p.id })}>Approve / reject</button> : <Locked key="a">With Admin</Locked>)
    if (p.status === 'Approved' && perms.manage) out.push(<button key="snd" className="btn btn-sm btn-primary" onClick={() => act('sendPurchaseOrder', { id: p.id })}>Send to supplier</button>)
    if (p.delayed) out.push(<button key="f" className="btn btn-sm" onClick={() => go('deliveries')}>Follow up</button>)
    out.push(<button key="v" className="btn btn-sm" onClick={() => setParams({ tab: 'orders', po: p.id })}>View</button>)
    return <div className="cell-actions">{out}</div>
  }

  return (
    <>
      {ready.length > 0 && (
        <Card title="Ready for a purchase order" sub="Supplier selected after comparing quotations" bodyClass="">
          <DataTable dense rows={ready} columns={[
            { key: 'id', header: 'Requisition' },
            { key: 'm', header: 'Material', render: (p) => <>{materialOf(p.sku)?.name}<div className="cell-sub">{fmtQty(p.qty, materialOf(p.sku)?.unit)} for {storeOf(p.storeId)?.name}</div></> },
            { key: 'v', header: 'Selected supplier', render: (p) => { const r = compareQuotes(p).find((x) => x.chosen); return <>{r?.vendor}<div className="cell-sub">{money(r?.total)} landed · {r?.deliveryDays} days</div></> } },
            { key: 'x', header: '', render: (p) => (perms.manage ? <button className="btn btn-sm btn-primary" onClick={() => setParams({ tab: 'orders', create: p.id })}>Create PO</button> : <Locked>Purchase Manager</Locked>) },
          ]} />
        </Card>
      )}

      <Card title="Purchase Orders" sub={`Prepared by the Purchase Manager. Above ${money(POLICY.PO_PM_APPROVAL_LIMIT)} (goods value) Admin approves before the order is sent.`} bodyClass="" className={ready.length ? 'section-gap' : ''}>
        <div className="toolbar">
          <label className="field">Status
            <select value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="all">All</option>
              {PO_STATUSES.map((s) => <option key={s}>{s}</option>)}
            </select>
          </label>
          <FormError error={error} />
        </div>
        <DataTable
          dense
          rows={rows}
          emptyText="No purchase orders match."
          columns={[
            { key: 'id', header: 'PO no.', render: (p) => <><button className="link-btn" onClick={() => setParams({ tab: 'orders', po: p.id })}>{p.id}</button><div className="cell-sub">{formatDate(p.date)}</div></> },
            { key: 'v', header: 'Supplier', render: (p) => p.vendor },
            { key: 'm', header: 'Material', render: (p) => <>{p.material?.name || p.item}{p.material && <div className="cell-sub">{fmtQty(p.qty, p.unit)} @ {money(p.rate)}</div>}</> },
            { key: 't', header: 'PO total', align: 'num', render: (p) => <>{money(p.total)}<div className="cell-sub">GST {p.gstRate}%{p.transport ? ` · transport ${money(p.transport)}` : ''}</div></> },
            { key: 'd', header: 'Deliver to / by', render: (p) => <>{p.store?.name || '—'}<div className={`cell-sub ${p.delayed ? 'down' : ''}`}>{formatDate(p.expected)}{p.delayed ? ` · ${p.delayDays}d late` : ''}</div></> },
            { key: 'adv', header: 'Advance', align: 'num', render: (p) => (p.advancePct ? <>{p.advancePct}%<div className="cell-sub">{money(p.advance)}</div></> : '—') },
            { key: 's', header: 'Status', render: (p) => <><Badge>{p.status}</Badge>{p.status === 'Pending Approval' && <div className="cell-sub">needs {p.needs}</div>}</> },
            { key: 'x', header: 'Actions', render: action },
          ]}
        />
      </Card>

      {createPR && <POForm inv={inv} perms={perms} notify={notify} pr={createPR} onClose={close} />}
      {editing && <POForm inv={inv} perms={perms} notify={notify} po={editing} onClose={() => setEdit(null)} />}
      {current && !editing && <PODetail po={current} inv={inv} perms={perms} notify={notify} go={go} onClose={close} onEdit={() => setEdit(current.id)} onPrint={() => setPrint(current.id)} />}
      {print && <PODocument po={inv.poViews.find((p) => p.id === print)} onClose={() => setPrint(null)} />}
    </>
  )
}
