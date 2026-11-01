import { Badge, Card, Kpi, PageHead } from '../components/UI.jsx'
import { BarChart } from '../components/Charts.jsx'
import { cashflow, invoices, formatINR } from '../data/mockData.js'

export default function Finance({ projects, search }) {
  const q = search.toLowerCase()
  const list = invoices.filter((i) => !q || `${i.no} ${i.client} ${i.project}`.toLowerCase().includes(q))

  const receivable = invoices.filter((i) => i.status !== 'Paid').reduce((s, i) => s + i.amount, 0)
  const overdue = invoices.filter((i) => i.status === 'Overdue').reduce((s, i) => s + i.amount, 0)
  const inflowYTD = cashflow.reduce((s, c) => s + c.inflow, 0)
  const outflowYTD = cashflow.reduce((s, c) => s + c.outflow, 0)

  const budgetData = projects.slice(0, 6).map((p) => ({ m: p.name.split(' ')[0], budget: p.budget, spent: p.spent }))

  return (
    <>
      <PageHead title="Finance" sub="Receivables, invoices and project budgets" />

      <div className="grid kpis">
        <Kpi label="Inflow (12 mo)" value={`₹${inflowYTD.toFixed(1)} Cr`} icon="trend" delta={14.2} foot="year on year" />
        <Kpi label="Outflow (12 mo)" value={`₹${outflowYTD.toFixed(1)} Cr`} icon="wallet" />
        <Kpi label="Receivables" value={formatINR(receivable)} icon="rupee" />
        <Kpi label="Overdue" value={formatINR(overdue)} icon="alert" foot="needs follow-up" />
      </div>

      <div className="grid halves">
        <Card title="Budget vs Spent" sub="By project (₹ Cr)">
          <BarChart
            data={budgetData}
            keys={['budget', 'spent']}
            labels={['Budget', 'Spent']}
            colors={['var(--chart-2)', 'var(--chart-1)']}
            unit=" Cr"
          />
        </Card>
        <Card title="Monthly Cash Flow" sub="Inflow vs outflow (₹ Cr)">
          <BarChart
            data={cashflow.slice(-6)}
            keys={['inflow', 'outflow']}
            labels={['Inflow', 'Outflow']}
            colors={['var(--chart-3)', 'var(--chart-1)']}
            unit=" Cr"
          />
        </Card>
      </div>

      <Card title="Invoices" bodyClass="">
        <div className="table-wrap" style={{ marginTop: 14 }}>
          <table>
            <thead>
              <tr><th>Invoice</th><th>Client</th><th>Project</th><th className="num">Amount</th><th>Due date</th><th>Status</th></tr>
            </thead>
            <tbody>
              {list.map((i) => (
                <tr key={i.no}>
                  <td className="cell-main">{i.no}</td>
                  <td>{i.client}</td>
                  <td>{i.project}</td>
                  <td className="num">{formatINR(i.amount)}</td>
                  <td>{new Date(i.due).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</td>
                  <td><Badge>{i.status}</Badge></td>
                </tr>
              ))}
            </tbody>
          </table>
          {list.length === 0 && <div className="empty">No invoices found.</div>}
        </div>
      </Card>
    </>
  )
}
