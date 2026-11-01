import { useState } from 'react'
import DataTable from '../../components/DataTable.jsx'
import StatGrid from '../../components/StatGrid.jsx'
import { BarChart, Donut } from '../../components/Charts.jsx'
import { Badge, Card, Chips } from '../../components/UI.jsx'
import { formatCompactINR, formatDateShort } from '../../utils/format.js'

const COLORS = ['var(--chart-1)', 'var(--chart-2)', 'var(--chart-3)', 'var(--warning)', 'var(--muted)']

export default function FinanceOverview({ finance }) {
  const [payFilter, setPayFilter] = useState('All')
  const f = finance
  const payments = f.payments.filter((p) => payFilter === 'All' || p.status === payFilter)

  return (
    <>
      <StatGrid
        items={[
          { label: 'Project expenses', value: formatCompactINR(f.totalExpense), sub: 'Selected range' },
          { label: 'Labour expenses', value: formatCompactINR(f.labourExpense) },
          { label: 'Material expenses', value: formatCompactINR(f.materialExpense) },
          { label: 'Contractor payments', value: formatCompactINR(f.contractorPayments) },
          { label: 'Pending payments', value: formatCompactINR(f.pendingTotal), sub: `${f.pendingCount} payments`, tone: f.pendingCount ? 'warning' : undefined },
          { label: 'Completed payments', value: formatCompactINR(f.completedTotal), sub: `${f.completedCount} payments`, tone: 'success' },
        ]}
      />

      <div className="grid two-one">
        <Card title="Expense Trend" sub="Material, labour and contractor spend">
          <BarChart
            data={f.expenseTrend}
            xKey="x"
            keys={['Material', 'Labour', 'Contractor']}
            labels={['Material', 'Labour', 'Contractor']}
            colors={COLORS}
            format={formatCompactINR}
          />
        </Card>
        <Card title="Expenses by Category">
          <Donut
            data={f.byCategory}
            colors={COLORS}
            format={formatCompactINR}
            centerLabel="Total"
            centerValue={formatCompactINR(f.totalExpense)}
          />
        </Card>
      </div>

      <Card title="Budget vs Actual" sub="Project lifetime (₹ Cr)" bodyClass="" className="mb">
        <DataTable
          rowKey="x"
          rows={f.budgetVsActual}
          columns={[
            { key: 'label', header: 'Project' },
            { key: 'budget', header: 'Budget', align: 'num', render: (r) => `₹${r.budget.toFixed(1)} Cr` },
            { key: 'actual', header: 'Actual', align: 'num', render: (r) => `₹${r.actual.toFixed(1)} Cr` },
            {
              key: 'variance', header: 'Remaining', align: 'num',
              render: (r) => {
                const rem = r.budget - r.actual
                return <span className={rem / r.budget < 0.05 ? 'down' : ''}>₹{rem.toFixed(1)} Cr</span>
              },
            },
            { key: 'used', header: 'Used', align: 'num', render: (r) => `${Math.round((r.actual / r.budget) * 100)}%` },
          ]}
        />
      </Card>

      <Card title="Payments" sub="Supplier, contractor and wage payments in range" bodyClass="" className="mb">
        <div className="toolbar" style={{ marginTop: 12 }}>
          <Chips options={['All', 'Pending', 'Completed']} value={payFilter} onChange={setPayFilter} />
        </div>
        <DataTable
          rows={payments}
          limit={12}
          columns={[
            { key: 'id', header: 'Ref #' },
            { key: 'date', header: 'Date', render: (r) => formatDateShort(r.date) },
            { key: 'payee', header: 'Payee', render: (r) => <><div className="cell-main">{r.payee}</div><div className="cell-sub">{r.type}</div></> },
            { key: 'projectName', header: 'Project' },
            { key: 'amount', header: 'Amount', align: 'num', render: (r) => formatCompactINR(r.amount) },
            { key: 'status', header: 'Status', render: (r) => <Badge tone={r.status === 'Completed' ? 'success' : 'warning'}>{r.status}</Badge> },
          ]}
        />
      </Card>
    </>
  )
}
