/**
 * Builds the supplier-bill review view-model from DEMO fixtures: each expense bill with its
 * structured record (bill lines, purchase order/agreement, site confirmation), the records
 * that are mandatory for its category, and the configured approval rules.
 */
import * as D from '../data/demo/adminDashboardDemo.js'
import * as A from '../data/demo/accountantDashboardDemo.js'
import { BILL_APPROVAL_RULES, BILL_RECORDS, MANDATORY_RECORDS, PURCHASE_MANAGER } from '../data/demo/billVerificationDemo.js'

export function buildBillReviews() {
  const projectName = (id) => D.projects.find((p) => p.id === id)?.name ?? id
  const bills = A.expenseBills.map((b) => ({
    ...b,
    projectName: projectName(b.projectId),
    projectStatus: D.projects.find((p) => p.id === b.projectId)?.status,
    record: BILL_RECORDS[b.id] || null,
    mandatory: MANDATORY_RECORDS[b.category] || MANDATORY_RECORDS.default,
  }))
  return { bills, approvalRules: BILL_APPROVAL_RULES, purchaseManager: PURCHASE_MANAGER }
}
