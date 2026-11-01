/**
 * DEMO DATA ONLY: illustrative records for the Admin Dashboard prototype.
 * Scenario: one apartment project at its starting stage (excavation & foundation).
 * Nothing here is real company data. Records are generated with a fixed seed,
 * relative to today's date and never before the project start date.
 * Replace with backend responses via src/services/dashboardService.js.
 */
import { projects as baseProjects, VILLA } from '../mockData.js'
import { addDays, diffDays, todayISO } from '../../utils/date.js'
import { PURCHASE_ORDERS, SUPPLIER_INVOICES } from './procurementDemo.js'
import { MATERIAL_CATALOG, RECEIPTS } from './inventoryDemo.js'

// ---------- deterministic random helpers ----------
function mulberry32(seed) {
  return function () {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
const rand = mulberry32(20261012)
const int = (min, max) => Math.floor(rand() * (max - min + 1)) + min
const pick = (arr) => arr[Math.floor(rand() * arr.length)]
const round = (n, to = 100) => Math.round(n / to) * to

const T = todayISO()
const ago = (n) => addDays(T, -n)
const ahead = (n) => addDays(T, n)
const pad = (n, w = 4) => String(n).padStart(w, '0')

const FIRST = ['Ramesh', 'Sunil', 'Arif', 'Lakshmi', 'Prakash', 'Ajay', 'Kavita', 'Ravi', 'Manoj', 'Deepa', 'Imran', 'Pooja', 'Ganesh', 'Farhan', 'Anjali', 'Vijay', 'Sita', 'Harish', 'Nisha', 'Kiran']
const LAST = ['Kumar', 'Yadav', 'Khan', 'Devi', 'Gowda', 'Singh', 'Sharma', 'Rao', 'Patil', 'Nair', 'Reddy', 'Das', 'Joshi', 'Menon', 'Iyer']
const person = () => `${pick(FIRST)} ${pick(LAST)}`
const ENGINEERS = ['Karan Joshi', 'Meera Pillai', 'Suresh Patil']
const VENDORS = ['Steel Supply Co.', 'Cement Traders', 'Stone & Aggregates', 'Formwork Depot', 'Chem Protect', 'Earthmovers Rentals']
const CONTRACTORS = ['Shree Labour Co.', 'BuildForce Contractors', 'Prime Shuttering Works', 'Earthmovers Rentals']
const TOWERS = ['Tower A', 'Tower B']

export const DEMO_NOTICE = 'Demo data: generated for UI review only, not real company figures.'

// ---------- projects ----------
export const projects = baseProjects
export const activeProjects = projects.filter((p) => p.status !== 'Completed')
const residential = projects.filter((p) => p.type !== 'Infrastructure')
const age = (p) => Math.max(1, diffDays(p.startDate, T)) // days since start
const MAX_AGE = Math.max(1, ...activeProjects.map(age))
const sinceStart = (p, maxDays) => ago(int(0, Math.min(maxDays, age(p))))

// ---------- completed projects (villas) ----------
// Own random stream, so adding the villa project doesn't change any figure above or below.
const randV = mulberry32(20261102)
const intV = (min, max) => Math.floor(randV() * (max - min + 1)) + min
const pickV = (arr) => arr[Math.floor(randV() * arr.length)]
export const completedProjects = projects.filter((p) => p.status === 'Completed')
const selling = residential.filter((p) => p.status !== 'Completed')

// Lifetime construction cost, weekly, heavier in the middle of the build
const villaExpenses = completedProjects.flatMap((p) => {
  const end = p.completedOn || T
  const weeks = Math.max(1, Math.floor(diffDays(p.startDate, end) / 7))
  const split = { Material: 0.45, Labour: 0.18, Contractor: 0.2, Equipment: 0.07, Overheads: 0.1 }
  const weights = Array.from({ length: weeks }, (_, w) => 0.35 + Math.sin((Math.PI * (w + 0.5)) / weeks))
  const total = weights.reduce((s, x) => s + x, 0)
  return weights.flatMap((wt, w) =>
    Object.entries(split).map(([category, share]) => ({
      date: addDays(p.startDate, w * 7),
      projectId: p.id,
      category,
      amount: round(((p.spent * 1e7 * wt) / total) * share * (0.85 + randV() * 0.3), 1000),
    }))
  )
})

// Every villa sold during construction. V-07 and V-15 still owe the possession instalment.
const VILLA_DUES = { 7: { customer: 'Sanjay Kulkarni', value: 24000000, dueAfter: 20 }, 15: { customer: 'Meenal Joshi', value: 21000000, dueAfter: 35 } }
const villaBookings = completedProjects.flatMap((p) =>
  Array.from({ length: p.units }, (_, i) => {
    const n = i + 1
    const fixed = VILLA_DUES[n]
    return {
      projectId: p.id,
      date: addDays(p.startDate, intV(20, 520)),
      customer: fixed?.customer || `${pickV(FIRST)} ${pickV(LAST)}`,
      unit: `V-${String(n).padStart(2, '0')}`,
      value: fixed?.value || intV(185, 260) * 100000,
      villaNo: n,
    }
  })
)
  .sort((a, b) => a.date.localeCompare(b.date))
  .map((b, i) => ({ ...b, id: `BK-V${pad(i + 1, 3)}` }))

// Construction-linked plan for villas; instalments fall due as milestones are reached
const VILLA_PLAN = [
  ['Booking amount (10%)', 0.1, (b) => b.date],
  ['On agreement (15%)', 0.15, (b) => addDays(b.date, 30)],
  ['Plinth completion (15%)', 0.15, (b, p) => addDays(p.startDate, 200)],
  ['Structure complete (25%)', 0.25, (b, p) => addDays(p.startDate, 470)],
  ['Finishing & services (20%)', 0.2, (b, p) => addDays(p.startDate, 720)],
]
const villaCollections = villaBookings.flatMap((b) => {
  const p = projects.find((x) => x.id === b.projectId)
  const rows = VILLA_PLAN.map(([milestone, share, due]) => {
    const d = due(b, p)
    const date = d < addDays(b.date, 30) && share !== 0.1 ? addDays(b.date, 30) : d
    return { milestone, amount: round(b.value * share, 1000), date, status: 'Received' }
  })
  const fixed = VILLA_DUES[b.villaNo]
  const possessionDue = fixed ? addDays(p.completedOn, fixed.dueAfter) : addDays(p.completedOn, intV(5, Math.max(6, diffDays(p.completedOn, p.handoverBy))))
  const paidOn = addDays(possessionDue, intV(0, 50))
  rows.push({
    milestone: 'On possession (15%)',
    amount: round(b.value * 0.15, 1000),
    // Received rows carry the date the money came in; open rows carry the due date
    date: fixed ? possessionDue : paidOn > T ? T : paidOn,
    status: fixed ? 'Overdue' : 'Received',
  })
  return rows.map((r, j) => ({ id: `COL-V${pad(b.villaNo, 2)}${j + 1}`, projectId: b.projectId, bookingId: b.id, unit: b.unit, customer: b.customer, ...r }))
})

// Defect liability period: complaints from villa owners after handover
const villaDefects = completedProjects.flatMap((p) => [
  { id: 'DF-V01', projectId: p.id, description: 'Terrace waterproofing seepage, villa V-12', severity: 'Major', reported: ago(9), status: 'In Progress' },
  { id: 'DF-V02', projectId: p.id, description: 'Hairline cracks in compound wall, villa V-19', severity: 'Minor', reported: ago(4), status: 'Open' },
])

const villaActivity = completedProjects.flatMap((p) => [
  [2, 'finance', 'Final instalment reminder sent: villa V-07 (possession on hold)', 'Accounts Team'],
  [5, 'project', 'Waterproofing contractor inspected villa V-12 terrace', 'Nikhil Deshpande'],
  [9, 'safety', 'Defect complaint logged by owner: V-12 terrace seepage', 'Nikhil Deshpande'],
  [16, 'sales', 'Society formation documents handed to villa owners association', 'Admin User'],
  [24, 'finance', 'Retention release request raised for villa civil contractor', 'Accounts Team'],
].map(([days, type, text, actor], i) => ({
  id: `ACT-V${i}`, date: `${ago(days)}T${String(intV(9, 18)).padStart(2, '0')}:${String(intV(0, 59)).padStart(2, '0')}`,
  projectId: p.id, type, text, actor,
})))

// ---------- labour ----------
export const LABOUR_CATEGORIES = ['Helper', 'Mason', 'Bar Bender', 'Carpenter', 'Machine Operator', 'Welder', 'Electrician', 'Plumber']
// Typical early-stage crew: mostly helpers, steel and shuttering
const CATEGORY_RANGE = {
  Helper: [32, 42], Mason: [10, 14], 'Bar Bender': [12, 16], Carpenter: [8, 12],
  'Machine Operator': [4, 6], Welder: [2, 4], Electrician: [1, 2], Plumber: [1, 2],
}

export const labourRoster = activeProjects.flatMap((p) =>
  LABOUR_CATEGORIES.map((category) => {
    const registered = int(...CATEGORY_RANGE[category])
    const contractor = category === 'Machine Operator' || category === 'Electrician' ? 0 : Math.round(registered * (0.55 + rand() * 0.3))
    return {
      projectId: p.id,
      category,
      registered,
      contractor,
      direct: registered - contractor,
      presentToday: Math.round(registered * (0.78 + rand() * 0.18)),
    }
  })
)

const registeredByProject = Object.fromEntries(
  activeProjects.map((p) => [p.id, labourRoster.filter((r) => r.projectId === p.id).reduce((s, r) => s + r.registered, 0)])
)
const presentTodayByProject = Object.fromEntries(
  activeProjects.map((p) => [p.id, labourRoster.filter((r) => r.projectId === p.id).reduce((s, r) => s + r.presentToday, 0)])
)

// Daily attendance since project start; crew ramps up over the first weeks
export const attendanceDaily = activeProjects.flatMap((p) => {
  const total = registeredByProject[p.id]
  const days = age(p)
  const rows = []
  for (let i = 0; i <= days; i++) {
    const date = ago(i)
    const isSunday = new Date(date + 'T00:00').getDay() === 0
    const ramp = Math.min(1, 0.35 + ((days - i) / Math.max(1, days)) * 1.3)
    const strength = Math.round(total * ramp)
    const present = i === 0
      ? presentTodayByProject[p.id]
      : Math.round(strength * (isSunday ? 0.25 + rand() * 0.15 : 0.74 + rand() * 0.2))
    rows.push({ date, projectId: p.id, present, absent: strength - present })
  }
  return rows
})

export const attendanceVerification = Array.from({ length: 4 }, (_, i) => {
  const p = pick(activeProjects)
  return {
    id: `AV-${pad(301 + i)}`,
    projectId: p.id,
    date: ago(int(0, 3)),
    submittedBy: pick(ENGINEERS),
    workers: int(35, 70),
    note: pick([`Daily muster roll: ${pick(TOWERS)}`, 'Overtime hours to confirm (night excavation)', 'Correction requested: 3 entries', 'Late punch-ins flagged']),
  }
})

export const labourRequirements = [
  { category: 'Bar Bender', qty: 8, note: 'Raft reinforcement, Tower A' },
  { category: 'Carpenter', qty: 6, note: 'Footing shuttering, Tower B' },
  { category: 'Helper', qty: 15, note: 'Excavation & PCC, Tower B' },
  { category: 'Mason', qty: 4, note: 'Plinth masonry prep' },
].map((r, i) => ({
  id: `LR-${pad(121 + i)}`,
  projectId: activeProjects[0]?.id,
  ...r,
  neededBy: ahead(int(2, 14)),
  requestedBy: pick(ENGINEERS),
  status: 'Pending',
}))

export const wagePayroll = activeProjects.flatMap((p, i) => [
  { id: `WP-${pad(501 + i * 3)}`, projectId: p.id, period: `Week ending ${ago(1)}`, amount: round(registeredByProject[p.id] * 6 * int(720, 820), 1000), status: 'Pending' },
  { id: `WP-${pad(502 + i * 3)}`, projectId: p.id, period: `Week ending ${ago(8)}`, amount: round(registeredByProject[p.id] * 6 * int(720, 820), 1000), status: 'Paid' },
  { id: `WP-${pad(503 + i * 3)}`, projectId: p.id, period: `Week ending ${ago(15)}`, amount: round(registeredByProject[p.id] * 6 * int(700, 800), 1000), status: 'Paid' },
])

export const labourAdvances = Array.from({ length: 6 }, (_, i) => {
  const p = pick(activeProjects)
  const amount = int(3, 20) * 1000
  return {
    id: `LA-${pad(71 + i)}`,
    labourer: person(),
    projectId: p.id,
    date: sinceStart(p, 60),
    amount,
    recovered: i % 3 === 0 ? amount : int(0, Math.floor(amount / 2000)) * 1000,
  }
})

// ---------- expenses & payments (reconcile with project.spent) ----------
// Early stage: heavy on earthwork machinery, steel and cement
const EXPENSE_SPLIT = { Material: 0.4, Labour: 0.2, Contractor: 0.14, Equipment: 0.19, Overheads: 0.07 }
export const EXPENSE_CATEGORIES = Object.keys(EXPENSE_SPLIT)

export const expenses = [...activeProjects.flatMap((p) => {
  const rows = []
  const days = age(p)
  const base = (p.spent * 1e7) / Math.max(1, Math.ceil(days / 3)) // spend per 3-day period
  for (let i = 0; i <= days; i += 3) {
    for (const [category, share] of Object.entries(EXPENSE_SPLIT)) {
      rows.push({ date: ago(i), projectId: p.id, category, amount: round(base * share * (0.7 + rand() * 0.6), 1000) })
    }
  }
  return rows
}), ...villaExpenses]

const PAYMENT_TYPES = ['Supplier', 'Contractor', 'Wages', 'Equipment Hire']
export const payments = Array.from({ length: 20 }, (_, i) => {
  const p = pick(activeProjects)
  const daysAgo = int(0, Math.min(70, age(p)))
  const type = pick(PAYMENT_TYPES)
  const payee = type === 'Supplier' ? pick(VENDORS) : type === 'Contractor' ? pick(CONTRACTORS) : type === 'Wages' ? 'Site payroll' : 'Earthmovers Rentals'
  return {
    id: `PAY-${pad(801 + i)}`,
    date: ago(daysAgo),
    projectId: p.id,
    type,
    payee,
    amount: int(1, 14) * 50000,
    status: daysAgo <= 10 && rand() < 0.75 ? 'Pending' : 'Completed',
  }
}).sort((a, b) => b.date.localeCompare(a.date))

// ---------- purchase ----------
export const MATERIALS = [
  { name: 'Cement OPC 53', unit: 'Bags', rate: 410, reorder: 800 },
  { name: 'TMT Steel 8mm', unit: 'Tonnes', rate: 63000, reorder: 5 },
  { name: 'TMT Steel 12mm', unit: 'Tonnes', rate: 62000, reorder: 20 },
  { name: 'TMT Steel 16mm', unit: 'Tonnes', rate: 61500, reorder: 15 },
  { name: 'M-Sand', unit: 'Cu.m', rate: 1450, reorder: 150 },
  { name: 'Aggregate 20mm', unit: 'Cu.m', rate: 1650, reorder: 120 },
  { name: 'Shuttering Plywood 12mm', unit: 'Sheets', rate: 1450, reorder: 150 },
  { name: 'Binding Wire', unit: 'Kg', rate: 85, reorder: 300 },
  { name: 'Anti-termite Chemical', unit: 'Litres', rate: 420, reorder: 40 },
  { name: 'Diesel (machinery)', unit: 'Litres', rate: 92, reorder: 500 },
]

export const materialRequests = Array.from({ length: 6 }, (_, i) => {
  const m = pick(MATERIALS)
  const p = pick(activeProjects)
  return {
    id: `MR-${pad(1201 + i)}`,
    date: sinceStart(p, 20),
    projectId: p.id,
    material: m.name,
    qty: Math.max(1, Math.round(m.reorder * (0.3 + rand()))),
    unit: m.unit,
    requestedBy: pick(ENGINEERS),
    status: i < 4 ? 'Pending' : 'Approved',
  }
}).sort((a, b) => b.date.localeCompare(a.date))

const PO_STATUSES = ['Pending Approval', 'Issued', 'Issued', 'Partially Received', 'Received', 'Received']
// Each material comes from the supplier that sells it
export const SUPPLIER_FOR = {
  'Cement OPC 53': 'Cement Traders', 'TMT Steel 8mm': 'Steel Supply Co.', 'TMT Steel 12mm': 'Steel Supply Co.',
  'TMT Steel 16mm': 'Steel Supply Co.', 'Binding Wire': 'Steel Supply Co.', 'M-Sand': 'Stone & Aggregates',
  'Aggregate 20mm': 'Stone & Aggregates', 'Shuttering Plywood 12mm': 'Formwork Depot', 'Anti-termite Chemical': 'Chem Protect',
  'Diesel (machinery)': 'Local Fuel Station',
}
// Earlier random PO list: still drawn so the demo figures generated after it stay the same,
// but no screen uses it. Every screen reads the shared register (procurementDemo.js).
export const legacyPurchaseOrders = Array.from({ length: 12 }, (_, i) => {
  const m = pick(MATERIALS)
  const p = pick(activeProjects)
  const daysAgo = int(0, Math.min(70, age(p)))
  const status = daysAgo > 30 ? 'Received' : pick(PO_STATUSES)
  return {
    id: `PO-${pad(2301 + i)}`,
    date: ago(daysAgo),
    projectId: p.id,
    vendor: ((random) => SUPPLIER_FOR[m.name] ?? random)(pick(VENDORS)), // always draw, so later records stay the same
    material: m.name,
    amount: round(m.rate * m.reorder * (0.4 + rand() * 1.2), 1000),
    expected: addDays(ago(daysAgo), int(4, 15)),
    status,
  }
}).sort((a, b) => b.date.localeCompare(a.date))

// The first invoiced PO is the classic matching case used on the Accountant pages:
// 500 cement bags ordered, 480 received at the store, 500 billed by the supplier.
;(() => {
  const po = legacyPurchaseOrders.find((p) => p.status === 'Received' || p.status === 'Partially Received')
  if (po) Object.assign(po, { material: 'Cement OPC 53', vendor: 'Cement Traders', amount: 500 * 410, status: 'Received' })
})()

export const legacySupplierInvoices = legacyPurchaseOrders
  .filter((po) => po.status === 'Received' || po.status === 'Partially Received')
  .slice(0, 7)
  .map((po, i) => {
    const d = addDays(po.date, int(3, 10))
    return {
      id: `SI-${pad(4401 + i)}`,
      date: d > T ? T : d,
      vendor: po.vendor,
      projectId: po.projectId,
      poId: po.id,
      amount: po.amount,
      status: i < 4 ? 'Awaiting Verification' : i === 4 ? 'Disputed' : 'Verified',
    }
  })

// ---------- Purchase orders and supplier invoices: the shared register ----------
// Same PO numbers, suppliers, quantities, projects and statuses as the Store Keeper, Purchase
// Orders and Accountant pages. Receipt status comes from the Store Keeper's goods receipts.
function receiptStatusOf(po) {
  if (po.approval !== 'Approved') return po.approval
  if (po.receivedBeforeStockRecords) return 'Received'
  const delivered = RECEIPTS.filter((g) => g.po === po.id).reduce((s, g) => s + g.delivered, 0)
  return !po.sku ? 'Received' : delivered >= po.qty ? 'Received' : delivered > 0 ? 'Partially Received' : 'Issued'
}
export const purchaseOrders = PURCHASE_ORDERS.map((po) => ({
  id: po.id, date: po.date, projectId: po.projectId, vendor: po.vendor,
  material: po.sku ? MATERIAL_CATALOG.find((m) => m.sku === po.sku)?.name : po.item,
  amount: po.amount, expected: po.expected, status: receiptStatusOf(po),
})).sort((a, b) => b.date.localeCompare(a.date))
export const supplierInvoices = SUPPLIER_INVOICES.map((inv) => {
  const po = PURCHASE_ORDERS.find((p) => p.id === inv.poId)
  return { id: inv.id, date: inv.date, vendor: po.vendor, projectId: po.projectId, poId: po.id, amount: Math.round(inv.qty * po.rate), status: inv.historic ? 'Verified' : 'Awaiting Verification' }
})

// ---------- inventory (site store) ----------
export const stock = activeProjects.flatMap((p) =>
  MATERIALS.map((m) => {
    const r = rand()
    const qty = r < 0.1 ? 0 : r < 0.4 ? Math.round(m.reorder * (0.2 + rand() * 0.7)) : Math.round(m.reorder * (1.1 + rand() * 1.2))
    return {
      projectId: p.id,
      material: m.name,
      unit: m.unit,
      rate: m.rate,
      reorder: m.reorder,
      qty,
      damaged: rand() < 0.2 ? Math.max(1, Math.round(m.reorder * 0.02 * rand())) : 0,
    }
  })
)

export const materialTransactions = Array.from({ length: 40 }, (_, i) => {
  const m = pick(MATERIALS)
  const p = pick(activeProjects)
  const type = rand() < 0.45 ? 'Receipt' : 'Issue'
  const qty = Math.max(1, Math.round(m.reorder * (0.1 + rand() * 0.5)))
  return {
    id: `${type === 'Receipt' ? 'GRN' : 'MI'}-${pad(6001 + i)}`,
    date: sinceStart(p, 200),
    projectId: p.id,
    type,
    material: m.name,
    qty,
    unit: m.unit,
    value: qty * m.rate,
    by: pick(ENGINEERS),
  }
}).sort((a, b) => b.date.localeCompare(a.date))

// ---------- sales ----------
export const units = residential.map((p) => {
  const total = p.units
  const sold = p.unitsSold ?? Math.round(total * Math.min(0.93, (p.progress / 100) * 0.75 + 0.12))
  const booked = p.unitsBooked ?? Math.min(total - sold, Math.round(total * 0.08))
  return { projectId: p.id, total, sold, booked, available: total - sold - booked }
})

const LEAD_SOURCES = ['Website', 'Walk-in', 'Referral', 'Broker', 'Social Ads', 'Property Portal']
const LEAD_STAGES = ['New', 'Contacted', 'Follow-up', 'Site Visit Scheduled', 'Negotiation', 'Booked', 'Lost']
export const leads = selling.length
  ? Array.from({ length: 64 }, (_, i) => {
      const p = pick(selling)
      const stage = pick(LEAD_STAGES)
      const open = !['Booked', 'Lost'].includes(stage)
      return {
        id: `LD-${pad(901 + i)}`,
        date: ago(int(0, age(p) + 30)), // pre-launch enquiries included
        projectId: p.id,
        name: person(),
        source: pick(LEAD_SOURCES),
        stage,
        nextFollowUp: open ? ahead(int(-3, 10)) : null,
        siteVisit: stage === 'Site Visit Scheduled' ? ahead(int(0, 9)) : null,
        owner: pick(['Anita Rao', 'Vikram Shah']),
      }
    }).sort((a, b) => b.date.localeCompare(a.date))
  : []

// One booking per booked/sold unit, all since launch (projects still selling)
const sellingBookings = units.filter((u) => selling.some((p) => p.id === u.projectId)).flatMap((u) => {
  const p = projects.find((x) => x.id === u.projectId)
  return Array.from({ length: u.booked + u.sold }, (_, i) => ({
    id: `BK-${pad(311 + i)}`,
    date: sinceStart(p, 200),
    projectId: p.id,
    customer: person(),
    unit: `${pick(['A', 'B'])}-${int(1, 12)}0${int(1, 5)}`,
    value: (rand() < 0.6 ? int(78, 92) : int(118, 138)) * 100000, // 2BHK or 3BHK
  }))
}).sort((a, b) => b.date.localeCompare(a.date))
export const bookings = [...sellingBookings, ...villaBookings].sort((a, b) => b.date.localeCompare(a.date))

// Construction-linked plan: 10% on booking, 10% on agreement (+30 days), 10% on plinth (upcoming)
const sellingCollections = sellingBookings.flatMap((b, i) => {
  const rows = [
    { milestone: 'Booking amount (10%)', date: b.date, status: 'Received' },
  ]
  const agreementDue = addDays(b.date, 30)
  rows.push({
    milestone: 'On agreement (10%)',
    date: agreementDue,
    status: agreementDue > T ? 'Due' : rand() < 0.75 ? 'Received' : 'Overdue',
  })
  if (i % 2 === 0) rows.push({ milestone: 'Plinth completion (10%)', date: ahead(int(18, 40)), status: 'Due' })
  return rows.map((r, j) => ({
    id: `COL-${pad(7001 + i * 3 + j)}`,
    projectId: b.projectId,
    bookingId: b.id,
    unit: b.unit,
    customer: b.customer,
    amount: round(b.value * 0.1, 1000),
    ...r,
  }))
}).sort((a, b) => b.date.localeCompare(a.date))
export const collections = [...sellingCollections, ...villaCollections].sort((a, b) => b.date.localeCompare(a.date))

// ---------- approvals ----------
const APPROVAL_TEMPLATES = {
  'Labour Request': () => ({ title: `${int(6, 15)} ${pick(['Bar Bender', 'Carpenter', 'Helper'])}s for ${pick(['raft reinforcement', 'footing shuttering', 'excavation', 'PCC'])}`, amount: null }),
  'Attendance Correction': () => ({ title: `Correct ${int(2, 6)} entries for ${ago(int(1, 4))}`, amount: null }),
  'Wage Payroll': () => ({ title: `Weekly payroll: ${int(70, 95)} workers`, amount: int(4, 6) * 100000 }),
  'Labour Advance': () => ({ title: `Advance for ${person()}`, amount: int(3, 15) * 1000 }),
  'Purchase Request': () => ({ title: `${pick(MATERIALS).name}: required for footing pour`, amount: int(2, 12) * 50000 }),
  'Purchase Order': () => ({ title: `PO to ${pick(VENDORS)}`, amount: int(3, 16) * 100000 }),
  'Contractor Bill': () => ({ title: `RA bill #${int(1, 3)}: ${pick(CONTRACTORS)}`, amount: int(3, 12) * 100000 }),
  'Supplier Invoice': () => ({ title: `Invoice from ${pick(VENDORS)}`, amount: int(2, 15) * 100000 }),
  'Payment Request': () => ({ title: `Release payment: ${pick(CONTRACTORS)}`, amount: int(2, 9) * 100000 }),
}
// Purchase requisitions, purchase orders and supplier invoices are decided from the shared
// procurement records (Needs your action / Purchase Orders / Accounts), not as generic approvals.
const PROCUREMENT_TYPES = ['Purchase Request', 'Purchase Order', 'Supplier Invoice']
export const APPROVAL_TYPES = [...Object.keys(APPROVAL_TEMPLATES).filter((t) => !PROCUREMENT_TYPES.includes(t)), ...(completedProjects.length ? ['Retention Release'] : [])]

const siteApprovals = activeProjects.length
  ? Object.keys(APPROVAL_TEMPLATES).flatMap((type, ti) =>
      Array.from({ length: int(1, 3) }, (_, i) => ({
        id: `APR-${pad(100 + ti * 10 + i)}`,
        type,
        ...APPROVAL_TEMPLATES[type](),
        projectId: pick(activeProjects).id,
        requestedBy: pick(ENGINEERS),
        date: ago(int(0, Math.min(9, MAX_AGE))),
        priority: rand() < 0.3 ? 'High' : 'Normal',
        status: 'Pending',
      }))
    ).sort((a, b) => b.date.localeCompare(a.date))
  : []

// Completed villas: release half of the civil contractor's 5% retention on completion
export const approvals = [
  ...siteApprovals,
  ...completedProjects.map((p) => ({
    id: 'APR-V01', type: 'Retention Release', title: 'Release 50% retention on completion: BuildForce Contractors (WO-011)',
    amount: Math.round((64000000 * 0.05) / 2), projectId: p.id, requestedBy: 'Accounts Team', date: ago(24), priority: 'Normal', status: 'Pending',
  })),
].filter((a) => !PROCUREMENT_TYPES.includes(a.type)).sort((a, b) => b.date.localeCompare(a.date))

// ---------- quality & safety (foundation stage) ----------
export const inspections = Array.from({ length: 6 }, (_, i) => {
  const date = addDays(T, int(-3, 8))
  return {
    id: `QI-${pad(201 + i)}`,
    projectId: pick(activeProjects).id,
    item: [
      'Excavation depth & level check: Tower B',
      'Footing reinforcement check: Tower A',
      'Concrete cube test (7-day): footings F1–F6',
      'PCC level check: grid C–E',
      'Anti-termite treatment check',
      'Soil bearing test report review',
    ][i],
    date,
    inspector: pick(['QA: R. Banerjee', 'QA: S. Kulkarni', 'Third-party: TPI Labs']),
    status: date < T ? 'Overdue' : 'Scheduled',
  }
}).sort((a, b) => a.date.localeCompare(b.date))

const siteDefects = [
  'Honeycombing in footing F3',
  'Cover blocks missing in raft reinforcement',
  'PCC surface uneven at grid C',
  'Shuttering bulge in column stub C7',
  'Water logging in excavated pit, Tower B',
].map((description, i) => {
  const p = pick(activeProjects)
  return {
    id: `DF-${pad(41 + i)}`,
    projectId: p.id,
    description,
    severity: ['Major', 'Major', 'Minor', 'Minor', 'Critical'][i],
    reported: sinceStart(p, 25),
    status: pick(['Open', 'In Progress']),
  }
})
export const defects = [...siteDefects, ...villaDefects]

export const correctiveActions = [
  'Chip and re-grout honeycombed area',
  'Place 50mm cover blocks before pour',
  'Re-level PCC with screed',
  'Re-fix and prop shuttering',
  'Install dewatering pump and sump',
].map((action, i) => ({
  id: `CA-${pad(11 + i)}`,
  defectId: defects[i].id,
  projectId: defects[i].projectId,
  action,
  owner: pick(ENGINEERS),
  due: ahead(int(-2, 7)),
  status: pick(['Open', 'In Progress', 'Done']),
}))

export const safetyIncidents = [
  ['Near miss', 'Excavation edge not barricaded near ramp'],
  ['First aid', 'Minor cut while cutting binding wire'],
  ['Near miss', 'JCB bucket swing close to helpers'],
  ['Property damage', 'Dewatering pump cable damaged by tipper'],
].map(([type, description], i) => {
  const p = pick(activeProjects)
  return {
    id: `SI-${pad(91 + i, 3)}`,
    date: sinceStart(p, 60),
    projectId: p.id,
    type,
    description,
    status: i < 1 ? 'Under investigation' : 'Closed',
  }
}).sort((a, b) => b.date.localeCompare(a.date))

export const safetyTasks = [
  'Barricade all excavation edges, Tower B',
  'Toolbox talk: excavation & trench safety',
  'Inspect shoring on north boundary',
  'PPE stock audit (helmets, boots)',
  'Fire extinguisher at diesel storage',
  'Refill first-aid kits',
].map((task, i) => {
  const due = ahead(int(-3, 10))
  return {
    id: `ST-${pad(61 + i)}`,
    projectId: pick(activeProjects).id,
    task,
    due,
    owner: pick(ENGINEERS),
    status: due < T ? 'Overdue' : 'Pending',
  }
})

// ---------- activity feed ----------
const ACTIVITY_TEMPLATES = [
  { type: 'project', text: (p) => `Progress updated: ${p.short} at ${p.progress}% (${p.stage || 'in progress'})` },
  { type: 'attendance', text: () => `Attendance submitted for ${pick(TOWERS)} (${int(35, 60)} workers)` },
  { type: 'purchase', text: () => `Purchase request raised for ${pick(MATERIALS).name}` },
  { type: 'approval', text: () => `PO-${pad(int(2301, 2312))} approved by Admin` },
  { type: 'approval', text: () => `Contractor bill returned: missing measurement sheet` },
  { type: 'inventory', text: () => `Goods received: ${pick(MATERIALS).name} at site store` },
  { type: 'sales', text: () => `New booking: flat ${pick(['A', 'B'])}-${int(1, 12)}0${int(1, 5)}` },
  { type: 'safety', text: () => `Near-miss reported at ${pick(TOWERS)} excavation` },
  { type: 'finance', text: () => `Payment request created for ${pick(CONTRACTORS)}` },
  { type: 'project', text: () => `Footing concrete poured: ${pick(['F1–F3', 'F4–F6', 'F7–F9'])}, ${pick(TOWERS)}` },
]

const siteActivity = activeProjects.length
  ? Array.from({ length: 26 }, (_, i) => {
      const t = pick(ACTIVITY_TEMPLATES)
      const p = pick(activeProjects)
      return {
        id: `ACT-${i}`,
        date: `${ago(int(0, Math.min(20, age(p))))}T${String(int(8, 19)).padStart(2, '0')}:${String(int(0, 59)).padStart(2, '0')}`,
        projectId: p.id,
        type: t.type,
        text: t.text(p),
        actor: pick([...ENGINEERS, 'Admin User', 'Accounts Team']),
      }
    }).sort((a, b) => b.date.localeCompare(a.date))
  : []

export const activity = [...siteActivity, ...villaActivity].sort((a, b) => b.date.localeCompare(a.date))
