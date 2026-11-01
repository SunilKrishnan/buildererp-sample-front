import { todayISO } from '../../utils/date.js'
import { useState } from 'react'
import DataTable from '../../components/DataTable.jsx'
import StatGrid from '../../components/StatGrid.jsx'
import { Badge, Card, Chips } from '../../components/UI.jsx'
import { formatCompactINR, formatDateShort, formatNumber, relativeDay } from '../../utils/format.js'

const PO_FILTERS = ['All', 'Pending Approval', 'Issued', 'Partially Received', 'Received']

export default function PurchaseOverview({ purchase }) {
  const [poFilter, setPoFilter] = useState('All')
  const p = purchase
  const pos = p.purchaseOrders.filter((po) => poFilter === 'All' || po.status === poFilter)

  return (
    <>
      <StatGrid
        items={[
          { label: 'Material requests pending', value: p.materialRequests.length, tone: p.materialRequests.length ? 'warning' : undefined },
          { label: 'Purchase orders (range)', value: p.purchaseOrders.length, sub: `${p.poStatusCounts['Pending Approval'] || 0} awaiting approval` },
          { label: 'Deliveries awaiting receipt', value: p.deliveriesAwaiting.length },
          { label: 'Supplier invoices to verify', value: p.invoicesAwaiting.length, tone: p.invoicesAwaiting.length ? 'warning' : undefined },
          { label: 'Purchase expenses (range)', value: formatCompactINR(p.purchaseExpense) },
        ]}
      />

      <div className="grid halves">
        <Card title="Pending Material Requests" bodyClass="">
          <DataTable
            rows={p.materialRequests}
            columns={[
              { key: 'id', header: 'MR #' },
              { key: 'material', header: 'Material' },
              { key: 'qty', header: 'Qty', align: 'num', render: (r) => `${formatNumber(r.qty)} ${r.unit}` },
              { key: 'projectName', header: 'Project' },
              { key: 'date', header: 'Raised', render: (r) => relativeDay(r.date) },
            ]}
          />
        </Card>
        <Card title="Deliveries Awaiting Receipt" bodyClass="">
          <DataTable
            rows={p.deliveriesAwaiting}
            columns={[
              { key: 'id', header: 'PO #' },
              { key: 'vendor', header: 'Vendor' },
              { key: 'projectName', header: 'Project' },
              {
                key: 'expected', header: 'Expected',
                render: (r) => <span className={r.expected < todayISO() ? 'down' : ''}>{formatDateShort(r.expected)}</span>,
              },
              { key: 'status', header: 'Status', render: (r) => <Badge>{r.status}</Badge> },
            ]}
          />
        </Card>
      </div>

      <Card title="Purchase Orders" sub="Raised in the selected date range" bodyClass="" className="mb">
        <div className="toolbar" style={{ marginTop: 12 }}>
          <Chips options={PO_FILTERS} value={poFilter} onChange={setPoFilter} />
        </div>
        <DataTable
          rows={pos}
          columns={[
            { key: 'id', header: 'PO #', render: (r) => <span className="cell-main">{r.id}</span> },
            { key: 'vendor', header: 'Vendor' },
            { key: 'material', header: 'Material' },
            { key: 'projectName', header: 'Project' },
            { key: 'date', header: 'Date', render: (r) => formatDateShort(r.date) },
            { key: 'amount', header: 'Amount', align: 'num', render: (r) => formatCompactINR(r.amount) },
            { key: 'status', header: 'Status', render: (r) => <Badge>{r.status}</Badge> },
          ]}
        />
      </Card>

      <Card title="Supplier Invoices Awaiting Verification" bodyClass="" className="mb">
        <DataTable
          rows={p.invoicesAwaiting}
          columns={[
            { key: 'id', header: 'Invoice #' },
            { key: 'vendor', header: 'Supplier' },
            { key: 'poId', header: 'Against PO' },
            { key: 'projectName', header: 'Project' },
            { key: 'date', header: 'Received', render: (r) => formatDateShort(r.date) },
            { key: 'amount', header: 'Amount', align: 'num', render: (r) => formatCompactINR(r.amount) },
            { key: 'status', header: 'Status', render: (r) => <Badge>{r.status}</Badge> },
          ]}
        />
      </Card>
    </>
  )
}
