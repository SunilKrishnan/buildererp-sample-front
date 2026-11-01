import SummaryCard from '../../components/SummaryCard.jsx'
import { formatCompactINR } from '../../utils/format.js'

export default function FinancialSummary({ summary, pendingApprovals, onOpen }) {
  const s = summary
  const overdue = s.overdueReceivables + s.overduePayables
  const topPaid = [...s.paidByKind].sort((a, b) => b.value - a.value)[0]
  return (
    <div className="summary-grid">
      <SummaryCard
        label="Money Received" value={formatCompactINR(s.received)} icon="trend"
        sub={`${s.receiptCount} customer receipts in range`} onClick={() => onOpen('receipts')}
      />
      <SummaryCard
        label="Money Paid" value={formatCompactINR(s.paid)} icon="wallet"
        sub={topPaid?.value ? `Largest: ${topPaid.label} (${formatCompactINR(topPaid.value)})` : 'No payments in range'}
        onClick={() => onOpen('reports')}
      />
      <SummaryCard
        label="Project Expenses" value={formatCompactINR(s.expenses)} icon="rupee"
        sub="Booked in selected range" onClick={() => onOpen('expenses')}
      />
      <SummaryCard
        label="Customer Receivables" value={formatCompactINR(s.receivables)} icon="handshake"
        tone={s.receivables ? 'warning' : undefined} sub={`${s.receivableCount} instalments due or overdue`}
        onClick={() => onOpen('receipts', { status: 'Outstanding' })}
      />
      <SummaryCard
        label="Supplier Payments Pending" value={formatCompactINR(s.supplierPending)} icon="cart"
        tone={s.supplierPending ? 'warning' : undefined} sub={`${s.supplierPendingCount} open invoices`}
        onClick={() => onOpen('suppliers')}
      />
      <SummaryCard
        label="Overdue Amounts" value={formatCompactINR(overdue)} icon="alert" tone={overdue ? 'danger' : undefined}
        sub={`Receivable ${formatCompactINR(s.overdueReceivables)} · Payable ${formatCompactINR(s.overduePayables)}`}
        onClick={() => onOpen('suppliers', { status: 'Overdue' })}
      />
      <SummaryCard
        label="Salaries, Wages & Contractor Dues" value={formatCompactINR(s.payrollDue)} icon="hardhat"
        sub="Unpaid salary runs, wage batches and RA bills" onClick={() => onOpen('salaries')}
      />
      <SummaryCard
        label="Bank & Cash Balance" value={formatCompactINR(s.bankBalance)} icon="bank"
        sub="All accounts, per books (company-wide)" onClick={() => onOpen('bank')}
      />
      <SummaryCard
        label="Pending Approvals" value={pendingApprovals} icon="check" tone={pendingApprovals ? 'warning' : undefined}
        sub="Financial requests awaiting a decision" onClick={() => onOpen('approvals')}
      />
    </div>
  )
}
