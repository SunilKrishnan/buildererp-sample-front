import { useState } from 'react'
import DataTable from '../../components/DataTable.jsx'
import StatGrid from '../../components/StatGrid.jsx'
import Tabs from '../../components/Tabs.jsx'
import { Badge, Card, Progress } from '../../components/UI.jsx'
import { DemoTag } from '../../components/StateViews.jsx'
import { formatCompactINR, formatDateShort, formatNumber } from '../../utils/format.js'

export default function InventoryAlerts({ inventory }) {
  const [moveTab, setMoveTab] = useState('receipts')
  const inv = inventory
  const alerts = [...inv.outOfStock, ...inv.lowStock]

  return (
    <>
      <div className="section-title">
        <h2>Inventory</h2>
        <DemoTag>Illustrative inventory records</DemoTag>
      </div>

      <StatGrid
        items={[
          { label: 'Materials tracked', value: inv.items.length, sub: 'Across site stores' },
          { label: 'Stock value', value: formatCompactINR(inv.stockValue) },
          { label: 'Low stock', value: inv.lowStock.length, tone: inv.lowStock.length ? 'warning' : undefined },
          { label: 'Out of stock', value: inv.outOfStock.length, tone: inv.outOfStock.length ? 'danger' : undefined },
          { label: 'Damaged items', value: inv.damaged.length, sub: 'Need write-off review' },
        ]}
      />

      <div className="grid halves">
        <Card title="Stock Alerts" sub="Out of stock and below reorder level" bodyClass="">
          <DataTable
            rowKey="key"
            rows={alerts.map((a) => ({ ...a, key: `${a.projectId}-${a.material}` }))}
            emptyText="All materials are above reorder level."
            columns={[
              { key: 'material', header: 'Material', render: (r) => <><div className="cell-main">{r.material}</div><div className="cell-sub">{r.projectName}</div></> },
              {
                key: 'qty', header: 'Stock / reorder',
                render: (r) => (
                  <div style={{ minWidth: 120 }}>
                    <div className="prog-row"><span>{formatNumber(r.qty)} / {formatNumber(r.reorder)} {r.unit}</span></div>
                    <Progress value={(r.qty / r.reorder) * 100} tone={r.qty === 0 ? 'bad' : 'warn'} />
                  </div>
                ),
              },
              { key: 'status', header: 'Status', render: (r) => <Badge>{r.qty === 0 ? 'Out of Stock' : 'Low'}</Badge> },
            ]}
          />
        </Card>
        <Card title="Damaged Materials" bodyClass="">
          <DataTable
            rowKey="key"
            rows={inv.damaged.map((a) => ({ ...a, key: `${a.projectId}-${a.material}` }))}
            emptyText="No damaged materials reported."
            columns={[
              { key: 'material', header: 'Material' },
              { key: 'projectName', header: 'Site store' },
              { key: 'damaged', header: 'Damaged qty', align: 'num', render: (r) => `${formatNumber(r.damaged)} ${r.unit}` },
              { key: 'value', header: 'Est. value', align: 'num', render: (r) => formatCompactINR(r.damaged * r.rate) },
            ]}
          />
        </Card>
      </div>

      <Card title="Recent Material Movements" bodyClass="" className="mb">
        <div style={{ padding: '8px 18px 0' }}>
          <Tabs
            label="Movement type"
            value={moveTab}
            onChange={setMoveTab}
            tabs={[
              { id: 'receipts', label: `Receipts (${inv.receipts.length})` },
              { id: 'issues', label: `Issues to site (${inv.issues.length})` },
            ]}
          />
        </div>
        <DataTable
          limit={10}
          rows={moveTab === 'receipts' ? inv.receipts : inv.issues}
          columns={[
            { key: 'id', header: 'Ref #' },
            { key: 'date', header: 'Date', render: (r) => formatDateShort(r.date) },
            { key: 'material', header: 'Material' },
            { key: 'qty', header: 'Qty', align: 'num', render: (r) => `${formatNumber(r.qty)} ${r.unit}` },
            { key: 'projectName', header: 'Project' },
            { key: 'value', header: 'Value', align: 'num', render: (r) => formatCompactINR(r.value) },
            { key: 'by', header: 'Recorded by' },
          ]}
        />
      </Card>
    </>
  )
}
