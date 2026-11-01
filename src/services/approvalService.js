import { IS_DEMO } from './config.js'

/**
 * Record an approval decision.
 * DEMO MODE: nothing is sent or saved. The caller only updates local UI state,
 * and no approval, payroll or payment is actually processed.
 */
export function recordApprovalDecision(id, decision) {
  if (!IS_DEMO) return Promise.reject(new Error('Backend integration is not implemented in this phase.'))
  return Promise.resolve({ id, decision, persisted: false })
}
