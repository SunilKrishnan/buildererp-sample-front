import DataTable from '../../components/DataTable.jsx'
import StatGrid from '../../components/StatGrid.jsx'
import { Badge, Card } from '../../components/UI.jsx'
import { formatCompactINR, formatDate, formatINR, relativeDay } from '../../utils/format.js'
import { SectionToolbar } from './shared.jsx'
import { useState } from 'react'
import { Chips } from '../../components/UI.jsx'
import { CustomerLink } from './CustomerAccount.jsx'

export const RECEIPT_VIEWS = ['Received', 'Outstanding', 'Payment schedule']
const sumOf = (rows, k) => rows.reduce((s, r) => s + r[k], 0)

const receiptColumns = (onOpenCustomer) => [
  { key: 'id', header: 'Receipt no.', render: (r) => <span className="cell-main">{r.id}</span> },
  { key: 'date', header: 'Date', render: (r) => formatDate(r.date) },
  { key: 'customer', header: 'Customer', render: (r) => <><CustomerLink row={r} onOpen={onOpenCustomer} /><div className="cell-sub">{r.unit} · {r.milestone}</div></> },
  { key: 'projectName', header: 'Project' },
  { key: 'method', header: 'Payment method' },
  { key: 'amount', header: 'Amount', align: 'num', render: (r) => formatINR(r.amount) },
]

const receivableColumns = (onOpenCustomer) => [
  { key: 'id', header: 'Ref', render: (r) => <span className="cell-main">{r.id}</span> },
  { key: 'customer', header: 'Customer', render: (r) => <><CustomerLink row={r} onOpen={onOpenCustomer} /><div className="cell-sub">{r.unit} · {r.milestone}</div></> },
  { key: 'projectName', header: 'Project' },
  { key: 'dueDate', header: 'Due date', render: (r) => <><div>{formatDate(r.dueDate)}</div><div className="cell-sub">{relativeDay(r.dueDate)}</div></> },
  { key: 'amount', header: 'Amount', align: 'num', render: (r) => formatINR(r.amount) },
  { key: 'status', header: 'Status', render: (r) => <Badge>{r.status}</Badge> },
]

/** Section B: customer receipts and instalments still to collect. */
export const SCHEDULE_FILTERS = ['All', 'Overdue', 'Due in 7 days', 'Due in 30 days', 'Upcoming']
const inScheduleFilter = (r, f) =>
  f === 'All' || (f === 'Overdue' && r.status === 'Overdue') || (f === 'Upcoming' && r.status === 'Upcoming') ||
  (f === 'Due in 7 days' && r.status !== 'Overdue' && r.status !== 'Upcoming' && r.daysToDue <= 7) ||
  (f === 'Due in 30 days' && r.status !== 'Overdue' && r.status !== 'Upcoming' && r.daysToDue <= 30)

const scheduleColumns = (onOpenCustomer) => [
  { key: 'date', header: 'Due date', render: (r) => <><div>{formatDate(r.date)}</div><div className={`cell-sub ${r.daysOverdue ? 'down' : ''}`}>{r.daysOverdue ? `${r.daysOverdue} days overdue` : r.expected ? 'expected' : relativeDay(r.date)}</div></> },
  { key: 'customer', header: 'Customer', render: (r) => <><CustomerLink row={r} onOpen={onOpenCustomer} /><div className="cell-sub">{r.unit} · {r.projectName}</div></> },
  { key: 'milestone', header: 'Instalment' },
  { key: 'amount', header: 'Amount', align: 'num', render: (r) => formatINR(r.amount) },
  { key: 'status', header: 'Status', render: (r) => <Badge>{r.status}</Badge> },
  {
    key: 'remind', header: '',
    render: (r) => (r.status === 'Upcoming' ? null : <button className="btn btn-sm" onClick={() => onOpenCustomer(r.bookingId, 'reminders')}>Remind</button>),
  },
]

export default function ReceiptsSection({ receipts, receivables, schedule = [], view = 'Received', onViewChange, onOpenCustomer, compact = false }) {
  if (compact) {
    return (
      <Card title="Recent Customer Receipts" sub="Booking amounts and instalments received" bodyClass="" className="mb">
        <DataTable rows={receipts} columns={receiptColumns(onOpenCustomer)} limit={6} emptyText="No receipts in the selected range." />
      </Card>
    )
  }

  const overdue = receivables.filter((r) => r.status === 'Overdue')
  return (
    <>
      <StatGrid
        items={[
          { label: 'Received in range', value: formatCompactINR(sumOf(receipts, 'amount')), sub: `${receipts.length} receipts`, tone: 'success' },
          { label: 'Booking amounts', value: formatCompactINR(sumOf(receipts.filter((r) => r.milestone.startsWith('Booking')), 'amount')) },
          { label: 'Instalments', value: formatCompactINR(sumOf(receipts.filter((r) => !r.milestone.startsWith('Booking')), 'amount')) },
          { label: 'Outstanding', value: formatCompactINR(sumOf(receivables, 'amount')), sub: `${receivables.length} instalments`, tone: receivables.length ? 'warning' : undefined },
          { label: 'Overdue', value: formatCompactINR(sumOf(overdue, 'amount')), sub: `${overdue.length} customers to follow up`, tone: overdue.length ? 'danger' : undefined },
        ]}
      />
      <Card
        title={view === 'Received' ? 'Customer Receipts' : view === 'Outstanding' ? 'Outstanding Customer Payments' : 'Payment Schedule'}
        sub={
          view === 'Received' ? 'Money received from home buyers in the selected range'
            : view === 'Outstanding' ? 'Instalments due or overdue as of today (not limited by date range)'
              : 'Every instalment still to be paid, earliest first: overdue, demanded and upcoming (expected on construction milestones)'
        }
        bodyClass=""
        className="mb"
      >
        <SectionToolbar statuses={RECEIPT_VIEWS} status={view} onStatusChange={onViewChange} />
        {view === 'Received'
          ? <DataTable rows={receipts} columns={receiptColumns(onOpenCustomer)} emptyText="No receipts match these filters." />
          : view === 'Outstanding'
            ? <DataTable rows={receivables} columns={receivableColumns(onOpenCustomer)} emptyText="No outstanding customer payments." />
            : <ScheduleList schedule={schedule} onOpenCustomer={onOpenCustomer} />}
      </Card>
    </>
  )
}

export { receivableColumns }

function ScheduleList({ schedule, onOpenCustomer }) {
  const [filter, setFilter] = useState('All')
  const rows = schedule.filter((r) => inScheduleFilter(r, filter))
  const total = rows.reduce((s, r) => s + r.amount, 0)
  return (
    <>
      <div className="toolbar plain">
        <Chips options={SCHEDULE_FILTERS} value={filter} onChange={setFilter} />
        <span className="cell-sub">{rows.length} payments · {formatINR(total)}</span>
      </div>
      <DataTable dense rows={rows} columns={scheduleColumns(onOpenCustomer)} limit={80} emptyText="No payments in this filter." />
    </>
  )
}
