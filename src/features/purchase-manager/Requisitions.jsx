import { useState } from 'react'
import DataTable from '../../components/DataTable.jsx'
import { Badge, Card } from '../../components/UI.jsx'
import { materialOf, siteOf, storeOf, storeProjectLabel } from '../../services/inventory.js'
import { awaitingComparison, estimateOf, PR_STATUSES } from '../../services/procurement.js'
import { formatDate } from '../../utils/format.js'
import { Drawer, fmtQty, fmtStamp, FormError, HistoryList, Locked } from '../store-keeper/shared.jsx'
import { money, requisitionMeta, useAct } from './shared.jsx'

const OPEN = ['Awaiting Admin Review', 'Sent to Purchase Manager', 'Quotations Requested', 'Supplier Selected']

/** Choose suppliers to ask for a quotation (those who supply the material first). */
export function SupplierPicker({ inv, sku, exclude = [], value, onChange }) {
  const all = inv.state.suppliers.filter((s) => !exclude.includes(s.name))
  const supplies = all.filter((s) => (s.skus || []).includes(sku))
  const others = all.filter((s) => !(s.skus || []).includes(sku))
  const [showAll, setShowAll] = useState(false)
  const toggle = (name) => onChange(value.includes(name) ? value.filter((v) => v !== name) : [...value, name])
  const row = (s) => (
    <label key={s.id} className={`check-row ${s.status === 'Blocked' ? 'muted' : ''}`}>
      <input type="checkbox" checked={value.includes(s.name)} disabled={s.status === 'Blocked'} onChange={() => toggle(s.name)} />
      <span>{s.name} <span className="cell-sub">· {s.paymentTerms}{s.status !== 'Active' ? ` · ${s.status}` : ''}</span></span>
    </label>
  )
  return (
    <div className="pm-picker">
      {supplies.length ? supplies.map(row) : <p className="cell-sub">No supplier on record supplies this material yet.</p>}
      {others.length > 0 && <button type="button" className="link-btn" onClick={() => setShowAll(!showAll)}>{showAll ? 'Hide other suppliers' : `Show ${others.length} other suppliers`}</button>}
      {showAll && others.map(row)}
      {exclude.length > 0 && <p className="cell-sub">Already asked: {exclude.join(', ')}</p>}
    </div>
  )
}

function RequisitionDrawer({ pr, inv, perms, notify, onClose, go }) {
  const { act, error } = useAct(inv, perms, notify)
  const [vendors, setVendors] = useState([])
  const [reason, setReason] = useState('')
  const m = materialOf(pr.sku)
  const meta = requisitionMeta(pr, inv)
  const shortage = meta.req ? inv.requests.find((r) => r.id === meta.req.id)?.shortage : null
  const canAsk = perms.manage && ['Sent to Purchase Manager', 'Quotations Requested'].includes(pr.status)
  const canReturn = perms.manage && ['Sent to Purchase Manager', 'Quotations Requested', 'Supplier Selected'].includes(pr.status)
  const adminReview = pr.status === 'Awaiting Admin Review'

  return (
    <Drawer title={pr.id} sub={`${fmtQty(pr.qty, m?.unit)} ${m?.name} · ${storeOf(pr.storeId)?.name}`} onClose={onClose}>
      <dl className="details">
        <dt>Status</dt><dd><Badge>{pr.status}</Badge></dd>
        <dt>Project / store</dt><dd>{storeOf(pr.storeId)?.name} · {storeProjectLabel(storeOf(pr.storeId))}</dd>
        <dt>Reason</dt><dd>{pr.reason}</dd>
        <dt>Stock now</dt><dd>{meta.row ? `${fmtQty(meta.row.availableForIssue, m.unit)} free for issue (reorder level ${meta.row.reorder}) · ${meta.row.status}` : 'Not stocked at this store yet'}</dd>
        <dt>Origin</dt><dd>{meta.req ? `Site request ${meta.req.id} (${meta.req.status}): ${siteOf(meta.req.siteId)?.name}, ${meta.req.requestedBy}${shortage ? ` · short by ${shortage} ${m.unit}` : ''}` : 'Reorder — no site request'}</dd>
        {meta.req && <><dt>Outstanding at site</dt><dd>{meta.outstanding ?? '—'} {m.unit} (approved {meta.req.approved ?? '—'}, issued {meta.req.issued}) · required by {meta.req.requiredBy}</dd></>}
        <dt>Priority</dt><dd><Badge>{meta.priority}</Badge></dd>
        <dt>Required by</dt><dd>{meta.requiredBy ? formatDate(meta.requiredBy) : 'Not given'}</dd>
        <dt>Estimate</dt><dd>{money(pr.estimate ?? estimateOf(pr.sku, pr.qty))} at the standard rate</dd>
        <dt>Raised by</dt><dd>{pr.raisedBy} · {fmtStamp(pr.at)}</dd>
        {pr.quotesRequestedFrom?.length > 0 && <><dt>Quotations asked from</dt><dd>{pr.quotesRequestedFrom.join(', ')} ({(pr.quotes || []).length} received)</dd></>}
        {pr.poId && <><dt>Purchase order</dt><dd><button className="link-btn" onClick={() => go('orders', { po: pr.poId })}>{pr.poId}</button></dd></>}
        {pr.returnReason && <><dt>Returned / rejected</dt><dd>{pr.returnReason}</dd></>}
      </dl>

      {adminReview && (perms.reviewRequisition ? (
        <section className="drawer-section">
          <h3>Admin review (estimated value above the review limit)</h3>
          <label className="field">Note (required to return or reject)<input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Approved as per BBS rev 2" /></label>
          <div className="jv-submit" style={{ marginTop: 8 }}>
            <button className="btn btn-primary" onClick={() => act('reviewRequisition', { id: pr.id, approve: true, reason }) && onClose()}>Approve for purchase</button>
            <button className="btn" onClick={() => act('reviewRequisition', { id: pr.id, decision: 'return', reason }) && onClose()}>Return for correction</button>
            <button className="btn" onClick={() => act('reviewRequisition', { id: pr.id, approve: false, reason }) && onClose()}>Reject</button>
          </div>
        </section>
      ) : <div className="drawer-section"><Locked>Waiting for Admin review before purchasing (above {money(500000)})</Locked></div>)}

      {canAsk && (
        <section className="drawer-section">
          <h3>Request quotations</h3>
          <SupplierPicker inv={inv} sku={pr.sku} exclude={pr.quotesRequestedFrom || []} value={vendors} onChange={setVendors} />
          <div className="jv-submit" style={{ marginTop: 8 }}>
            <button className="btn btn-primary" disabled={!vendors.length} onClick={() => { if (act('requestQuotations', { id: pr.id, vendors })) { setVendors([]); go('quotations', { pr: pr.id }) } }}>
              Request from {vendors.length || ''} supplier{vendors.length === 1 ? '' : 's'}
            </button>
          </div>
          <p className="cell-sub">Demo: this records the request; no email or message is sent to suppliers.</p>
        </section>
      )}

      {canReturn && (
        <section className="drawer-section">
          <h3>Reject or return to Store Keeper</h3>
          <label className="field">Reason (the Store Keeper sees it)<input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Quantity unclear, confirm with site" /></label>
          <div className="jv-submit" style={{ marginTop: 8 }}>
            <button className="btn" onClick={() => act('returnRequisition', { id: pr.id, reason, reject: false }) && onClose()}>Return for clarification</button>
            <button className="btn" onClick={() => act('returnRequisition', { id: pr.id, reason, reject: true }) && onClose()}>Reject</button>
          </div>
        </section>
      )}
      <FormError error={error} />

      <section className="drawer-section">
        <h3>History</h3>
        <HistoryList items={pr.history} />
      </section>
    </Drawer>
  )
}

export default function Requisitions({ inv, perms, notify, go, search }) {
  const [status, setStatus] = useState('open')
  const [openId, setOpenId] = useState(null)
  const q = (search || '').toLowerCase()
  const rows = inv.state.purchaseRequests
    .map((pr) => ({ ...pr, ...requisitionMeta(pr, inv), m: materialOf(pr.sku) }))
    .filter((pr) => status === 'all' || (status === 'open' ? OPEN.includes(pr.status) : pr.status === status))
    .filter((pr) => !q || `${pr.id} ${pr.m?.name} ${pr.reason} ${storeOf(pr.storeId)?.name}`.toLowerCase().includes(q))
    .sort((a, b) => (a.priority === b.priority ? b.at.localeCompare(a.at) : a.priority === 'High' ? -1 : 1))
  const current = openId && inv.state.purchaseRequests.find((p) => p.id === openId)

  const action = (pr) => {
    if (pr.status === 'Awaiting Admin Review') return perms.reviewRequisition ? <button className="btn btn-sm btn-primary" onClick={() => setOpenId(pr.id)}>Review</button> : <Locked>With Admin</Locked>
    if (pr.status === 'Sent to Purchase Manager') return perms.manage ? <div className="cell-actions"><button className="btn btn-sm btn-primary" onClick={() => setOpenId(pr.id)}>Request quotation</button><button className="btn btn-sm" onClick={() => setOpenId(pr.id)}>Reject / return</button></div> : <Locked>Purchase Manager</Locked>
    if (pr.status === 'Quotations Requested') return <button className="btn btn-sm" onClick={() => go('quotations', { pr: pr.id })}>Quotations ({(pr.quotes || []).length})</button>
    if (pr.status === 'Supplier Selected') return <button className="btn btn-sm btn-primary" onClick={() => go('orders', { create: pr.id })}>Create PO</button>
    if (pr.poId) return <button className="link-btn" onClick={() => go('orders', { po: pr.poId })}>{pr.poId}</button>
    return <button className="btn btn-sm" onClick={() => setOpenId(pr.id)}>View</button>
  }

  return (
    <Card title="Purchase Requisitions" sub="Raised by the Store Keeper for shortages and reorders. Review, then start purchasing." bodyClass="">
      <div className="toolbar">
        <label className="field">Status
          <select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="open">Open</option>
            <option value="all">All requisitions</option>
            {PR_STATUSES.map((s) => <option key={s}>{s}</option>)}
          </select>
        </label>
      </div>
      <DataTable
        dense
        rows={rows}
        emptyText="No requisitions match."
        columns={[
          { key: 'id', header: 'PR no.', render: (p) => <><button className="link-btn" onClick={() => setOpenId(p.id)}>{p.id}</button><div className="cell-sub">{fmtStamp(p.at)}</div></> },
          { key: 'm', header: 'Material', render: (p) => <><div>{p.m?.name}</div><div className="cell-sub">{p.sku}</div></> },
          { key: 'q', header: 'Quantity', align: 'num', render: (p) => fmtQty(p.qty, p.m?.unit) },
          { key: 's', header: 'Project / store', render: (p) => <><div>{storeOf(p.storeId)?.name}</div><div className="cell-sub">{storeProjectLabel(storeOf(p.storeId))}</div></> },
          { key: 'r', header: 'Reason / shortage', render: (p) => <><div className="wrap-cell">{p.reason}</div>{p.row && <div className="cell-sub">{p.row.availableForIssue} {p.m?.unit} free · reorder {p.row.reorder}</div>}</> },
          { key: 'mr', header: 'Site request', render: (p) => (p.req ? <><div className="cell-main">{p.req.id}</div><div className="cell-sub">{p.site?.name} · {p.req.requestedBy}</div><div className="cell-sub">outstanding {p.outstanding ?? '—'} {p.m?.unit} (approved {p.req.approved ?? '—'}, issued {p.req.issued})</div></> : <span className="cell-sub">Reorder — no site request</span>) },
          { key: 'p', header: 'Priority', render: (p) => <Badge>{p.priority}</Badge> },
          { key: 'd', header: 'Required by', render: (p) => (p.requiredBy ? formatDate(p.requiredBy) : '—') },
          { key: 'st', header: 'Status', render: (p) => <><Badge>{p.status}</Badge>{awaitingComparison(p) && <div><Badge tone="warning">Ready to compare</Badge></div>}{p.status === 'Returned to Store Keeper' && p.returnReason && <div className="cell-sub wrap-cell">{p.returnReason}</div>}</> },
          { key: 'x', header: 'Action', render: action },
        ]}
      />
      {current && <RequisitionDrawer pr={current} inv={inv} perms={perms} notify={notify} go={go} onClose={() => setOpenId(null)} />}
    </Card>
  )
}
