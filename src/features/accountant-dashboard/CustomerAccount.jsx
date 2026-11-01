import { useEffect, useRef, useState } from 'react'
import Icon from '../../components/Icon.jsx'
import DataTable from '../../components/DataTable.jsx'
import Tabs from '../../components/Tabs.jsx'
import { Badge, Progress } from '../../components/UI.jsx'
import { CLEARING_METHODS, RECEIPT_METHODS, paymentHistory, referenceLabel, reminderMessage, validateReceipt } from '../../services/customerLedger.js'
import { todayISO } from '../../utils/date.js'
import { formatCompactINR, formatDate, formatINR } from '../../utils/format.js'
import { LockedNote } from './shared.jsx'
import ReceiptVoucher from './ReceiptVoucher.jsx'

/** Clickable customer name that opens their account panel. */
export function CustomerLink({ row, onOpen, tab }) {
  if (!onOpen || !row.bookingId) return <div className="cell-main">{row.customer}</div>
  return (
    <button className="link-btn cell-main" onClick={() => onOpen(row.bookingId, tab)} title="Open customer account">
      {row.customer}
    </button>
  )
}

const PRINTABLE = ['Verified', 'Reconciled', 'Verified (before books start)']
const TAB_LIST = [
  { id: 'summary', label: 'Summary' },
  { id: 'schedule', label: 'Schedule' },
  { id: 'history', label: 'History' },
  { id: 'reminders', label: 'Reminders' },
]

function SummaryTab({ a, paidPct }) {
  return (
    <>
      <div className="account-headline">
        <span>{a.unitType} price <b>{formatCompactINR(a.price)}</b></span>
        <span>Paid <b className="up">{formatCompactINR(a.paid)}</b></span>
        <span>Balance <b className={a.overdue ? 'down' : ''}>{formatCompactINR(a.balance)}</b></span>
      </div>
      <Progress value={paidPct} tone={paidPct >= 100 ? 'ok' : ''} />
      <div className="cell-sub" style={{ marginTop: 6 }}>{paidPct}% of the {a.unitType.toLowerCase()} price received and verified</div>
      {a.next && (
        <div className={`next-payment ${a.next.status === 'Overdue' ? 'overdue' : ''}`}>
          <Icon name="calendar" size={16} />
          <span>
            {a.next.status === 'Overdue' ? 'Overdue: ' : 'Next payment: '}
            <b>{formatINR(a.next.amount - (a.next.paidNow || 0))}</b> {a.next.expected ? 'expected around' : a.next.status === 'Overdue' ? 'was due on' : 'due on'}{' '}
            <b>{formatDate(a.next.date)}</b> · {a.next.milestone}
          </span>
        </div>
      )}
      {a.awaitingBank > 0 && (
        <div className="next-payment pending">
          <Icon name="bank" size={16} />
          <span><b>{formatINR(a.awaitingBank)}</b> recorded but not yet confirmed by the bank, so it is not counted as paid yet.</span>
        </div>
      )}

      <div className="stat-grid compact-stats">
        <div className="stat"><div className="k">Total price</div><div className="v">{formatINR(a.price)}</div></div>
        <div className="stat tone-success"><div className="k">Amount paid</div><div className="v">{formatINR(a.paid)}</div></div>
        <div className="stat"><div className="k">Remaining balance</div><div className="v">{formatINR(a.balance)}</div></div>
        <div className={`stat ${a.overdue ? 'tone-danger' : ''}`}><div className="k">Overdue now</div><div className="v">{formatINR(a.overdue)}</div></div>
        <div className={`stat ${a.dueSoon ? 'tone-warning' : ''}`}><div className="k">Demanded, not yet due</div><div className="v">{formatINR(a.dueSoon)}</div></div>
        <div className="stat"><div className="k">Upcoming (not yet demanded)</div><div className="v">{formatINR(a.notYetDemanded)}</div><div className="s">Due as construction progresses</div></div>
      </div>

      <section className="drawer-section">
        <h3>Contact details</h3>
        <dl className="details">
          <dt>Phone</dt><dd>{a.contact.phone}</dd>
          <dt>Email</dt><dd>{a.contact.email}</dd>
          <dt>Preferred contact</dt><dd>{a.contact.preferred}</dd>
          <dt>Relationship manager</dt><dd>{a.contact.relationshipManager}</dd>
          <dt>Home loan</dt><dd>{a.homeLoan ? 'Yes: bank disbursements received' : 'No disbursements recorded'}</dd>
        </dl>
        <p className="cell-sub">Demo contact details: phone masked, email on example.com.</p>
      </section>
    </>
  )
}

function ScheduleTab({ a }) {
  return (
    <section>
      <h3 className="drawer-h3">Payment schedule ({a.schedule.length} instalments · {formatINR(a.price)})</h3>
      <DataTable
        dense
        rows={a.schedule}
        emptyText="No instalments yet."
        columns={[
          { key: 'milestone', header: 'Instalment', render: (r) => <span className="wrap-cell">{r.milestone}</span> },
          {
            key: 'date', header: 'Due date',
            render: (r) => (
              <>
                <div>{formatDate(r.date)}</div>
                <div className={`cell-sub ${r.daysOverdue ? 'down' : ''}`}>
                  {r.status === 'Received' ? 'paid' : r.daysOverdue ? `${r.daysOverdue} days overdue` : r.expected ? 'expected, on milestone' : 'demanded'}
                </div>
              </>
            ),
          },
          {
            key: 'amount', header: 'Amount', align: 'num',
            render: (r) => <><div>{formatINR(r.amount)}</div>{r.status === 'Part paid' && <div className="cell-sub">{formatINR(r.amount - r.paidNow)} left</div>}</>,
          },
          { key: 'status', header: 'Status', render: (r) => <><Badge>{r.status}</Badge>{r.receiptId && <div className="cell-sub">{r.receiptId}{r.method ? ` · ${r.method}` : ''}</div>}</> },
        ]}
      />
      <div className="table-more schedule-total">
        <span>Paid {formatINR(a.paid)}</span>
        <span>Still to pay {formatINR(a.balance)}</span>
        <span>Total {formatINR(a.price)}</span>
      </div>
      {a.schedule.some((x) => x.expected) && (
        <p className="cell-sub" style={{ marginTop: 8 }}>Upcoming dates are expected: each instalment is demanded when its construction milestone is reached.</p>
      )}
    </section>
  )
}

function RecordReceiptForm({ a, credits, bankAccount, onSave, onCancel }) {
  const due = a.next ? a.next.amount - (a.next.paidNow || 0) : 0
  const [f, setF] = useState({ amount: due ? String(due) : '', date: todayISO(), method: 'NEFT', reference: '', remarks: '' })
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value })
  const max = a.balance - a.awaitingBank
  const error = validateReceipt(f, { maxAmount: max, today: todayISO() })
  const submit = (e) => {
    e.preventDefault()
    if (!error) onSave({ ...f, amount: Number(f.amount), reference: f.reference.trim() })
  }
  return (
    <form className="receipt-form" onSubmit={submit}>
      <div className="sub-panel-head"><b>Record receipt</b><span className="cell-sub">Credited to {bankAccount?.name || 'project bank account'}</span></div>
      {credits.length > 0 && (
        <div className="credit-hints">
          <div className="cell-sub">Unidentified credits on the latest bank statement for this account:</div>
          {credits.map((c) => (
            <button
              type="button" key={c.id} className="credit-hint"
              onClick={() => setF({ ...f, amount: String(c.amount), date: c.date, method: c.method === 'Cheque' ? 'Cheque' : c.method, reference: c.ref })}
            >
              {formatDate(c.date)} · {c.method} · <b>{formatINR(c.amount)}</b> · {c.ref} · “{c.party}”{c.recon === 'Clearing' ? ' · in clearing' : ''} <span className="link-btn">Use</span>
            </button>
          ))}
        </div>
      )}
      <div className="receipt-grid">
        <label className="field">Amount (₹)<input type="number" min="1" step="1" value={f.amount} onChange={set('amount')} /></label>
        <label className="field">Payment date<input type="date" value={f.date} max={todayISO()} onChange={set('date')} /></label>
        <label className="field">Method
          <select value={f.method} onChange={set('method')}>{RECEIPT_METHODS.map((m) => <option key={m}>{m}</option>)}</select>
        </label>
        <label className="field">{referenceLabel(f.method)}<input value={f.reference} onChange={set('reference')} placeholder={f.method === 'Cheque' ? 'e.g. 004512' : 'e.g. UTR55201934'} /></label>
        <label className="field span-2">Remarks (optional)<input value={f.remarks} onChange={set('remarks')} placeholder="e.g. paid towards agreement instalment" /></label>
      </div>
      {CLEARING_METHODS.includes(f.method) && <p className="cell-sub">Cheques and DDs stay “in clearing” and are not counted as paid until the bank clears them.</p>}
      <div className="jv-submit">
        <button className="btn btn-primary" type="submit" disabled={!!error}>Save receipt</button>
        <button className="btn" type="button" onClick={onCancel}>Cancel</button>
        {error && f.amount && <span className="cell-sub down">{error}</span>}
      </div>
      <p className="cell-sub">Saved receipts are verified against the bank statement before a receipt number is issued. Demo: nothing is saved.</p>
    </form>
  )
}

function HistoryTab({ a, perms, actions, credits, bankAccount, onPrint }) {
  const [adding, setAdding] = useState(false)
  const [reversing, setReversing] = useState(null)
  const [reason, setReason] = useState('')
  const history = paymentHistory(a)
  const receipts = history.filter((h) => h.type === 'Receipt' && PRINTABLE.includes(h.bankStatus))
  const reversals = history.filter((h) => h.type === 'Reversal')

  const action = (h) => {
    if (!h.session) {
      return PRINTABLE.includes(h.bankStatus)
        ? <button className="btn btn-sm" onClick={() => onPrint(h)}>Receipt</button>
        : <span className="cell-sub">Awaiting bank match</span>
    }
    const r = h.record
    if (h.type === 'Reversal') return <span className="cell-sub">{h.note}</span>
    switch (r?.status) {
      case 'Pending verification':
      case 'Not found in bank':
        return <button className="btn btn-sm btn-primary" onClick={() => actions.verify(r)}>Verify with bank</button>
      case 'Amount differs':
        return (
          <div className="cell-actions">
            <button className="btn btn-sm" onClick={() => actions.acceptBankAmount(r)}>Accept bank amount</button>
          </div>
        )
      case 'In clearing':
        return (
          <div className="cell-actions">
            <button className="btn btn-sm" onClick={() => actions.chequeUpdate(r, 'cleared')} title="Simulates the next bank statement">Bank: cleared</button>
            <button className="btn btn-sm" onClick={() => actions.chequeUpdate(r, 'returned')} title="Simulates the next bank statement">Bank: returned</button>
          </div>
        )
      case 'Verified':
        return (
          <div className="cell-actions">
            <button className="btn btn-sm btn-primary" onClick={() => onPrint(h)}>Receipt</button>
            {perms.canReverse
              ? <button className="btn btn-sm" onClick={() => { setReversing(r); setReason('') }}>Reverse</button>
              : <LockedNote>Reversal needs Admin</LockedNote>}
          </div>
        )
      default:
        return <span className="cell-sub">-</span>
    }
  }

  return (
    <section>
      <div className="paid-so-far">
        <div>
          <div className="cell-sub">Paid so far (verified)</div>
          <div className="paid-amount">{formatINR(a.paid)}</div>
          <div className="cell-sub">{receipts.length} receipt{receipts.length === 1 ? '' : 's'}{reversals.length ? ` · ${reversals.length} reversal${reversals.length === 1 ? '' : 's'}` : ''}{a.awaitingBank ? ` · ${formatINR(a.awaitingBank)} awaiting bank` : ''}</div>
        </div>
        {perms.canRecord && !adding && <button className="btn btn-primary" onClick={() => setAdding(true)}><Icon name="plus" />Record receipt</button>}
        {!perms.canRecord && <LockedNote>View only</LockedNote>}
      </div>

      {adding && (
        <RecordReceiptForm
          a={a} credits={credits} bankAccount={bankAccount}
          onSave={(f) => { actions.record(f); setAdding(false) }}
          onCancel={() => setAdding(false)}
        />
      )}

      {reversing && (
        <form className="receipt-form" onSubmit={(e) => { e.preventDefault(); if (reason.trim()) { actions.reverse(reversing, reason.trim()); setReversing(null) } }}>
          <div className="sub-panel-head"><b>Reverse {reversing.receiptNo}</b><span className="cell-sub">{formatINR(reversing.amount)} will be added back to the balance</span></div>
          <label className="field span-2">Reason<input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. recorded against the wrong customer" /></label>
          <div className="jv-submit">
            <button className="btn btn-primary" type="submit" disabled={!reason.trim()}>Reverse receipt</button>
            <button className="btn" type="button" onClick={() => setReversing(null)}>Cancel</button>
          </div>
        </form>
      )}

      <DataTable
        dense
        rowKey="key"
        rows={history}
        emptyText="No payments recorded yet."
        columns={[
          { key: 'date', header: 'Date', render: (h) => formatDate(h.date) },
          {
            key: 'receiptNo', header: 'Receipt',
            render: (h) => <><div className="cell-main">{h.receiptNo || <span className="cell-sub">Not issued yet</span>}</div><div className="cell-sub">{h.type === 'Reversal' ? 'Reversal' : h.against || (h.session ? 'Recorded today' : '')}</div></>,
          },
          { key: 'amount', header: 'Amount', align: 'num', render: (h) => <span className={h.amount < 0 ? 'down' : ''}>{formatINR(h.amount)}</span> },
          { key: 'method', header: 'Method & reference', render: (h) => <><div>{h.method || '-'}</div><div className="cell-sub">{h.reference || '-'}</div></> },
          { key: 'bankStatus', header: 'Bank', render: (h) => <><Badge>{h.bankStatus}</Badge>{h.note && h.type !== 'Reversal' && <div className="cell-sub wrap-cell">{h.note}</div>}</> },
          { key: 'actions', header: '', render: action },
        ]}
      />
      <p className="cell-sub" style={{ marginTop: 8 }}>
        Only receipts confirmed by the bank count as paid. Cheques in clearing, unmatched or disputed amounts are shown but not counted.
      </p>
    </section>
  )
}

function RemindersTab({ a, perms, channels, reminders, onLog, notify }) {
  const msg = reminderMessage(a, todayISO(), formatINR)
  const [how, setHow] = useState('Phone call')
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(msg.text)
      notify?.('Reminder message copied.')
    } catch {
      notify?.('Could not copy automatically. Select the text and copy it.')
    }
  }
  return (
    <section>
      {msg ? (
        <>
          <div className={`next-payment ${msg.overdue ? 'overdue' : ''}`}><Icon name="bell" size={16} /><span><b>{msg.summary}</b></span></div>
          <h3 className="drawer-h3">Message</h3>
          <p className="reminder-text">{msg.text}</p>
          <div className="channel-row">
            {channels.map((c) => (
              <button key={c.id} className="btn" disabled={!c.configured || !perms.canRemind} title={c.configured ? `Send by ${c.label}` : `${c.label} is not connected in this prototype`}>
                {c.label}{!c.configured && <span className="cell-sub"> · not configured</span>}
              </button>
            ))}
            <button className="btn" onClick={copy}>Copy message</button>
          </div>
          <p className="cell-sub">WhatsApp, SMS and email sending need those integrations to be configured. Until then, copy the message or call the customer and log it below.</p>
          {perms.canRemind ? (
            <div className="channel-row">
              <label className="field inline">Logged as
                <select value={how} onChange={(e) => setHow(e.target.value)}>{['Phone call', 'In person', 'WhatsApp (own phone)', 'Email (own mailbox)'].map((x) => <option key={x}>{x}</option>)}</select>
              </label>
              <button className="btn btn-primary" onClick={() => onLog(a, how, msg.summary)}>Log reminder</button>
            </div>
          ) : <LockedNote>Reminders: view only</LockedNote>}
        </>
      ) : (
        <div className="empty sm">Nothing is due or overdue. The next instalment is an upcoming construction milestone.</div>
      )}

      <h3 className="drawer-h3">Reminder log</h3>
      {reminders.length ? (
        <ul className="list">
          {reminders.map((r) => (
            <li key={r.id}><Icon name="bell" size={14} /><div><div className="t">{r.how}: {r.summary}</div><div className="s">{formatDate(r.date)} · by {r.by} · demo log, not saved</div></div></li>
          ))}
        </ul>
      ) : <div className="cell-sub">No reminders logged in this session.</div>}
    </section>
  )
}

/** Side panel: one buyer's account with schedule, payment history, receipts and reminders. */
export default function CustomerAccount({ account, initialTab = 'summary', onClose, notify, perms = {}, actions, credits = [], bankAccount, channels = [], reminders = [] }) {
  const closeRef = useRef(null)
  const [tab, setTab] = useState(initialTab)
  const [printing, setPrinting] = useState(null)

  useEffect(() => {
    const previous = document.activeElement
    closeRef.current?.focus()
    const onKey = (e) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('keydown', onKey)
      if (previous && typeof previous.focus === 'function') previous.focus()
    }
  }, [onClose])

  if (!account) return null
  const a = account
  const paidPct = a.price ? Math.round((a.paid / a.price) * 100) : 0
  const tabs = TAB_LIST.map((t) => ({
    ...t,
    count: t.id === 'reminders' && (a.overdue > 0) ? 1 : t.id === 'history' && a.awaitingBank ? 1 : 0,
  }))

  return (
    <div className="drawer-scrim" onClick={onClose}>
      <aside className="drawer" role="dialog" aria-modal="true" aria-labelledby="customer-title" onClick={(e) => e.stopPropagation()}>
        <div className="drawer-head">
          <div>
            <h2 id="customer-title">{a.customer}</h2>
            <div className="cell-sub">{a.unitType} {a.unit} · {a.projectName} · booked {formatDate(a.bookingDate)} · {a.bookingId}</div>
            <div className="drawer-quick">
              Price <b>{formatCompactINR(a.price)}</b> · Paid <b className="up">{formatCompactINR(a.paid)}</b> · Balance <b>{formatCompactINR(a.balance)}</b>
            </div>
          </div>
          <button ref={closeRef} className="icon-btn" onClick={onClose} aria-label="Close customer account"><Icon name="x" /></button>
        </div>
        <div className="drawer-tabs"><Tabs tabs={tabs} value={tab} onChange={setTab} label="Customer account sections" /></div>

        <div className="drawer-body">
          {tab === 'summary' && <SummaryTab a={a} paidPct={paidPct} />}
          {tab === 'schedule' && <ScheduleTab a={a} />}
          {tab === 'history' && <HistoryTab a={a} perms={perms} actions={actions} credits={credits} bankAccount={bankAccount} onPrint={setPrinting} />}
          {tab === 'reminders' && <RemindersTab a={a} perms={perms} channels={channels} reminders={reminders} onLog={actions?.logReminder} notify={notify} />}
        </div>

        <div className="drawer-foot">
          <span className="cell-sub">Demo: receipts and reminders recorded here reset on reload. Nothing is sent or saved.</span>
        </div>
      </aside>

      {printing && (
        <ReceiptVoucher
          receipt={{ ...printing, bankStatus: printing.bankStatus, verifiedOn: printing.record?.verifiedOn, verifiedBy: printing.record?.verifiedBy }}
          account={a}
          bankAccountName={bankAccount?.name}
          onClose={() => setPrinting(null)}
        />
      )}
    </div>
  )
}
