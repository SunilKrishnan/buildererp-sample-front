import { useState } from 'react'
import DataTable from '../../components/DataTable.jsx'
import { DemoTag } from '../../components/StateViews.jsx'
import { Badge, Card } from '../../components/UI.jsx'
import { damagedRegister, discrepancyRegister, materialOf, nowStamp, projectConsumption, siteOf, storeOf } from '../../services/inventory.js'
import { addDays, todayISO } from '../../utils/date.js'
import { formatCompactINR, formatDate, formatINR } from '../../utils/format.js'
import { movementColumns } from './Movements.jsx'
import { downloadCsv, fmtQty, fmtStamp } from './shared.jsx'

const REPORTS = [
  { id: 'stock', label: 'Current Stock' },
  { id: 'receipts', label: 'Daily Material Receipt', daily: true },
  { id: 'issues', label: 'Daily Material Issue', daily: true },
  { id: 'low', label: 'Low Stock' },
  { id: 'movement', label: 'Stock Movement', range: true },
  { id: 'consumption', label: 'Project-wise Consumption' },
  { id: 'damaged', label: 'Damaged / Rejected Material' },
  { id: 'discrepancy', label: 'Stock Discrepancy' },
]

const unitOf = (sku) => materialOf(sku).unit
const name = (sku) => materialOf(sku).name

function build(id, inv, { day, from, to }) {
  const reqById = Object.fromEntries(inv.state.requests.map((r) => [r.id, r]))
  switch (id) {
    case 'stock': {
      const rows = [...inv.stock].sort((a, b) => a.material.name.localeCompare(b.material.name))
      return {
        rows, rowKey: 'key',
        total: `Total value ${formatINR(rows.reduce((s, r) => s + r.value, 0))}`,
        columns: [
          { key: 'name', header: 'Material', render: (r) => r.material.name, csv: (r) => r.material.name },
          { key: 'sku', header: 'Code' },
          { key: 'store', header: 'Store', render: (r) => r.store.name, csv: (r) => r.store.name },
          { key: 'onHand', header: 'On hand', align: 'num', render: (r) => fmtQty(r.onHand, r.material.unit) },
          { key: 'reserved', header: 'Reserved', align: 'num', render: (r) => fmtQty(r.reserved) },
          { key: 'availableForIssue', header: 'Free for issue', align: 'num', render: (r) => fmtQty(r.availableForIssue) },
          { key: 'reorder', header: 'Reorder level', align: 'num' },
          { key: 'status', header: 'Status', render: (r) => <Badge>{r.status}</Badge> },
          { key: 'value', header: 'Value', align: 'num', render: (r) => formatINR(r.value) },
        ],
      }
    }
    case 'receipts': {
      const rows = inv.state.receipts.filter((g) => g.deliveryDate === day)
      return {
        rows,
        columns: [
          { key: 'id', header: 'GRN' }, { key: 'po', header: 'PO' }, { key: 'supplier', header: 'Supplier' },
          { key: 'm', header: 'Material', render: (g) => name(g.sku), csv: (g) => name(g.sku) },
          { key: 'ordered', header: 'Ordered', align: 'num' }, { key: 'delivered', header: 'Delivered', align: 'num' },
          { key: 'accepted', header: 'Accepted', align: 'num', render: (g) => fmtQty(g.accepted) },
          { key: 'rejected', header: 'Rejected', align: 'num', render: (g) => fmtQty(g.rejected) },
          { key: 'u', header: 'Unit', render: (g) => unitOf(g.sku), csv: (g) => unitOf(g.sku) },
          { key: 'store', header: 'Store', render: (g) => storeOf(g.storeId).name, csv: (g) => storeOf(g.storeId).name },
          { key: 'receivedBy', header: 'Received by' },
          { key: 'status', header: 'Status', render: (g) => <Badge>{g.status}</Badge> },
        ],
      }
    }
    case 'issues': {
      const rows = inv.state.issues.filter((i) => i.at.startsWith(day)).map((i) => ({ ...i, r: reqById[i.requestId] }))
      return {
        rows,
        columns: [
          { key: 'id', header: 'Issue' }, { key: 'requestId', header: 'Request' },
          { key: 't', header: 'Time', render: (i) => i.at.slice(11, 16), csv: (i) => i.at.slice(11, 16) },
          { key: 'site', header: 'Site', render: (i) => siteOf(i.r.siteId)?.name, csv: (i) => siteOf(i.r.siteId)?.name },
          { key: 'm', header: 'Material', render: (i) => name(i.r.sku), csv: (i) => name(i.r.sku) },
          { key: 'qty', header: 'Issued', align: 'num', render: (i) => fmtQty(i.qty, unitOf(i.r.sku)) },
          { key: 'store', header: 'From store', render: (i) => storeOf(i.r.storeId).name, csv: (i) => storeOf(i.r.storeId).name },
          { key: 'issuedBy', header: 'Issued by' }, { key: 'receivedBy', header: 'Received by' },
        ],
      }
    }
    case 'low': {
      const rows = inv.stock.filter((s) => s.status !== 'In Stock')
      return {
        rows, rowKey: 'key',
        columns: [
          { key: 'name', header: 'Material', render: (r) => r.material.name, csv: (r) => r.material.name },
          { key: 'store', header: 'Store', render: (r) => r.store.name, csv: (r) => r.store.name },
          { key: 'availableForIssue', header: 'Free for issue', align: 'num', render: (r) => fmtQty(r.availableForIssue, r.material.unit) },
          { key: 'reorder', header: 'Reorder level', align: 'num' },
          { key: 'shortage', header: 'Shortage', align: 'num' },
          { key: 'onOrder', header: 'On order', align: 'num' },
          { key: 'suggested', header: 'Suggested reorder', align: 'num' },
          { key: 'status', header: 'Status', render: (r) => <Badge>{r.status}</Badge> },
        ],
      }
    }
    case 'movement': {
      const rows = inv.movements.filter((m) => m.at.slice(0, 10) >= from && m.at.slice(0, 10) <= to).slice().reverse()
      return { rows, columns: movementColumns }
    }
    case 'consumption': {
      const rows = projectConsumption(inv.state)
      return {
        rows, rowKey: 'key',
        total: `Net value consumed ${formatINR(rows.reduce((s, r) => s + r.value, 0))}`,
        columns: [
          { key: 'project', header: 'Project' },
          { key: 'm', header: 'Material', render: (r) => r.material.name, csv: (r) => r.material.name },
          { key: 'issued', header: 'Issued', align: 'num', render: (r) => fmtQty(r.issued, r.material.unit) },
          { key: 'returned', header: 'Returned (accepted)', align: 'num', render: (r) => fmtQty(r.returned) },
          { key: 'net', header: 'Net consumed', align: 'num', render: (r) => <b>{fmtQty(r.net, r.material.unit)}</b> },
          { key: 'value', header: 'Value', align: 'num', render: (r) => formatINR(r.value) },
        ],
      }
    }
    case 'damaged': {
      const rows = damagedRegister(inv.state)
      return {
        rows,
        total: `Estimated value ${formatINR(rows.reduce((s, r) => s + r.value, 0))}`,
        columns: [
          { key: 'date', header: 'Date', render: (r) => formatDate(r.date) },
          { key: 'id', header: 'Reference' },
          { key: 'source', header: 'Source' },
          { key: 'm', header: 'Material', render: (r) => r.material.name, csv: (r) => r.material.name },
          { key: 'qty', header: 'Quantity', align: 'num', render: (r) => fmtQty(r.qty, r.material.unit) },
          { key: 'store', header: 'Store', render: (r) => r.store.name, csv: (r) => r.store.name },
          { key: 'reason', header: 'Reason', render: (r) => <span className="wrap-cell">{r.reason}</span> },
          { key: 'value', header: 'Est. value', align: 'num', render: (r) => formatINR(r.value) },
        ],
      }
    }
    case 'discrepancy': {
      const rows = discrepancyRegister(inv.state)
      return {
        rows,
        columns: [
          { key: 'date', header: 'Date', render: (r) => formatDate(r.date) },
          { key: 'id', header: 'Reference' },
          { key: 'kind', header: 'Kind' },
          { key: 'm', header: 'Material', render: (r) => r.material.name, csv: (r) => r.material.name },
          { key: 'store', header: 'Store', render: (r) => r.store.name, csv: (r) => r.store.name },
          { key: 'detail', header: 'Detail', render: (r) => <span className="wrap-cell">{r.detail}</span> },
          { key: 'status', header: 'Status', render: (r) => <Badge>{r.status}</Badge> },
          { key: 'note', header: 'Review note', render: (r) => <span className="cell-sub wrap-cell">{r.note || '—'}</span> },
        ],
      }
    }
    default: return { rows: [], columns: [] }
  }
}

export default function Reports({ inv, params, setParams }) {
  const report = REPORTS.find((r) => r.id === params.get('report')) || REPORTS[0]
  const [day, setDay] = useState(todayISO())
  const [from, setFrom] = useState(addDays(todayISO(), -6))
  const [to, setTo] = useState(todayISO())
  const { rows, columns, rowKey, total } = build(report.id, inv, { day, from, to })
  const choose = (id) => setParams({ tab: 'reports', report: id })

  return (
    <Card title={`${report.label} Report`} sub={`Generated ${fmtStamp(nowStamp())} from the same records as the dashboard`} bodyClass=""
      action={<div className="cell-actions"><DemoTag /><button className="btn btn-sm" onClick={() => downloadCsv(`${report.id}-report-demo.csv`, columns, rows)} disabled={!rows.length}>Export CSV</button></div>}>
      <div className="toolbar">
        <div className="filters">
          <label className="field">Report
            <select value={report.id} onChange={(e) => choose(e.target.value)}>
              {REPORTS.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}
            </select>
          </label>
          {report.daily && <label className="field">Date<input type="date" value={day} max={todayISO()} onChange={(e) => setDay(e.target.value || todayISO())} /></label>}
          {report.range && <>
            <label className="field">From<input type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value || from)} /></label>
            <label className="field">To<input type="date" value={to} max={todayISO()} onChange={(e) => setTo(e.target.value || to)} /></label>
          </>}
        </div>
      </div>
      <div className="filter-note" style={{ padding: '0 18px' }}>
        {rows.length} rows{total ? ` · ${total}` : ''}{report.id === 'stock' && ` · ${formatCompactINR(inv.summary.stockValue)} matches the dashboard card`}
      </div>
      <DataTable dense rows={rows} columns={columns} rowKey={rowKey || 'id'} emptyText="Nothing to report for this selection." />
    </Card>
  )
}
