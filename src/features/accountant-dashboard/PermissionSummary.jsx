import { Card } from '../../components/UI.jsx'
import { can, PERMISSIONS as P } from '../../auth/demoRoles.js'
import { formatCompactINR } from '../../utils/format.js'

const CAPABILITIES = [
  { perm: P.EXPENSE_VERIFY, label: 'Verify bills, invoices and contractor measurements' },
  { perm: P.SUPPLIER_SCHEDULE, label: 'Schedule verified supplier invoices for payment' },
  { perm: P.PAYROLL_VERIFY, label: 'Verify payroll against verified attendance' },
  { perm: P.PAYROLL_APPROVE, label: 'Approve wages, contractor bills and payment release' },
  { perm: P.SALARY_PREPARE, label: 'Prepare and submit employee salary runs' },
  { perm: P.SALARY_APPROVE, label: 'Approve employee salary runs' },
  { perm: P.BANK_RECONCILE, label: 'Reconcile bank transactions with statements' },
  { perm: P.JOURNAL_CREATE, label: 'Draft and submit journal entries' },
  { perm: P.JOURNAL_POST, label: 'Approve and post journal entries to the ledger' },
  { perm: P.TAX_PREPARE, label: 'Prepare tax returns and challans' },
  { perm: P.ATTENDANCE_EDIT, label: 'Edit or correct attendance' },
]

/** Shows what the previewed role can do, so locked actions are explainable. */
export default function PermissionSummary({ role }) {
  const limits = Object.entries(role.approvalLimits)
  return (
    <Card title={`Demo permissions: ${role.label}`} sub="UI preview only. Real permissions must be enforced by the server." className="mb">
      <div className="grid halves perm-grid">
        <ul className="perm-list">
          {CAPABILITIES.map((c) => {
            const ok = can(role.id, c.perm)
            return (
              <li key={c.perm} className={ok ? 'ok' : 'no'}>
                <span aria-hidden="true">{ok ? '✓' : '✕'}</span>
                <span className="sr-only">{ok ? 'Allowed: ' : 'Not allowed: '}</span>
                {c.label}
              </li>
            )
          })}
        </ul>
        <div>
          <div className="cell-sub" style={{ marginBottom: 6 }}>Approval limits</div>
          <ul className="perm-list">
            {limits.map(([type, limit]) => (
              <li key={type} className="ok">
                <span aria-hidden="true">₹</span>
                {type === '*' ? 'All request types' : type}: {limit === Infinity ? 'no limit' : `up to ${formatCompactINR(limit)}`}
              </li>
            ))}
            <li className="no"><span aria-hidden="true">✕</span>Cannot approve requests you raised yourself</li>
          </ul>
        </div>
      </div>
    </Card>
  )
}
