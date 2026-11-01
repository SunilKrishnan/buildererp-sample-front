import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, Navigate, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import Icon from '../../components/Icon.jsx'
import DashboardFilters from '../../components/DashboardFilters.jsx'
import DataTable from '../../components/DataTable.jsx'
import { Badge, Card, Chips, PageHead } from '../../components/UI.jsx'
import { DemoTag, EmptyState, ErrorState, LoadingState } from '../../components/StateViews.jsx'
import CompletedProjectNote from '../../components/CompletedProjectNote.jsx'
import { useDemoSession } from '../../auth/DemoSession.jsx'
import { can, DEMO_USERS, PERMISSIONS as P, ROLES } from '../../auth/demoRoles.js'
import { ACCOUNTS_SECTIONS, accountsPath, dashboardsForRole } from '../../config/navigation.js'
import { getProjectOptions } from '../../services/dashboardService.js'
import { recordAccountingAction } from '../../services/accountantService.js'
import { diffDays, resolveDateRange, todayISO } from '../../utils/date.js'
import { formatDate, formatINR } from '../../utils/format.js'
import { applyActivity, matchToStatement, nextReceiptNo, receiptJournal, receiptPrefixFor } from '../../services/customerLedger.js'
import { useAccountantDashboard } from './useAccountantDashboard.js'
import { stageOf, useBillWorkflow } from '../bill-review/BillWorkflowContext.jsx'
import { holdReasons, reportFor } from '../bill-review/billRules.js'
import { useBillReviews } from '../bill-review/useBillReviews.js'
import BillReviewPanel from '../bill-review/BillReviewPanel.jsx'
import { matchesSearch } from './shared.jsx'
import { useInventory } from '../store-keeper/InventoryContext.jsx'
import ProjectPurchaseCost from './ProjectPurchaseCost.jsx'
import { supplierAccountsOf, supplierBillsView } from '../../services/demoAccountantAdapter.js'
import { actorOf, invoiceablePOs } from '../../services/procurement.js'

import FinancialSummary from './FinancialSummary.jsx'
import ReceiptsSection, { RECEIPT_VIEWS, receivableColumns } from './ReceiptsSection.jsx'
import ExpensesSection, { EXPENSE_STATUSES } from './ExpensesSection.jsx'
import SupplierPayments, { SUPPLIER_STATUSES } from './SupplierPayments.jsx'
import PayrollSection, { PAYROLL_STATUSES } from './PayrollSection.jsx'
import FinanceApprovals from './FinanceApprovals.jsx'
import PermissionSummary from './PermissionSummary.jsx'
import FinancialReports, { BudgetHeadsChart, CashflowChart, REPORT_VIEWS } from './FinancialReports.jsx'
import ContractorBills, { CONTRACTOR_STATUSES } from './ContractorBills.jsx'
import EmployeePayroll from './EmployeePayroll.jsx'
import BankCash from './BankCash.jsx'
import BankReconciliation from './BankReconciliation.jsx'
import JournalEntries, { BOOK_VIEWS } from './JournalEntries.jsx'
import TaxCompliance, { TAX_STATUSES } from './TaxCompliance.jsx'
import WorkQueue, { buildWorkQueue } from './WorkQueue.jsx'
import CustomerAccount from './CustomerAccount.jsx'

const TAB_IDS = ['overview', ...ACCOUNTS_SECTIONS.map((s) => s.id)]
const PAGE_HEAD = {
  overview: ['Accountant Dashboard', "today's work, cash position and dues"],
  receipts: ['Income & Receipts', 'money received from home buyers and instalments due'],
  expenses: ['Expenses & Bills', 'site and office bills awaiting verification and payment'],
  suppliers: ['Supplier Payments', 'invoices matched to POs and deliveries, amounts payable and supplier accounts'],
  contractors: ['Contractor Bills', 'work bills, advances, retention and contractor accounts'],
  salaries: ['Employee Payroll', 'staff salaries, incentives and deductions'],
  payroll: ['Labour Payroll', 'daily wages from verified attendance and labour advances'],
  bank: ['Bank & Cash', 'bank balances and cash transactions (company-wide)'],
  reconciliation: ['Bank Reconciliation', 'match ERP transactions with bank statements'],
  journals: ['Journal Entries', 'adjustments, general ledger and trial balance (company-wide)'],
  tax: ['Tax & Compliance', 'GST, TDS and statutory due dates (demo configuration)'],
  approvals: ['Financial Approvals', 'requests awaiting an authorised decision'],
  reports: ['Financial Reports', 'project costs, registers, ledgers, outstanding and cash flow'],
}
// Filters carried across Accounts pages when navigating from within the page
const SHARED_PARAMS = ['project', 'range', 'from', 'to', 'q', 'as']
const sharedSearch = (params, extra = {}) => {
  const next = new URLSearchParams()
  SHARED_PARAMS.forEach((k) => params.get(k) && next.set(k, params.get(k)))
  Object.entries(extra).forEach(([k, v]) => v && next.set(k, v))
  return next.toString()
}
// Status filter options per tab; the first entry is the default.
const STATUS_OPTIONS = {
  receipts: RECEIPT_VIEWS, expenses: EXPENSE_STATUSES, suppliers: SUPPLIER_STATUSES, contractors: CONTRACTOR_STATUSES,
  payroll: PAYROLL_STATUSES, journals: BOOK_VIEWS, tax: TAX_STATUSES, reports: REPORT_VIEWS,
}

// Which field holds the status for each kind of record that can be acted on.
const STATUS_FIELD = {
  expense: 'verification', supplier: 'paymentStatus', payroll: 'status', contractor: 'status', approval: 'status',
  salary: 'status', recon: 'status', journal: 'status', tax: 'status',
}

export default function AccountantDashboard({ search = '', notify }) {
  const { user: sessionUser, role: sessionRole } = useDemoSession()
  const [params, setParams] = useSearchParams()
  const location = useLocation()
  const navigate = useNavigate()
  // Section comes from the path: /dashboards/accountant (overview) or /accounts/:section
  const pathSection = location.pathname.match(/^\/accounts\/([^/]+)/)?.[1]
  // This page shows actions as an Accountant would see them. An Admin may switch to
  // their own permissions (?as=admin); an Accountant can never switch up. Demo only.
  const canViewAsAdmin = sessionRole.id === 'admin'
  const viewAs = canViewAsAdmin && params.get('as') === 'admin' ? 'admin' : 'accountant'
  const role = ROLES[viewAs]
  const user = viewAs === sessionRole.id ? sessionUser : DEMO_USERS[viewAs]
  const tab = pathSection && TAB_IDS.includes(pathSection) ? pathSection : 'overview'
  const projectId = params.get('project') || 'all'
  const [projectOptions, setProjectOptions] = useState([])
  useEffect(() => { getProjectOptions().then(setProjectOptions).catch(() => setProjectOptions([])) }, [])
  const selectedProject = projectOptions.find((p) => p.id === projectId)
  // Completed projects default to all time: their records are mostly older than 30 days
  const range = params.get('range') || (selectedProject?.status === 'Completed' ? 'all' : '30d')
  const rawFrom = params.get('from')
  const rawTo = params.get('to')
  const q = params.get('q') || ''
  const statusOptions = STATUS_OPTIONS[tab]
  const status = statusOptions?.includes(params.get('status')) ? params.get('status') : statusOptions?.[0]
  const preview = params.get('preview') // UI review only: loading | error | empty
  const customerId = params.get('customer') // customer account panel (booking id)
  const customerTab = params.get('ctab') || 'summary'
  const billId = params.get('bill') // bill review panel
  const billTab = params.get('btab') || 'bill'

  const resolved = useMemo(() => resolveDateRange(range, rawFrom, rawTo), [range, rawFrom, rawTo])
  const filters = useMemo(() => ({ projectId, ...resolved }), [projectId, resolved])
  const { status: loadStatus, data, error, reload } = useAccountantDashboard(filters, preview)


  // On-screen-only status changes (demo). Keyed by `${kind}:${id}`; reset on reload.
  const [overrides, setOverrides] = useState({})
  // Shared purchase records (POs, GRNs, supplier invoices, payments): same data as the Store Keeper,
  // Purchase Manager and Admin pages. Supplier invoices are read live from here.
  const inv = useInventory()
  // Supplier bill workflow (shared with the Bill Approvals page)
  const billReviews = useBillReviews()
  const { stateOf: billStateOf, journals: billJournals } = useBillWorkflow()
  // Customer receipts recorded and reminders logged this session (demo; never saved)
  const [activity, setActivity] = useState([])
  const [reminders, setReminders] = useState([])
  const [creditState, setCreditState] = useState({}) // statement credit id → 'cleared' (simulated bank update)
  // Journals drafted on screen this session (demo; never saved)
  const [localJournals, setLocalJournals] = useState([])
  const [qDraft, setQDraft] = useState(q)
  useEffect(() => setQDraft(q), [q])

  const updateParams = useCallback(
    (patch, { replace = true } = {}) => {
      const next = new URLSearchParams(params)
      Object.entries(patch).forEach(([k, v]) => (v == null || v === '' ? next.delete(k) : next.set(k, v)))
      setParams(next, { replace })
    },
    [params, setParams]
  )

  // Debounce the search box into the URL
  // (kept untrimmed so typing a space isn't undone; matching trims the terms)
  useEffect(() => {
    const nextQ = qDraft.trim() ? qDraft : ''
    if (nextQ === q) return undefined
    const t = setTimeout(() => updateParams({ q: nextQ || null }), 250)
    return () => clearTimeout(t)
  }, [qDraft, q, updateParams])

  const openTab = useCallback(
    (id, extra = {}) => {
      navigate({ pathname: accountsPath(id), search: sharedSearch(params, { status: extra.status }) })
      window.scrollTo({ top: 0 })
    },
    [params, navigate]
  )

  const perms = {
    canVerifyBills: can(role.id, P.EXPENSE_VERIFY),
    canSchedule: can(role.id, P.SUPPLIER_SCHEDULE),
    canVerifyPayroll: can(role.id, P.PAYROLL_VERIFY),
    canApprovePayroll: can(role.id, P.PAYROLL_APPROVE),
    canPrepareSalary: can(role.id, P.SALARY_PREPARE),
    canApproveSalary: can(role.id, P.SALARY_APPROVE),
    canReconcile: can(role.id, P.BANK_RECONCILE),
    canCreateJournal: can(role.id, P.JOURNAL_CREATE),
    canPostJournal: can(role.id, P.JOURNAL_POST),
    canPrepareTax: can(role.id, P.TAX_PREPARE),
    canRecordReceipt: can(role.id, P.RECEIPT_RECORD),
    canReverseReceipt: can(role.id, P.RECEIPT_REVERSE),
    canRemind: can(role.id, P.REMINDER_SEND),
    canApproveBills: can(role.id, P.BILL_APPROVE),
    canRecordPayment: can(role.id, P.PAYMENT_RECORD),
  }

  // Customer accounts with this session's receipts applied (allocation to instalments, balance)
  const today = todayISO()
  const customersLive = useMemo(
    () => (data ? Object.fromEntries(Object.entries(data.customers).map(([id, acc]) => [id, applyActivity(acc, activity, today)])) : {}),
    [data, activity, today]
  )

  // Apply on-screen overrides and the search terms (topbar search + dashboard search).
  const suppliersLive = useMemo(
    () => (data ? supplierBillsView(inv.supplierBills, { projectId, from: data.meta.filters.from, to: data.meta.filters.to }) : null),
    [data, inv.supplierBills, projectId]
  )
  const view = useMemo(() => {
    if (!data) return null
    const { from: rangeFrom, to: rangeTo } = data.meta.filters
    const inScope = (r) => projectId === 'all' || r.projectId === projectId
    // Verified receipts recorded this session join the receipts list
    const sessionReceipts = activity
      .filter((r) => r.status === 'Verified' && inScope(r) && r.date >= rangeFrom && r.date <= rangeTo)
      .map((r) => ({
        id: r.receiptNo, bookingId: r.bookingId, unit: r.unit, date: r.date, projectId: r.projectId, projectName: r.projectName,
        customer: r.customer, milestone: 'Customer payment (recorded)', amount: r.amount, method: r.method,
      }))
    // Instalments paid or part-paid this session leave or shrink the outstanding list
    const liveRow = (bookingId, rowId) => customersLive[bookingId]?.schedule.find((x) => x.id === rowId)
    const receivablesLive = data.receivables
      .map((r) => {
        const row = liveRow(r.bookingId, r.id)
        if (!row || row.status === r.status) return r
        if (row.status === 'Received') return null
        return { ...r, amount: row.amount - (row.paidNow || 0), status: row.date < today ? 'Overdue' : 'Due', partPaid: true }
      })
      .filter(Boolean)
    const scheduleLive = Object.values(customersLive)
      .filter(inScope)
      .flatMap((c) => c.schedule.filter((x) => x.status !== 'Received').map((x) => ({
        ...x, scheduleId: x.id, id: `${c.bookingId}:${x.id}`, bookingId: c.bookingId, customer: c.customer, unit: c.unit,
        projectId: c.projectId, projectName: c.projectName, amount: x.amount - (x.paidNow || 0),
        daysToDue: diffDays(today, x.date),
      })))
      .sort((a, b) => a.date.localeCompare(b.date) || a.customer.localeCompare(b.customer))
    const terms = [search, q].map((t) => t.trim().toLowerCase()).filter(Boolean)
    const apply = (kind, rows) =>
      rows.map((r) => {
        const o = overrides[`${kind}:${r.id}`]
        return o === undefined ? r : { ...r, [STATUS_FIELD[kind]]: o, changed: true }
      })
    const find = (rows, fields) => rows.filter((r) => matchesSearch(r, fields, terms))
    const approvals = data.approvals.map((a) => {
      const decided = overrides[`approval:${a.id}`]
      return { ...a, status: decided || a.status, verified: !!overrides[`approval-verify:${a.id}`] }
    })
    const contractorBills = apply('contractor', data.contractors.bills)
    const salaryRuns = apply('salary', data.employeePayroll.runs).map((r) => ({ ...r, ...(overrides[`salary-meta:${r.id}`] || {}) }))
    const reconItems = apply('recon', data.bank.reconItems)
    const journals = apply('journal', [...data.books.journals, ...localJournals, ...billJournals, ...inv.state.procurementJournals])
    // Bills with their order/site records, comparison report and workflow stage
    const allReviewBills = billReviews.data?.bills || []
    const reviewById = Object.fromEntries(allReviewBills.map((b) => [b.id, b]))
    const enrichBill = (b) => {
      const rb = reviewById[b.id] || { ...b, record: null, mandatory: ['bill'] }
      const s = billStateOf(rb)
      const rec = reportFor(rb, s, allReviewBills)
      return { ...b, record: rb.record, mandatory: rb.mandatory, projectStatus: rb.projectStatus, s, rec, stage: stageOf(s), held: holdReasons(rec.report, s), verification: s.verification }
    }
    const expenseBillsLive = data.expenseBills.map(enrichBill)
    const billsInApproval = allReviewBills.map(enrichBill).filter((b) => !b.s.historic && b.s.approval !== 'Not submitted')
    const taxFilings = apply('tax', data.tax.filings)
    return {
      receipts: find([...sessionReceipts, ...data.receipts], ['id', 'customer', 'unit', 'projectName', 'method', 'milestone']),
      receivables: find(receivablesLive, ['id', 'customer', 'unit', 'projectName', 'milestone']),
      paymentSchedule: find(scheduleLive, ['customer', 'unit', 'projectName', 'milestone']),
      expenseBills: find(expenseBillsLive, ['id', 'billNo', 'vendor', 'category', 'projectName', 'submittedBy']),
      billsInApproval,
      supplierBills: find(suppliersLive.inView, ['id', 'invoiceNo', 'supplier', 'poId', 'grnId', 'material', 'projectName']),
      supplierAccounts: supplierAccountsOf(suppliersLive.all),
      payroll: {
        ...data.payroll,
        batches: find(apply('payroll', data.payroll.batches), ['id', 'projectName']),
        contractorBills: find(apply('contractor', data.payroll.contractorBills), ['id', 'billNo', 'contractor', 'work', 'projectName']),
        advances: find(data.payroll.advances, ['id', 'labourer', 'projectName']),
      },
      contractorBills: find(contractorBills, ['id', 'billNo', 'contractor', 'work', 'woNo', 'projectName']),
      salaryRuns,
      bankTxns: find(
        data.bank.txns.map((t) => (overrides[`recon:${t.id}`] ? { ...t, recon: overrides[`recon:${t.id}`] } : t)),
        ['party', 'desc', 'ref', 'method', 'accountName'],
      ),
      reconItems: find(reconItems, ['party', 'desc', 'ref']),
      journals,
      taxFilings,
      approvals: find(approvals, ['id', 'type', 'title', 'requestedBy', 'projectName']),
      allApprovals: approvals,
      // Unsearched lists for the work queue, so a search never hides a task
      work: {
        expenseBills: expenseBillsLive,
        billsInApproval,
        supplierBills: suppliersLive.inView,
        batches: apply('payroll', data.payroll.batches),
        contractorBills,
        receivables: receivablesLive,
        paymentSchedule: scheduleLive,
        activity,
        approvals,
        salaryRuns,
        reconItems,
        taxFilings,
        journals,
      },
    }
  }, [data, overrides, localJournals, search, q, activity, customersLive, projectId, today, billReviews.data, billStateOf, billJournals, suppliersLive, inv.state.procurementJournals])

  const pendingCount = view ? view.allApprovals.filter((a) => a.status === 'Pending').length : 0

  const setOverride = (key, value) =>
    setOverrides((o) => {
      const next = { ...o }
      if (value == null) delete next[key]
      else next[key] = value
      return next
    })

  const act = async (kind, row, nextStatus, message) => {
    await recordAccountingAction(kind, row.id, nextStatus)
    setOverride(`${kind}:${row.id}`, nextStatus)
    notify?.(message)
  }
  const undo = async (kind, row) => {
    await recordAccountingAction(kind, row.id, 'undo')
    setOverride(`${kind}:${row.id}`, null)
    if (kind === 'salary') setOverride(`salary-meta:${row.id}`, null)
    notify?.(`${row.id} restored to its original demo status`)
  }
  const decide = async (item, decision) => {
    await recordAccountingAction('approval', item.id, decision)
    setOverride(`approval:${item.id}`, decision === 'Pending' ? null : decision)
    notify?.(
      decision === 'Pending'
        ? `${item.id} moved back to pending (demo)`
        : `Demo: ${item.id} marked ${decision.toLowerCase()} on screen only. No real transaction.`
    )
  }
  const verifyApproval = async (item, verified) => {
    await recordAccountingAction('approval', item.id, verified ? 'verify' : 'unverify')
    setOverride(`approval-verify:${item.id}`, verified || null)
    notify?.(verified ? `Demo: ${item.id} verified and shown as forwarded to the approver. Nothing sent.` : `${item.id} verification undone (demo)`)
  }
  /** Supplier invoice workflow step on the shared records (checked again there; returns { ok, message } or { error }). */
  const supplierWorkflow = (name, args) => {
    const r = inv.actions[name](args, actorOf(user, role))
    if (r.ok) notify?.(`Demo: ${r.message}. Shown on every dashboard for this session; nothing is saved.`)
    return r
  }
  const createJournal = ({ date, narration, lines }) => {
    const amount = lines.reduce((s, l) => s + (l.dr || 0), 0)
    setLocalJournals((js) => [
      ...js,
      { id: `JV-NEW-${js.length + 1}`, date, narration, lines, amount, source: 'Manual journal', ref: '-', origin: 'Manual', status: 'Draft', createdBy: user.name },
    ])
    notify?.('Demo: draft journal added on screen only. Submit it for approval; nothing is saved.')
  }
  const openBill = (id, tab) => updateParams({ bill: id, btab: tab && tab !== 'bill' ? tab : null }, { replace: false })
  const closeBill = useCallback(() => updateParams({ bill: null, btab: null }), [updateParams])
  const openCustomer = (bookingId, tab) => updateParams({ customer: bookingId, ctab: tab && tab !== 'summary' ? tab : null }, { replace: false })
  const closeCustomer = useCallback(() => updateParams({ customer: null, ctab: null }), [updateParams])

  // ----- Customer receipts: record → verify with bank → receipt number (demo, session only) -----
  const bankAccountFor = (acc) => data?.bank.accounts.find((b) => b.kind === 'Bank' && b.projectId === acc.projectId && b.id.startsWith('BA-RERA'))
  const statementCredits = () =>
    (data?.statementCredits || []).map((c) => (creditState[c.id] === 'cleared' ? { ...c, recon: 'Bank only', statementAmount: c.amount, meta: { ...c.meta, clearing: false } } : c))
  const usedCreditIds = (exceptId) => activity.filter((r) => r.id !== exceptId && r.creditId && r.status !== 'Not found in bank').map((r) => r.creditId)
  const patchReceipt = (id, patch) => setActivity((list) => list.map((r) => (r.id === id ? { ...r, ...patch } : r)))
  const postReceiptJournal = (r, acc, { reversal = false } = {}) => {
    const bank = data.bank.accounts.find((b) => b.id === r.account)
    const lines = receiptJournal({ ...r, reversal }, acc, {
      bankLedger: bank?.ledger || '1101',
      gstRate: data.tax.config.gstOnReceiptsRate,
      gstApplies: acc.projectStatus !== 'Completed' || data.tax.config.gstOnCompletedSales,
    })
    setLocalJournals((js) => [...js, {
      id: `JE-NEW-${js.length + 1}`, date: reversal ? today : r.date, lines, amount: lines.reduce((s, l) => s + (l.dr || 0), 0),
      narration: `${reversal ? 'Reversal of receipt' : 'Receipt from'} ${r.customer} · ${r.receiptNo} · ${r.method} ${r.reference || ''}`.trim(),
      source: reversal ? 'Receipt reversal' : 'Receipt', ref: r.receiptNo, origin: 'System', status: 'Posted', createdBy: user.name,
    }])
  }
  const finalizeReceipt = (r, credit, extra = {}) => {
    const acc = customersLive[r.bookingId]
    const issued = [...data.receiptNumbers, ...activity.map((x) => x.receiptNo).filter(Boolean)]
    const receiptNo = nextReceiptNo(receiptPrefixFor(acc.projectStatus), issued)
    const done = {
      ...r, ...extra, status: 'Verified', receiptNo, verifiedOn: today, verifiedBy: user.name, creditId: credit?.id || null,
      note: credit ? `Matched to bank credit ${credit.ref} of ${formatDate(credit.date)}` : 'Cash receipt: checked against the cash book',
    }
    patchReceipt(r.id, done)
    if (credit) setOverride(`recon:${credit.id}`, 'Reconciled')
    postReceiptJournal(done, acc)
    notify?.(`Demo: ${receiptNo} issued for ${formatINR(done.amount)} from ${r.customer}. Balance updated on screen only.`)
  }
  const receiptActions = {
    record: (f) => {
      const acc = customersLive[customerId]
      const bank = bankAccountFor(acc)
      const rec = {
        id: `NEW-${activity.length + 1}`, bookingId: acc.bookingId, customer: acc.customer, projectId: acc.projectId,
        projectName: acc.projectName, unit: acc.unit, date: f.date, amount: f.amount, method: f.method, reference: f.reference,
        remarks: f.remarks, account: f.method === 'Cash' ? null : bank?.id, status: 'Pending verification', recordedBy: user.name,
        note: 'Recorded. Verify it against the bank statement to issue the receipt.',
      }
      setActivity((list) => [...list, rec])
      notify?.(`Demo: ${formatINR(f.amount)} from ${acc.customer} recorded on screen. It counts as paid only after bank verification.`)
    },
    verify: (r) => {
      const res = matchToStatement(r, statementCredits(), usedCreditIds(r.id))
      if (res.result === 'Matched' || res.result === 'Cash') return finalizeReceipt(r, res.credit)
      if (res.result === 'Amount differs') {
        patchReceipt(r.id, { status: 'Amount differs', creditId: res.credit.id, note: `Bank credited ${formatINR(res.credit.amount)} (${res.credit.ref}), ${formatINR(Math.abs(r.amount - res.credit.amount))} ${res.credit.amount < r.amount ? 'less' : 'more'} than recorded. Review before accepting.` })
        return notify?.('Flagged for review: the bank amount differs from the receipt.')
      }
      if (res.result === 'In clearing') {
        patchReceipt(r.id, { status: 'In clearing', creditId: res.credit.id, note: `Cheque ${res.credit.ref} deposited; not cleared yet. Not counted as paid.` })
        return notify?.('Cheque is still in clearing, so it is not counted as received yet.')
      }
      patchReceipt(r.id, { status: 'Not found in bank', note: `No matching credit on the statement up to ${formatDate(data.bank.lastStatementDate)}. Check again after the next statement.` })
      return notify?.('No matching bank credit found yet.')
    },
    acceptBankAmount: (r) => {
      const credit = statementCredits().find((c) => c.id === r.creditId)
      if (credit) finalizeReceipt(r, credit, { amount: credit.amount, remarks: `${r.remarks || ''} Accepted bank amount ${formatINR(credit.amount)} (recorded ${formatINR(r.amount)}).`.trim() })
    },
    chequeUpdate: (r, outcome) => {
      const credit = statementCredits().find((c) => c.id === r.creditId)
      if (outcome === 'cleared') {
        setCreditState((s) => ({ ...s, [r.creditId]: 'cleared' }))
        return finalizeReceipt(r, credit ? { ...credit, recon: 'Bank only' } : null)
      }
      patchReceipt(r.id, { status: 'Cheque returned', note: 'Returned unpaid by the bank (simulated). Ask the customer for another payment.' })
      if (credit) setOverride(`recon:${credit.id}`, 'Cheque returned')
      return notify?.('Demo: cheque marked returned. Nothing was counted as paid.')
    },
    reverse: (r, reason) => {
      const acc = customersLive[r.bookingId]
      patchReceipt(r.id, { status: 'Reversed', reversedOn: today, reversalReason: reason })
      postReceiptJournal(r, acc, { reversal: true })
      notify?.(`Demo: ${r.receiptNo} reversed on screen only. ${formatINR(r.amount)} added back to the balance.`)
    },
    logReminder: (acc, how, summary) => {
      setReminders((list) => [{ id: `REM-${list.length + 1}`, bookingId: acc.bookingId, how, summary, date: today, by: user.name }, ...list])
      notify?.(`Demo: reminder logged for ${acc.customer} (${how}). Nothing was sent.`)
    },
  }
  const openDocument = (row) => notify?.(`Demo: "${row.document}" is a placeholder. No document is stored in this prototype.`)


  const projectLabel = projectId === 'all' ? 'All projects' : projectOptions.find((p) => p.id === projectId)?.name || projectId
  const onStatusChange = (s) => updateParams({ status: s === statusOptions?.[0] ? null : s })
  const otherDashboards = dashboardsForRole(sessionRole).filter((d) => d.id !== 'accountant')

  // Unknown section → dashboard; old ?tab= links → their page
  if (pathSection && !TAB_IDS.includes(pathSection)) return <Navigate to="/dashboards/accountant" replace />
  const legacyTab = !pathSection && params.get('tab')
  if (legacyTab) {
    const next = new URLSearchParams(params)
    next.delete('tab')
    return <Navigate to={{ pathname: accountsPath(TAB_IDS.includes(legacyTab) ? legacyTab : null), search: next.toString() }} replace />
  }
  const [pageTitle, pageSub] = PAGE_HEAD[tab]

  let body
  if (loadStatus === 'error') body = <ErrorState message={error?.message} onRetry={reload} />
  else if (!data || !view) body = <LoadingState />
  else if (data.projects.length === 0)
    body = (
      <EmptyState
        title="No financial data to show"
        message="There are no projects for the selected filters."
        action={<button className="btn" onClick={() => updateParams({ project: null, range: null, from: null, to: null, q: null, preview: null })}>Reset filters</button>}
      />
    )
  else body = renderTab()

  function renderTab() {
    switch (tab) {
      case 'receipts':
        return <ReceiptsSection receipts={view.receipts} receivables={view.receivables} schedule={view.paymentSchedule} view={status} onViewChange={onStatusChange} onOpenCustomer={openCustomer} />
      case 'expenses':
        return (
          <ExpensesSection
            bills={view.expenseBills} categories={data.expenseBillCategories} status={status} onStatusChange={onStatusChange} onOpenBill={openBill}
          />
        )
      case 'suppliers':
        return (
          <SupplierPayments
            bills={view.supplierBills} accounts={view.supplierAccounts} status={status} onStatusChange={onStatusChange}
            perms={perms} onWorkflow={supplierWorkflow} invoiceablePOs={invoiceablePOs(inv.state)}
          />
        )
      case 'contractors':
        return (
          <ContractorBills
            accounts={data.contractors.accounts} bills={view.contractorBills} status={status} onStatusChange={onStatusChange}
            perms={perms} onAct={act} onUndo={undo}
          />
        )
      case 'salaries':
        return (
          <EmployeePayroll
            runs={view.salaryRuns} perms={perms} onUndo={undo} onOpen={openTab}
            onAct={(kind, row, next, message) => {
              // Keep who approved/paid and when, alongside the status change (demo, on screen only)
              if (kind === 'salary' && next === 'Approved') setOverride(`salary-meta:${row.id}`, { approvedBy: user.name, approvedOn: today })
              return act(kind, row, next, message)
            }}
            onRecordPayment={(row, reference) => {
              setOverride(`salary-meta:${row.id}`, { ...(overrides[`salary-meta:${row.id}`] || {}), paidOn: today, paymentRef: reference, paidBy: user.name })
              act('salary', row, 'Paid', `Demo: ${row.label} marked paid (${reference}) on screen only. No salaries were transferred.`)
            }}
          />
        )
      case 'payroll':
        return <PayrollSection payroll={view.payroll} status={status} onStatusChange={onStatusChange} perms={perms} onAct={act} onUndo={undo} notify={notify} />
      case 'bank':
        return <BankCash accounts={data.bank.accounts} txns={view.bankTxns} onOpen={openTab} />
      case 'reconciliation':
        return (
          <BankReconciliation
            accounts={data.bank.accounts} items={view.reconItems} lastStatementDate={data.bank.lastStatementDate}
            canReconcile={perms.canReconcile} onAct={act} onUndo={undo} onCreateJournal={createJournal} notify={notify}
          />
        )
      case 'journals':
        return (
          <JournalEntries
            accounts={data.books.accounts} journals={view.journals} view={status} onViewChange={onStatusChange}
            from={data.meta.filters.from} to={data.meta.filters.to} user={user} perms={perms}
            onAct={act} onUndo={undo} onCreateJournal={createJournal}
          />
        )
      case 'tax':
        return (
          <TaxCompliance
            tax={{ ...data.tax, filings: view.taxFilings }} status={status} onStatusChange={onStatusChange}
            canPrepare={perms.canPrepareTax} onAct={act} onUndo={undo} onOpenDocument={openDocument}
          />
        )
      case 'approvals':
        return (
          <>
            <FinanceApprovals approvals={view.approvals} types={data.approvalTypes} user={user} onDecide={decide} onVerify={verifyApproval} />
            <Card title="Supplier bills in approval" sub="Bills forwarded by Accounts. Decisions are taken on the Bill Approvals page by the authorised approver." bodyClass="" className="mb"
              action={<Link className="btn btn-sm" to={`/approvals/bills${viewAs === 'admin' ? '' : '?view=All+in+workflow'}`}>Open Bill Approvals</Link>}>
              <DataTable
                dense
                rows={view.billsInApproval}
                emptyText="No supplier bills have been forwarded for approval yet. Forward them from Expenses & Bills."
                columns={[
                  { key: 'bill', header: 'Bill', render: (r) => <><div className="cell-main">{r.vendor}</div><div className="cell-sub">{r.billNo} · {r.projectName}</div></> },
                  { key: 'amount', header: 'Recommended', align: 'num', render: (r) => formatINR(r.s.recommendedAmount ?? r.amount) },
                  { key: 'stage', header: 'Status', render: (r) => <Badge>{r.stage}</Badge> },
                  { key: 'open', header: '', render: (r) => <button className="btn btn-sm" onClick={() => openBill(r.id, 'review')}>Open</button> },
                ]}
              />
            </Card>
            <PermissionSummary role={role} />
          </>
        )
      case 'reports':
        return <><ProjectPurchaseCost bills={inv.supplierBills} pos={inv.poViews} advances={inv.state.supplierAdvances} /><FinancialReports reports={data.reports} view={status} onViewChange={onStatusChange} receivables={view.receivables} payables={view.supplierBills} onOpenCustomer={openCustomer} /></>
      default:
        return (
          <>
            <WorkQueue queue={buildWorkQueue({ work: view.work, perms, user })} roleLabel={role.label} onOpen={openTab} />
            <FinancialSummary summary={{ ...data.summary, supplierPending: view.work.supplierBills.filter((b) => b.paymentStatus !== 'Paid').reduce((t, b) => t + b.balance, 0), supplierPendingCount: view.work.supplierBills.filter((b) => b.paymentStatus !== 'Paid').length }} pendingApprovals={pendingCount} onOpen={openTab} />
            <div className="grid halves">
              <CashflowChart data={data.reports.cashflow} />
              <BudgetHeadsChart data={data.reports.budgetVsActual} />
            </div>
            <SupplierPayments compact bills={view.supplierBills} />
            <Card title="Customer Payments Outstanding" sub="Earliest due first" bodyClass="" className="mb">
              <DataTable rows={view.receivables} columns={receivableColumns(openCustomer)} limit={5} emptyText="No outstanding customer payments." />
            </Card>
            <ReceiptsSection compact receipts={view.receipts} receivables={view.receivables} onOpenCustomer={openCustomer} />
          </>
        )
    }
  }

  return (
    <>
      {tab !== 'overview' && (
        <Link className="back-link" to={{ pathname: accountsPath('overview'), search: sharedSearch(params) }}>
          ‹ Accountant Dashboard
        </Link>
      )}
      <PageHead title={pageTitle} sub={`${projectLabel} · ${pageSub}`}>
        {canViewAsAdmin && (
          <div className="view-as" title="Which demo permissions the action buttons follow. Not access control.">
            <span>Actions shown for</span>
            <Chips
              options={['Accountant', 'Admin (you)']}
              value={viewAs === 'admin' ? 'Admin (you)' : 'Accountant'}
              onChange={(v) => updateParams({ as: v === 'Accountant' ? null : 'admin' })}
            />
          </div>
        )}
        {otherDashboards.map((d) => (
          <Link key={d.id} className="btn" to={d.to}><Icon name={d.icon} />{d.label}</Link>
        ))}
        <button className="btn" onClick={reload} disabled={loadStatus === 'loading' && !!data}>
          <Icon name="trend" />Refresh
        </button>
      </PageHead>

      <div className="dash-controls">
        <DashboardFilters
          projectOptions={projectOptions}
          projectId={projectId}
          range={range}
          from={rawFrom}
          to={rawTo}
          resolved={resolved}
          onChange={updateParams}
        >
          <label className="field field-search">
            Search
            <input
              type="search"
              placeholder="Party, bill, invoice, receipt no…"
              value={qDraft}
              onChange={(e) => setQDraft(e.target.value)}
            />
          </label>
        </DashboardFilters>
        <DemoTag />
      </div>

      <CompletedProjectNote project={selectedProject} range={range} onShowAll={() => updateParams({ range: 'all', from: null, to: null })} />

      {(search.trim() || q.trim()) && (
        <div className="filter-note">
          Filtering tables by {[search, q].map((t) => t.trim()).filter(Boolean).map((t) => `"${t}"`).join(' and ')}.{' '}
          {q && <button className="btn btn-sm" onClick={() => { setQDraft(''); updateParams({ q: null }) }}>Clear search</button>}
        </div>
      )}

      {body}

      {billId && billReviews.data && (() => {
        const rb = billReviews.data.bills.find((b) => b.id === billId)
        if (!rb) return null
        return (
          <BillReviewPanel
            key={`${billId}-${billTab}`}
            bill={rb}
            rec={reportFor(rb, billStateOf(rb), billReviews.data.bills)}
            initialTab={billTab}
            role={role}
            user={user}
            approvalRules={billReviews.data.approvalRules}
            mode="accountant"
            notify={notify}
            onClose={closeBill}
          />
        )
      })()}

      {customerId && data?.customers?.[customerId] && (
        <CustomerAccount
          key={`${customerId}-${customerTab}`}
          account={customersLive[customerId]}
          initialTab={customerTab}
          onClose={closeCustomer}
          notify={notify}
          perms={{ canRecord: perms.canRecordReceipt, canReverse: perms.canReverseReceipt, canRemind: perms.canRemind }}
          actions={receiptActions}
          credits={statementCredits().filter((c) => {
            const acc = customersLive[customerId]
            return c.account === bankAccountFor(acc)?.id && !usedCreditIds().includes(c.id)
          })}
          bankAccount={bankAccountFor(customersLive[customerId])}
          channels={data.notificationChannels}
          reminders={reminders.filter((r) => r.bookingId === customerId)}
        />
      )}
    </>
  )
}
