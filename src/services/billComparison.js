/**
 * SIMULATED "AI" bill comparison: a deterministic, rule-based check of a supplier bill
 * against the purchase order/agreement and the site confirmation. No AI model, OCR or
 * document reading is involved; inputs are structured demo records.
 *
 * Findings describe differences for a person to review. A difference is not proof of an
 * error or of fraud, and the engine never decides who is right.
 */

import { formatDate } from '../utils/format.js'

const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '')
const money = (n) => `₹${Number(n).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`
const fmtPeriod = (p) => `${formatDate(p.from)} to ${formatDate(p.to)}`
const overlaps = (a, b) => a && b && a.from <= b.to && b.from <= a.to

export const RECORD_LABEL = { bill: 'Supplier bill', po: 'Purchase order / agreement', site: 'Site confirmation' }

/** Which records exist for a bill: 'available' | 'missing' | 'pending' | 'not required'. */
export function recordAvailability(bill, mandatory) {
  const r = bill.record || {}
  const need = (k) => mandatory.includes(k)
  return {
    bill: bill.document ? 'available' : 'missing',
    po: r.po ? 'available' : need('po') ? 'missing' : 'not required',
    site: r.site?.status === 'Confirmed' ? 'available' : r.site?.status === 'Pending' ? 'pending' : need('site') ? 'missing' : 'not required',
  }
}

/**
 * Compare one bill. `others` = other bills from all suppliers (for the duplicate check).
 * Returns { rows, findings, expected, summary }.
 */
export function compareBill(bill, { others = [], mandatory = ['bill'], projectName }) {
  const rec = bill.record || {}
  const po = rec.po
  const site = rec.site
  const rows = []
  const findings = []
  const add = (f) => findings.push({ id: `${bill.id}-F${findings.length + 1}`, ...f })
  const docs = { bill: bill.document || 'Supplier bill (not uploaded)', po: po?.document, site: site?.document }

  // 1. Supplier & GSTIN
  if (po) {
    const same = norm(rec.supplierOnBill || bill.vendor) === norm(po.supplier)
    rows.push({ field: 'Supplier', bill: rec.supplierOnBill || bill.vendor, po: po.supplier, site: '-', result: same ? 'Match' : 'Differs' })
    if (!same) add({ severity: 'High', title: 'Supplier name differs from the purchase order', detail: 'The bill is from a different supplier name than the one on the order.', compared: [{ label: 'Bill', value: rec.supplierOnBill, source: docs.bill }, { label: 'Order', value: po.supplier, source: docs.po }], action: 'Confirm the supplier with the Purchase Manager.' })
    if (rec.gstin || po.gstin) {
      const g = norm(rec.gstin) === norm(po.gstin)
      rows.push({ field: 'GSTIN', bill: rec.gstin || 'Not shown', po: po.gstin || 'Not registered', site: '-', result: g ? 'Match' : 'Differs' })
      if (!g) add({ severity: 'High', title: 'GSTIN differs', detail: 'The GST number on the bill does not match the order.', compared: [{ label: 'Bill', value: rec.gstin, source: docs.bill }, { label: 'Order', value: po.gstin, source: docs.po }], action: 'Ask the supplier for a corrected bill.' })
    }
  }

  // 2. Project
  const projects = [rec.projectOnBill, po?.project].filter(Boolean)
  if (projects.length) {
    const ok = projects.every((p) => norm(p) === norm(projectName))
    rows.push({ field: 'Project', bill: rec.projectOnBill || projectName, po: po?.project || '-', site: site?.status === 'Confirmed' ? projectName : '-', result: ok ? 'Match' : 'Differs' })
    if (!ok) {
      add({
        severity: 'High', title: 'Project on the bill does not match the order',
        detail: `The bill names "${rec.projectOnBill}", but the order and site record are for "${po?.project || projectName}". Costs would be booked to the wrong project.`,
        compared: [{ label: 'Bill', value: rec.projectOnBill, source: docs.bill }, { label: 'Order', value: po?.project, source: docs.po }],
        action: 'Return the bill to the supplier for correction.',
      })
    }
  }

  // 3. Quantity / period and rate, line by line
  let expectedTaxable = 0
  ;(rec.lines || []).forEach((line) => {
    const poLine = po?.lines.find((l) => l.item === line.item)
    const siteLine = site?.status === 'Confirmed' ? site.lines.find((l) => l.item === line.item) : null
    const agreedQty = poLine?.qty ?? null
    const confirmedQty = siteLine?.qty ?? null
    // Payable quantity = what site confirmed, capped at what was ordered (when the order fixes a quantity)
    const payQty = [line.qty, agreedQty, confirmedQty].filter((v) => v != null).reduce((m, v) => Math.min(m, v), Infinity)
    const payRate = poLine ? Math.min(line.rate, poLine.rate) : line.rate
    expectedTaxable += (Number.isFinite(payQty) ? payQty : line.qty) * payRate

    const qtyOk = (agreedQty == null || line.qty <= agreedQty) && (confirmedQty == null || line.qty <= confirmedQty)
    rows.push({
      field: `Quantity: ${line.desc}`,
      bill: `${line.qty} ${line.unit}`,
      po: agreedQty != null ? `${agreedQty} ${line.unit}` : poLine ? 'As per site record' : '-',
      site: confirmedQty != null ? `${confirmedQty} ${line.unit}` : site?.status === 'Pending' ? 'Pending' : '-',
      result: qtyOk ? 'Match' : 'Differs',
    })
    if (!qtyOk) {
      const extra = line.qty - Math.min(...[agreedQty, confirmedQty].filter((v) => v != null))
      const extraValue = extra * line.rate
      add({
        severity: 'High',
        title: `Billed ${line.unit} exceed the ${agreedQty != null && line.qty > agreedQty ? 'order' : 'site record'}`,
        detail: `The bill charges ${line.qty} ${line.unit}; the order allows ${agreedQty ?? 'quantity as per site'} and site confirmed ${confirmedQty ?? 'nothing yet'}. The extra ${extra} ${extra === 1 ? line.unit.replace(/s$/, '') : line.unit} is worth ${money(extraValue)} before tax${bill.record.gstRate ? ` (${money(extraValue * (1 + bill.record.gstRate / 100))} with GST)` : ''}.`,
        compared: [
          { label: 'Bill', value: `${line.qty} ${line.unit} × ${money(line.rate)}`, source: docs.bill },
          ...(agreedQty != null ? [{ label: 'Order', value: `${agreedQty} ${line.unit} × ${money(poLine.rate)}`, source: docs.po }] : []),
          ...(confirmedQty != null ? [{ label: 'Site', value: `${confirmedQty} ${line.unit}`, source: docs.site }] : []),
        ],
        amount: Math.round(extraValue * (1 + (bill.record.gstRate || 0) / 100)),
        action: 'Investigate the extra quantity with the supplier and site before verifying. It may have a valid reason.',
      })
    }
    if (poLine) {
      const rateOk = line.rate <= poLine.rate
      rows.push({ field: `Rate: ${line.desc}`, bill: `${money(line.rate)} / ${line.unit.replace(/s$/, '')}`, po: `${money(poLine.rate)} / ${line.unit.replace(/s$/, '')}`, site: '-', result: line.rate === poLine.rate ? 'Match' : rateOk ? 'Lower' : 'Differs' })
      if (!rateOk) add({ severity: 'High', title: 'Rate is higher than agreed', detail: `Billed ${money(line.rate)} against the agreed ${money(poLine.rate)}.`, compared: [{ label: 'Bill', value: money(line.rate), source: docs.bill }, { label: 'Order', value: money(poLine.rate), source: docs.po }], action: 'Ask for a revised bill or a credit note.' })
      if (line.rate < poLine.rate) add({ severity: 'Info', title: 'Rate is lower than agreed (favourable)', detail: `Billed ${money(line.rate)} against the agreed cap of ${money(poLine.rate)}. No action needed beyond noting it.`, compared: [{ label: 'Bill', value: money(line.rate), source: docs.bill }, { label: 'Order', value: money(poLine.rate), source: docs.po }] })
    } else if (!po) {
      rows.push({ field: `Rate: ${line.desc}`, bill: money(line.rate), po: 'No order', site: '-', result: 'Unchecked' })
    }
  })

  // 4. Tax and amounts
  const billedTaxable = Math.round((rec.lines || []).reduce((s, l) => s + l.qty * l.rate, 0))
  if (rec.lines) {
    const gst = Math.round((billedTaxable * (rec.gstRate || 0)) / 100)
    const total = billedTaxable + gst
    if (po) {
      const gOk = (rec.gstRate || 0) === (po.gstRate || 0)
      rows.push({ field: 'GST rate', bill: `${rec.gstRate || 0}%`, po: `${po.gstRate || 0}%`, site: '-', result: gOk ? 'Match' : 'Differs' })
      if (!gOk) add({ severity: 'High', title: 'GST rate differs from the order', detail: `Bill applies ${rec.gstRate}% GST; the order specifies ${po.gstRate}%.`, compared: [{ label: 'Bill', value: `${rec.gstRate}%`, source: docs.bill }, { label: 'Order', value: `${po.gstRate}%`, source: docs.po }], action: 'Confirm the applicable rate with the CA.' })
    }
    if (total !== bill.amount) add({ severity: 'High', title: 'Bill arithmetic does not add up', detail: `Lines + GST = ${money(total)}, but the bill total is ${money(bill.amount)}.`, compared: [{ label: 'Calculated', value: money(total), source: docs.bill }, { label: 'Bill total', value: money(bill.amount), source: docs.bill }], action: 'Ask the supplier for a corrected bill.' })
  }
  const expected = Math.round(expectedTaxable * (1 + (rec.gstRate || 0) / 100))
  const siteNeeded = mandatory.includes('site')
  const siteUnconfirmed = siteNeeded && site?.status !== 'Confirmed'
  if (rec.lines) {
    rows.push({
      field: 'Total payable', bill: money(bill.amount),
      po: po ? `${money(expected)} (agreed rate × ${siteUnconfirmed ? 'billed' : 'confirmed'} qty, incl. GST)` : '-',
      site: siteUnconfirmed ? 'Not confirmed' : '-',
      result: !po ? 'Unchecked' : siteUnconfirmed ? 'Unconfirmed' : expected === bill.amount ? 'Match' : 'Differs',
    })
  }

  // 5. Mandatory records
  const avail = recordAvailability(bill, mandatory)
  mandatory.forEach((k) => {
    if (avail[k] === 'available') return
    add({
      severity: 'High', mandatory: true,
      title: `${RECORD_LABEL[k]} ${avail[k] === 'pending' ? 'pending' : 'missing'}`,
      detail: k === 'site'
        ? `Site confirmation is required for ${bill.category} bills. An order alone does not prove the work, delivery or rental happened.${site?.requestedFrom ? ` Awaiting ${site.requestedFrom} (${site.role}).` : ''}`
        : `A ${RECORD_LABEL[k].toLowerCase()} is required for ${bill.category} bills.`,
      compared: [{ label: 'Status', value: avail[k], source: 'Document checklist' }],
      action: k === 'site' ? 'Request site confirmation.' : 'Request the missing document.',
    })
  })

  // 6. Possible duplicates
  others.filter((o) => o.id !== bill.id && norm(o.vendor) === norm(bill.vendor)).forEach((o) => {
    const sameNo = norm(o.billNo) === norm(bill.billNo)
    const samePeriod = rec.equipment && o.record?.equipment === rec.equipment && overlaps(rec.period, o.record?.period)
    const sameAmount = o.amount === bill.amount && Math.abs(new Date(o.date) - new Date(bill.date)) < 60 * 86400000
    if (!sameNo && !samePeriod && !sameAmount) return
    add({
      severity: 'High',
      title: 'Possible duplicate bill',
      detail: sameNo
        ? `Bill number ${bill.billNo} was already received (${o.id}).`
        : samePeriod
          ? `The hire period overlaps ${o.billNo} (${o.id}) for the same equipment, ${fmtPeriod(o.record.period)}. The same hours may be billed twice.`
          : `Same supplier and same amount as ${o.billNo} (${o.id}) within 60 days.`,
      compared: [
        { label: 'This bill', value: `${bill.billNo} · ${rec.period ? fmtPeriod(rec.period) : formatDate(bill.date)} · ${money(bill.amount)}`, source: docs.bill },
        { label: 'Earlier bill', value: `${o.billNo} · ${o.record?.period ? fmtPeriod(o.record.period) : formatDate(o.date)} · ${money(o.amount)} · ${o.verification}`, source: o.document || o.id },
      ],
      action: 'Check with the supplier and the site hour-meter log before verifying.',
    })
  })

  // 7. Advances paid against the order and not yet adjusted
  const advances = po?.advances || []
  const advance = advances.reduce((s, a) => s + a.amount - a.adjusted.reduce((t, x) => t + x.amount, 0), 0)
  if (advances.length) {
    rows.push({ field: 'Advance against order', bill: 'Not deducted on bill', po: `${money(advance)} unadjusted of ${money(advances.reduce((s, a) => s + a.amount, 0))} paid`, site: '-', result: advance ? 'Adjust' : 'Match' })
  }
  if (advance > 0) {
    add({
      severity: 'Medium',
      title: 'Advance paid against this order: deduct it from the payment',
      detail: `${money(advance)} was paid to the supplier in advance and has not been adjusted against any bill yet. The bill does not deduct it, so pay the net amount.`,
      compared: advances.map((a) => ({ label: a.purpose, value: `${money(a.amount)} paid ${formatDate(a.date)} · ${a.mode} ${a.reference}${a.adjusted.length ? ` · adjusted ${a.adjusted.map((x) => `${money(x.amount)} in ${x.billNo}`).join(', ')}` : ''}`, source: po.id })),
      amount: advance,
      action: `Adjust ${money(advance)} when forwarding the bill; the approver sees the net payable.`,
    })
  }

  const high = findings.filter((f) => f.severity === 'High')
  return {
    rows,
    findings,
    expected: rec.lines && po ? expected : null,
    difference: rec.lines && po ? bill.amount - expected : null,
    advanceBalance: advance,
    summary: high.length ? `${high.length} issue${high.length > 1 ? 's need' : ' needs'} review` : findings.length ? 'No issues; notes only' : 'No issues found',
    clean: high.length === 0,
  }
}
