import { useState } from 'react'
import { Link } from 'react-router-dom'
import DataTable from '../../components/DataTable.jsx'
import StatGrid from '../../components/StatGrid.jsx'
import { Badge, Card, Chips } from '../../components/UI.jsx'
import { useDemoSession } from '../../auth/DemoSession.jsx'
import { can, PERMISSIONS as P } from '../../auth/demoRoles.js'
import { useInventory } from '../store-keeper/InventoryContext.jsx'
import { useSite } from '../site-engineer/SiteContext.jsx'
import { siteAdminItems, siteOf } from '../../services/site.js'
import { Drawer, FormError, HistoryList, fmtQty, fmtStamp } from '../store-keeper/shared.jsx'
import { damagedRegister, materialOf, storeOf } from '../../services/inventory.js'
import { actorOf, POLICY, poApproverRole, supplierBill } from '../../services/procurement.js'
import { formatCompactINR, formatINR, formatNumber } from '../../utils/format.js'

// Where each kind of item is handled in full
const LINKS = {
  'Purchase order': '/dashboards/purchase-manager?tab=orders',
  'Purchase requisition': '/dashboards/purchase-manager?tab=requisitions',
  'Stock adjustment': '/dashboards/store-keeper?tab=returns',
  'Damaged stock': '/dashboards/store-keeper?tab=returns',
  'Supplier payment': '/accounts/suppliers',
  'Delivery discrepancy': '/dashboards/store-keeper?tab=receipts',
  'Overdue delivery': '/dashboards/purchase-manager?tab=deliveries',
  'Blocked invoice': '/accounts/suppliers',
  'Rejected request': '/dashboards/store-keeper?tab=requests',
  'Material request': '/dashboards/project-manager?tab=materials',
  'QA review': '/site/quality',
  'Safety verification': '/safety/actions',
  'Overdue safety action': '/safety/actions',
  'Permit to work': '/safety/permits',
  'Safety escalation': '/safety/hazards',
  'Site issue': '/site/issues',
  'Delayed work': '/dashboards/project-manager?tab=schedule',
  'Reports awaiting PM': '/dashboards/project-manager?tab=reports',
}

/** Record details and the Admin decision for one item. Decisions go through the shared workflow (who, when, reason). */
function ItemDrawer({ item, inv, site, notify, onClose }) {
  const { user, role } = useDemoSession()
  const actor = actorOf(user, role)
  const [reason, setReason] = useState('')
  const [error, setError] = useState('')
  const r = item.record
  const done = (res, message) => {
    if (!res?.ok && res !== true) { setError(res?.error || 'This item has already been decided or changed. Refresh the list.'); return }
    notify?.(`Demo: ${message || res.message}. Shown on every dashboard for this session; nothing is saved.`)
    onClose()
  }
  const decide = (approve, decision) => {
    setError('')
    switch (item.kind) {
      case 'Purchase order': return done(inv.actions.decidePurchaseOrder({ id: r.id, approve, decision, reason }, actor))
      case 'Purchase requisition': return done(inv.actions.reviewRequisition({ id: r.id, approve, decision, reason }, actor))
      case 'Supplier payment': return done(inv.actions.decidePaymentRelease({ id: r.id, approve, reason }, actor))
      case 'Stock adjustment':
      case 'Damaged stock':
        if (!approve && reason.trim().length < 5) return setError('Give the reason for rejecting.')
        if (r.raisedBy === user.name) return setError('You raised this adjustment; someone else must review it.')
        return done(inv.actions.reviewAdjustment(r.id, approve, reason.trim(), { ...user, role: role.label }), `${r.id} ${approve ? 'approved and applied to stock' : 'rejected; stock unchanged'}`)
      case 'QA review': return done(site.actions.qaReview({ id: r.id, accept: approve, note: reason }, actor))
      case 'Permit to work': return done(site.actions.decidePermit({ id: r.id, approve, note: reason }, actor))
      case 'Site issue':
        if (reason.trim().length < 5) return setError(approve ? 'Write the resolution notes.' : 'Write your comment.')
        return done(site.actions.commentIssue(approve ? { id: r.id, text: reason, status: 'Resolved', resolution: reason } : { id: r.id, text: reason }, actor))
      case 'Delivery discrepancy':
        if (reason.trim().length < 5) return setError('Record the outcome (e.g. credit note agreed for 10 bags).')
        return done(inv.actions.resolveDiscrepancy(r.id, reason.trim(), { ...user, role: role.label }), `discrepancy on ${r.id} marked reviewed`)
      default: return undefined
    }
  }
  const canDecide = {
    'Purchase order': can(role.id, P.PO_APPROVE),
    'Purchase requisition': can(role.id, P.REQUISITION_REVIEW),
    'Supplier payment': can(role.id, P.SUPPLIER_PAYMENT_RELEASE),
    'Stock adjustment': can(role.id, P.STOCK_ADJUST_APPROVE),
    'Damaged stock': can(role.id, P.STOCK_ADJUST_APPROVE),
    'Delivery discrepancy': can(role.id, P.DISCREPANCY_REVIEW),
    'QA review': can(role.id, P.QUALITY_REVIEW) && r.inspector !== user.name,
    'Permit to work': can(role.id, P.PERMIT_APPROVE) && r.preparedBy !== user.name,
    'Site issue': r.assignee?.name === user.name || r.assignee?.role === role.label,
  }[item.kind]

  let details = null
  if (item.kind === 'Purchase order') {
    const pr = r.requisitionId && inv.state.purchaseRequests.find((x) => x.id === r.requisitionId)
    const mr = r.requestRef && inv.requests.find((x) => x.id === r.requestRef)
    details = (
      <dl className="details">
        <dt>Linked records</dt><dd>{[pr && `${pr.id} (${pr.status})`, mr && `${mr.id} (${mr.status}, requested by ${mr.requestedBy})`].filter(Boolean).join(' · ') || 'No requisition'}</dd>
        <dt>Purpose</dt><dd>{pr?.reason || r.note || '—'}</dd>
        <dt>Project / store</dt><dd>{r.projectId} · {storeOf(r.storeId)?.name || '—'}</dd>
        <dt>Supplier</dt><dd>{r.vendor}</dd>
        <dt>Item</dt><dd>{r.sku ? `${fmtQty(r.qty, materialOf(r.sku)?.unit)} ${materialOf(r.sku)?.name} @ ${formatINR(r.rate)}` : r.item}</dd>
        <dt>Value</dt><dd><b>{formatINR(r.amount)}</b></dd>
        <dt>Deliver to</dt><dd>{storeOf(r.storeId)?.name || '—'} by {r.expected}</dd>
        <dt>Raised by</dt><dd>{r.raisedBy}{r.requisitionId ? ` from ${r.requisitionId}` : ''}{r.requestRef ? ` (site request ${r.requestRef})` : ''}</dd>
        <dt>Approval policy</dt><dd>{poApproverRole(r.amount)} approves (Purchase Manager up to {formatINR(POLICY.PO_PM_APPROVAL_LIMIT)}). Approving the site's material request did not approve this PO.</dd>
        <dt>Approval status</dt><dd><Badge>{r.approval}</Badge>{r.approvedBy ? ` by ${r.approvedBy} · ${fmtStamp(r.approvedAt)}` : ''}</dd>
      </dl>
    )
  } else if (item.kind === 'Purchase requisition') {
    details = (
      <dl className="details">
        <dt>Material</dt><dd>{fmtQty(r.qty, materialOf(r.sku)?.unit)} {materialOf(r.sku)?.name}</dd>
        <dt>For store</dt><dd>{storeOf(r.storeId)?.name}</dd>
        <dt>Estimated value</dt><dd><b>{formatINR(item.amount)}</b> (Admin reviews above {formatINR(POLICY.REQUISITION_ADMIN_REVIEW_ABOVE)})</dd>
        <dt>Reason</dt><dd>{r.reason}{r.requestRef ? ` · site request ${r.requestRef}` : ' · Reorder — no site request'}</dd>
        <dt>Raised by</dt><dd>{r.raisedBy} · {fmtStamp(r.at)}</dd>
      </dl>
    )
  } else if (item.kind === 'Material request') {
    const m = inv.requests.find((x) => x.id === r.id) || r
    details = (
      <dl className="details">
        <dt>Requested</dt><dd>{fmtQty(m.requested, materialOf(m.sku)?.unit)} {materialOf(m.sku)?.name} by {m.requestedBy}, needed {m.requiredBy}</dd>
        <dt>Site / store</dt><dd>{siteOf(m.siteId)?.name} · {storeOf(m.storeId)?.name}</dd>
        <dt>Status</dt><dd><Badge>{m.status}</Badge> {m.checkNote ? `· ${m.checkNote}` : ''}</dd>
        <dt>Decided by</dt><dd>The project's Project Manager. Admin does not approve material requests by default.</dd>
      </dl>
    )
  } else if (item.kind === 'Supplier payment') {
    const b = supplierBill(inv.state, r)
    details = (
      <>
        <div className="three-way">
          <div><span className="cell-sub">Ordered</span><b>{formatNumber(b.orderedQty)}</b></div>
          <div><span className="cell-sub">Delivered</span><b>{formatNumber(b.deliveredQty)}</b></div>
          <div><span className="cell-sub">Accepted</span><b>{formatNumber(b.acceptedQty)}</b></div>
          <div className={b.invoicedQty > b.acceptedQty ? 'bad' : ''}><span className="cell-sub">Billed</span><b>{formatNumber(b.invoicedQty)}</b></div>
        </div>
        <dl className="details">
          <dt>Supplier / invoice</dt><dd>{b.supplier} · {b.invoiceNo} · {b.poId} · {b.grnId}</dd>
          <dt>Billed</dt><dd>{formatINR(b.amount)}</dd>
          <dt>Verified by Accounts</dt><dd>{formatINR(b.verifiedAmount)} ({b.verifiedBy}){b.debitNote ? ` · debit note ${formatINR(b.debitNote.amount)}: ${b.debitNote.reason}` : ''}</dd>
          <dt>Paid before</dt><dd>{formatINR(b.paidAmount)}</dd>
          <dt>Advance adjusted</dt><dd>{r.request.advanceAdjust ? `− ${formatINR(r.request.advanceAdjust)}` : 'None'}</dd>
          <dt>Release requested</dt><dd><b>{formatINR(r.request.net)}</b> by {r.request.requestedBy} · {fmtStamp(r.request.at)}</dd>
        </dl>
      </>
    )
  } else if (item.kind === 'Stock adjustment' || item.kind === 'Damaged stock') {
    details = (
      <dl className="details">
        <dt>Change</dt><dd><b className={r.qty < 0 ? 'down' : 'up'}>{r.qty > 0 ? '+' : ''}{fmtQty(r.qty, materialOf(r.sku)?.unit)}</b> {materialOf(r.sku)?.name}</dd>
        <dt>Store</dt><dd>{storeOf(r.storeId)?.name}</dd>
        <dt>Type</dt><dd>{r.kind}</dd>
        <dt>Reason</dt><dd>{r.reason}</dd>
        <dt>Value</dt><dd>{formatINR(item.amount)}</dd>
        <dt>Raised by</dt><dd>{r.raisedBy} · {fmtStamp(r.at)}</dd>
      </dl>
    )
  } else if (item.kind === 'Delivery discrepancy') {
    details = (
      <dl className="details">
        <dt>GRN / PO</dt><dd>{r.id} · {r.po} · {r.supplier}</dd>
        <dt>Ordered / delivered</dt><dd>{formatNumber(r.ordered)} / {formatNumber(r.delivered)}</dd>
        <dt>Accepted / rejected</dt><dd>{formatNumber(r.accepted)} / {formatNumber(r.rejected)}{r.rejectionReason ? ` · ${r.rejectionReason}` : ''}</dd>
        <dt>Status</dt><dd>{r.discrepancy}{r.discrepancyNote ? ` · ${r.discrepancyNote}` : ''}</dd>
      </dl>
    )
  } else if (item.site) {
    const where = r.siteId ? siteOf(r.siteId)?.name : 'Project-wide'
    details = (
      <dl className="details">
        <dt>Project / site</dt><dd>{r.projectId} · {where}</dd>
        {r.description && <><dt>Description</dt><dd>{r.description}</dd></>}
        {r.title && <><dt>Item</dt><dd>{r.title}</dd></>}
        {r.reportedBy && <><dt>Reported by</dt><dd>{r.reportedBy}</dd></>}
        {r.inspector && <><dt>Inspector</dt><dd>{r.inspector} ({r.owner})</dd></>}
        {r.checklist?.length > 0 && <><dt>Checklist</dt><dd>{r.checklist.map((c) => `${c.result || '–'}: ${c.item}`).join('; ')}</dd></>}
        {r.action && typeof r.action === 'string' && <><dt>Corrective action</dt><dd>{r.action} · {r.actionOwner} · due {r.actionDue}</dd></>}
        {r.assignee && <><dt>Assigned to</dt><dd>{r.assignee.name} ({r.assignee.role})</dd></>}
        {r.impact && <><dt>Impact</dt><dd>{r.impact}</dd></>}
        {r.delayReason !== undefined && <><dt>Delay reason / action</dt><dd>{r.delayReason || 'Not given'} · {r.correctiveAction || '—'}{r.pmReview ? ` · PM: ${r.pmReview.note}` : ''}</dd></>}
        <dt>Status</dt><dd>{r.status}{r.reviewStatus ? ` · ${r.reviewStatus}` : ''}</dd>
      </dl>
    )
  } else {
    details = <p>{item.title}</p>
  }
  const history = r.history || r.request?.history || (r.comments ? r.comments.map((c) => ({ at: c.at, by: c.by, role: c.role, action: c.text })) : null)

  return (
    <Drawer title={`${item.kind} · ${item.ref}`} sub={item.title} onClose={onClose}>
      {details}
      {!item.watch && (canDecide ? (
        <div className="receipt-form" style={{ marginTop: 16 }}>
          <label className="field">{item.kind === 'Delivery discrepancy' ? 'Outcome (required)' : 'Reason / comment (required to reject or return)'}
            <input value={reason} onChange={(e) => { setReason(e.target.value); setError('') }} />
          </label>
          <FormError error={error} />
          <div className="jv-submit" style={{ marginTop: 10 }}>
            {item.kind === 'Site issue'
              ? <><button className="btn btn-primary" onClick={() => decide(true)}>Mark resolved</button><button className="btn" onClick={() => decide(false)}>Comment only</button></>
              : item.kind === 'QA review' || item.kind === 'Safety verification'
              ? <><button className="btn btn-primary" onClick={() => decide(true)}>{item.kind === 'QA review' ? 'QA accept' : 'Verify & close'}</button><button className="btn" onClick={() => decide(false)}>{item.kind === 'QA review' ? 'QA reject' : 'Reopen'}</button></>
              : item.kind === 'Delivery discrepancy'
              ? <button className="btn btn-primary" onClick={() => decide(true)}>Mark reviewed</button>
              : <>
                  <button className="btn btn-primary" onClick={() => decide(true)}>{item.kind === 'Supplier payment' ? 'Approve release' : 'Approve'}</button>
                  {['Purchase order', 'Purchase requisition'].includes(item.kind) && <button className="btn" onClick={() => decide(false, 'return')}>Return for correction</button>}
                  <button className="btn" onClick={() => decide(false)}>Reject</button>
                </>}
          </div>
          <p className="cell-sub">Your name, the time and the reason are recorded on the record and in the audit trail.</p>
        </div>
      ) : <p className="cell-sub" style={{ marginTop: 12 }}>View only for your role.</p>)}
      {item.watch && <p className="cell-sub" style={{ marginTop: 12 }}>For information: handled by {item.needs}.</p>}
      {history?.length > 0 && <><div className="sub-panel-head" style={{ marginTop: 14 }}><b>History</b></div><HistoryList items={history} /></>}
      <p style={{ marginTop: 12 }}><Link to={LINKS[item.kind] || '/dashboard'} onClick={onClose}>Open on its page →</Link></p>
    </Drawer>
  )
}

/** Everything waiting for an Admin decision in the shared purchase / stores / payables records, plus blocked items. */
export default function ActionCentre({ notify, compact = false }) {
  const inv = useInventory()
  const site = useSite()
  const [kind, setKind] = useState('All')
  const [openId, setOpenId] = useState(null)
  // Purchase / stores / accounts items plus site oversight (QA, safety, escalations, delays)
  const items = [...inv.adminItems, ...siteAdminItems(site.state)].sort((a, b) => (a.watch === b.watch ? (b.at || '').localeCompare(a.at || '') : a.watch ? 1 : -1))
  const needAdmin = items.filter((i) => i.actionable && !i.watch)
  const kinds = ['All', ...new Set(items.map((i) => i.kind))]
  const rows = (compact ? needAdmin : items).filter((i) => kind === 'All' || i.kind === kind)
  const current = openId && items.find((i) => i.id === openId)

  return (
    <Card title="Needs your action" className="mb action-centre"
      sub={`${needAdmin.length} item${needAdmin.length === 1 ? '' : 's'} waiting for Admin from the shared purchase, stores, accounts and site records`}
      bodyClass="">
      {!compact && <div className="toolbar"><Chips options={kinds} value={kind} onChange={setKind} /></div>}
      <DataTable
        dense
        rows={compact ? rows.slice(0, 6) : rows}
        emptyText="Nothing is waiting for you."
        columns={[
          { key: 'kind', header: 'Type', render: (i) => <><Badge tone={i.watch ? 'muted' : i.kind === 'Damaged stock' || i.kind === 'Delivery discrepancy' ? 'danger' : 'warning'}>{i.kind}</Badge></> },
          { key: 'ref', header: 'Reference', render: (i) => <><div className="cell-main">{i.ref}</div><div className="cell-sub">{fmtStamp(i.at)}</div></> },
          { key: 'title', header: 'Details', render: (i) => <span className="wrap-cell">{i.title}</span> },
          { key: 'amount', header: 'Value', align: 'num', render: (i) => (i.amount != null ? formatINR(i.amount) : '—') },
          { key: 'needs', header: 'Decided by', render: (i) => (i.watch ? <span className="cell-sub">{i.needs} (watch)</span> : i.needs) },
          { key: 'x', header: '', render: (i) => <button className={`btn btn-sm ${i.actionable && !i.watch && i.needs === 'Admin' ? 'btn-primary' : ''}`} onClick={() => setOpenId(i.id)}>{i.watch ? 'View' : 'Review'}</button> },
        ]}
      />
      {compact && items.length > rows.slice(0, 6).length && <div className="card-body"><Link to="/dashboard?tab=approvals">View all {items.length} items →</Link></div>}
      {current && <ItemDrawer key={current.id} item={current} inv={inv} site={site} notify={notify} onClose={() => setOpenId(null)} />}
    </Card>
  )
}

/** Last purchase orders, goods receipts, issues and exceptions, newest first */
function recentFlow(inv) {
  const unit = (sku) => materialOf(sku)?.unit || ''
  const rows = [
    ...inv.state.purchaseOrders.filter((p) => p.sku).map((p) => ({ key: `po-${p.id}`, at: p.history?.[p.history.length - 1]?.at || `${p.date}T10:00`, kind: 'Purchase order', tone: 'info', ref: p.id, text: `${p.vendor}: ${p.qty} ${unit(p.sku)} ${materialOf(p.sku)?.name} · ${formatINR(p.amount)} · ${p.approval}${p.sentAt ? ', sent' : ''}${p.requisitionId ? ` · ${p.requisitionId}` : ''}` })),
    ...inv.state.receipts.map((g) => ({ key: `grn-${g.id}`, at: g.confirmedAt || g.at, kind: 'Goods receipt', tone: g.status === 'Accepted' ? 'success' : 'warning', ref: `${g.id} / ${g.po}`, text: `${materialOf(g.sku)?.name}: delivered ${g.delivered}, accepted ${g.accepted ?? 'pending inspection'}${g.rejected ? `, rejected ${g.rejected}` : ''} ${unit(g.sku)}` })),
    ...inv.state.issues.map((i) => { const r = inv.requests.find((x) => x.id === i.requestId); return { key: `mi-${i.id}`, at: i.at, kind: 'Issue to site', tone: 'muted', ref: `${i.id} / ${i.requestId}`, text: `${i.qty} ${unit(r?.sku)} ${materialOf(r?.sku)?.name} to ${r?.site?.name} · issued by ${i.issuedBy}, received by ${i.receivedBy}` } }),
    ...inv.alerts.filter((a) => a.severity === 'danger').map((a) => ({ key: `ex-${a.id}`, at: '', kind: 'Exception', tone: 'danger', ref: a.ref, text: `${a.type}: ${a.text}` })),
  ]
  return rows.sort((a, b) => (b.at || '9').localeCompare(a.at || '9')).slice(0, 12)
}

/** Live store figures for the Admin (same numbers as the Store Keeper Dashboard). */
export function LiveStores() {
  const inv = useInventory()
  const s = inv.summary
  const damaged = damagedRegister(inv.state)
  const recentAudit = (inv.state.audit || []).slice(0, 8)
  return (
    <>
      <StatGrid
        items={[
          { label: 'Stock value (usable)', value: formatCompactINR(s.stockValue), sub: `${s.materialTypes} materials in stock` },
          { label: 'Low / out of stock', value: s.low.length, tone: s.low.length ? 'warning' : undefined, sub: 'Free stock at or below reorder level' },
          { label: 'Deliveries to inspect', value: s.pendingReceipts.length, tone: s.pendingReceipts.length ? 'warning' : undefined, sub: 'Not yet in usable stock' },
          { label: 'Open requests', value: s.pendingRequests.length, sub: 'Pending, with PM, or not fully issued' },
          { label: 'Damaged / rejected', value: formatCompactINR(damaged.reduce((t, d) => t + d.value, 0)), tone: damaged.length ? 'danger' : undefined, sub: `${damaged.length} records (not in stock)` },
        ]}
      />
      <Card title="Recent purchases, receipts, issues & exceptions" sub="Latest records from the shared store and purchase data" bodyClass="" className="mb">
        <DataTable dense rowKey="key" rows={recentFlow(inv)} emptyText="No recent records."
          columns={[
            { key: 'at', header: 'When', render: (a) => fmtStamp(a.at) },
            { key: 'kind', header: 'Type', render: (a) => <Badge tone={a.tone}>{a.kind}</Badge> },
            { key: 'ref', header: 'Reference', render: (a) => <span className="cell-main">{a.ref}</span> },
            { key: 'text', header: 'Details', render: (a) => <span className="wrap-cell">{a.text}</span> },
          ]} />
      </Card>
      <Card title="Approval & decision history (this session)" sub="Audit trail from the shared records: who, when, what and why" bodyClass="" className="mb">
        <DataTable dense rows={recentAudit} emptyText="No decisions recorded in this session yet."
          columns={[
            { key: 'at', header: 'When', render: (a) => fmtStamp(a.at) },
            { key: 'ref', header: 'Record', render: (a) => <span className="cell-main">{a.ref}</span> },
            { key: 'action', header: 'Action', render: (a) => <>{a.action}{a.note ? <div className="cell-sub">{a.note}</div> : null}</> },
            { key: 'by', header: 'By', render: (a) => <>{a.by}<div className="cell-sub">{a.role}</div></> },
          ]} />
      </Card>
    </>
  )
}
