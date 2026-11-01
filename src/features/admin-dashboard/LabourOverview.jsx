import DataTable from '../../components/DataTable.jsx'
import StatGrid from '../../components/StatGrid.jsx'
import { BarChart, Donut, HBarList } from '../../components/Charts.jsx'
import { Card } from '../../components/UI.jsx'
import { formatCompactINR, formatDate, formatDateShort, formatNumber, relativeDay } from '../../utils/format.js'

export default function LabourOverview({ labour }) {
  const l = labour
  return (
    <>
      <StatGrid
        items={[
          { label: 'Registered labourers', value: formatNumber(l.registered) },
          { label: 'Present today', value: formatNumber(l.presentToday), tone: 'success' },
          { label: 'Absent today', value: formatNumber(l.absentToday), tone: l.absentToday ? 'danger' : undefined },
          { label: 'Pending requirements', value: l.requirements.length, sub: `${l.requirements.reduce((s, r) => s + r.qty, 0)} workers requested` },
          { label: 'Attendance to verify', value: l.attendancePending.length, tone: l.attendancePending.length ? 'warning' : undefined },
          { label: 'Labour cost (range)', value: formatCompactINR(l.labourCostTotal) },
          { label: 'Wages pending', value: formatCompactINR(l.wagesPendingTotal), tone: l.wagesPendingTotal ? 'warning' : undefined, sub: `${l.wagesPending.length} payroll batches` },
          { label: 'Advances outstanding', value: formatCompactINR(l.advancesOutstanding), sub: `${l.advances.length} labourers` },
        ]}
      />

      <div className="grid halves">
        <Card title="Labourers by Category" sub="Registered, all active sites">
          <HBarList rows={l.byCategory} format={formatNumber} />
        </Card>
        <Card title="Direct vs Contractor Labour">
          <Donut
            data={[{ label: 'Direct', value: l.direct }, { label: 'Contractor', value: l.contractor }]}
            colors={['var(--chart-1)', 'var(--chart-2)']}
            format={formatNumber}
            centerLabel="Total"
            centerValue={formatNumber(l.registered)}
          />
        </Card>
      </div>

      <Card title="Labour Cost by Project" sub="Selected date range" className="mb">
        <BarChart
          data={l.labourCostByProject}
          xKey="x"
          keys={['cost']}
          labels={['Labour cost']}
          colors={['var(--chart-1)']}
          format={formatCompactINR}
        />
      </Card>

      <div className="grid halves">
        <Card title="Pending Labour Requirements" bodyClass="">
          <DataTable
            rows={l.requirements}
            columns={[
              { key: 'id', header: 'Req #' },
              { key: 'projectName', header: 'Project' },
              { key: 'category', header: 'Trade', render: (r) => <><div className="cell-main">{r.category}</div>{r.note && <div className="cell-sub">{r.note}</div>}</> },
              { key: 'qty', header: 'Qty', align: 'num' },
              { key: 'neededBy', header: 'Needed by', render: (r) => `${formatDateShort(r.neededBy)} (${relativeDay(r.neededBy)})` },
            ]}
          />
        </Card>
        <Card title="Attendance Awaiting Verification" bodyClass="">
          <DataTable
            rows={l.attendancePending}
            columns={[
              { key: 'date', header: 'Date', render: (r) => formatDateShort(r.date) },
              { key: 'projectName', header: 'Project' },
              { key: 'workers', header: 'Workers', align: 'num' },
              { key: 'note', header: 'Note', render: (r) => <span className="cell-sub">{r.note}</span> },
              { key: 'submittedBy', header: 'Submitted by' },
            ]}
          />
        </Card>
      </div>

      <div className="grid halves">
        <Card title="Wage Payments Pending" bodyClass="">
          <DataTable
            rows={l.wagesPending}
            columns={[
              { key: 'id', header: 'Batch' },
              { key: 'projectName', header: 'Project' },
              { key: 'period', header: 'Period', render: (r) => r.period.replace(/\d{4}-\d{2}-\d{2}/, (d) => formatDate(d)) },
              { key: 'amount', header: 'Amount', align: 'num', render: (r) => formatCompactINR(r.amount) },
            ]}
          />
        </Card>
        <Card title="Outstanding Labour Advances" bodyClass="">
          <DataTable
            rows={l.advances}
            columns={[
              { key: 'labourer', header: 'Labourer' },
              { key: 'projectName', header: 'Project' },
              { key: 'date', header: 'Given', render: (r) => formatDateShort(r.date) },
              { key: 'amount', header: 'Advance', align: 'num', render: (r) => formatCompactINR(r.amount) },
              { key: 'outstanding', header: 'Outstanding', align: 'num', render: (r) => <b>{formatCompactINR(r.outstanding)}</b> },
            ]}
          />
        </Card>
      </div>
    </>
  )
}
