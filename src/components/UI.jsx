import Icon from './Icon.jsx'

const toneByStatus = {
  'On Track': 'success', Completed: 'muted', Delayed: 'warning', 'At Risk': 'danger',
  Good: 'success', Warning: 'warning', Incident: 'danger',
  Pending: 'warning', Approved: 'info', Delivered: 'success', 'In Transit': 'info', Rejected: 'danger',
  Paid: 'success', Unpaid: 'warning', Overdue: 'danger',
  'New Lead': 'info', Contacted: 'muted', 'Site Visit': 'warning', Negotiation: 'warning', Booked: 'success', Lost: 'danger',
  'In Stock': 'success', Low: 'warning', 'Low Stock': 'warning', 'Out of Stock': 'danger',
  Active: 'success', Blocked: 'danger', 'Sent to Supplier': 'info', 'Partially Delivered': 'warning', 'Quotations Requested': 'info', 'Supplier Selected': 'info',
  'Returned to Store Keeper': 'warning', 'Rejected by Purchase Manager': 'danger', 'Not Sent': 'warning', 'Ready to compare': 'warning',
  // Site Engineer records
  Submitted: 'info', Reviewed: 'success', Returned: 'warning', 'Not Started': 'muted', Passed: 'success', Failed: 'danger', 'Awaiting QA review': 'warning', 'QA accepted': 'success', 'QA rejected': 'danger', 'Verified closed': 'success', 'Action done': 'info', 'Action in progress': 'warning', 'Measurement due': 'warning', 'Fully measured': 'success', Acknowledged: 'success', Answered: 'success', Instruction: 'info', Clarification: 'muted', Requested: 'info', Breakdown: 'danger', Working: 'success', Idle: 'muted', Medium: 'warning', 'Awaiting reinspection': 'warning', Complete: 'success', 'Not started': 'muted', Recorded: 'muted', Stopped: 'danger',
  'Pending Inspection': 'warning', Accepted: 'success', 'Pending Review': 'warning', 'Awaiting Approval': 'warning', 'Partially Issued': 'info',
  Cancelled: 'muted', Resolved: 'success', Reported: 'info', 'Sent to Purchase Manager': 'info', 'With Purchase Manager': 'info',
  Present: 'success', Absent: 'danger',
  'Pending Approval': 'warning', Issued: 'info', 'Partially Received': 'warning', Received: 'success',
  'Awaiting Verification': 'warning', Verified: 'success', Disputed: 'danger', Due: 'warning',
  Scheduled: 'info', Open: 'danger', 'In Progress': 'warning', Done: 'success',
  'Under investigation': 'danger', Closed: 'muted',
  High: 'danger', Normal: 'muted', Minor: 'muted', Major: 'warning', Critical: 'danger',
  New: 'info', 'Follow-up': 'warning', 'Site Visit Scheduled': 'info',
  'Pending Verification': 'warning', 'Query Raised': 'danger', 'Partially Paid': 'info', 'On Hold': 'muted',
  Reconciled: 'success', Unreconciled: 'warning', 'ERP only': 'info', 'Bank only': 'warning', 'Amount differs': 'danger',
  'Under review': 'warning', 'Entry drafted': 'info', Posted: 'success', Draft: 'muted', Filed: 'success', Prepared: 'info',
  Upcoming: 'muted', 'Awaiting payment': 'warning', Matched: 'success', 'Part paid': 'info', 'Pending verification': 'warning', 'In clearing': 'info', Clearing: 'info',
  'Not found in bank': 'warning', Reversed: 'muted', 'Cheque returned': 'danger', 'Reversal': 'muted', 'Verified (before books start)': 'success', 'Qty mismatch': 'danger', 'Rate mismatch': 'danger', Invoice: 'muted', Payment: 'success',
  'Awaiting PM Review': 'warning', 'Awaiting Admin Review': 'warning',
  // Material request workflow (services/inventory.js MR)
  'Pending Project Manager Review': 'warning', 'Pending Store Check': 'warning', 'Ready to Issue': 'info', 'Shortage Identified': 'danger', 'Purchasing in Progress': 'info',
  'Needs Reinspection': 'danger', Pass: 'success', Fail: 'danger', Superseded: 'muted', 'Under Review': 'warning', 'Quotations Received': 'info', 'PO Raised': 'success', 'Rejected by Admin': 'danger',
  'Awaiting Payment Approval': 'warning', 'Approved for Payment': 'info', 'Returned to Supplier': 'danger', 'Awaiting inspection': 'warning', 'PO not approved': 'danger', Urgent: 'danger',
  'Near miss': 'warning', 'First aid': 'warning', 'Lost-time injury': 'danger', 'Property damage': 'warning',
}

export function Badge({ children, tone }) {
  const t = tone || toneByStatus[children] || 'muted'
  return <span className={`badge b-${t}`}>{children}</span>
}

export function Progress({ value, tone }) {
  return (
    <div className={`progress ${tone || ''}`}>
      <span style={{ width: `${Math.min(100, value)}%` }} />
    </div>
  )
}

export function Card({ title, sub, action, children, bodyClass = 'card-body', className = '' }) {
  return (
    <section className={`card ${className}`}>
      {title && (
        <div className="card-head">
          <div>
            <h3>{title}</h3>
            {sub && <div className="sub">{sub}</div>}
          </div>
          {action}
        </div>
      )}
      <div className={bodyClass}>{children}</div>
    </section>
  )
}

export function Kpi({ label, value, icon, delta, foot }) {
  const up = delta >= 0
  return (
    <div className="card kpi">
      <div className="kpi-top">
        {label}
        <div className="kpi-icon"><Icon name={icon} /></div>
      </div>
      <div className="kpi-value">{value}</div>
      <div className="kpi-foot">
        {delta !== undefined && <span className={up ? 'up' : 'down'}>{up ? '▲' : '▼'} {Math.abs(delta)}%</span>} {foot}
      </div>
    </div>
  )
}

export function PageHead({ title, sub, children }) {
  return (
    <div className="page-head">
      <div>
        <h1>{title}</h1>
        {sub && <p>{sub}</p>}
      </div>
      {children && <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>{children}</div>}
    </div>
  )
}

export function Chips({ options, value, onChange }) {
  return (
    <div className="chips">
      {options.map((o) => (
        <button key={o} className={`chip ${value === o ? 'active' : ''}`} onClick={() => onChange(o)}>
          {o}
        </button>
      ))}
    </div>
  )
}

export function progressTone(p) {
  if (p >= 100) return 'ok'
  if (p >= 90) return 'bad'
  if (p >= 75) return 'warn'
  return ''
}
