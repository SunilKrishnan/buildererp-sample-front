/**
 * Inventory calculations (pure functions, no React). Every screen derives stock from
 * here so the figures always agree.
 *
 * Rules:
 *  - Stock on hand = opening balance + confirmed movements. Nothing is overwritten.
 *  - Receipts add only the ACCEPTED quantity, and only after inspection is complete.
 *  - Issues reduce stock only when confirmed (never when a request is created or approved).
 *  - Approved-but-not-issued request quantity is RESERVED and not available for a new issue.
 *  - Returns add only the accepted quantity after inspection; damaged quantity never becomes usable.
 *  - A transfer is one record producing two movements: out of the source, into the destination.
 *  - Adjustments need a reason and change stock only after review by someone else.
 *    A pending reduction is held back from issue until it is reviewed.
 *
 * Input `state` shape: { materials, lines, receipts, requests, issues, returns, transfers, adjustments,
 * purchaseRequests, purchaseOrders, locations, ... } (see data/demo/inventoryDemo.js, procurementDemo.js and InventoryContext).
 * Purchase orders come from the one shared PO register (state.purchaseOrders), never a local copy.
 */
import { DECIMAL_UNITS, MATERIAL_CATALOG, SITES, STORES } from '../data/demo/inventoryDemo.js'
import { projects } from '../data/mockData.js'
import { todayISO } from '../utils/date.js'

export const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100
export const keyOf = (sku, storeId) => `${sku}@${storeId}`
// Material master (catalogue). Starts as the demo catalogue; InventoryProvider swaps in the
// session list (including materials added or edited on screen) before anything is derived.
// Demo-only lookup: the backend phase will return material details with each record.
let catalog = MATERIAL_CATALOG
export const setCatalog = (list) => { catalog = list }
export const allMaterials = () => catalog
export const materialOf = (sku) => catalog.find((m) => m.sku === sku)
export const storeOf = (id) => STORES.find((s) => s.id === id)
export const siteOf = (id) => SITES.find((s) => s.id === id)
export const projectOf = (id) => projects.find((p) => p.id === id)
export const allowsDecimals = (unit) => DECIMAL_UNITS.includes(unit)

/** 'Sunrise Heights' for a site store, 'Company store' for the central warehouse */
export const storeProjectLabel = (store) => (store?.projectId ? projectOf(store.projectId)?.short || store.projectId : 'Company store (all projects)')

/** Local date-time stamp 'YYYY-MM-DDTHH:mm' (sorts correctly as text). */
export function nowStamp() {
  const d = new Date()
  return `${todayISO()}T${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

/** Next id for a prefix, e.g. nextId(receipts, 'GRN-') → 'GRN-7006' */
export function nextId(records, prefix) {
  const max = records.reduce((m, r) => Math.max(m, Number(String(r.id).slice(prefix.length)) || 0), 0)
  return `${prefix}${max + 1}`
}

/** Quantity issued so far against each request id */
export function issuedByRequest(issues) {
  const out = {}
  for (const i of issues) out[i.requestId] = round2((out[i.requestId] || 0) + i.qty)
  return out
}

/** Quantity returned (accepted + pending + damaged, i.e. physically handed back) per issue id */
export function returnedByIssue(returns) {
  const out = {}
  for (const r of returns) out[r.issueId] = round2((out[r.issueId] || 0) + r.qty)
  return out
}

// ---------- Material request statuses (one list for every dashboard) ----------
// Draft → Submitted (Store Keeper checks usable stock) → Pending Project Manager Review (always,
// whatever the stock) → Approved | Returned | Rejected → Partially Issued → Issued, or Closed when
// the balance is no longer needed. The requester may cancel before approval. A shortage on an
// approved request is forwarded as a linked purchase requisition; the request stays Approved.
export const MR = {
  DRAFT: 'Draft', SUBMITTED: 'Submitted', PM_REVIEW: 'Pending Project Manager Review', RETURNED: 'Returned', REJECTED: 'Rejected',
  CANCELLED: 'Cancelled', APPROVED: 'Approved', PARTIAL: 'Partially Issued', ISSUED: 'Issued', CLOSED: 'Closed',
}
export const REQUEST_STATUSES = [MR.DRAFT, MR.SUBMITTED, MR.PM_REVIEW, MR.RETURNED, MR.APPROVED, MR.PARTIAL, MR.ISSUED, MR.CLOSED, MR.REJECTED, MR.CANCELLED]
/** The requester can still edit and (re)submit */
export const EDITABLE_REQUEST_STATUSES = [MR.DRAFT, MR.RETURNED]
/** Not yet approved by the Project Manager: nothing approved, nothing reserved */
export const PRE_APPROVAL_STATUSES = [MR.DRAFT, MR.SUBMITTED, MR.PM_REVIEW, MR.RETURNED]
/** Approved by the Project Manager: the open approved quantity is reserved and can be issued */
export const ISSUABLE_REQUEST_STATUSES = [MR.APPROVED, MR.PARTIAL]
/** Submitted and not finished (drafts are not submitted yet) */
export const ACTIVE_REQUEST_STATUSES = [MR.SUBMITTED, MR.PM_REVIEW, MR.RETURNED, ...ISSUABLE_REQUEST_STATUSES]
/** Finished: nothing more will be issued */
export const CLOSED_REQUEST_STATUSES = [MR.ISSUED, MR.CLOSED, MR.REJECTED, MR.CANCELLED]

/** Open (approved, not yet issued) quantity per request: what the request has reserved. */
export function reservedForRequest(req, issued) {
  if (!ISSUABLE_REQUEST_STATUSES.includes(req.status)) return 0
  return Math.max(0, round2((req.approved || 0) - (issued[req.id] || 0)))
}

/**
 * Every confirmed stock change, oldest first, with the running balance of that
 * material in that store after each transaction.
 */
export function deriveMovements(state) {
  const raw = []
  const reqById = Object.fromEntries(state.requests.map((r) => [r.id, r]))
  const issueById = Object.fromEntries(state.issues.map((i) => [i.id, i]))

  for (const l of state.lines) {
    if (l.opening > 0) {
      raw.push({ id: `OPEN-${keyOf(l.sku, l.storeId)}`, at: l.openingAt, ref: 'Opening', sku: l.sku, storeId: l.storeId, type: 'Opening balance', qtyIn: l.opening, qtyOut: 0, related: l.openingSource || '', by: l.openingBy || 'System', notes: l.openingNote || 'Balance brought forward' })
    }
  }
  for (const g of state.receipts) {
    if (g.status !== 'Accepted') continue
    raw.push({
      id: g.id, at: g.confirmedAt || g.at, ref: g.id, sku: g.sku, storeId: g.storeId, type: 'Receipt', qtyIn: g.accepted, qtyOut: 0, related: g.po, by: g.inspectedBy || g.receivedBy,
      notes: g.rejected ? `Delivered ${g.delivered}, accepted ${g.accepted}, rejected ${g.rejected} (not added to stock)` : `Delivered ${g.delivered}, all accepted`,
    })
  }
  for (const i of state.issues) {
    const r = reqById[i.requestId]
    if (!r) continue
    raw.push({ id: i.id, at: i.at, ref: i.id, sku: r.sku, storeId: r.storeId, siteId: r.siteId, type: 'Issue', qtyIn: 0, qtyOut: i.qty, related: r.id, by: i.issuedBy, notes: `To ${siteOf(r.siteId)?.name || r.siteId}; received by ${i.receivedBy}${i.notes ? `. ${i.notes}` : ''}` })
  }
  for (const t of state.returns) {
    if (t.status !== 'Accepted' || !t.accepted) continue
    raw.push({ id: t.id, at: t.confirmedAt || t.at, ref: t.id, sku: t.sku, storeId: t.storeId, siteId: t.siteId, type: 'Return', qtyIn: t.accepted, qtyOut: 0, related: issueById[t.issueId]?.id || t.issueId, by: t.inspectedBy, notes: t.damaged ? `Returned ${t.qty}, accepted ${t.accepted}, damaged ${t.damaged} (not added to stock)` : `Returned ${t.qty}, all accepted` })
  }
  for (const t of state.transfers) {
    raw.push({ id: `${t.id}-OUT`, at: t.at, ref: t.id, sku: t.sku, storeId: t.fromStoreId, type: 'Transfer', qtyIn: 0, qtyOut: t.qty, related: `To ${storeOf(t.toStoreId)?.name}`, by: t.recordedBy, notes: t.reason })
    raw.push({ id: `${t.id}-IN`, at: t.at, ref: t.id, sku: t.sku, storeId: t.toStoreId, type: 'Transfer', qtyIn: t.qty, qtyOut: 0, related: `From ${storeOf(t.fromStoreId)?.name}`, by: t.receivedBy || t.recordedBy, notes: t.reason })
  }
  for (const a of state.adjustments) {
    if (a.status !== 'Approved') continue
    raw.push({ id: a.id, at: a.reviewedAt || a.at, ref: a.id, sku: a.sku, storeId: a.storeId, type: 'Adjustment', qtyIn: a.qty > 0 ? a.qty : 0, qtyOut: a.qty < 0 ? -a.qty : 0, related: a.kind, by: a.raisedBy, notes: `${a.reason}. Reviewed by ${a.reviewedBy}` })
  }

  const order = { 'Opening balance': 0, Receipt: 1, Return: 2, Transfer: 3, Adjustment: 4, Issue: 5 }
  raw.sort((a, b) => a.at.localeCompare(b.at) || order[a.type] - order[b.type])
  const bal = {}
  return raw.map((m) => {
    const k = keyOf(m.sku, m.storeId)
    bal[k] = round2((bal[k] || 0) + m.qtyIn - m.qtyOut)
    const store = storeOf(m.storeId)
    const projectId = m.siteId ? siteOf(m.siteId)?.projectId : store?.projectId
    return { ...m, key: k, balanceAfter: bal[k], projectId: projectId || null }
  })
}

/** Status the stores see: only an approved PO can be received against (in transit is still approved). */
export function receivingStatus(po) {
  if (po.approval !== 'Approved') return po.approval
  if (!po.sentAt) return 'Not Sent' // approved but not yet sent to the supplier: nothing can arrive
  return po.dispatch === 'In transit' ? 'In Transit' : 'Approved'
}

/**
 * Material purchase orders the stores receive against, from the shared PO register.
 * Service orders and orders received before the stock records began are excluded.
 */
export function poLines(state) {
  return (state.purchaseOrders || [])
    .filter((p) => p.sku && !p.receivedBeforeStockRecords)
    .map((p) => ({ ...p, po: p.id, poStatus: receivingStatus(p) }))
}
export const RECEIVABLE_PO_STATUSES = ['Approved', 'In Transit']
// Counted as 'on order' for reorder suggestions (approved, whether or not sent yet)
export const ON_ORDER_PO_STATUSES = [...RECEIVABLE_PO_STATUSES, 'Not Sent']

/** Ordered / delivered / accepted per PO line, for receiving and the PO page. */
export function poReceiptStatus(state, po) {
  const line = poLines(state).find((l) => l.po === po)
  if (!line) return null
  const grns = state.receipts.filter((g) => g.po === po)
  const delivered = round2(grns.reduce((s, g) => s + g.delivered, 0))
  const accepted = round2(grns.reduce((s, g) => s + (g.accepted || 0), 0))
  const rejected = round2(grns.reduce((s, g) => s + (g.rejected || 0), 0))
  const pendingInspection = grns.filter((g) => g.status === 'Pending Inspection').length
  const remaining = Math.max(0, round2(line.qty - delivered))
  const overdue = remaining > 0 && line.expected < todayISO() && RECEIVABLE_PO_STATUSES.includes(line.poStatus)
  return { ...line, grns, delivered, accepted, rejected, pendingInspection, remaining, overdue }
}

/**
 * Stock position per material × store.
 * availableForIssue = on hand − reserved − on hold (pending reductions).
 */
export function computeStock(state, movements = deriveMovements(state)) {
  const issued = issuedByRequest(state.issues)
  const rows = new Map()
  const ensure = (sku, storeId) => {
    const k = keyOf(sku, storeId)
    if (!rows.has(k)) {
      const line = state.lines.find((l) => l.sku === sku && l.storeId === storeId)
      rows.set(k, { key: k, sku, storeId, reorder: line?.reorder ?? 0, baseLocation: line?.location || '', onHand: 0, reserved: 0, onHold: 0, lastUpdated: line?.openingAt || null, onOrder: 0 })
    }
    return rows.get(k)
  }
  state.lines.forEach((l) => ensure(l.sku, l.storeId))
  for (const m of movements) {
    const r = ensure(m.sku, m.storeId)
    r.onHand = m.balanceAfter
    r.lastUpdated = m.at
  }
  for (const req of state.requests) {
    const q = reservedForRequest(req, issued)
    if (q) ensure(req.sku, req.storeId).reserved = round2(ensure(req.sku, req.storeId).reserved + q)
  }
  for (const a of state.adjustments) {
    if (a.status === 'Pending Review' && a.qty < 0) {
      const r = ensure(a.sku, a.storeId)
      r.onHold = round2(r.onHold - a.qty)
    }
  }
  // Only approved orders count as on order (a PO awaiting approval or rejected is not coming)
  for (const l of poLines(state)) {
    if (!ON_ORDER_PO_STATUSES.includes(l.poStatus)) continue
    const st = poReceiptStatus(state, l.po)
    if (st.remaining > 0) ensure(l.sku, l.storeId).onOrder = round2(ensure(l.sku, l.storeId).onOrder + st.remaining)
  }
  // Delivered but not yet inspected: physically at the store, not usable yet
  for (const g of state.receipts) {
    if (g.status === 'Pending Inspection') ensure(g.sku, g.storeId).awaitingInspection = round2((ensure(g.sku, g.storeId).awaitingInspection || 0) + g.delivered)
  }

  return [...rows.values()].map((r) => {
    const material = materialOf(r.sku)
    const store = storeOf(r.storeId)
    const availableForIssue = Math.max(0, round2(r.onHand - r.reserved - r.onHold))
    const status = r.onHand <= 0 ? 'Out of Stock' : availableForIssue <= r.reorder ? 'Low Stock' : 'In Stock'
    const shortage = Math.max(0, round2(r.reorder - availableForIssue))
    // Bring free stock back up to twice the reorder level, counting what is already on order
    // (and what is delivered but awaiting inspection)
    const awaitingInspection = r.awaitingInspection || 0
    const suggested = Math.max(0, round2(r.reorder * 2 - availableForIssue - r.onOrder - awaitingInspection))
    return {
      ...r,
      material, store, projectId: store?.projectId || null,
      location: state.locations[r.key] ?? r.baseLocation,
      availableForIssue, status, shortage, suggested, awaitingInspection,
      value: round2(r.onHand * (material?.rate || 0)),
    }
  })
}

export const findStock = (stock, sku, storeId) => stock.find((s) => s.sku === sku && s.storeId === storeId)

/**
 * The most that can be issued against a request right now: its remaining approved
 * quantity, limited by stock that is not reserved for OTHER requests or on hold.
 */
export function issuableFor(req, stock, issued) {
  const row = findStock(stock, req.sku, req.storeId)
  const own = reservedForRequest(req, issued)
  // Not clamped first: if reservations ever exceed stock (e.g. after a write-off),
  // this request must still not dip into another request's reservation.
  const free = row ? Math.max(0, round2(row.onHand - row.onHold - (row.reserved - own))) : 0
  return { remaining: own, free, max: Math.max(0, Math.min(own, free)) }
}

/**
 * The requisition still covering a request's shortage: open, or its PO not yet fully delivered.
 * Once that PO is delivered (or rejected), any shortage left can be forwarded again.
 */
export function activeRequisitionFor(state, requestId) {
  return [...state.purchaseRequests].reverse().find((p) => {
    if (p.requestRef !== requestId || p.status.startsWith('Rejected') || p.status === 'Returned to Store Keeper') return false
    if (p.status !== 'PO Raised') return true
    const st = poReceiptStatus(state, p.poId)
    return !!st && !['Rejected', 'Cancelled'].includes(st.poStatus) && st.remaining > 0
  }) || null
}

/**
 * Request rows with availability, shortage and issue progress. Before Project Manager approval
 * the availability is indicative only: nothing is reserved until the request is approved.
 */
export function requestRows(state, stock) {
  const issued = issuedByRequest(state.issues)
  return state.requests.map((r) => {
    const row = findStock(stock, r.sku, r.storeId)
    const done = issued[r.id] || 0
    const closed = CLOSED_REQUEST_STATUSES.includes(r.status)
    const reserved = ISSUABLE_REQUEST_STATUSES.includes(r.status)
    const need = closed ? 0 : reserved ? reservedForRequest(r, issued) : r.requested
    const free = reserved ? issuableFor(r, stock, issued).free : row?.availableForIssue || 0
    const shortage = closed ? 0 : Math.max(0, round2(need - free))
    return {
      ...r, material: materialOf(r.sku), store: storeOf(r.storeId), site: siteOf(r.siteId),
      issued: done, available: row?.availableForIssue || 0, need, shortage,
      // Approved quantity still to be issued (what the site is waiting for)
      remaining: reserved ? Math.max(0, round2(r.approved - done)) : 0,
      forwarded: activeRequisitionFor(state, r.id),
    }
  })
}

// ---------- Validation (returns an error message, or '' when valid) ----------

const isNum = (v) => v !== '' && v !== null && v !== undefined && !Number.isNaN(Number(v))
function qtyError(value, unit, label = 'Quantity', { allowZero = false } = {}) {
  if (!isNum(value)) return `${label} is required.`
  const n = Number(value)
  if (n < 0 || (!allowZero && n === 0)) return `${label} must be more than 0.`
  if (!allowsDecimals(unit) && !Number.isInteger(n)) return `${label} must be a whole number of ${unit.toLowerCase()}.`
  return ''
}

/** Goods receipt form. `inspected` = recording accepted/rejected now. */
export function validateReceipt(f, state) {
  const line = poLines(state).find((l) => l.po === f.po)
  if (!line) return 'Select the purchase order this delivery is against.'
  if (!RECEIVABLE_PO_STATUSES.includes(line.poStatus)) return `${line.po} is ${line.poStatus.toLowerCase()}: deliveries can be recorded only against an approved PO that has been sent to the supplier.`
  if (f.deliveryNote?.trim() && state.receipts.some((g) => g.po === f.po && g.deliveryNote.trim().toLowerCase() === f.deliveryNote.trim().toLowerCase()))
    return `Delivery note ${f.deliveryNote.trim()} is already recorded against ${f.po}. Each delivery is recorded once.`
  const unit = materialOf(line.sku)?.unit
  if (!f.deliveryDate) return 'Delivery date is required.'
  if (f.deliveryDate > todayISO()) return 'Delivery date cannot be in the future.'
  if (!f.deliveryNote?.trim()) return 'Enter the supplier delivery note number.'
  const d = qtyError(f.delivered, unit, 'Delivered quantity')
  if (d) return d
  if (!f.location?.trim()) return 'Enter the storage location.'
  if (!f.receivedBy?.trim()) return 'Enter who received the delivery.'
  if (f.inspected) {
    const a = qtyError(f.accepted, unit, 'Accepted quantity', { allowZero: true }) || qtyError(f.rejected || 0, unit, 'Rejected quantity', { allowZero: true })
    if (a) return a
    if (round2(Number(f.accepted) + Number(f.rejected || 0)) !== round2(Number(f.delivered))) return 'Accepted + rejected must equal the delivered quantity.'
    if (Number(f.rejected) > 0 && !f.rejectionReason?.trim()) return 'Give the reason for the rejected / damaged quantity.'
  }
  return ''
}

/** Inspection of an existing receipt or return */
export function validateInspection({ total, accepted, rejected, reason }, unit) {
  const a = qtyError(accepted, unit, 'Accepted quantity', { allowZero: true }) || qtyError(rejected || 0, unit, 'Rejected / damaged quantity', { allowZero: true })
  if (a) return a
  if (round2(Number(accepted) + Number(rejected || 0)) !== round2(total)) return `Accepted + rejected must equal ${total}.`
  if (Number(rejected) > 0 && !reason?.trim()) return 'Give the reason for the rejected / damaged quantity.'
  return ''
}

/** Discrepancies between the PO and what was delivered / accepted */
export function receiptDiscrepancies(g) {
  const out = []
  if (round2(g.delivered) < round2(g.ordered)) out.push(`Short delivery: ${round2(g.ordered - g.delivered)} less than ordered`)
  if (round2(g.delivered) > round2(g.ordered)) out.push(`Excess delivery: ${round2(g.delivered - g.ordered)} more than ordered`)
  if (g.rejected > 0) out.push(`${g.rejected} rejected / damaged`)
  return out
}

export function validateIssue({ qty, receivedBy }, req, stock, issues) {
  const unit = materialOf(req.sku)?.unit
  const e = qtyError(qty, unit, 'Issue quantity')
  if (e) return e
  const { remaining, free, max } = issuableFor(req, stock, issuedByRequest(issues))
  if (Number(qty) > remaining) return `Only ${remaining} ${unit} remain approved on ${req.id}.`
  if (Number(qty) > free) return `Only ${free} ${unit} can be issued: the rest of the stock is reserved for other requests or on hold.`
  if (Number(qty) > max) return `Cannot issue more than ${max} ${unit}.`
  if (!receivedBy?.trim()) return 'Enter who received the material at site.'
  return ''
}

export function validateTransfer(f, stock) {
  if (!f.sku) return 'Select a material.'
  if (!f.fromStoreId || !f.toStoreId) return 'Select both stores.'
  if (f.fromStoreId === f.toStoreId) return 'Source and destination must be different stores.'
  const unit = materialOf(f.sku)?.unit
  const e = qtyError(f.qty, unit)
  if (e) return e
  const row = findStock(stock, f.sku, f.fromStoreId)
  const free = row?.availableForIssue || 0
  if (Number(f.qty) > free) return `Only ${free} ${unit} at ${storeOf(f.fromStoreId)?.name} are free to transfer (reserved and on-hold stock excluded).`
  if (!f.reason?.trim()) return 'Give the reason for the transfer.'
  return ''
}

export function validateAdjustment(f, stock) {
  if (!f.sku || !f.storeId) return 'Select the material and store.'
  const unit = materialOf(f.sku)?.unit
  if (!isNum(f.qty) || Number(f.qty) === 0) return 'Enter the quantity to add (+) or remove (−).'
  const n = Number(f.qty)
  if (!allowsDecimals(unit) && !Number.isInteger(n)) return `Quantity must be a whole number of ${unit.toLowerCase()}.`
  if (f.kind === 'Damaged' && n > 0) return 'Damaged stock can only reduce usable stock (use a negative quantity).'
  const row = findStock(stock, f.sku, f.storeId)
  if (n < 0 && -n > (row?.availableForIssue || 0)) return `Cannot remove more than the ${row?.availableForIssue || 0} ${unit} free stock (reserved stock is excluded).`
  if (!f.reason?.trim() || f.reason.trim().length < 5) return 'A reason is required for every stock adjustment.'
  return ''
}

export function validateReturn(f, issue, req, returns) {
  if (!issue || !req) return 'Select the material issue being returned.'
  const unit = materialOf(req.sku)?.unit
  const e = qtyError(f.qty, unit, 'Returned quantity')
  if (e) return e
  const already = returnedByIssue(returns)[issue.id] || 0
  const max = round2(issue.qty - already)
  if (Number(f.qty) > max) return `Only ${max} ${unit} of ${issue.id} can still be returned.`
  if (!f.returnedBy?.trim()) return 'Enter who returned the material.'
  if (!f.reason?.trim()) return 'Give the reason for the return.'
  return ''
}

// ---------- Dashboard summary and alerts ----------

export function buildSummary(state, stock, movements) {
  const today = todayISO()
  const receivedToday = state.receipts.filter((g) => g.deliveryDate === today)
  const issuedToday = state.issues.filter((i) => i.at.startsWith(today))
  const low = stock.filter((s) => s.status !== 'In Stock')
  const pendingRequests = state.requests.filter((r) => ACTIVE_REQUEST_STATUSES.includes(r.status))
  const pendingReceipts = state.receipts.filter((g) => g.status === 'Pending Inspection')
  const pendingReturns = state.returns.filter((r) => r.status === 'Pending Inspection')
  const openReceiptDisc = state.receipts.filter((g) => g.discrepancy && g.discrepancy !== 'Resolved')
  const pendingAdj = state.adjustments.filter((a) => a.status === 'Pending Review')
  return {
    materialTypes: new Set(stock.filter((s) => s.onHand > 0).map((s) => s.sku)).size,
    catalogTypes: new Set(stock.map((s) => s.sku)).size,
    stockValue: stock.reduce((s, r) => s + r.value, 0),
    receivedToday, issuedToday, low, pendingRequests, pendingReceipts, pendingReturns,
    openReceiptDisc, pendingAdj,
    discrepancies: openReceiptDisc.length + pendingAdj.length,
    movementsToday: movements.filter((m) => m.at.startsWith(today)).length,
  }
}

/** Demo alerts. Each names the material and the reference; nothing is sent to anyone. */
export function buildAlerts(state, stock, requests) {
  const out = []
  const name = (sku) => materialOf(sku)?.name || sku
  for (const s of stock.filter((x) => x.status !== 'In Stock')) {
    out.push({ id: `low-${s.key}`, type: 'Low stock', severity: s.status === 'Out of Stock' ? 'danger' : 'warning', material: s.material.name, ref: s.sku, text: `${s.store.name}: ${s.availableForIssue} ${s.material.unit} free for issue, reorder level ${s.reorder}`, tab: 'reorder' })
  }
  for (const l of poLines(state)) {
    const st = poReceiptStatus(state, l.po)
    if (st.overdue) out.push({ id: `po-${l.po}`, type: 'PO delivery overdue', severity: 'danger', material: name(l.sku), ref: l.po, text: `${st.remaining} ${materialOf(l.sku).unit} not delivered; expected ${l.expected} (${l.vendor})`, tab: 'receipts' })
  }
  for (const g of state.receipts) {
    if (g.discrepancy && g.discrepancy !== 'Resolved' && round2(g.delivered) !== round2(g.ordered)) out.push({ id: `qty-${g.id}`, type: 'Delivered ≠ ordered', severity: 'warning', material: name(g.sku), ref: `${g.id} / ${g.po}`, text: `Ordered ${g.ordered}, delivered ${g.delivered}. Discrepancy ${g.discrepancy.toLowerCase()}.`, tab: 'receipts' })
    if (g.rejected > 0 && g.discrepancy !== 'Resolved') out.push({ id: `dmg-${g.id}`, type: 'Damaged materials', severity: 'warning', material: name(g.sku), ref: g.id, text: `${g.rejected} ${materialOf(g.sku).unit} rejected on delivery: ${g.rejectionReason || 'reason not given'}`, tab: 'receipts' })
    if (g.status === 'Pending Inspection') out.push({ id: `insp-${g.id}`, type: 'Uninspected delivery', severity: 'warning', material: name(g.sku), ref: g.id, text: `${g.delivered} ${materialOf(g.sku).unit} from ${g.supplier} not yet inspected; not in usable stock`, tab: 'receipts' })
  }
  for (const r of state.returns.filter((x) => x.status === 'Pending Inspection')) {
    out.push({ id: `ret-${r.id}`, type: 'Uninspected return', severity: 'warning', material: name(r.sku), ref: r.id, text: `${r.qty} ${materialOf(r.sku).unit} returned from site; not in usable stock until inspected`, tab: 'returns' })
  }
  for (const a of state.adjustments.filter((x) => x.status === 'Pending Review')) {
    out.push({ id: `adj-${a.id}`, type: 'Unresolved stock discrepancy', severity: 'warning', material: name(a.sku), ref: a.id, text: `${a.kind}: ${a.qty > 0 ? '+' : ''}${a.qty} at ${storeOf(a.storeId)?.name} awaiting review`, tab: 'returns' })
  }
  // The Store Keeper acts only once the Project Manager has approved the request
  for (const r of requests.filter((x) => x.status === MR.SUBMITTED)) {
    out.push({ id: `req-${r.id}`, type: 'New request to check', severity: 'info', material: r.material.name, ref: r.id, text: `${r.requested} ${r.material.unit} for ${r.site?.name} (${r.requestedBy}): check usable stock and send to the Project Manager`, tab: 'requests' })
  }
  for (const r of requests.filter((x) => x.shortage > 0 && ISSUABLE_REQUEST_STATUSES.includes(x.status))) {
    out.push({ id: `short-${r.id}`, type: 'Request exceeds available stock', severity: 'danger', material: r.material.name, ref: r.id, text: `Needs ${r.need}, only ${round2(r.need - r.shortage)} free. Shortage ${r.shortage} ${r.material.unit}${r.forwarded ? ` (forwarded as ${r.forwarded.id})` : ''}`, tab: 'requests' })
  }
  const rank = { danger: 0, warning: 1, info: 2 }
  return out.sort((a, b) => rank[a.severity] - rank[b.severity])
}

// ---------- Reports ----------

/** Issues less accepted returns, per project and material */
export function projectConsumption(state) {
  const reqById = Object.fromEntries(state.requests.map((r) => [r.id, r]))
  const issueById = Object.fromEntries(state.issues.map((i) => [i.id, i]))
  const rows = {}
  const add = (siteId, sku, issued, returned) => {
    const projectId = siteOf(siteId)?.projectId
    const k = `${projectId}|${sku}`
    rows[k] = rows[k] || { key: k, projectId, project: projectOf(projectId)?.name || projectId, sku, material: materialOf(sku), issued: 0, returned: 0 }
    rows[k].issued = round2(rows[k].issued + issued)
    rows[k].returned = round2(rows[k].returned + returned)
  }
  for (const i of state.issues) { const r = reqById[i.requestId]; if (r) add(r.siteId, r.sku, i.qty, 0) }
  for (const t of state.returns) { if (t.status === 'Accepted' && issueById[t.issueId]) add(t.siteId, t.sku, 0, t.accepted || 0) }
  return Object.values(rows).map((r) => ({ ...r, net: round2(r.issued - r.returned), value: round2((r.issued - r.returned) * (r.material?.rate || 0)) }))
    .sort((a, b) => a.project.localeCompare(b.project) || b.value - a.value)
}

/** Rejected on delivery, damaged on return, and approved damage write-offs */
export function damagedRegister(state) {
  const out = []
  for (const g of state.receipts) if (g.rejected > 0) out.push({ id: g.id, date: g.deliveryDate, source: 'Rejected on delivery', sku: g.sku, storeId: g.storeId, qty: g.rejected, reason: g.rejectionReason || '', ref: g.po, by: g.inspectedBy })
  for (const r of state.returns) if (r.damaged > 0) out.push({ id: r.id, date: (r.confirmedAt || r.at).slice(0, 10), source: 'Damaged on return', sku: r.sku, storeId: r.storeId, qty: r.damaged, reason: r.notes || r.reason, ref: r.issueId, by: r.inspectedBy })
  for (const a of state.adjustments) if (a.kind === 'Damaged') out.push({ id: a.id, date: a.at.slice(0, 10), source: a.status === 'Approved' ? 'Damaged in store (written off)' : `Damaged in store (${a.status.toLowerCase()})`, sku: a.sku, storeId: a.storeId, qty: -a.qty, reason: a.reason, ref: a.id, by: a.raisedBy })
  return out.map((r) => ({ ...r, material: materialOf(r.sku), store: storeOf(r.storeId), value: round2(r.qty * (materialOf(r.sku)?.rate || 0)) }))
    .sort((a, b) => b.date.localeCompare(a.date))
}

/** Receipt quantity differences and stock adjustments */
export function discrepancyRegister(state) {
  const out = []
  for (const g of state.receipts) {
    const issues = receiptDiscrepancies(g)
    if (g.status === 'Accepted' && issues.length) out.push({ id: g.id, date: g.deliveryDate, kind: 'Receipt vs PO', sku: g.sku, storeId: g.storeId, detail: issues.join('; '), status: g.discrepancy || 'Open', note: g.discrepancyNote, ref: g.po })
  }
  for (const a of state.adjustments) out.push({ id: a.id, date: a.at.slice(0, 10), kind: `Adjustment: ${a.kind}`, sku: a.sku, storeId: a.storeId, detail: `${a.qty > 0 ? '+' : ''}${a.qty}. ${a.reason}`, status: a.status, note: a.reviewNote || '', ref: a.id })
  return out.map((r) => ({ ...r, material: materialOf(r.sku), store: storeOf(r.storeId) })).sort((a, b) => b.date.localeCompare(a.date))
}

/** Aggregated per material across stores (Materials page) */
export function stockByMaterial(stock) {
  const by = {}
  for (const s of stock) {
    const m = (by[s.sku] = by[s.sku] || { sku: s.sku, material: s.material, onHand: 0, reserved: 0, onHold: 0, availableForIssue: 0, reorder: 0, value: 0, stores: 0, belowAt: [] })
    m.onHand = round2(m.onHand + s.onHand)
    m.reserved = round2(m.reserved + s.reserved)
    m.onHold = round2(m.onHold + s.onHold)
    m.availableForIssue = round2(m.availableForIssue + s.availableForIssue)
    m.reorder = round2(m.reorder + s.reorder)
    m.value += s.value
    m.stores += 1
    if (s.status !== 'In Stock') m.belowAt.push(s.store.name)
  }
  return Object.values(by).map((m) => ({ ...m, status: m.onHand <= 0 ? 'Out of Stock' : m.belowAt.length ? 'Low Stock' : 'In Stock' }))
}

// ---------- Material master ----------

export const MATERIAL_UNITS = ['Bags', 'Kg', 'Litres', 'Pieces', 'Cu.m', 'Boxes', 'Coils', 'Tonnes']
export const normalizeCode = (code) => String(code || '').trim().toUpperCase()

/**
 * How much a material is already used. Code and unit are locked once any transaction or
 * opening stock exists, because history is recorded against them.
 */
export function materialUsage(state, sku) {
  const lists = [state.receipts, state.requests, state.returns, state.transfers, state.adjustments, state.purchaseRequests]
  const transactions = lists.reduce((t, list) => t + list.filter((r) => r.sku === sku).length, 0) + (state.purchaseOrders || []).filter((l) => l.sku === sku).length
  const opening = round2(state.lines.filter((l) => l.sku === sku).reduce((t, l) => t + (l.opening || 0), 0))
  return { transactions, opening, locked: transactions > 0 || opening > 0 }
}

function numberError(value, label, unit, { required = true, positive = false } = {}) {
  if (value === '' || value == null) return required ? `${label} is required.` : ''
  const n = Number(value)
  if (Number.isNaN(n)) return `${label} must be a number.`
  if (n < 0) return `${label} cannot be negative.`
  if (positive && n === 0) return `${label} must be more than 0.`
  if (unit && !allowsDecimals(unit) && !Number.isInteger(n)) return `${label} must be a whole number of ${unit.toLowerCase()}.`
  return ''
}

/** Master details. `originalSku` is set when editing. Returns { field: message }. */
export function validateMaterial(f, materials, originalSku = null) {
  const e = {}
  const code = normalizeCode(f.sku)
  const others = materials.filter((m) => m.sku !== originalSku)
  if (!f.name?.trim()) e.name = 'Material name is required.'
  else if (others.some((m) => m.name.trim().toLowerCase() === f.name.trim().toLowerCase())) e.name = 'A material with this name already exists.'
  if (!code) e.sku = 'Material code is required.'
  else if (!/^[A-Z0-9][A-Z0-9-]{1,23}$/.test(code)) e.sku = 'Use 2–24 letters, digits or hyphens, e.g. MAT-TIL-300.'
  else if (others.some((m) => m.sku.toUpperCase() === code)) e.sku = `Code ${code} is already used by ${others.find((m) => m.sku.toUpperCase() === code).name}.`
  if (!f.category) e.category = 'Select a category.'
  if (!f.unit) e.unit = 'Select the unit of measurement.'
  if (!f.supplier?.trim()) e.supplier = 'Default supplier is required.'
  const r = numberError(f.rate, 'Default rate', null, { positive: true })
  if (r) e.rate = r
  return e
}

/** A stock record (material at one store). Opening stock is optional (default 0). */
export function validateStockLine(l, unit, { withOpening = true } = {}) {
  const e = {}
  if (!l.storeId) e.storeId = 'Select the project / store.'
  const r = numberError(l.reorder, 'Reorder level', unit)
  if (r) e.reorder = r
  if (!l.location?.trim()) e.location = 'Storage location is required.'
  if (withOpening) {
    const o = numberError(l.opening, 'Opening stock', unit, { required: false })
    if (o) e.opening = o
  }
  return e
}
