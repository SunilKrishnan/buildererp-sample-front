/**
 * DEMO DATA ONLY: structured supplier bills, the Purchase Manager's orders/agreements and
 * the Site Engineer's confirmations, used by the bill verification workflow.
 * Nothing here was read from real documents; file names are placeholders. In the backend
 * phase these come from the purchase, site and document modules (and OCR/AI services).
 */
import { addDays, todayISO } from '../../utils/date.js'
import { formatDate } from '../../utils/format.js'

const T = todayISO()
const ago = (n) => addDays(T, -n)
const SUNRISE = 'Sunrise Heights Apartments'
const VILLAS = 'Palm Grove Villas'
export const PURCHASE_MANAGER = 'Deepak Rao' // same Purchase Manager as the stores and PO pages (inventoryDemo PEOPLE)

// Which records are mandatory before a bill can be approved, by bill category
export const MANDATORY_RECORDS = {
  'Equipment Hire': ['bill', 'po', 'site'],
  Transport: ['bill', 'po', 'site'],
  Fuel: ['bill', 'po', 'site'],
  Cement: ['bill', 'site'],
  Steel: ['bill', 'site'],
  Other: ['bill', 'po'],
  default: ['bill'],
}

// Configured approval rules (demo). The approver must also be a different person from the verifier.
export const BILL_APPROVAL_RULES = [
  { upTo: 200000, approvers: ['admin'], label: 'Bills up to ₹2,00,000: Admin' },
  { upTo: Infinity, approvers: ['admin', 'director'], label: 'Bills above ₹2,00,000: Admin, then Director (second approval)' },
]

/**
 * Per expense bill id: what the supplier billed, what was ordered/agreed and what the site confirmed.
 * Lines are matched on `item`. Quantities for hire are the rental period (days/hours).
 */
export const BILL_RECORDS = {
  'EB-3103': {
    supplierOnBill: 'Sai Crane Services', gstin: 'DEMO-GSTIN-SCS-01', projectOnBill: SUNRISE,
    description: 'Hire of 25-tonne mobile crane with operator for Tower A raft reinforcement lifts',
    period: { from: ago(12), to: ago(7) }, equipment: '25T mobile crane (MH-12-XX-4410)',
    lines: [{ item: 'crane-25t', desc: '25T mobile crane hire incl. operator & fuel', qty: 6, unit: 'days', rate: 20000 }],
    gstRate: 18, document: 'SCS-356-supplier-bill.pdf',
    po: {
      id: 'AGR-0412', type: 'Rental agreement', date: ago(16), issuedBy: PURCHASE_MANAGER, supplier: 'Sai Crane Services',
      gstin: 'DEMO-GSTIN-SCS-01', project: SUNRISE, gstRate: 18, document: 'AGR-0412-crane-rental-agreement.pdf',
      lines: [{ item: 'crane-25t', desc: '25T mobile crane hire incl. operator & fuel', qty: 5, unit: 'days', rate: 20000 }],
      terms: ['Charged per calendar day the crane is on site', 'Operator and fuel included', 'Idle days due to weather not chargeable', 'Mobilisation advance of ₹25,000 adjustable against the bill'],
      advances: [{ id: 'ADV-0412-1', date: ago(15), amount: 25000, mode: 'NEFT', reference: 'UTR41200017', purpose: 'Mobilisation advance', adjusted: [] }],
    },
    site: {
      status: 'Confirmed', by: 'Meera Pillai', role: 'Site Engineer', date: ago(6), document: 'site-log-crane-oct.pdf',
      lines: [{ item: 'crane-25t', qty: 5, unit: 'days' }],
      note: `Crane on site ${formatDate(ago(11))} to ${formatDate(ago(7))}; demobilised on the morning of ${formatDate(ago(6))}.`,
    },
  },
  'EB-3108': {
    supplierOnBill: 'Tipper hire (daily)', gstin: null, projectOnBill: SUNRISE,
    description: 'Tipper trips for excavated soil disposal, Tower B',
    period: { from: ago(3), to: ago(1) },
    lines: [{ item: 'tipper-trip', desc: 'Tipper trip, site to approved dump yard', qty: 10, unit: 'trips', rate: 1075 }],
    gstRate: 0, document: 'T-463-supplier-bill.pdf',
    po: {
      id: 'RC-07', type: 'Rate contract', date: ago(60), issuedBy: PURCHASE_MANAGER, supplier: 'Tipper hire (daily)',
      gstin: null, project: SUNRISE, gstRate: 0, document: 'RC-07-tipper-rate-contract.pdf',
      lines: [{ item: 'tipper-trip', desc: 'Tipper trip, site to approved dump yard', qty: null, unit: 'trips', rate: 1075 }],
      terms: ['Rate per trip; quantity as per site trip log', 'Transporter not GST-registered (no GST charged)'],
    },
    site: {
      status: 'Confirmed', by: 'Suresh Patil', role: 'Site Supervisor', date: ago(1), document: 'trip-log-tower-b.pdf',
      lines: [{ item: 'tipper-trip', qty: 10, unit: 'trips' }], note: 'Trip slips 1–10 signed at gate.',
    },
  },
  'EB-3107': {
    supplierOnBill: 'Local Fuel Station', gstin: null, projectOnBill: SUNRISE,
    description: 'High-speed diesel for JCB and tippers',
    period: { from: ago(8), to: ago(2) },
    lines: [{ item: 'diesel', desc: 'High-speed diesel', qty: 500, unit: 'litres', rate: 91.5 }],
    gstRate: 0, document: 'LFS-200-fuel-bill.pdf',
    po: {
      id: 'RC-03', type: 'Rate contract', date: ago(70), issuedBy: PURCHASE_MANAGER, supplier: 'Local Fuel Station',
      gstin: null, project: SUNRISE, gstRate: 0, document: 'RC-03-diesel-rate-contract.pdf',
      lines: [{ item: 'diesel', desc: 'High-speed diesel', qty: null, unit: 'litres', rate: 92 }],
      terms: ['Rate capped at ₹92/litre; quantity as per site fuel register', 'Diesel is outside GST'],
    },
    site: {
      status: 'Confirmed', by: 'Karan Joshi', role: 'Site Engineer', date: ago(2), document: 'fuel-register-oct.pdf',
      lines: [{ item: 'diesel', qty: 480, unit: 'litres' }], note: 'Fuel register entries 41–47 (480 litres received).',
    },
  },
  'EB-3113': {
    supplierOnBill: 'Earthmovers Rentals', gstin: 'DEMO-GSTIN-EMR-02', projectOnBill: SUNRISE,
    description: 'JCB 3DX hire for excavation, Tower B',
    period: { from: ago(50), to: ago(43) }, equipment: 'JCB 3DX (MH-14-XX-2231)',
    lines: [{ item: 'jcb-hour', desc: 'JCB 3DX hire with operator', qty: 70, unit: 'hours', rate: 975 }],
    gstRate: 18, document: 'ER-828-supplier-bill.pdf',
    po: {
      id: 'AGR-0398', type: 'Rental agreement', date: ago(75), issuedBy: PURCHASE_MANAGER, supplier: 'Earthmovers Rentals',
      gstin: 'DEMO-GSTIN-EMR-02', project: SUNRISE, gstRate: 18, document: 'AGR-0398-jcb-rental-agreement.pdf',
      lines: [{ item: 'jcb-hour', desc: 'JCB 3DX hire with operator', qty: null, unit: 'hours', rate: 975 }],
      terms: ['Billed on hour-meter readings confirmed by site', 'Minimum 8 hours per working day', 'Advance of ₹20,000 adjustable in equal parts against the first two bills'],
      advances: [{ id: 'ADV-0398-1', date: ago(60), amount: 20000, mode: 'NEFT', reference: 'UTR39800042', purpose: 'Advance against hire', adjusted: [{ billId: 'EB-3105', billNo: 'ER/349', amount: 10000 }] }],
    },
    site: { status: 'Pending', requestedFrom: 'Karan Joshi', role: 'Site Engineer', lines: [], note: 'Hour-meter log for this period not yet confirmed by site.' },
  },
  // Earlier bill from the same supplier, used for the duplicate/overlap check
  'EB-3105': {
    supplierOnBill: 'Earthmovers Rentals', gstin: 'DEMO-GSTIN-EMR-02', projectOnBill: SUNRISE,
    description: 'JCB 3DX hire for excavation, Tower B', period: { from: ago(55), to: ago(42) }, equipment: 'JCB 3DX (MH-14-XX-2231)',
    keepAmount: true, advanceAdjusted: 10000,
  },
  'EB-V01': {
    supplierOnBill: 'AquaSeal Waterproofing', gstin: 'DEMO-GSTIN-AQS-03', projectOnBill: SUNRISE, // wrong project on the bill
    description: 'Terrace waterproofing repair, villa V-12 (defect liability)',
    period: { from: ago(10), to: ago(8) },
    lines: [{ item: 'wp-sqft', desc: 'Terrace waterproofing (membrane + protection screed)', qty: 125, unit: 'sq.ft', rate: 80 }],
    gstRate: 18, document: 'ASW-378-supplier-bill.pdf',
    po: {
      id: 'WO-DLP-04', type: 'Work order', date: ago(14), issuedBy: PURCHASE_MANAGER, supplier: 'AquaSeal Waterproofing',
      gstin: 'DEMO-GSTIN-AQS-03', project: VILLAS, gstRate: 18, document: 'WO-DLP-04-waterproofing.pdf',
      lines: [{ item: 'wp-sqft', desc: 'Terrace waterproofing (membrane + protection screed)', qty: 125, unit: 'sq.ft', rate: 80 }],
      terms: ['Defect-liability repair for villa V-12', '12-month workmanship warranty'],
    },
    site: {
      status: 'Confirmed', by: 'Nikhil Deshpande', role: 'Project Manager', date: ago(7), document: 'v12-repair-completion-photos.pdf',
      lines: [{ item: 'wp-sqft', qty: 125, unit: 'sq.ft' }], note: 'Water test passed after 48 hours.',
    },
  },
}

/** Taxable value, GST and total for a set of billed lines. */
/** Advance paid against an order that has not yet been adjusted against bills. */
export function advanceBalance(po) {
  return (po?.advances || []).reduce((s, a) => s + a.amount - a.adjusted.reduce((t, x) => t + x.amount, 0), 0)
}

export function billTotals(rec) {
  const taxable = Math.round((rec.lines || []).reduce((s, l) => s + l.qty * l.rate, 0))
  const gst = Math.round((taxable * (rec.gstRate || 0)) / 100)
  return { taxable, gst, total: taxable + gst }
}
