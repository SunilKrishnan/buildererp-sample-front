/**
 * General ledger & trial balance from journal entries (pure functions).
 * Only Posted journals count. Balances are signed: debit positive, credit negative.
 * In the backend phase the server returns these figures; the shape stays the same.
 */

export function buildLedger(journals, accounts, { from, to }) {
  const posted = journals.filter((j) => j.status === 'Posted')
  const rows = accounts.map((a) => ({ ...a, opening: 0, debit: 0, credit: 0 }))
  const byCode = Object.fromEntries(rows.map((r) => [r.code, r]))
  posted.forEach((j) => {
    if (j.date > to) return
    j.lines.forEach((l) => {
      const r = byCode[l.account]
      if (!r) return
      if (j.date < from) r.opening += (l.dr || 0) - (l.cr || 0)
      else { r.debit += l.dr || 0; r.credit += l.cr || 0 }
    })
  })
  rows.forEach((r) => { r.closing = r.opening + r.debit - r.credit })
  const totalDr = rows.reduce((s, r) => s + Math.max(0, r.closing), 0)
  const totalCr = rows.reduce((s, r) => s + Math.max(0, -r.closing), 0)
  return { rows, totalDr, totalCr, balanced: Math.round(totalDr) === Math.round(totalCr) }
}

/** Entries for one account in [from, to], with opening and running balance. */
export function accountStatement(journals, code, { from, to }) {
  let opening = 0
  const lines = []
  journals
    .filter((j) => j.status === 'Posted' && j.date <= to)
    .sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id))
    .forEach((j) => {
      j.lines.filter((l) => l.account === code).forEach((l, i) => {
        const delta = (l.dr || 0) - (l.cr || 0)
        if (j.date < from) { opening += delta; return }
        lines.push({ id: `${j.id}-${i}`, date: j.date, journalId: j.id, narration: j.narration, source: j.source, debit: l.dr || 0, credit: l.cr || 0, delta })
      })
    })
  let run = opening
  lines.forEach((l) => { run += l.delta; l.balance = run })
  return { opening, closing: run, lines: lines.reverse() }
}

/** "₹ 1,20,000 Dr" style label for a signed balance. */
export const drCr = (n, fmt) => (Math.round(n) === 0 ? fmt(0) : `${fmt(Math.abs(n))} ${n > 0 ? 'Dr' : 'Cr'}`)
