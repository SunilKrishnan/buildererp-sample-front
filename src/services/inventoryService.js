/**
 * Inventory and procurement data boundary (receipts, issues, requests, returns, transfers,
 * adjustments, purchase orders, supplier invoices and payments).
 * DEMO: seeded from data/demo/inventoryDemo.js. In the backend phase, load the same
 * shape with apiRequest(...) and let the server record each action, recalculate stock
 * and enforce permissions (a Store Keeper must not approve their own adjustments).
 */
import { IS_DEMO } from './config.js'
import { initialProcurementState } from './procurement.js'
import { ADJUSTMENTS, ISSUES, MATERIAL_CATALOG, PURCHASE_REQUESTS, RECEIPTS, REQUESTS, RETURNS, STOCK_LINES, TRANSFERS } from '../data/demo/inventoryDemo.js'

export function initialInventoryState() {
  return {
    materials: MATERIAL_CATALOG, // material master (details only, no quantities)
    lines: STOCK_LINES, // stock records: material × store, reorder level, location, opening stock
    receipts: RECEIPTS, requests: REQUESTS, issues: ISSUES, returns: RETURNS,
    transfers: TRANSFERS, adjustments: ADJUSTMENTS, purchaseRequests: PURCHASE_REQUESTS, locations: {},
    // Shared purchase register, supplier invoices, advances, payments and the audit trail
    ...initialProcurementState(),
  }
}

/** DEMO: nothing is sent or saved; the caller keeps the change on screen for this session only. */
export function recordInventoryAction(action, payload) {
  if (!IS_DEMO) return Promise.reject(new Error('Backend integration is not implemented in this phase.'))
  return Promise.resolve({ action, payload, persisted: false })
}
