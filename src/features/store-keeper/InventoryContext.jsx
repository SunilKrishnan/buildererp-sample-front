import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react'
import { initialInventoryState, recordInventoryAction } from '../../services/inventoryService.js'
import {
  buildAlerts, buildSummary, computeStock, deriveMovements, ISSUABLE_REQUEST_STATUSES, materialOf, materialUsage, nextId, normalizeCode, nowStamp, poLines, poReceiptStatus,
  receiptDiscrepancies, requestRows, round2, setCatalog, validateIssue, validateReceipt,
} from '../../services/inventory.js'
import * as W from '../../services/procurement.js'

/** New stock record. Opening stock is labelled as such, with its source; it is not a goods receipt. */
function makeLine(sku, l, user) {
  const opening = round2(l.opening || 0)
  return {
    sku, storeId: l.storeId, opening, reorder: round2(l.reorder), location: l.location.trim(), openingAt: nowStamp(), demo: true,
    ...(opening > 0 && {
      openingBy: user.name,
      openingSource: 'Material setup (opening stock)',
      openingNote: `Opening stock entered by ${user.name} when the stock record was created. Not a goods receipt. Demo: not saved`,
    }),
  }
}

/**
 * Inventory state for this browser session (DEMO: never saved, resets on reload).
 * Lives at app level so the Store Keeper Dashboard, Materials page, Purchase Orders page,
 * Admin Dashboard and Accountant pages all read the same records (one PO register, one set
 * of goods receipts, invoices and payments). Stock itself is never stored: it is recalculated
 * from the confirmed transactions on every change (services/inventory.js).
 *
 * Changes are committed synchronously against the latest state (stateRef), and every action
 * checks the record's current status first, so a repeated click cannot record anything twice.
 */
const InventoryContext = createContext(null)

export function InventoryProvider({ children }) {
  const [state, setState] = useState(initialInventoryState)
  const stateRef = useRef(state)

  /** Apply a change to the latest state now (not on the next render). Returning the same state = no change. */
  const commit = useCallback((updater) => {
    const next = updater(stateRef.current)
    if (next === stateRef.current) return false
    stateRef.current = next
    setState(next)
    return true
  }, [])
  const patch = useCallback((key, fn, action, payload) => {
    recordInventoryAction(action, payload)
    return commit((s) => {
      const value = fn(s[key], s)
      return value === s[key] ? s : { ...s, [key]: value }
    })
  }, [commit])
  /** Run a guarded workflow transition (services/procurement.js). Returns { ok, message } or { ok: false, error }. */
  const run = useCallback((fn, args, actor) => {
    const r = fn(stateRef.current, args, actor)
    if (r.error) return { ok: false, error: r.error }
    recordInventoryAction(fn.name, args)
    commit(() => r.state)
    return { ok: true, message: r.message }
  }, [commit])

  const actions = useMemo(() => {
    // Only touch a record still in the expected status; otherwise leave the list unchanged
    const guarded = (list, id, when, fn) => (list.some((x) => x.id === id && when(x)) ? list.map((x) => (x.id === id ? fn(x) : x)) : list)
    const audit = (ref, user, action, note = '') => commit((s) => ({ ...s, audit: [{ id: `AUD-${s.audit.length + 1}`, ref, at: nowStamp(), by: user.name, role: user.role || '', action, note }, ...s.audit] }))
    return {
    /** Record a delivery against a PO. Stock changes only if inspected = true. */
    recordReceipt: (f, user) => {
      recordInventoryAction('receipt.record', f)
      return commit((s) => {
        if (validateReceipt(f, s)) return s // e.g. the same delivery note recorded twice
        const line = poLines(s).find((l) => l.po === f.po)
        const st = poReceiptStatus(s, f.po)
        const inspected = !!f.inspected
        const g = {
          id: nextId(s.receipts, 'GRN-'), po: f.po, sku: line.sku, storeId: f.storeId || line.storeId, supplier: line.vendor,
          deliveryDate: f.deliveryDate, ordered: st.remaining, delivered: round2(f.delivered),
          accepted: inspected ? round2(f.accepted) : null, rejected: inspected ? round2(f.rejected || 0) : null,
          deliveryNote: f.deliveryNote.trim(), invoiceRef: f.invoiceRef?.trim() || '', location: f.location.trim(),
          receivedBy: f.receivedBy.trim(), inspectedBy: inspected ? user.name : null,
          status: inspected ? 'Accepted' : 'Pending Inspection', rejectionReason: f.rejectionReason?.trim() || '',
          docs: (f.docs || '').split(',').map((d) => d.trim()).filter(Boolean), notes: f.notes?.trim() || '',
          at: nowStamp(), confirmedAt: inspected ? nowStamp() : null, demo: true,
        }
        g.discrepancy = round2(g.delivered) !== round2(g.ordered) || g.rejected > 0 ? 'Open' : null
        g.discrepancyNote = ''
        return { ...s, receipts: [...s.receipts, g] }
      })
    },
    inspectReceipt: (id, { accepted, rejected, reason }, user) => patch('receipts', (list) => guarded(list, id, (g) => g.status === 'Pending Inspection', (g) => {
      const next = { ...g, accepted: round2(accepted), rejected: round2(rejected || 0), rejectionReason: reason?.trim() || '', inspectedBy: user.name, status: 'Accepted', confirmedAt: nowStamp() }
      next.discrepancy = receiptDiscrepancies(next).length ? 'Open' : null
      return next
    }), 'receipt.inspect', { id }),
    reportDiscrepancy: (id, note, user) => patch('receipts', (list) => guarded(list, id, (g) => g.discrepancy === 'Open', (g) => ({ ...g, discrepancy: 'Reported', discrepancyNote: `${note} (reported by ${user.name}; demo, nothing sent)` })), 'receipt.reportDiscrepancy', { id }),
    resolveDiscrepancy: (id, note, user) => {
      const done = patch('receipts', (list) => guarded(list, id, (g) => g.discrepancy && g.discrepancy !== 'Resolved', (g) => ({ ...g, discrepancy: 'Resolved', discrepancyNote: `${note} (reviewed by ${user.name})`, resolvedBy: user.name, resolvedAt: nowStamp() })), 'receipt.resolveDiscrepancy', { id })
      if (done) audit(id, user, 'Delivery discrepancy reviewed', note)
      return done
    },

    // ----- Workflow transitions (guarded; services/procurement.js). Each returns { ok, message } or { ok: false, error } -----
    /** Site Engineer: save a draft or submit (also edits a Draft / Returned request) */
    submitRequest: (f, actor) => run(W.submitMaterialRequest, f, actor),
    cancelRequest: (args, actor) => run(W.cancelMaterialRequest, args, actor),
    /** Store Keeper: record usable stock and send to the Project Manager, whatever the stock */
    checkRequest: (id, note, actor) => run(W.checkRequest, { id, note }, actor),
    /** Project Manager: approve / return for clarification / reject */
    decideRequest: (args, actor) => run(W.decideRequest, args, actor),
    /** Requester or Project Manager: close the unissued balance of an approved request */
    closeRequest: (args, actor) => run(W.closeMaterialRequest, args, actor),
    raiseRequisition: (f, actor) => run(W.raiseRequisition, f, actor),
    reviewRequisition: (args, actor) => run(W.reviewRequisition, args, actor),
    // Purchase Manager: requisitions → quotations → supplier → PO → delivery follow-up
    returnRequisition: (args, actor) => run(W.returnRequisition, args, actor),
    requestQuotations: (args, actor) => run(W.requestQuotations, args, actor),
    recordQuote: (args, actor) => run(W.recordQuote, args, actor),
    selectSupplier: (args, actor) => run(W.selectSupplier, args, actor),
    raisePurchaseOrder: (args, actor) => run(W.raisePurchaseOrder, args, actor),
    updatePODraft: (args, actor) => run(W.updatePODraft, args, actor),
    submitPurchaseOrder: (args, actor) => run(W.submitPurchaseOrder, args, actor),
    decidePurchaseOrder: (args, actor) => run(W.decidePurchaseOrder, args, actor),
    sendPurchaseOrder: (args, actor) => run(W.sendPurchaseOrder, args, actor),
    cancelPurchaseOrder: (args, actor) => run(W.cancelPurchaseOrder, args, actor),
    addFollowUp: (args, actor) => run(W.addFollowUp, args, actor),
    addSupplier: (f, actor) => run(W.addSupplier, f, actor),
    updateSupplier: (f, actor) => run(W.updateSupplier, f, actor),
    recordSupplierInvoice: (f, actor) => run(W.recordSupplierInvoice, f, actor),
    verifyInvoice: (args, actor) => run(W.verifyInvoice, args, actor),
    queryInvoice: (args, actor) => run(W.queryInvoice, args, actor),
    supplierReplied: (args, actor) => run(W.supplierReplied, args, actor),
    requestPaymentApproval: (args, actor) => run(W.requestPaymentApproval, args, actor),
    decidePaymentRelease: (args, actor) => run(W.decidePaymentRelease, args, actor),
    recordSupplierPayment: (args, actor) => run(W.recordSupplierPayment, args, actor),

    /** Confirmed issue: the only action that reduces stock for a request */
    issueMaterial: (req, f, user) => {
      recordInventoryAction('issue.confirm', { requestId: req.id, ...f })
      return commit((s) => {
        const current = s.requests.find((r) => r.id === req.id)
        // Only after Project Manager approval; re-checked against the latest stock so a repeated
        // confirm cannot issue twice
        if (!current || !ISSUABLE_REQUEST_STATUSES.includes(current.status) || validateIssue(f, current, computeStock(s), s.issues)) return s
        const issue = { id: nextId(s.issues, 'MI-'), requestId: req.id, qty: round2(f.qty), issuedBy: user.name, receivedBy: f.receivedBy.trim(), notes: f.notes?.trim() || '', at: nowStamp(), demo: true }
        const issuedSoFar = round2(s.issues.filter((i) => i.requestId === req.id).reduce((t, i) => t + i.qty, 0) + issue.qty)
        return {
          ...s,
          issues: [...s.issues, issue],
          requests: s.requests.map((r) => {
            if (r.id !== req.id) return r
            const to = issuedSoFar >= r.approved ? 'Issued' : 'Partially Issued'
            return {
              ...r, status: to,
              history: [...(r.history || []), { at: issue.at, by: user.name, role: user.roleId === 'admin' ? 'Admin' : 'Store Keeper', action: `Issued ${issue.qty} ${materialOf(r.sku)?.unit || ''} (${issue.id})`, note: `Received at site by ${issue.receivedBy}. Issued so far ${issuedSoFar} of ${r.approved}`, from: r.status, to }],
            }
          }),
          audit: [{ id: `AUD-${(s.audit?.length || 0) + 1}`, ref: issue.id, at: issue.at, by: user.name, role: user.roleId === 'admin' ? 'Admin' : 'Store Keeper', action: `Material issued against ${req.id}`, note: `${issue.qty} ${materialOf(current.sku)?.unit || ''}, received by ${issue.receivedBy}` }, ...(s.audit || [])],
        }
      })
    },


    recordReturn: (f, req, user) => patch('returns', (list) => [...list, {
      id: nextId(list, 'RET-'), issueId: f.issueId, siteId: req.siteId, storeId: req.storeId, sku: req.sku, qty: round2(f.qty),
      accepted: null, damaged: null, returnedBy: f.returnedBy.trim(), receivedBy: user.name, inspectedBy: null,
      status: 'Pending Inspection', reason: f.reason.trim(), notes: f.notes?.trim() || '', at: nowStamp(), confirmedAt: null, demo: true,
    }], 'return.record', f),
    inspectReturn: (id, { accepted, rejected, reason }, user) => patch('returns', (list) => guarded(list, id, (r) => r.status === 'Pending Inspection',
      (r) => ({ ...r, accepted: round2(accepted), damaged: round2(rejected || 0), notes: [r.notes, reason].filter(Boolean).join('. '), inspectedBy: user.name, status: 'Accepted', confirmedAt: nowStamp() })), 'return.inspect', { id }),

    recordTransfer: (f, user) => patch('transfers', (list) => [...list, {
      id: nextId(list, 'TRF-'), sku: f.sku, fromStoreId: f.fromStoreId, toStoreId: f.toStoreId, qty: round2(f.qty),
      recordedBy: user.name, receivedBy: f.receivedBy?.trim() || '', reason: f.reason.trim(), at: nowStamp(), demo: true,
    }], 'transfer.record', f),

    raiseAdjustment: (f, user) => patch('adjustments', (list) => [...list, {
      id: nextId(list, 'ADJ-'), sku: f.sku, storeId: f.storeId, qty: round2(f.qty), kind: f.kind, reason: f.reason.trim(),
      raisedBy: user.name, reviewedBy: null, status: 'Pending Review', at: nowStamp(), demo: true,
    }], 'adjustment.raise', f),
    /** Applied to stock only on approval, by someone other than the person who raised it */
    reviewAdjustment: (id, approve, note, user) => {
      const done = patch('adjustments', (list) => guarded(list, id, (a) => a.status === 'Pending Review' && a.raisedBy !== user.name,
        (a) => ({ ...a, status: approve ? 'Approved' : 'Rejected', reviewedBy: user.name, reviewNote: note, reviewedAt: nowStamp() })), 'adjustment.review', { id, approve })
      if (done) audit(id, user, approve ? 'Stock adjustment approved' : 'Stock adjustment rejected', note)
      return done
    },

    /** Material master + its first stock record. Does not record any receipt. */
    addMaterial: (m, line, user) => {
      recordInventoryAction('material.add', { m, line })
      const sku = normalizeCode(m.sku)
      commit((s) => ({
        ...s,
        materials: [...s.materials, { sku, name: m.name.trim(), category: m.category, unit: m.unit, rate: round2(m.rate), supplier: m.supplier.trim(), addedBy: user.name, addedAt: nowStamp(), demo: true }],
        lines: [...s.lines, makeLine(sku, line, user)],
      }))
    },
    /** Master details only. Code and unit cannot change once transactions or opening stock exist. */
    updateMaterial: (originalSku, m, user) => {
      recordInventoryAction('material.update', { originalSku, m })
      commit((s) => {
        const current = s.materials.find((x) => x.sku === originalSku)
        const locked = materialUsage(s, originalSku).locked
        const sku = locked ? originalSku : normalizeCode(m.sku)
        const rekey = (k) => (k.startsWith(`${originalSku}@`) ? `${sku}${k.slice(originalSku.length)}` : k)
        return {
          ...s,
          materials: s.materials.map((x) => (x.sku === originalSku
            ? { ...x, sku, name: m.name.trim(), category: m.category, unit: locked ? current.unit : m.unit, rate: round2(m.rate), supplier: m.supplier.trim(), editedBy: user.name, editedAt: nowStamp() }
            : x)),
          lines: sku === originalSku ? s.lines : s.lines.map((l) => (l.sku === originalSku ? { ...l, sku } : l)),
          locations: sku === originalSku ? s.locations : Object.fromEntries(Object.entries(s.locations).map(([k, v]) => [rekey(k), v])),
        }
      })
    },
    /** Stock the material at another store / project (one material, separate stock records). */
    addStockLine: (sku, line, user) => patch('lines', (lines) => (lines.some((l) => l.sku === sku && l.storeId === line.storeId) ? lines : [...lines, makeLine(sku, line, user)]), 'stockLine.add', { sku, line }),
    updateStockLine: (sku, storeId, { reorder, location }) => {
      recordInventoryAction('stockLine.update', { sku, storeId, reorder, location })
      commit((s) => {
        const key = `${sku}@${storeId}`
        const { [key]: _old, ...locations } = s.locations // the record's location replaces any earlier inline edit
        return { ...s, locations, lines: s.lines.map((l) => (l.sku === sku && l.storeId === storeId ? { ...l, reorder: round2(reorder), location: location.trim() } : l)) }
      })
    },

    setLocation: (key, location) => patch('locations', (map) => ({ ...map, [key]: location }), 'location.set', { key, location }),
    reset: () => commit(() => initialInventoryState()),
    }
  }, [patch, commit, run])

  setCatalog(state.materials) // material lookups below and in the pages use the session master list
  const derived = useMemo(() => {
    const movements = deriveMovements(state)
    const stock = computeStock(state, movements)
    const requests = requestRows(state, stock)
    return {
      movements, stock, requests, summary: buildSummary(state, stock, movements), alerts: buildAlerts(state, stock, requests),
      // Accountant's three-way match rows and Admin's action items, from the same records
      supplierBills: W.supplierBillRows(state), adminItems: W.adminActionItems(state),
      // Purchase Manager view of every PO (status, totals, deliveries, invoices)
      poViews: state.purchaseOrders.map((po) => W.poView(state, po)),
    }
  }, [state])

  const value = useMemo(() => ({ state, ...derived, actions }), [state, derived, actions])
  return <InventoryContext.Provider value={value}>{children}</InventoryContext.Provider>
}

export function useInventory() {
  const ctx = useContext(InventoryContext)
  if (!ctx) throw new Error('useInventory must be used inside <InventoryProvider>')
  return ctx
}
