/**
 * Builds the Accountant Dashboard view-model from DEMO fixtures.
 * In the backend phase this aggregation moves server-side; the returned
 * shape is the contract the UI components expect.
 */
import * as D from '../data/demo/adminDashboardDemo.js'
import * as A from '../data/demo/accountantDashboardDemo.js'
import * as B from '../data/demo/accountingBooksDemo.js'
import { addDays, bucketOf, diffDays, makeBuckets, parseISO, toISO, todayISO } from '../utils/date.js'

const sum = (arr, f) => arr.reduce((s, x) => s + (typeof f === 'function' ? f(x) : x[f] || 0), 0)
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

// Calendar months overlapping [from, to], clipped to the range.
function monthBuckets(from, to) {
  const out = []
  const multiYear = from.slice(0, 4) !== to.slice(0, 4)
  const cur = parseISO(from)
  cur.setDate(1)
  while (toISO(cur) <= to) {
    const next = new Date(cur.getFullYear(), cur.getMonth() + 1, 1)
    const start = toISO(cur), end = addDays(toISO(next), -1)
    out.push({
      start: start < from ? from : start,
      end: end > to ? to : end,
      label: MONTHS[cur.getMonth()] + (multiYear ? ` ${String(cur.getFullYear()).slice(2)}` : ''),
    })
    cur.setTime(next.getTime())
  }
  return out
}

const AGING = [
  { label: 'Not yet due', test: (d) => d <= 0 },
  { label: '1–30 days overdue', test: (d) => d >= 1 && d <= 30 },
  { label: '31–60 days overdue', test: (d) => d >= 31 && d <= 60 },
  { label: '60+ days overdue', test: (d) => d > 60 },
]
const aging = (rows, amountKey) => AGING.map((b) => ({ label: b.label, value: sum(rows.filter((r) => b.test(r.daysOverdue)), amountKey) }))

// How each kind of bank/cash transaction is grouped in "money paid"
const PAID_GROUP = {
  supplier: 'Suppliers', supplierAdvance: 'Suppliers', contractor: 'Contractors', contractorAdvance: 'Contractors', wages: 'Labour wages',
  salary: 'Staff salaries', expense: 'Site expenses', labourAdvance: 'Labour advances', misc: 'Equipment & overhead vendors',
  tdsPayment: 'Taxes & statutory', pfPayment: 'Taxes & statutory', gstPayment: 'Taxes & statutory', bankCharge: 'Bank charges',
}
const MOVES_MONEY = (t) => t.inBooks && t.kind !== 'transfer' && t.kind !== 'opening'
const RECON_OPEN = ['Unreconciled', 'ERP only', 'Bank only', 'Amount differs', 'Clearing']

// Deterministic demo contact details (masked phone, example.com email). Not real people.
const hashOf = (str) => [...str].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7)

/** One account per booking: unit, price, schedule, receipts and contact. Keyed by booking id. */
function buildCustomerAccounts(T) {
  const receiptByCollection = Object.fromEntries(A.customerReceipts.map((r) => [r.collectionId, r]))
  const bankBySource = Object.fromEntries(B.bankTransactions.filter((t) => t.kind === 'receipt').map((t) => [t.source, t]))
  const accounts = {}
  D.bookings.forEach((b) => {
    const p = D.projects.find((x) => x.id === b.projectId)
    const rows = D.collections.filter((c) => c.bookingId === b.id).sort((x, y) => x.date.localeCompare(y.date))
    const demanded = rows.map((c) => {
      const r = receiptByCollection[c.id]
      return {
        id: c.id, milestone: c.milestone, amount: c.amount, status: c.status, date: c.date, expected: false,
        receiptId: r?.id || null, method: r?.method || null, daysOverdue: c.status === 'Overdue' ? diffDays(c.date, T) : 0,
        // Bank evidence for the receipt: statement reference and match status (history before the books started is taken as verified)
        reference: r ? bankBySource[r.id]?.ref || null : null,
        bankStatus: r ? (bankBySource[r.id]?.recon || (r.date < B.BOOKS_START ? 'Verified (before books start)' : 'Reconciled')) : null,
      }
    })
    // Projects under construction: add the plan's later instalments (not demanded yet) with expected dates
    const upcoming = []
    if (p && p.status !== 'Completed' && p.type !== 'Villas') {
      const plinth = A.PLANNED_PLINTH[p.id] || T
      let planned = 0
      A.APARTMENT_PAYMENT_PLAN.forEach((m, i) => {
        const isLast = i === A.APARTMENT_PAYMENT_PLAN.length - 1
        const amount = isLast ? b.value - planned : Math.round((b.value * m.share) / 100) * 100
        planned += amount
        if (demanded.some((d) => d.milestone === m.milestone)) return
        const date = m.after == null ? p.deadline : addDays(plinth, m.after)
        upcoming.push({
          id: `${b.id}-M${i + 1}`, milestone: m.milestone, amount, status: 'Upcoming', date, expected: true,
          receiptId: null, method: null, daysOverdue: 0,
        })
      })
      // Keep the plan total equal to the price even if demanded amounts were rounded differently
      const diff = b.value - sum(demanded, 'amount') - sum(upcoming, 'amount')
      if (upcoming.length && diff) upcoming[upcoming.length - 1].amount += diff
    }
    const schedule = [...demanded, ...upcoming].sort((x, y) => x.date.localeCompare(y.date))
    const paid = sum(schedule.filter((x) => x.status === 'Received'), 'amount')
    const next = schedule.find((x) => x.status !== 'Received')
    const h = hashOf(b.id)
    const [first, ...rest] = b.customer.split(' ')
    accounts[b.id] = {
      bookingId: b.id, customer: b.customer, projectId: b.projectId, projectName: p?.name ?? b.projectId,
      projectStatus: p?.status, unit: b.unit, unitType: p?.type === 'Villas' ? 'Villa' : 'Apartment', bookingDate: b.date,
      price: b.value, paid, balance: b.value - paid,
      overdue: sum(schedule.filter((x) => x.status === 'Overdue'), 'amount'),
      dueSoon: sum(schedule.filter((x) => x.status === 'Due'), 'amount'),
      notYetDemanded: sum(schedule.filter((x) => x.status === 'Upcoming'), 'amount'),
      next: next || null,
      schedule,
      homeLoan: schedule.some((x) => x.method === 'Home loan disbursement'),
      contact: {
        phone: `+91 98XXX X${String(h % 10000).padStart(4, '0')}`,
        email: `${first.toLowerCase()}.${rest.join('').toLowerCase() || 'buyer'}${h % 90 + 10}@example.com`,
        relationshipManager: ['Anita Rao', 'Vikram Shah'][h % 2],
        preferred: ['Phone', 'Email', 'WhatsApp'][h % 3],
      },
    }
  })
  return accounts
}

export const matchStatusOf = (b) =>
  b.matchStatus ?? (b.invoicedQty > b.receivedQty ? 'Qty mismatch' : b.invoiceRate > b.poRate ? 'Rate mismatch' : 'Matched')

/**
 * Supplier bills as the Accounts pages show them: project name, days overdue and bank status.
 * Used for the demo records here and, on screen, for the live session records (same rows).
 * Returns every bill for the project, and those in view (open, or paid within the range).
 */
export function supplierBillsView(rows, { projectId = 'all', from, to }) {
  const T = todayISO()
  const txnBySource = Object.fromEntries(B.bankTransactions.filter((t) => t.source).map((t) => [t.source, t]))
  const projectName = (id) => D.projects.find((p) => p.id === id)?.name ?? id
  const all = rows.filter((b) => projectId === 'all' || b.projectId === projectId).map((b) => {
    const t = txnBySource[b.id]
    const lastPaid = b.payments?.[b.payments.length - 1]
    // Bank status applies to the payment it was matched to; a payment recorded this session is not on a statement yet
    const recon = t && lastPaid && t.ref === lastPaid.reference ? t.recon : lastPaid ? 'ERP only' : undefined
    return {
      ...b, projectName: projectName(b.projectId), recon,
      daysOverdue: diffDays(b.dueDate, T), matchStatus: matchStatusOf(b),
      overBilled: b.overBilled ?? Math.max(0, b.invoicedQty * b.invoiceRate - b.receivedQty * b.poRate),
    }
  })
  const inRange = (iso) => !!iso && iso.slice(0, 10) >= from && iso.slice(0, 10) <= to
  return { all, inView: all.filter((b) => b.paymentStatus !== 'Paid' || inRange(b.paidOn)) }
}

/** Ledger per supplier: invoices (verified value), payments and advance adjustments, with running balance. */
export function supplierAccountsOf(supplierAll) {
  return [...new Set(supplierAll.map((b) => b.supplier))].map((name) => {
    const bills = supplierAll.filter((b) => b.supplier === name)
    const open = bills.filter((b) => b.paymentStatus !== 'Paid')
    const history = [
      ...bills.map((b) => ({ date: b.invoiceDate, type: 'Invoice', ref: `${b.invoiceNo} · ${b.poId}`, credit: b.verifiedAmount ?? b.amount, debit: 0, status: b.paymentStatus })),
      ...bills.flatMap((b) => (b.payments || []).map((p) => ({
        date: p.date, type: 'Payment', ref: [p.mode, p.reference, b.invoiceNo].filter(Boolean).join(' · '),
        credit: 0, debit: p.amount, status: p.reference === b.paymentRef ? b.recon || 'Reconciled' : 'Reconciled',
      }))),
      ...bills.filter((b) => b.advanceAdjusted).map((b) => ({
        date: b.request?.decidedAt?.slice(0, 10) || b.invoiceDate, type: 'Advance adjusted', ref: `${b.poId} · ${b.invoiceNo}`, credit: 0, debit: b.advanceAdjusted, status: 'Adjusted',
      })),
    ].sort((a, b) => a.date.localeCompare(b.date))
    let run = 0
    history.forEach((h, i) => { run += h.credit - h.debit; h.balance = run; h.id = `${name}-${i}` })
    return {
      id: name, supplier: name,
      invoiced: sum(bills, 'amount'), paid: sum(bills, 'paidAmount'), outstanding: sum(open, 'balance'),
      overdue: sum(open.filter((b) => b.paymentStatus === 'Overdue'), 'balance'),
      invoices: bills.length, lastPayment: bills.map((b) => b.paidOn).filter(Boolean).sort().pop() || null,
      history: history.reverse(),
    }
  }).sort((a, b) => b.outstanding - a.outstanding)
}

export function buildAccountantDashboard({ projectId = 'all', from: requestedFrom, to }) {
  const T = todayISO()
  const earliestStart = D.projects
    .filter((p) => projectId === 'all' || p.id === projectId)
    .map((p) => p.startDate)
    .sort()[0]
  const from = earliestStart && requestedFrom < earliestStart && earliestStart <= to ? earliestStart : requestedFrom
  const inProject = (r) => projectId === 'all' || r.projectId === projectId
  const inRange = (iso) => !!iso && iso.slice(0, 10) >= from && iso.slice(0, 10) <= to
  const projectName = (id) => D.projects.find((p) => p.id === id)?.name ?? id
  const withProject = (r) => ({ ...r, projectName: projectName(r.projectId) })
  const projects = D.projects.filter((p) => projectId === 'all' || p.id === projectId)

  // ----- Income -----
  const receipts = A.customerReceipts.filter((r) => inProject(r) && inRange(r.date)).map(withProject)
  const receivables = A.customerReceivables
    .filter(inProject)
    .map((r) => withProject({ ...r, daysOverdue: diffDays(r.dueDate, T) }))
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate))

  // ----- Expenses -----
  const booked = D.expenses.filter((e) => inProject(e) && inRange(e.date))
  const expenseBills = A.expenseBills.filter((b) => inProject(b) && inRange(b.date)).map(withProject)

  // ----- Supplier payables: everything open, plus invoices settled in range -----
  const txnBySource = Object.fromEntries(B.bankTransactions.filter((t) => t.source).map((t) => [t.source, t]))
  const withBank = (b) => {
    const t = txnBySource[b.id]
    return t ? { ...b, paymentRef: t.ref, paymentMode: t.method, recon: t.recon } : b
  }
  const { all: supplierAll, inView: supplierBills } = supplierBillsView(A.supplierBills, { projectId, from, to })
  const openSupplier = supplierBills.filter((b) => b.paymentStatus !== 'Paid')

  // ----- Payroll: open batches/bills, plus those paid in range -----
  const openOrInRange = (r, dateKey) => r.status !== 'Paid' || inRange(r.paidOn) || inRange(r[dateKey])
  const payrollBatches = A.payrollBatches.filter((b) => inProject(b) && openOrInRange(b, 'weekEnding')).map(withProject)
  const contractorBills = A.contractorBills.filter((b) => inProject(b) && openOrInRange(b, 'date')).map((b) => withProject(withBank(b)))
  const advances = A.labourAdvances
    .filter(inProject)
    .map((a) => withProject({ ...a, outstanding: a.amount - a.recovered }))
    .filter((a) => a.outstanding > 0)
  const payrollOpen = sum(payrollBatches.filter((b) => b.status !== 'Paid'), 'net')
  const contractorOpen = sum(contractorBills.filter((b) => b.status !== 'Paid'), 'net')

  // ----- Money in / out: from the bank & cash register (company-wide books) -----
  // One project selected: only that project's money. All projects: company-level items too (salaries, taxes, charges).
  const moneyTxns = B.bankTransactions.filter((t) => MOVES_MONEY(t) && (projectId === 'all' || t.projectId === projectId))
  const inflowsAll = moneyTxns.filter((t) => t.amount > 0)
  const outflowsAll = moneyTxns.filter((t) => t.amount < 0).map((t) => ({ ...t, amount: -t.amount, group: PAID_GROUP[t.kind] || 'Other' }))
  const outflows = outflowsAll.filter((o) => inRange(o.date))
  const paidByKind = [...new Set(Object.values(PAID_GROUP))].map((k) => ({
    label: k,
    value: sum(outflows.filter((o) => o.group === k), 'amount'),
  }))

  // ----- Reports -----
  const lifetimeExpenses = D.expenses.filter(inProject)
  const budgetVsActual = D.EXPENSE_CATEGORIES.map((head) => {
    const rows = A.budgetHeads.filter((b) => inProject(b) && b.head === head)
    const actual = sum(lifetimeExpenses.filter((e) => e.category === head), 'amount')
    const planned = sum(rows, 'plannedToDate')
    return { x: head, label: head, lifetimeBudget: sum(rows, 'lifetimeBudget'), planned, actual, variance: planned - actual }
  })

  const buckets = makeBuckets(from, to)
  const series = (records, valueFn) => {
    const out = buckets.map(() => 0)
    records.forEach((r) => { const i = bucketOf(buckets, r.date); if (i >= 0) out[i] += valueFn(r) })
    return out
  }
  const inc = series(receipts, (r) => r.amount)
  const exp = series(booked, (e) => e.amount)
  const incomeExpenditure = buckets.map((b, i) => ({ x: b.label, income: inc[i], expenditure: exp[i] }))

  const balanceAt = (iso) => sum(B.bankTransactions.filter((t) => t.inBooks && t.date <= iso), 'amount')
  // Bank books start on BOOKS_START; months before that would only show zeros
  const cashFrom = from < B.BOOKS_START ? B.BOOKS_START : from
  const cashflow = (cashFrom <= to ? monthBuckets(cashFrom, to) : []).map((m) => {
    const inflow = sum(inflowsAll.filter((r) => r.date >= m.start && r.date <= m.end), 'amount')
    const outflow = sum(outflowsAll.filter((o) => o.date >= m.start && o.date <= m.end), 'amount')
    return { x: m.label, inflow, outflow, net: inflow - outflow, closing: balanceAt(m.end) }
  })

  // ----- Supplier accounts (ledger per supplier, all dates) -----
  const supplierAccounts = supplierAccountsOf(supplierAll)

  // ----- Contractor accounts (per work order) -----
  const allRA = A.contractorBills.filter(inProject).map((b) => withProject(withBank(b)))
  const isBooked = (b) => b.status === 'Approved' || b.status === 'Paid'
  const contractorAccounts = A.contractorWorkOrders.filter(inProject).map((w) => {
    const bills = allRA.filter((b) => b.contractor === w.contractor)
    const recovered = sum(bills.filter(isBooked), 'advanceRecovery')
    const advTxn = txnBySource[w.woNo]
    const history = [
      ...(w.advance ? [{ date: w.advanceDate, type: 'Advance paid', ref: advTxn ? `${advTxn.method} ${advTxn.ref}` : w.woNo, amount: w.advance }] : []),
      ...bills.map((b) => ({ date: b.date, type: `${b.billNo} submitted (${b.status})`, ref: b.work, amount: b.gross })),
      ...bills.filter((b) => b.paidOn).map((b) => ({ date: b.paidOn, type: `Payment for ${b.billNo}`, ref: [b.paymentMode || 'NEFT', b.paymentRef].filter(Boolean).join(' '), amount: b.net })),
    ].sort((a, b) => b.date.localeCompare(a.date)).map((h, i) => ({ ...h, id: `${w.woNo}-${i}` }))
    return {
      ...w,
      billedGross: sum(bills, 'gross'),
      billedPct: w.value ? Math.round((sum(bills, 'gross') / w.value) * 100) : 0,
      advanceRecovered: recovered,
      advanceBalance: w.advance - recovered,
      retentionHeld: sum(bills.filter(isBooked), 'retention'),
      tdsDeducted: sum(bills.filter(isBooked), 'tds'),
      paid: sum(bills.filter((b) => b.paidOn), 'net'),
      outstanding: sum(bills.filter((b) => b.status !== 'Paid'), 'net'),
      history,
    }
  })

  // ----- Employee payroll (company-wide) -----
  const salaryOpen = sum(B.salaryRuns.filter((r) => r.status !== 'Paid'), 'net')

  // ----- Bank & cash (company-wide) -----
  const runningById = {}
  const runBal = {}
  B.bankTransactions.forEach((t) => {
    if (!t.inBooks) return
    runBal[t.account] = (runBal[t.account] || 0) + t.amount
    runningById[t.id] = runBal[t.account]
  })
  const accountShort = (id) => B.bankAccounts.find((a) => a.id === id)?.short
  const bankAccounts = B.bankAccounts.map((a) => {
    const tx = B.bankTransactions.filter((t) => t.account === a.id)
    return {
      ...a,
      balance: sum(tx.filter((t) => t.inBooks), 'amount'),
      statementBalance: a.kind === 'Bank' ? sum(tx.filter((t) => t.recon !== 'ERP only'), 'statementAmount') : null,
      inflow: sum(tx.filter((t) => t.inBooks && t.amount > 0 && inRange(t.date)), 'amount'),
      outflow: -sum(tx.filter((t) => t.inBooks && t.amount < 0 && inRange(t.date)), 'amount'),
      toReconcile: tx.filter((t) => RECON_OPEN.includes(t.recon)).length,
    }
  })
  const bankTxns = B.bankTransactions
    .filter((t) => inRange(t.date))
    .map((t) => ({ ...t, balance: runningById[t.id] ?? null, accountName: accountShort(t.account) }))
    .reverse()
  const reconItems = B.bankTransactions
    .filter((t) => RECON_OPEN.includes(t.recon))
    .map((t) => ({ ...t, accountName: accountShort(t.account), status: t.recon }))
    .reverse()

  // ----- Tax & compliance (company-wide) -----
  const taxFilings = B.taxFilings.map((f) => ({ ...f, daysLeft: diffDays(T, f.due) }))

  // ----- Project cost & profit (actual for completed, indicative for ongoing) -----
  const projectCost = projects.map((p) => {
    const bookingsValue = sum(D.bookings.filter((b) => b.projectId === p.id), 'value')
    const unitsRow = D.units.find((u) => u.projectId === p.id) || { total: p.units || 0, booked: 0, sold: 0 }
    const unitsSold = (unitsRow.booked || 0) + (unitsRow.sold || 0)
    const costToDate = sum(D.expenses.filter((e) => e.projectId === p.id), 'amount')
    const budget = p.budget * 1e7
    const budgetForSold = unitsRow.total ? budget * (unitsSold / unitsRow.total) : 0
    const isDone = p.status === 'Completed'
    return {
      id: p.id, name: p.name, status: p.status, completedOn: p.completedOn || null, unitsSold, unitsTotal: unitsRow.total, bookingsValue,
      collected: sum(A.customerReceipts.filter((r) => r.projectId === p.id), 'amount'),
      receivable: sum(A.customerReceivables.filter((r) => r.projectId === p.id), 'amount'),
      budget, costToDate, completionByCost: budget ? Math.round((costToDate / budget) * 1000) / 10 : 0,
      // Completed: actual profit = sale value − final cost. Ongoing: indicative, against the budget of units sold.
      margin: isDone ? bookingsValue - costToDate : bookingsValue - budgetForSold,
      marginBasis: isDone ? 'Actual (completed)' : 'Indicative',
    }
  })

  const customers = buildCustomerAccounts(T)
  const receivablesOverdue = receivables.filter((r) => r.status === 'Overdue')
  const supplierOverdue = openSupplier.filter((b) => b.paymentStatus === 'Overdue')

  return {
    meta: { source: 'demo', notice: A.DEMO_NOTICE, filters: { projectId, from, to }, generatedAt: new Date().toISOString() },
    projects: projects.map((p) => ({ id: p.id, name: p.name })),
    summary: {
      received: sum(receipts, 'amount'),
      receiptCount: receipts.length,
      paid: sum(outflows, 'amount'),
      paidByKind,
      expenses: sum(booked, 'amount'),
      receivables: sum(receivables, 'amount'),
      receivableCount: receivables.length,
      supplierPending: sum(openSupplier, 'balance'),
      supplierPendingCount: openSupplier.length,
      overdueReceivables: sum(receivablesOverdue, 'amount'),
      overduePayables: sum(supplierOverdue, 'balance'),
      overdueCount: receivablesOverdue.length + supplierOverdue.length,
      // Staff salaries are company-wide, so they count only when all projects are shown
      payrollDue: payrollOpen + contractorOpen + (projectId === 'all' ? salaryOpen : 0),
      bankBalance: sum(bankAccounts, 'balance'),
    },
    receipts,
    receivables,
    expenseBills,
    expenseBillCategories: A.EXPENSE_BILL_CATEGORIES,
    supplierBills,
    payroll: {
      batches: payrollBatches,
      contractorBills,
      advances,
      advancesOutstanding: sum(advances, 'outstanding'),
      payrollOpen,
      contractorOpen,
    },
    contractors: { accounts: contractorAccounts, bills: allRA },
    supplierAccounts,
    employeePayroll: {
      runs: B.salaryRuns.map((r) => ({ ...r, paymentRef: B.bankTransactions.find((t) => t.kind === 'salary' && t.source === r.id)?.ref || null })),
      employees: B.employees,
      open: salaryOpen,
    },
    bank: { accounts: bankAccounts, txns: bankTxns, reconItems, lastStatementDate: B.lastStatementDate },
    books: { accounts: B.chartOfAccounts, journals: B.journalEntries },
    tax: { config: B.TAX_CONFIG, byMonth: B.taxByMonth, filings: taxFilings },
    customers,
    statementCredits: B.bankTransactions
      .filter((t) => t.kind === 'unidentifiedCredit')
      .map((t) => ({ ...t, accountName: B.bankAccounts.find((a) => a.id === t.account)?.name })),
    receiptNumbers: A.customerReceipts.map((r) => r.id),
    notificationChannels: A.NOTIFICATION_CHANNELS,
    // Every instalment still to come (due, overdue or upcoming), earliest first, for the selected project
    paymentSchedule: Object.values(customers)
      .filter(inProject)
      .flatMap((c) => c.schedule.filter((x) => x.status !== 'Received').map((x) => ({
        ...x, scheduleId: x.id, id: `${c.bookingId}:${x.id}`, bookingId: c.bookingId, customer: c.customer, unit: c.unit,
        projectId: c.projectId, projectName: c.projectName,
      })))
      .sort((a, b) => a.date.localeCompare(b.date) || a.customer.localeCompare(b.customer)),
    approvals: A.financeApprovals.filter(inProject).map(withProject),
    approvalTypes: A.FINANCE_APPROVAL_TYPES,
    reports: {
      budgetVsActual,
      projectExpenses: projects.map((p) => {
        const rows = booked.filter((e) => e.projectId === p.id)
        return {
          id: p.id,
          name: p.name,
          ...Object.fromEntries(D.EXPENSE_CATEGORIES.map((c) => [c, sum(rows.filter((e) => e.category === c), 'amount')])),
          total: sum(rows, 'amount'),
        }
      }),
      expenseCategories: D.EXPENSE_CATEGORIES,
      expenseByCategory: D.EXPENSE_CATEGORIES.map((c) => ({ label: c, value: sum(booked.filter((e) => e.category === c), 'amount') })),
      incomeExpenditure,
      cashflow,
      receivableAging: aging(receivables, 'amount'),
      payableAging: aging(openSupplier, 'balance'),
      totals: { income: sum(receipts, 'amount'), expenditure: sum(booked, 'amount') },
      booksStart: B.BOOKS_START,
      projectCost,
      purchaseRegister: [...supplierAll].sort((a, b) => b.invoiceDate.localeCompare(a.invoiceDate)),
      supplierAccounts,
    },
  }
}
