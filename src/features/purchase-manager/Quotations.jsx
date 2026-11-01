import { useState } from 'react'
import DataTable from '../../components/DataTable.jsx'
import { Badge, Card } from '../../components/UI.jsx'
import { GST_BY_SKU } from '../../data/demo/procurementDemo.js'
import { materialOf, storeOf } from '../../services/inventory.js'
import { awaitingComparison, compareQuotes, validateQuote } from '../../services/procurement.js'
import { addDays, todayISO } from '../../utils/date.js'
import { formatDate } from '../../utils/format.js'
import { fmtQty, fmtStamp, FormError, Locked } from '../store-keeper/shared.jsx'
import { SupplierPicker } from './Requisitions.jsx'
import { money, STARS, useAct } from './shared.jsx'

function QuoteForm({ pr, inv, perms, notify }) {
  const pending = (pr.quotesRequestedFrom || []).filter((v) => !(pr.quotes || []).some((q) => q.vendor === v))
  const supplierOf = (name) => inv.state.suppliers.find((s) => s.name === name)
  const defaults = (vendor) => ({ vendor, rate: '', gstRate: String(GST_BY_SKU[pr.sku] ?? 18), transport: '0', deliveryDays: '', paymentTerms: supplierOf(vendor)?.paymentTerms || '', quality: String(supplierOf(vendor)?.quality || 3), ref: '', note: '' })
  const [f, setF] = useState(defaults(pending[0] || ''))
  const [tried, setTried] = useState(false)
  const { act, error } = useAct(inv, perms, notify)
  const local = validateQuote(f)
  const set = (k) => (e) => setF(k === 'vendor' ? defaults(e.target.value) : { ...f, [k]: e.target.value })
  const unit = materialOf(pr.sku)?.unit
  return (
    <form className="receipt-form" onSubmit={(e) => { e.preventDefault(); setTried(true); if (!local && act('recordQuote', { id: pr.id, quote: f })) { setTried(false); setF(defaults(pending.find((v) => v !== f.vendor) || '')) } }} noValidate>
      <div className="sub-panel-head"><b>Record a quotation received</b><span className="cell-sub">For {fmtQty(pr.qty, unit)}; rate per {unit?.toLowerCase().replace(/s$/, '')}, before GST</span></div>
      <div className="receipt-grid pm-quote-grid">
        <label className="field">Supplier
          <select value={f.vendor} onChange={set('vendor')}>
            <option value="">Select…</option>
            {pending.length > 0 && <optgroup label="Asked, not yet received">{pending.map((v) => <option key={v}>{v}</option>)}</optgroup>}
            <optgroup label="Other suppliers">{inv.state.suppliers.filter((s) => !pending.includes(s.name) && s.status !== 'Blocked' && !(pr.quotes || []).some((q) => q.vendor === s.name)).map((s) => <option key={s.id}>{s.name}</option>)}</optgroup>
          </select>
        </label>
        <label className="field">Rate (₹ per unit)<input type="number" min="0" step="0.01" value={f.rate} onChange={set('rate')} /></label>
        <label className="field">GST %<input type="number" min="0" max="28" step="1" value={f.gstRate} onChange={set('gstRate')} /></label>
        <label className="field">Transport (₹ total)<input type="number" min="0" step="1" value={f.transport} onChange={set('transport')} /></label>
        <label className="field">Delivery (days)<input type="number" min="0" step="1" value={f.deliveryDays} onChange={set('deliveryDays')} /></label>
        <label className="field">Payment terms<input value={f.paymentTerms} onChange={set('paymentTerms')} /></label>
        <label className="field">Quality (1–5)<select value={f.quality} onChange={set('quality')}>{[5, 4, 3, 2, 1].map((n) => <option key={n} value={n}>{n} {STARS(n)}</option>)}</select></label>
        <label className="field">Supplier quote ref.<input value={f.ref} onChange={set('ref')} placeholder="Optional" /></label>
        <label className="field span-2">Notes<input value={f.note} onChange={set('note')} placeholder="e.g. free unloading, price valid 7 days" /></label>
      </div>
      <div className="sk-form-foot">
        <FormError error={(tried && local) || error} />
        <div className="jv-submit"><button className="btn btn-primary" type="submit">Record quotation</button></div>
      </div>
    </form>
  )
}

function Comparison({ pr, inv, perms, notify, go }) {
  const rows = compareQuotes(pr)
  const m = materialOf(pr.sku)
  const [picked, setPick] = useState(pr.chosenId || '')
  // Until the user picks one, the lowest landed cost is preselected (quotes may arrive after this view opened)
  const pick = picked || rows.find((r) => r.lowest)?.id || ''
  const [reason, setReason] = useState('')
  const [askMore, setAskMore] = useState([])
  const { act, error } = useAct(inv, perms, notify)
  const open = pr.status === 'Quotations Requested'
  const chosen = rows.find((r) => r.id === pick)
  const needReason = chosen && !chosen.lowest
  const sup = (name) => inv.state.suppliers.find((s) => s.name === name)

  return (
    <Card title={`${pr.id} · ${m?.name}`} sub={`${fmtQty(pr.qty, m?.unit)} for ${storeOf(pr.storeId)?.name} · asked ${(pr.quotesRequestedFrom || []).join(', ') || 'no one yet'}`} bodyClass=""
      action={<Badge>{pr.status}</Badge>} className="section-gap">
      <DataTable
        dense
        rows={rows}
        emptyText="No quotations recorded yet."
        columns={[
          { key: 'sel', header: '', render: (r) => (open && perms.manage ? <input type="radio" name={`pick-${pr.id}`} checked={pick === r.id} onChange={() => setPick(r.id)} aria-label={`Select ${r.vendor}`} /> : r.chosen ? '✓' : '') },
          { key: 'v', header: 'Supplier', render: (r) => <><div className="cell-main">{r.vendor}</div><div className="cell-sub">{r.id}{r.ref ? ` · ${r.ref}` : ''} · {fmtStamp(r.receivedAt)}{sup(r.vendor)?.status !== 'Active' ? ` · ${sup(r.vendor)?.status}` : ''}</div></> },
          { key: 'rate', header: 'Rate', align: 'num', render: (r) => money(r.rate) },
          { key: 'goods', header: 'Goods', align: 'num', render: (r) => money(r.goods) },
          { key: 'gst', header: 'GST', align: 'num', render: (r) => <>{money(r.gst)}<div className="cell-sub">{r.gstRate}%</div></> },
          { key: 'tr', header: 'Transport', align: 'num', render: (r) => money(r.transport) },
          { key: 'total', header: 'Landed cost', align: 'num', render: (r) => <><b>{money(r.total)}</b>{r.lowest ? <div><Badge tone="success">Lowest</Badge></div> : <div className="cell-sub down">+{money(r.overLowest)}</div>}</> },
          { key: 'd', header: 'Delivery', render: (r) => <>{r.deliveryDays} days{r.fastest && <div><Badge tone="info">Fastest</Badge></div>}<div className="cell-sub">by {formatDate(addDays(todayISO(), r.deliveryDays))}</div></> },
          { key: 't', header: 'Payment terms', render: (r) => <span className="wrap-cell">{r.paymentTerms}</span> },
          { key: 'q', header: 'Quality', render: (r) => <>{STARS(r.quality)}{r.bestQuality && <div><Badge tone="success">Best</Badge></div>}</> },
          { key: 'n', header: 'Notes', render: (r) => <span className="cell-sub wrap-cell">{r.note || '—'}</span> },
        ]}
      />

      <div style={{ padding: '14px 18px' }}>
        {pr.chosenId && !open && (
          <div className="info-note"><span>✓</span><div><b>Selected: {rows.find((r) => r.chosen)?.vendor}</b> by {pr.selectedBy} on {fmtStamp(pr.selectedAt)}. Reason: {pr.selectionReason}
            {pr.status === 'Supplier Selected' && perms.manage && <div style={{ marginTop: 8 }}><button className="btn btn-primary btn-sm" onClick={() => go('orders', { create: pr.id })}>Create purchase order</button></div>}
            {pr.poId && <div className="cell-sub">Purchase order: <button className="link-btn" onClick={() => go('orders', { po: pr.poId })}>{pr.poId}</button></div>}
          </div></div>
        )}
        {open && perms.manage && rows.length >= 2 && (
          <div className="receipt-form" style={{ marginBottom: 12 }}>
            <div className="sub-panel-head"><b>Select supplier</b><span className="cell-sub">Look beyond price: delivery date, payment terms, quality and supplier record all count.</span></div>
            <label className="field span-2" style={{ margin: '0 14px' }}>Reason for choice{needReason ? ` (required: ${money(chosen.overLowest)} above the lowest)` : ' (optional)'}
              <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. delivers in 3 days for the pour; lowest needs 50% advance" />
            </label>
            <div className="sk-form-foot">
              <FormError error={error} />
              <div className="jv-submit"><button className="btn btn-primary" disabled={!pick} onClick={() => act('selectSupplier', { id: pr.id, quoteId: pick, reason })}>Select {chosen?.vendor || 'supplier'}</button></div>
            </div>
          </div>
        )}
        {open && rows.length < 2 && <p className="cell-sub">At least two quotations are needed to compare before selecting a supplier.</p>}
        {open && (perms.manage ? <>
          <QuoteForm pr={pr} inv={inv} perms={perms} notify={notify} key={(pr.quotes || []).length} />
          <details className="pm-more">
            <summary>Ask more suppliers</summary>
            <SupplierPicker inv={inv} sku={pr.sku} exclude={pr.quotesRequestedFrom || []} value={askMore} onChange={setAskMore} />
            <button className="btn btn-sm" disabled={!askMore.length} onClick={() => act('requestQuotations', { id: pr.id, vendors: askMore }) && setAskMore([])}>Request quotations</button>
          </details>
        </> : <Locked>Quotations are handled by the Purchase Manager</Locked>)}
      </div>
    </Card>
  )
}

export default function Quotations({ inv, perms, notify, go, params, setParams }) {
  const withQuotes = inv.state.purchaseRequests.filter((p) => p.quotesRequestedFrom?.length || p.quotes?.length)
  const selectedId = params.get('pr') || withQuotes.find(awaitingComparison)?.id || withQuotes.find((p) => p.status === 'Quotations Requested')?.id
  const current = selectedId && inv.state.purchaseRequests.find((p) => p.id === selectedId)
  const choose = (id) => setParams({ tab: 'quotations', pr: id })

  return (
    <>
      <Card title="Quotations & comparison history" sub="Every requisition sent for quotations, with the comparison kept for audit" bodyClass="">
        <DataTable
          dense
          rows={[...withQuotes].sort((a, b) => (b.quotesRequestedAt || b.at).localeCompare(a.quotesRequestedAt || a.at))}
          emptyText="No quotations requested yet. Start from Purchase Requisitions."
          columns={[
            { key: 'id', header: 'Requisition', render: (p) => <button className={`link-btn ${p.id === selectedId ? 'active' : ''}`} onClick={() => choose(p.id)}>{p.id}</button> },
            { key: 'm', header: 'Material', render: (p) => <>{materialOf(p.sku)?.name}<div className="cell-sub">{fmtQty(p.qty, materialOf(p.sku)?.unit)}</div></> },
            { key: 'a', header: 'Asked', render: (p) => <span className="wrap-cell">{(p.quotesRequestedFrom || []).join(', ')}</span> },
            { key: 'r', header: 'Received', align: 'num', render: (p) => `${(p.quotes || []).length} / ${(p.quotesRequestedFrom || []).length}` },
            { key: 'low', header: 'Lowest landed', align: 'num', render: (p) => { const r = compareQuotes(p).find((x) => x.lowest); return r ? <>{money(r.total)}<div className="cell-sub">{r.vendor}</div></> : '—' } },
            { key: 'ch', header: 'Selected', render: (p) => { const r = compareQuotes(p).find((x) => x.chosen); return r ? <>{r.vendor}<div className="cell-sub">{money(r.total)}{r.lowest ? ' · lowest' : ` · +${money(r.overLowest)}`}</div></> : '—' } },
            { key: 's', header: 'Status', render: (p) => <Badge>{awaitingComparison(p) ? 'Ready to compare' : p.status}</Badge> },
          ]}
        />
      </Card>
      {current ? <Comparison key={current.id} pr={current} inv={inv} perms={perms} notify={notify} go={go} /> : null}
    </>
  )
}
