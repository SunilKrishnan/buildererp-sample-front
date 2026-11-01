import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import DataTable from '../../components/DataTable.jsx'
import { Badge, Card } from '../../components/UI.jsx'
import { crewOf, siteOf } from '../../services/site.js'
import { addDays, todayISO } from '../../utils/date.js'
import { formatDate, formatDateShort } from '../../utils/format.js'
import { ConfirmDialog, Drawer, FormError, Locked } from '../store-keeper/shared.jsx'
import { attendanceOf, shortName, supData, useSupervisor, workersOf } from './shared.jsx'

const WORKING = ['Present', 'Half Day']

function AllocateDrawer({ t, ctx, d, date, onClose }) {
  const s = ctx.site.state
  const existing = d.allocationOf(t.id, date)
  const [ids, setIds] = useState(existing?.workerIds || [])
  const [instructions, setInstructions] = useState(existing?.instructions || '')
  const [reason, setReason] = useState('')
  const [confirming, setConfirming] = useState(false)
  const crew = workersOf(t.siteId)
  const teams = [...new Set(crew.map((w) => w.team))]
  const elsewhere = (id) => d.allocations.find((a) => a.date === date && a.taskId !== t.id && a.workerIds.includes(id))
  const att = (id) => attendanceOf(s, id, date)
  const available = (id) => (date > todayISO() || WORKING.includes(att(id)?.status)) && !elsewhere(id)
  const toggle = (id) => setIds(ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id])
  const need = crewOf(t.id)
  const byTrade = ids.reduce((m, id) => { const tr = crew.find((w) => w.id === id)?.trade; m[tr] = (m[tr] || 0) + 1; return m }, {})
  const save = () => { const ok = ctx.act('allocateWork', { taskId: t.id, date, workerIds: ids, instructions, reason }); setConfirming(false); if (ok) onClose() }

  return (
    <Drawer title={`${existing ? 'Change allocation' : 'Allocate workers'} · ${t.id}`} sub={`${t.title} · ${formatDate(date)}`} onClose={onClose} wide>
      <dl className="details">
        <dt>Work area</dt><dd>{shortName(siteOf(t.siteId)?.name)} · {t.location}</dd>
        <dt>Planned</dt><dd>{t.plannedQty} {t.unit} · {formatDate(t.start)} → {formatDate(t.deadline)} · <Badge>{t.priority}</Badge></dd>
        <dt>Done so far</dt><dd>{t.done} {t.unit} verified{t.position.pending ? `, ${t.position.pending} awaiting verification` : ''} · {t.position.open} {t.unit} open</dd>
        <dt>Crew planned by the engineer</dt><dd>{Object.entries(need).map(([tr, n]) => `${tr} ${n}`).join(', ') || 'Not specified'}</dd>
        <dt>Selected</dt><dd><b>{ids.length}</b> {Object.entries(byTrade).map(([tr, n]) => `${tr} ${n}`).join(', ')}</dd>
      </dl>
      <p className="cell-sub" style={{ whiteSpace: 'normal' }}><Locked>Planned quantity, dates and budget are set by the Site Engineer / Project Manager</Locked> You allocate the crew only.</p>
      {teams.map((team) => (
        <section key={team} className="drawer-section">
          <h3>{team}</h3>
          <div className="pm-picker">
            {crew.filter((w) => w.team === team).map((w) => {
              const a = att(w.id); const other = elsewhere(w.id)
              const dis = !available(w.id) && !ids.includes(w.id)
              return (
                <label key={w.id} className={`check-row ${dis ? 'muted' : ''}`}>
                  <input type="checkbox" checked={ids.includes(w.id)} disabled={dis} onChange={() => toggle(w.id)} />
                  <span>{w.name} <span className="cell-sub">· {w.trade} · {a ? a.status : date > todayISO() ? 'attendance not yet taken' : 'not marked'}{other ? ` · on ${other.taskId}` : ''}</span></span>
                </label>
              )
            })}
          </div>
        </section>
      ))}
      <div className="receipt-grid" style={{ padding: 0, marginTop: 12 }}>
        <label className="field span-2">Instructions to the crew<input value={instructions} onChange={(e) => setInstructions(e.target.value)} placeholder="e.g. Cover blocks 50 mm; finish grid A5 before lunch" /></label>
      </div>
      <div className="jv-submit" style={{ marginTop: 10 }}>
        <button className="btn btn-primary" disabled={!ids.length} onClick={() => setConfirming(true)}>Review & allocate</button>
        <button className="btn" onClick={onClose}>Cancel</button>
      </div>
      <FormError error={ctx.error} />
      {confirming && (
        <ConfirmDialog title={`Allocate ${ids.length} workers to ${t.id}?`} confirmLabel="Save allocation" onCancel={() => setConfirming(false)} onConfirm={save}>
          <p>{t.title}, {formatDate(date)}: {Object.entries(byTrade).map(([tr, n]) => `${n} ${tr}`).join(', ')}.</p>
          {existing && <label className="field">Reason for changing the allocation (required)<input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Two bar benders moved to the raft" /></label>}
        </ConfirmDialog>
      )}
    </Drawer>
  )
}

export default function Allocation({ notify }) {
  const ctx = useSupervisor(notify)
  const [params] = useSearchParams()
  const [date, setDate] = useState(todayISO())
  const [openId, setOpenId] = useState(params.get('task'))
  const d = supData(ctx, date)
  const open = d.tasks.filter((t) => t.status !== 'Completed' && t.start <= date)
  const upcoming = d.tasks.filter((t) => t.start > date && t.status !== 'Completed')
  const current = openId && d.tasks.find((t) => t.id === openId)
  const present = d.workers.filter((w) => WORKING.includes(attendanceOf(ctx.site.state, w.id, date)?.status))
  const free = present.filter((w) => !d.taskOfWorker(w.id))

  const columns = [
    { key: 'id', header: 'Task ID', render: (t) => <span className="cell-main">{t.id}</span> },
    { key: 'ps', header: 'Site / work area', render: (t) => <>{shortName(siteOf(t.siteId)?.name)}<div className="cell-sub">{t.location}</div></> },
    { key: 'desc', header: 'Task', render: (t) => <span className="wrap-cell"><b>{t.title}</b><div className="cell-sub">{t.description}</div></span> },
    { key: 'team', header: 'Assigned team / workers', render: (t) => { const a = d.allocationOf(t.id); return a ? <>{a.workerIds.length} workers<div className="cell-sub">{a.team}</div></> : <span className="cell-sub">Not allocated</span> } },
    { key: 'st', header: 'Start', render: (t) => formatDateShort(t.start) },
    { key: 'due', header: 'Due', render: (t) => <span className={t.status === 'Delayed' ? 'down' : ''}>{formatDateShort(t.deadline)}</span> },
    { key: 'q', header: 'Planned', align: 'num', render: (t) => `${t.plannedQty} ${t.unit}` },
    { key: 'p', header: 'Priority', render: (t) => <Badge>{t.priority}</Badge> },
    { key: 'ins', header: 'Instructions', render: (t) => <span className="cell-sub wrap-cell">{d.allocationOf(t.id)?.instructions || t.siteNote || '—'}</span> },
    { key: 's', header: 'Status', render: (t) => <Badge>{t.status}</Badge> },
    { key: 'x', header: '', render: (t) => (ctx.perms.supervise ? <button className={`btn btn-sm ${d.allocationOf(t.id) ? '' : 'btn-primary'}`} onClick={() => setOpenId(t.id)}>{d.allocationOf(t.id) ? 'Change' : 'Allocate'}</button> : <Locked>Site Supervisor</Locked>) },
  ]

  return (
    <>
      <div className="toolbar plain">
        <div className="filters">
          <label className="field">Allocation date<select value={date} onChange={(e) => setDate(e.target.value)}><option value={todayISO()}>Today ({formatDateShort(todayISO())})</option><option value={addDays(todayISO(), 1)}>Tomorrow ({formatDateShort(addDays(todayISO(), 1))})</option></select></label>
          <div className="field">Workers at work<div className="sk-readonly">{present.length} present · {free.length} not yet allocated</div></div>
        </div>
      </div>
      <Card title="Activities to allocate" sub="Approved activities assigned by the Site Engineer / Project Manager that are open on this date" bodyClass="">
        <DataTable dense rows={open} emptyText="No open activities on this date." columns={columns} />
      </Card>
      {free.length > 0 && (
        <Card title={<span className="title-with-count">Present but not allocated <span className="count-pill">{free.length}</span></span>} sub="Workers marked present on this date with no activity yet" bodyClass="card-body" className="section-gap">
          <div className="cell-sub" style={{ whiteSpace: 'normal' }}>{free.map((w) => `${w.name} (${w.trade})`).join(' · ')}</div>
        </Card>
      )}
      {upcoming.length > 0 && (
        <Card title="Starting later" sub="Not yet open for allocation on this date" bodyClass="" className="section-gap">
          <DataTable dense rows={upcoming} columns={columns.filter((c) => c.key !== 'x' && c.key !== 'team')} />
        </Card>
      )}
      {current && <AllocateDrawer key={`${current.id}-${date}`} t={current} ctx={ctx} d={d} date={date} onClose={() => setOpenId(null)} />}
    </>
  )
}
