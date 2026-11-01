import { BarChart, HBarList, LineChart } from '../../components/Charts.jsx'
import { Card } from '../../components/UI.jsx'
import { formatCompactINR, formatNumber } from '../../utils/format.js'

const statusTone = (r) => (r.status === 'Completed' ? 'ok' : r.status === 'At Risk' ? 'bad' : r.status === 'Delayed' ? 'warn' : '')

export function ProjectProgressChart({ projects }) {
  return (
    <Card title="Project Progress" sub="Physical completion">
      <HBarList
        rows={projects.map((p) => ({ label: p.short || p.name, value: p.progress, status: p.status }))}
        max={100}
        format={(v) => `${v}%`}
        tone={statusTone}
      />
    </Card>
  )
}

export function BudgetVsActualChart({ data }) {
  return (
    <Card title="Budget vs Actual" sub="Project lifetime (₹ Cr)">
      <BarChart data={data} xKey="x" keys={['budget', 'actual']} labels={['Budget', 'Actual']} colors={['var(--chart-2)', 'var(--chart-1)']} unit=" Cr" />
    </Card>
  )
}

export function LabourCostChart({ data }) {
  return (
    <Card title="Labour Cost by Project" sub="Selected range">
      <BarChart data={data} xKey="x" keys={['cost']} labels={['Labour cost']} colors={['var(--chart-1)']} format={formatCompactINR} />
    </Card>
  )
}

export function AttendanceTrendChart({ data }) {
  return (
    <Card title="Attendance Trend" sub="Workers present vs absent">
      <LineChart data={data} keys={['present', 'absent']} labels={['Present', 'Absent']} colors={['var(--chart-3)', 'var(--danger)']} format={formatNumber} />
    </Card>
  )
}

export function SalesCollectionsChart({ data }) {
  return (
    <Card title="Sales & Collections" sub="Booking value vs collections received">
      <BarChart data={data} xKey="x" keys={['bookings', 'collections']} labels={['Bookings', 'Collections']} colors={['var(--chart-2)', 'var(--chart-3)']} format={formatCompactINR} />
    </Card>
  )
}

export function PurchaseInventoryChart({ data }) {
  return (
    <Card title="Purchase & Inventory" sub="PO value, goods received and issued to site">
      <BarChart
        data={data}
        xKey="x"
        keys={['ordered', 'received', 'issued']}
        labels={['Ordered', 'Received', 'Issued']}
        colors={['var(--chart-2)', 'var(--chart-3)', 'var(--chart-1)']}
        format={formatCompactINR}
      />
    </Card>
  )
}

/** Full analytics grid, all six charts. */
export default function DashboardCharts({ data }) {
  return (
    <>
      <div className="grid halves">
        <ProjectProgressChart projects={data.projects} />
        <BudgetVsActualChart data={data.finance.budgetVsActual} />
      </div>
      <div className="grid halves">
        <LabourCostChart data={data.labour.labourCostByProject} />
        <AttendanceTrendChart data={data.labour.attendanceTrend} />
      </div>
      <div className="grid halves">
        <SalesCollectionsChart data={data.sales.trend} />
        <PurchaseInventoryChart data={data.charts.purchaseInventoryTrend} />
      </div>
    </>
  )
}
