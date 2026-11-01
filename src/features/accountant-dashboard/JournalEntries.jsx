import { useMemo, useState } from 'react'
import DataTable from '../../components/DataTable.jsx'
import StatGrid from '../../components/StatGrid.jsx'
import { Badge, Card, Chips } from '../../components/UI.jsx'
import { accountStatement, buildLedger, drCr } from '../../services/ledger.js'
import { todayISO } from '../../utils/date.js'
import { formatDate, formatINR } from '../../utils/format.js'
import { LockedNote, SectionToolbar, UndoButton } from './shared.jsx'

export const BOOK_VIEWS = ['Journals', 'General ledger', 'Trial balance']
const ORIGINS = ['Manual', 'System', 'All']

function NewJournalForm({ accounts, onCreate }) {
  const blank = { date: todayISO(), narration: '', dr: '', cr: '', amount: '' }
  const [f, setF] = useState(blank)
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value })
  const amount = Number(f.amount)
  const error =
    !f.narration.trim() ? 'Add a narration explaining the adjustment'
      : !f.dr || !f.cr ? 'Choose the debit and credit accounts'
        : f.dr === f.cr ? 'Debit and credit accounts must differ'
          : !(amount > 0) ? 'Enter an amount above zero'
            : null
  const submit = (e) => {
    e.preventDefault()
    if (error) return
    onCreate({ date: f.date, narration: f.narration.trim(), lines: [{ account: f.dr, dr: amount }, { account: f.cr, cr: amount }] })
    setF(blank)
  }
  const options = accounts.map((a) => <option key={a.code} value={a.code}>{a.code} · {a.name}</option>)
  return (
    <form className="jv-form" onSubmit={submit}>
      <label className="field">Date<input type="date" value={f.date} max={todayISO()} onChange={set('date')} /></label>
      <label className="field grow">Narration<input value={f.narration} onChange={set('narration')} placeholder="e.g. Reclassify diesel bill to Equipment & fuel" /></label>
      <label className="field">Debit account<select value={f.dr} onChange={set('dr')}><option value="">Choose…</option>{options}</select></label>
      <label className="field">Credit account<select value={f.cr} onChange={set('cr')}><option value="">Choose…</option>{options}</select></label>
      <label className="field">Amount (₹)<input type="number" min="1" step="1" value={f.amount} onChange={set('amount')} /></label>
      <div className="jv-submit">
        <button className="btn btn-primary" type="submit" disabled={!!error} title={error || 'Saved as a draft on screen only'}>Save draft</button>
        {error && f.narration && <span className="cell-sub">{error}</span>}
      </div>
    </form>
  )
}

/** Journal entries, general ledger and trial balance. */
export default function JournalEntries({ accounts, journals, view = 'Journals', onViewChange, from, to, user, perms, onAct, onUndo, onCreateJournal }) {
  const [origin, setOrigin] = useState('Manual')
  const [code, setCode] = useState('1102')
  const nameOf = (c) => accounts.find((a) => a.code === c)?.name || c
  const ledger = useMemo(() => buildLedger(journals, accounts, { from, to }), [journals, accounts, from, to])
  const statement = useMemo(() => accountStatement(journals, code, { from, to }), [journals, code, from, to])

  const manual = journals.filter((j) => j.origin === 'Manual')
  const pending = manual.filter((j) => j.status === 'Pending Approval')
  const drafts = manual.filter((j) => j.status === 'Draft')
  const list = journals
    .filter((j) => origin === 'All' || j.origin === origin)
    .filter((j) => j.origin === 'Manual' || (j.date >= from && j.date <= to))
    .slice()
    .reverse()

  const action = (j) => {
    if (j.changed) return <UndoButton onClick={() => onUndo('journal', j)} />
    if (j.origin !== 'Manual') return <span className="cell-sub">Auto-posted</span>
    if (j.status === 'Draft') {
      if (!perms.canCreateJournal) return <LockedNote>View only</LockedNote>
      return <button className="btn btn-sm" onClick={() => onAct('journal', j, 'Pending Approval', `Demo: ${j.id} submitted for approval on screen only.`)}>Submit</button>
    }
    if (j.status === 'Pending Approval') {
      if (!perms.canPostJournal) return <LockedNote>Awaiting Admin approval</LockedNote>
      if (j.createdBy === user.name) return <LockedNote>Raised by you</LockedNote>
      return <button className="btn btn-sm btn-primary" onClick={() => onAct('journal', j, 'Posted', `Demo: ${j.id} posted to the ledger on screen only. Nothing saved.`)}>Approve & post</button>
    }
    return <span className="cell-sub">{j.approvedBy ? `Approved by ${j.approvedBy}` : '-'}</span>
  }

  return (
    <>
      <StatGrid
        items={[
          { label: 'Manual journals awaiting approval', value: pending.length, tone: pending.length ? 'warning' : undefined },
          { label: 'Drafts', value: drafts.length, sub: 'Not yet submitted' },
          { label: 'Entries in period', value: journals.filter((j) => j.status === 'Posted' && j.date >= from && j.date <= to).length, sub: 'Posted journals' },
          { label: 'Trial balance', value: ledger.balanced ? 'Balanced' : 'Not balanced', sub: `Dr ${formatINR(ledger.totalDr)} · Cr ${formatINR(ledger.totalCr)}`, tone: ledger.balanced ? 'success' : 'danger' },
        ]}
      />

      <Card title="Books of Account" sub="System entries post automatically from receipts, bills and payments. Manual journals need approval before posting." bodyClass="" className="mb">
        <SectionToolbar statuses={BOOK_VIEWS} status={view} onStatusChange={onViewChange} />

        {view === 'Journals' && (
          <>
            {perms.canCreateJournal && (
              <div className="sub-panel">
                <div className="sub-panel-head"><b>New adjustment entry</b><span className="cell-sub">Saved as a draft on this screen only</span></div>
                <NewJournalForm accounts={accounts} onCreate={onCreateJournal} />
              </div>
            )}
            <div className="toolbar plain"><Chips options={ORIGINS} value={origin} onChange={setOrigin} /><span className="cell-sub">System entries shown for the selected date range</span></div>
            <DataTable
              dense
              rows={list}
              limit={50}
              emptyText="No journal entries match."
              columns={[
                { key: 'id', header: 'Entry', render: (j) => <><div className="cell-main">{j.id}</div><div className="cell-sub">{formatDate(j.date)}</div></> },
                { key: 'narration', header: 'Narration', render: (j) => <><div className="wrap-cell">{j.narration}</div><div className="cell-sub">{j.source}{j.ref && j.ref !== '-' ? ` · ${j.ref}` : ''}{j.createdBy ? ` · by ${j.createdBy}` : ''}</div></> },
                {
                  key: 'lines', header: 'Debit / credit',
                  render: (j) => (
                    <div className="jv-lines">
                      {j.lines.map((l, i) => (
                        <div key={i} className={l.dr ? 'dr' : 'cr'}>
                          <span>{l.dr ? 'Dr' : 'Cr'}</span> {nameOf(l.account)} <b>{formatINR(l.dr || l.cr)}</b>
                        </div>
                      ))}
                    </div>
                  ),
                },
                { key: 'status', header: 'Status', render: (j) => <Badge>{j.status}</Badge> },
                { key: 'actions', header: 'Action', render: action },
              ]}
            />
          </>
        )}

        {view === 'General ledger' && (
          <>
            <div className="toolbar plain">
              <label className="field inline">
                Account
                <select value={code} onChange={(e) => setCode(e.target.value)}>
                  {accounts.map((a) => <option key={a.code} value={a.code}>{a.code} · {a.name}</option>)}
                </select>
              </label>
              <span className="cell-sub">Opening {drCr(statement.opening, formatINR)} · Closing {drCr(statement.closing, formatINR)}</span>
            </div>
            <DataTable
              dense
              rows={statement.lines}
              limit={60}
              emptyText="No posted entries for this account in the selected range."
              columns={[
                { key: 'date', header: 'Date', render: (l) => formatDate(l.date) },
                { key: 'journalId', header: 'Entry' },
                { key: 'narration', header: 'Narration', render: (l) => <><div className="wrap-cell">{l.narration}</div><div className="cell-sub">{l.source}</div></> },
                { key: 'debit', header: 'Debit', align: 'num', render: (l) => (l.debit ? formatINR(l.debit) : '') },
                { key: 'credit', header: 'Credit', align: 'num', render: (l) => (l.credit ? formatINR(l.credit) : '') },
                { key: 'balance', header: 'Balance', align: 'num', render: (l) => drCr(l.balance, formatINR) },
              ]}
            />
          </>
        )}

        {view === 'Trial balance' && (
          <DataTable
            dense
            rowKey="code"
            rows={ledger.rows.filter((r) => r.opening || r.debit || r.credit)}
            columns={[
              { key: 'code', header: 'Code' },
              { key: 'name', header: 'Account', render: (r) => <button className="link-btn" onClick={() => { setCode(r.code); onViewChange('General ledger') }}>{r.name}</button> },
              { key: 'type', header: 'Type', render: (r) => <span className="cell-sub">{r.type}</span> },
              { key: 'opening', header: 'Opening', align: 'num', render: (r) => drCr(r.opening, formatINR) },
              { key: 'debit', header: 'Debits', align: 'num', render: (r) => formatINR(r.debit) },
              { key: 'credit', header: 'Credits', align: 'num', render: (r) => formatINR(r.credit) },
              { key: 'dr', header: 'Closing Dr', align: 'num', render: (r) => (r.closing > 0 ? formatINR(r.closing) : '') },
              { key: 'cr', header: 'Closing Cr', align: 'num', render: (r) => (r.closing < 0 ? formatINR(-r.closing) : '') },
            ]}
          />
        )}
        {view === 'Trial balance' && (
          <div className="table-more tb-total">
            Totals: Dr {formatINR(ledger.totalDr)} · Cr {formatINR(ledger.totalCr)} · <Badge tone={ledger.balanced ? 'success' : 'danger'}>{ledger.balanced ? 'Balanced' : 'Not balanced'}</Badge>
          </div>
        )}
      </Card>
    </>
  )
}
