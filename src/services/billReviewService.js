/**
 * Supplier bill review data boundary (verification → approval → payment).
 * DEMO: built from local fixtures. In the backend phase, replace with apiRequest(...)
 * calls returning the same shape; workflow actions must be saved and checked by the server.
 */
import { IS_DEMO } from './config.js'
import { buildBillReviews } from './demoBillAdapter.js'

let cache = null
export function getBillReviews() {
  if (!IS_DEMO) return Promise.reject(new Error('Backend integration is not implemented in this phase.'))
  cache = cache || buildBillReviews()
  return Promise.resolve(cache)
}

/** DEMO: nothing is sent or saved; the caller keeps workflow state on screen only. */
export function recordBillAction(billId, action, payload) {
  if (!IS_DEMO) return Promise.reject(new Error('Backend integration is not implemented in this phase.'))
  return Promise.resolve({ billId, action, payload, persisted: false })
}
