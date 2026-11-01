import { useState } from 'react'
import DataTable from '../../components/DataTable.jsx'
import { Badge, Card } from '../../components/UI.jsx'
import { allowsDecimals, materialOf, storeOf, storeProjectLabel } from '../../services/inventory.js'
import { OPEN_REQUISITION } from '../../services/procurement.js'
import { ConfirmDialog, fmtQty, fmtStamp, FormError, GLOSSARY, Locked, qtyStep, Term } from './shared.jsx'

export default function Reorder({ inv, perms, notify }) {
  const [raising, setRaising] = useState(null) // stock row
  const [qty, setQty] = useState('')
  const [reason, setReason] = useState('')
  const low = inv.stock.filter((s) => s.status !== 'In Stock').sort((a, b) => a.availableForIssue / (a.reorder || 1) - b.availableForIssue / (b.reorder || 1))
  // A reorder requisition still in progress: open, or its PO not yet completed (returned / rejected ones don't count)
  const openPr = (s) => inv.state.purchaseRequests.find((p) => p.sku === s.sku && p.storeId === s.storeId && !p.requestRef
    && (OPEN_REQUISITION.includes(p.status) || (p.status === 'PO Raised' && !['Completed', 'Cancelled', 'Rejected'].includes(inv.poViews.find((o) => o.id === p.poId)?.status))))

  const start = (s) => { setRaising(s); setQty(String(s.suggested || s.shortage || s.reorder)); setReason(s.status === 'Out of Stock' ? 'Out of stock' : 'Below reorder level') }
  const n = Number(qty)
  const unit = raising?.material.unit
  const error = !raising ? '' : !(n > 0) ? 'Enter the quantity required.' : !allowsDecimals(unit) && !Number.isInteger(n) ? `Whole ${unit?.toLowerCase()} only.` : !reason.trim() ? 'Give a reason.' : ''

  return (
    <>
      <div className="info-note">
        <span>ℹ</span>
        <div>
          Creating a <b>material requisition</b> only informs the Purchase Manager. It does not place a supplier order or create a payment.
          The Purchase Manager gets quotations, selects the supplier and raises the purchase order; the authorised approver approves the purchase.
        </div>
      </div>

      <Card title={<span className="title-with-count">Low stock <span className="count-pill">{low.length}</span></span>} sub="Free stock at or below the reorder level" bodyClass="">
        <DataTable
          dense
          rowKey="key"
          rows={low}
          emptyText="No materials are at or below their reorder level."
          columns={[
            { key: 'm', header: 'Material', render: (s) => <><div className="cell-main">{s.material.name}</div><div className="cell-sub">{s.sku}</div></> },
            { key: 'c', header: 'Current stock', align: 'num', render: (s) => fmtQty(s.onHand, s.material.unit) },
            { key: 'r', header: <Term tip={GLOSSARY.reserved}>Reserved</Term>, align: 'num', render: (s) => <>{fmtQty(s.reserved)}{s.onHold > 0 && <div className="cell-sub">+{fmtQty(s.onHold)} on hold</div>}</> },
            { key: 'l', header: <Term tip={GLOSSARY.reorder}>Reorder level</Term>, align: 'num', render: (s) => fmtQty(s.reorder) },
            { key: 'sh', header: <Term tip={GLOSSARY.shortage}>Shortage</Term>, align: 'num', render: (s) => <b className="down">{fmtQty(s.shortage)}</b> },
            { key: 'o', header: <Term tip={GLOSSARY.onOrder}>On order</Term>, align: 'num', render: (s) => <>{fmtQty(s.onOrder)}{s.awaitingInspection > 0 && <div className="cell-sub">+{fmtQty(s.awaitingInspection)} awaiting inspection</div>}</> },
            { key: 'p', header: 'Project / store', render: (s) => <><div>{s.store.name}</div><div className="cell-sub">{storeProjectLabel(s.store)}</div></> },
            { key: 'sg', header: <Term tip={GLOSSARY.suggested}>Suggested reorder</Term>, align: 'num', render: (s) => <b>{fmtQty(s.suggested, s.material.unit)}</b> },
            { key: 'st', header: 'Status', render: (s) => <Badge>{s.status}</Badge> },
            {
              key: 'x', header: 'Action', render: (s) => {
                const pr = openPr(s)
                if (pr) return <span className="cell-sub">{pr.id}: {pr.status}</span>
                if (s.suggested === 0) return <span className="cell-sub">Covered by open orders</span>
                return perms.purchaseRequest ? <button className="btn btn-sm btn-primary" onClick={() => start(s)}>Create requisition</button> : <Locked>Store Keeper</Locked>
              },
            },
          ]}
        />
      </Card>

      <Card title="Material requisitions sent to Purchase Manager" sub="Also listed on the Purchase Orders page. Requisitions above the review limit go to Admin first; the Purchase Manager then obtains quotations and raises the PO." bodyClass="" className="section-gap">
        <DataTable
          dense
          rows={[...inv.state.purchaseRequests].sort((a, b) => b.at.localeCompare(a.at))}
          emptyText="No requisitions raised yet."
          columns={[
            { key: 'id', header: 'Requisition', render: (p) => <><div className="cell-main">{p.id}</div><div className="cell-sub">{fmtStamp(p.at)}</div></> },
            { key: 'm', header: 'Material', render: (p) => materialOf(p.sku).name },
            { key: 'q', header: 'Quantity', align: 'num', render: (p) => fmtQty(p.qty, materialOf(p.sku).unit) },
            { key: 's', header: 'For store', render: (p) => storeOf(p.storeId).name },
            { key: 'r', header: 'Reason / origin', render: (p) => <>{p.reason}<div className="cell-sub">{p.requestRef ? `Site request ${p.requestRef}` : 'Reorder — no site request'}</div></> },
            { key: 'b', header: 'Raised by', render: (p) => p.raisedBy },
            { key: 'st', header: 'Status', render: (p) => <><Badge>{p.status}</Badge>{p.poId ? <div className="cell-sub">{p.poId} · {inv.poViews.find((o) => o.id === p.poId)?.status}</div> : (p.returnReason || p.note) && <div className="cell-sub">{p.returnReason || p.note}</div>}</> },
          ]}
        />
      </Card>

      {raising && (
        <ConfirmDialog title={`Material requisition: ${raising.material.name}`} confirmLabel="Send to Purchase Manager" confirmDisabled={!!error}
          onCancel={() => setRaising(null)}
          onConfirm={() => {
            if (error) return
            const r = inv.actions.raiseRequisition({ sku: raising.sku, storeId: raising.storeId, qty: n, reason: reason.trim() }, perms.actor)
            if (!r.ok) { notify(r.error); return false }
            notify(`Demo: ${r.message}. No order placed, nothing sent`)
            setRaising(null)
          }}>
          <p>For {raising.store.name}. Free stock {fmtQty(raising.availableForIssue, unit)}, reorder level {fmtQty(raising.reorder, unit)}, on order {fmtQty(raising.onOrder, unit)}.</p>
          <div className="receipt-grid" style={{ padding: 0 }}>
            <label className="field">Quantity required ({unit})<input type="number" min="0" step={qtyStep(unit)} value={qty} onChange={(e) => setQty(e.target.value)} /></label>
            <label className="field">Reason<input value={reason} onChange={(e) => setReason(e.target.value)} /></label>
          </div>
          <FormError error={error} />
        </ConfirmDialog>
      )}
    </>
  )
}
