import { useState } from 'react'
import DataTable from '../../components/DataTable.jsx'
import StatGrid from '../../components/StatGrid.jsx'
import { Badge, Card } from '../../components/UI.jsx'
import { labour as WORKERS } from '../../data/mockData.js'
import { PPE_ITEMS } from '../../data/demo/safetyDemo.js'
import { workerOf } from '../../services/site.js'
import { addDays, todayISO } from '../../utils/date.js'
import { formatDate } from '../../utils/format.js'
import { FormError, Locked } from '../store-keeper/shared.jsx'
import { siteName, useSafety } from './shared.jsx'

const PAGE = 20

export default function PPE({ notify, search }) {
  const ctx = useSafety(notify)
  const s = ctx.s
  const [item, setItem] = useState('all')
  const [status, setStatus] = useState('all')
  const [page, setPage] = useState(0)
  const [note, setNote] = useState({})
  const [iss, setIss] = useState({ workerId: '', item: 'Safety helmet', issueDate: todayISO(), replaceBy: addDays(todayISO(), 365) })
  const [chk, setChk] = useState({ siteId: 'S-01', workArea: '', observed: '', compliant: '', notes: '' })
  const q = (search || '').toLowerCase()
  const rows = (s.ppeRecords || []).map((r) => ({ ...r, w: workerOf(r.workerId) }))
    .filter((r) => (item === 'all' || r.item === item) && (status === 'all' || r.status === status))
    .filter((r) => !q || `${r.workerId} ${r.w?.name} ${r.item}`.toLowerCase().includes(q))
    .sort((a, b) => (a.status === 'Issued' ? 1 : 0) - (b.status === 'Issued' ? 1 : 0) || a.workerId.localeCompare(b.workerId))
  const pages = Math.max(1, Math.ceil(rows.length / PAGE))
  const checks = [...(s.ppeChecks || [])].sort((a, b) => b.date.localeCompare(a.date))
  const latest = checks[0]
  const due = (s.ppeRecords || []).filter((r) => ['Replacement due', 'Replacement needed'].includes(r.status))
  // Workers on site with no harness record although their trade works at height
  const noHarness = WORKERS.filter((w) => w.siteId === 'S-01' && ['Bar Bender', 'Carpenter', 'Welder'].includes(w.trade) && !(s.ppeRecords || []).some((r) => r.workerId === w.id && r.item === 'Safety harness' && r.status !== 'Returned'))

  return (
    <>
      <div className="info-note"><span>ℹ</span><div>Issue records show what each worker was given; they do <b>not</b> prove PPE is worn. Compliance below comes only from field checks. Stock of PPE stays with the Store Keeper.</div></div>
      <StatGrid items={[
        { label: 'Field compliance (latest check)', value: latest ? `${Math.round((latest.compliant / latest.observed) * 100)}%` : '—', sub: latest ? `${latest.compliant}/${latest.observed} seen wearing PPE, ${formatDate(latest.date)}` : 'No check yet', tone: latest && latest.compliant < latest.observed ? 'warning' : undefined },
        { label: 'Replacement due / needed', value: due.length, tone: due.length ? 'warning' : undefined },
        { label: 'At-height workers without a harness record', value: noHarness.length, sub: noHarness.map((w) => w.name).join(', ') || 'None', tone: noHarness.length ? 'danger' : undefined },
        { label: 'Issue records', value: (s.ppeRecords || []).length },
      ]} />

      <Card title="PPE field compliance checks" sub="Workers observed at a work front and how many wore the required PPE" bodyClass="" className="mb">
        <DataTable dense rows={checks} emptyText="No checks recorded." columns={[
          { key: 'd', header: 'Date', render: (c) => formatDate(c.date) }, { key: 's', header: 'Site / area', render: (c) => <>{siteName(c.siteId)}<div className="cell-sub">{c.workArea}</div></> },
          { key: 'i', header: 'PPE checked', render: (c) => c.item }, { key: 'o', header: 'Observed', align: 'num', render: (c) => c.observed }, { key: 'c', header: 'Compliant', align: 'num', render: (c) => c.compliant },
          { key: 'p', header: '%', align: 'num', render: (c) => <b className={c.compliant < c.observed ? 'down' : ''}>{Math.round((c.compliant / c.observed) * 100)}%</b> }, { key: 'n', header: 'Notes', render: (c) => <span className="cell-sub">{c.notes || '—'}</span> }, { key: 'b', header: 'By', render: (c) => c.by },
        ]} />
        {ctx.perms.manage && (
          <div className="receipt-grid se-grid-4" style={{ padding: 14 }}>
            <label className="field">Work area<input value={chk.workArea} onChange={(e) => setChk({ ...chk, workArea: e.target.value })} placeholder="e.g. F7–F10" /></label>
            <label className="field">Workers observed<input type="number" min="1" value={chk.observed} onChange={(e) => setChk({ ...chk, observed: e.target.value })} /></label>
            <label className="field">Wearing required PPE<input type="number" min="0" value={chk.compliant} onChange={(e) => setChk({ ...chk, compliant: e.target.value })} /></label>
            <label className="field">What was missing<input value={chk.notes} onChange={(e) => setChk({ ...chk, notes: e.target.value })} /></label>
            <div className="field"><button className="btn btn-sm btn-primary" onClick={() => ctx.act('recordPPECheck', chk) && setChk({ ...chk, observed: '', compliant: '', notes: '' })}>Record check</button></div>
          </div>
        )}
      </Card>

      <Card title="PPE issued to workers" sub="Workers from the company worker register (no separate list)" bodyClass=""
        action={!ctx.perms.manage && <Locked>View only</Locked>}>
        <div className="toolbar"><div className="filters">
          <label className="field">Item<select value={item} onChange={(e) => { setItem(e.target.value); setPage(0) }}><option value="all">All</option>{PPE_ITEMS.map((x) => <option key={x}>{x}</option>)}</select></label>
          <label className="field">Status<select value={status} onChange={(e) => { setStatus(e.target.value); setPage(0) }}><option value="all">All</option>{['Issued', 'Replacement due', 'Replacement needed', 'Returned', 'Lost'].map((x) => <option key={x}>{x}</option>)}</select></label>
        </div></div>
        <DataTable dense rows={rows.slice(page * PAGE, page * PAGE + PAGE)} emptyText="No PPE records match." columns={[
          { key: 'w', header: 'Worker', render: (r) => <><div className="cell-main">{r.w?.name}</div><div className="cell-sub">{r.workerId} · {r.w?.trade}</div></> },
          { key: 's', header: 'Project / site', render: (r) => siteName(r.siteId) },
          { key: 'i', header: 'PPE item', render: (r) => r.item }, { key: 'd', header: 'Issued', render: (r) => formatDate(r.issued) },
          { key: 'c', header: 'Condition', render: (r) => <Badge tone={r.condition === 'Good' ? 'success' : 'warning'}>{r.condition}</Badge> },
          { key: 'rb', header: 'Replace by', render: (r) => (r.replaceBy ? <span className={r.replaceBy < ctx.today ? 'down' : ''}>{formatDate(r.replaceBy)}</span> : '—') },
          { key: 'st', header: 'Status', render: (r) => <Badge>{r.status}</Badge> },
          { key: 'x', header: '', render: (r) => (ctx.perms.manage && !['Returned', 'Lost'].includes(r.status) ? (
            <div className="cell-actions">
              <input className="inline-input" placeholder="Reason" value={note[r.id] || ''} onChange={(e) => setNote({ ...note, [r.id]: e.target.value })} aria-label={`Reason for ${r.id}`} />
              <button className="btn btn-sm" onClick={() => ctx.act('updatePPE', { id: r.id, condition: 'Damaged', note: note[r.id] })}>Damaged</button>
              <button className="btn btn-sm" onClick={() => ctx.act('updatePPE', { id: r.id, status: 'Returned', note: note[r.id] })}>Returned</button>
            </div>
          ) : null) },
        ]} />
        <div className="cell-actions" style={{ padding: '10px 18px' }}><span className="cell-sub">{rows.length} records · page {page + 1} of {pages}</span><button className="btn btn-sm" disabled={!page} onClick={() => setPage(page - 1)}>Previous</button><button className="btn btn-sm" disabled={page >= pages - 1} onClick={() => setPage(page + 1)}>Next</button></div>
        {ctx.perms.manage && (
          <div className="receipt-grid se-grid-4" style={{ padding: 14 }}>
            <label className="field">Worker<select value={iss.workerId} onChange={(e) => setIss({ ...iss, workerId: e.target.value })}><option value="">Select…</option>{WORKERS.filter((w) => w.siteId).map((w) => <option key={w.id} value={w.id}>{w.name} ({w.id}, {w.trade})</option>)}</select></label>
            <label className="field">Item<select value={iss.item} onChange={(e) => setIss({ ...iss, item: e.target.value })}>{PPE_ITEMS.map((x) => <option key={x}>{x}</option>)}</select></label>
            <label className="field">Issue date<input type="date" max={todayISO()} value={iss.issueDate} onChange={(e) => setIss({ ...iss, issueDate: e.target.value })} /></label>
            <label className="field">Replace by (if applicable)<input type="date" value={iss.replaceBy} onChange={(e) => setIss({ ...iss, replaceBy: e.target.value })} /></label>
            <div className="field"><button className="btn btn-sm btn-primary" onClick={() => ctx.act('issuePPE', iss) && setIss({ ...iss, workerId: '' })}>Record issue</button></div>
          </div>
        )}
        <div style={{ padding: '0 18px 12px' }}><FormError error={ctx.error} /></div>
      </Card>
    </>
  )
}
