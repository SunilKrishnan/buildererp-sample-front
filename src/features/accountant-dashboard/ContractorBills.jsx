import { useState } from 'react'
import DataTable from '../../components/DataTable.jsx'
import StatGrid from '../../components/StatGrid.jsx'
import { Badge, Card, Progress } from '../../components/UI.jsx'
import { formatCompactINR, formatDate, formatINR } from '../../utils/format.js'
import { LockedNote, SectionToolbar, UndoButton } from './shared.jsx'

export const CONTRACTOR_STATUSES = ['All', 'Pending Verification', 'Pending Approval', 'Approved', 'Paid']
const sumOf = (rows, k) => rows.reduce((s, r) => s + (r[k] || 0), 0)

/** Contractor bills for completed work: RA bills, advances, retention and TDS. */
export default function ContractorBills({ accounts, bills, status = 'All', onStatusChange, perms, onAct, onUndo }) {
  const [selected, setSelected] = useState(accounts[0]?.woNo || '')
  const acc = accounts.find((a) => a.woNo === selected) || accounts[0]
  const rows = bills.filter((b) => status === 'All' || b.status === status)

  const action = (r) => {
    if (r.changed) return <UndoButton onClick={() => onUndo('contractor', r)} />
    if (r.status === 'Pending Verification') {
      if (!perms.canVerifyBills) return <LockedNote>View only</LockedNote>
      return (
        <button className="btn btn-sm" onClick={() => onAct('contractor', r, 'Pending Approval', `Demo: ${r.contractor} ${r.billNo} measurements verified on screen only and sent for Admin approval.`)}>
          Verify measurements
        </button>
      )
    }
    if (r.status === 'Pending Approval') {
      if (!perms.canApprovePayroll) return <LockedNote>Awaiting Admin approval</LockedNote>
      return (
        <button className="btn btn-sm btn-primary" onClick={() => onAct('contractor', r, 'Approved', `Demo: ${r.contractor} ${r.billNo} approved on screen only. No payment made.`)}>
          Approve
        </button>
      )
    }
    return <span className="cell-sub">{r.status === 'Paid' && r.paidOn ? `Paid ${formatDate(r.paidOn)}` : 'Ready for payment release'}</span>
  }

  return (
    <>
      <StatGrid
        items={[
          { label: 'Work order value', value: formatCompactINR(sumOf(accounts, 'value')), sub: `${accounts.length} contractors` },
          { label: 'Billed to date', value: formatCompactINR(sumOf(accounts, 'billedGross')), sub: 'Gross RA bills' },
          { label: 'Outstanding (net)', value: formatCompactINR(sumOf(accounts, 'outstanding')), tone: sumOf(accounts, 'outstanding') ? 'warning' : undefined },
          { label: 'Advances to recover', value: formatCompactINR(sumOf(accounts, 'advanceBalance')) },
          { label: 'Retention held', value: formatCompactINR(sumOf(accounts, 'retentionHeld')), sub: 'Released after defect period' },
          { label: 'TDS deducted', value: formatCompactINR(sumOf(accounts, 'tdsDeducted')), sub: 'Section 194C (demo rate)' },
        ]}
      />

      <Card title="Contractor Accounts" sub="Per work order: billing progress, advances, retention and balance" bodyClass="" className="mb">
        <DataTable
          dense
          rowKey="woNo"
          rows={accounts}
          emptyText="No contractor work orders."
          columns={[
            {
              key: 'contractor', header: 'Contractor & work order',
              render: (r) => (
                <>
                  <button className={`link-btn ${r.woNo === acc?.woNo ? 'active' : ''}`} onClick={() => setSelected(r.woNo)}>{r.contractor}</button>
                  <div className="cell-sub">{r.woNo} · {r.scope}</div>
                </>
              ),
            },
            { key: 'value', header: 'WO value', align: 'num', render: (r) => formatINR(r.value) },
            {
              key: 'billed', header: 'Billed',
              render: (r) => <div className="attendance-cell"><Progress value={r.billedPct} /><span className="cell-sub">{formatINR(r.billedGross)} · {r.billedPct}%</span></div>,
            },
            {
              key: 'advance', header: 'Advance', align: 'num',
              render: (r) => (r.advance ? <><div>{formatINR(r.advance)}</div><div className="cell-sub">recovered {formatINR(r.advanceRecovered)}</div></> : '-'),
            },
            { key: 'retentionHeld', header: 'Retention', align: 'num', render: (r) => formatINR(r.retentionHeld) },
            { key: 'paid', header: 'Paid', align: 'num', render: (r) => formatINR(r.paid) },
            { key: 'outstanding', header: 'Outstanding', align: 'num', render: (r) => <b>{formatINR(r.outstanding)}</b> },
          ]}
        />
        {acc && (
          <div className="sub-panel">
            <div className="sub-panel-head"><b>{acc.contractor}</b> · {acc.woNo} history</div>
            <DataTable
              dense
              rows={acc.history}
              emptyText="No transactions."
              columns={[
                { key: 'date', header: 'Date', render: (r) => formatDate(r.date) },
                { key: 'type', header: 'Entry', render: (r) => <span className="cell-main">{r.type}</span> },
                { key: 'ref', header: 'Details', render: (r) => <span className="cell-sub">{r.ref}</span> },
                { key: 'amount', header: 'Amount', align: 'num', render: (r) => formatINR(r.amount) },
              ]}
            />
          </div>
        )}
      </Card>

      <Card title="RA Bills" sub="Running-account bills for measured work, certified by site engineers. Net = gross − retention − TDS − advance recovery." bodyClass="" className="mb">
        <SectionToolbar statuses={CONTRACTOR_STATUSES} status={status} onStatusChange={onStatusChange} />
        <DataTable
          dense
          rows={rows}
          emptyText="No contractor bills match these filters."
          columns={[
            { key: 'contractor', header: 'Contractor & bill', render: (r) => <><div className="cell-main">{r.contractor}</div><div className="cell-sub">{r.billNo} · {r.woNo} · {r.work}</div></> },
            { key: 'certifiedBy', header: 'Certified by', render: (r) => <><div>{r.certifiedBy}</div><div className="cell-sub">{formatDate(r.date)}</div></> },
            { key: 'gross', header: 'Gross', align: 'num', render: (r) => formatINR(r.gross) },
            {
              key: 'deductions', header: 'Deductions', align: 'num',
              render: (r) => (
                <>
                  <div>− {formatINR(r.retention + r.tds + r.advanceRecovery)}</div>
                  <div className="cell-sub">Ret {formatINR(r.retention)} · TDS {formatINR(r.tds)}{r.advanceRecovery ? ` · Adv ${formatINR(r.advanceRecovery)}` : ''}</div>
                </>
              ),
            },
            { key: 'net', header: 'Net payable', align: 'num', render: (r) => <b>{formatINR(r.net)}</b> },
            { key: 'status', header: 'Status', render: (r) => <><Badge>{r.status}</Badge>{r.paymentRef && <div className="cell-sub">{r.paymentRef}</div>}</> },
            { key: 'actions', header: 'Action', render: action },
          ]}
        />
      </Card>
    </>
  )
}
