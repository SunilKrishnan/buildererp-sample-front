import { useState } from 'react'
import Icon from '../../components/Icon.jsx'
import { Badge, Card, Chips } from '../../components/UI.jsx'
import { approvalCheck, can, PERMISSIONS } from '../../auth/demoRoles.js'
import { formatCompactINR, relativeDay } from '../../utils/format.js'
import { LockedNote } from './shared.jsx'

const STATUS_FILTERS = ['Pending', 'Approved', 'Rejected', 'All']

function ApprovalRow({ item, user, canVerify, onDecide, onVerify, busy }) {
  const check = approvalCheck(user, item)
  return (
    <li className="approval">
      <div className="approval-main">
        <div className="approval-top">
          <span className="approval-type">{item.type}</span>
          {item.priority === 'High' && <Badge>High</Badge>}
          {item.verified && item.status === 'Pending' && <Badge tone="info">Verified by accounts</Badge>}
        </div>
        <div className="t">{item.title}</div>
        <div className="s">
          {item.id} · {item.projectName} · {item.requestedBy} · {relativeDay(item.date)} · Approver: {item.approverRole}
        </div>
      </div>
      <div className="approval-side">
        {item.amount != null && <div className="approval-amount">{formatCompactINR(item.amount)}</div>}
        {item.status !== 'Pending' ? (
          <div className="approval-actions">
            <Badge>{item.status}</Badge>
            <button className="btn btn-sm" onClick={() => onDecide(item, 'Pending')}>Undo</button>
          </div>
        ) : check.allowed ? (
          <div className="approval-actions">
            <button className="btn btn-sm btn-primary" disabled={busy} onClick={() => onDecide(item, 'Approved')}>Approve</button>
            <button className="btn btn-sm" disabled={busy} onClick={() => onDecide(item, 'Rejected')}>Reject</button>
          </div>
        ) : (
          <div className="approval-actions">
            <LockedNote>{check.reason}</LockedNote>
            {canVerify && !item.verified && (
              <button className="btn btn-sm" disabled={busy} onClick={() => onVerify(item, true)} title="Check supporting records and forward to the approver">
                Verify & forward
              </button>
            )}
            {item.verified && <button className="btn btn-sm" onClick={() => onVerify(item, false)}>Undo</button>}
          </div>
        )}
      </div>
    </li>
  )
}

/** Section F: financial requests awaiting an authorised decision. */
export default function FinanceApprovals({ approvals, types, user, onDecide, onVerify, compact = false, onOpenAll }) {
  const [type, setType] = useState('All')
  const [status, setStatus] = useState('Pending')
  const [busyId, setBusyId] = useState(null)
  const canVerify = can(user.roleId, PERMISSIONS.EXPENSE_VERIFY)

  const pending = approvals.filter((a) => a.status === 'Pending')
  const actionable = pending.filter((a) => approvalCheck(user, a).allowed)
  const countByType = Object.fromEntries(types.map((t) => [t, pending.filter((a) => a.type === t).length]))
  const list = compact
    ? pending.slice(0, 5)
    : approvals.filter((a) => (type === 'All' || a.type === type) && (status === 'All' || a.status === status))

  const run = async (item, fn) => {
    setBusyId(item.id)
    try { await fn() } finally { setBusyId(null) }
  }

  return (
    <Card
      className="approval-centre mb"
      title={
        <span className="title-with-count">
          Pending Financial Approvals <span className="count-pill">{pending.length} pending</span>
        </span>
      }
      sub={`${actionable.length} within your demo permissions. Decisions change status on this screen only. Nothing is approved, paid or saved.`}
      action={compact && onOpenAll ? <button className="btn" onClick={() => onOpenAll()}>Open approvals</button> : null}
    >
      <div className="approval-types">
        {types.map((t) => (
          <button
            key={t}
            className={`approval-type-tile ${!compact && type === t ? 'active' : ''}`}
            onClick={() => (compact ? onOpenAll?.() : setType(type === t ? 'All' : t))}
          >
            <span>{t}</span>
            <b>{countByType[t]}</b>
          </button>
        ))}
      </div>

      {!compact && (
        <div className="approval-filter">
          <Chips options={STATUS_FILTERS} value={status} onChange={setStatus} />
          {type !== 'All' && (
            <button className="btn btn-sm" onClick={() => setType('All')}><Icon name="x" size={14} />{type}</button>
          )}
        </div>
      )}

      {list.length ? (
        <ul className="list approvals">
          {list.map((a) => (
            <ApprovalRow
              key={a.id}
              item={a}
              user={user}
              canVerify={canVerify}
              busy={busyId === a.id}
              onDecide={(item, d) => run(item, () => onDecide(item, d))}
              onVerify={(item, v) => run(item, () => onVerify(item, v))}
            />
          ))}
        </ul>
      ) : (
        <div className="empty sm">
          {status === 'Pending' || compact ? 'All caught up. No financial requests waiting.' : 'No requests match these filters.'}
        </div>
      )}
    </Card>
  )
}
