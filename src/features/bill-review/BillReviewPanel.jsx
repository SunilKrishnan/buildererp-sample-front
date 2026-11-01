import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import Icon from '../../components/Icon.jsx'
import DataTable from '../../components/DataTable.jsx'
import Tabs from '../../components/Tabs.jsx'
import { Badge } from '../../components/UI.jsx'
import { can, PERMISSIONS as P } from '../../auth/demoRoles.js'
import { RECORD_LABEL } from '../../services/billComparison.js'
import { todayISO } from '../../utils/date.js'
import { formatDate, formatINR } from '../../utils/format.js'
import { LockedNote } from '../accountant-dashboard/shared.jsx'
import { stageOf, useBillWorkflow } from './BillWorkflowContext.jsx'
import { approvalRuleFor, approverCheck, holdReasons, verifyBlockers } from './billRules.js'
import DocumentPreview from './DocumentPreview.jsx'

const PANEL_TABS = [
  { id: 'bill', label: 'Supplier bill' },
  { id: 'po', label: 'Purchase order' },
  { id: 'site', label: 'Site confirmation' },
  { id: 'compare', label: 'AI comparison' },
  { id: 'review', label: 'Review & approval' },
]
const REC_ICON = { available: '✓', missing: '✕', pending: '…', 'not required': '–' }
const rate = (n) => `₹${Number(n).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`

/** Comparison result, showing "reviewed" once the accountant has noted every serious finding. */
export function AiBadge({ report, notes = {} }) {
  const high = report.findings.filter((f) => f.severity === 'High' && !f.mandatory)
  const open = report.findings.filter((f) => f.severity === 'High' && (f.mandatory || !notes[f.id]))
  if (!high.length && !open.length) return <Badge tone="success">{report.summary}</Badge>
  if (!open.length) return <Badge tone="info">{high.length} issue{high.length > 1 ? 's' : ''} reviewed</Badge>
  return <Badge tone="danger">{open.length} issue{open.length > 1 ? 's need' : ' needs'} review</Badge>
}

/** Bill · PO · Site availability chips, used in lists and the panel header. */
export function RecordChips({ records, mandatory = [], onOpen }) {
  return (
    <span className="rec-chips">
      {['bill', 'po', 'site'].map((k) => {
        const label = `${REC_ICON[records[k]]} ${k === 'bill' ? 'Bill' : k === 'po' ? 'PO' : 'Site'}`
        const title = `${RECORD_LABEL[k]}: ${records[k]}${mandatory.includes(k) ? ' (mandatory)' : ''}`
        const className = `rec-chip ${records[k].replace(' ', '-')} ${mandatory.includes(k) ? 'req' : ''}`
        return onOpen
          ? <button key={k} type="button" className={`${className} clickable`} title={`${title}. Click to view`} onClick={() => onOpen(k)}>{label}</button>
          : <span key={k} className={className} title={title}>{label}</span>
      })}
    </span>
  )
}

function DocButton({ name, onView }) {
  if (!name) return <span className="cell-sub">No document</span>
  return (
    <button className="doc-link" onClick={onView} title="Open a demo preview of this document">
      <Icon name="file" size={14} />{name} · View
    </button>
  )
}

function LinesTable({ lines, gstRate, showAmounts = true }) {
  const taxable = lines.reduce((s, l) => s + (l.qty ?? 0) * l.rate, 0)
  return (
    <>
      <DataTable
        dense
        rowKey="item"
        rows={lines}
        columns={[
          { key: 'desc', header: 'Description', render: (l) => <span className="wrap-cell">{l.desc}</span> },
          { key: 'qty', header: 'Qty / period', align: 'num', render: (l) => (l.qty != null ? `${l.qty} ${l.unit}` : `As per site (${l.unit})`) },
          { key: 'rate', header: 'Rate', align: 'num', render: (l) => rate(l.rate) },
          ...(showAmounts ? [{ key: 'amount', header: 'Amount', align: 'num', render: (l) => (l.qty != null ? formatINR(l.qty * l.rate) : '-') }] : []),
        ]}
      />
      {showAmounts && lines.every((l) => l.qty != null) && (
        <div className="table-more schedule-total">
          <span>Taxable {formatINR(taxable)}</span>
          <span>GST {gstRate}% {formatINR(Math.round((taxable * gstRate) / 100))}</span>
          <span><b>Total {formatINR(Math.round(taxable * (1 + gstRate / 100)))}</b></span>
        </div>
      )}
    </>
  )
}

function ReasonForm({ label, placeholder, submitLabel, onSubmit, onCancel, extra, tone = 'btn-primary' }) {
  const [text, setText] = useState('')
  return (
    <form className="receipt-form" onSubmit={(e) => { e.preventDefault(); if (text.trim()) onSubmit(text.trim()) }}>
      <div className="sub-panel-head"><b>{label}</b></div>
      {extra}
      <label className="field span-2">Reason / message<input value={text} onChange={(e) => setText(e.target.value)} placeholder={placeholder} autoFocus /></label>
      <div className="jv-submit">
        <button className={`btn ${tone}`} type="submit" disabled={!text.trim()}>{submitLabel}</button>
        <button className="btn" type="button" onClick={onCancel}>Cancel</button>
      </div>
    </form>
  )
}

function Finding({ f, note, canExplain, onExplain }) {
  const [text, setText] = useState('')
  return (
    <div className={`finding sev-${f.severity.toLowerCase()}`}>
      <div className="finding-head">
        <Badge tone={f.severity === 'High' ? 'danger' : f.severity === 'Info' ? 'info' : 'warning'}>{f.severity === 'High' ? 'Needs review' : f.severity === 'Medium' ? 'Adjust at payment' : 'Note'}</Badge>
        <b>{f.title}</b>
        {f.amount ? <span className={`finding-amt ${f.severity === 'Medium' ? 'warn' : ''}`}>{formatINR(f.amount)}</span> : null}
      </div>
      <p>{f.detail}</p>
      <table className="compared">
        <tbody>
          {f.compared.map((c, i) => (
            <tr key={i}><th>{c.label}</th><td>{c.value ?? '-'}</td><td className="cell-sub"><Icon name="file" size={12} /> {c.source || '-'}</td></tr>
          ))}
        </tbody>
      </table>
      {f.action && <div className="cell-sub">Suggested next step: {f.action}</div>}
      {note ? (
        <div className="finding-note"><Icon name="check" size={13} /> Reviewed by {note.by}: {note.note}</div>
      ) : canExplain && f.severity === 'High' && !f.mandatory ? (
        <form className="finding-form" onSubmit={(e) => { e.preventDefault(); if (text.trim()) onExplain(text.trim()) }}>
          <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Your review note (what you checked and the outcome)" />
          <button className="btn btn-sm" type="submit" disabled={!text.trim()}>Save note</button>
        </form>
      ) : null}
    </div>
  )
}

/**
 * Side panel for one supplier bill: records, simulated AI comparison, accountant
 * verification, approval and payment. `role`/`user` decide which actions show.
 */
export default function BillReviewPanel({ bill, rec, initialTab = 'bill', role, user, approvalRules, onClose, notify, mode = 'accountant' }) {
  const { stateOf, actions } = useBillWorkflow()
  const closeRef = useRef(null)
  const [tab, setTab] = useState(initialTab)
  const [form, setForm] = useState(null) // which inline form is open
  const [running, setRunning] = useState(false)
  const [payForm, setPayForm] = useState(null)
  const [preview, setPreview] = useState(null) // 'bill' | 'po' | 'site'
  const [forwardAmount, setForwardAmount] = useState('')
  const [advanceInput, setAdvanceInput] = useState('')

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

  if (!bill) return null
  const state = stateOf(bill)
  const { report, records, bill: b } = rec
  const record = b.record || {}
  const stage = stageOf(state)
  const held = holdReasons(report, state)
  const blockers = verifyBlockers(report, state)
  const rule = approvalRuleFor(state.recommendedAmount ?? bill.amount, approvalRules)
  const approval = approverCheck({ state, report, user, role, rule })
  const canVerify = can(role.id, P.EXPENSE_VERIFY)
  const canPay = can(role.id, P.PAYMENT_RECORD)
  const verifying = !state.historic && ['Pending Verification', 'Query Raised', 'Returned to supplier'].includes(state.verification)
  const awaitingForward = state.verification === 'Verified' && ['Not submitted', 'Returned'].includes(state.approval)
  // Before approval this is the recommended amount; after approval, the approved amount
  const approvedAmount = state.approvedAmount ?? state.recommendedAmount ?? bill.amount
  const advanceAdjust = state.advanceAdjust || 0
  const netPayable = approvedAmount - advanceAdjust
  const balanceToPay = Math.max(0, netPayable - state.paidAmount)
  const advances = record.po?.advances || []
  const advanceOpen = report.advanceBalance || 0
  const defaultGross = report.expected && report.expected < bill.amount ? report.expected : bill.amount
  const grossToForward = Number(forwardAmount || defaultGross)
  const advanceToForward = Math.min(Number(advanceInput === '' ? advanceOpen : advanceInput) || 0, advanceOpen, grossToForward)
  const say = (m) => notify?.(m)

  const runComparison = () => {
    setRunning(true)
    setTimeout(() => { actions.runCheck(bill, user); setRunning(false); say('Simulated AI comparison complete. Review the findings; nothing was decided automatically.') }, 600)
  }

  // Demo controls: events another person would cause
  const demoControls = []
  if (record.site?.status === 'Pending') {
    demoControls.push({
      label: `Site engineer confirms ${record.lines.map((l) => `${l.qty} ${l.unit}`).join(', ')}`,
      run: () => actions.simulate(bill, user, { site: { status: 'Confirmed', by: record.site.requestedFrom, date: todayISO(), lines: record.lines.map((l) => ({ item: l.item, qty: l.qty, unit: l.unit })), document: 'hour-meter-log.pdf', note: 'Hour-meter readings confirmed by site (simulated).' } }, 'site confirmation received'),
    })
  }
  if (record.projectOnBill && record.projectOnBill !== bill.projectName && state.verification === 'Returned to supplier') {
    demoControls.push({ label: 'Supplier sends a corrected bill', run: () => actions.simulate(bill, user, { projectOnBill: bill.projectName }, 'corrected bill received from supplier') })
  }

  const tabs = PANEL_TABS.map((t) => ({ ...t, count: t.id === 'compare' && state.aiRunAt ? report.findings.filter((f) => f.severity === 'High').length : 0 }))

  return (
    <div className="drawer-scrim" onClick={onClose}>
      <aside className="drawer drawer-wide" role="dialog" aria-modal="true" aria-labelledby="bill-title" onClick={(e) => e.stopPropagation()}>
        <div className="drawer-head">
          <div>
            <h2 id="bill-title">{bill.vendor} · {bill.billNo}</h2>
            <div className="cell-sub">{bill.category} · {bill.projectName} · billed {formatDate(bill.date)} · {bill.id}</div>
            <div className="drawer-quick">
              Bill <b>{formatINR(bill.amount)}</b>
              {report.expected != null && <> · Agreed × confirmed <b>{formatINR(report.expected)}</b></>}
              {advanceOpen > 0 && !advanceAdjust && <> · Advance to adjust <b>{formatINR(advanceOpen)}</b></>}
              {advanceAdjust > 0 && <> · Net payable <b>{formatINR(netPayable)}</b></>}
              {' '}· <Badge>{stage}</Badge> {held.length > 0 && !state.historic && state.aiRunAt && <Badge tone="danger">Held</Badge>}
            </div>
            <div style={{ marginTop: 6 }}><RecordChips records={records} mandatory={bill.mandatory} onOpen={setTab} /></div>
          </div>
          <button ref={closeRef} className="icon-btn" onClick={onClose} aria-label="Close bill review"><Icon name="x" /></button>
        </div>
        <div className="drawer-tabs"><Tabs tabs={tabs} value={tab} onChange={setTab} label="Bill review sections" /></div>

        <div className="drawer-body">
          {tab === 'bill' && (
            <section>
              <dl className="details">
                <dt>Supplier</dt><dd>{record.supplierOnBill || bill.vendor}</dd>
                <dt>GSTIN</dt><dd>{record.gstin || 'Not shown on bill'}</dd>
                <dt>Bill number / date</dt><dd>{bill.billNo} · {formatDate(bill.date)}</dd>
                <dt>Project on bill</dt><dd>{record.projectOnBill || bill.projectName}</dd>
                <dt>Description</dt><dd>{record.description || bill.category}</dd>
                {record.period && <><dt>Service period</dt><dd>{formatDate(record.period.from)} – {formatDate(record.period.to)}</dd></>}
                {record.equipment && <><dt>Equipment</dt><dd>{record.equipment}</dd></>}
                <dt>Submitted by</dt><dd>{bill.submittedBy}</dd>
                <dt>Document</dt><dd><DocButton name={bill.document} onView={() => setPreview('bill')} /></dd>
              </dl>
              {record.lines ? <><h3 className="drawer-h3">Billed items</h3><LinesTable lines={record.lines} gstRate={record.gstRate || 0} /></> : (
                <p className="cell-sub">This bill has no itemised record in the demo data. Total {formatINR(bill.amount)}.</p>
              )}
            </section>
          )}

          {tab === 'po' && (
            <section>
              {record.po ? (
                <>
                  <dl className="details">
                    <dt>{record.po.type}</dt><dd><b>{record.po.id}</b> · {formatDate(record.po.date)}</dd>
                    <dt>Issued by</dt><dd>{record.po.issuedBy} (Purchase Manager)</dd>
                    <dt>Supplier</dt><dd>{record.po.supplier}</dd>
                    <dt>GSTIN</dt><dd>{record.po.gstin || 'Not GST-registered'}</dd>
                    <dt>Project</dt><dd>{record.po.project}</dd>
                    <dt>Document</dt><dd><DocButton name={record.po.document} onView={() => setPreview('po')} /></dd>
                  </dl>
                  <h3 className="drawer-h3">Agreed items</h3>
                  <LinesTable lines={record.po.lines} gstRate={record.po.gstRate || 0} />
                  <h3 className="drawer-h3">Terms</h3>
                  <ul className="terms">{record.po.terms.map((t) => <li key={t}>{t}</li>)}</ul>
                  <h3 className="drawer-h3">Advance payments against this order</h3>
                  {advances.length ? (
                    <>
                      <DataTable
                        dense
                        rows={advances}
                        columns={[
                          { key: 'date', header: 'Paid on', render: (a) => <><div>{formatDate(a.date)}</div><div className="cell-sub">{a.id}</div></> },
                          { key: 'purpose', header: 'Purpose & reference', render: (a) => <><div>{a.purpose}</div><div className="cell-sub">{a.mode} {a.reference}</div></> },
                          { key: 'amount', header: 'Paid', align: 'num', render: (a) => formatINR(a.amount) },
                          { key: 'adjusted', header: 'Adjusted', align: 'num', render: (a) => (a.adjusted.length ? <><div>{formatINR(a.adjusted.reduce((s, x) => s + x.amount, 0))}</div><div className="cell-sub">{a.adjusted.map((x) => x.billNo).join(', ')}</div></> : '-') },
                          { key: 'balance', header: 'Balance', align: 'num', render: (a) => <b>{formatINR(a.amount - a.adjusted.reduce((s, x) => s + x.amount, 0))}</b> },
                        ]}
                      />
                      <p className="cell-sub" style={{ marginTop: 8 }}>
                        {advanceAdjust ? `${formatINR(advanceAdjust)} is being adjusted against this bill.` : advanceOpen ? `${formatINR(advanceOpen)} still to be adjusted. Deduct it when forwarding this bill.` : 'All advances are adjusted.'}
                      </p>
                    </>
                  ) : <p className="cell-sub">No advance has been paid against this order.</p>}
                  <Link className="btn btn-sm" to="/purchase-orders"><Icon name="cart" />Open Purchase Orders module</Link>
                </>
              ) : (
                <div className="empty sm">
                  No purchase order or agreement is linked to this bill.
                  {bill.mandatory.includes('po') ? ' It is mandatory for this category.' : ' It is not required for this category.'}
                </div>
              )}
            </section>
          )}

          {tab === 'site' && (
            <section>
              {record.site?.status === 'Confirmed' ? (
                <>
                  <dl className="details">
                    <dt>Confirmed by</dt><dd>{record.site.by}{record.site.role ? ` (${record.site.role})` : ''}</dd>
                    <dt>Date</dt><dd>{formatDate(record.site.date)}</dd>
                    <dt>Notes</dt><dd>{record.site.note || '-'}</dd>
                    <dt>Document</dt><dd><DocButton name={record.site.document} onView={() => setPreview('site')} /></dd>
                  </dl>
                  <h3 className="drawer-h3">Confirmed quantities</h3>
                  <DataTable dense rowKey="item" rows={record.site.lines} columns={[
                    { key: 'item', header: 'Item', render: (l) => record.lines?.find((x) => x.item === l.item)?.desc || l.item },
                    { key: 'qty', header: 'Confirmed', align: 'num', render: (l) => `${l.qty} ${l.unit}` },
                  ]} />
                </>
              ) : record.site?.status === 'Pending' ? (
                <div className="next-payment pending">
                  <Icon name="hardhat" size={16} />
                  <span>Waiting for <b>{record.site.requestedFrom}</b> ({record.site.role}) to confirm the actual work. {record.site.note}</span>
                </div>
              ) : (
                <div className="empty sm">{bill.mandatory.includes('site') ? 'No site confirmation recorded. It is mandatory for this category.' : 'Site confirmation is not required for this category.'}</div>
              )}
              <p className="cell-sub" style={{ marginTop: 10 }}>A purchase order alone does not prove the work, delivery or rental happened. Site confirmation does.</p>
              {record.site?.status !== 'Confirmed' && bill.mandatory.includes('site') && canVerify && verifying && (
                <button className="btn btn-sm" onClick={() => { actions.requestDocs(bill, user, 'site confirmation', record.site?.requestedFrom || 'Site Engineer'); say('Demo: request logged. No message was sent.') }}>
                  Request site confirmation
                </button>
              )}
            </section>
          )}

          {tab === 'compare' && (
            <section>
              <div className="info-note warn">
                <Icon name="alert" size={14} />
                <span>
                  <b>Simulated AI comparison.</b> A rule-based demo compares the structured bill, order and site records. No AI model, OCR or real
                  document reading is used. Findings need human review: a difference is not proof of an error or of fraud.
                </span>
              </div>
              {!state.aiRunAt && !state.historic ? (
                <div className="empty sm">
                  <p>Compare the supplier bill with {record.po ? `${record.po.type.toLowerCase()} ${record.po.id}` : 'the purchase order'} and the site record.</p>
                  <button className="btn btn-primary" onClick={runComparison} disabled={running || !canVerify}>
                    {running ? 'Comparing…' : 'Compare with Purchase Order'}
                  </button>
                  {!canVerify && <div style={{ marginTop: 8 }}><LockedNote>View only</LockedNote></div>}
                </div>
              ) : (
                <>
                  <div className={`ai-summary ${report.clean ? 'ok' : 'bad'}`}>
                    <b>{report.summary}</b>
                    {report.difference ? <span> · Bill is {formatINR(Math.abs(report.difference))} {report.difference > 0 ? 'more' : 'less'} than agreed rate × confirmed quantity</span> : null}
                    {state.aiRunAt && <span className="cell-sub"> · run {formatDate(state.aiRunAt.slice(0, 10))}</span>}
                  </div>
                  <DataTable
                    dense
                    rowKey="field"
                    rows={report.rows}
                    emptyText="Nothing to compare: no itemised record."
                    columns={[
                      { key: 'field', header: 'Checked', render: (r) => <span className="wrap-cell">{r.field}</span> },
                      { key: 'bill', header: 'Supplier bill', render: (r) => <span className="wrap-cell">{r.bill}</span> },
                      { key: 'po', header: 'Order / agreement', render: (r) => <span className="wrap-cell">{r.po}</span> },
                      { key: 'site', header: 'Site record', render: (r) => r.site },
                      { key: 'result', header: 'Result', render: (r) => <Badge tone={r.result === 'Match' || r.result === 'Lower' ? 'success' : r.result === 'Differs' ? 'danger' : 'warning'}>{r.result}</Badge> },
                    ]}
                  />
                  <h3 className="drawer-h3">Findings ({report.findings.length})</h3>
                  {report.findings.length ? report.findings.map((f) => (
                    <Finding
                      key={f.id} f={f} note={state.findingNotes?.[f.id]}
                      canExplain={canVerify && verifying}
                      onExplain={(note) => { actions.explainFinding(bill, user, f, note); say('Review note saved on screen (demo).') }}
                    />
                  )) : <div className="empty sm">No differences found between the bill, the order and the site record.</div>}
                </>
              )}
            </section>
          )}

          {tab === 'review' && (
            <section>
              <div className="flow-steps">
                <div className={`flow-step ${state.verification === 'Verified' ? 'done' : 'current'}`}><span>1</span>Verification<b>{state.verification}</b></div>
                <div className={`flow-step ${state.approval === 'Approved' ? 'done' : state.approval !== 'Not submitted' ? 'current' : ''}`}><span>2</span>Approval<b>{state.approval}</b></div>
                <div className={`flow-step ${state.payment === 'Paid' ? 'done' : state.payment !== 'Unpaid' ? 'current' : ''}`}><span>3</span>Payment<b>{state.payment}</b></div>
              </div>

              {held.length > 0 && !state.historic && (
                <div className="next-payment overdue">
                  <Icon name="alert" size={16} />
                  <span><b>Held for review.</b> {held.join(' · ')}</span>
                </div>
              )}

              {/* Accountant verification */}
              {mode === 'accountant' && verifying && (
                <div className="review-block">
                  <h3 className="drawer-h3">Accountant verification</h3>
                  {!canVerify ? <LockedNote>View only</LockedNote> : (
                    <>
                      <label className="check-row">
                        <input type="checkbox" checked={state.checked} onChange={(e) => actions.setChecked(bill, user, e.target.checked)} />
                        I have checked the original supplier bill, the purchase order/agreement and the site confirmation
                      </label>
                      <div className="channel-row">
                        <button className="btn btn-sm" onClick={() => setForm('docs')}>Request missing documents</button>
                        <button className="btn btn-sm" onClick={() => setForm('query')}>Raise query</button>
                        <button className="btn btn-sm" onClick={() => setForm('return')}>Return for correction</button>
                        <button className="btn btn-sm" onClick={() => setForm('note')}>Add note</button>
                        {state.verification === 'Query Raised' && <button className="btn btn-sm" onClick={() => setForm('answer')}>Record answer to query</button>}
                      </div>
                      {form === 'docs' && <ReasonForm label="Request missing documents" placeholder="e.g. hour-meter log for 25 Aug – 1 Sep" submitLabel="Log request" onCancel={() => setForm(null)} onSubmit={(t) => { actions.requestDocs(bill, user, t, 'Site / Purchase / Supplier'); setForm(null); say('Demo: request logged. Nothing was sent.') }} />}
                      {form === 'query' && <ReasonForm label="Raise query" placeholder="e.g. Please explain the 6th day billed; site log shows 5 days" submitLabel="Raise query" onCancel={() => setForm(null)} onSubmit={(t) => { actions.raiseQuery(bill, user, 'Supplier / Purchase Manager / Site Engineer', t); setForm(null); say('Demo: query recorded on screen. No message sent.') }} />}
                      {form === 'answer' && <ReasonForm label="Record answer to query" placeholder="e.g. Supplier agreed: 6th day was demobilisation, not chargeable" submitLabel="Save answer" onCancel={() => setForm(null)} onSubmit={(t) => { actions.resolveQuery(bill, user, t); setForm(null) }} />}
                      {form === 'return' && <ReasonForm label="Return to supplier for correction" placeholder="e.g. Bill names the wrong project; reissue for Palm Grove Villas" submitLabel="Return bill" onCancel={() => setForm(null)} onSubmit={(t) => { actions.returnToSupplier(bill, user, t); setForm(null); say('Demo: bill marked returned on screen. Nothing sent.') }} />}
                      {form === 'note' && <ReasonForm label="Add note" placeholder="Note for the approver" submitLabel="Add note" onCancel={() => setForm(null)} onSubmit={(t) => { actions.addNote(bill, user, t); setForm(null) }} />}

                      <div className="channel-row">
                        <button className="btn btn-primary" disabled={blockers.length > 0} onClick={() => { actions.markVerified(bill, user); say(`Demo: ${bill.billNo} marked verified on screen. It is NOT approved or paid.`) }}>
                          Mark verified
                        </button>
                      </div>
                      {blockers.length > 0 && <ul className="blockers">{blockers.map((x) => <li key={x}>{x}</li>)}</ul>}
                    </>
                  )}
                </div>
              )}

              {mode === 'accountant' && awaitingForward && canVerify && (
                <div className="review-block">
                  <h3 className="drawer-h3">{state.approval === 'Returned' ? 'Returned by approver: respond and forward again' : 'Forward for approval'}</h3>
                  <p className="cell-sub">Approval rule: {rule.label}. Verified by {state.verifiedBy || 'accountant'}; the approver must be someone else.</p>
                  <div className="receipt-grid" style={{ padding: 0 }}>
                    <label className="field">Recommended bill amount (₹)
                      <input type="number" min="1" max={bill.amount} value={forwardAmount || defaultGross} onChange={(e) => setForwardAmount(e.target.value)} />
                    </label>
                    {advanceOpen > 0 && (
                      <label className="field">Less advance to adjust (₹)
                        <input type="number" min="0" max={advanceOpen} value={advanceInput === '' ? advanceOpen : advanceInput} onChange={(e) => setAdvanceInput(e.target.value)} />
                      </label>
                    )}
                  </div>
                  <div className="net-line">
                    <span>Bill amount {formatINR(grossToForward)}</span>
                    {advanceOpen > 0 && <span>− advance {formatINR(advanceToForward)}</span>}
                    <b>= Net payable {formatINR(grossToForward - advanceToForward)}</b>
                  </div>
                  {report.expected && report.expected < bill.amount && <p className="cell-sub">Pre-filled with agreed rate × confirmed quantity ({formatINR(report.expected)}). The bill asks for {formatINR(bill.amount)}.</p>}
                  {form === 'forward' ? (
                    <ReasonForm label="Note for the approver" placeholder="e.g. 6th day disputed; supplier agreed to a credit note" submitLabel="Forward for approval" onCancel={() => setForm(null)}
                      onSubmit={(t) => {
                        actions.forward(bill, user, grossToForward, t, advanceToForward); setForm(null)
                        say(`Demo: forwarded to the approver: ${formatINR(grossToForward)}${advanceToForward ? ` less advance ${formatINR(advanceToForward)} = net ${formatINR(grossToForward - advanceToForward)}` : ''}. Nothing is paid until approved.`)
                      }} />
                  ) : <button className="btn btn-primary" onClick={() => setForm('forward')} disabled={held.length > 0}>Forward for approval</button>}
                  {held.length > 0 && <p className="cell-sub down">Resolve the held items first.</p>}
                </div>
              )}

              {/* Approver */}
              {['Awaiting Approval', 'Awaiting second approval'].includes(state.approval) && (
                <div className="review-block approver">
                  <h3 className="drawer-h3">Approval</h3>
                  <dl className="details">
                    <dt>Bill amount</dt><dd>{formatINR(bill.amount)}</dd>
                    <dt>Agreed × confirmed</dt><dd>{report.expected != null ? formatINR(report.expected) : 'No order to compare'}</dd>
                    <dt>Recommended bill amount</dt><dd>{formatINR(state.recommendedAmount ?? bill.amount)}</dd>
                    <dt>Less advance adjusted</dt><dd>{advanceAdjust ? `${formatINR(advanceAdjust)} (paid against ${record.po?.id})` : 'None'}</dd>
                    <dt>Net payable</dt><dd><b>{formatINR((state.recommendedAmount ?? bill.amount) - advanceAdjust)}</b></dd>
                    <dt>Verified by</dt><dd>{state.verifiedBy || '-'}</dd>
                    <dt>AI findings</dt><dd>{report.findings.filter((f) => f.severity === 'High').length} needing review · {Object.keys(state.findingNotes || {}).length} reviewed by accountant</dd>
                    <dt>Approval rule</dt><dd>{rule.label}</dd>
                  </dl>
                  {state.approval === 'Awaiting second approval' ? (
                    <LockedNote>Awaiting Director approval (not available in this demo)</LockedNote>
                  ) : approval.ok ? (
                    <>
                      <div className="channel-row">
                        <button className="btn btn-primary" onClick={() => { actions.approve(bill, user, rule); say(`Demo: ${bill.billNo} approved for ${formatINR(state.recommendedAmount ?? bill.amount)}${advanceAdjust ? ` (net ${formatINR((state.recommendedAmount ?? bill.amount) - advanceAdjust)} after advance)` : ''} on screen only. Not paid yet.`) }}>Approve</button>
                        <button className="btn" onClick={() => setForm('reject')}>Reject</button>
                        <button className="btn" onClick={() => setForm('clarify')}>Return for clarification</button>
                      </div>
                      {form === 'reject' && <ReasonForm tone="btn-primary" label="Reject bill" placeholder="Reason for rejection" submitLabel="Reject" onCancel={() => setForm(null)} onSubmit={(t) => { actions.reject(bill, user, t); setForm(null); say(`Demo: ${bill.billNo} rejected on screen only. Nothing was sent.`) }} />}
                      {form === 'clarify' && <ReasonForm label="Return for clarification" placeholder="What should the accountant clarify?" submitLabel="Return" onCancel={() => setForm(null)} onSubmit={(t) => { actions.returnForClarification(bill, user, t); setForm(null); say(`Demo: ${bill.billNo} returned to Accounts for clarification (on screen only).`) }} />}
                    </>
                  ) : <LockedNote>{approval.reason}</LockedNote>}
                </div>
              )}

              {/* Payment */}
              <div className="review-block">
                <h3 className="drawer-h3">Payment</h3>
                {state.approval !== 'Approved' ? (
                  <LockedNote>Payment can be recorded only after approval. Verification alone does not allow payment.</LockedNote>
                ) : (
                  <>
                    <p className="cell-sub">
                      Approved {formatINR(approvedAmount)}{advanceAdjust ? ` − advance ${formatINR(advanceAdjust)} = net ${formatINR(netPayable)}` : ''} · paid {formatINR(state.paidAmount)} · balance {formatINR(balanceToPay)}
                      {approvedAmount < bill.amount ? ` (bill ${formatINR(bill.amount)}; the difference is not approved)` : ''}
                    </p>
                    {state.payments.length > 0 && (
                      <ul className="list">{state.payments.map((p, i) => <li key={i}><Icon name="wallet" size={14} /><div><div className="t">{formatINR(p.amount)} · {p.mode} {p.reference}</div><div className="s">{formatDate(p.date)} · {p.by}</div></div></li>)}</ul>
                    )}
                    {balanceToPay > 0 && (canPay ? (
                      payForm ? (
                        <form className="receipt-form" onSubmit={(e) => {
                          e.preventDefault()
                          const amt = Number(payForm.amount)
                          if (!(amt > 0) || amt > balanceToPay || !payForm.reference.trim()) return
                          actions.recordPayment(bill, user, { date: payForm.date, amount: amt, mode: payForm.mode, reference: payForm.reference.trim() })
                          setPayForm(null); say(`Demo: payment of ${formatINR(amt)} recorded on screen only. No money moved.`)
                        }}>
                          <div className="sub-panel-head"><b>Record payment</b><span className="cell-sub">Payment team</span></div>
                          <div className="receipt-grid">
                            <label className="field">Amount (₹)<input type="number" min="1" max={balanceToPay} value={payForm.amount} onChange={(e) => setPayForm({ ...payForm, amount: e.target.value })} /></label>
                            <label className="field">Date<input type="date" max={todayISO()} value={payForm.date} onChange={(e) => setPayForm({ ...payForm, date: e.target.value })} /></label>
                            <label className="field">Mode<select value={payForm.mode} onChange={(e) => setPayForm({ ...payForm, mode: e.target.value })}>{['NEFT', 'RTGS', 'Cheque', 'UPI'].map((m) => <option key={m}>{m}</option>)}</select></label>
                            <label className="field">Payment reference<input value={payForm.reference} onChange={(e) => setPayForm({ ...payForm, reference: e.target.value })} placeholder="UTR / cheque no." /></label>
                          </div>
                          <div className="jv-submit">
                            <button className="btn btn-primary" type="submit" disabled={!(Number(payForm.amount) > 0) || Number(payForm.amount) > balanceToPay || !payForm.reference.trim()}>Save payment</button>
                            <button className="btn" type="button" onClick={() => setPayForm(null)}>Cancel</button>
                          </div>
                        </form>
                      ) : <button className="btn btn-primary" onClick={() => setPayForm({ amount: String(balanceToPay), date: todayISO(), mode: 'NEFT', reference: '' })}>Record payment</button>
                    ) : <LockedNote>Payment team only</LockedNote>)}
                  </>
                )}
              </div>

              {demoControls.length > 0 && (
                <div className="review-block demo-controls">
                  <h3 className="drawer-h3">Demo controls (simulated events)</h3>
                  <p className="cell-sub">Stand-ins for actions by other people, so the walkthrough can continue. They do not represent real documents.</p>
                  <div className="channel-row">{demoControls.map((c) => <button key={c.label} className="btn btn-sm" onClick={() => { c.run(); say(`Simulated: ${c.label}. Run the comparison again.`) }}>{c.label}</button>)}</div>
                </div>
              )}

              <h3 className="drawer-h3">Timeline & notes</h3>
              {state.events.length ? (
                <ul className="list">
                  {[...state.events].reverse().map((e, i) => (
                    <li key={i}><Icon name="check" size={14} /><div><div className="t">{e.action}</div>{e.note && <div className="s">{e.note}</div>}<div className="s">{formatDate(e.at)} · {e.by}</div></div></li>
                  ))}
                </ul>
              ) : <div className="cell-sub">{state.historic ? 'Verified and paid before this workflow was introduced.' : 'No actions yet.'}</div>}
            </section>
          )}
        </div>

        <div className="drawer-foot">
          <span className="cell-sub">Demo: actions change status on screen only. Nothing is sent, saved, approved or paid.</span>
          {mode === 'accountant'
            ? <Link className="btn btn-sm" to="/approvals/bills">Bill approvals ›</Link>
            : <Link className="btn btn-sm" to="/accounts/expenses">Expenses & Bills ›</Link>}
        </div>
      </aside>
      {preview && <DocumentPreview kind={preview} bill={b} onClose={() => setPreview(null)} />}
    </div>
  )
}
