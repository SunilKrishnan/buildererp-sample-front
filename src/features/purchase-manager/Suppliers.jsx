import { useEffect, useRef, useState } from 'react'
import DataTable from '../../components/DataTable.jsx'
import Icon from '../../components/Icon.jsx'
import { Badge, Card } from '../../components/UI.jsx'
import { materialOf } from '../../services/inventory.js'
import { poStatusOf, supplierInUse, supplierStats, validateSupplier } from '../../services/procurement.js'
import { formatDate } from '../../utils/format.js'
import { Drawer, HistoryList, Locked } from '../store-keeper/shared.jsx'
import { money, STARS, useAct } from './shared.jsx'

const blank = { name: '', contact: '', phone: '', email: '', address: '', gstin: '', skus: [], creditDays: '30', paymentTerms: '30 days credit', status: 'Active', quality: '3', notes: '' }
const Err = ({ msg }) => (msg ? <span className="field-error">{msg}</span> : null)

function SupplierForm({ inv, perms, notify, supplier, onClose }) {
  const editing = !!supplier
  const [f, setF] = useState(editing ? { ...blank, ...supplier, creditDays: String(supplier.creditDays), quality: String(supplier.quality || 3) } : blank)
  const [tried, setTried] = useState(false)
  const { act, error } = useAct(inv, perms, notify)
  const cardRef = useRef(null)
  const nameLocked = editing && supplierInUse(inv.state, supplier.name)
  useEffect(() => {
    cardRef.current?.querySelector('input:not([disabled])')?.focus()
    const onKey = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
  const errs = tried ? validateSupplier(f, inv.state.suppliers, supplier?.id) : {}
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value })
  const toggleSku = (sku) => setF({ ...f, skus: f.skus.includes(sku) ? f.skus.filter((s) => s !== sku) : [...f.skus, sku] })
  const save = (e) => {
    e.preventDefault()
    setTried(true)
    if (Object.keys(validateSupplier(f, inv.state.suppliers, supplier?.id)).length) return
    if (act(editing ? 'updateSupplier' : 'addSupplier', editing ? { ...f, id: supplier.id } : f)) onClose()
  }
  return (
    <div className="modal sk-material-modal" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div ref={cardRef} className="modal-card" role="dialog" aria-modal="true" aria-labelledby="sup-title">
        <div className="modal-head">
          <h3 id="sup-title">{editing ? `Edit supplier · ${supplier.id}` : 'Add Supplier'}</h3>
          <button className="icon-btn" onClick={onClose} aria-label="Close"><Icon name="x" /></button>
        </div>
        <form className="form" onSubmit={save} noValidate>
          <div className="sk-form-section">Supplier</div>
          <label>Supplier name<input value={f.name} onChange={set('name')} disabled={nameLocked} aria-invalid={!!errs.name} /><Err msg={errs.name} /></label>
          {nameLocked && <p className="cell-sub sk-modal-hint"><Icon name="lock" size={12} /> Name is locked: purchase orders and quotations refer to it.</p>}
          <div className="form-row">
            <label>Contact person<input value={f.contact} onChange={set('contact')} aria-invalid={!!errs.contact} /><Err msg={errs.contact} /></label>
            <label>Phone<input value={f.phone} onChange={set('phone')} aria-invalid={!!errs.phone} /><Err msg={errs.phone} /></label>
          </div>
          <div className="form-row">
            <label>Email<input type="email" value={f.email} onChange={set('email')} aria-invalid={!!errs.email} /><Err msg={errs.email} /></label>
            <label>GSTIN<input value={f.gstin} onChange={set('gstin')} placeholder="Optional" /></label>
          </div>
          <label>Address<input value={f.address} onChange={set('address')} placeholder="Optional" /></label>
          <div className="sk-form-section">Terms</div>
          <div className="form-row">
            <label>Payment terms<input value={f.paymentTerms} onChange={set('paymentTerms')} placeholder="e.g. 30 days credit" aria-invalid={!!errs.paymentTerms} /><Err msg={errs.paymentTerms} /></label>
            <label>Credit days (for invoice due dates)<input type="number" min="0" step="1" value={f.creditDays} onChange={set('creditDays')} aria-invalid={!!errs.creditDays} /><Err msg={errs.creditDays} /></label>
          </div>
          <div className="form-row">
            <label>Status
              <select value={f.status} onChange={set('status')}>{['Active', 'On Hold', 'Blocked'].map((s) => <option key={s}>{s}</option>)}</select>
            </label>
            <label>Quality rating (1–5)
              <select value={f.quality} onChange={set('quality')}>{[5, 4, 3, 2, 1].map((n) => <option key={n} value={n}>{n} {STARS(n)}</option>)}</select>
            </label>
          </div>
          <label>Notes{f.status !== 'Active' ? ' (reason required)' : ''}<input value={f.notes} onChange={set('notes')} aria-invalid={!!errs.notes} /><Err msg={errs.notes} /></label>
          <div className="sk-form-section">Materials supplied</div>
          <div className="pm-sku-grid">
            {inv.state.materials.map((m) => (
              <label key={m.sku} className="check-row"><input type="checkbox" checked={f.skus.includes(m.sku)} onChange={() => toggleSku(m.sku)} /><span>{m.name}</span></label>
            ))}
          </div>
          <p className="cell-sub sk-modal-hint">Demo: supplier records are temporary and reset on reload. Nothing is saved to a database.</p>
          {(error || (tried && Object.keys(errs).length > 0)) && <div className="form-error" role="alert"><Icon name="alert" size={14} />{error || 'Please fix the highlighted fields.'}</div>}
          <div className="modal-foot">
            <button type="button" className="btn" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary">{editing ? 'Save changes' : 'Add supplier'}</button>
          </div>
        </form>
      </div>
    </div>
  )
}

function SupplierDetail({ s, inv, onClose, canEdit, onEdit }) {
  const st = supplierStats(inv.state, s.name)
  const pos = inv.state.purchaseOrders.filter((p) => p.vendor === s.name)
  return (
    <Drawer title={s.name} sub={`${s.id} · ${s.status}`} onClose={onClose} wide
      foot={canEdit ? <button className="btn btn-primary" onClick={onEdit}>Edit supplier</button> : <span className="cell-sub">View only. Supplier records are maintained by the Purchase Manager.</span>}>
      <dl className="details">
        <dt>Contact</dt><dd>{s.contact}{s.phone ? ` · ${s.phone}` : ''}{s.email ? ` · ${s.email}` : ''}</dd>
        <dt>Address</dt><dd>{s.address || '—'}</dd>
        <dt>GSTIN</dt><dd>{s.gstin || '—'}</dd>
        <dt>Payment terms</dt><dd>{s.paymentTerms} ({s.creditDays} days for due dates)</dd>
        <dt>Materials</dt><dd>{(s.skus || []).map((k) => materialOf(k)?.name).filter(Boolean).join(', ') || s.services || '—'}</dd>
        <dt>Quality</dt><dd>{STARS(s.quality || 0)}</dd>
        <dt>Status</dt><dd><Badge>{s.status}</Badge>{s.notes ? ` ${s.notes}` : ''}</dd>
      </dl>
      <div className="stat-grid compact-stats">
        <div className="stat"><div className="k">Orders</div><div className="v">{st.orders}</div><div className="s">{money(st.value)} before GST</div></div>
        <div className="stat"><div className="k">On-time deliveries</div><div className="v">{st.onTimePct == null ? '—' : `${st.onTimePct}%`}</div><div className="s">{st.onTime} on time · {st.late} late</div></div>
        <div className="stat"><div className="k">Average delay</div><div className="v">{st.late ? `${st.avgDelay} d` : '—'}</div></div>
        <div className="stat"><div className="k">Rejected on delivery</div><div className="v">{st.rejectionPct == null ? '—' : `${st.rejectionPct}%`}</div></div>
      </div>
      <section className="drawer-section">
        <h3>Price history</h3>
        <DataTable rowKey="source" rows={st.prices} emptyText="No prices recorded yet." columns={[
          { key: 'date', header: 'Date', render: (r) => formatDate(r.date) },
          { key: 'm', header: 'Material', render: (r) => materialOf(r.sku)?.name },
          { key: 'rate', header: 'Rate', align: 'num', render: (r) => money(r.rate) },
          { key: 'kind', header: 'Source', render: (r) => <>{r.kind}<div className="cell-sub">{r.source}</div></> },
        ]} />
      </section>
      <section className="drawer-section">
        <h3>Purchase orders</h3>
        <DataTable rows={pos} emptyText="No purchase orders." columns={[
          { key: 'id', header: 'PO' },
          { key: 'date', header: 'Date', render: (p) => formatDate(p.date) },
          { key: 'a', header: 'Value', align: 'num', render: (p) => money(p.amount) },
          { key: 's', header: 'Status', render: (p) => <Badge>{poStatusOf(inv.state, p)}</Badge> },
        ]} />
      </section>
      {s.history?.length > 0 && <section className="drawer-section"><h3>Record history</h3><HistoryList items={s.history} /></section>}
    </Drawer>
  )
}

/** Supplier directory. Purchase Manager / Admin can add and edit; Accounts views only. */
export default function Suppliers({ inv, perms, notify, search }) {
  const [form, setForm] = useState(null) // { supplier? }
  const [viewId, setViewId] = useState(null)
  const [status, setStatus] = useState('all')
  const [q, setQ] = useState('')
  const text = `${q} ${search || ''}`.trim().toLowerCase()
  const rows = inv.state.suppliers
    .map((s) => ({ ...s, st: supplierStats(inv.state, s.name) }))
    .filter((s) => status === 'all' || s.status === status)
    .filter((s) => !text || `${s.name} ${s.contact} ${(s.skus || []).map((k) => materialOf(k)?.name).join(' ')}`.toLowerCase().includes(text))
    .sort((a, b) => a.name.localeCompare(b.name))
  const viewing = viewId && inv.state.suppliers.find((s) => s.id === viewId)

  return (
    <Card title="Suppliers" sub={perms.suppliers ? 'Supplier records, terms and delivery performance' : 'View only: maintained by the Purchase Manager'} bodyClass=""
      action={perms.suppliers ? <button className="btn btn-primary btn-sm" onClick={() => setForm({})}><Icon name="plus" size={14} />Add Supplier</button> : <Locked>View only</Locked>}>
      <div className="toolbar">
        <div className="filters">
          <label className="field field-search">Search<input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Name, contact, material…" /></label>
          <label className="field">Status
            <select value={status} onChange={(e) => setStatus(e.target.value)}>{['all', 'Active', 'On Hold', 'Blocked'].map((s) => <option key={s} value={s}>{s === 'all' ? 'All' : s}</option>)}</select>
          </label>
        </div>
      </div>
      <DataTable
        dense
        rows={rows}
        emptyText="No suppliers match."
        columns={[
          { key: 'name', header: 'Supplier', render: (s) => <><button className="link-btn" onClick={() => setViewId(s.id)}>{s.name}</button><div className="cell-sub">{s.id}</div></> },
          { key: 'c', header: 'Contact', render: (s) => <><div>{s.contact}</div><div className="cell-sub">{s.phone || s.email}</div></> },
          { key: 'm', header: 'Materials supplied', render: (s) => <span className="wrap-cell">{(s.skus || []).map((k) => materialOf(k)?.name).filter(Boolean).join(', ') || s.services || '—'}</span> },
          { key: 't', header: 'Payment terms', render: (s) => s.paymentTerms },
          { key: 'o', header: 'On time', align: 'num', render: (s) => (s.st.onTimePct == null ? '—' : <span className={s.st.onTimePct < 80 ? 'down' : ''}>{s.st.onTimePct}%</span>) },
          { key: 'r', header: 'Rejected', align: 'num', render: (s) => (s.st.rejectionPct == null ? '—' : `${s.st.rejectionPct}%`) },
          { key: 'v', header: 'Orders', align: 'num', render: (s) => <>{s.st.orders}<div className="cell-sub">{money(s.st.value)}</div></> },
          { key: 'q', header: 'Quality', render: (s) => <span title={`${s.quality} of 5`}>{STARS(s.quality || 0)}</span> },
          { key: 's', header: 'Status', render: (s) => <Badge>{s.status}</Badge> },
          { key: 'x', header: '', render: (s) => <div className="cell-actions"><button className="btn btn-sm" onClick={() => setViewId(s.id)}>View</button>{perms.suppliers && <button className="btn btn-sm" onClick={() => setForm({ supplier: s })}>Edit</button>}</div> },
        ]}
      />
      {viewing && <SupplierDetail s={viewing} inv={inv} canEdit={perms.suppliers} onClose={() => setViewId(null)} onEdit={() => { setForm({ supplier: viewing }); setViewId(null) }} />}
      {form && <SupplierForm inv={inv} perms={perms} notify={notify} supplier={form.supplier} onClose={() => setForm(null)} />}
    </Card>
  )
}
