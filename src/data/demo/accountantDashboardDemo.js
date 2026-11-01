/**
 * DEMO DATA ONLY: illustrative accounting records for the Accountant Dashboard prototype.
 * Built on top of the Admin Dashboard fixtures (same project, customer collections,
 * purchase orders, supplier invoices, labour advances and booked expenses) so both
 * dashboards tell the same story. Nothing here is real company data, and no record
 * is saved anywhere. Replace with backend responses via src/services/accountantService.js.
 */
import * as D from './adminDashboardDemo.js'
import { addDays, diffDays, todayISO } from '../../utils/date.js'
import { BILL_RECORDS, billTotals } from './billVerificationDemo.js'
import { RECEIPTS } from './inventoryDemo.js'
import { initialProcurementState, supplierBillRows } from '../../services/procurement.js'

// ---------- deterministic random helpers (separate seed from the admin fixtures) ----------
function mulberry32(seed) {
  return function () {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
const rand = mulberry32(20261101)
const int = (min, max) => Math.floor(rand() * (max - min + 1)) + min
const pick = (arr) => arr[Math.floor(rand() * arr.length)]
// Second stream for fields added later, so the original figures don't shift
const rand2 = mulberry32(20261013)
const int2 = (min, max) => Math.floor(rand2() * (max - min + 1)) + min
// Third stream for completed-project (villa) records
const rand3 = mulberry32(20261104)
const int3 = (min, max) => Math.floor(rand3() * (max - min + 1)) + min
const completed = D.completedProjects
const round = (n, to = 100) => Math.round(n / to) * to

const T = todayISO()
const ago = (n) => addDays(T, -n)
const pad = (n, w = 4) => String(n).padStart(w, '0')
const notAfterToday = (iso) => (iso > T ? T : iso)

const active = D.activeProjects
const age = (p) => Math.max(1, diffDays(p.startDate, T))
const sinceStart = (p, maxDays) => ago(int(0, Math.min(maxDays, age(p))))
const ENGINEERS = ['Karan Joshi', 'Meera Pillai', 'Suresh Patil']
const ACCOUNTS_USER = 'Accounts User' // matches DEMO_USERS.accountant.name, used to show "raised by you"

export const DEMO_NOTICE = 'Demo data: generated for UI review only. No real receipts, bills or payments.'

// ---------- A. customer receipts (from received collections) ----------
const EARLY_METHODS = ['Cheque', 'UPI', 'NEFT', 'NEFT']
const LATER_METHODS = ['NEFT', 'RTGS', 'Home loan disbursement', 'Cheque']

const isCompleted = (projectId) => D.completedProjects.some((p) => p.id === projectId)
const receiptsFor = (rows, prefix, start, choose) => rows
  .filter((c) => c.status === 'Received')
  .sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id))
  .map((c, i) => ({
    id: `${prefix}${pad(start + i)}`,
    collectionId: c.id,
    bookingId: c.bookingId,
    unit: c.unit,
    date: c.date,
    projectId: c.projectId,
    customer: c.customer,
    milestone: c.milestone,
    amount: c.amount,
    method: c.milestone.startsWith('Booking') ? choose(EARLY_METHODS) : choose(LATER_METHODS),
  }))
// Completed projects use their own random stream and receipt series, so the figures
// for projects under construction stay the same
const pickV = (arr) => arr[Math.floor(rand3() * arr.length)]
export const customerReceipts = [
  ...receiptsFor(D.collections.filter((c) => !isCompleted(c.projectId)), 'RCPT-', 5001, pick),
  ...receiptsFor(D.collections.filter((c) => isCompleted(c.projectId)), 'RCPT-V', 1, pickV),
].sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id))

// Construction-linked payment plan for apartments (demo configuration). Shares add up
// to 100% of the unit price. The first three instalments are the demanded ones in the
// collections data; later ones fall due when the construction milestone is reached.
// `after` = days after the planned plinth date; null = on possession (project deadline).
export const APARTMENT_PAYMENT_PLAN = [
  { milestone: 'Booking amount (10%)', share: 0.1 },
  { milestone: 'On agreement (10%)', share: 0.1 },
  { milestone: 'Plinth completion (10%)', share: 0.1, after: 0 },
  { milestone: '1st slab (10%)', share: 0.1, after: 60 },
  { milestone: '4th slab (7.5%)', share: 0.075, after: 180 },
  { milestone: '8th slab (7.5%)', share: 0.075, after: 300 },
  { milestone: 'Top slab (10%)', share: 0.1, after: 420 },
  { milestone: 'Brickwork (10%)', share: 0.1, after: 540 },
  { milestone: 'Plaster & flooring (10%)', share: 0.1, after: 700 },
  { milestone: 'Lifts & finishing (5%)', share: 0.05, after: 850 },
  { milestone: 'On possession (10%)', share: 0.1, after: null },
]
// Reminder channels. None is connected in this prototype, so reminders can't actually be sent.
export const NOTIFICATION_CHANNELS = [
  { id: 'whatsapp', label: 'WhatsApp', configured: false },
  { id: 'sms', label: 'SMS', configured: false },
  { id: 'email', label: 'Email', configured: false },
]

// Planned plinth completion for projects under construction (demo)
export const PLANNED_PLINTH = Object.fromEntries(active.map((p) => [p.id, addDays(T, 30)]))

// Instalments still to be collected (due or overdue), as of today
export const customerReceivables = D.collections
  .filter((c) => c.status !== 'Received')
  .map((c) => ({
    id: c.id,
    dueDate: c.date,
    projectId: c.projectId,
    bookingId: c.bookingId,
    unit: c.unit,
    customer: c.customer,
    milestone: c.milestone,
    amount: c.amount,
    status: c.status, // Due | Overdue
  }))

// ---------- B. expense bills (non-PO site bills) ----------
// Site/office bills booked directly (small cement & steel top-ups bought locally,
// transport, electricity, office costs…). Bulk material goes through POs (section C).
const EXPENSE_HEADS = [
  { category: 'Cement', vendors: ['Cement Traders', 'Local hardware store'], range: [12, 60], weight: 3 },
  { category: 'Steel', vendors: ['Steel Supply Co.', 'Local hardware store'], range: [20, 90], weight: 2 },
  { category: 'Transport', vendors: ['City Transport Co.', 'Tipper hire (daily)'], range: [6, 30], weight: 3 },
  { category: 'Electricity', vendors: ['Electricity board (temporary connection)', 'DG set hire'], range: [8, 45], weight: 2 },
  { category: 'Office Costs', vendors: ['Om Stationers', 'Site office rent', 'Internet & phone'], range: [2, 25], weight: 3 },
  { category: 'Equipment Hire', vendors: ['Earthmovers Rentals', 'Sai Crane Services'], range: [40, 160], weight: 3 },
  { category: 'Fuel', vendors: ['Local Fuel Station'], range: [15, 55], weight: 3 },
  { category: 'Other', vendors: ['Soil Testing Lab', 'SafeGear Supplies', 'Water Tanker Supply'], range: [8, 90], weight: 2 },
]
export const EXPENSE_BILL_CATEGORIES = EXPENSE_HEADS.map((h) => h.category)
const weightedHeads = EXPENSE_HEADS.flatMap((h) => Array(h.weight).fill(h))

const siteExpenseBills = active.length
  ? Array.from({ length: 28 }, (_, i) => {
      const p = pick(active)
      const h = pick(weightedHeads)
      const vendor = pick(h.vendors)
      const date = sinceStart(p, 65)
      const daysOld = diffDays(date, T)
      const verification =
        daysOld <= 6 ? (rand() < 0.8 ? 'Pending Verification' : 'Verified')
          : rand() < 0.12 ? 'Query Raised' : 'Verified'
      const paidOn = verification === 'Verified' && daysOld > 8 && rand() < 0.85 ? notAfterToday(addDays(date, int(4, 12))) : null
      return {
        id: `EB-${pad(3101 + i)}`,
        billNo: `${vendor.replace(/[^A-Z]/g, '').slice(0, 3) || 'BL'}/${int(100, 999)}`,
        date,
        projectId: p.id,
        category: h.category,
        vendor,
        amount: int(...h.range) * 1000 + pick([0, 250, 500, 750]),
        submittedBy: pick(ENGINEERS),
        // Supporting document: file name only, no real upload exists in the prototype
        document: rand() < 0.85 ? `${h.category.toLowerCase().replace(/[^a-z]+/g, '-')}-bill-${pad(3101 + i)}.pdf` : null,
        verification,
        paidOn,
      }
    }).sort((a, b) => b.date.localeCompare(a.date))
  : []

// Completed villas: defect-liability repairs and handover costs after completion
const villaExpenseBills = completed.flatMap((p) => [
  { vendor: 'AquaSeal Waterproofing', category: 'Other', note: 'Terrace waterproofing repair, V-12', days: 6, verification: 'Pending Verification' },
  { vendor: 'Green Leaf Landscaping', category: 'Other', note: 'Common area landscaping touch-up', days: 27, verification: 'Verified', paidAfter: 6 },
  { vendor: 'Om Stationers', category: 'Office Costs', note: 'Society handover document sets', days: 19, verification: 'Verified', paidAfter: 2 },
  { vendor: 'City Transport Co.', category: 'Transport', note: 'Removal of leftover site material', days: 44, verification: 'Verified', paidAfter: 5 },
].map((b, i) => ({
  id: `EB-V${pad(i + 1, 2)}`,
  billNo: `${b.vendor.replace(/[^A-Z]/g, '').slice(0, 3)}/${int3(100, 999)}`,
  date: ago(b.days),
  projectId: p.id,
  category: b.category,
  vendor: b.vendor,
  amount: int3(6, 75) * 1000 + 500,
  submittedBy: p.manager,
  document: `${b.note.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.pdf`,
  verification: b.verification,
  paidOn: b.paidAfter ? ago(b.days - b.paidAfter) : null,
  note: b.note,
})))

export const expenseBills = [...siteExpenseBills, ...villaExpenseBills].sort((a, b) => b.date.localeCompare(a.date))

// Bills with structured records (see billVerificationDemo) take their amount from the billed lines
expenseBills.forEach((b) => {
  const rec = BILL_RECORDS[b.id]
  if (!rec || rec.keepAmount) return
  b.amount = billTotals(rec).total
  b.document = rec.document
})

// ---------- C. supplier invoices & payment status ----------
// The legacy random invoices below are still drawn (not shown) so the demo figures generated
// after them stay the same. Supplier bills come from the shared records at the end of this section.
const CREDIT_DAYS = { 'Steel Supply Co.': 15, 'Cement Traders': 30, 'Stone & Aggregates': 21, 'Formwork Depot': 30, 'Chem Protect': 30, 'Earthmovers Rentals': 15, 'Local Fuel Station': 7 }
const invoiceByPo = Object.fromEntries(D.legacySupplierInvoices.map((si) => [si.poId, si]))

function paymentState(invoiceDate, dueDate, verification) {
  if (verification === 'Disputed') return { paymentStatus: 'On Hold', paid: 0 }
  if (verification === 'Awaiting Verification') return { paymentStatus: 'Awaiting Verification', paid: 0 }
  if (dueDate < ago(4) && rand() < 0.7) return { paymentStatus: 'Paid', paid: 1, paidOn: notAfterToday(addDays(dueDate, -int(0, 3))) }
  if (dueDate < T) return { paymentStatus: 'Overdue', paid: 0 }
  if (rand() < 0.3) return { paymentStatus: 'Partially Paid', paid: 0.5, paidOn: notAfterToday(addDays(invoiceDate, int(2, 6))) }
  return { paymentStatus: 'Due', paid: 0 }
}

const billedPOs = D.legacyPurchaseOrders.filter((po) => po.status === 'Received' || po.status === 'Partially Received')

// A few older, already-settled POs from before the current PO list
const olderPOs = active.length
  ? Array.from({ length: 6 }, (_, i) => {
      const p = pick(active)
      const m = pick(D.MATERIALS)
      return {
        id: `PO-${pad(2290 + i)}`,
        date: sinceStart(p, 70),
        projectId: p.id,
        vendor: ((random) => D.SUPPLIER_FOR[m.name] ?? random)(pick(Object.keys(CREDIT_DAYS))),
        material: m.name,
        amount: round(m.rate * m.reorder * (0.4 + rand()), 1000),
      }
    })
  : []

// GST rate per material (demo configuration; confirm actual rates with your tax advisor)
export const GST_RATES = {
  'Cement OPC 53': 28, 'TMT Steel 8mm': 18, 'TMT Steel 12mm': 18, 'TMT Steel 16mm': 18, 'M-Sand': 5,
  'Aggregate 20mm': 5, 'Shuttering Plywood 12mm': 18, 'Binding Wire': 18, 'Anti-termite Chemical': 18, 'Diesel (machinery)': 0,
}
const materialOf = (name) => D.MATERIALS.find((m) => m.name === name) || { name, unit: 'Nos', rate: 1000 }

const baseSupplierBills = [...billedPOs, ...olderPOs]
  .map((po, i) => {
    const si = invoiceByPo[po.id]
    const invoiceDate = si?.date || notAfterToday(addDays(po.date, int(3, 9)))
    const dueDate = addDays(invoiceDate, CREDIT_DAYS[po.vendor] ?? 30)
    const verification = si?.status || 'Verified'
    const state = paymentState(invoiceDate, dueDate, verification)
    return {
      id: si?.id || `SI-${pad(4601 + i)}`,
      invoiceNo: `${po.vendor.split(' ')[0].toUpperCase().slice(0, 4)}/${int(1000, 9999)}`,
      supplier: po.vendor,
      poId: po.id,
      material: po.material,
      poStatus: 'Approved',
      delivery: po.status === 'Partially Received' ? 'Partially delivered' : 'Delivered',
      grnId: `GRN-${pad(6201 + i)}`,
      projectId: po.projectId,
      invoiceDate,
      dueDate,
      amount: po.amount,
      paidAmount: round(po.amount * state.paid, 100),
      paidShare: state.paid,
      paidOn: state.paidOn || null,
      verification,
      paymentStatus: state.paymentStatus,
    }
  })
  .sort((a, b) => a.dueDate.localeCompare(b.dueDate))

// Purchase invoice matching: PO quantity/rate vs goods received (GRN) vs invoice.
// The shared cement invoice (see adminDashboardDemo) is the classic case: 500 bags
// ordered, 480 received, 500 billed. Another invoice is billed above the PO rate.
const cementCaseId = D.legacySupplierInvoices[0]?.id
const rateCaseId = baseSupplierBills.find((b) => b.paymentStatus === 'Awaiting Verification' && b.id !== cementCaseId)?.id
const legacySupplierBills = baseSupplierBills.map((b) => {
  const m = materialOf(b.material)
  let ordered = Math.max(1, Math.round(b.amount / m.rate))
  let received = b.delivery === 'Partially delivered' ? Math.max(1, Math.round(ordered * 0.7)) : ordered
  let invoiced = received
  let invoiceRate = m.rate
  if (b.id === cementCaseId && b.paymentStatus === 'Awaiting Verification') {
    ordered = 500; received = 480; invoiced = 500
  } else if (b.id === rateCaseId) {
    invoiceRate = Math.round(m.rate * 1.04)
  }
  const amount = round(invoiced * invoiceRate, 100)
  const gstRate = GST_RATES[m.name] ?? 18
  const paidAmount = round(amount * b.paidShare, 100)
  return {
    ...b,
    material: m.name,
    unit: m.unit,
    orderedQty: ordered,
    receivedQty: received,
    invoicedQty: invoiced,
    poRate: m.rate,
    invoiceRate,
    amount,
    gstRate,
    taxable: round(amount / (1 + gstRate / 100), 1),
    gst: amount - round(amount / (1 + gstRate / 100), 1),
    paidAmount,
    paymentMode: paidAmount ? (amount > 200000 ? 'RTGS' : 'NEFT') : null,
    paymentRef: paidAmount ? `UTR${int2(10000000, 99999999)}` : null,
  }
})

void legacySupplierBills

/**
 * Supplier invoices matched to the shared purchase register and the Store Keeper's goods receipts
 * (PO × GRN × invoice). Ordered, delivered and accepted quantities are kept separate. The Accountant
 * pages replace these with the live session records (same function), so on-screen changes show.
 */
export const supplierBills = supplierBillRows({ ...initialProcurementState(), receipts: RECEIPTS })

// ---------- D. labour payroll (weekly, against verified attendance) ----------
const lastSaturday = (() => {
  let d = T
  while (new Date(d + 'T00:00').getDay() !== 6) d = addDays(d, -1)
  return d
})()
const AVG_DAILY_WAGE = 760

export const payrollBatches = active.flatMap((p) => {
  const roster = D.labourRoster.filter((r) => r.projectId === p.id)
  const direct = roster.reduce((s, r) => s + r.direct, 0)
  const weeks = Math.max(1, Math.floor(age(p) / 7))
  return Array.from({ length: Math.min(weeks, 10) }, (_, w) => {
    const weekEnding = addDays(lastSaturday, -7 * w)
    const ramp = Math.min(1, 0.45 + (1 - w / weeks) * 0.7)
    const workerDays = Math.round(direct * 6 * ramp * (0.8 + rand() * 0.12))
    const status = w === 0 ? 'Awaiting Verification' : w === 1 ? 'Pending Approval' : 'Paid'
    const verifiedDays = w === 0 ? Math.round(workerDays * (0.55 + rand() * 0.25)) : workerDays
    const gross = round(workerDays * AVG_DAILY_WAGE + int(0, 40) * 500, 100)
    const overtime = round(gross * (rand() * 0.05), 100)
    const advanceRecovery = w >= 2 && rand() < 0.5 ? int(1, 6) * 1000 : 0
    return {
      id: `PR-${p.id.slice(2)}-${pad(weeks - w, 2)}`,
      projectId: p.id,
      weekEnding,
      workers: Math.round(direct * ramp),
      workerDays,
      verifiedDays,
      gross,
      overtime,
      advanceRecovery,
      net: gross + overtime - advanceRecovery,
      status,
      paidOn: status === 'Paid' ? notAfterToday(addDays(weekEnding, 2)) : null,
    }
  })
})

const CONTRACTORS = ['Shree Labour Co.', 'BuildForce Contractors', 'Prime Shuttering Works', 'Shree Labour Co.', 'BuildForce Contractors']
const RA_WORKS = ['Excavation & disposal', 'Footing shuttering', 'Raft reinforcement labour', 'PCC & levelling', 'Dewatering']
const siteContractorBills = active.length
  ? CONTRACTORS.map((contractor, i) => {
      const p = pick(active)
      const gross = int(3, 12) * 100000 + int(0, 9) * 5000
      const retention = round(gross * 0.05, 100)
      const tds = round(gross * 0.02, 100)
      const date = sinceStart(p, 55)
      const status = ['Pending Verification', 'Pending Approval', 'Approved', 'Paid', 'Paid'][i % 5]
      return {
        id: `RA-${pad(701 + i, 3)}`,
        billNo: `RA-${CONTRACTORS.slice(0, i + 1).filter((c) => c === contractor).length}`,
        contractor,
        work: RA_WORKS[i % RA_WORKS.length],
        projectId: p.id,
        date,
        certifiedBy: pick(ENGINEERS),
        gross,
        retention,
        tds,
        net: gross - retention - tds,
        status,
        paidOn: status === 'Paid' ? notAfterToday(addDays(date, int(5, 12))) : null,
      }
    }).sort((a, b) => b.date.localeCompare(a.date))
  : []

// Work orders and mobilisation advances per contractor (demo)
export const contractorWorkOrders = active.length
  ? [
      { contractor: 'Shree Labour Co.', woNo: 'WO-031', scope: 'Civil labour: excavation, PCC, raft', value: 4800000, advance: 100000, tdsSection: '194C', panType: 'Company' },
      { contractor: 'BuildForce Contractors', woNo: 'WO-032', scope: 'Footing & raft shuttering, dewatering', value: 3600000, advance: 75000, tdsSection: '194C', panType: 'Company' },
      { contractor: 'Prime Shuttering Works', woNo: 'WO-033', scope: 'Shuttering labour', value: 2200000, advance: 0, tdsSection: '194C', panType: 'Firm' },
    ].map((w, i) => ({ ...w, id: w.woNo, projectId: active[0].id, advanceDate: w.advance ? ago(Math.min(62, age(active[0])) - i * 3) : null }))
  : []

// Completed villa project: work orders fully billed and paid; 5% retention still held
const villaWorkOrders = completed.flatMap((p) => [
  { contractor: 'BuildForce Contractors', woNo: 'WO-011', scope: 'Villa civil & structure (24 villas)', value: 64000000, bills: 8, from: 60, to: 700 },
  { contractor: 'Prime Shuttering Works', woNo: 'WO-012', scope: 'Villa finishing: plaster, tiling, painting', value: 31000000, bills: 6, from: 480, to: 860 },
].map((w) => ({ ...w, id: w.woNo, projectId: p.id, advance: 0, advanceDate: null, tdsSection: '194C', panType: 'Company', completed: true })))
contractorWorkOrders.push(...villaWorkOrders.map(({ bills, from, to, ...w }) => w))

const VILLA_WORKS = { 'WO-011': ['Footings & plinth', 'Ground floor slab', 'First floor slab', 'Roof slab', 'Masonry', 'Compound walls', 'External works', 'Final measurement'],
  'WO-012': ['Internal plaster', 'Flooring & tiling', 'Bathroom tiling', 'Painting (internal)', 'Painting (external)', 'Final measurement'] }
const villaContractorBills = villaWorkOrders.flatMap((w) => {
  const p = completed.find((x) => x.id === w.projectId)
  const weights = Array.from({ length: w.bills }, () => 0.7 + rand3() * 0.6)
  const total = weights.reduce((s, x) => s + x, 0)
  let billed = 0
  return weights.map((wt, i) => {
    const gross = i === w.bills - 1 ? w.value - billed : round((w.value * wt) / total, 1000)
    billed += gross
    const date = addDays(p.startDate, Math.round(w.from + ((w.to - w.from) * i) / Math.max(1, w.bills - 1)))
    return {
      id: `RA-${w.woNo.slice(3)}${pad(i + 1, 2)}`,
      woNo: w.woNo,
      contractor: w.contractor,
      work: VILLA_WORKS[w.woNo][i] || 'Measured work',
      projectId: p.id,
      date,
      certifiedBy: p.manager,
      gross,
      retention: round(gross * 0.05, 100),
      tds: round(gross * 0.02, 100),
      status: 'Paid',
      paidOn: addDays(date, int3(7, 15)),
    }
  })
})
export const contractorBills = [...siteContractorBills, ...villaContractorBills].sort((a, b) => b.date.localeCompare(a.date))

// Recover 20% of each RA bill's gross until the advance is cleared (oldest bill first).
// Shree Labour Co.'s first bill is the textbook case: ₹5 lakh bill, ₹1 lakh advance.
;(() => {
  // Advances and bill numbers are per work order
  const woFor = (b) => b.woNo || contractorWorkOrders.find((w) => w.contractor === b.contractor && w.projectId === b.projectId)?.woNo
  const remaining = Object.fromEntries(contractorWorkOrders.map((w) => [w.woNo, w.advance]))
  const count = {}
  ;[...contractorBills].sort((a, b) => a.date.localeCompare(b.date)).forEach((b) => {
    b.woNo = woFor(b)
    count[b.woNo] = (count[b.woNo] || 0) + 1
    b.billNo = `RA-${count[b.woNo]}` // number bills in date order
    if (b.contractor === 'Shree Labour Co.' && b.billNo === 'RA-1') {
      b.gross = 500000
      b.retention = round(b.gross * 0.05, 100)
      b.tds = round(b.gross * 0.02, 100)
    }
    b.advanceRecovery = Math.min(remaining[b.woNo] || 0, round(b.gross * 0.2, 100))
    remaining[b.woNo] = (remaining[b.woNo] || 0) - b.advanceRecovery
    b.net = b.gross - b.retention - b.tds - b.advanceRecovery
    b.paymentRef = b.paidOn ? `UTR${(isCompleted(b.projectId) ? int3 : int2)(10000000, 99999999)}` : null
  })
})()

export const labourAdvances = D.labourAdvances

// ---------- E. financial approval requests ----------
const APPROVAL_TEMPLATES = [
  { type: 'Expense Claim', title: 'Diesel for JCB & tippers (week)', amount: () => int(18, 46) * 1000 },
  { type: 'Expense Claim', title: 'Soil testing lab: final bearing capacity report', amount: () => int(70, 95) * 1000 },
  { type: 'Expense Claim', title: 'Water tanker supply for curing', amount: () => int(12, 30) * 1000 },
  { type: 'Petty Cash', title: 'Petty cash top-up: Tower A site office', amount: () => int(10, 20) * 1000 },
  { type: 'Petty Cash', title: 'Petty cash top-up: Tower B site office', amount: () => int(10, 20) * 1000, requestedBy: ACCOUNTS_USER },
  { type: 'Labour Advance', title: `Advance for ${D.labourAdvances[0]?.labourer || 'site worker'}`, amount: () => int(4, 9) * 1000 },
  { type: 'Labour Advance', title: 'Festival advance: 12 masons', amount: () => int(30, 48) * 1000 },
  { type: 'Supplier Payment', title: 'Release payment: Steel Supply Co.', amount: () => int(9, 16) * 100000, approverRole: 'Admin' },
  { type: 'Supplier Payment', title: 'Release payment: Cement Traders', amount: () => int(3, 7) * 100000, approverRole: 'Admin' },
  { type: 'Wage Payroll', title: 'Weekly payroll release', amount: () => payrollBatches.find((b) => b.status === 'Pending Approval')?.net ?? int(4, 6) * 100000, approverRole: 'Admin' },
  { type: 'Contractor Bill', title: 'RA bill #2: Shree Labour Co.', amount: () => int(4, 9) * 100000, approverRole: 'Admin' },
  { type: 'Customer Refund', title: 'Booking cancellation refund (unit B-704)', amount: () => int(70, 90) * 10000, approverRole: 'Admin' },
]
export const FINANCE_APPROVAL_TYPES = [...new Set([...APPROVAL_TEMPLATES.map((t) => t.type).filter((t) => t !== 'Supplier Payment'), ...(completed.length ? ['Retention Release'] : [])])]

export const financeApprovals = active.length
  ? APPROVAL_TEMPLATES.map((t, i) => ({
      id: `FA-${pad(201 + i, 3)}`,
      type: t.type,
      title: t.title,
      amount: t.amount(),
      projectId: pick(active).id,
      requestedBy: t.requestedBy || pick([...ENGINEERS, 'Rahul Mehta']),
      approverRole: t.approverRole || 'Accountant (within limit) or Admin',
      date: ago(int(0, 8)),
      priority: rand() < 0.3 ? 'High' : 'Normal',
      status: 'Pending',
    }))
  : []
// Completed villa: release 50% of retention on completion (balance after the defect period)
villaWorkOrders.slice(0, 1).forEach((w) => {
  const held = contractorBills.filter((b) => b.woNo === w.woNo).reduce((s, b) => s + b.retention, 0)
  financeApprovals.push({
    id: 'FA-V01', type: 'Retention Release', title: `Release 50% retention on completion: ${w.contractor} (${w.woNo})`,
    // Same request the Admin sees (APR-V01); held retention shown for reference
    amount: D.approvals.find((a) => a.id === 'APR-V01')?.amount ?? round(held / 2, 100), projectId: w.projectId, requestedBy: ACCOUNTS_USER, approverRole: 'Admin',
    date: ago(24), priority: 'Normal', status: 'Pending',
  })
})
// Supplier payment releases are decided on the supplier invoice (Admin), not as a generic request
for (let i = financeApprovals.length - 1; i >= 0; i -= 1) if (financeApprovals[i].type === 'Supplier Payment') financeApprovals.splice(i, 1)
financeApprovals.sort((a, b) => b.date.localeCompare(a.date))

// ---------- F. budget plan by cost head (for budget vs actual) ----------
// Lifetime budget split and a planned-spend-to-date curve per head.
const HEAD_SPLIT = { Material: 0.46, Labour: 0.17, Contractor: 0.16, Equipment: 0.09, Overheads: 0.12 }
export const budgetHeads = active.flatMap((p) => {
  const plannedToDate = p.spent * 1e7 * (0.92 + rand() * 0.1)
  return D.EXPENSE_CATEGORIES.map((head) => ({
    projectId: p.id,
    head,
    lifetimeBudget: round(p.budget * 1e7 * (HEAD_SPLIT[head] ?? 0.05), 100000),
    // Early stage: equipment front-loaded, material behind plan
    plannedToDate: round(plannedToDate * ({ Material: 0.44, Labour: 0.19, Contractor: 0.14, Equipment: 0.16, Overheads: 0.07 }[head] ?? 0.05), 10000),
  }))
})

// Completed projects: planned = full budget (final cost vs budget)
completed.forEach((p) => {
  const SPLIT = { Material: 0.44, Labour: 0.18, Contractor: 0.21, Equipment: 0.07, Overheads: 0.1 }
  D.EXPENSE_CATEGORIES.forEach((head) => {
    const lifetimeBudget = round(p.budget * 1e7 * (SPLIT[head] ?? 0.05), 100000)
    budgetHeads.push({ projectId: p.id, head, lifetimeBudget, plannedToDate: lifetimeBudget })
  })
})

// Cash-in-hand / bank opening balance at project start (for cash flow)
export const openingBalance = round(1.5e7, 100000)
