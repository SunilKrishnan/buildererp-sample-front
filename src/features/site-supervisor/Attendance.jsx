import { useState } from 'react'
import DataTable from '../../components/DataTable.jsx'
import StatGrid from '../../components/StatGrid.jsx'
import { Badge, Card } from '../../components/UI.jsx'
import { ATTENDANCE_STATUSES, attendanceSummary, projectOf } from '../../services/site.js'
import { addDays, todayISO } from '../../utils/date.js'
import { formatDate } from '../../utils/format.js'
import { ConfirmDialog, FormError, Locked } from '../store-keeper/shared.jsx'
import { attendanceOf, useSupervisor, workersOf } from './shared.jsx'

const WORKING = ['Present', 'Half Day']

/** Editable muster for one site and date. Rows start from the saved records (or unmarked). */
function Muster({ ctx, siteId, date, area }) {
  const s = ctx.site.state
  const crew = workersOf(siteId)
  const initial = Object.fromEntries(crew.map((w) => {
    const r = attendanceOf(s, w.id, date)
    return [w.id, r ? { status: r.status, checkIn: r.checkIn, checkOut: r.checkOut, remarks: r.remarks } : { status: '', checkIn: '08:00', checkOut: '', remarks: '' }]
  }))
  const [rows, setRows] = useState(initial)
  const [confirming, setConfirming] = useState(false)
  const [reason, setReason] = useState('')
  const [error, setError] = useState('')
  const set = (id, k, v) => { setRows({ ...rows, [id]: { ...rows[id], [k]: v } }); setError('') }
  const shown = crew.filter((w) => area === 'all' || w.team === area)
  const marked = crew.filter((w) => rows[w.id].status)
  const changedStatus = marked.filter((w) => { const r = attendanceOf(s, w.id, date); return r && r.status !== rows[w.id].status })
  const count = (st) => marked.filter((w) => rows[w.id].status === st).length
  const editable = ctx.perms.attendance && date >= addDays(todayISO(), -7)
  const review = () => {
    if (!marked.length) { setError('Mark at least one worker.'); return }
    const bad = marked.find((w) => WORKING.includes(rows[w.id].status) && !rows[w.id].checkIn)
    if (bad) { setError(`Enter ${bad.name}'s check-in time.`); return }
    setConfirming(true)
  }
  const save = () => {
    const ok = ctx.act('saveAttendance', { siteId, date, reason, rows: marked.map((w) => ({ workerId: w.id, ...rows[w.id], workArea: w.team.replace(/ [AB]$/, '') })) })
    setConfirming(false)
    if (ok) setReason('')
  }

  return (
    <>
      <StatGrid items={[
        { label: 'Expected', value: crew.length, sub: 'Workers on the site list' },
        { label: 'Present', value: count('Present') },
        { label: 'Half day', value: count('Half Day') },
        { label: 'Absent', value: count('Absent'), tone: count('Absent') ? 'warning' : undefined },
        { label: 'On leave', value: count('On Leave') },
        { label: 'Not marked', value: crew.length - marked.length, tone: crew.length - marked.length ? 'warning' : undefined },
      ]} />
      <Card title={`Muster · ${formatDate(date)}`} sub="One record per worker, site and date. Saving again updates the same record; changing a saved status needs a reason." bodyClass=""
        action={editable ? <div className="cell-actions">
          <button className="btn btn-sm" onClick={() => setRows(Object.fromEntries(crew.map((w) => [w.id, rows[w.id].status ? rows[w.id] : { ...rows[w.id], status: 'Present' }])))}>Mark unmarked present</button>
          <button className="btn btn-sm btn-primary" onClick={review}>Review & save</button>
        </div> : <Locked>{ctx.perms.attendance ? 'Older than 7 days: corrections go through the Project Manager' : 'Recorded by the Site Supervisor'}</Locked>}>
        <DataTable dense rows={shown} emptyText="No workers in this work area." columns={[
          { key: 'w', header: 'Worker', render: (w) => <><div className="cell-main">{w.name}</div><div className="cell-sub">{w.id} · {w.trade}</div></> },
          { key: 't', header: 'Team / work area', render: (w) => <span className="cell-sub">{w.team}</span> },
          { key: 's', header: 'Status', render: (w) => (editable
            ? <select value={rows[w.id].status} onChange={(e) => set(w.id, 'status', e.target.value)} aria-label={`Attendance of ${w.name}`}><option value="">Not marked</option>{ATTENDANCE_STATUSES.map((x) => <option key={x}>{x}</option>)}</select>
            : <Badge>{rows[w.id].status || 'Not marked'}</Badge>) },
          { key: 'in', header: 'Check-in', render: (w) => (WORKING.includes(rows[w.id].status) ? (editable ? <input className="inline-input se-num" type="time" value={rows[w.id].checkIn} onChange={(e) => set(w.id, 'checkIn', e.target.value)} aria-label={`Check-in of ${w.name}`} /> : rows[w.id].checkIn) : '—') },
          { key: 'out', header: 'Check-out', render: (w) => (WORKING.includes(rows[w.id].status) ? (editable ? <input className="inline-input se-num" type="time" value={rows[w.id].checkOut} onChange={(e) => set(w.id, 'checkOut', e.target.value)} aria-label={`Check-out of ${w.name}`} /> : rows[w.id].checkOut || '—') : '—') },
          { key: 'r', header: 'Remarks', render: (w) => (editable ? <input className="inline-input" value={rows[w.id].remarks} onChange={(e) => set(w.id, 'remarks', e.target.value)} placeholder="e.g. late: bus delay" aria-label={`Remarks for ${w.name}`} /> : <span className="cell-sub">{rows[w.id].remarks || '—'}</span>) },
          { key: 'h', header: 'Saved', render: (w) => { const r = attendanceOf(s, w.id, date); return r ? <span className="cell-sub">{r.editedBy ? `edited by ${r.editedBy}` : `by ${r.markedBy}`}</span> : <span className="cell-sub">—</span> } },
        ]} />
        <div style={{ padding: '0 18px 12px' }}><FormError error={error || ctx.error} /></div>
      </Card>
      {confirming && (
        <ConfirmDialog title={`Save attendance for ${formatDate(date)}?`} confirmLabel="Save attendance" onCancel={() => setConfirming(false)} onConfirm={save}>
          <p>{count('Present')} present · {count('Half Day')} half day · {count('Absent')} absent · {count('On Leave')} on leave{crew.length - marked.length ? ` · ${crew.length - marked.length} not marked` : ''} (of {crew.length} expected).</p>
          {changedStatus.length > 0 && <>
            <p className="down">Changing saved status for {changedStatus.map((w) => w.name).join(', ')}.</p>
            <label className="field">Reason for the correction (required)<input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Arrived late after muster; confirmed by gang leader" /></label>
          </>}
          <p className="cell-sub">Attendance is shared with the Site Engineer and with Accounts for labour payroll. Nothing is paid from here.</p>
        </ConfirmDialog>
      )}
    </>
  )
}

export default function Attendance({ notify }) {
  const ctx = useSupervisor(notify)
  const [siteId, setSiteId] = useState(ctx.mySites[0]?.id || '')
  const [date, setDate] = useState(todayISO())
  const [area, setArea] = useState('all')
  const s = ctx.site.state
  const teams = [...new Set(workersOf(siteId).map((w) => w.team))]
  const history = Array.from({ length: 14 }, (_, i) => addDays(todayISO(), -i)).map((d) => ({ date: d, ...attendanceSummary(s, siteId, d) })).filter((r) => r.recorded || r.date === todayISO())
  const project = projectOf(ctx.mySites.find((x) => x.id === siteId)?.project === 'Palm Grove Villas' ? 'P-102' : 'P-101')

  return (
    <>
      <div className="toolbar plain">
        <div className="filters">
          <div className="field">Project<div className="sk-readonly">{project?.name}</div></div>
          <label className="field">Site<select value={siteId} onChange={(e) => { setSiteId(e.target.value); setArea('all') }}>{ctx.mySites.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select></label>
          <label className="field">Date<input type="date" max={todayISO()} value={date} onChange={(e) => setDate(e.target.value || todayISO())} /></label>
          <label className="field">Work area / team<select value={area} onChange={(e) => setArea(e.target.value)}><option value="all">All</option>{teams.map((t) => <option key={t}>{t}</option>)}</select></label>
        </div>
      </div>
      <Muster key={`${siteId}-${date}-${s.attendanceRecords.filter((a) => a.siteId === siteId && a.date === date).map((a) => a.status + a.checkIn + a.checkOut + a.remarks).join()}`} ctx={ctx} siteId={siteId} date={date} area={area} />
      <Card title="Attendance history" sub="Daily totals from saved musters (last 14 days). Click a date to open it." bodyClass="" className="section-gap">
        <DataTable dense rowKey="date" rows={history} emptyText="No attendance recorded." columns={[
          { key: 'date', header: 'Date', render: (r) => <button className="link-btn" onClick={() => setDate(r.date)}>{formatDate(r.date)}</button> },
          { key: 'e', header: 'Expected', align: 'num', render: (r) => r.expected },
          { key: 'p', header: 'Present', align: 'num', render: (r) => r.present },
          { key: 'h', header: 'Half day', align: 'num', render: (r) => r.halfDay },
          { key: 'a', header: 'Absent', align: 'num', render: (r) => r.absent },
          { key: 'l', header: 'On leave', align: 'num', render: (r) => r.onLeave },
          { key: 'n', header: 'Not marked', align: 'num', render: (r) => (r.notMarked ? <span className="down">{r.notMarked}</span> : 0) },
        ]} />
      </Card>
    </>
  )
}
