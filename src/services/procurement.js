/**
 * Procurement and supplier-payables workflow (pure functions, no React).
 *
 * One shared record set drives the Store Keeper, Purchase Orders, Admin and Accountant screens:
 *   material request → Project Manager review → Store Keeper stock check → issue, or shortage
 *   requisition → (Admin review when policy requires) → Purchase Manager quotations → purchase
 *   order → PO approval (by value) →
 *   goods receipt (accepted / rejected) → supplier invoice → three-way match → verification →
 *   payment approval by Admin (net of advances) → payment.
 *
 * Every transition is a function `(state, args, actor) → { state } | { error }`. It checks the
 * record's CURRENT status first, so repeating an action (double click, second tab) is refused
 * instead of creating a duplicate. Each change is written to the record's history and to the
 * shared audit trail.
 *
 * Roles that have no login in this demo (Site Engineer, Project Manager, Purchase Manager) act
 * through clearly labelled simulation controls; their actor carries `simulated: true`.
 * DEMO: nothing here is saved or sent.
 */
import { can, PERMISSIONS as P } from '../auth/demoRoles.js'
import { PEOPLE, PROJECT_MANAGERS, PURCHASE_REQUESTS, RECEIPTS } from '../data/demo/inventoryDemo.js'
import {
  CREDIT_DAYS, PO_PM_APPROVAL_LIMIT, PROCUREMENT_REQUISITIONS, PURCHASE_ORDERS, REQUISITION_ADMIN_REVIEW_ABOVE, SUPPLIER_ADVANCES, SUPPLIER_INVOICES,
  SUPPLIERS,
} from '../data/demo/procurementDemo.js'
import { addDays, todayISO } from '../utils/date.js'
import {
  activeRequisitionFor, computeStock, EDITABLE_REQUEST_STATUSES, issuableFor, issuedByRequest, materialOf, MR, nextId, nowStamp, poReceiptStatus,
  round2, siteOf, storeOf,
} from './inventory.js'

const rupees = (n) => Math.round(Number(n) || 0)
const sum = (rows, f) => rows.reduce((s, r) => s + (typeof f === 'function' ? f(r) : r[f] || 0), 0)
const fmt = (n) => `₹${rupees(n).toLocaleString('en-IN')}`

// ---------- Actors (who did it) ----------
/** Simulated people for roles that have no login in this demo. */
export const SIMULATED = {
  siteEngineer: (name) => ({ name, role: 'Site Engineer', simulated: true }),
  projectManager: (projectId) => ({ name: PROJECT_MANAGERS[projectId] || 'Project Manager', role: 'Project Manager', simulated: true }),
  purchaseManager: () => ({ name: PEOPLE.purchaseManager, role: 'Purchase Manager', simulated: true }),
  supplier: (name) => ({ name, role: 'Supplier', simulated: true }),
}
/** Actor for a signed-in demo user. */
export const actorOf = (user, role) => ({ name: user.name, role: role.label, roleId: role.id })
const allowed = (actor, perm) => !!actor?.roleId && can(actor.roleId, perm)

// ---------- Policy ----------
export const poApproverRole = (amount) => (amount > PO_PM_APPROVAL_LIMIT ? 'Admin' : 'Purchase Manager')
export const requisitionNeedsAdmin = (estimate) => estimate > REQUISITION_ADMIN_REVIEW_ABOVE
export const POLICY = { PO_PM_APPROVAL_LIMIT, REQUISITION_ADMIN_REVIEW_ABOVE }

// ---------- Initial shared state ----------
function historicInvoice(inv, po) {
  const amount = rupees(inv.qty * po.rate)
  const decidedAt = `${addDays(inv.date, 3)}T12:00`
  const payments = (inv.payments || []).map((p) => ({ ...p, amount: p.amount === 'full' ? amount : p.amount }))
  return {
    verification: 'Verified', verifiedAmount: amount, verifiedBy: 'Accounts User', verifiedAt: `${addDays(inv.date, 1)}T11:00`,
    request: payments.length ? { id: `SPR-${inv.id.slice(3)}`, amount, advanceAdjust: 0, net: amount, requestedBy: 'Accounts User', at: `${addDays(inv.date, 2)}T10:00`, status: 'Approved', decidedBy: PEOPLE.admin, decidedAt, reason: '' } : null,
    payments,
  }
}

/** The shared procurement records for a new session (POs, invoices, advances, payments). */
export function initialProcurementState() {
  const supplierPayments = []
  const supplierInvoices = SUPPLIER_INVOICES.map((inv) => {
    const po = PURCHASE_ORDERS.find((p) => p.id === inv.poId)
    const base = { id: inv.id, invoiceNo: inv.invoiceNo, poId: inv.poId, supplier: po.vendor, projectId: po.projectId, date: inv.date, qty: inv.qty, rate: inv.rate ?? po.rate, recordedBy: 'Accounts User', demo: true }
    if (!inv.historic) {
      return { ...base, verification: 'Awaiting Verification', verifiedAmount: null, request: null, history: [{ at: `${inv.date}T10:00`, by: 'Accounts User', role: 'Accountant', action: 'Supplier invoice recorded' }] }
    }
    const h = historicInvoice(inv, po)
    h.payments.forEach((p, i) => supplierPayments.push({ id: `SP-${inv.id.slice(3)}${i ? `-${i + 1}` : ''}`, invoiceId: inv.id, poId: inv.poId, supplier: po.vendor, projectId: po.projectId, date: p.date, amount: p.amount, mode: p.mode, reference: p.reference, recordedBy: 'Accounts User', approvedBy: PEOPLE.admin }))
    return {
      ...base, verification: h.verification, verifiedAmount: h.verifiedAmount, verifiedBy: h.verifiedBy, verifiedAt: h.verifiedAt, request: h.request, historic: true,
      history: [
        { at: `${inv.date}T10:00`, by: 'Accounts User', role: 'Accountant', action: 'Supplier invoice recorded' },
        { at: h.verifiedAt, by: h.verifiedBy, role: 'Accountant', action: 'Verified: PO, goods receipt and invoice agree' },
        ...(h.request ? [{ at: h.request.at, by: 'Accounts User', role: 'Accountant', action: `Payment approval requested (${fmt(h.request.net)})` }, { at: h.request.decidedAt, by: PEOPLE.admin, role: 'Admin', action: 'Payment release approved' }] : []),
      ],
    }
  })
  return {
    purchaseOrders: PURCHASE_ORDERS,
    suppliers: SUPPLIERS,
    // Requisitions already processed by the Purchase Manager plus the Store Keeper's open ones
    purchaseRequests: [...PROCUREMENT_REQUISITIONS, ...PURCHASE_REQUESTS],
    supplierInvoices,
    supplierPayments,
    supplierAdvances: SUPPLIER_ADVANCES,
    procurementJournals: [],
    audit: [],
  }
}

// ---------- Small state helpers ----------
const stamp = () => nowStamp()
/** History / audit entry: who, when, what, why, and (when a status changes) previous → new status */
const event = (actor, action, note = '', change = null) => ({ at: stamp(), by: actor.name, role: actor.role + (actor.simulated ? ' (simulated)' : ''), action, note, ...(change && { from: change[0], to: change[1] }) })
function withAudit(state, actor, ref, action, note = '') {
  return [{ id: `AUD-${(state.audit?.length || 0) + 1}`, ref, ...event(actor, action, note) }, ...(state.audit || [])]
}
const updateIn = (list, id, fn) => list.map((r) => (r.id === id ? fn(r) : r))
const fail = (error) => ({ error })
const ok = (state, message) => ({ state, message })
function journal(state, entry) {
  const id = `JE-PRC-${(state.procurementJournals?.length || 0) + 1}`
  const lines = entry.lines.filter((l) => (l.dr || l.cr) > 0)
  return [...(state.procurementJournals || []), { id, origin: 'System', status: 'Posted', date: todayISO(), ...entry, lines, amount: sum(lines, 'dr') }]
}

// ---------- Material requests (site → Project Manager → store → issue or purchase) ----------
export function validateNewRequest(f, { draft = false } = {}) {
  if (!f.siteId) return 'Select the site.'
  if (!f.sku) return 'Select the material from the material master.'
  if (!materialOf(f.sku)) return 'This material is not in the material master. Ask the Store Keeper to add it first.'
  if (draft) return '' // drafts may be saved incomplete; everything is checked on submission
  if (!f.storeId) return 'Select the store to issue from.'
  const n = Number(f.qty)
  if (!(n > 0)) return 'Enter the quantity required (more than 0).'
  const unit = materialOf(f.sku)?.unit
  if (!['Tonnes', 'Cu.m', 'Kg', 'Litres'].includes(unit) && !Number.isInteger(n)) return `Quantity must be a whole number of ${unit?.toLowerCase()}.`
  if (!f.requiredBy) return 'Enter the date the material is needed by.'
  if (f.requiredBy < todayISO()) return 'The required-by date cannot be in the past.'
  if (!f.purpose?.trim()) return 'Give the reason for the requirement (work item / location).'
  return ''
}

const requestFields = (f) => ({
  siteId: f.siteId, storeId: f.storeId || '', sku: f.sku, requested: f.qty === '' || f.qty == null ? 0 : round2(f.qty), requiredBy: f.requiredBy || '',
  priority: f.priority || 'Normal', purpose: f.purpose?.trim() || '', workArea: f.workArea?.trim() || '', taskId: f.taskId || null,
  remarks: f.remarks?.trim() || '', attachments: (f.attachments || []).map((x) => x.name || x),
})

/** Free stock for a request: on hand − on hold − what OTHER requests have reserved */
function freeFor(state, r) {
  return issuableFor(r, computeStock(state), issuedByRequest(state.issues)).free
}
const statusChange = (x, to, actor, action, note = '') => ({ ...x, status: to, history: [...(x.history || []), event(actor, action, note, [x.status, to])] })

/**
 * Site Engineer saves a draft or submits a request. A submitted request goes to the Store Keeper's
 * stock check first, then to the Project Manager. Editing a Draft or a Returned request (same id)
 * updates it in place. Never creates a PO, reserves stock or issues anything.
 */
export function submitMaterialRequest(state, f, actor) {
  // A signed-in user needs the permission; simulated people (demo stand-ins) carry no roleId
  if (actor.roleId && !allowed(actor, P.MATERIAL_REQUEST_CREATE)) return fail('Material requests are raised by the Site Engineer.')
  const draft = !!f.draft
  const e = validateNewRequest(f, { draft })
  if (e) return fail(e)
  const existing = f.id ? state.requests.find((r) => r.id === f.id) : null
  if (f.id && !existing) return fail('Request not found.')
  if (existing) {
    if (existing.requestedBy !== actor.name) return fail(`${existing.id} was raised by ${existing.requestedBy}; only they can change it.`)
    if (!EDITABLE_REQUEST_STATUSES.includes(existing.status)) return fail(`${existing.id} is ${existing.status.toLowerCase()} and can no longer be edited.`)
  }
  // Double-click / resubmission guard: the same request is already submitted and not yet decided
  if (!draft && state.requests.some((r) => r.id !== f.id && [MR.SUBMITTED, MR.PM_REVIEW].includes(r.status) && r.requestedBy === actor.name && r.siteId === f.siteId && r.sku === f.sku && Number(r.requested) === Number(f.qty) && (r.purpose || '').trim() === (f.purpose || '').trim())) {
    return fail('This request has already been submitted and is waiting for review.')
  }
  const status = draft ? MR.DRAFT : MR.SUBMITTED
  const unit = materialOf(f.sku)?.unit
  const action = draft ? 'Draft saved' : existing?.status === MR.RETURNED ? 'Corrected and resubmitted' : 'Request submitted'
  const note = draft ? '' : `${f.qty} ${unit} for ${siteOf(f.siteId)?.name}; next: Store Keeper stock check`
  if (existing) {
    return ok({
      ...state,
      requests: updateIn(state.requests, existing.id, (x) => ({ ...x, ...requestFields(f), status, at: draft ? x.at : stamp(), checkedBy: null, checkNote: '', history: [...(x.history || []), event(actor, action, note, [x.status, status])] })),
      audit: withAudit(state, actor, existing.id, action, note),
    }, draft ? `${existing.id} saved as a draft` : `${existing.id} submitted: the Store Keeper checks stock, then the Project Manager reviews`)
  }
  const id = nextId(state.requests, 'MR-')
  const req = {
    id, ...requestFields(f), approved: null, requestedBy: actor.name, approvedBy: null, status, at: stamp(), demo: true,
    supplementTo: f.supplementTo || null, // additional quantity requested against an earlier request
    history: [event(actor, action, note, ['New', status])],
  }
  return ok({ ...state, requests: [...state.requests, req], audit: withAudit(state, actor, id, action, note) }, draft ? `${id} saved as a draft (not sent to anyone)` : `${id} submitted: the Store Keeper checks stock, then the Project Manager reviews`)
}

/** Requester withdraws a request the Project Manager has not approved yet. */
export function cancelMaterialRequest(state, { id, reason }, actor) {
  const r = state.requests.find((x) => x.id === id)
  if (!r) return fail('Request not found.')
  if (r.requestedBy !== actor.name) return fail(`Only ${r.requestedBy}, who raised ${id}, can cancel it.`)
  if (![MR.DRAFT, MR.SUBMITTED, MR.PM_REVIEW, MR.RETURNED].includes(r.status)) return fail(`${id} is ${r.status.toLowerCase()}; ask the Project Manager to close an approved request.`)
  if (r.status !== MR.DRAFT && (!reason?.trim() || reason.trim().length < 5)) return fail('Give the reason for cancelling.')
  return ok({
    ...state,
    requests: updateIn(state.requests, id, (x) => ({ ...statusChange(x, MR.CANCELLED, actor, 'Cancelled by requester', reason?.trim() || ''), reason: `Cancelled by requester${reason?.trim() ? `: ${reason.trim()}` : ''}` })),
    audit: withAudit(state, actor, id, 'Material request cancelled', reason || ''),
  }, `${id} cancelled`)
}

/**
 * Store Keeper checks usable stock for a SUBMITTED request and records what is free (on hand −
 * reserved − on hold) and any shortage. The request then goes to the Project Manager whatever the
 * stock position. Nothing is reserved or issued here.
 */
export function checkRequest(state, { id, note }, actor) {
  const r = state.requests.find((x) => x.id === id)
  if (!r) return fail('Request not found.')
  if (!allowed(actor, P.MATERIAL_REQUEST_REVIEW)) return fail('Only the Store Keeper checks stock for a request.')
  if (r.status !== MR.SUBMITTED) return fail(`${id} is ${r.status.toLowerCase()}; there is no stock check to record.`)
  const free = freeFor(state, r)
  const unit = materialOf(r.sku)?.unit
  const short = Math.max(0, round2(r.requested - free))
  const finding = short ? `${free} ${unit} free at ${storeOf(r.storeId)?.name}: short by ${short} of ${r.requested} requested` : `${free} ${unit} free at ${storeOf(r.storeId)?.name}: covers the ${r.requested} requested`
  const text = [finding, note?.trim()].filter(Boolean).join('. ')
  return ok({
    ...state,
    requests: updateIn(state.requests, id, (x) => ({ ...statusChange(x, MR.PM_REVIEW, actor, 'Stock checked; sent to the Project Manager for review', text), checkedBy: actor.name, checkedAt: stamp(), checkNote: text, freeAtCheck: free, shortAtCheck: short })),
    audit: withAudit(state, actor, id, 'Stock checked, sent to Project Manager', text),
  }, `${id} checked (${short ? `short by ${short} ${unit}` : 'enough stock'}) and sent to the Project Manager`)
}

/**
 * Project Manager decision on need, quantity, urgency and budget relevance: approve (in full or in
 * part), return for clarification, or reject. Approval reserves the free stock for the request; any
 * shortage is forwarded by the Store Keeper. Approving a request never approves a purchase order.
 */
export function decideRequest(state, { id, decision, approve, qty, reason }, actor) {
  const d = decision || (approve ? 'approve' : 'reject')
  const r = state.requests.find((x) => x.id === id)
  if (!r) return fail('Request not found.')
  if (actor.role !== 'Project Manager') return fail('Material requests are reviewed by the Project Manager.')
  if (r.status === MR.SUBMITTED) return fail(`${id} is waiting for the Store Keeper's stock check before your review.`)
  if (r.status !== MR.PM_REVIEW) return fail(`${id} is ${r.status.toLowerCase()}; it is not waiting for the Project Manager.`)
  if (r.requestedBy === actor.name) return fail('You cannot approve your own request; another approver must decide.')
  // A signed-in Project Manager decides only requests for projects they manage
  if (actor.roleId && PROJECT_MANAGERS[siteOf(r.siteId)?.projectId] !== actor.name) return fail(`Only ${PROJECT_MANAGERS[siteOf(r.siteId)?.projectId] || 'the Project Manager'}, the Project Manager of this project, can decide this request.`)
  const why = reason?.trim() || ''
  if (d === 'approve') {
    const n = Number(qty)
    if (!(n > 0)) return fail('Enter the quantity to approve.')
    if (n > r.requested) return fail(`Cannot approve more than the ${r.requested} requested.`)
    if (n < r.requested && why.length < 5) return fail('Give the reason for approving less than requested.')
    const free = freeFor(state, r)
    const unit = materialOf(r.sku)?.unit
    const note = `Approved ${n} of ${r.requested}${why ? `. ${why}` : ''}${free < n ? `. Only ${free} ${unit} free: the Store Keeper forwards the ${round2(n - free)} ${unit} shortage for purchase` : ''}`
    return ok({
      ...state,
      requests: updateIn(state.requests, id, (x) => ({ ...statusChange(x, MR.APPROVED, actor, 'Approved by Project Manager', note), approved: round2(n), approvedBy: actor.name, approvedAt: stamp(), pmNote: why })),
      audit: withAudit(state, actor, id, 'Material request approved', note),
    }, `${id} approved for ${n}${free < n ? `; shortage ${round2(n - free)} for the Store Keeper to forward` : '; ready for the Store Keeper to issue'}`)
  }
  if (why.length < 5) return fail(d === 'return' ? 'Say what needs clarifying (it is sent back to the requester).' : 'Give the reason for rejecting (it is returned to the requester).')
  const returned = d === 'return'
  const to = returned ? MR.RETURNED : MR.REJECTED
  return ok({
    ...state,
    requests: updateIn(state.requests, id, (x) => ({
      ...statusChange(x, to, actor, returned ? `Returned to ${x.requestedBy} for clarification` : `Rejected; returned to ${x.requestedBy}`, why),
      reviewedBy: actor.name, approvedBy: returned ? null : actor.name, reason: why, returnedTo: x.requestedBy,
    })),
    audit: withAudit(state, actor, id, returned ? 'Material request returned for clarification' : 'Material request rejected', why),
  }, `${id} ${returned ? 'returned for clarification' : 'rejected'}`)
}

/**
 * Close the unissued balance of an approved request (e.g. the work changed). Releases the
 * reservation; what was issued stays issued. Project Manager of the project, or the requester.
 */
export function closeMaterialRequest(state, { id, reason }, actor) {
  const r = state.requests.find((x) => x.id === id)
  if (!r) return fail('Request not found.')
  const pmOfReq = PROJECT_MANAGERS[siteOf(r.siteId)?.projectId]
  if (r.requestedBy !== actor.name && !(actor.role === 'Project Manager' && (!actor.roleId || pmOfReq === actor.name))) return fail('Only the requester or the project\'s Project Manager can close a request.')
  if (![MR.APPROVED, MR.PARTIAL].includes(r.status)) return fail(`${id} is ${r.status.toLowerCase()}; only an approved request with a balance can be closed.`)
  if (!reason?.trim() || reason.trim().length < 5) return fail('Give the reason for closing the balance.')
  const open = activeRequisitionFor(state, id)
  const issued = issuedByRequest(state.issues)[id] || 0
  const note = `Balance ${round2(r.approved - issued)} ${materialOf(r.sku)?.unit} no longer needed: ${reason.trim()}${open ? `. Linked ${open.id} is still open with the Purchase Manager` : ''}`
  return ok({
    ...state,
    requests: updateIn(state.requests, id, (x) => ({ ...statusChange(x, MR.CLOSED, actor, 'Balance closed', note), closedBy: actor.name, reason: reason.trim() })),
    audit: withAudit(state, actor, id, 'Material request closed', note),
  }, `${id} closed; reserved balance released`)
}

// ---------- Requisitions to the Purchase Manager ----------
export const estimateOf = (sku, qty) => rupees((materialOf(sku)?.rate || 0) * qty)
export const OPEN_REQUISITION = ['Awaiting Admin Review', 'Sent to Purchase Manager', 'Quotations Requested', 'Supplier Selected']

/**
 * Store Keeper forwards a shortage on an APPROVED request (linked by requestRef) or a reorder
 * need (no site request). Never places an order or creates a payment.
 */
export function raiseRequisition(state, f, actor) {
  if (!allowed(actor, P.PURCHASE_REQUEST_RAISE)) return fail('Requisitions are raised by the Store Keeper.')
  const n = Number(f.qty)
  if (!(n > 0)) return fail('Enter the quantity required.')
  if (!f.reason?.trim()) return fail('Give the reason for the requisition.')
  if (f.requestRef) {
    const r = state.requests.find((x) => x.id === f.requestRef)
    if (!r || ![MR.APPROVED, MR.PARTIAL].includes(r.status)) return fail('A shortage can be forwarded only after the Project Manager has approved the request.')
    const open = activeRequisitionFor(state, f.requestRef)
    if (open) return fail(`The shortage on ${f.requestRef} is already covered by ${open.id}${open.poId ? ` (${open.poId} not fully delivered)` : ''}.`)
  } else if (state.purchaseRequests.some((p) => p.sku === f.sku && p.storeId === f.storeId && OPEN_REQUISITION.includes(p.status))) {
    return fail('An open requisition for this material and store already exists.')
  }
  const id = nextId(state.purchaseRequests, 'PR-')
  const estimate = estimateOf(f.sku, n)
  const status = requisitionNeedsAdmin(estimate) ? 'Awaiting Admin Review' : 'Sent to Purchase Manager'
  const req = f.requestRef ? state.requests.find((x) => x.id === f.requestRef) : null
  const pr = {
    id, sku: f.sku, storeId: f.storeId, qty: round2(n), reason: f.reason.trim(), requestRef: f.requestRef || null, raisedBy: actor.name, status, estimate,
    origin: req ? 'Site request shortage' : 'Reorder — no site request', projectId: req ? siteOf(req.siteId)?.projectId : storeOf(f.storeId)?.projectId || null,
    priority: f.priority || req?.priority || 'Normal', requiredBy: f.requiredBy || req?.requiredBy || addDays(todayISO(), 7),
    note: status === 'Awaiting Admin Review' ? `Estimated ${fmt(estimate)}: above the ${fmt(REQUISITION_ADMIN_REVIEW_ABOVE)} review limit` : 'With the Purchase Manager for quotations',
    at: stamp(), demo: true, history: [event(actor, 'Requisition raised', `${n} ${materialOf(f.sku)?.unit}, estimated ${fmt(estimate)}${req ? ` for ${req.id}` : ' (reorder)'}`, ['New', status])],
  }
  // The request keeps its status (Approved / Partially Issued) and records the link
  const requests = req ? updateIn(state.requests, req.id, (x) => ({
    ...x, requisitionIds: [...(x.requisitionIds || []), id],
    history: [...(x.history || []), event(actor, `Shortage forwarded to the Purchase Manager as ${id}`, `${n} ${materialOf(f.sku)?.unit}; no purchase order or payment created`)],
  })) : state.requests
  return ok({ ...state, requests, purchaseRequests: [...state.purchaseRequests, pr], audit: withAudit(state, actor, id, 'Requisition raised', f.reason) }, `${id} raised (${status})`)
}

/** Admin review of a requisition above the review limit: approve, return to the Store Keeper, or reject. */
export function reviewRequisition(state, { id, approve, decision, reason }, actor) {
  const d = decision || (approve ? 'approve' : 'reject')
  const pr = state.purchaseRequests.find((x) => x.id === id)
  if (!pr) return fail('Requisition not found.')
  if (!allowed(actor, P.REQUISITION_REVIEW)) return fail('Requisitions above the review limit are reviewed by Admin.')
  if (pr.status !== 'Awaiting Admin Review') return fail(`${id} is ${pr.status.toLowerCase()}; no review is pending.`)
  if (pr.raisedBy === actor.name) return fail('You raised this requisition; someone else must review it.')
  if (d !== 'approve' && (!reason?.trim() || reason.trim().length < 5)) return fail(`Give the reason for ${d === 'return' ? 'returning' : 'rejecting'}.`)
  const status = d === 'approve' ? 'Sent to Purchase Manager' : d === 'return' ? 'Returned to Store Keeper' : 'Rejected by Admin'
  const action = d === 'approve' ? 'Reviewed by Admin: proceed to purchase' : d === 'return' ? 'Returned by Admin for correction' : 'Rejected by Admin'
  const note = reason?.trim() || ''
  return ok({
    ...state,
    purchaseRequests: updateIn(state.purchaseRequests, id, (x) => ({ ...x, status, reviewedBy: actor.name, reviewedAt: stamp(), reviewNote: note, returnReason: d === 'return' ? note : x.returnReason, history: [...(x.history || []), event(actor, action, note, [x.status, status])] })),
    audit: withAudit(state, actor, id, action, note),
  }, `${id} ${d === 'approve' ? 'sent to the Purchase Manager' : d === 'return' ? 'returned to the Store Keeper' : 'rejected'}`)
}

/**
 * Admin decision on a PO waiting for approval: approve, reject, or return to the Purchase Manager
 * for correction (back to Draft; resubmitted after editing). POs within the Purchase Manager's
 * limit are approved when the Purchase Manager submits them. A material request approval is never
 * treated as PO approval.
 */
export function decidePurchaseOrder(state, { id, approve, decision, reason }, actor) {
  const d = decision || (approve ? 'approve' : 'reject')
  const po = state.purchaseOrders.find((x) => x.id === id)
  if (!po) return fail('Purchase order not found.')
  if (po.approval !== 'Pending Approval') return fail(`${id} is already ${po.approval.toLowerCase()}.`)
  if (!allowed(actor, P.PO_APPROVE)) return fail(`${id} (${fmt(po.amount)}) is above the Purchase Manager limit and needs Admin approval.`)
  if (po.raisedBy === actor.name) return fail('A purchase order cannot be approved by the person who raised it.')
  if (d !== 'approve' && (!reason?.trim() || reason.trim().length < 5)) return fail(`Give the reason for ${d === 'return' ? 'returning' : 'rejecting'}.`)
  const note = reason?.trim() || ''
  const to = d === 'approve' ? 'Approved' : d === 'return' ? 'Draft' : 'Rejected'
  const action = d === 'approve' ? 'Approved by Admin' : d === 'return' ? 'Returned for correction' : 'Rejected by Admin'
  return ok({
    ...state,
    purchaseOrders: updateIn(state.purchaseOrders, id, (x) => ({
      ...x, approval: to, approvedBy: d === 'approve' ? actor.name : null, approvedAt: d === 'approve' ? stamp() : null,
      decidedBy: actor.name, decidedAt: stamp(), decisionNote: note, returnNote: d === 'return' ? note : x.returnNote,
      history: [...(x.history || []), event(actor, action, note, [x.approval, to])],
    })),
    audit: withAudit(state, actor, id, `Purchase order: ${action.toLowerCase()}`, note),
  }, `${id} ${d === 'approve' ? 'approved' : d === 'return' ? 'returned to the Purchase Manager for correction' : 'rejected'}`)
}

// ---------- Supplier invoices: three-way match (PO × GRN × invoice) ----------
/**
 * Accountant's view of one supplier invoice. Delivered and accepted quantities always come from
 * the Store Keeper's goods receipts; the ordered quantity is never treated as delivered and the
 * delivered quantity is never treated as accepted.
 */
export function supplierBill(state, inv, today = todayISO()) {
  const po = state.purchaseOrders.find((p) => p.id === inv.poId)
  const m = materialOf(po.sku) || { name: po.item || 'Service', unit: 'Nos' }
  const preRecords = !!po.receivedBeforeStockRecords
  const grns = preRecords ? [] : state.receipts.filter((g) => g.po === po.id)
  const inspected = grns.filter((g) => g.status === 'Accepted')
  const deliveredQty = preRecords ? po.qty : round2(sum(grns, 'delivered'))
  const acceptedQty = preRecords ? po.qty : round2(sum(inspected, (g) => g.accepted || 0))
  const rejectedQty = preRecords ? 0 : round2(sum(inspected, (g) => g.rejected || 0))
  const pendingInspectionQty = round2(sum(grns.filter((g) => g.status === 'Pending Inspection'), 'delivered'))
  // Earlier invoices on the same PO use up accepted quantity first (part deliveries, lots)
  const earlier = state.supplierInvoices.filter((x) => x.poId === inv.poId && x.id < inv.id && x.verification !== 'Returned to Supplier')
  const billableQty = Math.max(0, round2(acceptedQty - sum(earlier, 'qty')))
  const payableQty = Math.min(inv.qty, billableQty)
  const invoiceRate = inv.rate ?? po.rate
  const amount = rupees(inv.qty * invoiceRate)
  const acceptedValue = rupees(payableQty * Math.min(invoiceRate, po.rate))
  const gstRate = po.gstRate ?? 18

  const issues = []
  if (pendingInspectionQty > 0) issues.push(`${pendingInspectionQty} ${m.unit} delivered but not yet inspected; accepted quantity not known`)
  if (inv.qty > billableQty && !pendingInspectionQty) issues.push(`Billed ${inv.qty} ${m.unit}; accepted ${billableQty}${rejectedQty ? ` (${rejectedQty} rejected on delivery)` : ''}`)
  if (invoiceRate > po.rate) issues.push(`Rate ₹${invoiceRate} billed vs PO rate ₹${po.rate}`)
  if (po.approval !== 'Approved') issues.push(`PO is ${po.approval.toLowerCase()}`)
  const matchStatus = !issues.length ? 'Matched'
    : pendingInspectionQty > 0 ? 'Awaiting inspection'
      : po.approval !== 'Approved' ? 'PO not approved'
        : inv.qty > billableQty ? 'Qty mismatch' : 'Rate mismatch'

  const payments = state.supplierPayments.filter((p) => p.invoiceId === inv.id).sort((a, b) => a.date.localeCompare(b.date))
  const paidAmount = rupees(sum(payments, 'amount'))
  const advances = state.supplierAdvances.filter((a) => a.poId === inv.poId)
  const advanceAvailable = rupees(sum(advances, (a) => a.amount - sum(a.adjusted || [], 'amount')))
  const req = inv.request
  const advanceAdjusted = req?.status === 'Approved' ? req.advanceAdjust || 0 : 0
  const verifiedAmount = inv.verifiedAmount
  const approvedNet = req?.status === 'Approved' ? req.net : 0
  const remainingApproved = Math.max(0, approvedNet - paidAmount)

  const dueDate = addDays(inv.date, (state.suppliers || []).find((x) => x.name === po.vendor)?.creditDays ?? CREDIT_DAYS[po.vendor] ?? 30)
  let paymentStatus
  if (inv.verification !== 'Verified') paymentStatus = inv.verification
  else if (req?.status === 'Pending') paymentStatus = 'Awaiting Payment Approval'
  else if (req?.status === 'Approved') paymentStatus = paidAmount >= approvedNet ? 'Paid' : paidAmount > 0 ? 'Partially Paid' : 'Approved for Payment'
  else paymentStatus = dueDate < today ? 'Overdue' : 'Due'
  const owed = verifiedAmount ?? amount
  const last = payments[payments.length - 1]

  return {
    id: inv.id, invoiceNo: inv.invoiceNo, supplier: po.vendor, poId: po.id, projectId: po.projectId, sku: po.sku,
    material: m.name, unit: m.unit, poStatus: po.approval, poApprovedBy: po.approvedBy,
    grnIds: grns.map((g) => g.id), grnId: preRecords ? 'GRN before stock records' : grns.map((g) => g.id).join(', ') || 'No GRN yet',
    delivery: preRecords ? 'Delivered' : !grns.length ? 'Not delivered' : pendingInspectionQty ? 'Inspection pending' : deliveredQty < po.qty ? 'Partially delivered' : 'Delivered',
    orderedQty: po.qty, deliveredQty, acceptedQty, receivedQty: acceptedQty, rejectedQty, pendingInspectionQty, invoicedQty: inv.qty, billableQty, payableQty,
    poRate: po.rate, invoiceRate, amount, gstRate, taxable: rupees(amount / (1 + gstRate / 100)), gst: amount - rupees(amount / (1 + gstRate / 100)),
    acceptedValue, overBilled: Math.max(0, amount - acceptedValue), matchStatus, matchIssues: issues,
    invoiceDate: inv.date, dueDate, verification: inv.verification, verifiedAmount, verifiedBy: inv.verifiedBy, debitNote: inv.debitNote || null,
    paymentStatus, request: req, advanceAvailable, advanceAdjusted, approvedNet, remainingApproved,
    paidAmount, paidShare: owed ? paidAmount / owed : 0, payments, paidOn: last?.date || null, paymentMode: last?.mode || null, paymentRef: last?.reference || null,
    balance: Math.max(0, owed - advanceAdjusted - paidAmount),
    history: inv.history || [], historic: !!inv.historic, demo: inv.demo,
  }
}

export const supplierBillRows = (state, today) => state.supplierInvoices.map((inv) => supplierBill(state, inv, today))

/** POs that can be invoiced: approved material POs with at least one goods receipt and quantity not yet billed. */
export function invoiceablePOs(state) {
  return state.purchaseOrders.filter((po) => {
    if (po.approval !== 'Approved' || !po.sku || po.receivedBeforeStockRecords) return false
    const st = poReceiptStatus(state, po.id)
    const billed = sum(state.supplierInvoices.filter((x) => x.poId === po.id && x.verification !== 'Returned to Supplier'), 'qty')
    return st && st.grns.length > 0 && billed < st.delivered
  })
}

export function recordSupplierInvoice(state, f, actor) {
  if (!allowed(actor, P.EXPENSE_VERIFY)) return fail('Supplier invoices are recorded by Accounts.')
  const po = state.purchaseOrders.find((p) => p.id === f.poId)
  if (!po) return fail('Select the purchase order the invoice is for.')
  if (po.approval !== 'Approved') return fail(`${po.id} is not approved; an invoice cannot be recorded against it.`)
  if (!f.invoiceNo?.trim()) return fail('Enter the supplier invoice number.')
  if (state.supplierInvoices.some((x) => x.supplier === po.vendor && x.invoiceNo.trim().toLowerCase() === f.invoiceNo.trim().toLowerCase()))
    return fail(`Invoice ${f.invoiceNo.trim()} from ${po.vendor} is already recorded. The same invoice cannot be booked twice.`)
  if (!f.date || f.date > todayISO()) return fail('Enter the invoice date (not in the future).')
  const qty = Number(f.qty)
  const rate = Number(f.rate)
  if (!(qty > 0)) return fail('Enter the quantity billed.')
  if (!(rate > 0)) return fail('Enter the rate billed.')
  const id = nextId(state.supplierInvoices, 'SI-')
  const inv = {
    id, invoiceNo: f.invoiceNo.trim(), poId: po.id, supplier: po.vendor, projectId: po.projectId, date: f.date, qty: round2(qty), rate,
    recordedBy: actor.name, verification: 'Awaiting Verification', verifiedAmount: null, request: null, demo: true,
    history: [event(actor, 'Supplier invoice recorded', `${qty} × ₹${rate}`)],
  }
  return ok({ ...state, supplierInvoices: [...state.supplierInvoices, inv], audit: withAudit(state, actor, id, 'Supplier invoice recorded', `${inv.invoiceNo} · ${po.id}`) }, `${id} recorded`)
}

const invoiceUpdate = (state, id, fn) => ({ ...state, supplierInvoices: updateIn(state.supplierInvoices, id, fn) })

/**
 * Verify for payment. The verified amount is the ACCEPTED value at no more than the PO rate.
 * Anything billed above it needs a note and is recorded as a debit note (short payment).
 */
export function verifyInvoice(state, { id, note }, actor) {
  if (!allowed(actor, P.EXPENSE_VERIFY)) return fail('Supplier invoices are verified by Accounts.')
  const inv = state.supplierInvoices.find((x) => x.id === id)
  if (!inv) return fail('Invoice not found.')
  if (inv.verification !== 'Awaiting Verification') return fail(`${id} is ${inv.verification.toLowerCase()}; it cannot be verified again.`)
  const b = supplierBill(state, inv)
  if (b.matchStatus === 'Awaiting inspection') return fail('Goods are still awaiting inspection at the store. Verify after the Store Keeper records the accepted quantity.')
  if (b.matchStatus === 'PO not approved') return fail(`${b.poId} is not approved.`)
  if (b.acceptedValue <= 0) return fail('Nothing has been accepted against this PO yet; there is nothing to pay.')
  const short = b.amount - b.acceptedValue
  if (short > 0 && (!note?.trim() || note.trim().length < 5)) return fail(`The invoice is ${fmt(short)} above the accepted value. Explain the debit note (e.g. rejected bags returned).`)
  const debitNote = short > 0 ? { amount: short, qty: round2(b.invoicedQty - b.payableQty), reason: note.trim() } : null
  const next = invoiceUpdate(state, id, (x) => ({
    ...x, verification: 'Verified', verifiedAmount: b.acceptedValue, verifiedBy: actor.name, verifiedAt: stamp(), debitNote,
    history: [...(x.history || []), event(actor, `Verified for ${fmt(b.acceptedValue)}${debitNote ? ` (debit note ${fmt(short)})` : ''}`, note?.trim() || 'PO, goods receipt and invoice agree')],
  }))
  next.procurementJournals = journal(state, {
    source: 'Purchase invoice', ref: inv.invoiceNo, createdBy: actor.name,
    narration: `Purchase: ${b.supplier} · ${inv.invoiceNo} · ${b.material} (${b.payableQty} ${b.unit} accepted)`,
    lines: [{ account: '1301', dr: b.acceptedValue }, { account: '2101', cr: b.acceptedValue }],
  })
  next.audit = withAudit(state, actor, id, 'Supplier invoice verified', `${fmt(b.acceptedValue)}${debitNote ? `; debit note ${fmt(short)}` : ''}`)
  return ok(next, `${id} verified for ${fmt(b.acceptedValue)}`)
}

export function queryInvoice(state, { id, note, returnToSupplier }, actor) {
  if (!allowed(actor, P.EXPENSE_VERIFY)) return fail('Only Accounts can query a supplier invoice.')
  const inv = state.supplierInvoices.find((x) => x.id === id)
  if (!inv) return fail('Invoice not found.')
  if (inv.verification !== 'Awaiting Verification') return fail(`${id} is ${inv.verification.toLowerCase()}.`)
  if (!note?.trim() || note.trim().length < 5) return fail('Describe the query for the supplier.')
  const status = returnToSupplier ? 'Returned to Supplier' : 'Query Raised'
  const next = invoiceUpdate(state, id, (x) => ({ ...x, verification: status, history: [...(x.history || []), event(actor, returnToSupplier ? 'Returned to supplier for a corrected invoice' : 'Query raised with supplier', note.trim())] }))
  next.audit = withAudit(state, actor, id, status, note.trim())
  return ok(next, `${id}: ${status.toLowerCase()} (nothing sent)`)
}

/** Simulated supplier reply: the invoice comes back for verification. */
export function supplierReplied(state, { id, note }, actor) {
  const inv = state.supplierInvoices.find((x) => x.id === id)
  if (!inv || !['Query Raised', 'Returned to Supplier'].includes(inv.verification)) return fail('No open query on this invoice.')
  const next = invoiceUpdate(state, id, (x) => ({ ...x, verification: 'Awaiting Verification', history: [...(x.history || []), event(actor, 'Supplier replied', note || '')] }))
  next.audit = withAudit(state, actor, id, 'Supplier replied (simulated)', note || '')
  return ok(next, `${id} back for verification`)
}

/** Ask Admin to release payment: verified value less advances and payments already made. */
export function requestPaymentApproval(state, { id, note }, actor) {
  if (!allowed(actor, P.SUPPLIER_SCHEDULE)) return fail('Payment requests are raised by Accounts.')
  const inv = state.supplierInvoices.find((x) => x.id === id)
  if (!inv) return fail('Invoice not found.')
  if (inv.verification !== 'Verified') return fail('Verify the invoice before requesting payment.')
  if (inv.request?.status === 'Pending') return fail(`Payment approval for ${id} is already pending with Admin.`)
  if (inv.request?.status === 'Approved') return fail(`Payment for ${id} is already approved.`)
  const b = supplierBill(state, inv)
  const due = b.verifiedAmount - b.paidAmount
  if (due <= 0) return fail(`${id} is fully paid.`)
  const advanceAdjust = Math.min(b.advanceAvailable, due)
  const net = due - advanceAdjust
  const request = { id: nextId(state.supplierInvoices.map((x) => x.request).filter(Boolean), 'SPR-'), amount: due, advanceAdjust, net, requestedBy: actor.name, at: stamp(), status: 'Pending', note: note?.trim() || '' }
  const next = invoiceUpdate(state, id, (x) => ({ ...x, request, history: [...(x.history || []), event(actor, `Payment approval requested: ${fmt(net)}${advanceAdjust ? ` (after advance ${fmt(advanceAdjust)})` : ''}`, request.note)] }))
  next.audit = withAudit(state, actor, id, 'Supplier payment approval requested', fmt(net))
  return ok(next, `Payment of ${fmt(net)} for ${id} sent to Admin for approval (nothing paid)`)
}

/** Admin releases (or rejects) the payment. Approval applies the advance adjustment. */
export function decidePaymentRelease(state, { id, approve, reason }, actor) {
  if (!allowed(actor, P.SUPPLIER_PAYMENT_RELEASE)) return fail('Supplier payments are released by Admin.')
  const inv = state.supplierInvoices.find((x) => x.id === id)
  if (!inv) return fail('Invoice not found.')
  if (inv.request?.status !== 'Pending') return fail(`No payment approval is pending for ${id}.`)
  if (inv.request.requestedBy === actor.name) return fail('You raised this payment request; another person must approve it.')
  if (!approve && (!reason?.trim() || reason.trim().length < 5)) return fail('Give the reason for rejecting.')
  const note = reason?.trim() || ''
  let next = invoiceUpdate(state, id, (x) => ({
    ...x, request: { ...x.request, status: approve ? 'Approved' : 'Rejected', decidedBy: actor.name, decidedAt: stamp(), reason: note },
    history: [...(x.history || []), event(actor, approve ? `Payment release approved (${fmt(x.request.net)})` : 'Payment release rejected', note)],
  }))
  if (approve && inv.request.advanceAdjust > 0) {
    let left = inv.request.advanceAdjust
    next = {
      ...next,
      supplierAdvances: next.supplierAdvances.map((a) => {
        if (a.poId !== inv.poId || left <= 0) return a
        const free = a.amount - sum(a.adjusted || [], 'amount')
        const take = Math.min(free, left)
        left -= take
        return take > 0 ? { ...a, adjusted: [...(a.adjusted || []), { invoiceId: id, amount: take, at: stamp(), by: actor.name }] } : a
      }),
    }
    next.procurementJournals = journal(state, {
      source: 'Advance adjustment', ref: inv.invoiceNo, createdBy: actor.name,
      narration: `Advance adjusted against ${inv.supplier} · ${inv.invoiceNo} (${inv.poId})`,
      lines: [{ account: '2101', dr: inv.request.advanceAdjust }, { account: '1203', cr: inv.request.advanceAdjust }],
    })
  }
  next.audit = withAudit(state, actor, id, approve ? 'Supplier payment release approved' : 'Supplier payment release rejected', note)
  return ok(next, `${id}: payment ${approve ? 'approved for release' : 'rejected'}`)
}

export const PAYMENT_MODES = ['NEFT', 'RTGS', 'Cheque']

/** Accounts records the bank payment of an approved release. Never more than approved; references are unique. */
export function recordSupplierPayment(state, { id, amount, date, mode, reference }, actor) {
  if (!allowed(actor, P.PAYMENT_RECORD)) return fail('Payments are recorded by the payment team (Accounts).')
  const inv = state.supplierInvoices.find((x) => x.id === id)
  if (!inv) return fail('Invoice not found.')
  if (inv.request?.status !== 'Approved') return fail('Payment has not been approved for release by Admin.')
  const b = supplierBill(state, inv)
  const n = Math.round(Number(amount))
  if (!(n > 0)) return fail('Enter the amount paid.')
  if (n > b.remainingApproved) return fail(b.remainingApproved ? `Only ${fmt(b.remainingApproved)} remains approved for ${id}.` : `${id} is already paid in full.`)
  if (!date || date > todayISO()) return fail('Enter the payment date (not in the future).')
  if (!PAYMENT_MODES.includes(mode)) return fail('Select the payment mode.')
  const ref = reference?.trim()
  if (!ref) return fail('Enter the bank reference (UTR / cheque no.).')
  if (state.supplierPayments.some((p) => p.reference.trim().toLowerCase() === ref.toLowerCase())) return fail(`Reference ${ref} is already used by another payment. Check for a duplicate payment.`)
  const pay = { id: nextId(state.supplierPayments.filter((p) => /^SP-\d+$/.test(p.id)), 'SP-'), invoiceId: id, poId: inv.poId, supplier: inv.supplier, projectId: inv.projectId, date, amount: n, mode, reference: ref, recordedBy: actor.name, approvedBy: inv.request.decidedBy, at: stamp(), demo: true }
  const next = {
    ...invoiceUpdate(state, id, (x) => ({ ...x, history: [...(x.history || []), event(actor, `Payment recorded: ${fmt(n)} by ${mode} ${ref}`)] })),
    supplierPayments: [...state.supplierPayments, pay],
  }
  next.procurementJournals = journal(state, {
    date, source: 'Payment', ref, createdBy: actor.name,
    narration: `Paid ${inv.supplier} · ${inv.invoiceNo} · ${mode} ${ref}`,
    lines: [{ account: '2101', dr: n }, { account: '1102', cr: n }],
  })
  next.audit = withAudit(state, actor, id, 'Supplier payment recorded', `${fmt(n)} · ${ref}`)
  return ok(next, `${fmt(n)} payment to ${inv.supplier} recorded against ${id} (demo, no money moved)`)
}

// ---------- Admin: everything waiting for an Admin decision, plus blocked / overdue items ----------
export function adminActionItems(state, today = todayISO()) {
  const items = []
  for (const po of state.purchaseOrders.filter((p) => p.approval === 'Pending Approval')) {
    const needs = poApproverRole(po.amount)
    const pr = po.requisitionId ? state.purchaseRequests.find((x) => x.id === po.requisitionId) : null
    items.push({ id: `po:${po.id}`, kind: 'Purchase order', ref: po.id, title: `${po.vendor}: ${po.sku ? `${po.qty} ${materialOf(po.sku)?.unit} ${materialOf(po.sku)?.name}` : po.item} for ${storeOf(po.storeId)?.name || po.projectId}${pr ? ` · ${pr.id}${pr.requestRef ? ` / ${pr.requestRef}` : ''}` : ''} · raised by ${po.raisedBy}`, amount: po.amount, at: po.history?.[po.history.length - 1]?.at || po.date, needs, actionable: needs === 'Admin', record: po })
  }
  for (const pr of state.purchaseRequests.filter((p) => p.status === 'Awaiting Admin Review')) {
    items.push({ id: `pr:${pr.id}`, kind: 'Purchase requisition', ref: pr.id, title: `${pr.qty} ${materialOf(pr.sku)?.unit} ${materialOf(pr.sku)?.name} for ${storeOf(pr.storeId)?.name}`, amount: pr.estimate ?? estimateOf(pr.sku, pr.qty), at: pr.at, needs: 'Admin', actionable: true, record: pr })
  }
  for (const a of state.adjustments.filter((x) => x.status === 'Pending Review')) {
    items.push({ id: `adj:${a.id}`, kind: a.kind === 'Damaged' ? 'Damaged stock' : 'Stock adjustment', ref: a.id, title: `${a.qty > 0 ? '+' : ''}${a.qty} ${materialOf(a.sku)?.unit} ${materialOf(a.sku)?.name} at ${storeOf(a.storeId)?.name}`, amount: rupees(Math.abs(a.qty) * (materialOf(a.sku)?.rate || 0)), at: a.at, needs: 'Admin', actionable: true, record: a })
  }
  for (const inv of state.supplierInvoices.filter((x) => x.request?.status === 'Pending')) {
    items.push({ id: `pay:${inv.id}`, kind: 'Supplier payment', ref: inv.id, title: `${inv.supplier} · ${inv.invoiceNo} (${inv.poId})`, amount: inv.request.net, at: inv.request.at, needs: 'Admin', actionable: true, record: inv })
  }
  for (const g of state.receipts.filter((x) => x.discrepancy && x.discrepancy !== 'Resolved')) {
    items.push({ id: `grn:${g.id}`, kind: 'Delivery discrepancy', ref: `${g.id} / ${g.po}`, title: `${g.supplier}: ordered ${g.ordered}, delivered ${g.delivered}${g.rejected ? `, ${g.rejected} rejected` : ''}`, amount: null, at: g.confirmedAt || g.at, needs: 'Admin / Purchase Manager', actionable: true, record: g })
  }
  // Watch list: overdue deliveries, invoices held with the supplier, rejected requests
  for (const po of state.purchaseOrders.filter((p) => p.sku && !p.receivedBeforeStockRecords && p.approval === 'Approved')) {
    const st = poReceiptStatus(state, po.id)
    if (st?.overdue) items.push({ id: `late:${po.id}`, kind: 'Overdue delivery', ref: po.id, title: `${po.vendor}: ${st.remaining} ${materialOf(po.sku)?.unit} not delivered (expected ${po.expected})`, amount: null, at: po.expected, needs: 'Purchase Manager', actionable: false, watch: true, record: po })
  }
  for (const inv of state.supplierInvoices.filter((x) => ['Query Raised', 'Returned to Supplier'].includes(x.verification))) {
    items.push({ id: `blk:${inv.id}`, kind: 'Blocked invoice', ref: inv.id, title: `${inv.supplier} · ${inv.invoiceNo}: ${inv.verification.toLowerCase()}`, amount: null, at: inv.history?.[inv.history.length - 1]?.at || inv.date, needs: 'Accounts', actionable: false, watch: true, record: inv })
  }
  // Material requests are decided by the Project Manager; Admin sees the queue but does not approve it
  for (const r of state.requests.filter((x) => [MR.SUBMITTED, MR.PM_REVIEW].includes(x.status))) {
    items.push({ id: `mr:${r.id}`, kind: 'Material request', ref: r.id, title: `${r.requested} ${materialOf(r.sku)?.unit} ${materialOf(r.sku)?.name} for ${siteOf(r.siteId)?.name} (${r.requestedBy}): ${r.status}`, amount: estimateOf(r.sku, r.requested), at: r.at, needs: r.status === MR.SUBMITTED ? 'Store Keeper (stock check)' : PROJECT_MANAGERS[siteOf(r.siteId)?.projectId] ? `Project Manager (${PROJECT_MANAGERS[siteOf(r.siteId)?.projectId]})` : 'Project Manager', actionable: false, watch: true, record: r })
  }
  for (const r of state.requests.filter((x) => x.status === 'Rejected' && (x.at || '').slice(0, 10) >= addDays(today, -7))) {
    items.push({ id: `rej:${r.id}`, kind: 'Rejected request', ref: r.id, title: `${materialOf(r.sku)?.name} for ${siteOf(r.siteId)?.name}: ${r.reason || 'no reason given'}`, amount: null, at: r.at, needs: '-', actionable: false, watch: true, record: r })
  }
  return items.sort((a, b) => (a.watch === b.watch ? (b.at || '').localeCompare(a.at || '') : a.watch ? 1 : -1))
}

/** Initial receipts are exported for the Accountant's static books (built before any session change). */
export const initialReceipts = () => RECEIPTS

// =====================================================================================
// Purchase Manager workflow: requisition review → quotations → comparison → supplier
// selection → PO (draft → submit → Admin approval when above the limit → send) → delivery
// follow-up. Receiving and stock stay with the Store Keeper; bills and payments with Accounts.
// =====================================================================================

const isPurchaser = (actor) => actor?.role === 'Purchase Manager' || allowed(actor, P.PROCUREMENT_MANAGE)
const prUpdate = (state, id, fn) => ({ ...state, purchaseRequests: updateIn(state.purchaseRequests, id, fn) })
const poUpdate = (state, id, fn) => ({ ...state, purchaseOrders: updateIn(state.purchaseOrders, id, fn) })
const supplierNamed = (state, name) => (state.suppliers || []).find((s) => s.name === name)

/** Landed cost of a quotation for a quantity: goods + GST + transport. */
export function quoteCost(q, qty) {
  const goods = rupees(qty * Number(q.rate))
  const gst = rupees(goods * (Number(q.gstRate) || 0) / 100)
  const transport = rupees(q.transport)
  return { goods, gst, transport, total: goods + gst + transport }
}

/** Quotations of a requisition with landed cost and best-in-class flags, for comparison. */
export function compareQuotes(pr) {
  const rows = (pr.quotes || []).map((q) => ({ ...q, ...quoteCost(q, pr.qty) }))
  if (!rows.length) return rows
  const minTotal = Math.min(...rows.map((r) => r.total))
  const minDays = Math.min(...rows.map((r) => r.deliveryDays))
  const maxQuality = Math.max(...rows.map((r) => r.quality || 0))
  return rows.map((r) => ({ ...r, lowest: r.total === minTotal, fastest: r.deliveryDays === minDays, bestQuality: r.quality === maxQuality, overLowest: r.total - minTotal, chosen: r.id === pr.chosenId }))
}

export const PR_STATUSES = ['Awaiting Admin Review', 'Sent to Purchase Manager', 'Quotations Requested', 'Supplier Selected', 'PO Raised', 'Returned to Store Keeper', 'Rejected by Purchase Manager', 'Rejected by Admin']
/** Quotations received from at least two suppliers and not yet compared / decided. */
export const awaitingComparison = (pr) => pr.status === 'Quotations Requested' && (pr.quotes || []).length >= 2

/** Purchase Manager rejects, or returns to the Store Keeper for clarification. */
export function returnRequisition(state, { id, reason, reject }, actor) {
  const pr = state.purchaseRequests.find((x) => x.id === id)
  if (!pr) return fail('Requisition not found.')
  if (!isPurchaser(actor)) return fail('Only the Purchase Manager can reject or return a requisition.')
  if (!['Sent to Purchase Manager', 'Quotations Requested', 'Supplier Selected'].includes(pr.status)) return fail(`${id} is ${pr.status.toLowerCase()}; it cannot be ${reject ? 'rejected' : 'returned'} now.`)
  if (!reason?.trim() || reason.trim().length < 5) return fail(`Give the reason for ${reject ? 'rejecting' : 'returning'} (the Store Keeper sees it).`)
  const status = reject ? 'Rejected by Purchase Manager' : 'Returned to Store Keeper'
  const next = prUpdate(state, id, (x) => ({ ...x, status, returnReason: reason.trim(), note: reason.trim(), history: [...(x.history || []), event(actor, status, reason.trim())] }))
  next.audit = withAudit(state, actor, id, status, reason.trim())
  return ok(next, `${id} ${reject ? 'rejected' : 'returned to the Store Keeper'}`)
}

/** Ask suppliers for quotations (demo: nothing is sent). Can add more suppliers later. */
export function requestQuotations(state, { id, vendors }, actor) {
  const pr = state.purchaseRequests.find((x) => x.id === id)
  if (!pr) return fail('Requisition not found.')
  if (!isPurchaser(actor)) return fail('Quotations are requested by the Purchase Manager.')
  if (!['Sent to Purchase Manager', 'Quotations Requested'].includes(pr.status)) return fail(`${id} is ${pr.status.toLowerCase()}; quotations cannot be requested now.`)
  const already = pr.quotesRequestedFrom || []
  const fresh = [...new Set((vendors || []).filter((v) => v && !already.includes(v)))]
  if (!fresh.length) return fail('Select at least one supplier not already asked.')
  const blocked = fresh.filter((v) => supplierNamed(state, v)?.status === 'Blocked')
  if (blocked.length) return fail(`${blocked.join(', ')} is blocked and cannot be asked for quotations.`)
  const next = prUpdate(state, id, (x) => ({
    ...x, status: 'Quotations Requested', quotesRequestedFrom: [...already, ...fresh], quotesRequestedAt: x.quotesRequestedAt || stamp(), quotes: x.quotes || [],
    history: [...(x.history || []), event(actor, `Quotations requested from ${fresh.join(', ')}`, 'Demo: no message sent')],
  }))
  next.audit = withAudit(state, actor, id, 'Quotations requested', fresh.join(', '))
  return ok(next, `Quotation request recorded for ${fresh.length} supplier${fresh.length > 1 ? 's' : ''} (demo: nothing sent)`)
}

export function validateQuote(qt, unitDecimals = true) {
  if (!qt.vendor) return 'Select the supplier.'
  if (!(Number(qt.rate) > 0)) return 'Enter the quoted rate per unit (more than 0).'
  const g = Number(qt.gstRate)
  if (qt.gstRate === '' || Number.isNaN(g) || g < 0 || g > 28) return 'GST must be between 0 and 28%.'
  if (qt.transport !== '' && (Number.isNaN(Number(qt.transport)) || Number(qt.transport) < 0)) return 'Transport charges cannot be negative.'
  const d = Number(qt.deliveryDays)
  if (qt.deliveryDays === '' || !Number.isInteger(d) || d < 0) return 'Enter delivery time in whole days.'
  if (!qt.paymentTerms?.trim()) return 'Enter the payment terms quoted.'
  const ql = Number(qt.quality)
  if (!(ql >= 1 && ql <= 5)) return 'Rate quality from 1 to 5.'
  return unitDecimals ? '' : ''
}

/** Record one supplier's quotation against a requisition. */
export function recordQuote(state, { id, quote }, actor) {
  const pr = state.purchaseRequests.find((x) => x.id === id)
  if (!pr) return fail('Requisition not found.')
  if (!isPurchaser(actor)) return fail('Quotations are recorded by the Purchase Manager.')
  if (pr.status !== 'Quotations Requested') return fail(`${id} is ${pr.status.toLowerCase()}; request quotations first.`)
  const e = validateQuote(quote)
  if (e) return fail(e)
  if ((pr.quotes || []).some((q) => q.vendor === quote.vendor)) return fail(`A quotation from ${quote.vendor} is already recorded on ${id}.`)
  if (supplierNamed(state, quote.vendor)?.status === 'Blocked') return fail(`${quote.vendor} is blocked.`)
  const allQuotes = state.purchaseRequests.flatMap((x) => x.quotes || [])
  const qt = {
    id: nextId(allQuotes, 'QT-'), vendor: quote.vendor, rate: Number(quote.rate), gstRate: Number(quote.gstRate), transport: rupees(quote.transport),
    deliveryDays: Number(quote.deliveryDays), paymentTerms: quote.paymentTerms.trim(), quality: Number(quote.quality), note: quote.note?.trim() || '',
    ref: quote.ref?.trim() || '', receivedAt: stamp(), recordedBy: actor.name, demo: true,
  }
  const next = prUpdate(state, id, (x) => ({
    ...x, quotes: [...(x.quotes || []), qt],
    quotesRequestedFrom: (x.quotesRequestedFrom || []).includes(qt.vendor) ? x.quotesRequestedFrom : [...(x.quotesRequestedFrom || []), qt.vendor],
    history: [...(x.history || []), event(actor, `Quotation ${qt.id} recorded (${qt.vendor})`, `₹${qt.rate}/unit + ${qt.gstRate}% GST, transport ${fmt(qt.transport)}, ${qt.deliveryDays} days`)],
  }))
  next.audit = withAudit(state, actor, id, 'Quotation recorded', `${qt.id} · ${qt.vendor}`)
  return ok(next, `${qt.id} from ${qt.vendor} recorded`)
}

/**
 * Choose the supplier after comparing. Price is not the only factor, but choosing anything
 * other than the lowest landed cost needs a written reason, kept with the comparison.
 */
export function selectSupplier(state, { id, quoteId, reason }, actor) {
  const pr = state.purchaseRequests.find((x) => x.id === id)
  if (!pr) return fail('Requisition not found.')
  if (!isPurchaser(actor)) return fail('The supplier is selected by the Purchase Manager.')
  if (pr.status !== 'Quotations Requested') return fail(`${id} is ${pr.status.toLowerCase()}.`)
  const rows = compareQuotes(pr)
  if (rows.length < 2) return fail('Compare at least two quotations before selecting a supplier.')
  const q = rows.find((r) => r.id === quoteId)
  if (!q) return fail('Choose one of the recorded quotations.')
  const sup = supplierNamed(state, q.vendor)
  if (sup?.status === 'Blocked') return fail(`${q.vendor} is blocked and cannot be selected.`)
  const why = reason?.trim() || ''
  if (!q.lowest && why.length < 10) return fail(`${q.vendor} is ${fmt(q.overLowest)} above the lowest landed cost. Explain why it is preferred (delivery, quality, terms…).`)
  if (sup?.status === 'On Hold' && why.length < 10) return fail(`${q.vendor} is on hold. Give the reason for selecting it anyway.`)
  const next = prUpdate(state, id, (x) => ({
    ...x, status: 'Supplier Selected', chosenId: q.id, selectionReason: why || 'Lowest landed cost', selectedBy: actor.name, selectedAt: stamp(),
    history: [...(x.history || []), event(actor, `${q.vendor} selected (${fmt(q.total)} landed)`, why || 'Lowest landed cost')],
  }))
  next.audit = withAudit(state, actor, id, 'Supplier selected', `${q.vendor} · ${fmt(q.total)}`)
  return ok(next, `${q.vendor} selected on ${id}`)
}

/** PO totals: goods value (the approval basis), GST, transport, grand total and advance. */
export function poTotals(po) {
  const goods = rupees(po.amount)
  const gst = rupees(goods * (po.gstRate || 0) / 100)
  const transport = rupees(po.transport)
  const total = goods + gst + transport
  return { goods, gst, transport, total, advance: rupees(total * (po.advancePct || 0) / 100) }
}

export const PO_STATUSES = ['Draft', 'Pending Approval', 'Approved', 'Sent to Supplier', 'Partially Delivered', 'Completed', 'Cancelled', 'Rejected']

/** One status for lists: approval + sending + delivery (deliveries come from the Store Keeper's GRNs). */
export function poStatusOf(state, po) {
  if (po.approval !== 'Approved') return po.approval
  if (!po.sentAt) return 'Approved'
  if (!po.sku || po.receivedBeforeStockRecords) return 'Completed'
  const st = poReceiptStatus(state, po.id)
  if (!st || st.delivered <= 0) return 'Sent to Supplier'
  return st.remaining > 0 ? 'Partially Delivered' : 'Completed'
}

/** Everything the Purchase Manager needs about a PO in one row. */
export function poView(state, po, today = todayISO()) {
  const m = po.sku ? materialOf(po.sku) : null
  const st = po.sku && !po.receivedBeforeStockRecords ? poReceiptStatus(state, po.id) : null
  const status = poStatusOf(state, po)
  const invoices = state.supplierInvoices.filter((x) => x.poId === po.id)
  const advances = state.supplierAdvances.filter((a) => a.poId === po.id)
  const open = ['Sent to Supplier', 'Partially Delivered'].includes(status)
  const delayDays = open && po.expected < today ? Math.round((new Date(today) - new Date(po.expected)) / 86400000) : 0
  return {
    ...po, material: m, unit: m?.unit || '', status, ...poTotals(po), receipt: st,
    delivered: st ? st.delivered : status === 'Completed' ? po.qty : 0, accepted: st ? st.accepted : status === 'Completed' ? po.qty : 0,
    rejected: st?.rejected || 0, pending: st ? st.remaining : 0, pendingInspection: st?.pendingInspection || 0, grns: st?.grns || [],
    open, delayed: delayDays > 0, delayDays, invoices, advances, advancePaid: sum(advances, 'amount'),
    store: po.storeId ? storeOf(po.storeId) : null, needs: poApproverRole(po.amount),
  }
}

export function validatePODraft(f) {
  if (!f.expected) return 'Enter the expected delivery date.'
  if (f.expected < todayISO()) return 'Expected delivery cannot be in the past.'
  if (!f.storeId) return 'Select the delivery location (store).'
  if (f.transport !== '' && f.transport != null && (Number.isNaN(Number(f.transport)) || Number(f.transport) < 0)) return 'Transport charges cannot be negative.'
  const a = Number(f.advancePct || 0)
  if (Number.isNaN(a) || a < 0 || a > 100) return 'Advance must be between 0 and 100%.'
  if (!f.paymentTerms?.trim()) return 'Enter the payment terms.'
  return ''
}

/** Create a DRAFT PO from a requisition whose supplier has been selected. */
export function raisePurchaseOrder(state, f, actor) {
  const pr = state.purchaseRequests.find((x) => x.id === f.id)
  if (!pr) return fail('Requisition not found.')
  if (!isPurchaser(actor)) return fail('Purchase orders are created by the Purchase Manager.')
  if (pr.status !== 'Supplier Selected') return fail(pr.poId ? `${pr.poId} has already been created for ${pr.id}.` : `${pr.id} has no selected supplier yet.`)
  const q = (pr.quotes || []).find((x) => x.id === pr.chosenId)
  const form = { storeId: pr.storeId, transport: q.transport, paymentTerms: q.paymentTerms, advancePct: 0, ...f }
  const e = validatePODraft(form)
  if (e) return fail(e)
  const poId = nextId(state.purchaseOrders, 'PO-')
  const store = storeOf(form.storeId)
  const po = {
    id: poId, vendor: q.vendor, sku: pr.sku, qty: pr.qty, rate: q.rate, amount: rupees(pr.qty * q.rate), storeId: form.storeId, projectId: store?.projectId || 'P-101',
    gstRate: q.gstRate, transport: rupees(form.transport), advancePct: Number(form.advancePct || 0), paymentTerms: form.paymentTerms.trim(), note: form.note?.trim() || '',
    date: todayISO(), expected: form.expected, originalExpected: form.expected, approval: 'Draft', raisedBy: actor.name, requisitionId: pr.id, requestRef: pr.requestRef,
    quoteId: q.id, approvedBy: null, approvedAt: null, sentAt: null, sentBy: null, followUps: [], demo: true,
    history: [event(actor, 'PO drafted', `From ${pr.id} / ${q.id}`)],
  }
  const next = {
    ...state,
    purchaseOrders: [po, ...state.purchaseOrders],
    purchaseRequests: updateIn(state.purchaseRequests, pr.id, (x) => ({ ...x, status: 'PO Raised', poId, history: [...(x.history || []), event(actor, `${poId} drafted`, `${q.vendor}, ${fmt(po.amount)}`)] })),
  }
  next.audit = withAudit(state, actor, poId, 'Purchase order drafted', `${pr.id} · ${fmt(po.amount)}`)
  return ok(next, `${poId} created as a draft`)
}

/** Edit a draft PO's terms (only while it is a draft). */
export function updatePODraft(state, f, actor) {
  const po = state.purchaseOrders.find((x) => x.id === f.id)
  if (!po) return fail('Purchase order not found.')
  if (!isPurchaser(actor)) return fail('Only the Purchase Manager edits purchase orders.')
  if (po.approval !== 'Draft') return fail(`${po.id} is ${po.approval.toLowerCase()}; only drafts can be edited.`)
  const e = validatePODraft({ ...po, ...f })
  if (e) return fail(e)
  const next = poUpdate(state, po.id, (x) => ({
    ...x, expected: f.expected, originalExpected: f.expected, storeId: f.storeId, projectId: storeOf(f.storeId)?.projectId || x.projectId,
    transport: rupees(f.transport), advancePct: Number(f.advancePct || 0), paymentTerms: f.paymentTerms.trim(), note: f.note?.trim() ?? x.note,
    history: [...(x.history || []), event(actor, 'Draft edited')],
  }))
  next.audit = withAudit(state, actor, po.id, 'Draft purchase order edited')
  return ok(next, `${po.id} updated`)
}

/**
 * Submit a draft. Within the Purchase Manager's approval limit it is approved on submission
 * (company policy needs no second approval); above the limit it waits for Admin.
 */
export function submitPurchaseOrder(state, { id }, actor) {
  const po = state.purchaseOrders.find((x) => x.id === id)
  if (!po) return fail('Purchase order not found.')
  if (!isPurchaser(actor)) return fail('Purchase orders are submitted by the Purchase Manager.')
  if (po.approval !== 'Draft') return fail(`${id} is already ${po.approval.toLowerCase()}.`)
  const e = validatePODraft(po)
  if (e) return fail(`${id}: ${e}`)
  const needsAdmin = poApproverRole(po.amount) === 'Admin'
  const next = poUpdate(state, id, (x) => (needsAdmin
    ? { ...x, approval: 'Pending Approval', submittedAt: stamp(), history: [...(x.history || []), event(actor, x.returnNote ? 'Corrected and resubmitted for Admin approval' : 'Submitted for Admin approval', `${fmt(x.amount)} is above the ${fmt(PO_PM_APPROVAL_LIMIT)} limit`, ['Draft', 'Pending Approval'])] }
    : { ...x, approval: 'Approved', approvedBy: actor.name, approvedAt: stamp(), submittedAt: stamp(), history: [...(x.history || []), event(actor, 'Approved within Purchase Manager limit', `${fmt(x.amount)} ≤ ${fmt(PO_PM_APPROVAL_LIMIT)}; no Admin approval needed`, ['Draft', 'Approved'])] }))
  next.audit = withAudit(state, actor, id, needsAdmin ? 'Purchase order submitted for approval' : 'Purchase order approved (within limit)', fmt(po.amount))
  return ok(next, needsAdmin ? `${id} sent to Admin for approval` : `${id} approved within your limit. Send it to the supplier when ready`)
}

/** Record that the approved PO was sent to the supplier (demo: nothing is sent). */
export function sendPurchaseOrder(state, { id }, actor) {
  const po = state.purchaseOrders.find((x) => x.id === id)
  if (!po) return fail('Purchase order not found.')
  if (!isPurchaser(actor)) return fail('Purchase orders are sent by the Purchase Manager.')
  if (po.approval !== 'Approved') return fail(`${id} is ${po.approval.toLowerCase()}. Only an approved PO can be sent to the supplier.`)
  if (po.sentAt) return fail(`${id} was already sent on ${po.sentAt.slice(0, 10)}.`)
  const next = poUpdate(state, id, (x) => ({ ...x, sentAt: stamp(), sentBy: actor.name, history: [...(x.history || []), event(actor, 'Sent to supplier', 'Demo: no email or message sent')] }))
  next.audit = withAudit(state, actor, id, 'Purchase order sent to supplier')
  return ok(next, `${id} marked as sent to ${po.vendor} (demo: nothing sent). The store can now receive against it`)
}

/** Cancel a PO that has no deliveries. The requisition goes back to "Supplier Selected". */
export function cancelPurchaseOrder(state, { id, reason }, actor) {
  const po = state.purchaseOrders.find((x) => x.id === id)
  if (!po) return fail('Purchase order not found.')
  if (!isPurchaser(actor)) return fail('Purchase orders are cancelled by the Purchase Manager.')
  if (!['Draft', 'Pending Approval', 'Approved'].includes(po.approval)) return fail(`${id} is ${po.approval.toLowerCase()}.`)
  if (state.receipts.some((g) => g.po === id)) return fail(`${id} already has deliveries recorded by the store; it cannot be cancelled.`)
  if (state.supplierInvoices.some((x) => x.poId === id) || state.supplierAdvances.some((a) => a.poId === id)) return fail(`${id} has an invoice or advance; ask Accounts before cancelling.`)
  if (!reason?.trim() || reason.trim().length < 5) return fail('Give the reason for cancelling.')
  let next = poUpdate(state, id, (x) => ({ ...x, approval: 'Cancelled', cancelledBy: actor.name, cancelledAt: stamp(), cancelReason: reason.trim(), history: [...(x.history || []), event(actor, 'Cancelled', reason.trim())] }))
  if (po.requisitionId) {
    next = prUpdate(next, po.requisitionId, (x) => (x.poId === id ? { ...x, status: 'Supplier Selected', poId: null, history: [...(x.history || []), event(actor, `${id} cancelled; requisition reopened`, reason.trim())] } : x))
  }
  next.audit = withAudit(state, actor, id, 'Purchase order cancelled', reason.trim())
  return ok(next, `${id} cancelled`)
}

/** Delivery follow-up note, optionally with a revised expected date (the original is kept). */
export function addFollowUp(state, { id, note, revisedExpected }, actor) {
  const po = state.purchaseOrders.find((x) => x.id === id)
  if (!po) return fail('Purchase order not found.')
  if (!isPurchaser(actor)) return fail('Delivery follow-up is done by the Purchase Manager.')
  if (po.approval !== 'Approved' || !po.sentAt) return fail(`${id} has not been sent to the supplier yet.`)
  if (!note?.trim() || note.trim().length < 5) return fail('Write the follow-up note.')
  if (revisedExpected && revisedExpected < todayISO()) return fail('A revised delivery date cannot be in the past.')
  const next = poUpdate(state, id, (x) => ({
    ...x, expected: revisedExpected || x.expected, originalExpected: x.originalExpected || x.expected,
    followUps: [...(x.followUps || []), { at: stamp(), by: actor.name, note: note.trim(), revisedExpected: revisedExpected || null }],
    history: [...(x.history || []), event(actor, revisedExpected ? `Follow-up: delivery revised to ${revisedExpected}` : 'Follow-up recorded', note.trim())],
  }))
  next.audit = withAudit(state, actor, id, 'Delivery follow-up', note.trim())
  return ok(next, `Follow-up recorded on ${id}`)
}

// ---------- Suppliers ----------
export function validateSupplier(f, suppliers, originalId = null) {
  const e = {}
  const others = suppliers.filter((s) => s.id !== originalId)
  if (!f.name?.trim()) e.name = 'Supplier name is required.'
  else if (others.some((s) => s.name.trim().toLowerCase() === f.name.trim().toLowerCase())) e.name = 'A supplier with this name already exists.'
  if (!f.contact?.trim()) e.contact = 'Contact person is required.'
  if (!f.phone?.trim() && !f.email?.trim()) e.phone = 'Give a phone number or email.'
  if (f.email?.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email.trim())) e.email = 'Enter a valid email address.'
  const d = Number(f.creditDays)
  if (f.creditDays === '' || !Number.isInteger(d) || d < 0) e.creditDays = 'Credit days must be a whole number (0 or more).'
  if (!f.paymentTerms?.trim()) e.paymentTerms = 'Payment terms are required.'
  if (!['Active', 'On Hold', 'Blocked'].includes(f.status)) e.status = 'Select a status.'
  if ((f.status === 'On Hold' || f.status === 'Blocked') && !f.notes?.trim()) e.notes = 'Give the reason for the hold / block.'
  return e
}

/** Supplier name is locked once purchase orders or quotations use it. */
export const supplierInUse = (state, name) => state.purchaseOrders.some((p) => p.vendor === name) || state.purchaseRequests.some((r) => (r.quotes || []).some((q) => q.vendor === name) || (r.quotesRequestedFrom || []).includes(name))

const supplierFields = (f) => ({
  name: f.name.trim(), contact: f.contact.trim(), phone: f.phone?.trim() || '', email: f.email?.trim() || '', address: f.address?.trim() || '', gstin: f.gstin?.trim() || '',
  skus: f.skus || [], creditDays: Number(f.creditDays), paymentTerms: f.paymentTerms.trim(), status: f.status, quality: Number(f.quality) || 3, notes: f.notes?.trim() || '',
})

export function addSupplier(state, f, actor) {
  if (!allowed(actor, P.SUPPLIER_MANAGE)) return fail('Suppliers are added by the Purchase Manager.')
  const e = validateSupplier(f, state.suppliers)
  if (Object.keys(e).length) return fail(Object.values(e)[0])
  const sup = { id: nextId(state.suppliers, 'SUP-').replace(/SUP-(\d+)$/, (_, n) => `SUP-${n.padStart(3, '0')}`), ...supplierFields(f), since: todayISO().slice(0, 4), addedBy: actor.name, addedAt: stamp(), demo: true, history: [event(actor, 'Supplier added')] }
  return ok({ ...state, suppliers: [...state.suppliers, sup], audit: withAudit(state, actor, sup.id, 'Supplier added', sup.name) }, `${sup.name} added (demo, resets on reload)`)
}

export function updateSupplier(state, f, actor) {
  if (!allowed(actor, P.SUPPLIER_MANAGE)) return fail('Suppliers are edited by the Purchase Manager.')
  const cur = state.suppliers.find((s) => s.id === f.id)
  if (!cur) return fail('Supplier not found.')
  const e = validateSupplier(f, state.suppliers, f.id)
  if (Object.keys(e).length) return fail(Object.values(e)[0])
  if (f.name.trim() !== cur.name && supplierInUse(state, cur.name)) return fail(`The name of ${cur.name} cannot change: purchase orders and quotations refer to it.`)
  const fields = supplierFields(f)
  const changes = Object.keys(fields).filter((k) => JSON.stringify(fields[k]) !== JSON.stringify(cur[k] ?? (k === 'skus' ? [] : '')))
  if (!changes.length) return fail('Nothing changed.')
  const next = { ...state, suppliers: updateIn(state.suppliers, f.id, (x) => ({ ...x, ...fields, editedBy: actor.name, editedAt: stamp(), history: [...(x.history || []), event(actor, `Edited: ${changes.join(', ')}`, cur.status !== fields.status ? `Status ${cur.status} → ${fields.status}` : '')] })) }
  next.audit = withAudit(state, actor, f.id, 'Supplier edited', changes.join(', '))
  return ok(next, `${fields.name} updated (demo, resets on reload)`)
}

/** Delivery performance and price history for a supplier, from POs, GRNs and quotations. */
export function supplierStats(state, name, today = todayISO()) {
  const pos = state.purchaseOrders.filter((p) => p.vendor === name && !['Cancelled', 'Rejected'].includes(p.approval))
  const materialPOs = pos.filter((p) => p.sku && !p.receivedBeforeStockRecords && p.approval === 'Approved')
  let onTime = 0, late = 0, delaySum = 0, delivered = 0, rejected = 0
  for (const p of materialPOs) {
    const grns = state.receipts.filter((g) => g.po === p.id).sort((a, b) => a.deliveryDate.localeCompare(b.deliveryDate))
    delivered += sum(grns, 'delivered')
    rejected += sum(grns, (g) => g.rejected || 0)
    const due = p.originalExpected || p.expected
    if (grns.length) {
      const d = Math.round((new Date(grns[0].deliveryDate) - new Date(due)) / 86400000)
      if (d <= 0) onTime++; else { late++; delaySum += d }
    } else if (due < today) {
      late++; delaySum += Math.round((new Date(today) - new Date(due)) / 86400000)
    }
  }
  const scored = onTime + late
  const prices = [
    ...pos.filter((p) => p.sku).map((p) => ({ date: p.date, sku: p.sku, rate: p.rate, source: p.id, kind: 'PO' })),
    ...state.purchaseRequests.flatMap((r) => (r.quotes || []).filter((q) => q.vendor === name).map((q) => ({ date: q.receivedAt.slice(0, 10), sku: r.sku, rate: q.rate, source: `${q.id} (${r.id})`, kind: q.id === r.chosenId ? 'Quote (selected)' : 'Quote' }))),
  ].sort((a, b) => b.date.localeCompare(a.date))
  return {
    orders: pos.length, value: sum(pos, (p) => p.amount), openOrders: pos.filter((p) => ['Sent to Supplier', 'Partially Delivered', 'Approved'].includes(poStatusOf(state, p))).length,
    onTime, late, onTimePct: scored ? Math.round((onTime / scored) * 100) : null, avgDelay: late ? Math.round(delaySum / late) : 0,
    rejectionPct: delivered ? Math.round((rejected / delivered) * 1000) / 10 : null, prices,
  }
}
