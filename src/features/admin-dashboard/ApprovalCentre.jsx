import { useState } from 'react'
import Icon from '../../components/Icon.jsx'
import { Badge, Card, Chips } from '../../components/UI.jsx'
import { formatCompactINR, relativeDay } from '../../utils/format.js'

const STATUS_FILTERS = ['Pending', 'Approved', 'Rejected', 'All']

function ApprovalRow({ item, onDecide, busy }) {
  return (
    <li className="approval">
      <div className="approval-main">
        <div className="approval-top">
          <span className="approval-type">{item.type}</span>
          {item.priority === 'High' && <Badge>High</Badge>}
        </div>
        <div className="t">{item.title}</div>
        <div className="s">
          {item.id} · {item.projectName} · {item.requestedBy} · {relativeDay(item.date)}
        </div>
      </div>
      <div className="approval-side">
        {item.amount != null && <div className="approval-amount">{formatCompactINR(item.amount)}</div>}
        {item.status === 'Pending' ? (
          <div className="approval-actions">
            <button className="btn btn-sm btn-primary" disabled={busy} onClick={() => onDecide(item, 'Approved')}>Approve</button>
            <button className="btn btn-sm" disabled={busy} onClick={() => onDecide(item, 'Rejected')}>Reject</button>
          </div>
        ) : (
          <div className="approval-actions">
            <Badge>{item.status}</Badge>
            <button className="btn btn-sm" onClick={() => onDecide(item, 'Pending')}>Undo</button>
          </div>
        )}
      </div>
    </li>
  )
}

export default function ApprovalCentre({ approvals, types, onDecide, compact = false, onOpenAll, initialType = 'All' }) {
  const [type, setType] = useState(types.includes(initialType) ? initialType : 'All')
  const [status, setStatus] = useState('Pending')
  const [busyId, setBusyId] = useState(null)

  const pending = approvals.filter((a) => a.status === 'Pending')
  const countByType = Object.fromEntries(types.map((t) => [t, pending.filter((a) => a.type === t).length]))

  const list = compact
    ? pending.slice(0, 5)
    : approvals.filter((a) => (type === 'All' || a.type === type) && (status === 'All' || a.status === status))

  const decide = async (item, decision) => {
    setBusyId(item.id)
    try { await onDecide(item, decision) } finally { setBusyId(null) }
  }

  return (
    <Card
      className="approval-centre mb"
      title={<span className="title-with-count">Approval Centre <span className="count-pill">{pending.length} pending</span></span>}
      sub="Prototype: decisions only change status on this screen. Nothing is approved, paid or saved."
      action={compact && onOpenAll ? <button className="btn" onClick={onOpenAll}>Open approval centre</button> : null}
    >
      <div className="approval-types">
        {types.map((t) => (
          <button
            key={t}
            className={`approval-type-tile ${!compact && type === t ? 'active' : ''}`}
            onClick={() => (compact ? onOpenAll?.(t) : setType(type === t ? 'All' : t))}
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
          {list.map((a) => <ApprovalRow key={a.id} item={a} onDecide={decide} busy={busyId === a.id} />)}
        </ul>
      ) : (
        <div className="empty sm">
          {status === 'Pending' || compact ? 'All caught up. Nothing waiting for approval.' : 'No requests match these filters.'}
        </div>
      )}
    </Card>
  )
}
