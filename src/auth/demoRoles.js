/**
 * DEMO ROLES & PERMISSIONS: UI preview only.
 *
 * These rules decide which buttons the prototype shows. They are NOT access
 * control: anything in the browser can be changed by the user. When the backend
 * is built, the server must enforce every permission and approval limit, and the
 * UI should read the signed-in user's permissions from it instead of this file.
 *
 * Identity and permissions live here. Which pages appear in the sidebar is
 * configured separately in src/config/navigation.js.
 */

export const PERMISSIONS = {
  FINANCE_VIEW: 'finance.view',
  EXPENSE_VERIFY: 'expenses.verify', // check a bill against PO / GRN / site record
  SUPPLIER_SCHEDULE: 'supplierPayments.schedule', // queue a verified invoice for payment
  PAYROLL_VERIFY: 'payroll.verify', // check payroll against verified attendance (read-only)
  ATTENDANCE_EDIT: 'attendance.edit', // Site Supervisor (and Admin); never the accountant or the site engineer
  PAYROLL_APPROVE: 'payroll.approve',
  APPROVALS_DECIDE: 'approvals.decide', // still subject to approval limits below
  PROJECT_CREATE: 'projects.create',
  BANK_RECONCILE: 'bank.reconcile', // match ERP transactions with the bank statement
  JOURNAL_CREATE: 'journals.create', // draft and submit adjustment entries
  JOURNAL_POST: 'journals.post', // approve and post manual journals to the ledger
  SALARY_PREPARE: 'salaries.prepare',
  SALARY_APPROVE: 'salaries.approve',
  TAX_PREPARE: 'tax.prepare', // prepare returns/challans; filing is done by the authorised signatory
  RECEIPT_RECORD: 'receipts.record', // record customer payments and verify them against the bank
  RECEIPT_REVERSE: 'receipts.reverse', // reverse or correct a verified receipt
  REMINDER_SEND: 'reminders.send', // send payment reminders to customers
  BILL_APPROVE: 'bills.approve', // approve supplier bills within the configured approval rules
  PAYMENT_RECORD: 'payments.record', // record payment of an approved bill (payment team)
  // Stores / inventory
  INVENTORY_VIEW: 'inventory.view',
  GOODS_RECEIVE: 'inventory.receive', // record supplier deliveries, inspect, accept / reject quantities
  MATERIAL_ISSUE: 'inventory.issue', // issue approved materials to a site
  MATERIAL_REQUEST_REVIEW: 'materialRequests.review', // check availability and prepare a request for approval
  // Site material requests are approved by the Project Manager, who has no login in this demo
  // (decisions are simulated on screen). No demo role holds this permission.
  MATERIAL_REQUEST_APPROVE: 'materialRequests.approve',
  STOCK_MOVE: 'inventory.move', // record site returns and store-to-store transfers
  STOCK_LOCATIONS: 'inventory.locations', // manage storage locations
  MATERIAL_MASTER: 'materials.manage', // add materials and edit master details
  STOCK_ADJUST_REQUEST: 'inventory.adjust.request', // raise a stock correction / damage write-off (with reason)
  STOCK_ADJUST_APPROVE: 'inventory.adjust.approve', // review stock corrections (never your own)
  DISCREPANCY_REVIEW: 'inventory.discrepancy.review', // close delivery discrepancies
  PURCHASE_REQUEST_RAISE: 'purchaseRequests.raise', // forward a material requisition to the Purchase Manager
  // Purchasing control (policy in data/demo/procurementDemo.js)
  REQUISITION_REVIEW: 'purchaseRequests.review', // review requisitions above the value limit
  PO_APPROVE: 'purchaseOrders.approve', // approve POs above the Purchase Manager's limit
  PROCUREMENT_MANAGE: 'procurement.manage', // requisition review, quotations, supplier selection, POs, delivery follow-up
  SUPPLIER_MANAGE: 'suppliers.manage', // add / edit supplier records
  SUPPLIER_VIEW: 'suppliers.view', // read supplier records (Accounts)
  // Site
  SITE_WORK: 'site.work', // daily progress, diary, measurements, task notes, site issues, equipment / labour requests
  SITE_SUPERVISE: 'site.supervise', // Site Supervisor: work allocation, execution progress for engineer review, shortages, diary, site issues
  MATERIAL_REQUEST_CREATE: 'materialRequests.create', // raise material requests for an assigned site
  QUALITY_INSPECT: 'quality.inspect', // record technical inspections within the engineer's scope
  QUALITY_REVIEW: 'quality.review', // independent QA review / verification (QA Engineer)
  QA_MANAGE: 'qa.manage', // schedule and record QA inspections, checklists, NCRs, material test records
  QA_CLEARANCE: 'qa.clearance', // record QA clearance for the next activity (e.g. concrete pour)
  SAFETY_REPORT: 'safety.report', // report hazards, observations and incidents; follow actions
  SAFETY_VERIFY: 'safety.verify', // verify corrective actions and close hazards / incidents (Safety Officer)
  SAFETY_MANAGE: 'safety.manage', // Safety Officer: review hazards, assign corrections, investigate incidents, inspections, PPE, training, permits, emergency records
  PERMIT_APPROVE: 'permits.approve', // approve a permit to work prepared by someone else (Project Manager)
  PROJECT_REVIEW: 'project.review', // Project Manager: review daily reports, delays, BOQ revisions, measurements; close site issues
  SUPPLIER_PAYMENT_RELEASE: 'supplierPayments.release', // release a verified supplier payment
}

const P = PERMISSIONS

export const ROLES = {
  admin: {
    id: 'admin',
    label: 'Admin',
    title: 'Super Admin',
    dashboards: ['admin', 'accountant', 'storekeeper', 'purchasemanager', 'siteengineer', 'sitesupervisor', 'projectmanager', 'qa', 'safetyofficer'],
    // Admin oversees but is not the default approver of site work: the Project Manager reviews it
    // QA inspection, verification and clearance belong to the QA Engineer; Admin keeps oversight (view)
    // Safety review, verification and closure belong to the Safety Officer; Admin keeps oversight and permit approval
    permissions: Object.values(PERMISSIONS).filter((p) => ![PERMISSIONS.MATERIAL_REQUEST_APPROVE, PERMISSIONS.PROJECT_REVIEW, PERMISSIONS.QUALITY_REVIEW, PERMISSIONS.QA_MANAGE, PERMISSIONS.QA_CLEARANCE, PERMISSIONS.SAFETY_VERIFY, PERMISSIONS.SAFETY_MANAGE].includes(p)),
    // Request type → maximum amount this role may approve. '*' covers every type.
    approvalLimits: { '*': Infinity },
  },
  accountant: {
    id: 'accountant',
    label: 'Accountant',
    title: 'Accountant',
    dashboards: ['accountant'],
    permissions: [
      P.FINANCE_VIEW, P.EXPENSE_VERIFY, P.SUPPLIER_SCHEDULE, P.PAYROLL_VERIFY, P.APPROVALS_DECIDE,
      P.BANK_RECONCILE, P.JOURNAL_CREATE, P.SALARY_PREPARE, P.TAX_PREPARE, P.RECEIPT_RECORD, P.REMINDER_SEND, P.PAYMENT_RECORD,
      P.INVENTORY_VIEW, // reads goods receipts when checking supplier bills
      P.SUPPLIER_VIEW, // reads supplier records (contact, terms, GSTIN)
    ],
    // Small, routine items only. Supplier payments, payroll, contractor bills
    // and refunds always go to Admin.
    approvalLimits: { 'Expense Claim': 50000, 'Petty Cash': 25000, 'Labour Advance': 10000 },
  },
  storekeeper: {
    id: 'storekeeper',
    label: 'Store Keeper',
    title: 'Store Keeper',
    dashboards: ['storekeeper'],
    // Receives, stores and issues materials. Cannot approve material requests, its own
    // stock adjustments, purchases or supplier payments, and cannot create purchase orders.
    permissions: [
      P.INVENTORY_VIEW, P.GOODS_RECEIVE, P.MATERIAL_ISSUE, P.MATERIAL_REQUEST_REVIEW, P.STOCK_MOVE,
      P.STOCK_LOCATIONS, P.STOCK_ADJUST_REQUEST, P.PURCHASE_REQUEST_RAISE, P.MATERIAL_MASTER,
    ],
    approvalLimits: {},
  },
  purchasemanager: {
    id: 'purchasemanager',
    label: 'Purchase Manager',
    title: 'Purchase Manager',
    dashboards: ['purchasemanager'],
    // Reviews requisitions, gets and compares quotations, selects suppliers, prepares POs and
    // follows up deliveries. POs above the approval limit need Admin. Does not receive goods,
    // change stock, verify bills or make payments.
    permissions: [P.INVENTORY_VIEW, P.PROCUREMENT_MANAGE, P.SUPPLIER_MANAGE, P.SUPPLIER_VIEW],
    approvalLimits: { 'Purchase Order': 100000 }, // see PO_PM_APPROVAL_LIMIT in data/demo/procurementDemo.js
  },
  siteengineer: {
    id: 'siteengineer',
    label: 'Site Engineer',
    title: 'Site Engineer',
    dashboards: ['siteengineer'],
    // Technical site coordination for ASSIGNED projects / sites only: progress, material requests,
    // measurements, inspections, safety reporting, site issues. Cannot approve own requests, create
    // purchase orders, change approved BOQ / budgets, verify QA or safety closure, or record attendance
    // (the Site Supervisor does that).
    permissions: [P.INVENTORY_VIEW, P.SITE_WORK, P.MATERIAL_REQUEST_CREATE, P.QUALITY_INSPECT, P.SAFETY_REPORT],
    approvalLimits: {},
  },
  sitesupervisor: {
    id: 'sitesupervisor',
    label: 'Site Supervisor',
    title: 'Site Supervisor',
    dashboards: ['sitesupervisor'],
    // Existing site role (the person who keeps the muster roll and allocates crews; named on every site).
    // Records attendance, allocates workers to approved activities, records execution progress for
    // Site Engineer verification, reports shortages, issues and safety observations, keeps a diary.
    // Cannot raise or approve material requests, change stock, buy, verify bills, pay, or change
    // schedules, budgets or BOQ quantities.
    permissions: [P.INVENTORY_VIEW, P.ATTENDANCE_EDIT, P.SITE_SUPERVISE, P.SAFETY_REPORT],
    approvalLimits: {},
  },
  projectmanager: {
    id: 'projectmanager',
    label: 'Project Manager',
    title: 'Project Manager',
    dashboards: ['projectmanager'],
    // Existing role (named on every project). Reviews site work for the projects they manage:
    // material requirements, daily reports, delays, BOQ revisions, measurements and site issues.
    // Does not issue stock, buy, verify bills or pay.
    permissions: [P.INVENTORY_VIEW, P.MATERIAL_REQUEST_APPROVE, P.PROJECT_REVIEW, P.PERMIT_APPROVE],
    approvalLimits: {},
  },
  safetyofficer: {
    id: 'safetyofficer',
    label: 'Safety Officer',
    title: 'Safety Officer',
    dashboards: ['safetyofficer'],
    // Existing site role (the "authorised safety reviewer" on safety records; Admin used to stand in).
    // Safety inspections, hazard review, incident investigation, corrective actions and their
    // verification, PPE, training, permits (prepared here, approved by the Project Manager) and
    // emergency records. No stock, purchasing, payroll or financial permissions.
    permissions: [P.SAFETY_REPORT, P.SAFETY_MANAGE, P.SAFETY_VERIFY],
    approvalLimits: {},
  },
  qa: {
    id: 'qa',
    label: 'QA Engineer',
    title: 'Quality Assurance',
    dashboards: ['qa'],
    // Inspections, checklists, material test records, NCRs, verification and clearance.
    // No access to stock balances, purchase prices or financial records.
    permissions: [P.INVENTORY_VIEW, P.QA_MANAGE, P.QA_CLEARANCE, P.QUALITY_REVIEW],
    approvalLimits: {},
  },
}

// One illustrative person per role. Switching the role preview switches the user.
export const DEMO_USERS = {
  admin: { id: 'U-001', name: 'Admin User', initials: 'AU', roleId: 'admin' },
  accountant: { id: 'U-014', name: 'Accounts User', initials: 'AC', roleId: 'accountant' },
  storekeeper: { id: 'U-021', name: 'Vijay Pawar', initials: 'VP', roleId: 'storekeeper' },
  purchasemanager: { id: 'U-031', name: 'Deepak Rao', initials: 'DR', roleId: 'purchasemanager' },
  siteengineer: { id: 'U-041', name: 'Karan Joshi', initials: 'KJ', roleId: 'siteengineer' },
  projectmanager: { id: 'U-011', name: 'Rahul Mehta', initials: 'RM', roleId: 'projectmanager' },
  sitesupervisor: { id: 'U-051', name: 'Ravi Shinde', initials: 'RS', roleId: 'sitesupervisor' }, // Site Supervisor, Tower A
  safetyofficer: { id: 'U-071', name: 'Sneha Kulkarni', initials: 'SK', roleId: 'safetyofficer' }, // Safety Officer, Sunrise Heights
  qa: { id: 'U-061', name: 'R. Banerjee', initials: 'RB', roleId: 'qa' }, // QA/QC engineer (named on existing QA inspection records)
}

export const ROLE_IDS = Object.keys(ROLES)

export function can(roleId, permission) {
  return !!ROLES[roleId]?.permissions.includes(permission)
}

/**
 * Whether `user` may decide on an approval request, with a reason when not.
 * Rules: needs the approve permission, cannot approve own request (segregation
 * of duties), and the amount must be within the role's limit for that type.
 * @returns {{ allowed: boolean, reason?: string, limit?: number }}
 */
export function approvalCheck(user, item) {
  const role = ROLES[user?.roleId]
  if (!role || !can(role.id, P.APPROVALS_DECIDE)) return { allowed: false, reason: 'View only for your role' }
  if (item.requestedBy === user.name) return { allowed: false, reason: 'Raised by you. Needs another approver' }
  const limit = role.approvalLimits[item.type] ?? role.approvalLimits['*']
  if (limit == null) return { allowed: false, reason: `Needs ${item.approverRole || 'Admin'} approval` }
  if (item.amount != null && item.amount > limit) return { allowed: false, reason: 'Above your approval limit. Needs Admin', limit }
  return { allowed: true, limit }
}
