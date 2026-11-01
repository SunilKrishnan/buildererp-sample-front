import SummaryCard from '../../components/SummaryCard.jsx'
import { formatCompactINR, formatNumber } from '../../utils/format.js'

export default function SummaryCards({ summary, pendingApprovals, onOpen }) {
  const s = summary
  const u = s.units
  return (
    <div className="summary-grid">
      <SummaryCard label="Total Projects" value={s.totalProjects} icon="building" sub="All statuses" onClick={() => onOpen('projects')} />
      <SummaryCard label="Active Projects" value={s.activeProjects} icon="trend" sub="Under construction" onClick={() => onOpen('projects', { status: 'Active' })} />
      <SummaryCard label="Completed Projects" value={s.completedProjects} icon="check" sub="Handed over" onClick={() => onOpen('projects', { status: 'Completed' })} />
      <SummaryCard
        label="Delayed Projects" value={s.delayedProjects} icon="alert" tone={s.delayedProjects ? 'danger' : undefined}
        sub="Delayed or at risk" onClick={() => onOpen('projects', { status: 'Delayed' })}
      />
      <SummaryCard label="Total Labourers" value={formatNumber(s.totalLabour)} icon="users" sub="Registered on active sites" onClick={() => onOpen('labour')} />
      <SummaryCard
        label="Present Today" value={formatNumber(s.presentToday)} icon="hardhat"
        sub={s.totalLabour ? `${Math.round((s.presentToday / s.totalLabour) * 100)}% attendance` : 'No labour registered'}
        onClick={() => onOpen('labour')}
      />
      <SummaryCard label="Project Expenses" value={formatCompactINR(s.totalExpense)} icon="rupee" sub="In selected date range" onClick={() => onOpen('finance')} />
      <SummaryCard
        label="Pending Approvals" value={pendingApprovals} icon="check" tone={pendingApprovals ? 'warning' : undefined}
        sub="Awaiting your decision" onClick={() => onOpen('approvals')}
      />
      <SummaryCard label="Units" value={formatNumber(u.total)} icon="building" onClick={() => onOpen('sales')}>
        <div className="unit-split">
          <span><b>{u.available}</b> available</span>
          <span><b>{u.booked}</b> booked</span>
          <span><b>{u.sold}</b> sold</span>
        </div>
      </SummaryCard>
      <SummaryCard
        label="Outstanding Collections" value={formatCompactINR(s.outstandingCollections)} icon="wallet"
        tone={s.outstandingCollections ? 'warning' : undefined} sub="Due + overdue from customers" onClick={() => onOpen('sales')}
      />
    </div>
  )
}
