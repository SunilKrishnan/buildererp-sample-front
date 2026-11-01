import { createContext, useCallback, useContext, useMemo, useState } from 'react'
import { recordBillAction } from '../../services/billReviewService.js'
import { todayISO } from '../../utils/date.js'

/**
 * Supplier bill workflow state for this browser session (DEMO: never saved).
 * Verification, approval and payment are kept as three separate fields:
 *   verification: Pending Verification | Query Raised | Returned to supplier | Verified
 *   approval:     Not submitted | Awaiting Approval | Approved | Rejected | Returned
 *   payment:      Unpaid | Partially Paid | Paid
 * Lives at app level so the Accountant and the approver see the same bills.
 */
const BillWorkflowContext = createContext(null)

/** Starting state from the demo record (bills verified before this workflow are treated as approved). */
export function initialBillState(bill) {
  const verified = bill.verification === 'Verified'
  return {
    verification: bill.verification || 'Pending Verification',
    approval: verified ? 'Approved' : 'Not submitted',
    payment: bill.paidOn ? 'Paid' : 'Unpaid',
    paidAmount: bill.paidOn ? bill.amount : 0,
    approvedAmount: verified ? bill.amount : null,
    historic: verified,
    checked: false,
    aiRunAt: null,
    findingNotes: {},
    events: [],
    payments: bill.paidOn ? [{ date: bill.paidOn, amount: bill.amount, mode: 'NEFT', reference: 'Recorded before this workflow', by: 'Accounts' }] : [],
  }
}

/** One label combining the three fields, for lists and filters. */
export function stageOf(s) {
  if (s.payment === 'Paid') return 'Paid'
  if (s.payment === 'Partially Paid') return 'Partially Paid'
  if (s.approval === 'Approved') return 'Approved'
  if (s.approval === 'Awaiting Approval') return 'Awaiting Approval'
  if (s.approval === 'Awaiting second approval') return 'Awaiting second approval'
  if (s.approval === 'Rejected') return 'Rejected'
  if (s.approval === 'Returned') return 'Returned by approver'
  if (s.verification === 'Returned to supplier') return 'Returned to supplier'
  return s.verification
}

export const BILL_STAGES = ['All', 'Pending Verification', 'Query Raised', 'Returned', 'Verified', 'Awaiting Approval', 'Approved', 'Rejected', 'Partially Paid', 'Paid']
export const stageMatches = (stage, filter) => filter === 'All' || stage === filter || (filter === 'Returned' && stage.startsWith('Returned'))

/** Expense ledger for a bill (mirrors the demo books' mapping). */
const ledgerFor = (bill) =>
  bill.projectStatus === 'Completed' ? '4104'
    : ['Cement', 'Steel'].includes(bill.category) ? '1301'
      : ['Equipment Hire', 'Fuel'].includes(bill.category) ? '1305' : '1304'

export function BillWorkflowProvider({ children }) {
  const [overrides, setOverrides] = useState({}) // billId → partial state
  const [journals, setJournals] = useState([]) // postings created by approvals and payments (demo)

  const stateOf = useCallback((bill) => ({ ...initialBillState(bill), ...(overrides[bill.id] || {}) }), [overrides])

  const update = useCallback((bill, patch, event) => {
    recordBillAction(bill.id, event?.action, patch)
    setOverrides((all) => {
      const current = { ...initialBillState(bill), ...(all[bill.id] || {}) }
      const next = typeof patch === 'function' ? patch(current) : patch
      const events = event ? [...current.events, { at: todayISO(), ...event }] : current.events
      return { ...all, [bill.id]: { ...(all[bill.id] || {}), ...next, events } }
    })
  }, [])

  const postJournal = useCallback((entry) => {
    setJournals((js) => [...js, { id: `JE-BILL-${js.length + 1}`, origin: 'System', status: 'Posted', ref: '-', ...entry, amount: entry.lines.reduce((s, l) => s + (l.dr || 0), 0) }])
  }, [])

  const actions = useMemo(() => ({
    // DEMO ONLY: stand-in for another person's action (site confirms, supplier sends a corrected bill)
    simulate: (bill, user, recordPatch, label) =>
      update(bill, (s) => ({ recordPatch: { ...(s.recordPatch || {}), ...recordPatch, site: recordPatch.site ? { ...(s.recordPatch?.site || {}), ...recordPatch.site } : s.recordPatch?.site }, aiRunAt: null, checked: false, verification: s.verification === 'Returned to supplier' ? 'Pending Verification' : s.verification }),
        { action: `Simulated: ${label}`, by: 'Demo', note: 'Simulated event for the walkthrough; no real document was received' }),
    runCheck: (bill, user) => update(bill, { aiRunAt: new Date().toISOString() }, { action: 'Ran simulated AI comparison', by: user.name }),
    addNote: (bill, user, text) => update(bill, {}, { action: 'Note', note: text, by: user.name }),
    explainFinding: (bill, user, finding, note) =>
      update(bill, (s) => ({ findingNotes: { ...s.findingNotes, [finding.id]: { note, by: user.name } } }), { action: `Reviewed finding: ${finding.title}`, note, by: user.name }),
    setChecked: (bill, user, checked) => update(bill, { checked }, { action: checked ? 'Confirmed all records checked' : 'Un-confirmed records check', by: user.name }),
    requestDocs: (bill, user, what, to) => update(bill, {}, { action: `Requested ${what} from ${to}`, by: user.name, note: 'Demo: no message sent' }),
    raiseQuery: (bill, user, to, text) => update(bill, { verification: 'Query Raised' }, { action: `Query raised with ${to}`, note: text, by: user.name }),
    resolveQuery: (bill, user, text) => update(bill, { verification: 'Pending Verification' }, { action: 'Query answered', note: text, by: user.name }),
    returnToSupplier: (bill, user, reason) => update(bill, { verification: 'Returned to supplier', checked: false }, { action: 'Returned to supplier for correction', note: reason, by: user.name }),
    markVerified: (bill, user) => update(bill, { verification: 'Verified', verifiedBy: user.name }, { action: 'Verified', by: user.name }),
    forward: (bill, user, amount, reason, advance = 0) =>
      update(bill, { approval: 'Awaiting Approval', approvedAmount: null, recommendedAmount: amount, advanceAdjust: advance, forwardedBy: user.name },
        { action: `Forwarded for approval (recommended ${amount.toLocaleString('en-IN')}${advance ? `, less advance ${advance.toLocaleString('en-IN')}` : ''})`, note: reason, by: user.name }),
    approve: (bill, user, rule) => {
      const needsSecond = rule.approvers.length > 1
      update(bill, (s) => ({ approval: needsSecond ? 'Awaiting second approval' : 'Approved', approvedAmount: s.recommendedAmount ?? bill.amount, approvedBy: user.name }),
        { action: needsSecond ? 'First approval given' : 'Approved', by: user.name })
      if (!needsSecond) {
        const s = stateOf(bill)
        const gross = s.recommendedAmount ?? bill.amount
        postJournal({
          date: todayISO(), source: 'Expense bill (approved)', ref: bill.billNo, createdBy: user.name,
          narration: `${bill.vendor} · ${bill.billNo} (${bill.category}) approved`,
          lines: [{ account: ledgerFor(bill), dr: gross }, { account: '2104', cr: gross }],
        })
        if (s.advanceAdjust) {
          postJournal({
            date: todayISO(), source: 'Advance adjustment', ref: bill.billNo, createdBy: user.name,
            narration: `Advance adjusted against ${bill.vendor} · ${bill.billNo}`,
            lines: [{ account: '2104', dr: s.advanceAdjust }, { account: '1203', cr: s.advanceAdjust }],
          })
        }
      }
    },
    reject: (bill, user, reason) => update(bill, { approval: 'Rejected' }, { action: 'Rejected', note: reason, by: user.name }),
    returnForClarification: (bill, user, reason) => update(bill, { approval: 'Returned' }, { action: 'Returned for clarification', note: reason, by: user.name }),
    recordPayment: (bill, user, p) => {
      update(bill, (s) => {
        const paidAmount = s.paidAmount + p.amount
        const due = (s.approvedAmount ?? bill.amount) - (s.advanceAdjust || 0)
        return { paidAmount, payment: paidAmount >= due ? 'Paid' : 'Partially Paid', payments: [...s.payments, { ...p, by: user.name }] }
      }, { action: `Payment recorded: ${p.mode} ${p.reference || ''}`.trim(), note: `₹${p.amount.toLocaleString('en-IN')} on ${p.date}`, by: user.name })
      postJournal({
        date: p.date, source: 'Payment', ref: p.reference || '-', createdBy: user.name,
        narration: `Paid ${bill.vendor} · ${bill.billNo} · ${p.mode} ${p.reference || ''}`.trim(),
        lines: [{ account: '2104', dr: p.amount }, { account: p.mode === 'Cash' ? '1103' : '1102', cr: p.amount }],
      })
    },
  }), [update, postJournal, stateOf])

  const value = useMemo(() => ({ stateOf, actions, journals }), [stateOf, actions, journals])
  return <BillWorkflowContext.Provider value={value}>{children}</BillWorkflowContext.Provider>
}

export function useBillWorkflow() {
  const ctx = useContext(BillWorkflowContext)
  if (!ctx) throw new Error('useBillWorkflow must be used inside <BillWorkflowProvider>')
  return ctx
}
