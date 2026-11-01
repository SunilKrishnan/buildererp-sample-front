import { useState } from 'react'
import DataTable from '../../components/DataTable.jsx'
import StatGrid from '../../components/StatGrid.jsx'
import { Badge, Card, Chips } from '../../components/UI.jsx'
import { formatDate, formatINR } from '../../utils/format.js'
import { LockedNote, UndoButton } from './shared.jsx'

const sum = (rows, f) => rows.reduce((s, r) => s + f(r), 0)

/** Match ERP bank transactions with the bank statement. */
export default function BankReconciliation({ accounts, items, lastStatementDate, canReconcile, onAct, onUndo, onCreateJournal, notify }) {
  const banks = accounts.filter((a) => a.kind === 'Bank')
  const [accountId, setAccountId] = useState(banks.find((a) => a.toReconcile)?.id || banks[0]?.id)
  const acc = banks.find((a) => a.id === accountId) || banks[0]
  const rows = items.filter((t) => t.account === acc?.id)
  const open = (s) => rows.filter((t) => t.status === s)

  // Reconciliation statement: from the bank's balance to the balance in our books
  const uncleared = sum(open('ERP only'), (t) => t.amount)
  const bankOnly = sum(rows.filter((t) => t.recon === 'Bank only'), (t) => t.statementAmount)
  const differences = sum(rows.filter((t) => t.recon === 'Amount differs'), (t) => t.amount - t.statementAmount)

  const action = (r) => {
    if (r.kind === 'unidentifiedCredit') {
      if (r.status === 'Reconciled') return <span className="cell-sub">Matched to a customer receipt</span>
      if (r.status === 'Cheque returned') return <span className="cell-sub">Cheque returned</span>
      if (r.status === 'Clearing') return <span className="cell-sub">Cheque in clearing</span>
      return <span className="cell-sub">Identify payer: record it in the customer's account</span>
    }
    if (r.changed) return <UndoButton onClick={() => onUndo('recon', r)} />
    if (!canReconcile) return <LockedNote>View only</LockedNote>
    switch (r.status) {
      case 'Unreconciled':
        return <button className="btn btn-sm btn-primary" onClick={() => onAct('recon', r, 'Reconciled', `Demo: ${r.ref} matched to the statement on screen only.`)}>Match</button>
      case 'Bank only':
        return (
          <button
            className="btn btn-sm"
            onClick={() => {
              onCreateJournal({
                date: r.date,
                narration: `${r.desc} (from bank statement)`,
                lines: r.amount < 0 || r.statementAmount < 0
                  ? [{ account: '4102', dr: Math.abs(r.statementAmount) }, { account: acc.ledger, cr: Math.abs(r.statementAmount) }]
                  : [{ account: acc.ledger, dr: r.statementAmount }, { account: '5101', cr: r.statementAmount }],
              })
              onAct('recon', r, 'Entry drafted', `Demo: draft journal for "${r.desc}" added to Journal Entries on screen only. Submit it for approval there.`)
            }}
          >
            Create journal
          </button>
        )
      case 'Amount differs':
        return <button className="btn btn-sm" onClick={() => onAct('recon', r, 'Under review', `Demo: ${r.ref} marked for review on screen only.`)}>Investigate</button>
      case 'ERP only':
        return <span className="cell-sub">Awaiting bank clearance</span>
      default:
        return <span className="cell-sub">-</span>
    }
  }

  return (
    <>
      <div className="toolbar plain">
        <Chips options={banks.map((a) => a.short)} value={acc?.short} onChange={(v) => setAccountId(banks.find((a) => a.short === v)?.id)} />
        <button className="btn btn-sm" onClick={() => notify?.('Demo: statement import will arrive with the backend. The demo uses a sample statement.')}>
          Import statement
        </button>
      </div>

      {acc && (
        <>
          <StatGrid
            items={[
              { label: 'Balance per bank statement', value: formatINR(acc.statementBalance), sub: `Statement up to ${formatDate(lastStatementDate)}` },
              { label: 'Balance per books (ERP)', value: formatINR(acc.balance) },
              { label: 'Difference', value: formatINR(acc.balance - acc.statementBalance), tone: Math.round(acc.balance - acc.statementBalance) ? 'warning' : 'success' },
              { label: 'Items to reconcile', value: acc.toReconcile, tone: acc.toReconcile ? 'warning' : 'success' },
            ]}
          />

          <div className="recon-layout">
            <Card title="Items to Reconcile" sub={`${acc.name} · ${acc.number}`} bodyClass="">
              <DataTable
                dense
                rows={rows}
                emptyText="Everything on this account is reconciled."
                columns={[
                  { key: 'date', header: 'Date', render: (r) => formatDate(r.date) },
                  { key: 'desc', header: 'Details', render: (r) => <><div className="cell-main">{r.party}</div><div className="cell-sub">{r.desc} · {r.ref}</div></> },
                  {
                    key: 'erp', header: 'In ERP', align: 'num',
                    render: (r) => (r.inBooks ? formatINR(r.amount) : r.status === 'Reconciled' ? <span className="cell-sub">Recorded as receipt</span> : <span className="cell-sub">Not recorded</span>),
                  },
                  { key: 'bank', header: 'On statement', align: 'num', render: (r) => (r.recon === 'ERP only' ? <span className="cell-sub">Not yet</span> : formatINR(r.statementAmount)) },
                  { key: 'status', header: 'Status', render: (r) => <Badge>{r.status}</Badge> },
                  { key: 'actions', header: 'Action', render: action },
                ]}
              />
            </Card>
            <Card title="Reconciliation Statement" sub="Explains the difference between bank and books">
              <dl className="recon-statement">
                <dt>Balance per bank statement</dt><dd>{formatINR(acc.statementBalance)}</dd>
                <dt>Payments issued, not yet cleared</dt><dd>{formatINR(uncleared)}</dd>
                <dt>Bank entries not yet in ERP</dt><dd>{formatINR(-bankOnly)}</dd>
                <dt>Amount differences under review</dt><dd>{formatINR(differences)}</dd>
                <dt className="total">Balance per books</dt><dd className="total">{formatINR(acc.statementBalance + uncleared - bankOnly + differences)}</dd>
              </dl>
              <p className="cell-sub" style={{ marginTop: 12 }}>
                Matching an item only changes its status on screen in this prototype. Real reconciliation will be saved by the backend.
              </p>
            </Card>
          </div>
        </>
      )}
    </>
  )
}
