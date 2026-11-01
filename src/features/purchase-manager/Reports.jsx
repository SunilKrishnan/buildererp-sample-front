import DataTable from '../../components/DataTable.jsx'
import { DemoTag } from '../../components/StateViews.jsx'
import { Badge, Card } from '../../components/UI.jsx'
import { materialOf, projectOf, storeOf } from '../../services/inventory.js'
import { compareQuotes, supplierStats } from '../../services/procurement.js'
import { formatDate } from '../../utils/format.js'
import { downloadCsv, fmtQty } from '../store-keeper/shared.jsx'
import { money } from './shared.jsx'

const REPORTS = [
  { id: 'project', label: 'Purchase history by project' },
  { id: 'material', label: 'Material-wise spending' },
  { id: 'supplier', label: 'Supplier-wise spending' },
  { id: 'quotes', label: 'Quotation price comparison' },
  { id: 'delays', label: 'Delayed deliveries' },
  { id: 'pending', label: 'Pending requisitions and POs' },
  { id: 'accepted', label: 'PO vs actual accepted delivery' },
]
const LIVE = (p) => !['Draft', 'Cancelled', 'Rejected'].includes(p.status)
const group = (rows, key) => rows.reduce((m, r) => ((m[key(r)] = m[key(r)] || []).push(r), m), {})
const sumOf = (rows, f) => rows.reduce((s, r) => s + f(r), 0)

function build(id, inv) {
  const pos = inv.poViews.filter(LIVE)
  switch (id) {
    case 'project': {
      const rows = Object.entries(group(pos, (p) => p.projectId)).map(([pid, list]) => ({
        key: pid, project: projectOf(pid)?.name || pid, orders: list.length, goods: sumOf(list, (p) => p.goods), gst: sumOf(list, (p) => p.gst), total: sumOf(list, (p) => p.total),
        latest: list.map((p) => p.date).sort().pop(),
      }))
      return { rows, rowKey: 'key', columns: [
        { key: 'project', header: 'Project' }, { key: 'orders', header: 'POs', align: 'num' },
        { key: 'goods', header: 'Goods value', align: 'num', render: (r) => money(r.goods) }, { key: 'gst', header: 'GST', align: 'num', render: (r) => money(r.gst) },
        { key: 'total', header: 'PO total', align: 'num', render: (r) => <b>{money(r.total)}</b> }, { key: 'latest', header: 'Latest PO', render: (r) => formatDate(r.latest) },
      ] }
    }
    case 'material': {
      const rows = Object.entries(group(pos.filter((p) => p.sku), (p) => p.sku)).map(([sku, list]) => ({
        key: sku, material: materialOf(sku)?.name, unit: materialOf(sku)?.unit, qty: sumOf(list, (p) => p.qty), accepted: sumOf(list, (p) => p.accepted), goods: sumOf(list, (p) => p.goods),
        avgRate: Math.round(sumOf(list, (p) => p.goods) / sumOf(list, (p) => p.qty)), orders: list.length,
      })).sort((a, b) => b.goods - a.goods)
      return { rows, rowKey: 'key', columns: [
        { key: 'material', header: 'Material' }, { key: 'orders', header: 'POs', align: 'num' },
        { key: 'qty', header: 'Ordered', align: 'num', render: (r) => fmtQty(r.qty, r.unit) }, { key: 'accepted', header: 'Accepted', align: 'num', render: (r) => fmtQty(r.accepted) },
        { key: 'avgRate', header: 'Average rate', align: 'num', render: (r) => money(r.avgRate) }, { key: 'goods', header: 'Spend (before GST)', align: 'num', render: (r) => <b>{money(r.goods)}</b> },
      ] }
    }
    case 'supplier': {
      const rows = Object.entries(group(pos, (p) => p.vendor)).map(([vendor, list]) => {
        const st = supplierStats(inv.state, vendor)
        return { key: vendor, vendor, orders: list.length, goods: sumOf(list, (p) => p.goods), total: sumOf(list, (p) => p.total), onTime: st.onTimePct, rejection: st.rejectionPct }
      }).sort((a, b) => b.goods - a.goods)
      return { rows, rowKey: 'key', columns: [
        { key: 'vendor', header: 'Supplier' }, { key: 'orders', header: 'POs', align: 'num' },
        { key: 'goods', header: 'Goods value', align: 'num', render: (r) => money(r.goods) }, { key: 'total', header: 'PO total', align: 'num', render: (r) => <b>{money(r.total)}</b> },
        { key: 'onTime', header: 'On time', align: 'num', render: (r) => (r.onTime == null ? '—' : `${r.onTime}%`) }, { key: 'rejection', header: 'Rejected', align: 'num', render: (r) => (r.rejection == null ? '—' : `${r.rejection}%`) },
      ] }
    }
    case 'quotes': {
      const rows = inv.state.purchaseRequests.filter((p) => (p.quotes || []).length).map((p) => {
        const c = compareQuotes(p)
        const low = c.find((r) => r.lowest)
        const high = c.reduce((a, r) => (r.total > a.total ? r : a), c[0])
        const chosen = c.find((r) => r.chosen)
        return { key: p.id, id: p.id, material: materialOf(p.sku)?.name, quotes: c.length, lowest: `${low.vendor} ${money(low.total)}`, highest: money(high.total), chosen: chosen ? `${chosen.vendor} ${money(chosen.total)}` : 'Not selected', premium: chosen ? chosen.overLowest : null, reason: p.selectionReason || '' }
      })
      return { rows, rowKey: 'key', columns: [
        { key: 'id', header: 'Requisition' }, { key: 'material', header: 'Material' }, { key: 'quotes', header: 'Quotes', align: 'num' },
        { key: 'lowest', header: 'Lowest landed' }, { key: 'highest', header: 'Highest landed', align: 'num' }, { key: 'chosen', header: 'Selected' },
        { key: 'premium', header: 'Paid over lowest', align: 'num', render: (r) => (r.premium == null ? '—' : r.premium ? <span className="down">{money(r.premium)}</span> : 'Lowest') },
        { key: 'reason', header: 'Reason', render: (r) => <span className="cell-sub wrap-cell">{r.reason || '—'}</span> },
      ] }
    }
    case 'delays': {
      const rows = inv.poViews.filter((p) => p.sku && p.sentAt).map((p) => {
        const first = [...p.grns].sort((a, b) => a.deliveryDate.localeCompare(b.deliveryDate))[0]
        const due = p.originalExpected || p.expected
        const lateBy = first ? Math.round((new Date(first.deliveryDate) - new Date(due)) / 86400000) : p.delayDays
        return { key: p.id, id: p.id, vendor: p.vendor, material: p.material?.name, due, delivered: first?.deliveryDate || null, lateBy, pending: p.pending, unit: p.unit, followUps: (p.followUps || []).length }
      }).filter((r) => r.lateBy > 0)
      return { rows, rowKey: 'key', columns: [
        { key: 'id', header: 'PO' }, { key: 'vendor', header: 'Supplier' }, { key: 'material', header: 'Material' },
        { key: 'due', header: 'Originally due', render: (r) => formatDate(r.due) }, { key: 'delivered', header: 'First delivery', render: (r) => (r.delivered ? formatDate(r.delivered) : 'Not yet') },
        { key: 'lateBy', header: 'Days late', align: 'num', render: (r) => <b className="down">{r.lateBy}</b> }, { key: 'pending', header: 'Still pending', align: 'num', render: (r) => fmtQty(r.pending, r.unit) },
        { key: 'followUps', header: 'Follow-ups', align: 'num' },
      ] }
    }
    case 'pending': {
      const prs = inv.state.purchaseRequests.filter((p) => ['Awaiting Admin Review', 'Sent to Purchase Manager', 'Quotations Requested', 'Supplier Selected'].includes(p.status))
        .map((p) => ({ key: p.id, kind: 'Requisition', ref: p.id, what: `${fmtQty(p.qty, materialOf(p.sku)?.unit)} ${materialOf(p.sku)?.name}`, party: storeOf(p.storeId)?.name, value: p.estimate || 0, status: p.status, since: p.at.slice(0, 10) }))
      const open = inv.poViews.filter((p) => ['Draft', 'Pending Approval', 'Approved', 'Sent to Supplier', 'Partially Delivered'].includes(p.status))
        .map((p) => ({ key: p.id, kind: 'Purchase order', ref: p.id, what: p.material ? `${fmtQty(p.pending || p.qty, p.unit)} ${p.material.name} pending` : p.item, party: p.vendor, value: p.total, status: p.status, since: p.date }))
      return { rows: [...prs, ...open], rowKey: 'key', columns: [
        { key: 'kind', header: 'Type' }, { key: 'ref', header: 'Reference' }, { key: 'what', header: 'What' }, { key: 'party', header: 'Store / supplier' },
        { key: 'value', header: 'Value', align: 'num', render: (r) => money(r.value) }, { key: 'status', header: 'Status', render: (r) => <Badge>{r.status}</Badge> }, { key: 'since', header: 'Since', render: (r) => formatDate(r.since) },
      ] }
    }
    case 'accepted': {
      const rows = inv.poViews.filter((p) => p.sku && !p.receivedBeforeStockRecords && p.sentAt).map((p) => ({
        key: p.id, id: p.id, vendor: p.vendor, material: p.material?.name, unit: p.unit, ordered: p.qty, delivered: p.delivered, accepted: p.accepted, rejected: p.rejected, pending: p.pending,
        pct: p.qty ? Math.round((p.accepted / p.qty) * 100) : 0, status: p.status,
      }))
      return { rows, rowKey: 'key', columns: [
        { key: 'id', header: 'PO' }, { key: 'vendor', header: 'Supplier' }, { key: 'material', header: 'Material' },
        { key: 'ordered', header: 'Ordered', align: 'num', render: (r) => fmtQty(r.ordered, r.unit) }, { key: 'delivered', header: 'Delivered', align: 'num' },
        { key: 'accepted', header: 'Accepted', align: 'num', render: (r) => <b>{fmtQty(r.accepted)}</b> }, { key: 'rejected', header: 'Rejected', align: 'num' },
        { key: 'pending', header: 'Pending', align: 'num' }, { key: 'pct', header: 'Accepted %', align: 'num', render: (r) => `${r.pct}%` }, { key: 'status', header: 'PO status', render: (r) => <Badge>{r.status}</Badge> },
      ] }
    }
    default: return { rows: [], columns: [] }
  }
}

export default function Reports({ inv, params, setParams }) {
  const report = REPORTS.find((r) => r.id === params.get('report')) || REPORTS[0]
  const { rows, columns, rowKey } = build(report.id, inv)
  return (
    <Card title={report.label} sub="Built from the same purchase orders, quotations and goods receipts as the dashboard" bodyClass=""
      action={<div className="cell-actions"><DemoTag /><button className="btn btn-sm" disabled={!rows.length} onClick={() => downloadCsv(`${report.id}-purchase-report-demo.csv`, columns, rows)}>Export CSV</button></div>}>
      <div className="toolbar">
        <label className="field">Report
          <select value={report.id} onChange={(e) => setParams({ tab: 'reports', report: e.target.value })}>{REPORTS.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}</select>
        </label>
        <span className="cell-sub">Spending excludes draft, cancelled and rejected POs.</span>
      </div>
      <DataTable dense rows={rows} columns={columns} rowKey={rowKey} emptyText="Nothing to report." />
    </Card>
  )
}
