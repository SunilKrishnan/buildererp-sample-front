// Rules for moving a supplier bill through verification and approval (pure functions).
// DEMO: the server must enforce these in the backend phase.
import { compareBill, recordAvailability } from '../../services/billComparison.js'

/** Bill record with any on-screen corrections applied (e.g. a corrected bill, a site confirmation). */
export function effectiveBill(bill, state) {
  if (!state?.recordPatch || !bill.record) return bill
  const p = state.recordPatch
  return { ...bill, record: { ...bill.record, ...p, site: p.site ? { ...bill.record.site, ...p.site } : bill.record.site } }
}

/** Comparison report for a bill in its current state, against all other bills. */
export function reportFor(bill, state, allBills) {
  const b = effectiveBill(bill, state)
  return { bill: b, report: compareBill(b, { others: allBills, mandatory: bill.mandatory, projectName: bill.projectName }), records: recordAvailability(b, bill.mandatory) }
}

export const approvalRuleFor = (amount, rules) => rules.find((r) => amount <= r.upTo) || rules[rules.length - 1]

/** Why a bill is held: missing mandatory records or serious findings nobody has explained. */
export function holdReasons(report, state) {
  const reasons = []
  report.findings.forEach((f) => {
    if (f.mandatory) reasons.push(f.title)
    else if (f.severity === 'High' && !state.findingNotes?.[f.id]) reasons.push(`Not yet reviewed: ${f.title.toLowerCase()}`)
  })
  return reasons
}

/** Can the accountant mark the bill verified? */
export function verifyBlockers(report, state) {
  const out = []
  if (!state.aiRunAt) out.push('Run the comparison with the purchase order first')
  report.findings.filter((f) => f.mandatory).forEach((f) => out.push(f.title))
  report.findings.filter((f) => f.severity === 'High' && !f.mandatory && !state.findingNotes?.[f.id]).forEach((f) => out.push(`Add your review note for: ${f.title.toLowerCase()}`))
  if (!state.checked) out.push('Confirm that you checked the bill, order and site record')
  return out
}

/** Can this user approve the bill now? Returns { ok, reason }. */
export function approverCheck({ state, report, user, role, rule }) {
  if (state.approval !== 'Awaiting Approval') return { ok: false, reason: 'Not awaiting approval' }
  if (!rule.approvers.includes(role.id)) return { ok: false, reason: `Approval rule: ${rule.label}` }
  if (state.verifiedBy && state.verifiedBy === user.name) return { ok: false, reason: 'The approver must be a different person from the verifier' }
  const held = holdReasons(report, state)
  if (held.length) return { ok: false, reason: `Held for review: ${held[0]}` }
  return { ok: true }
}
