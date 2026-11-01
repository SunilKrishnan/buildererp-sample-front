/**
 * Customer receipts: recording, bank verification, allocation to instalments,
 * history, receipt numbers and reminder text. Pure functions over the view-model.
 *
 * DEMO: receipts recorded in the UI live only in the page's state. In the backend phase
 * the server must do the matching against real bank statements, allocate payments and
 * issue receipt numbers, so two users can never issue the same number.
 */
import { diffDays } from '../utils/date.js'

export const RECEIPT_METHODS = ['NEFT', 'RTGS', 'IMPS', 'UPI', 'Cheque', 'DD', 'Home loan disbursement', 'Cash']
// Money paid by cheque/DD is not received until the bank clears it
export const CLEARING_METHODS = ['Cheque', 'DD']
// Demo rule: cash receipts of ₹2 lakh or more are refused (confirm the actual rule with your CA)
export const CASH_LIMIT = 200000

export const referenceLabel = (method) =>
  method === 'Cheque' ? 'Cheque number' : method === 'DD' ? 'DD number' : method === 'UPI' ? 'UPI reference' : method === 'Cash' ? 'Cash voucher no. (optional)' : 'UTR / transaction reference'

const norm = (s) => String(s || '').replace(/[^a-z0-9]/gi, '').toUpperCase()

/** Returns an error message, or null when the receipt can be recorded. */
export function validateReceipt(f, { maxAmount, today }) {
  const amount = Number(f.amount)
  if (!(amount > 0)) return 'Enter the amount received'
  if (amount > maxAmount) return `Amount is more than the balance still to be paid (${maxAmount.toLocaleString('en-IN')})`
  if (!f.date) return 'Enter the date the money was paid'
  if (f.date > today) return 'The payment date cannot be in the future'
  if (!f.method) return 'Choose the payment method'
  if (f.method === 'Cash' && amount >= CASH_LIMIT) return 'Cash receipts of ₹2 lakh or more are not accepted (demo rule). Ask for a bank transfer.'
  if (f.method !== 'Cash' && !norm(f.reference)) return `Enter the ${referenceLabel(f.method).toLowerCase()}`
  return null
}

/**
 * Look for the receipt on the bank statement: same reference first, otherwise same
 * amount within 3 days. Credits already matched to another receipt are skipped.
 * @returns {{ result: 'Matched'|'Amount differs'|'In clearing'|'Not found'|'Cash', credit?: object }}
 */
export function matchToStatement(receipt, credits, usedCreditIds = []) {
  if (receipt.method === 'Cash') return { result: 'Cash' }
  const open = credits.filter((c) => !usedCreditIds.includes(c.id) && (!receipt.account || c.account === receipt.account))
  const byRef = open.find((c) => norm(c.ref) && norm(c.ref) === norm(receipt.reference))
  const byAmount = open.find((c) => c.amount === Number(receipt.amount) && Math.abs(diffDays(c.date, receipt.date)) <= 3)
  const credit = byRef || byAmount
  if (!credit) return { result: 'Not found' }
  if (credit.recon === 'Clearing' || credit.meta?.clearing) return { result: 'In clearing', credit }
  if (credit.amount !== Number(receipt.amount)) return { result: 'Amount differs', credit }
  return { result: 'Matched', credit }
}

/** Next number in a receipt series, e.g. RCPT-5043 → RCPT-5044, RCPT-V0142 → RCPT-V0143. */
export function nextReceiptNo(prefix, existing) {
  const nums = existing.filter((id) => id.startsWith(prefix) && /^\d+$/.test(id.slice(prefix.length))).map((id) => Number(id.slice(prefix.length)))
  const width = existing.find((id) => id.startsWith(prefix))?.slice(prefix.length).length || 4
  return `${prefix}${String((nums.length ? Math.max(...nums) : 0) + 1).padStart(width, '0')}`
}
export const receiptPrefixFor = (projectStatus) => (projectStatus === 'Completed' ? 'RCPT-V' : 'RCPT-')

/**
 * Apply this session's activity to a customer account: verified receipts are allocated
 * to the oldest unpaid instalments; reversed receipts are taken back out.
 */
export function applyActivity(account, activity, today) {
  const mine = activity.filter((r) => r.bookingId === account.bookingId)
  const counted = mine.filter((r) => r.status === 'Verified').sort((a, b) => a.date.localeCompare(b.date))
  const awaiting = mine.filter((r) => ['Pending verification', 'In clearing', 'Amount differs', 'Not found in bank'].includes(r.status))

  const schedule = account.schedule.map((x) => ({ ...x, paidNow: x.status === 'Received' ? x.amount : 0, allocations: [] }))
  counted.forEach((r) => {
    let left = r.amount
    schedule.forEach((row) => {
      if (left <= 0 || row.paidNow >= row.amount) return
      const take = Math.min(left, row.amount - row.paidNow)
      row.paidNow += take
      row.allocations.push({ receiptNo: r.receiptNo, amount: take })
      left -= take
    })
  })
  const rows = schedule.map((row) => {
    if (!row.allocations.length) return row
    const full = row.paidNow >= row.amount
    return {
      ...row,
      status: full ? 'Received' : 'Part paid',
      receiptId: [row.receiptId, ...row.allocations.map((x) => x.receiptNo)].filter(Boolean).join(', '),
      method: row.method || (counted.find((r) => r.receiptNo === row.allocations[0].receiptNo)?.method ?? null),
      daysOverdue: full ? 0 : row.daysOverdue,
    }
  })
  const paid = account.paid + counted.reduce((s, r) => s + r.amount, 0)
  const next = rows.find((x) => x.status !== 'Received') || null
  return {
    ...account,
    schedule: rows,
    paid,
    balance: account.price - paid,
    overdue: rows.filter((x) => x.status === 'Overdue' || (x.status === 'Part paid' && x.date < today)).reduce((s, x) => s + (x.amount - (x.paidNow || 0)), 0),
    dueSoon: rows.filter((x) => x.status === 'Due' || (x.status === 'Part paid' && x.date >= today)).reduce((s, x) => s + (x.amount - (x.paidNow || 0)), 0),
    notYetDemanded: rows.filter((x) => x.status === 'Upcoming').reduce((s, x) => s + (x.amount - (x.paidNow || 0)), 0),
    awaitingBank: awaiting.reduce((s, r) => s + r.amount, 0),
    next,
    activity: mine,
  }
}

/** Every money movement for the customer, newest first, including reversals. */
export function paymentHistory(account) {
  const fromData = account.schedule
    .filter((x) => x.receiptId && x.status === 'Received' && !x.allocations?.length)
    .map((x) => ({
      key: x.receiptId, type: 'Receipt', receiptNo: x.receiptId, date: x.date, amount: x.amount, method: x.method,
      reference: x.reference, bankStatus: x.bankStatus, against: x.milestone,
    }))
  const fromSession = (account.activity || []).flatMap((r) => {
    const entry = {
      key: r.id, type: 'Receipt', receiptNo: r.receiptNo, draftId: r.id, date: r.date, amount: r.amount, method: r.method,
      reference: r.reference, bankStatus: r.status, note: r.note, session: true, record: r,
    }
    if (r.status !== 'Reversed') return [entry]
    return [
      { ...entry, bankStatus: 'Verified' },
      { key: `${r.id}-rev`, type: 'Reversal', receiptNo: r.receiptNo, date: r.reversedOn, amount: -r.amount, method: r.method, reference: r.reference, bankStatus: 'Reversed', note: r.reversalReason, session: true },
    ]
  })
  return [...fromData, ...fromSession].sort((a, b) => b.date.localeCompare(a.date) || String(b.key).localeCompare(String(a.key)))
}

/** Reminder text for the next payment, e.g. "Sita has ₹5,00,000 due in 3 days". */
export function reminderMessage(account, today, fmt) {
  const n = account.next
  if (!n || n.status === 'Upcoming') return null
  const left = n.amount - (n.paidNow || 0)
  const days = diffDays(today, n.date)
  const first = account.customer.split(' ')[0]
  const when = days > 1 ? `due in ${days} days` : days === 1 ? 'due tomorrow' : days === 0 ? 'due today' : `overdue by ${-days} days`
  return {
    summary: `${first} has ${fmt(left)} ${when}.`,
    text: `Dear ${account.customer}, this is a reminder that ${fmt(left)} for ${account.unitType.toLowerCase()} ${account.unit} (${account.projectName}) towards "${n.milestone}" is ${when}. Please share the payment reference after paying. Thank you.`,
    overdue: days < 0,
  }
}

/** Accounting entry for a verified receipt (or its reversal). */
export function receiptJournal(receipt, account, { bankLedger, gstRate, gstApplies }) {
  const amount = receipt.amount
  const gst = gstApplies ? Math.round((amount * gstRate) / (100 + gstRate)) : 0
  const completed = account.projectStatus === 'Completed'
  const credit = completed
    ? [{ account: '1401', cr: amount }]
    : [{ account: '2301', cr: amount - gst }, ...(gst ? [{ account: '2203', cr: gst }] : [])]
  const lines = [{ account: bankLedger, dr: amount }, ...credit]
  return receipt.reversal
    ? lines.map((l) => (l.dr ? { account: l.account, cr: l.dr } : { account: l.account, dr: l.cr }))
    : lines
}
