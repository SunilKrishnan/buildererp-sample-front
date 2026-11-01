/**
 * Admin Dashboard data boundary.
 *
 * UI components only talk to these functions. Today they return aggregates built
 * from local demo fixtures. In the backend phase, replace the non-demo branches
 * with apiRequest(...) calls that return the same shape (see buildAdminDashboard
 * in demoDashboardAdapter.js for the expected structure).
 */
import { IS_DEMO } from './config.js'
import { buildAdminDashboard, listProjectOptions } from './demoDashboardAdapter.js'

const notConnected = () => Promise.reject(new Error('Backend integration is not implemented in this phase.'))

/** @param {{ projectId: string, from: string, to: string }} filters ISO dates */
export function getAdminDashboard(filters) {
  if (!IS_DEMO) return notConnected()
  return Promise.resolve(buildAdminDashboard(filters))
}

export function getProjectOptions() {
  if (!IS_DEMO) return notConnected()
  return Promise.resolve(listProjectOptions())
}
