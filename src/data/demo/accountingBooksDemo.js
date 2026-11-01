/**
 * DEMO DATA ONLY: company books for the Accountant pages (employees & salary runs,
 * bank & cash, bank statement status, chart of accounts, journal entries, tax).
 * Every figure is derived from the other demo fixtures so the pages agree with each
 * other: a supplier payment appears in the bank register, the journal, the ledger and
 * the reconciliation. Nothing here is real company data and nothing is saved.
 *
 * Tax rates, sections and due dates below are DEMO CONFIGURATION, not advice. The real
 * rules must be configured for the company's transactions and confirmed with its CA.
 */
import * as D from './adminDashboardDemo.js'
import * as A from './accountantDashboardDemo.js'
import { BILL_RECORDS } from './billVerificationDemo.js'
import { SUPPLIER_ADVANCES } from './procurementDemo.js'
import { addDays, diffDays, todayISO } from '../../utils/date.js'

function mulberry32(seed) {
  return function () {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
const rand = mulberry32(20261020)
const int = (min, max) => Math.floor(rand() * (max - min + 1)) + min
const pick = (arr) => arr[Math.floor(rand() * arr.length)]
const round = (n, to = 1) => Math.round(n / to) * to
const pad = (n, w = 4) => String(n).padStart(w, '0')

const T = todayISO()
const project = D.activeProjects[0]
// The books in this demo start when the current project started; earlier history of
// completed projects is carried in as opening balances on that date.
const START = project?.startDate || addDays(T, -60)
export const BOOKS_START = START
const completed = D.completedProjects
const isCompleted = (projectId) => completed.some((p) => p.id === projectId)
const monthKey = (iso) => iso.slice(0, 7)
const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const monthLabel = (key) => `${MONTH_NAMES[Number(key.slice(5)) - 1]} ${key.slice(0, 4)}`
const nextMonthDay = (key, day) => {
  const [y, m] = key.split('-').map(Number)
  const ny = m === 12 ? y + 1 : y, nm = m === 12 ? 1 : m + 1
  return `${ny}-${String(nm).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}
const monthEnd = (key) => addDays(nextMonthDay(key, 1), -1)
// Months from project start to the current month
const MONTHS = (() => {
  const out = []
  let k = monthKey(START)
  while (k <= monthKey(T)) { out.push(k); k = nextMonthDay(k, 1).slice(0, 7) }
  return out
})()

// ---------- Tax configuration (DEMO) ----------
export const TAX_CONFIG = {
  gstOnReceiptsRate: 5, // under-construction residential, without input tax credit (demo setting)
  inputTaxCreditEligible: false,
  gstOnCompletedSales: false, // instalments received after the completion certificate (demo setting)
  tdsSections: [
    { section: '194C', label: 'Payments to contractors', rate: 2, appliesTo: 'Contractor RA bills (company/firm)' },
    { section: '192', label: 'Salaries', rate: null, appliesTo: 'Employee salaries (slab based)' },
    { section: '194J', label: 'Professional / technical fees', rate: 10, appliesTo: 'Consultants, testing labs' },
    { section: '194-IA', label: 'Purchase of immovable property', rate: 1, appliesTo: 'Not applicable to this company (seller side)' },
  ],
  pfRate: 12,
  professionalTax: 200,
  note: 'Demo configuration only. Rates, sections and due dates must be set for the company\'s actual transactions and confirmed with its Chartered Accountant.',
}

// ---------- Employee salaries (separate from labour wages and contractor bills) ----------
const EMPLOYEE_SEED = [
  ['Rahul Mehta', 'Project Manager', 'Projects', 95000],
  ['Karan Joshi', 'Site Engineer', 'Projects', 52000],
  ['Meera Pillai', 'Site Engineer', 'Projects', 50000],
  ['Suresh Patil', 'Site Engineer', 'Projects', 48000],
  ['Rina Banerjee', 'QA/QC Engineer', 'Quality', 46000],
  ['Deepak Nair', 'Safety Officer', 'Safety', 38000],
  ['Mahesh Kale', 'Storekeeper', 'Stores', 28000],
  ['Anita Rao', 'Sales Executive', 'Sales', 35000, true],
  ['Vikram Shah', 'Sales Executive', 'Sales', 35000, true],
  ['Sneha Kulkarni', 'CRM Executive', 'Sales', 30000],
  ['Accounts User', 'Accountant', 'Accounts', 45000],
  ['Pooja Iyer', 'Office Administrator', 'Admin', 26000],
  ['Ganesh Pawar', 'Driver', 'Admin', 18000],
]
export const employees = EMPLOYEE_SEED.map(([name, designation, department, gross, incentive], i) => ({
  id: `EMP-${pad(i + 1, 3)}`,
  name, designation, department,
  monthlyGross: gross,
  incentiveEligible: !!incentive,
  joined: addDays(START, -int(30, 400)),
}))

function salaryLine(e, monthKeyStr, { incentiveOnly = false } = {}) {
  const lopDays = incentiveOnly ? 0 : rand() < 0.2 ? int(1, 2) : 0
  const paidDays = 30 - lopDays
  const gross = incentiveOnly ? 0 : round((e.monthlyGross * paidDays) / 30, 1)
  const basic = round(gross * 0.5, 1)
  const hra = round(gross * 0.2, 1)
  const special = gross - basic - hra
  const incentive = incentiveOnly ? int(2, 6) * 3000 : 0
  const total = gross + incentive
  const pf = incentiveOnly ? 0 : round(Math.min(basic, 15000) * (TAX_CONFIG.pfRate / 100), 1)
  const pt = incentiveOnly ? 0 : TAX_CONFIG.professionalTax
  const tds = total >= 45000 ? round(total * 0.06, 100) : incentive ? round(incentive * 0.05, 100) : 0
  return {
    employeeId: e.id, name: e.name, designation: e.designation, department: e.department, month: monthKeyStr,
    paidDays, lopDays, basic, hra, special, incentive, gross: total, pf, pt, tds, net: total - pf - pt - tds,
  }
}

// One salary run per month since project start, plus a sales-incentive run for last month.
export const salaryRuns = (() => {
  const runs = []
  MONTHS.forEach((k) => {
    const isCurrent = k === monthKey(T)
    const lines = employees.map((e) => salaryLine(e, k))
    runs.push({
      id: `SAL-${k}`, type: 'Monthly salary', month: k, label: monthLabel(k), lines,
      status: isCurrent ? 'Draft' : 'Paid',
      paidOn: isCurrent ? null : nextMonthDay(k, 1),
      preparedBy: 'Accounts User',
      approvedBy: isCurrent ? null : 'Admin User',
      approvedOn: isCurrent ? null : addDays(nextMonthDay(k, 1), -2),
    })
  })
  const prev = MONTHS[MONTHS.length - 2]
  if (prev) {
    runs.push({
      id: `INC-${prev}`, type: 'Sales incentive', month: prev, label: `${monthLabel(prev)} incentives`,
      lines: employees.filter((e) => e.incentiveEligible).map((e) => salaryLine(e, prev, { incentiveOnly: true })),
      status: 'Pending Approval', paidOn: null, preparedBy: 'Accounts User',
    })
  }
  return runs
    .map((r) => ({ ...r, gross: r.lines.reduce((s, l) => s + l.gross, 0), net: r.lines.reduce((s, l) => s + l.net, 0),
      tds: r.lines.reduce((s, l) => s + l.tds, 0), pfPt: r.lines.reduce((s, l) => s + l.pf + l.pt, 0) }))
    .sort((a, b) => b.month.localeCompare(a.month) || a.type.localeCompare(b.type))
})()

// ---------- Monthly tax figures & filing calendar ----------
const bookedRA = A.contractorBills.filter((b) => (b.status === 'Approved' || b.status === 'Paid') && b.date >= START)
const paidSalaryRuns = salaryRuns.filter((r) => r.status === 'Paid')
const purchaseBooked = A.supplierBills.filter((b) => b.verification === 'Verified')
const gstOn = (amount) => round((amount * TAX_CONFIG.gstOnReceiptsRate) / (100 + TAX_CONFIG.gstOnReceiptsRate), 1)
const gstOnReceipt = (r) => (isCompleted(r.projectId) && !TAX_CONFIG.gstOnCompletedSales ? 0 : gstOn(r.amount))

export const taxByMonth = MONTHS.map((k) => {
  const receipts = A.customerReceipts.filter((r) => monthKey(r.date) === k)
  return {
    month: k,
    label: monthLabel(k),
    receiptsValue: receipts.reduce((s, r) => s + r.amount, 0),
    gstOutput: receipts.reduce((s, r) => s + gstOnReceipt(r), 0),
    gstOnPurchases: purchaseBooked.filter((b) => monthKey(b.invoiceDate) === k).reduce((s, b) => s + b.gst, 0),
    tds194C: bookedRA.filter((b) => monthKey(b.date) === k).reduce((s, b) => s + b.tds, 0),
    tds192: paidSalaryRuns.filter((r) => r.month === k).reduce((s, r) => s + r.tds, 0),
    pfPt: paidSalaryRuns.filter((r) => r.month === k).reduce((s, r) => s + r.pfPt, 0),
  }
})

export const taxFilings = (() => {
  const rows = []
  taxByMonth.forEach((m) => {
    if (m.month === monthKey(T)) return // current month not yet closed
    rows.push(
      { kind: 'TDS deposit', form: 'Challan 281', period: m.label, due: nextMonthDay(m.month, 7), amount: m.tds194C + m.tds192, pays: true },
      { kind: 'GST return', form: 'GSTR-1', period: m.label, due: nextMonthDay(m.month, 11), amount: null },
      { kind: 'PF & PT', form: 'ECR / PT challan', period: m.label, due: nextMonthDay(m.month, 15), amount: m.pfPt, pays: true },
      { kind: 'GST return & payment', form: 'GSTR-3B', period: m.label, due: nextMonthDay(m.month, 20), amount: m.gstOutput, pays: true },
    )
  })
  // Quarterly TDS returns for the quarter that ended most recently
  const q = ['03', '06', '09', '12'].map((mm) => `${T.slice(0, 4)}-${mm}`).filter((k) => k < monthKey(T)).pop()
  if (q) {
    // Q4 (Jan–Mar) returns are due 31 May; other quarters on the last day of the following month (demo calendar)
    const qDue = q.endsWith('03') ? `${q.slice(0, 4)}-05-31` : q.endsWith('12') ? `${Number(q.slice(0, 4)) + 1}-01-31` : monthEnd(nextMonthDay(q, 1).slice(0, 7))
    const qLabel = `Q ending ${monthLabel(q)}`
    rows.push(
      { kind: 'TDS return', form: '26Q (non-salary)', period: qLabel, due: qDue, amount: null },
      { kind: 'TDS return', form: '24Q (salary)', period: qLabel, due: qDue, amount: null },
    )
  }
  return rows
    .map((r, i) => {
      const filed = r.due < T
      return {
        id: `TX-${pad(i + 1, 3)}`,
        ...r,
        status: filed ? 'Filed' : 'Due',
        filedOn: filed ? addDays(r.due, -int(1, 3)) : null,
        reference: filed ? (r.pays ? `CIN ${int(1000000, 9999999)}` : `ARN ${int(100000000, 999999999)}`) : null,
        document: filed ? `${r.form.split(' ')[0].toLowerCase()}-${r.period.replace(/\s+/g, '-').toLowerCase()}.pdf` : null,
      }
    })
    .sort((a, b) => b.due.localeCompare(a.due))
})()

// ---------- Bank & cash accounts ----------
export const bankAccounts = [
  { id: 'BA-RERA', name: 'RERA a/c – Sunrise Heights', short: 'RERA Sunrise', bank: 'Demo Bank', number: 'XXXX 4821', kind: 'Bank', ledger: '1101', projectId: project?.id },
  ...completed.map((p, i) => ({ id: `BA-RERA-${p.id}`, name: `RERA a/c – ${p.short}`, short: `RERA ${p.short.split(' ')[0]}`, bank: 'Demo Bank', number: `XXXX 55${i}2`, kind: 'Bank', ledger: '1104', projectId: p.id })),
  { id: 'BA-OPS', name: 'Operations current account', short: 'Operations a/c', bank: 'Demo Bank', number: 'XXXX 7310', kind: 'Bank', ledger: '1102' },
  { id: 'CASH', name: 'Site petty cash (Tower A & B)', short: 'Petty cash', bank: null, number: null, kind: 'Cash', ledger: '1103' },
]

// Expense bills paid from petty cash: small bills or bills raised by the site cash box
const paidInCash = (b) => b.vendor === 'Site petty cash' || b.amount <= 10000

// Every money movement as a bank/cash transaction. `kind` decides the journal posting.
const rawTxns = []
// Only movements on or after the books start date are recorded (earlier ones are in the opening balances)
const PROJECT_KINDS = ['receipt', 'supplier', 'contractor', 'contractorAdvance', 'wages', 'expense', 'labourAdvance', 'misc']
const txn = (t) => (t.kind === 'opening' || t.date >= START) &&
  rawTxns.push({ ...t, projectId: t.projectId ?? (PROJECT_KINDS.includes(t.kind) ? project?.id ?? null : null) })
const reraFor = (projectId) => (isCompleted(projectId) ? `BA-RERA-${projectId}` : 'BA-RERA')

if (project) {
  txn({ date: START, account: 'BA-OPS', amount: A.openingBalance, kind: 'opening', party: 'Opening balance', desc: 'Balance brought forward', ref: '-' })
  txn({ date: START, account: 'CASH', amount: 50000, kind: 'opening', party: 'Opening balance', desc: 'Cash in hand brought forward', ref: '-' })

  // Completed projects: bank balance, buyers' dues and contractor retention brought forward
  completed.forEach((p) => {
    const recv = D.collections.filter((c) => c.projectId === p.id && (c.status !== 'Received' || c.date >= START)).reduce((s, c) => s + c.amount, 0)
    const retention = A.contractorBills.filter((b) => b.projectId === p.id && b.date < START).reduce((s, b) => s + b.retention, 0)
    txn({
      date: START, account: reraFor(p.id), amount: 18500000, kind: 'opening', party: 'Opening balance', projectId: p.id,
      desc: `${p.short}: balance brought forward (project completed ${p.completedOn})`, ref: '-', meta: { completed: true, receivable: recv, retention },
    })
  })

  A.customerReceipts.forEach((r) => txn({
    date: r.date, account: reraFor(r.projectId), amount: r.amount, kind: 'receipt', party: r.customer, projectId: r.projectId,
    desc: `${r.milestone} · ${r.id}`, method: r.method, source: r.id,
    ref: r.method === 'Cheque' ? `CHQ ${int(100000, 999999)}` : r.method === 'UPI' ? `UPI ${int(1e11, 9e11)}` : r.method === 'Home loan disbursement' ? `HL ${int(10000, 99999)}` : `UTR${int(1e7, 9e7)}`,
  }))

  A.supplierBills.forEach((b) => b.payments.forEach((p) => txn({
    date: p.date, account: 'BA-OPS', amount: -p.amount, kind: 'supplier', party: b.supplier, projectId: b.projectId,
    desc: `${b.invoiceNo} · ${b.material}`, method: p.mode, source: b.id, ref: p.reference,
  })))
  // Advances paid to suppliers against purchase orders (shared register)
  SUPPLIER_ADVANCES.forEach((a) => {
    const b = A.supplierBills.find((x) => x.poId === a.poId)
    txn({ date: a.date, account: 'BA-OPS', amount: -a.amount, kind: 'supplierAdvance', party: b?.supplier || 'Supplier', desc: `${a.purpose} · ${a.poId}`, method: a.mode, source: a.id, ref: a.reference, projectId: b?.projectId })
  })

  // Advances paid to suppliers against purchase orders / agreements
  Object.entries(BILL_RECORDS).forEach(([billId, r]) => (r.po?.advances || []).forEach((a) => txn({
    date: a.date, account: 'BA-OPS', amount: -a.amount, kind: 'supplierAdvance', party: r.po.supplier,
    desc: `${a.purpose} · ${r.po.id}`, method: a.mode, source: a.id, ref: a.reference,
    projectId: A.expenseBills.find((b) => b.id === billId)?.projectId,
  })))

  A.contractorWorkOrders.filter((w) => w.advance).forEach((w) => txn({
    date: w.advanceDate, account: 'BA-OPS', amount: -w.advance, kind: 'contractorAdvance', party: w.contractor, projectId: w.projectId,
    desc: `Mobilisation advance · ${w.woNo}`, method: 'NEFT', source: w.woNo, ref: `UTR${int(1e7, 9e7)}`,
  }))
  A.contractorBills.filter((b) => b.paidOn).forEach((b) => txn({
    date: b.paidOn, account: 'BA-OPS', amount: -b.net, kind: 'contractor', party: b.contractor, projectId: b.projectId,
    desc: `${b.billNo} · ${b.work}`, method: 'NEFT', source: b.id, ref: b.paymentRef,
  }))

  A.payrollBatches.filter((b) => b.paidOn).forEach((b) => txn({
    date: b.paidOn, account: 'BA-OPS', amount: -b.net, kind: 'wages', party: 'Labour wage payout', projectId: b.projectId,
    desc: `${b.id} · ${b.workers} workers`, method: 'Bulk NEFT', source: b.id, ref: `BULK${int(10000, 99999)}`, meta: { gross: b.gross + b.overtime, recovery: b.advanceRecovery },
  }))
  paidSalaryRuns.forEach((r) => txn({
    date: r.paidOn, account: 'BA-OPS', amount: -r.net, kind: 'salary', party: 'Staff salaries',
    desc: `${r.label} salary · ${r.lines.length} employees`, method: 'Bulk NEFT', source: r.id, ref: `BULK${int(10000, 99999)}`, meta: { gross: r.gross, tds: r.tds, pfPt: r.pfPt },
  }))

  A.expenseBills.filter((b) => b.paidOn).forEach((b) => txn({
    date: b.paidOn, account: paidInCash(b) ? 'CASH' : 'BA-OPS', amount: -b.amount, kind: 'expense', party: b.vendor, projectId: b.projectId,
    desc: `${b.billNo} · ${b.category}`, method: paidInCash(b) ? 'Cash' : 'NEFT', source: b.id,
    ref: paidInCash(b) ? `PCV-${int(100, 999)}` : `UTR${int(1e7, 9e7)}`, meta: { category: b.category },
  }))
  A.labourAdvances.forEach((a) => txn({
    date: a.date, account: 'CASH', amount: -a.amount, kind: 'labourAdvance', party: a.labourer, projectId: a.projectId,
    desc: `Labour advance · ${a.id}`, method: 'Cash', source: a.id, ref: `PCV-${int(100, 999)}`,
  }))

  taxFilings.filter((f) => f.pays && f.status === 'Filed' && f.amount > 0).forEach((f) => txn({
    date: f.filedOn, account: 'BA-OPS', amount: -f.amount, kind: f.kind === 'TDS deposit' ? 'tdsPayment' : f.kind === 'PF & PT' ? 'pfPayment' : 'gstPayment',
    party: f.kind === 'TDS deposit' ? 'Income Tax Department' : f.kind === 'PF & PT' ? 'EPFO / PT authority' : 'GST portal',
    desc: `${f.form} · ${f.period}`, method: 'Net banking', source: f.id, ref: f.reference,
  }))

  // Petty cash top-ups every 10 days
  for (let d = addDays(START, 5); d <= T; d = addDays(d, 10)) {
    const ref = `TRF-${int(1000, 9999)}`
    txn({ date: d, account: 'BA-OPS', amount: -50000, kind: 'transfer', party: 'Petty cash', desc: 'Petty cash top-up', method: 'Cash withdrawal', ref, pairAccount: 'CASH' })
    txn({ date: d, account: 'CASH', amount: 50000, kind: 'transfer', party: 'Operations a/c', desc: 'Petty cash top-up', method: 'Cash withdrawal', ref, pairAccount: 'BA-OPS' })
  }

  // Equipment hire, fuel and overhead vendors not itemised above: weekly batch payments,
  // sized so cash paid tracks booked project spend (paid ~15 days after booking)
  const itemised = rawTxns.filter((t) => t.amount < 0 && ['supplier', 'contractor', 'contractorAdvance', 'wages', 'expense', 'labourAdvance'].includes(t.kind))
    .reduce((s, t) => s - t.amount, 0)
  const lagged = D.expenses.filter((e) => e.projectId === project.id && addDays(e.date, 15) <= T)
  const share = Math.max(0, 1 - itemised / Math.max(1, lagged.reduce((s, e) => s + e.amount, 0)))
  for (let wk = addDays(START, 15); wk <= T; wk = addDays(wk, 7)) {
    const end = addDays(wk, 6)
    const amount = round(lagged.filter((e) => addDays(e.date, 15) >= wk && addDays(e.date, 15) <= end).reduce((s, e) => s + e.amount, 0) * share, 100)
    if (amount > 0) txn({
      date: end > T ? T : end, account: 'BA-OPS', amount: -amount, kind: 'misc', party: 'Equipment, fuel & overhead vendors',
      desc: 'Weekly vendor payment batch', method: 'Bulk NEFT', ref: `BULK${int(10000, 99999)}`,
    })
  }

  // RERA withdrawals to operations every 14 days, limited to the project cost incurred in
  // that period (as certified by engineer/CA). Collections otherwise stay in the RERA account.
  const reraBalanceAt = (d) => rawTxns.filter((t) => t.account === 'BA-RERA' && t.date <= d).reduce((s, t) => s + t.amount, 0)
  for (let d = addDays(START, 14); d <= T; d = addDays(d, 14)) {
    const certifiedCost = D.expenses.filter((e) => e.projectId === project.id && e.date > addDays(d, -14) && e.date <= d).reduce((s, e) => s + e.amount, 0)
    const amount = Math.floor(Math.min(reraBalanceAt(d), certifiedCost) / 100000) * 100000
    if (amount <= 0) continue
    const ref = `TRF-${int(1000, 9999)}`
    txn({ date: d, account: 'BA-RERA', amount: -amount, kind: 'transfer', party: 'Operations a/c', desc: 'Withdrawal against certified project cost', method: 'Internal transfer', ref, pairAccount: 'BA-OPS' })
    txn({ date: d, account: 'BA-OPS', amount, kind: 'transfer', party: 'RERA a/c', desc: 'Withdrawal against certified project cost', method: 'Internal transfer', ref, pairAccount: 'BA-RERA' })
  }

  // Completed projects: surplus moved from the project's RERA account to operations
  completed.forEach((p) => {
    const d = addDays(T, -14)
    const balance = rawTxns.filter((t) => t.account === reraFor(p.id) && t.date <= d).reduce((s, t) => s + t.amount, 0)
    const amount = Math.floor((balance * 0.8) / 100000) * 100000 // keep a buffer for refunds and pending dues
    if (amount <= 0) return
    const ref = `TRF-${int(1000, 9999)}`
    txn({ date: d, account: reraFor(p.id), amount: -amount, kind: 'transfer', party: 'Operations a/c', desc: `${p.short}: surplus after completion moved to operations`, method: 'Internal transfer', ref, pairAccount: 'BA-OPS', projectId: p.id })
    txn({ date: d, account: 'BA-OPS', amount, kind: 'transfer', party: `RERA ${p.short.split(' ')[0]}`, desc: `${p.short}: surplus after completion moved to operations`, method: 'Internal transfer', ref, pairAccount: reraFor(p.id), projectId: p.id })
  })

  // Month-end bank charges and interest (from the bank statement)
  MONTHS.slice(0, -1).forEach((k) => {
    txn({ date: monthEnd(k), account: 'BA-OPS', amount: -590, kind: 'bankCharge', party: 'Demo Bank', desc: `Account maintenance charges (incl. GST) · ${monthLabel(k)}`, method: 'Bank debit', ref: `CHG${k.replace('-', '')}` })
    const interest = round(reraBalanceAt(monthEnd(k)) * 0.03 / 12, 1)
    if (interest > 0) txn({ date: monthEnd(k), account: 'BA-RERA', amount: interest, kind: 'interest', party: 'Demo Bank', desc: `Interest credit · ${monthLabel(k)}`, method: 'Bank credit', ref: `INT${k.replace('-', '')}` })
  })
}

// ---------- Bank statement status (reconciliation) ----------
// Reconciled: matched to the statement. Unreconciled: on both, not matched yet (last 3 days).
// ERP only: issued but not yet cleared by the bank. Bank only: on the statement, not yet
// recorded in the ERP. Amount differs: matched by reference but the amounts disagree.
// ---------- Latest bank statement: incoming credits the ERP hasn't recorded yet ----------
// The accountant identifies the payer and records the receipt; verification then matches it.
// Demo cases: a NEFT that matches by reference, an RTGS that matches by amount, an IMPS with
// ₹250 deducted by the remitter's bank (amount differs) and a cheque still in clearing.
export const STATEMENT_CREDITS = []
if (project) {
  const recv = (status, skip = []) => A.customerReceivables.find((r) => r.projectId === project.id && r.status === status && !skip.includes(r.customer))
  const sita = D.bookings.find((b) => b.customer === 'Sita Gowda' && b.projectId === project.id)
  const overdue = recv('Overdue', ['Sita Gowda'])
  const due = recv('Due', ['Sita Gowda', overdue?.customer])
  const villaCheque = completed.length ? A.customerReceivables.find((r) => r.projectId === completed[0].id && r.customer === 'Meenal Joshi') : null
  const credit = (c) => {
    STATEMENT_CREDITS.push(c)
    rawTxns.push({ kind: 'unidentifiedCredit', party: c.payer, method: c.method, ref: c.ref, amount: c.amount, date: c.date, account: c.account, projectId: c.projectId, desc: c.narration, meta: { clearing: !!c.clearing } })
  }
  if (sita) credit({ date: addDays(T, -1), account: 'BA-RERA', projectId: project.id, amount: 500000, method: 'NEFT', ref: 'UTR55201934', payer: 'SITA GOWDA', narration: 'NEFT CR-SITA GOWDA-A704 FLAT PAYMENT' })
  if (overdue) credit({ date: addDays(T, -2), account: 'BA-RERA', projectId: project.id, amount: overdue.amount, method: 'RTGS', ref: `UTR6${String(overdue.amount).slice(0, 7).padEnd(7, '0')}`, payer: overdue.customer.toUpperCase(), narration: `RTGS CR-${overdue.customer.toUpperCase()}` })
  if (due) credit({ date: addDays(T, -1), account: 'BA-RERA', projectId: project.id, amount: due.amount - 250, method: 'IMPS', ref: `IMPS7${String(due.amount).slice(0, 8).padEnd(8, '0')}`, payer: due.customer.toUpperCase(), narration: `IMPS CR-${due.customer.toUpperCase()} (charges deducted by remitter bank)` })
  if (villaCheque) credit({ date: addDays(T, -1), account: `BA-RERA-${villaCheque.projectId}`, projectId: villaCheque.projectId, amount: villaCheque.amount, method: 'Cheque', ref: '004512', payer: 'MEENAL JOSHI', narration: 'CHQ DEP 004512 - IN CLEARING', clearing: true, expectedClear: addDays(T, 1) })
}

const sorted = rawTxns.sort((a, b) => a.date.localeCompare(b.date) || b.amount - a.amount)
const lastMonthEnd = MONTHS.length > 1 ? monthEnd(MONTHS[MONTHS.length - 2]) : null
const latestSupplierPay = [...sorted].reverse().find((t) => t.kind === 'supplier')
const differsReceipt = [...sorted].reverse().find((t) => t.kind === 'receipt' && t.date <= addDays(T, -4) && t.method === 'NEFT')

export const bankTransactions = sorted.map((t, i) => {
  const base = { id: `BT-${pad(i + 1, 5)}`, ...t, inBooks: true, statementAmount: t.amount, recon: 'Reconciled' }
  // Credits on the statement that are not in the ERP yet; a cheque in clearing isn't money yet
  if (t.kind === 'unidentifiedCredit') {
    return { ...base, inBooks: false, recon: t.meta.clearing ? 'Clearing' : 'Bank only', statementAmount: t.meta.clearing ? 0 : t.amount }
  }
  if (t.account === 'CASH') return { ...base, recon: 'Cash' }
  if (t.kind === 'opening') return base
  if ((t.kind === 'bankCharge' || t.kind === 'interest') && t.date === lastMonthEnd) return { ...base, inBooks: false, recon: 'Bank only' }
  if (latestSupplierPay && t === latestSupplierPay && diffDays(t.date, T) <= 10) {
    return { ...base, method: 'Cheque', ref: `CHQ ${int(400, 499)}`, recon: 'ERP only', statementAmount: 0 }
  }
  if (differsReceipt && t === differsReceipt) return { ...base, statementAmount: t.amount - 45000, recon: 'Amount differs' }
  if (diffDays(t.date, T) <= 3) return { ...base, recon: 'Unreconciled' }
  return base
})
export const lastStatementDate = addDays(T, -1)

// ---------- Chart of accounts ----------
export const chartOfAccounts = [
  ['1101', 'Bank – RERA collection a/c', 'Asset'],
  ['1102', 'Bank – Operations a/c', 'Asset'],
  ['1103', 'Cash – site petty cash', 'Asset'],
  ['1104', 'Bank – RERA a/c (completed villas)', 'Asset'],
  ['1201', 'Advances to contractors', 'Asset'],
  ['1202', 'Labour advances', 'Asset'],
  ['1203', 'Advances to suppliers', 'Asset'],
  ['1301', 'Construction WIP – Materials', 'Asset'],
  ['1302', 'Construction WIP – Labour', 'Asset'],
  ['1303', 'Construction WIP – Contractors', 'Asset'],
  ['1304', 'Construction WIP – Site overheads', 'Asset'],
  ['1305', 'Construction WIP – Equipment & fuel', 'Asset'],
  ['1401', 'Trade receivables – customers (completed projects)', 'Asset'],
  ['2101', 'Sundry creditors – suppliers', 'Liability'],
  ['2102', 'Contractors payable', 'Liability'],
  ['2103', 'Retention money payable', 'Liability'],
  ['2104', 'Expense creditors – site bills', 'Liability'],
  ['2201', 'TDS payable', 'Liability'],
  ['2202', 'PF & PT payable', 'Liability'],
  ['2203', 'GST output payable', 'Liability'],
  ['2301', 'Advances from customers', 'Liability'],
  ['3101', 'Capital & opening balances', 'Equity'],
  ['3102', 'Retained earnings – completed projects', 'Equity'],
  ['4101', 'Staff salaries & incentives', 'Expense'],
  ['4102', 'Bank charges', 'Expense'],
  ['4103', 'Interest & late-payment charges', 'Expense'],
  ['4104', 'Defect liability repairs (completed projects)', 'Expense'],
  ['5101', 'Interest income', 'Income'],
].map(([code, name, type]) => ({ code, name, type, normal: type === 'Asset' || type === 'Expense' ? 'Dr' : 'Cr' }))

// ---------- Journal entries ----------
const expenseLedger = (category, projectId) =>
  isCompleted(projectId) ? '4104'
    : category === 'Cement' || category === 'Steel' ? '1301' : category === 'Equipment Hire' || category === 'Fuel' ? '1305' : '1304'
const bankLedger = (accountId) => bankAccounts.find((a) => a.id === accountId).ledger

const journals = []
function je(date, narration, source, ref, lines, extra = {}) {
  const clean = lines.filter((l) => (l.dr || l.cr) > 0)
  const dr = clean.reduce((s, l) => s + (l.dr || 0), 0)
  const cr = clean.reduce((s, l) => s + (l.cr || 0), 0)
  if (Math.round(dr) !== Math.round(cr)) throw new Error(`Unbalanced demo journal: ${narration} (${dr} vs ${cr})`)
  journals.push({ date, narration, source, ref, lines: clean, amount: dr, status: 'Posted', origin: 'System', ...extra })
}

// Postings from bank/cash transactions recorded in the ERP
bankTransactions.filter((t) => t.inBooks).forEach((t) => {
  const bank = bankLedger(t.account)
  const amt = Math.abs(t.amount)
  switch (t.kind) {
    case 'opening':
      if (t.meta?.completed) {
        const { receivable, retention } = t.meta
        return je(t.date, t.desc, 'Opening', t.ref, [
          { account: bank, dr: amt }, { account: '1401', dr: receivable },
          { account: '2103', cr: retention }, { account: '3102', cr: amt + receivable - retention },
        ])
      }
      return je(t.date, t.desc, 'Opening', t.ref, [{ account: bank, dr: amt }, { account: '3101', cr: amt }])
    case 'receipt': {
      if (isCompleted(t.projectId)) {
        return je(t.date, `Receipt from ${t.party} · ${t.desc}`, 'Receipt', t.source, [{ account: bank, dr: amt }, { account: '1401', cr: amt }])
      }
      const gst = gstOn(amt)
      return je(t.date, `Receipt from ${t.party} · ${t.desc}`, 'Receipt', t.source, [{ account: bank, dr: amt }, { account: '2301', cr: amt - gst }, { account: '2203', cr: gst }])
    }
    case 'supplier': return je(t.date, `Payment to ${t.party} · ${t.desc}`, 'Payment', t.source, [{ account: '2101', dr: amt }, { account: bank, cr: amt }])
    case 'supplierAdvance': return je(t.date, `${t.party} · ${t.desc}`, 'Payment', t.source, [{ account: '1203', dr: amt }, { account: bank, cr: amt }])
    case 'contractorAdvance': return je(t.date, `${t.party} · ${t.desc}`, 'Payment', t.source, [{ account: '1201', dr: amt }, { account: bank, cr: amt }])
    case 'contractor': return je(t.date, `Payment to ${t.party} · ${t.desc}`, 'Payment', t.source, [{ account: '2102', dr: amt }, { account: bank, cr: amt }])
    case 'wages': return je(t.date, `Labour wages · ${t.desc}`, 'Labour payroll', t.source, [{ account: '1302', dr: t.meta.gross }, { account: '1202', cr: t.meta.recovery }, { account: bank, cr: amt }])
    case 'salary': return je(t.date, `Staff salaries · ${t.desc}`, 'Employee payroll', t.source, [{ account: '4101', dr: t.meta.gross }, { account: '2201', cr: t.meta.tds }, { account: '2202', cr: t.meta.pfPt }, { account: bank, cr: amt }])
    case 'expense': return je(t.date, `Paid ${t.party} · ${t.desc}`, 'Payment', t.source, [{ account: '2104', dr: amt }, { account: bank, cr: amt }])
    case 'labourAdvance': return je(t.date, `${t.desc} · ${t.party}`, 'Payment', t.source, [{ account: '1202', dr: amt }, { account: bank, cr: amt }])
    case 'tdsPayment': return je(t.date, `TDS deposited · ${t.desc}`, 'Statutory', t.source, [{ account: '2201', dr: amt }, { account: bank, cr: amt }])
    case 'pfPayment': return je(t.date, `PF & PT deposited · ${t.desc}`, 'Statutory', t.source, [{ account: '2202', dr: amt }, { account: bank, cr: amt }])
    case 'gstPayment': return je(t.date, `GST paid · ${t.desc}`, 'Statutory', t.source, [{ account: '2203', dr: amt }, { account: bank, cr: amt }])
    case 'misc': return je(t.date, `${t.party} · ${t.desc}`, 'Payment', t.ref, [{ account: '1305', dr: round(amt * 0.6, 1) }, { account: '1304', dr: amt - round(amt * 0.6, 1) }, { account: bank, cr: amt }])
    case 'bankCharge': return je(t.date, t.desc, 'Bank', t.ref, [{ account: '4102', dr: amt }, { account: bank, cr: amt }])
    case 'interest': return je(t.date, t.desc, 'Bank', t.ref, [{ account: bank, dr: amt }, { account: '5101', cr: amt }])
    case 'transfer':
      if (t.amount < 0) return je(t.date, `${t.desc}: ${bankAccounts.find((a) => a.id === t.account).short} → ${t.party}`, 'Transfer', t.ref, [{ account: bankLedger(t.pairAccount), dr: amt }, { account: bank, cr: amt }])
      return undefined // the outgoing leg posts both sides
    default: return undefined
  }
})

// Bills booked when verified (before they are paid)
A.supplierBills.filter((b) => b.verification === 'Verified' && b.invoiceDate >= START).forEach((b) =>
  je(b.invoiceDate, `Purchase: ${b.supplier} · ${b.invoiceNo} · ${b.material}`, 'Purchase invoice', b.id, [{ account: '1301', dr: b.verifiedAmount }, { account: '2101', cr: b.verifiedAmount }]))
bookedRA.forEach((b) =>
  je(b.date, `${b.contractor} ${b.billNo} · ${b.work}`, 'Contractor bill', b.id, [
    { account: '1303', dr: b.gross }, { account: '2103', cr: b.retention }, { account: '2201', cr: b.tds }, { account: '1201', cr: b.advanceRecovery }, { account: '2102', cr: b.net },
  ]))
A.expenseBills.filter((b) => b.verification === 'Verified' && b.date >= START).forEach((b) =>
  je(b.date, `${b.vendor} · ${b.billNo} (${b.category})`, 'Expense bill', b.id, [{ account: expenseLedger(b.category, b.projectId), dr: b.amount }, { account: '2104', cr: b.amount }]))

// Supplier advances already adjusted against verified bills
A.expenseBills.filter((b) => b.verification === 'Verified' && b.date >= START && BILL_RECORDS[b.id]?.advanceAdjusted).forEach((b) =>
  je(b.date, `Advance adjusted against ${b.vendor} · ${b.billNo}`, 'Advance adjustment', b.id, [{ account: '2104', dr: BILL_RECORDS[b.id].advanceAdjusted }, { account: '1203', cr: BILL_RECORDS[b.id].advanceAdjusted }]))

// Manual adjustments (the kind an accountant records)
const dgBill = A.expenseBills.find((b) => b.verification === 'Verified' && b.category === 'Electricity') || A.expenseBills[0]
const manual = [
  {
    date: addDays(T, -9), narration: `Reclassify ${dgBill?.billNo} (${dgBill?.vendor}) from Site overheads to Equipment & fuel`,
    lines: [{ account: '1305', dr: dgBill?.amount || 10000 }, { account: '1304', cr: dgBill?.amount || 10000 }], status: 'Posted', createdBy: 'Accounts User', approvedBy: 'Admin User',
  },
  {
    date: addDays(T, -6), narration: 'Late-payment interest charged by Steel Supply Co. (debit note DN-118)',
    lines: [{ account: '4103', dr: 4800 }, { account: '2101', cr: 4800 }], status: 'Posted', createdBy: 'Accounts User', approvedBy: 'Admin User',
  },
  {
    date: lastMonthEnd || T, narration: 'Provision for September electricity (bill awaited from the board)',
    lines: [{ account: '1304', dr: 38000 }, { account: '2104', cr: 38000 }], status: 'Pending Approval', createdBy: 'Accounts User',
  },
  {
    date: addDays(T, -1), narration: 'Write back excess TDS deducted on Prime Shuttering Works RA-1',
    lines: [{ account: '2201', dr: 2000 }, { account: '2102', cr: 2000 }], status: 'Draft', createdBy: 'Accounts User',
  },
]
manual.forEach((m) => je(m.date, m.narration, 'Manual journal', '-', m.lines, { status: m.status, origin: 'Manual', createdBy: m.createdBy, approvedBy: m.approvedBy || null }))

export const journalEntries = journals
  .sort((a, b) => a.date.localeCompare(b.date) || (a.origin === 'Manual') - (b.origin === 'Manual'))
  .map((j, i) => ({ id: `${j.origin === 'Manual' ? 'JV' : 'JE'}-${pad(i + 1, 5)}`, ...j }))
