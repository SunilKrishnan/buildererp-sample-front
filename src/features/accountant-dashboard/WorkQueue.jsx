import Icon from '../../components/Icon.jsx'
import { Card } from '../../components/UI.jsx'
import { approvalCheck } from '../../auth/demoRoles.js'
import { formatCompactINR } from '../../utils/format.js'

const sumOf = (rows, k) => rows.reduce((s, r) => s + (r[k] || 0), 0)

/**
 * Builds the task list for the role the page is showing actions for.
 * `todo` = things this role can act on now; `waiting` = blocked on someone else.
 * Each task links to the page + status filter where it can be done. Order follows
 * the accountant's day: bills, suppliers, customers, salaries & wages, contractors,
 * bank reconciliation, approvals, then tax and journals.
 */
export function buildWorkQueue({ work, perms, user }) {
  const todo = []
  const waiting = []
  const add = (list, t) => t.count > 0 && list.push(t)
  const to = (allowed) => (allowed ? todo : waiting)

  // 1. Bills awaiting verification
  const billsPending = work.expenseBills.filter((b) => b.verification === 'Pending Verification')
  const billsReady = billsPending.filter((b) => b.document)
  const billsNoDoc = billsPending.filter((b) => !b.document)
  add(to(perms.canVerifyBills), {
    id: 'bills', icon: 'file', title: 'Verify expense bills', count: billsReady.length, amount: sumOf(billsReady, 'amount'),
    sub: 'Check against bill and site record', tab: 'expenses', status: 'Pending Verification',
  })
  add(waiting, {
    id: 'bills-doc', icon: 'file', title: 'Bills missing a supporting document', count: billsNoDoc.length, amount: sumOf(billsNoDoc, 'amount'),
    sub: 'Waiting on site to upload the bill', tab: 'expenses', status: 'Pending Verification',
  })

  const bills = work.expenseBills || []
  const returned = bills.filter((b) => b.stage.startsWith('Returned') || b.stage === 'Query Raised')
  add(to(perms.canVerifyBills), {
    id: 'bills-returned', icon: 'file', title: 'Bills with queries or returned', count: returned.length, amount: sumOf(returned, 'amount'),
    sub: 'Answer the query or re-check after correction', tab: 'expenses', status: 'Returned',
  })
  const awaitingApproval = bills.filter((b) => b.stage === 'Awaiting Approval')
  add(to(perms.canApproveBills), {
    id: 'bills-approve', icon: 'check', title: perms.canApproveBills ? 'Supplier bills to approve' : 'Supplier bills awaiting approval', count: awaitingApproval.length,
    amount: awaitingApproval.reduce((s, b) => s + (b.s.recommendedAmount ?? b.amount), 0), tab: 'expenses', status: 'Awaiting Approval',
  })
  const toPay = bills.filter((b) => !b.s.historic && ['Approved', 'Partially Paid'].includes(b.stage))
  add(to(perms.canRecordPayment), {
    id: 'bills-pay', icon: 'wallet', title: 'Approved bills to pay', count: toPay.length,
    amount: toPay.reduce((s, b) => s + ((b.s.approvedAmount ?? b.amount) - b.s.paidAmount), 0), sub: 'Record payment reference after paying', tab: 'expenses', status: 'Approved',
  })

  // 2. Supplier invoices & payments
  const toMatch = work.supplierBills.filter((b) => b.paymentStatus === 'Awaiting Verification')
  const mismatched = toMatch.filter((b) => !['Matched', 'Awaiting inspection'].includes(b.matchStatus))
  const matched = toMatch.filter((b) => b.matchStatus === 'Matched')
  add(to(perms.canVerifyBills), {
    id: 'mismatch', icon: 'alert', tone: 'danger', title: 'Invoice mismatches to investigate', count: mismatched.length, amount: sumOf(mismatched, 'overBilled'),
    sub: 'Billed more than accepted at the store, or above the PO rate (amount over-billed)', tab: 'suppliers', status: 'Awaiting Verification',
  })
  add(to(perms.canVerifyBills), {
    id: 'match', icon: 'cart', title: 'Supplier invoices ready to verify', count: matched.length, amount: sumOf(matched, 'balance'),
    sub: 'PO, GRN and invoice agree', tab: 'suppliers', status: 'Awaiting Verification',
  })
  const overdue = work.supplierBills.filter((b) => b.paymentStatus === 'Overdue')
  add(to(perms.canSchedule), {
    id: 'overdue', icon: 'alert', tone: 'danger', title: 'Overdue supplier payments', count: overdue.length, amount: sumOf(overdue, 'balance'),
    sub: 'Past their payment deadline', tab: 'suppliers', status: 'Overdue',
  })
  const dueSoon = work.supplierBills.filter((b) => b.paymentStatus === 'Due' && b.daysOverdue >= -7)
  add(to(perms.canSchedule), {
    id: 'due-soon', icon: 'calendar', title: 'Supplier payments due in 7 days', count: dueSoon.length, amount: sumOf(dueSoon, 'balance'),
    sub: 'Request Admin approval so they are paid on time', tab: 'suppliers', status: 'Due',
  })
  const released = work.supplierBills.filter((b) => ['Approved for Payment', 'Partially Paid'].includes(b.paymentStatus))
  add(to(perms.canRecordPayment), {
    id: 'released', icon: 'wallet', title: 'Supplier payments released by Admin', count: released.length, amount: sumOf(released, 'remainingApproved'),
    sub: 'Pay and record the bank reference', tab: 'suppliers', status: 'Approved for Payment',
  })
  const scheduled = work.supplierBills.filter((b) => b.paymentStatus === 'Awaiting Payment Approval')
  add(waiting, {
    id: 'scheduled', icon: 'cart', title: 'Supplier payments awaiting Admin release', count: scheduled.length, amount: scheduled.reduce((t, b) => t + b.request.net, 0),
    sub: 'Admin approval needed to release', tab: 'suppliers', status: 'Awaiting Payment Approval',
  })

  // 3. Customer payments overdue
  const overdueCustomers = work.receivables.filter((r) => r.status === 'Overdue')
  add(todo, {
    id: 'collect', icon: 'handshake', tone: 'danger', title: 'Overdue customer payments to follow up', count: overdueCustomers.length, amount: sumOf(overdueCustomers, 'amount'),
    sub: 'Send reminders / update sales team', tab: 'receipts', status: 'Outstanding',
  })

  const dueWeek = (work.paymentSchedule || []).filter((x) => (x.status === 'Due' || x.status === 'Part paid') && x.daysToDue >= 0 && x.daysToDue <= 7)
  add(todo, {
    id: 'due-week', icon: 'bell', title: 'Customer payments due in 7 days (send reminders)', count: dueWeek.length, amount: sumOf(dueWeek, 'amount'),
    sub: 'Remind before the due date', tab: 'receipts', status: 'Payment schedule',
  })
  const awaitingBank = (work.activity || []).filter((r) => ['Pending verification', 'Not found in bank', 'Amount differs', 'In clearing'].includes(r.status))
  add(to(perms.canReconcile), {
    id: 'receipts-bank', icon: 'bank', title: 'Customer receipts awaiting bank verification', count: awaitingBank.length, amount: sumOf(awaitingBank, 'amount'),
    sub: 'Not counted as paid until matched with the bank', tab: 'receipts',
  })

  // 4. Employee salaries and labour wages
  const salaryDraft = work.salaryRuns.filter((r) => r.status === 'Draft')
  add(to(perms.canPrepareSalary), {
    id: 'salary-draft', icon: 'briefcase', title: 'Employee salaries to prepare', count: salaryDraft.length, amount: sumOf(salaryDraft, 'net'),
    sub: salaryDraft.map((r) => r.label).join(', '), tab: 'salaries',
  })
  const salaryApproval = work.salaryRuns.filter((r) => r.status === 'Pending Approval')
  add(to(perms.canApproveSalary), {
    id: 'salary-approve', icon: 'briefcase', title: perms.canApproveSalary ? 'Salary runs to approve' : 'Salary runs awaiting Admin approval',
    count: salaryApproval.length, amount: sumOf(salaryApproval, 'net'), sub: salaryApproval.map((r) => r.label).join(', '), tab: 'salaries',
  })
  const awaiting = work.batches.filter((b) => b.status === 'Awaiting Verification')
  const blocked = awaiting.filter((b) => b.verifiedDays < b.workerDays)
  const ready = awaiting.filter((b) => b.verifiedDays >= b.workerDays)
  add(to(perms.canVerifyPayroll), {
    id: 'payroll-ready', icon: 'hardhat', title: 'Labour wages ready to verify', count: ready.length, amount: sumOf(ready, 'net'),
    sub: 'Attendance fully verified by site', tab: 'payroll', status: 'Awaiting Verification',
  })
  add(waiting, {
    id: 'payroll-blocked', icon: 'hardhat', title: 'Labour wages waiting on attendance', count: blocked.length, amount: sumOf(blocked, 'net'),
    sub: blocked[0] ? `${Math.round((blocked[0].verifiedDays / blocked[0].workerDays) * 100)}% of worker-days verified by site` : '',
    tab: 'payroll', status: 'Awaiting Verification',
  })
  const payrollApproval = work.batches.filter((b) => b.status === 'Pending Approval')
  add(to(perms.canApprovePayroll), {
    id: 'payroll-approve', icon: 'hardhat', title: perms.canApprovePayroll ? 'Labour wages to approve' : 'Labour wages awaiting Admin approval',
    count: payrollApproval.length, amount: sumOf(payrollApproval, 'net'), tab: 'payroll', status: 'Pending Approval',
  })

  // 5. Contractor bills
  const raToVerify = work.contractorBills.filter((b) => b.status === 'Pending Verification')
  add(to(perms.canVerifyBills), {
    id: 'ra-verify', icon: 'clipboard', title: 'Contractor bills to verify', count: raToVerify.length, amount: sumOf(raToVerify, 'net'),
    sub: 'Check certified measurements', tab: 'contractors', status: 'Pending Verification',
  })
  const raApproval = work.contractorBills.filter((b) => b.status === 'Pending Approval')
  add(to(perms.canApprovePayroll), {
    id: 'ra-approve', icon: 'clipboard', title: perms.canApprovePayroll ? 'Contractor bills to approve' : 'Contractor bills awaiting Admin approval',
    count: raApproval.length, amount: sumOf(raApproval, 'net'), tab: 'contractors', status: 'Pending Approval',
  })

  // 6. Bank reconciliation
  const reconOpen = work.reconItems.filter((t) => ['Unreconciled', 'Bank only', 'Amount differs'].includes(t.status))
  add(to(perms.canReconcile), {
    id: 'recon', icon: 'link', title: 'Transactions to reconcile with bank', count: reconOpen.length,
    sub: `${reconOpen.filter((t) => t.status === 'Amount differs').length} amount difference, ${reconOpen.filter((t) => t.status === 'Bank only').length} bank-only entries`,
    tab: 'reconciliation',
  })
  const uncleared = work.reconItems.filter((t) => t.status === 'ERP only')
  add(waiting, {
    id: 'uncleared', icon: 'bank', title: 'Cheques issued, not yet cleared', count: uncleared.length, amount: -sumOf(uncleared, 'amount'),
    sub: 'Waiting for the bank', tab: 'reconciliation',
  })

  // 7. Financial approvals
  const pending = work.approvals.filter((a) => a.status === 'Pending')
  const mine = pending.filter((a) => approvalCheck(user, a).allowed)
  const others = pending.filter((a) => !approvalCheck(user, a).allowed)
  const toForward = others.filter((a) => !a.verified)
  add(todo, { id: 'approve', icon: 'check', title: 'Requests within your approval limit', count: mine.length, amount: sumOf(mine, 'amount'), tab: 'approvals' })
  add(to(perms.canVerifyBills), {
    id: 'forward', icon: 'check', title: 'Requests to verify & forward', count: toForward.length, amount: sumOf(toForward, 'amount'),
    sub: 'Need another approver', tab: 'approvals',
  })
  add(waiting, {
    id: 'forwarded', icon: 'check', title: 'Forwarded requests awaiting decision', count: others.length - toForward.length,
    amount: sumOf(others.filter((a) => a.verified), 'amount'), tab: 'approvals',
  })

  // 8. Tax & statutory due soon
  const taxDue = work.taxFilings.filter((f) => f.status === 'Due' && f.daysLeft <= 10)
  add(to(perms.canPrepareTax), {
    id: 'tax', icon: 'percent', tone: taxDue.some((f) => f.daysLeft <= 3) ? 'danger' : undefined, title: 'Tax filings & payments due in 10 days',
    count: taxDue.length, amount: sumOf(taxDue, 'amount'), sub: taxDue.map((f) => f.form).join(', '), tab: 'tax', status: 'Due',
  })

  // 9. Journals
  const jvDraft = work.journals.filter((j) => j.origin === 'Manual' && j.status === 'Draft')
  add(to(perms.canCreateJournal), {
    id: 'jv-draft', icon: 'book', title: 'Draft journals to submit', count: jvDraft.length, amount: sumOf(jvDraft, 'amount'), tab: 'journals',
  })
  const jvPending = work.journals.filter((j) => j.origin === 'Manual' && j.status === 'Pending Approval')
  add(to(perms.canPostJournal), {
    id: 'jv-pending', icon: 'book', title: perms.canPostJournal ? 'Journals to approve & post' : 'Journals awaiting Admin approval',
    count: jvPending.length, amount: sumOf(jvPending, 'amount'), tab: 'journals',
  })

  return { todo, waiting }
}

function TaskRow({ task, onOpen, muted }) {
  return (
    <li>
      <button className={`task ${muted ? 'muted' : ''} ${task.tone ? `tone-${task.tone}` : ''}`} onClick={() => onOpen(task.tab, { status: task.status })}>
        <span className="task-ico"><Icon name={task.icon} size={16} /></span>
        <span className="task-main">
          <span className="task-title">{task.title}</span>
          {task.sub && <span className="task-sub">{task.sub}</span>}
        </span>
        <span className="task-side">
          <b>{task.count}</b>
          {task.amount > 0 && <span>{formatCompactINR(task.amount)}</span>}
        </span>
        <span className="task-go" aria-hidden="true">›</span>
      </button>
    </li>
  )
}

/** "My work today": the accountant's starting point on the overview. */
export default function WorkQueue({ queue, roleLabel, onOpen }) {
  const { todo, waiting } = queue
  return (
    <Card
      className="work-queue mb"
      title={<span className="title-with-count">My work today <span className="count-pill">{todo.length} to do</span></span>}
      sub={`Tasks for the ${roleLabel} role, from demo records. Open a task to act on it.`}
    >
      <div className="work-cols">
        <div>
          <div className="work-head">To do</div>
          {todo.length ? (
            <ul className="task-list">{todo.map((t) => <TaskRow key={t.id} task={t} onOpen={onOpen} />)}</ul>
          ) : (
            <div className="empty sm">All caught up. Nothing needs your action.</div>
          )}
        </div>
        <div>
          <div className="work-head">Waiting on others</div>
          {waiting.length ? (
            <ul className="task-list">{waiting.map((t) => <TaskRow key={t.id} task={t} onOpen={onOpen} muted />)}</ul>
          ) : (
            <div className="empty sm">Nothing blocked.</div>
          )}
        </div>
      </div>
    </Card>
  )
}
