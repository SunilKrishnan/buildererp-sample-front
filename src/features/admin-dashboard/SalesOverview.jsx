import { todayISO } from '../../utils/date.js'
import DataTable from '../../components/DataTable.jsx'
import StatGrid from '../../components/StatGrid.jsx'
import { HBarList } from '../../components/Charts.jsx'
import { Badge, Card, Progress } from '../../components/UI.jsx'
import { formatCompactINR, formatDateShort, relativeDay } from '../../utils/format.js'

const STAGES = ['New', 'Contacted', 'Follow-up', 'Site Visit Scheduled', 'Negotiation', 'Booked', 'Lost']

export default function SalesOverview({ sales }) {
  const s = sales
  const u = s.unitsTotal

  return (
    <>
      <StatGrid
        items={[
          { label: 'Leads (range)', value: s.leads.length },
          { label: 'Follow-ups due (7 days)', value: s.followUps.length, tone: s.followUps.some((l) => l.nextFollowUp < todayISO()) ? 'danger' : undefined },
          { label: 'Site visits scheduled', value: s.siteVisits.length },
          { label: 'Bookings (range)', value: s.bookings.length, sub: formatCompactINR(s.bookingValue) },
          { label: 'Available units', value: u.available },
          { label: 'Booked units', value: u.booked },
          { label: 'Sold units', value: u.sold, tone: 'success' },
          { label: 'Collected (range)', value: formatCompactINR(s.collectedTotal), tone: 'success' },
          { label: 'Outstanding', value: formatCompactINR(s.outstandingTotal), sub: `${formatCompactINR(s.overdueTotal)} overdue`, tone: s.overdueTotal ? 'danger' : undefined },
        ]}
      />

      <div className="grid halves">
        <Card title="Unit Inventory by Project" bodyClass="">
          <DataTable
            rowKey="projectId"
            rows={s.units}
            columns={[
              { key: 'projectName', header: 'Project' },
              { key: 'total', header: 'Total', align: 'num' },
              { key: 'available', header: 'Available', align: 'num' },
              { key: 'booked', header: 'Booked', align: 'num' },
              { key: 'sold', header: 'Sold', align: 'num' },
              {
                key: 'pct', header: 'Sold %',
                render: (r) => (
                  <div style={{ minWidth: 90 }}>
                    <Progress value={r.total ? (r.sold / r.total) * 100 : 0} tone="ok" />
                  </div>
                ),
              },
            ]}
          />
        </Card>
        <Card title="Lead Pipeline" sub="Leads created in range, by stage">
          <HBarList rows={STAGES.map((st) => ({ label: st, value: s.leadStages[st] || 0 }))} tone={(r) => (r.label === 'Booked' ? 'ok' : r.label === 'Lost' ? 'bad' : '')} />
        </Card>
      </div>

      <div className="grid halves">
        <Card title="Follow-ups Due" sub="Overdue and next 7 days" bodyClass="">
          <DataTable
            rows={s.followUps}
            limit={8}
            emptyText="No follow-ups due."
            columns={[
              { key: 'name', header: 'Lead', render: (r) => <><div className="cell-main">{r.name}</div><div className="cell-sub">{r.projectName}</div></> },
              { key: 'stage', header: 'Stage', render: (r) => <Badge>{r.stage}</Badge> },
              { key: 'nextFollowUp', header: 'Follow-up', render: (r) => <span className={r.nextFollowUp < todayISO() ? 'down' : ''}>{relativeDay(r.nextFollowUp)}</span> },
              { key: 'owner', header: 'Owner' },
            ]}
          />
        </Card>
        <Card title="Scheduled Site Visits" bodyClass="">
          <DataTable
            rows={s.siteVisits}
            emptyText="No site visits scheduled."
            columns={[
              { key: 'siteVisit', header: 'Date', render: (r) => `${formatDateShort(r.siteVisit)} · ${relativeDay(r.siteVisit)}` },
              { key: 'name', header: 'Lead' },
              { key: 'projectName', header: 'Project' },
              { key: 'owner', header: 'Owner' },
            ]}
          />
        </Card>
      </div>

      <div className="grid halves">
        <Card title="Recent Bookings" bodyClass="">
          <DataTable
            rows={s.bookings}
            limit={8}
            columns={[
              { key: 'date', header: 'Date', render: (r) => formatDateShort(r.date) },
              { key: 'customer', header: 'Customer' },
              { key: 'unit', header: 'Unit', render: (r) => <><div>{r.unit}</div><div className="cell-sub">{r.projectName}</div></> },
              { key: 'value', header: 'Value', align: 'num', render: (r) => formatCompactINR(r.value) },
            ]}
          />
        </Card>
        <Card title="Outstanding Customer Collections" bodyClass="">
          <DataTable
            rows={s.outstanding}
            limit={8}
            emptyText="No outstanding collections."
            columns={[
              { key: 'customer', header: 'Customer', render: (r) => <><div className="cell-main">{r.customer}</div><div className="cell-sub">{r.projectName}</div></> },
              { key: 'milestone', header: 'Milestone' },
              { key: 'date', header: 'Due', render: (r) => formatDateShort(r.date) },
              { key: 'amount', header: 'Amount', align: 'num', render: (r) => formatCompactINR(r.amount) },
              { key: 'status', header: 'Status', render: (r) => <Badge>{r.status}</Badge> },
            ]}
          />
        </Card>
      </div>
    </>
  )
}
