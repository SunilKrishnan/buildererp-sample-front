import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import DataTable from '../../components/DataTable.jsx'
import { Badge, Card } from '../../components/UI.jsx'
import { ATTENDANCE_STATUSES, siteOf } from '../../services/site.js'
import { attendanceOf, shortName, supData, useSupervisor } from './shared.jsx'

const PAGE = 15

/** Workers on the supervised sites from the one worker register (no copies), with today's attendance and task. */
export default function Labour({ notify, search }) {
  const ctx = useSupervisor(notify)
  const d = supData(ctx)
  const [params] = useSearchParams()
  const [trade, setTrade] = useState('all')
  const [siteId, setSiteId] = useState('all')
  const [status, setStatus] = useState(params.get('status') || 'all')
  const [q, setQ] = useState('')
  const [sort, setSort] = useState('name')
  const [page, setPage] = useState(0)
  const s = ctx.site.state
  const text = `${q} ${search || ''}`.trim().toLowerCase()
  const rows = d.workers.map((w) => {
    const att = attendanceOf(s, w.id, d.date)
    const alloc = d.taskOfWorker(w.id)
    return { ...w, att, status: att?.status || 'Not marked', task: alloc ? d.tasks.find((t) => t.id === alloc.taskId) : null }
  })
    .filter((w) => (trade === 'all' || w.trade === trade) && (siteId === 'all' || w.siteId === siteId))
    // "Absent" from the overview card also covers workers on leave
    .filter((w) => status === 'all' || w.status === status || (status === 'Absent' && w.status === 'On Leave') || (status === 'Present' && w.status === 'Half Day'))
    .filter((w) => !text || `${w.id} ${w.name} ${w.trade} ${w.team}`.toLowerCase().includes(text))
    .sort((a, b) => String(a[sort]).localeCompare(String(b[sort])))
  const pages = Math.max(1, Math.ceil(rows.length / PAGE))
  const shown = rows.slice(page * PAGE, page * PAGE + PAGE)
  const reset = (fn) => (e) => { fn(e.target.value); setPage(0) }

  return (
    <Card title="Workers on your site" sub="From the company worker register. Wages and payroll stay with Accounts." bodyClass="">
      <div className="toolbar">
        <div className="filters">
          <label className="field">Search worker<input value={q} onChange={reset(setQ)} placeholder="Name or ID" /></label>
          <label className="field">Trade<select value={trade} onChange={reset(setTrade)}><option value="all">All</option>{[...new Set(d.workers.map((w) => w.trade))].map((t) => <option key={t}>{t}</option>)}</select></label>
          <label className="field">Site<select value={siteId} onChange={reset(setSiteId)}><option value="all">All</option>{ctx.mySites.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select></label>
          <label className="field">Attendance today<select value={status} onChange={reset(setStatus)}><option value="all">All</option>{[...ATTENDANCE_STATUSES, 'Not marked'].map((t) => <option key={t}>{t}</option>)}</select></label>
          <label className="field">Sort by<select value={sort} onChange={(e) => setSort(e.target.value)}><option value="name">Name</option><option value="trade">Trade</option><option value="team">Team</option><option value="status">Attendance</option></select></label>
        </div>
      </div>
      <DataTable dense rows={shown} emptyText="No workers match these filters." columns={[
        { key: 'n', header: 'Worker', render: (w) => <><div className="cell-main">{w.name}</div><div className="cell-sub">{w.id} · {w.contractor}</div></> },
        { key: 't', header: 'Trade', render: (w) => w.trade },
        { key: 'tm', header: 'Team', render: (w) => w.team },
        { key: 's', header: 'Project / site', render: (w) => <>Sunrise Heights<div className="cell-sub">{shortName(siteOf(w.siteId)?.name)}</div></> },
        { key: 'a', header: 'Attendance today', render: (w) => <><Badge>{w.status}</Badge>{w.att?.checkIn && <div className="cell-sub">{w.att.checkIn}{w.att.checkOut ? `–${w.att.checkOut}` : ''}</div>}</> },
        { key: 'k', header: 'Assigned task', render: (w) => (w.task ? <span className="wrap-cell">{w.task.id}<div className="cell-sub">{w.task.title}</div></span> : <span className="cell-sub">—</span>) },
        { key: 'r', header: 'Supervisor remarks', render: (w) => <span className="cell-sub">{w.att?.remarks || '—'}</span> },
      ]} />
      <div className="cell-actions" style={{ padding: '10px 18px' }}>
        <span className="cell-sub">{rows.length} worker{rows.length === 1 ? '' : 's'} · page {page + 1} of {pages}</span>
        <button className="btn btn-sm" disabled={page === 0} onClick={() => setPage(page - 1)}>Previous</button>
        <button className="btn btn-sm" disabled={page >= pages - 1} onClick={() => setPage(page + 1)}>Next</button>
      </div>
    </Card>
  )
}
