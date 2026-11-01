/**
 * Accountant Dashboard data boundary.
 *
 * UI components only talk to these functions. Today they return aggregates built
 * from local demo fixtures. In the backend phase, replace the non-demo branches
 * with apiRequest(...) calls that return the same shape (see buildAccountantDashboard
 * in demoAccountantAdapter.js for the expected structure).
 */
import { IS_DEMO } from './config.js'
import { buildAccountantDashboard } from './demoAccountantAdapter.js'

const notConnected = () => Promise.reject(new Error('Backend integration is not implemented in this phase.'))

/** @param {{ projectId: string, from: string, to: string }} filters ISO dates */
export function getAccountantDashboard(filters) {
  if (!IS_DEMO) return notConnected()
  return Promise.resolve(buildAccountantDashboard(filters))
}

/**
 * Record an accounting action (verify a bill, schedule a payment, approve a request…).
 * DEMO MODE: nothing is sent, saved or paid. The caller only updates local UI state,
 * which resets when the page reloads. The real backend must re-check the user's
 * permission and approval limit on the server.
 * @param {'expense'|'supplier'|'payroll'|'contractor'|'approval'} kind
 */
export function recordAccountingAction(kind, id, action) {
  if (!IS_DEMO) return notConnected()
  return Promise.resolve({ kind, id, action, persisted: false })
}
