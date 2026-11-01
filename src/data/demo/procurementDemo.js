/**
 * DEMO PROCUREMENT RECORDS: the single purchase-order register shared by the Store Keeper
 * (receiving), the Purchase Orders page, the Admin Dashboard (approvals) and the Accountant
 * (supplier invoices and payments). One record per PO; every screen reads this, so a PO keeps
 * the same number, supplier, quantity, project and status everywhere.
 *
 * Illustrative only. Nothing is saved; replace with API data in the backend phase.
 */
import { addDays, todayISO } from '../../utils/date.js'
import { PEOPLE } from './inventoryDemo.js'

const T = todayISO()
const ago = (n) => addDays(T, -n)
const at = (daysAgo, time = '10:00') => `${addDays(T, -daysAgo)}T${time}`

// ---------- Company policy (demo configuration) ----------
// Purchase orders up to this value are approved by the Purchase Manager; above it, by Admin.
export const PO_PM_APPROVAL_LIMIT = 100000
// Requisitions estimated above this value need Admin review before the Purchase Manager buys.
export const REQUISITION_ADMIN_REVIEW_ABOVE = 500000
// Supplier payments are always released by Admin (existing rule on the Accountant pages).
export const SUPPLIER_PAYMENT_APPROVER = 'Admin'

export const GST_BY_SKU = {
  'MAT-CEM-53': 28, 'MAT-STL-08': 18, 'MAT-STL-12': 18, 'MAT-STL-16': 18, 'MAT-BWR': 18, 'MAT-SND-M': 5, 'MAT-AGG-20': 5,
  'MAT-BRK-RED': 5, 'MAT-PLY-12': 18, 'MAT-ELC-25': 18, 'MAT-PLB-110': 18, 'MAT-TIL-600': 18, 'MAT-PNT-EXT': 18,
  'MAT-SAF-HLM': 18, 'MAT-ATT': 18, 'MAT-DSL': 0,
}
export const CREDIT_DAYS = {
  'Steel Supply Co.': 15, 'Cement Traders': 30, 'Stone & Aggregates': 21, 'Formwork Depot': 30, 'Chem Protect': 30,
  'Earthmovers Rentals': 15, 'Local Fuel Station': 7, 'Shree Bricks': 21, 'Volt Electricals': 30,
}

const PM = PEOPLE.purchaseManager
const approvedBy = (amount) => (amount > PO_PM_APPROVAL_LIMIT ? PEOPLE.admin : PM)

/** One PO = one material line (or a service). `approval` is the PO's own status; receipt status comes from GRNs. */
function po(id, o) {
  const amount = o.sku ? o.qty * o.rate : o.amount
  const approved = o.approval === 'Approved'
  return {
    id, raisedBy: PM, projectId: 'P-101', gstRate: o.sku ? GST_BY_SKU[o.sku] ?? 18 : 18, transport: 0, advancePct: 0,
    paymentTerms: `${CREDIT_DAYS[o.vendor] ?? 30} days credit`, followUps: [], originalExpected: o.expected,
    // Approved orders in the demo were sent to the supplier the day they were approved
    sentAt: approved ? `${addDays(o.date, 1)}T12:00` : null, sentBy: approved ? PM : null,
    ...o, amount,
    approvedBy: approved ? approvedBy(amount) : null,
    approvedAt: approved ? `${addDays(o.date, 1)}T11:00` : null,
    history: [
      { at: `${o.date}T10:00`, by: PM, role: 'Purchase Manager', action: 'PO raised', note: o.note || '' },
      ...(approved ? [{ at: `${addDays(o.date, 1)}T11:00`, by: approvedBy(amount), role: amount > PO_PM_APPROVAL_LIMIT ? 'Admin' : 'Purchase Manager', action: 'Approved' }] : []),
      ...(approved ? [{ at: `${addDays(o.date, 1)}T12:00`, by: PM, role: 'Purchase Manager', action: 'Sent to supplier' }] : []),
    ],
  }
}

export const PURCHASE_ORDERS = [
  // Current orders (receivable at the stores)
  po('PO-2316', { vendor: 'Steel Supply Co.', sku: 'MAT-STL-12', qty: 25, rate: 62000, storeId: 'SHA', date: ago(1), expected: addDays(T, 6), approval: 'Pending Approval', requisitionId: 'PR-3098', transport: 15000, note: 'Raft reinforcement, Tower A' }),
  po('PO-2315', { vendor: 'Steel Supply Co.', sku: 'MAT-BWR', qty: 500, rate: 85, storeId: 'CW', date: ago(2), expected: addDays(T, 5), approval: 'Draft', requisitionId: 'PR-3099', note: 'Draft: combine with steel delivery' }),
  po('PO-2314', { vendor: 'Cement Traders', sku: 'MAT-CEM-53', qty: 1500, rate: 410, storeId: 'SHA', date: ago(4), expected: addDays(T, 3), approval: 'Approved', requisitionId: 'PR-3100', advancePct: 16, note: 'Three lots of 500 / 600 / 400 bags' }),
  po('PO-2313', { vendor: 'Stone & Aggregates', sku: 'MAT-AGG-20', qty: 200, rate: 1650, storeId: 'SHA', date: ago(7), expected: addDays(T, 2), approval: 'Approved', dispatch: 'In transit' }),
  po('PO-2312', { vendor: 'Formwork Depot', sku: 'MAT-PLY-12', qty: 300, rate: 1450, storeId: 'SHA', date: ago(15), expected: ago(14), approval: 'Approved' }),
  po('PO-2311', { vendor: 'Earthmovers Rentals', sku: null, item: 'JCB + 2 tippers, 30 days hire', amount: 690000, storeId: null, date: ago(40), expected: ago(39), approval: 'Approved', service: true }),
  po('PO-2310', { vendor: 'Cement Traders', sku: 'MAT-CEM-53', qty: 500, rate: 410, storeId: 'CW', date: ago(9), expected: ago(6), approval: 'Approved', note: 'Central warehouse stock' }),
  po('PO-2309', { vendor: 'Shree Bricks', sku: 'MAT-BRK-RED', qty: 20000, rate: 9, storeId: 'SHA', date: ago(5), expected: T, approval: 'Approved', dispatch: 'In transit' }),
  po('PO-2308', { vendor: 'Volt Electricals', sku: 'MAT-ELC-25', qty: 40, rate: 2350, storeId: 'CW', date: ago(12), expected: ago(4), approval: 'Approved', followUps: [{ at: at(3, '11:30'), by: PM, note: 'Supplier says stock is coming from Mumbai depot; promised within 2 days.' }, { at: at(1, '16:00'), by: PM, note: 'Called again: dispatch slipped, new date awaited. Escalate if not dispatched tomorrow.' }] }),
  // Earlier orders, received and invoiced before the store stock records began (opening balances)
  po('PO-2301', { vendor: 'Cement Traders', sku: 'MAT-CEM-53', qty: 600, rate: 410, storeId: 'SHA', date: ago(66), expected: ago(62), approval: 'Approved', receivedBeforeStockRecords: true }),
  po('PO-2302', { vendor: 'Steel Supply Co.', sku: 'MAT-STL-08', qty: 5, rate: 63000, storeId: 'SHA', date: ago(62), expected: ago(58), approval: 'Approved', receivedBeforeStockRecords: true }),
  po('PO-2303', { vendor: 'Stone & Aggregates', sku: 'MAT-SND-M', qty: 140, rate: 1450, storeId: 'SHA', date: ago(58), expected: ago(55), approval: 'Approved', receivedBeforeStockRecords: true }),
  po('PO-2304', { vendor: 'Steel Supply Co.', sku: 'MAT-STL-16', qty: 18, rate: 61500, storeId: 'SHA', date: ago(52), expected: ago(48), approval: 'Approved', receivedBeforeStockRecords: true }),
  po('PO-2305', { vendor: 'Local Fuel Station', sku: 'MAT-DSL', qty: 600, rate: 92, storeId: 'SHB', date: ago(50), expected: ago(49), approval: 'Approved', receivedBeforeStockRecords: true }),
  po('PO-2306', { vendor: 'Formwork Depot', sku: 'MAT-PLY-12', qty: 150, rate: 1450, storeId: 'SHA', date: ago(45), expected: ago(42), approval: 'Approved', receivedBeforeStockRecords: true }),
  po('PO-2307', { vendor: 'Stone & Aggregates', sku: 'MAT-AGG-20', qty: 100, rate: 1650, storeId: 'SHB', date: ago(40), expected: ago(37), approval: 'Approved', receivedBeforeStockRecords: true }),
]

/**
 * Supplier invoices for material POs. Quantities billed come from the supplier; delivered and
 * accepted quantities always come from the Store Keeper's GRNs, never from the order.
 * Historic invoices were verified, approved and paid before the current period.
 */
const inv = (id, invoiceNo, poId, daysAgo, qty, extra = {}) => ({ id, invoiceNo, poId, date: ago(daysAgo), qty, ...extra })
export const SUPPLIER_INVOICES = [
  // Earlier orders: verified, released by Admin, paid (one partly paid, one overdue)
  inv('SI-4301', 'CEME/3030', 'PO-2301', 62, 600, { historic: true, payments: [{ date: ago(33), amount: 'full', mode: 'RTGS', reference: 'UTR23010042' }] }),
  inv('SI-4302', 'STEE/6533', 'PO-2302', 57, 5, { historic: true, payments: [{ date: ago(43), amount: 'full', mode: 'RTGS', reference: 'UTR23020017' }] }),
  inv('SI-4303', 'STON/4173', 'PO-2303', 54, 140, { historic: true, payments: [{ date: ago(34), amount: 'full', mode: 'RTGS', reference: 'UTR23030055' }] }),
  inv('SI-4304', 'STEE/9323', 'PO-2304', 47, 18, { historic: true, payments: [{ date: ago(33), amount: 'full', mode: 'RTGS', reference: 'UTR23040031' }] }),
  inv('SI-4305', 'LOCA/1988', 'PO-2305', 48, 600, { historic: true, payments: [] }), // unpaid, overdue
  inv('SI-4306', 'FORM/4175', 'PO-2306', 41, 150, { historic: true, payments: [{ date: ago(12), amount: 100000, mode: 'NEFT', reference: 'UTR23060068' }] }), // partly paid
  inv('SI-4307', 'STON/9680', 'PO-2307', 36, 100, { historic: true, payments: [{ date: ago(17), amount: 'full', mode: 'NEFT', reference: 'UTR23070012' }] }),
  // Current invoices, to be matched against the Store Keeper's GRNs
  inv('SI-4401', 'FD/INV/2291', 'PO-2312', 12, 300), // GRN-7001: 300 delivered, 296 accepted, 4 rejected
  inv('SI-4402', 'CT/INV/8840', 'PO-2310', 5, 500), // GRN-7002: 500 delivered, 490 accepted, 10 rejected
  inv('SI-4403', 'SB/INV/311', 'PO-2309', 0, 20000), // GRN-7005: delivered, inspection pending
  inv('SI-4404', 'CT/INV/8902', 'PO-2314', 0, 600), // GRN-7004: lot 1, 600 accepted; PO advance to adjust
]

/** Advances paid to suppliers against purchase orders (adjusted against their invoices). */
export const SUPPLIER_ADVANCES = [
  { id: 'ADV-2314-1', poId: 'PO-2314', date: ago(3), amount: 100000, mode: 'NEFT', reference: 'UTR23140001', purpose: 'Advance against PO (about 16%)', adjusted: [] },
]

export const PO_HISTORY_NOTE = 'Demo history: illustrative, not saved.'
export { at as stampDaysAgo }

// ---------- Suppliers (master records; shared with Accounts, view only there) ----------
const sup = (id, name, o) => ({ id, name, status: 'Active', creditDays: CREDIT_DAYS[name] ?? o.creditDays ?? 30, quality: 4, ...o, paymentTerms: o.paymentTerms || `${CREDIT_DAYS[name] ?? o.creditDays ?? 30} days credit` })
export const SUPPLIER_STATUSES = ['Active', 'On Hold', 'Blocked']
export const SUPPLIERS = [
  sup('SUP-001', 'Cement Traders', { contact: 'Prakash Jain', phone: '+91 98XXX XX101', email: 'sales@cementtraders.example', address: 'Pimpri, Pune', gstin: '27XXXXX0101X1Z1', skus: ['MAT-CEM-53'], quality: 5, since: '2023' }),
  sup('SUP-002', 'Steel Supply Co.', { contact: 'Harpreet Sethi', phone: '+91 98XXX XX102', email: 'orders@steelsupply.example', address: 'Bhosari MIDC, Pune', gstin: '27XXXXX0102X1Z2', skus: ['MAT-STL-08', 'MAT-STL-12', 'MAT-STL-16', 'MAT-BWR'], since: '2023' }),
  sup('SUP-003', 'Stone & Aggregates', { contact: 'Ganesh Kale', phone: '+91 98XXX XX103', email: 'dispatch@stoneagg.example', address: 'Wagholi quarry, Pune', gstin: '27XXXXX0103X1Z3', skus: ['MAT-SND-M', 'MAT-AGG-20'], since: '2023' }),
  sup('SUP-004', 'Formwork Depot', { contact: 'Anil Shetty', phone: '+91 98XXX XX104', email: 'hello@formworkdepot.example', address: 'Chakan, Pune', gstin: '27XXXXX0104X1Z4', skus: ['MAT-PLY-12'], quality: 3, since: '2024' }),
  sup('SUP-005', 'Chem Protect', { contact: 'Ritu Bansal', phone: '+91 98XXX XX105', email: 'sales@chemprotect.example', address: 'Kothrud, Pune', gstin: '27XXXXX0105X1Z5', skus: ['MAT-ATT'], since: '2024' }),
  sup('SUP-006', 'Earthmovers Rentals', { contact: 'Sameer Pathan', phone: '+91 98XXX XX106', email: 'rentals@earthmovers.example', address: 'Hinjewadi, Pune', gstin: '27XXXXX0106X1Z6', skus: [], services: 'Equipment hire (JCB, tippers)', since: '2024' }),
  sup('SUP-007', 'Local Fuel Station', { contact: 'Station manager', phone: '+91 98XXX XX107', email: '', address: 'Wakad, Pune', gstin: '27XXXXX0107X1Z7', skus: ['MAT-DSL'], since: '2024' }),
  sup('SUP-008', 'Shree Bricks', { contact: 'Vasant Patil', phone: '+91 98XXX XX108', email: 'shreebricks@mail.example', address: 'Talegaon, Pune', gstin: '27XXXXX0108X1Z8', skus: ['MAT-BRK-RED'], since: '2025' }),
  sup('SUP-009', 'Volt Electricals', { contact: 'Neeraj Gupta', phone: '+91 98XXX XX109', email: 'orders@voltelec.example', address: 'Budhwar Peth, Pune', gstin: '27XXXXX0109X1Z9', skus: ['MAT-ELC-25'], quality: 3, notes: 'Two late deliveries this year', since: '2024' }),
  sup('SUP-010', 'AquaFlow Plumbing', { contact: 'Joseph Dsouza', phone: '+91 98XXX XX110', email: 'sales@aquaflow.example', address: 'Camp, Pune', gstin: '27XXXXX0110X1Z0', skus: ['MAT-PLB-110'], since: '2024' }),
  sup('SUP-011', 'Tile World', { contact: 'Kiran Mehta', phone: '+91 98XXX XX111', email: 'projects@tileworld.example', address: 'Baner, Pune', gstin: '27XXXXX0111X1Z1', skus: ['MAT-TIL-600'], since: '2023' }),
  sup('SUP-012', 'ColorCoat Paints', { contact: 'Sneha Rao', phone: '+91 98XXX XX112', email: 'dealer@colorcoat.example', address: 'Aundh, Pune', gstin: '27XXXXX0112X1Z2', skus: ['MAT-PNT-EXT'], since: '2023' }),
  sup('SUP-013', 'SafeSite Gear', { contact: 'Arjun Nair', phone: '+91 98XXX XX113', email: 'orders@safesite.example', address: 'Pimple Saudagar, Pune', gstin: '27XXXXX0113X1Z3', skus: ['MAT-SAF-HLM'], since: '2024' }),
  sup('SUP-014', 'UltraBuild Cement Depot', { contact: 'Mahesh Karve', phone: '+91 98XXX XX114', email: 'ultrabuild@mail.example', address: 'Hadapsar, Pune', gstin: '27XXXXX0114X1Z4', skus: ['MAT-CEM-53'], creditDays: 0, paymentTerms: '50% advance, balance on delivery', since: '2025' }),
  sup('SUP-015', 'Deccan Steel Mart', { contact: 'Imtiaz Khan', phone: '+91 98XXX XX115', email: 'sales@deccansteel.example', address: 'Kurla, Mumbai', gstin: '27XXXXX0115X1Z5', skus: ['MAT-STL-08', 'MAT-STL-12', 'MAT-STL-16'], creditDays: 0, paymentTerms: '50% advance', quality: 3, since: '2025' }),
  sup('SUP-016', 'Metro Hardware & Steel', { contact: 'Pooja Shah', phone: '+91 98XXX XX116', email: 'metro@hardware.example', address: 'Nigdi, Pune', gstin: '27XXXXX0116X1Z6', skus: ['MAT-STL-12', 'MAT-BWR', 'MAT-PLB-110', 'MAT-SAF-HLM'], creditDays: 15, since: '2025' }),
  sup('SUP-017', 'Deccan Cement Agencies', { contact: 'Rohan Joshi', phone: '+91 98XXX XX117', email: 'deccancement@mail.example', address: 'Chinchwad, Pune', gstin: '27XXXXX0117X1Z7', skus: ['MAT-CEM-53'], creditDays: 15, quality: 3, status: 'On Hold', notes: 'On hold: two short-weight deliveries last quarter', since: '2024' }),
]

// ---------- Requisitions already processed by the Purchase Manager (quotation history) ----------
// Quote: rate per unit before GST, GST %, transport (total ₹), delivery days, payment terms, quality (1–5)
const q = (id, vendor, rate, gstRate, transport, days, terms, quality, received, extra = {}) => ({ id, vendor, rate, gstRate, transport, deliveryDays: days, paymentTerms: terms, quality, receivedAt: received, recordedBy: PM, ...extra })
const prh = (rows) => rows.map(([d, t, by, role, action, note = '']) => ({ at: at(d, t), by, role, action, note }))
const SK = PEOPLE.storeKeeper
const WK = PEOPLE.warehouseKeeper
export const PROCUREMENT_REQUISITIONS = [
  {
    id: 'PR-3098', sku: 'MAT-STL-12', storeId: 'SHA', qty: 25, reason: 'Raft reinforcement, Tower A', requestRef: null, raisedBy: SK, priority: 'High', requiredBy: addDays(T, 6),
    status: 'PO Raised', poId: 'PO-2316', estimate: 1550000, at: at(5, '10:00'), reviewedBy: PEOPLE.admin, reviewedAt: at(4, '09:30'),
    quotesRequestedFrom: ['Steel Supply Co.', 'Deccan Steel Mart', 'Metro Hardware & Steel'], quotesRequestedAt: at(4, '11:00'),
    quotes: [
      q('QT-501', 'Steel Supply Co.', 62000, 18, 15000, 7, '15 days credit', 4, at(3, '12:00')),
      q('QT-502', 'Deccan Steel Mart', 61200, 18, 28000, 12, '50% advance', 3, at(3, '15:00')),
      q('QT-503', 'Metro Hardware & Steel', 63500, 18, 0, 5, '15 days credit', 4, at(2, '10:30')),
    ],
    chosenId: 'QT-501', selectionReason: 'Deccan is about ₹10,600 cheaper landed but needs 50% advance and 12 days, too late for the raft pour. Steel Supply Co. delivers in 7 days on credit.',
    selectedBy: PM, selectedAt: at(2, '12:00'),
    history: prh([[5, '10:00', SK, 'Store Keeper', 'Requisition raised'], [4, '09:30', PEOPLE.admin, 'Admin', 'Reviewed by Admin: proceed to purchase'], [4, '11:00', PM, 'Purchase Manager', 'Quotations requested from 3 suppliers'], [2, '12:00', PM, 'Purchase Manager', 'Steel Supply Co. selected'], [1, '10:00', PM, 'Purchase Manager', 'PO-2316 raised']]),
  },
  {
    id: 'PR-3099', sku: 'MAT-BWR', storeId: 'CW', qty: 500, reason: 'Out of stock at Central Warehouse', requestRef: null, raisedBy: WK, priority: 'High', requiredBy: addDays(T, 4),
    status: 'PO Raised', poId: 'PO-2315', estimate: 42500, at: at(4, '09:00'),
    quotesRequestedFrom: ['Steel Supply Co.', 'Metro Hardware & Steel'], quotesRequestedAt: at(4, '10:00'),
    quotes: [
      q('QT-504', 'Steel Supply Co.', 85, 18, 0, 3, '15 days credit', 4, at(3, '11:00')),
      q('QT-505', 'Metro Hardware & Steel', 82, 18, 1500, 6, '15 days credit', 4, at(3, '17:00')),
    ],
    chosenId: 'QT-504', selectionReason: 'Metro is about ₹270 cheaper landed but needs 6 days; Steel Supply Co. can send it with the steel lorry in 3 days.',
    selectedBy: PM, selectedAt: at(2, '10:00'),
    history: prh([[4, '09:00', WK, 'Store Keeper', 'Requisition raised'], [4, '10:00', PM, 'Purchase Manager', 'Quotations requested from 2 suppliers'], [2, '10:00', PM, 'Purchase Manager', 'Steel Supply Co. selected'], [2, '10:30', PM, 'Purchase Manager', 'PO-2315 drafted']]),
  },
  {
    id: 'PR-3100', sku: 'MAT-CEM-53', storeId: 'SHA', qty: 1500, reason: 'Footing and raft concrete, Tower A', requestRef: null, raisedBy: SK, priority: 'High', requiredBy: addDays(T, -1),
    status: 'PO Raised', poId: 'PO-2314', estimate: 615000, at: at(8, '10:00'), reviewedBy: PEOPLE.admin, reviewedAt: at(7, '10:00'),
    quotesRequestedFrom: ['Cement Traders', 'UltraBuild Cement Depot', 'Deccan Cement Agencies'], quotesRequestedAt: at(7, '11:00'),
    quotes: [
      q('QT-506', 'Cement Traders', 410, 28, 0, 3, '30 days credit (16% advance)', 5, at(6, '12:00'), { note: 'Free delivery and unloading' }),
      q('QT-507', 'UltraBuild Cement Depot', 398, 28, 18000, 10, '50% advance, balance on delivery', 4, at(6, '16:00')),
      q('QT-508', 'Deccan Cement Agencies', 405, 28, 18000, 5, '15 days credit', 3, at(5, '11:00'), { note: 'Supplier currently on hold' }),
    ],
    chosenId: 'QT-506', selectionReason: 'UltraBuild is about ₹5,000 cheaper landed but needs 50% advance and 10 days; the footing pour needs cement within 3 days. Cement Traders: free delivery, best quality record, 30 days credit.',
    selectedBy: PM, selectedAt: at(5, '15:00'),
    history: prh([[8, '10:00', SK, 'Store Keeper', 'Requisition raised'], [7, '10:00', PEOPLE.admin, 'Admin', 'Reviewed by Admin: proceed to purchase'], [7, '11:00', PM, 'Purchase Manager', 'Quotations requested from 3 suppliers'], [5, '15:00', PM, 'Purchase Manager', 'Cement Traders selected'], [4, '10:00', PM, 'Purchase Manager', 'PO-2314 raised']]),
  },
  {
    id: 'PR-3103', sku: 'MAT-PLB-110', storeId: 'CW', qty: 60, reason: 'Plumbing first-fix, Tower A (planned)', requestRef: null, raisedBy: WK, priority: 'Normal', requiredBy: addDays(T, 12),
    status: 'Quotations Requested', estimate: 46800, at: at(3, '10:00'),
    quotesRequestedFrom: ['AquaFlow Plumbing', 'Metro Hardware & Steel'], quotesRequestedAt: at(3, '12:00'),
    quotes: [
      q('QT-509', 'AquaFlow Plumbing', 780, 18, 1200, 4, '30 days credit', 4, at(2, '11:00')),
      q('QT-510', 'Metro Hardware & Steel', 760, 18, 2400, 7, '15 days credit', 4, at(1, '14:00')),
    ],
    history: prh([[3, '10:00', WK, 'Store Keeper', 'Requisition raised'], [3, '12:00', PM, 'Purchase Manager', 'Quotations requested from 2 suppliers'], [2, '11:00', PM, 'Purchase Manager', 'Quotation QT-509 recorded (AquaFlow Plumbing)'], [1, '14:00', PM, 'Purchase Manager', 'Quotation QT-510 recorded (Metro Hardware & Steel)']]),
  },
  {
    id: 'PR-3104', sku: 'MAT-SAF-HLM', storeId: 'SHB', qty: 100, reason: 'New labour batch joining next week', requestRef: null, raisedBy: SK, priority: 'Normal', requiredBy: addDays(T, 7),
    status: 'Quotations Requested', estimate: 18000, at: at(1, '11:00'),
    quotesRequestedFrom: ['SafeSite Gear', 'Metro Hardware & Steel'], quotesRequestedAt: at(1, '12:00'),
    quotes: [q('QT-511', 'SafeSite Gear', 180, 18, 0, 2, '30 days credit', 4, at(0, '09:30'))],
    history: prh([[1, '11:00', SK, 'Store Keeper', 'Requisition raised'], [1, '12:00', PM, 'Purchase Manager', 'Quotations requested from 2 suppliers'], [0, '09:30', PM, 'Purchase Manager', 'Quotation QT-511 recorded (SafeSite Gear)']]),
  },
]
