import { useState } from 'react'
import DataTable from '../../components/DataTable.jsx'
import StatGrid from '../../components/StatGrid.jsx'
import Icon from '../../components/Icon.jsx'
import { Badge, Card } from '../../components/UI.jsx'
import { formatCompactINR, formatDate, formatINR } from '../../utils/format.js'
import { LockedNote, UndoButton } from './shared.jsx'

/** Staff salaries and incentives. Labour wages and contractor bills live on their own pages. */
function PaymentCell({ r, canPay, onRecordPayment }) {
  const [ref, setRef] = useState('')
  const [open, setOpen] = useState(false)
  if (r.status === 'Paid') return <span className="cell-sub">-</span>
  if (!canPay) return <LockedNote>Payment team only</LockedNote>
  if (!open) return <button className="btn btn-sm btn-primary" onClick={() => setOpen(true)}>Record payment</button>
  return (
    <form className="cell-actions" onSubmit={(e) => { e.preventDefault(); if (ref.trim()) onRecordPayment(r, ref.trim()) }}>
      <input className="inline-input" value={ref} onChange={(e) => setRef(e.target.value)} placeholder="Bank batch / UTR ref" autoFocus aria-label="Payment reference" />
      <button className="btn btn-sm btn-primary" type="submit" disabled={!ref.trim()}>Save</button>
      <button className="btn btn-sm" type="button" onClick={() => setOpen(false)}>Cancel</button>
    </form>
  )
}

export default function EmployeePayroll({ runs, perms, onAct, onUndo, onOpen, onRecordPayment }) {
  const [runId, setRunId] = useState(runs.find((r) => r.status !== 'Paid')?.id || runs[0]?.id)
  const run = runs.find((r) => r.id === runId) || runs[0]

  const runAction = (r) => {
    if (r.changed) return <UndoButton onClick={() => onUndo('salary', r)} />
    if (r.status === 'Draft') {
      if (!perms.canPrepareSalary) return <LockedNote>View only</LockedNote>
      return (
        <button className="btn btn-sm btn-primary" onClick={() => onAct('salary', r, 'Pending Approval', `Demo: ${r.label} sent for approval on screen only. Nothing saved.`)}>
          Submit for approval
        </button>
      )
    }
    if (r.status === 'Pending Approval') {
      if (!perms.canApproveSalary) return <LockedNote>Awaiting Admin approval</LockedNote>
      return (
        <button className="btn btn-sm btn-primary" onClick={() => onAct('salary', r, 'Approved', `Demo: ${r.label} approved on screen only. No salaries paid.`)}>
          Approve
        </button>
      )
    }
    if (r.status === 'Approved') return <span className="cell-sub">Ready for bank upload</span>
    return <span className="cell-sub">Paid {r.paidOn ? formatDate(r.paidOn) : ''}</span>
  }

  const paidRuns = runs.filter((r) => r.status === 'Paid')
  const openRuns = runs.filter((r) => r.status !== 'Paid')
  return (
    <>
      <div className="info-note">
        <Icon name="briefcase" size={14} />
        <span>
          Salaries and incentives for staff on the company payroll. Daily wages for direct labour are on{' '}
          <button className="link-btn" onClick={() => onOpen('payroll')}>Labour Payroll</button>; payments to contractors for completed
          work are on <button className="link-btn" onClick={() => onOpen('contractors')}>Contractor Bills</button>. Salary structures and
          incentive rules come from HR (demo values here).
        </span>
      </div>

      <StatGrid
        items={[
          { label: 'Employees', value: run?.lines.length ?? 0, sub: 'On this run' },
          { label: 'Runs to process', value: openRuns.length, sub: formatCompactINR(openRuns.reduce((s, r) => s + r.net, 0)), tone: openRuns.length ? 'warning' : undefined },
          { label: 'Last salary paid', value: paidRuns[0] ? formatCompactINR(paidRuns[0].net) : '-', sub: paidRuns[0] ? `${paidRuns[0].label} · ${formatDate(paidRuns[0].paidOn)}` : undefined, tone: 'success' },
          { label: 'TDS on salaries (paid runs)', value: formatCompactINR(paidRuns.reduce((s, r) => s + r.tds, 0)), sub: 'Section 192' },
        ]}
      />

      <Card title="Salary Runs" sub="Accountant prepares and submits; Admin approves before payment" bodyClass="" className="mb">
        <DataTable
          dense
          rows={runs}
          emptyText="No salary runs."
          columns={[
            {
              key: 'label', header: 'Run',
              render: (r) => <><button className={`link-btn ${r.id === run?.id ? 'active' : ''}`} onClick={() => setRunId(r.id)}>{r.label}</button><div className="cell-sub">{r.type} · {r.id}</div></>,
            },
            { key: 'count', header: 'Employees', align: 'num', render: (r) => r.lines.length },
            { key: 'gross', header: 'Gross', align: 'num', render: (r) => formatINR(r.gross) },
            { key: 'deductions', header: 'Deductions', align: 'num', render: (r) => `− ${formatINR(r.tds + r.pfPt)}` },
            { key: 'net', header: 'Net pay', align: 'num', render: (r) => <b>{formatINR(r.net)}</b> },
            { key: 'status', header: 'Status', render: (r) => <Badge>{r.status}</Badge> },
            { key: 'actions', header: 'Action', render: runAction },
          ]}
        />
      </Card>

      <Card title="Approved by Admin" sub="Salary runs approved for payment: who approved them, when, and whether they have been paid" bodyClass="" className="mb">
        <DataTable
          dense
          rows={runs.filter((r) => r.status === 'Approved' || r.status === 'Paid')}
          emptyText="No salary runs have been approved yet."
          columns={[
            { key: 'label', header: 'Run', render: (r) => <><div className="cell-main">{r.label}</div><div className="cell-sub">{r.type} · {r.id}</div></> },
            { key: 'net', header: 'Net pay', align: 'num', render: (r) => <b>{formatINR(r.net)}</b> },
            { key: 'approvedBy', header: 'Approved by', render: (r) => <><div>{r.approvedBy || 'Admin'}</div><div className="cell-sub">prepared by {r.preparedBy}</div></> },
            { key: 'approvedOn', header: 'Approved on', render: (r) => (r.approvedOn ? formatDate(r.approvedOn) : '-') },
            { key: 'payment', header: 'Payment', render: (r) => <><Badge>{r.status === 'Paid' ? 'Paid' : 'Awaiting payment'}</Badge>{r.paidOn && <div className="cell-sub">{formatDate(r.paidOn)}{r.paymentRef ? ` · ${r.paymentRef}` : ''}</div>}</> },
            { key: 'action', header: 'Action', render: (r) => <PaymentCell r={r} canPay={perms.canRecordPayment} onRecordPayment={onRecordPayment} /> },
          ]}
        />
      </Card>

      {run && (
        <Card title={`${run.label}: employee lines`} sub={`${run.type}. Pay is prorated for loss-of-pay (LOP) days.`} bodyClass="" className="mb">
          <DataTable
            dense
            rowKey="employeeId"
            rows={run.lines}
            columns={[
              { key: 'name', header: 'Employee', render: (r) => <><div className="cell-main">{r.name}</div><div className="cell-sub">{r.designation} · {r.department}</div></> },
              { key: 'paidDays', header: 'Paid days', align: 'num', render: (r) => <>{r.paidDays}{r.lopDays ? <div className="cell-sub down">{r.lopDays} LOP</div> : null}</> },
              { key: 'basic', header: 'Basic', align: 'num', render: (r) => formatINR(r.basic) },
              { key: 'allow', header: 'HRA + allowances', align: 'num', render: (r) => formatINR(r.hra + r.special) },
              { key: 'incentive', header: 'Incentive', align: 'num', render: (r) => (r.incentive ? formatINR(r.incentive) : '-') },
              { key: 'gross', header: 'Gross', align: 'num', render: (r) => formatINR(r.gross) },
              { key: 'ded', header: 'PF · PT · TDS', align: 'num', render: (r) => <span className="cell-sub">{formatINR(r.pf)} · {formatINR(r.pt)} · {formatINR(r.tds)}</span> },
              { key: 'net', header: 'Net pay', align: 'num', render: (r) => <b>{formatINR(r.net)}</b> },
            ]}
          />
        </Card>
      )}
    </>
  )
}
