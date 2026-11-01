import { useState } from 'react'
import DataTable from '../../components/DataTable.jsx'
import StatGrid from '../../components/StatGrid.jsx'
import { Badge, Card } from '../../components/UI.jsx'
import { formatCompactINR, formatDate, formatINR, formatNumber, relativeDay } from '../../utils/format.js'
import { PAYMENT_MODES } from '../../services/procurement.js'
import { todayISO } from '../../utils/date.js'
import { ConfirmDialog, Drawer, FormError, HistoryList, SimNote } from '../store-keeper/shared.jsx'
import { LockedNote, SectionToolbar } from './shared.jsx'

export const SUPPLIER_STATUSES = ['All', 'Awaiting Verification', 'Query Raised', 'Returned to Supplier', 'Due', 'Overdue', 'Awaiting Payment Approval', 'Approved for Payment', 'Partially Paid', 'Paid']
const OPEN = ['Due', 'Overdue', 'Awaiting Payment Approval', 'Approved for Payment', 'Partially Paid']
const sumOf = (rows, k = 'balance') => rows.reduce((s, r) => s + r[k], 0)

/** PO vs delivered vs accepted vs billed, with the mismatch spelled out. Ordered is never treated as delivered, nor delivered as accepted. */
function MatchCell({ r }) {
  const short = r.invoicedQty > r.acceptedQty
  return (
    <div className="match-cell">
      <div className="match-qty">
        <span title="Ordered (PO)">PO {formatNumber(r.orderedQty)}</span>
        <span title="Delivered (GRN)">Del {formatNumber(r.deliveredQty)}</span>
        <span title="Accepted at the store (GRN)" className={short ? 'down' : ''}>Acc {formatNumber(r.acceptedQty)}</span>
        <span title="Billed on the invoice" className={short ? 'down' : ''}>Inv {formatNumber(r.invoicedQty)}</span>
        <span className="cell-sub">{r.unit}</span>
      </div>
      {r.rejectedQty > 0 && <div className="cell-sub down">{formatNumber(r.rejectedQty)} rejected at store</div>}
      {r.invoiceRate > r.poRate && <div className="cell-sub down">Rate ₹{formatNumber(r.invoiceRate)} vs PO ₹{formatNumber(r.poRate)}</div>}
      {r.matchStatus !== 'Matched' && <Badge>{r.matchStatus}</Badge>}
    </div>
  )
}

/** Supplier ledger: invoices, payments and running balance for one supplier. */
export function SupplierAccounts({ accounts }) {
  const [selected, setSelected] = useState(accounts[0]?.id || '')
  const acc = accounts.find((a) => a.id === selected) || accounts[0]
  return (
    <Card title="Supplier Accounts" sub="Invoices, payments and outstanding balance per supplier (all dates)" bodyClass="" className="mb">
      <DataTable
        dense
        rows={accounts}
        emptyText="No supplier accounts."
        columns={[
          {
            key: 'supplier', header: 'Supplier',
            render: (r) => (
              <button className={`link-btn ${r.id === acc?.id ? 'active' : ''}`} onClick={() => setSelected(r.id)}>{r.supplier}</button>
            ),
          },
          { key: 'invoices', header: 'Invoices', align: 'num' },
          { key: 'invoiced', header: 'Invoiced', align: 'num', render: (r) => formatINR(r.invoiced) },
          { key: 'paid', header: 'Paid', align: 'num', render: (r) => formatINR(r.paid) },
          { key: 'outstanding', header: 'Outstanding', align: 'num', render: (r) => <b>{formatINR(r.outstanding)}</b> },
          { key: 'overdue', header: 'Overdue', align: 'num', render: (r) => (r.overdue ? <span className="down">{formatINR(r.overdue)}</span> : '-') },
          { key: 'lastPayment', header: 'Last payment', render: (r) => (r.lastPayment ? formatDate(r.lastPayment) : '-') },
        ]}
      />
      {acc && (
        <div className="sub-panel">
          <div className="sub-panel-head">
            <b>{acc.supplier}</b> · transaction history
            <label className="field inline">
              Supplier
              <select value={acc.id} onChange={(e) => setSelected(e.target.value)}>
                {accounts.map((a) => <option key={a.id} value={a.id}>{a.supplier}</option>)}
              </select>
            </label>
          </div>
          <DataTable
            dense
            rows={acc.history}
            emptyText="No transactions."
            columns={[
              { key: 'date', header: 'Date', render: (r) => formatDate(r.date) },
              { key: 'type', header: 'Type', render: (r) => <span className="cell-main">{r.type}</span> },
              { key: 'ref', header: 'Reference', render: (r) => <span className="cell-sub">{r.ref}</span> },
              { key: 'credit', header: 'Invoice', align: 'num', render: (r) => (r.credit ? formatINR(r.credit) : '') },
              { key: 'debit', header: 'Payment', align: 'num', render: (r) => (r.debit ? formatINR(r.debit) : '') },
              { key: 'balance', header: 'Balance', align: 'num', render: (r) => formatINR(r.balance) },
              { key: 'status', header: 'Status', render: (r) => <Badge>{r.status}</Badge> },
            ]}
          />
        </div>
      )}
    </Card>
  )
}

/** One dialog per workflow step on a supplier invoice. Every step is checked again by the shared workflow. */
function BillDialog({ kind, bill, onWorkflow, onClose }) {
  const today = todayISO()
  const [note, setNote] = useState('')
  const [pay, setPay] = useState({ amount: String(bill.remainingApproved || ''), date: today, mode: bill.remainingApproved > 200000 ? 'RTGS' : 'NEFT', reference: '' })
  const [error, setError] = useState('')
  const run = (name, args) => {
    const r = onWorkflow(name, { id: bill.id, ...args })
    if (!r.ok) { setError(r.error); return false }
    onClose()
    return true
  }
  const short = bill.amount - bill.acceptedValue
  const due = (bill.verifiedAmount ?? 0) - bill.paidAmount
  const advance = Math.min(bill.advanceAvailable, Math.max(0, due))
  const config = {
    verify: {
      title: `Verify ${bill.invoiceNo}?`, label: short > 0 ? 'Verify at accepted value' : 'Verify invoice',
      go: () => run('verifyInvoice', { note }),
      body: (
        <>
          <p>Payable on this invoice: <b>{formatINR(bill.acceptedValue)}</b> ({formatNumber(bill.payableQty)} {bill.unit} accepted at ₹{formatNumber(Math.min(bill.invoiceRate, bill.poRate))}).</p>
          {short > 0 && <p className="down">Billed {formatINR(bill.amount)}: {formatINR(short)} above the accepted value. It is recorded as a debit note and not paid.</p>}
          <label className="field">{short > 0 ? 'Debit note reason (required)' : 'Note (optional)'}<input value={note} onChange={(e) => { setNote(e.target.value); setError('') }} placeholder={short > 0 ? 'e.g. 10 bags rejected at the store (GRN)' : ''} /></label>
          <p className="cell-sub">Posts the purchase to the books: Construction WIP (materials) Dr, Sundry creditors Cr.</p>
        </>
      ),
    },
    query: {
      title: `Raise a query on ${bill.invoiceNo}?`, label: 'Raise query',
      go: () => run('queryInvoice', { note }),
      body: <label className="field">Query for {bill.supplier}<input value={note} onChange={(e) => { setNote(e.target.value); setError('') }} placeholder="e.g. invoice bills 500 bags; 490 accepted" /></label>,
    },
    return: {
      title: `Return ${bill.invoiceNo} to the supplier?`, label: 'Return for correction',
      go: () => run('queryInvoice', { note, returnToSupplier: true }),
      body: <label className="field">Reason<input value={note} onChange={(e) => { setNote(e.target.value); setError('') }} placeholder="e.g. wrong PO reference" /></label>,
    },
    reply: {
      title: `Supplier replied on ${bill.invoiceNo}?`, label: 'Record reply (simulated)',
      go: () => run('supplierReplied', { note: note || 'Supplier replied (simulated)' }),
      body: <><SimNote>Suppliers have no login. This records their reply so the invoice returns for verification.</SimNote><label className="field">Reply<input value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. credit note CN-21 for 10 bags" /></label></>,
    },
    request: {
      title: `Request payment approval for ${bill.invoiceNo}?`, label: 'Send to Admin for approval',
      go: () => run('requestPaymentApproval', { note }),
      body: (
        <>
          <dl className="details">
            <dt>Verified amount</dt><dd>{formatINR(bill.verifiedAmount)}</dd>
            <dt>Already paid</dt><dd>{formatINR(bill.paidAmount)}</dd>
            <dt>Advance to adjust</dt><dd>{advance ? `− ${formatINR(advance)} (paid against ${bill.poId})` : 'None'}</dd>
            <dt>Net to release</dt><dd><b>{formatINR(due - advance)}</b></dd>
          </dl>
          <label className="field">Note for Admin (optional)<input value={note} onChange={(e) => setNote(e.target.value)} /></label>
          <p className="cell-sub">Nothing is paid. Admin releases the payment; then the payment team records it.</p>
        </>
      ),
    },
    pay: {
      title: `Record payment to ${bill.supplier}`, label: 'Record payment',
      go: () => run('recordSupplierPayment', { amount: pay.amount, date: pay.date, mode: pay.mode, reference: pay.reference }),
      body: (
        <>
          <p>Approved by {bill.request?.decidedBy} for {formatINR(bill.approvedNet)}. Still to pay: <b>{formatINR(bill.remainingApproved)}</b>.</p>
          <div className="receipt-grid" style={{ padding: 0 }}>
            <label className="field">Amount (₹)<input type="number" min="0" value={pay.amount} onChange={(e) => { setPay({ ...pay, amount: e.target.value }); setError('') }} /></label>
            <label className="field">Payment date<input type="date" max={today} value={pay.date} onChange={(e) => setPay({ ...pay, date: e.target.value })} /></label>
            <label className="field">Mode<select value={pay.mode} onChange={(e) => setPay({ ...pay, mode: e.target.value })}>{PAYMENT_MODES.map((m) => <option key={m}>{m}</option>)}</select></label>
            <label className="field">Bank reference (UTR / cheque no.)<input value={pay.reference} onChange={(e) => { setPay({ ...pay, reference: e.target.value }); setError('') }} /></label>
          </div>
          <p className="cell-sub">Records the payment made from the bank. Demo: no money moves and nothing is saved.</p>
        </>
      ),
    },
  }[kind]
  return (
    <ConfirmDialog title={config.title} confirmLabel={config.label} onCancel={onClose} onConfirm={config.go}>
      {config.body}
      <FormError error={error} />
    </ConfirmDialog>
  )
}

/** Accounts records a supplier invoice received against an approved PO that has goods receipts. */
function RecordInvoice({ pos, onWorkflow, onClose }) {
  const [f, setF] = useState({ poId: pos[0]?.id || '', invoiceNo: '', date: todayISO(), qty: '', rate: '' })
  const [error, setError] = useState('')
  const po = pos.find((p) => p.id === f.poId)
  const set = (k) => (e) => { setF({ ...f, [k]: e.target.value }); setError('') }
  return (
    <ConfirmDialog title="Record supplier invoice" confirmLabel="Record invoice" onCancel={onClose}
      onConfirm={() => { const r = onWorkflow('recordSupplierInvoice', { ...f, rate: f.rate || po?.rate }); if (!r.ok) { setError(r.error); return false } onClose(); return true }}>
      {!pos.length ? <p>No approved purchase order has goods received that are not yet invoiced.</p> : (
        <div className="receipt-grid" style={{ padding: 0 }}>
          <label className="field span-2">Purchase order<select value={f.poId} onChange={set('poId')}>{pos.map((p) => <option key={p.id} value={p.id}>{p.id} · {p.vendor} · {formatNumber(p.qty)} @ ₹{formatNumber(p.rate)}</option>)}</select></label>
          <label className="field">Supplier invoice no.<input value={f.invoiceNo} onChange={set('invoiceNo')} /></label>
          <label className="field">Invoice date<input type="date" max={todayISO()} value={f.date} onChange={set('date')} /></label>
          <label className="field">Quantity billed<input type="number" min="0" value={f.qty} onChange={set('qty')} /></label>
          <label className="field">Rate billed (₹, incl. GST)<input type="number" min="0" value={f.rate} onChange={set('rate')} placeholder={po ? String(po.rate) : ''} /></label>
        </div>
      )}
      <p className="cell-sub">The invoice is matched to the PO and the Store Keeper&apos;s GRNs. It is not booked until verified.</p>
      <FormError error={error} />
    </ConfirmDialog>
  )
}

/** Supplier invoices from the shared purchase records: three-way match, verification, payment approval and payment. */
export default function SupplierPayments({ bills, accounts = [], status = 'All', onStatusChange, perms = {}, onWorkflow, invoiceablePOs = [], compact = false }) {
  const [dialog, setDialog] = useState(null) // { kind, id } | { kind: 'invoice' }
  const [historyId, setHistoryId] = useState(null)
  const rows = compact
    ? bills.filter((b) => OPEN.includes(b.paymentStatus)).slice(0, 6)
    : bills.filter((b) => status === 'All' || b.paymentStatus === status)
  const open = (kind, r) => setDialog({ kind, id: r.id })
  const current = dialog?.id && bills.find((b) => b.id === dialog.id)
  const shown = historyId && bills.find((b) => b.id === historyId)

  const action = (r) => {
    const out = []
    const s = r.paymentStatus
    if (s === 'Awaiting Verification') {
      if (!perms.canVerifyBills) out.push(<LockedNote key="v">Verified by Accounts</LockedNote>)
      else if (r.matchStatus === 'Awaiting inspection') out.push(<span key="v" className="cell-sub">Waiting for store inspection</span>)
      else {
        out.push(<button key="v" className={`btn btn-sm ${r.matchStatus === 'Matched' ? 'btn-primary' : ''}`} onClick={() => open('verify', r)}>{r.matchStatus === 'Matched' ? 'Verify' : 'Verify at accepted'}</button>)
        out.push(<button key="q" className="btn btn-sm" onClick={() => open('query', r)}>Query</button>)
        out.push(<button key="r" className="btn btn-sm" onClick={() => open('return', r)}>Return</button>)
      }
    } else if (['Query Raised', 'Returned to Supplier'].includes(s)) {
      out.push(<button key="sim" className="btn btn-sm sim-btn" onClick={() => open('reply', r)}>Supplier replied (simulated)</button>)
    } else if (['Due', 'Overdue'].includes(s)) {
      out.push(perms.canSchedule
        ? <button key="p" className="btn btn-sm btn-primary" title="Admin releases supplier payments" onClick={() => open('request', r)}>Request payment approval</button>
        : <LockedNote key="p">Requested by Accounts</LockedNote>)
      if (r.request?.status === 'Rejected') out.push(<div key="rj" className="cell-sub down">Release rejected: {r.request.reason}</div>)
    } else if (s === 'Awaiting Payment Approval') {
      out.push(<span key="w" className="cell-sub">With Admin · {formatINR(r.request.net)}</span>)
    } else if (['Approved for Payment', 'Partially Paid'].includes(s)) {
      out.push(perms.canRecordPayment
        ? <button key="pay" className="btn btn-sm btn-primary" onClick={() => open('pay', r)}>Record payment</button>
        : <LockedNote key="pay">Payment team only</LockedNote>)
    }
    out.push(<button key="h" className="link-btn" onClick={() => setHistoryId(r.id)}>History</button>)
    return <div className="cell-actions">{out}</div>
  }

  const columns = [
    { key: 'supplier', header: 'Supplier & invoice', render: (r) => <><div className="cell-main">{r.supplier}</div><div className="cell-sub">{r.invoiceNo} · {r.id} · {formatDate(r.invoiceDate)}</div></> },
    {
      key: 'material', header: 'PO · material',
      render: (r) => <><div>{r.poId} <span className="cell-sub">({r.poStatus})</span></div><div className="cell-sub">{r.material} · {r.delivery} · {r.grnId}</div></>,
    },
    { key: 'match', header: 'PO · delivered · accepted · billed', render: (r) => <MatchCell r={r} /> },
    {
      key: 'dueDate', header: 'Due date',
      render: (r) => <><div>{formatDate(r.dueDate)}</div>{r.paymentStatus !== 'Paid' && <div className={`cell-sub ${r.daysOverdue > 0 ? 'down' : ''}`}>{relativeDay(r.dueDate)}</div>}</>,
    },
    {
      key: 'balance', header: 'Amount due', align: 'num',
      render: (r) => (
        <>
          <div>{r.balance ? formatINR(r.balance) : <span className="cell-sub">Nil</span>}</div>
          <div className="cell-sub">billed {formatINR(r.amount)}</div>
          {r.verifiedAmount != null && r.verifiedAmount !== r.amount && <div className="cell-sub">verified {formatINR(r.verifiedAmount)}</div>}
          {r.advanceAdjusted > 0 && <div className="cell-sub">advance − {formatINR(r.advanceAdjusted)}</div>}
          {!r.advanceAdjusted && r.advanceAvailable > 0 && <div className="cell-sub">advance held {formatINR(r.advanceAvailable)}</div>}
        </>
      ),
    },
    {
      key: 'paymentStatus', header: 'Status',
      render: (r) => (
        <>
          <Badge>{r.paymentStatus}</Badge>
          {r.paidOn && <div className="cell-sub">{formatDate(r.paidOn)} · {r.paymentMode} {r.paymentRef}</div>}
          {r.recon && r.recon !== 'Reconciled' && <div className="cell-sub down">Bank: {r.recon}</div>}
        </>
      ),
    },
    { key: 'actions', header: 'Action', render: action },
  ]

  const dialogs = (
    <>
      {current && <BillDialog key={`${dialog.kind}-${current.id}`} kind={dialog.kind} bill={current} onWorkflow={onWorkflow} onClose={() => setDialog(null)} />}
      {dialog?.kind === 'invoice' && <RecordInvoice pos={invoiceablePOs} onWorkflow={onWorkflow} onClose={() => setDialog(null)} />}
      {shown && (
        <Drawer title={`${shown.invoiceNo} · ${shown.supplier}`} sub={`${shown.id} · ${shown.poId}`} onClose={() => setHistoryId(null)}>
          <div className="three-way">
            <div><span className="cell-sub">Ordered (PO)</span><b>{formatNumber(shown.orderedQty)}</b></div>
            <div><span className="cell-sub">Delivered (GRN)</span><b>{formatNumber(shown.deliveredQty)}</b></div>
            <div className={shown.acceptedQty < shown.invoicedQty ? 'bad' : ''}><span className="cell-sub">Accepted</span><b>{formatNumber(shown.acceptedQty)}</b></div>
            <div className={shown.rejectedQty ? 'bad' : ''}><span className="cell-sub">Rejected</span><b>{formatNumber(shown.rejectedQty)}</b></div>
            <div className={shown.matchStatus !== 'Matched' ? 'bad' : ''}><span className="cell-sub">Billed</span><b>{formatNumber(shown.invoicedQty)}</b></div>
          </div>
          {shown.matchIssues.length > 0 && <div className="info-note warn"><span>⚠</span><div>{shown.matchIssues.join('. ')}.</div></div>}
          <dl className="details">
            <dt>GRNs</dt><dd>{shown.grnId}</dd>
            <dt>Billed</dt><dd>{formatINR(shown.amount)} ({formatNumber(shown.invoicedQty)} × ₹{formatNumber(shown.invoiceRate)})</dd>
            <dt>Accepted value</dt><dd>{formatINR(shown.acceptedValue)}</dd>
            <dt>Verified</dt><dd>{shown.verifiedAmount != null ? `${formatINR(shown.verifiedAmount)} by ${shown.verifiedBy}` : 'Not yet'}{shown.debitNote ? ` · debit note ${formatINR(shown.debitNote.amount)}: ${shown.debitNote.reason}` : ''}</dd>
            <dt>Advance on PO</dt><dd>{shown.advanceAdjusted ? `${formatINR(shown.advanceAdjusted)} adjusted` : shown.advanceAvailable ? `${formatINR(shown.advanceAvailable)} available` : 'None'}</dd>
            <dt>Payment release</dt><dd>{shown.request ? `${shown.request.status}: ${formatINR(shown.request.net)}${shown.request.decidedBy ? ` · ${shown.request.decidedBy}` : ''}${shown.request.reason ? ` · ${shown.request.reason}` : ''}` : 'Not requested'}</dd>
            <dt>Payments</dt><dd>{shown.payments.length ? shown.payments.map((p) => `${formatINR(p.amount)} ${p.mode} ${p.reference} (${formatDate(p.date)})`).join('; ') : 'None'}</dd>
          </dl>
          <div className="sub-panel-head" style={{ marginTop: 14 }}><b>Amounts, kept separate</b><span className="cell-sub">A PO or a goods receipt is never treated as payment</span></div>
          <dl className="details">
            <dt>Advance paid on {shown.poId}</dt><dd>{formatINR(shown.advanceAvailable + shown.advanceAdjusted)}</dd>
            <dt>Invoice total</dt><dd>{formatINR(shown.amount)}{shown.verifiedAmount != null && shown.verifiedAmount !== shown.amount ? ` (verified ${formatINR(shown.verifiedAmount)})` : ''}</dd>
            <dt>Advance adjusted</dt><dd>{formatINR(shown.advanceAdjusted)}</dd>
            <dt>Payments made</dt><dd>{formatINR(shown.paidAmount)} in {shown.payments.length} transaction{shown.payments.length === 1 ? '' : 's'}</dd>
            <dt>Remaining balance</dt><dd><b>{formatINR(shown.balance)}</b> · <Badge>{shown.paymentStatus}</Badge></dd>
          </dl>
          <div className="sub-panel-head" style={{ marginTop: 14 }}><b>History</b></div>
          <HistoryList items={shown.history} />
        </Drawer>
      )}
    </>
  )

  if (compact) {
    return (
      <Card title="Upcoming Supplier Payments" sub="Open invoices, earliest due first" bodyClass="" className="mb">
        <DataTable dense rows={rows} columns={columns.filter((c) => !['material', 'match', 'actions'].includes(c.key))} emptyText="No supplier invoices due." />
      </Card>
    )
  }

  const openBills = bills.filter((b) => b.paymentStatus !== 'Paid')
  const overdue = bills.filter((b) => b.paymentStatus === 'Overdue')
  const withAdmin = bills.filter((b) => b.paymentStatus === 'Awaiting Payment Approval')
  const toMatch = bills.filter((b) => b.paymentStatus === 'Awaiting Verification')
  const mismatched = toMatch.filter((b) => !['Matched', 'Awaiting inspection'].includes(b.matchStatus))
  return (
    <>
      <StatGrid
        items={[
          { label: 'Pending to suppliers', value: formatCompactINR(sumOf(openBills)), sub: `${openBills.length} open invoices`, tone: openBills.length ? 'warning' : undefined },
          { label: 'Overdue', value: formatCompactINR(sumOf(overdue)), sub: `${overdue.length} invoices`, tone: overdue.length ? 'danger' : undefined },
          { label: 'With Admin for release', value: formatCompactINR(withAdmin.reduce((s, b) => s + b.request.net, 0)), sub: `${withAdmin.length} requests` },
          { label: 'Awaiting 3-way match', value: toMatch.length, sub: `${mismatched.length} with a mismatch`, tone: mismatched.length ? 'danger' : undefined },
          { label: 'Paid in range', value: formatCompactINR(sumOf(bills.filter((b) => b.paidOn), 'paidAmount')), tone: 'success' },
        ]}
      />

      {mismatched.length > 0 && (
        <div className="info-note warn">
          <span>
            <b>{mismatched.length} invoice{mismatched.length > 1 ? 's do' : ' does'} not match the goods accepted at the store.</b>{' '}
            {mismatched.map((b) => <span key={b.id}>{b.invoiceNo} ({b.supplier}): {b.matchIssues.join('; ')}, over-billed by {formatINR(b.overBilled)}. </span>)}
            Pay only the accepted value (debit note) or query the supplier.
          </span>
        </div>
      )}

      <Card title="Supplier Invoices & Payments" sub="From the shared purchase records: quantities come from the PO and the Store Keeper's GRNs. Admin releases every supplier payment." bodyClass="" className="mb"
        action={perms.canVerifyBills ? <button className="btn" onClick={() => setDialog({ kind: 'invoice' })}>Record supplier invoice</button> : null}>
        <SectionToolbar statuses={SUPPLIER_STATUSES} status={status} onStatusChange={onStatusChange} />
        <DataTable dense rows={rows} columns={columns} emptyText="No supplier invoices match these filters." />
      </Card>

      {accounts.length > 0 && <SupplierAccounts accounts={accounts} />}
      {dialogs}
    </>
  )
}
