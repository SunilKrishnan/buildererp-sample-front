import { useState } from 'react'
import { Link } from 'react-router-dom'
import DataTable from '../../components/DataTable.jsx'
import StatGrid from '../../components/StatGrid.jsx'
import Icon from '../../components/Icon.jsx'
import { Badge, Card } from '../../components/UI.jsx'
import { formatCompactINR, formatDate, formatINR } from '../../utils/format.js'
import { BILL_STAGES, stageMatches } from '../bill-review/BillWorkflowContext.jsx'
import { AiBadge, RecordChips } from '../bill-review/BillReviewPanel.jsx'
import { SectionToolbar } from './shared.jsx'

export const EXPENSE_STATUSES = BILL_STAGES
const sumOf = (rows) => rows.reduce((s, r) => s + r.amount, 0)

function AiCell({ r }) {
  if (r.s.historic) return <span className="cell-sub">-</span>
  if (!r.s.aiRunAt) return <span className="cell-sub">Not run</span>
  return <AiBadge report={r.rec.report} notes={r.s.findingNotes} />
}

/**
 * Supplier and site bills with their records and workflow stage. Bills are verified,
 * approved and paid as separate steps in the bill review panel.
 */
export default function ExpensesSection({ bills, categories, status = 'All', onStatusChange, onOpenBill, compact = false }) {
  const [category, setCategory] = useState('All')
  const rows = bills.filter((b) => (compact ? b.stage === 'Pending Verification' : stageMatches(b.stage, status) && (category === 'All' || b.category === category)))

  const columns = [
    { key: 'billNo', header: 'Bill no. & date', render: (r) => <><div className="cell-main">{r.billNo}</div><div className="cell-sub">{formatDate(r.date)} · {r.id}</div></> },
    { key: 'vendor', header: 'Supplier & project', render: (r) => <><div className="cell-main">{r.vendor}</div><div className="cell-sub">{r.category} · {r.projectName}</div></> },
    { key: 'amount', header: 'Amount', align: 'num', render: (r) => <><div>{formatINR(r.amount)}</div>{r.s.recommendedAmount != null && (r.s.recommendedAmount !== r.amount || r.s.advanceAdjust) ? <div className="cell-sub down">net {formatINR(r.s.recommendedAmount - (r.s.advanceAdjust || 0))}</div> : r.rec.report.advanceBalance > 0 && !r.s.historic ? <div className="cell-sub">advance {formatINR(r.rec.report.advanceBalance)}</div> : null}</> },
    { key: 'records', header: 'Records', render: (r) => <RecordChips records={r.rec.records} mandatory={r.mandatory} onOpen={(k) => onOpenBill(r.id, k)} /> },
    { key: 'ai', header: 'AI check', render: (r) => <AiCell r={r} /> },
    { key: 'stage', header: 'Status', render: (r) => <><Badge>{r.stage}</Badge>{r.held.length > 0 && !r.s.historic && r.s.aiRunAt && <div className="cell-sub down">Held</div>}</> },
    {
      key: 'actions', header: 'Action',
      render: (r) => (
        <div className="cell-actions">
          {!r.s.historic && !r.s.aiRunAt
            ? <button className="btn btn-sm btn-primary" onClick={() => onOpenBill(r.id, 'compare')}>Compare with PO</button>
            : !r.s.historic && <button className="btn btn-sm" onClick={() => onOpenBill(r.id, 'compare')}>View AI report</button>}
          <button className="btn btn-sm" onClick={() => onOpenBill(r.id, r.s.historic ? 'bill' : 'review')}>{r.s.historic ? 'View' : 'Review'}</button>
        </div>
      ),
    },
  ]

  if (compact) {
    return (
      <Card title="Bills Awaiting Verification" sub="Supplier and site bills submitted for checking" bodyClass="" className="mb">
        <DataTable dense rows={rows} columns={columns} limit={5} emptyText="No bills waiting for verification." />
      </Card>
    )
  }

  const pending = bills.filter((b) => ['Pending Verification', 'Query Raised'].includes(b.stage) || b.stage.startsWith('Returned'))
  const awaiting = bills.filter((b) => b.stage.startsWith('Awaiting'))
  const toPay = bills.filter((b) => ['Approved', 'Partially Paid'].includes(b.stage))
  const held = bills.filter((b) => b.held.length > 0 && !b.s.historic && b.s.aiRunAt && b.stage !== 'Paid')
  return (
    <>
      <StatGrid
        items={[
          { label: 'Bills in range', value: formatCompactINR(sumOf(bills)), sub: `${bills.length} bills` },
          { label: 'To verify', value: formatCompactINR(sumOf(pending)), sub: `${pending.length} bills (incl. queries & returns)`, tone: pending.length ? 'warning' : undefined },
          { label: 'Awaiting approval', value: formatCompactINR(sumOf(awaiting)), sub: `${awaiting.length} bills` },
          { label: 'Approved, to pay', value: formatCompactINR(toPay.reduce((s, b) => s + ((b.s.approvedAmount ?? b.amount) - b.s.paidAmount), 0)), sub: `${toPay.length} bills`, tone: toPay.length ? 'success' : undefined },
          { label: 'Held for review', value: held.length, sub: 'Missing records or unreviewed differences', tone: held.length ? 'danger' : undefined },
        ]}
      />
      <div className="info-note">
        <Icon name="check" size={14} />
        <span>
          Each bill goes through three separate steps: <b>verification</b> (Accounts checks the bill against the purchase order and site record,
          helped by a simulated AI comparison), <b>approval</b> (authorised approver) and <b>payment</b> (payment team, only after approval).{' '}
          <Link className="link-btn" to="/approvals/bills">Bill approvals ›</Link>
        </span>
      </div>
      <Card title="Expenses & Bills" sub="Supplier, site and office bills in the selected range" bodyClass="" className="mb">
        <SectionToolbar statuses={EXPENSE_STATUSES} status={status} onStatusChange={onStatusChange}>
          <label className="field inline">
            Category
            <select value={category} onChange={(e) => setCategory(e.target.value)}>
              <option value="All">All categories</option>
              {categories.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </label>
        </SectionToolbar>
        <DataTable dense rows={rows} columns={columns} emptyText="No bills match these filters." />
      </Card>
    </>
  )
}
