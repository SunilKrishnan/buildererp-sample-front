import { useState } from 'react'
import { Link } from 'react-router-dom'
import { DemoTag } from '../components/StateViews.jsx'
import { Badge, Card, Chips, Kpi, PageHead } from '../components/UI.jsx'
import { useInventory } from '../features/store-keeper/InventoryContext.jsx'
import { usePurchasePerms } from '../features/purchase-manager/shared.jsx'
import { materialOf, storeOf } from '../services/inventory.js'
import { PO_STATUSES } from '../services/procurement.js'
import { formatDate, formatINR, formatNumber } from '../utils/format.js'

// Store receipt status for a PO, from the Store Keeper's goods receipts (GRNs)
function StoreReceipt({ po }) {
  if (!po.sku) return <span className="cell-sub">Service order</span>
  if (po.receivedBeforeStockRecords) return <span className="cell-sub">Received before stock records</span>
  if (!po.grns.length) return <span className="cell-sub">Nothing received{po.delayed ? ` · ${po.delayDays}d late` : ''}</span>
  return (
    <>
      <div>{formatNumber(po.accepted)} / {formatNumber(po.qty)} {po.unit} accepted</div>
      <div className="cell-sub">
        {po.grns.map((g) => g.id).join(', ')}
        {po.rejected > 0 && ` · ${formatNumber(po.rejected)} rejected`}
        {po.pendingInspection > 0 && ' · inspection pending'}
      </div>
    </>
  )
}

/**
 * Company purchase order register (one shared record set). Purchase orders are prepared,
 * submitted, sent and followed up on the Purchase Manager Dashboard; Admin approves there.
 */
export default function PurchaseOrders({ search }) {
  const inv = useInventory()
  const perms = usePurchasePerms()
  const [filter, setFilter] = useState('All')
  const q = search.toLowerCase()
  const orders = inv.poViews
  const list = orders
    .filter((o) => (filter === 'All' || o.status === filter) && (!q || `${o.id} ${o.vendor} ${o.material?.name || o.item}`.toLowerCase().includes(q)))
    .sort((a, b) => b.id.localeCompare(a.id))
  const live = orders.filter((o) => !['Draft', 'Cancelled', 'Rejected'].includes(o.status))
  const pmLink = (extra = '') => `/dashboards/purchase-manager?tab=orders${extra}`
  const canOpenPM = perms.manage || perms.approvePO

  return (
    <>
      <PageHead title="Purchase Orders" sub="Purchase order register across all projects">
        <DemoTag />
        {canOpenPM && <Link className="btn btn-primary" to={pmLink()}>Manage in Purchase Manager Dashboard</Link>}
      </PageHead>

      <div className="grid kpis">
        <Kpi label="Purchase Orders" value={orders.length} icon="cart" foot={`${orders.filter((o) => o.status === 'Draft').length} draft`} />
        <Kpi label="Order Value (before GST)" value={formatINR(live.reduce((s, o) => s + o.goods, 0))} icon="rupee" />
        <Kpi label="Awaiting Approval" value={orders.filter((o) => o.status === 'Pending Approval').length} icon="alert" foot="Admin, above ₹1,00,000" />
        <Kpi label="Awaiting Delivery" value={orders.filter((o) => o.open).length} icon="box" foot={`${orders.filter((o) => o.delayed).length} delayed`} />
      </div>

      <Card bodyClass="">
        <div className="toolbar">
          <Chips options={['All', ...PO_STATUSES]} value={filter} onChange={setFilter} />
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>PO #</th><th>Supplier</th><th>Project / store</th><th>Items</th><th className="num">PO total</th><th>Date</th><th>Status</th><th>Store receipt</th><th></th></tr>
            </thead>
            <tbody>
              {list.map((o) => (
                <tr key={o.id}>
                  <td className="cell-main">{o.id}</td>
                  <td>{o.vendor}</td>
                  <td>{o.store?.name || 'Project services'}</td>
                  <td className="cell-sub">{o.material ? `${o.material.name} × ${formatNumber(o.qty)} ${o.unit}` : o.item}</td>
                  <td className="num">{formatINR(o.total)}</td>
                  <td>{formatDate(o.date)}</td>
                  <td><Badge>{o.status}</Badge>{o.status === 'Pending Approval' && <div className="cell-sub">needs {o.needs}</div>}</td>
                  <td><StoreReceipt po={o} /></td>
                  <td>{canOpenPM && <Link className="btn btn-sm" to={pmLink(`&po=${o.id}`)}>{o.status === 'Pending Approval' && perms.approvePO ? 'Review' : 'Open'}</Link>}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {list.length === 0 && <div className="empty">No purchase orders found.</div>}
        </div>
      </Card>

      <Card title="Purchase requisitions from stores" sub="Raised by the Store Keeper; the Purchase Manager obtains quotations and raises the PO. Nothing here places an order or creates a payment." bodyClass="" className="section-gap">
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>Requisition</th><th>Material</th><th className="num">Quantity</th><th>For store</th><th>Reason</th><th>Raised by</th><th>Status</th></tr>
            </thead>
            <tbody>
              {[...inv.state.purchaseRequests].sort((a, b) => b.at.localeCompare(a.at)).map((p) => (
                <tr key={p.id}>
                  <td className="cell-main">{p.id}</td>
                  <td>{materialOf(p.sku)?.name}</td>
                  <td className="num">{formatNumber(p.qty)} {materialOf(p.sku)?.unit}</td>
                  <td>{storeOf(p.storeId)?.name}</td>
                  <td className="cell-sub">{p.reason}</td>
                  <td>{p.raisedBy}</td>
                  <td><Badge>{p.status}</Badge>{p.poId && <div className="cell-sub">{p.poId}</div>}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {inv.state.purchaseRequests.length === 0 && <div className="empty">No requisitions from stores.</div>}
        </div>
      </Card>
    </>
  )
}
