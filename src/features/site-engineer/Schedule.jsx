import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import DataTable from '../../components/DataTable.jsx'
import Tabs from '../../components/Tabs.jsx'
import { Badge, Card, Progress } from '../../components/UI.jsx'
import { MR } from '../../services/inventory.js'
import { crewOf, pmOf, siteOf, supervisorOf, TASK_NOTE_KINDS } from '../../services/site.js'
import { addDays, todayISO } from '../../utils/date.js'
import { formatDate, formatDateShort } from '../../utils/format.js'
import { Drawer, fmtQty, fmtStamp, FormError, Locked } from '../store-keeper/shared.jsx'
import { siteData } from './derive.js'
import { PhotoInput, PhotoStrip, useSiteEngineer } from './shared.jsx'

const STATUSES = ['Not Started', 'In Progress', 'Blocked', 'Delayed', 'Completed']
const PRIORITIES = ['Normal', 'High']
const statusTone = (s) => ({ Delayed: 'danger', Blocked: 'warning', Completed: 'success', 'In Progress': 'info' }[s] || 'muted')
const team = (t) => {
  const crew = Object.entries(crewOf(t.id)).map(([trade, n]) => `${trade} ${n}`).join(', ')
  return { lead: supervisorOf(t.siteId) || '—', crew: crew || 'Crew not planned' }
}

function TaskDrawer({ t, ctx, d, onClose, go }) {
  const [f, setF] = useState({ delayReason: t.delayReason, correctiveAction: t.correctiveAction, siteNote: t.siteNote })
  const [obs, setObs] = useState({ kind: t.blocker ? 'Observation' : 'Observation', text: '', photos: [] })
  const [clar, setClar] = useState('')
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value })
  const tm = team(t)
  const requests = d.requests.filter((r) => r.taskId === t.id)
  const saveObs = () => { if (ctx.act('addTaskObservation', { id: t.id, ...obs })) setObs({ kind: 'Observation', text: '', photos: [] }) }
  const ask = () => { if (ctx.act('sendClarification', { projectId: t.projectId, siteId: t.siteId, subject: `${t.id}: ${t.title}`, text: clar, ref: t.id })) setClar('') }
  return (
    <Drawer title={`${t.id} · ${t.title}`} sub={`${siteOf(t.siteId)?.name} · ${t.location}`} onClose={onClose} wide>
      {t.blocker && <div className="info-note warn"><span>⚠</span><div><b>Blocker:</b> {t.blocker}</div></div>}
      <dl className="details">
        <dt>Description</dt><dd>{t.description}</dd>
        <dt>Assigned by</dt><dd>{t.assignedBy} (Project Manager)</dd>
        <dt>Team</dt><dd>{tm.lead} (Site Supervisor) · {tm.crew}</dd>
        <dt>Planned</dt><dd>{formatDate(t.start)} → {formatDate(t.deadline)}</dd>
        <dt>Quantity</dt><dd>{t.done} of {t.plannedQty} {t.unit} ({t.pct}%) · planned by today {t.plannedToDate} · BOQ {t.boqId}</dd>
        <dt>Priority / status</dt><dd><Badge>{t.priority}</Badge> <Badge tone={statusTone(t.status)}>{t.status}</Badge></dd>
        <dt>Depends on</dt><dd>{t.dependsOn.length ? t.dependsOn.join(', ') : 'None'}{t.blockedBy.length ? <span className="down"> · waiting for {t.blockedBy.join(', ')}</span> : ''}</dd>
        {t.milestone && <><dt>Milestone</dt><dd>{t.milestone}</dd></>}
        <dt>Material requests</dt><dd>{requests.length ? requests.map((r) => `${r.id} ${fmtQty(r.requested, r.material.unit)} ${r.material.name} (${r.status})`).join('; ') : 'None linked'}</dd>
      </dl>
      <p className="cell-sub" style={{ marginTop: 10, whiteSpace: 'normal' }}><Locked>Dates, planned quantity and budget are set by the Project Manager</Locked> Completed quantity comes only from your submitted daily progress reports, so the approved schedule never changes silently.</p>
      {ctx.perms.work ? (
        <>
          <div className="cell-actions" style={{ marginTop: 12 }}>
            <button className="btn btn-primary btn-sm" onClick={() => go('progress', `new=1&task=${t.id}`)}>Record progress</button>
            <button className="btn btn-sm" onClick={() => go('materials', `new=1&task=${t.id}`)} disabled={!ctx.perms.request}>Request material</button>
            <button className="btn btn-sm" onClick={() => go('issues', `new=1&task=${t.id}`)}>Raise as site issue</button>
          </div>

          <section className="drawer-section">
            <h3>Observations, blockers & photos</h3>
            <div className="receipt-grid" style={{ padding: 0 }}>
              <label className="field">Type<select value={obs.kind} onChange={(e) => setObs({ ...obs, kind: e.target.value })}>{TASK_NOTE_KINDS.filter((k) => k !== 'Blocker cleared' || t.blocker).map((k) => <option key={k}>{k}</option>)}</select></label>
              <label className="field span-2">{obs.kind === 'Blocker' ? 'What is blocking the work' : 'What you observed'}<input value={obs.text} onChange={(e) => setObs({ ...obs, text: e.target.value })} placeholder={obs.kind === 'Blocker' ? 'e.g. Remaining steel delivery pending; rebar gang idle' : 'e.g. Cover blocks short on grid A6; corrected before pour'} /></label>
              <PhotoInput label="Site photos (demo: kept in this tab only)" value={obs.photos} onChange={(photos) => setObs({ ...obs, photos })} />
            </div>
            <button className="btn btn-sm" style={{ marginTop: 8 }} onClick={saveObs}>Save {obs.kind.toLowerCase()}</button>
            {(t.observations || []).length > 0 && (
              <ol className="audit-list" style={{ marginTop: 10 }}>
                {t.observations.map((o, i) => <li key={i}><span className="cell-sub">{fmtStamp(o.at)}</span> <Badge tone={o.kind === 'Blocker' ? 'danger' : 'muted'}>{o.kind}</Badge> <b>{o.by}</b><div>{o.text}</div><PhotoStrip photos={o.photos} /></li>)}
              </ol>
            )}
          </section>

          <form className="receipt-form drawer-section" onSubmit={(e) => { e.preventDefault(); ctx.act('updateTaskNotes', { id: t.id, ...f }) }}>
            <div className="sub-panel-head"><b>Delay notes</b><span className="cell-sub">Visible to the Project Manager in their delay review</span></div>
            <div className="receipt-grid">
              <label className="field span-2">Reason for delay{t.status === 'Delayed' ? ' (required)' : ''}<input value={f.delayReason} onChange={set('delayReason')} /></label>
              <label className="field span-2">Proposed corrective action{t.status === 'Delayed' ? ' (required)' : ''}<input value={f.correctiveAction} onChange={set('correctiveAction')} /></label>
              <label className="field span-2">Site note<input value={f.siteNote} onChange={set('siteNote')} placeholder="e.g. F7 rebar inspection booked for tomorrow 9 am" /></label>
            </div>
            <div className="jv-submit"><button className="btn btn-sm" type="submit">Save delay notes</button></div>
            {t.pmReview && <p className="cell-sub">PM review: {t.pmReview.accepted ? 'accepted' : 'not accepted'} by {t.pmReview.by}: {t.pmReview.note}</p>}
          </form>

          <section className="drawer-section">
            <h3>Request clarification from the Project Manager</h3>
            <label className="field">Question for {pmOf(t.projectId)}<input value={clar} onChange={(e) => setClar(e.target.value)} placeholder="e.g. Can raft pour A5–A6 start before S-102 R1 is approved?" /></label>
            <button className="btn btn-sm" style={{ marginTop: 8 }} onClick={ask}>Send clarification</button>
            <span className="cell-sub"> Answers appear under Instructions & clarifications. Demo: nothing is emailed.</span>
          </section>
          <FormError error={ctx.error} />
        </>
      ) : <Locked>View only</Locked>}
    </Drawer>
  )
}

export default function Schedule({ notify, go, search }) {
  const ctx = useSiteEngineer(notify)
  const d = siteData(ctx)
  const [params] = useSearchParams()
  const [view, setView] = useState('list')
  const [day, setDay] = useState(todayISO())
  const [status, setStatus] = useState(params.get('status') || 'all')
  const [project, setProject] = useState('all')
  const [siteId, setSiteId] = useState('all')
  const [priority, setPriority] = useState('all')
  const [from, setFrom] = useState(params.get('due') === 'today' ? todayISO() : '')
  const [to, setTo] = useState(params.get('due') === 'today' ? todayISO() : '')
  const [openId, setOpenId] = useState(params.get('task'))
  const q = (search || '').toLowerCase()
  const tasks = d.tasks
    .filter((t) => (status === 'all' || t.status === status) && (project === 'all' || t.projectId === project) && (siteId === 'all' || t.siteId === siteId) && (priority === 'all' || t.priority === priority))
    // Date filter: tasks DUE within the range
    .filter((t) => (!from || t.deadline >= from) && (!to || t.deadline <= to))
    .filter((t) => !q || `${t.id} ${t.title} ${t.location}`.toLowerCase().includes(q))
  const filtered = status !== 'all' || project !== 'all' || siteId !== 'all' || priority !== 'all' || from || to
  const clear = () => { setStatus('all'); setProject('all'); setSiteId('all'); setPriority('all'); setFrom(''); setTo('') }
  // Planned on that day, plus delayed work still being finished (from today on)
  const onDay = (date) => tasks.filter((t) => (t.start <= date && t.deadline >= date) || (t.status === 'Delayed' && date >= todayISO()))
  const current = openId && d.tasks.find((t) => t.id === openId)
  const week = Array.from({ length: 7 }, (_, i) => addDays(day, i))

  return (
    <>
      {d.delayed.length > 0 && (
        <div className="info-note warn"><span>⚠</span><div><b>{d.delayed.length} overdue {d.delayed.length > 1 ? 'tasks' : 'task'}:</b> {d.delayed.map((t) => `${t.id} ${t.title} (${t.daysLate}d late${t.delayReason ? `: ${t.delayReason}` : ', reason not given'})`).join('; ')}</div></div>
      )}
      <div className="toolbar plain">
        <div className="filters">
          <label className="field">Project<select value={project} onChange={(e) => setProject(e.target.value)}><option value="all">All assigned</option>{ctx.myProjects.map((p) => <option key={p.id} value={p.id}>{p.short}</option>)}</select></label>
          <label className="field">Site<select value={siteId} onChange={(e) => setSiteId(e.target.value)}><option value="all">All assigned</option>{ctx.mySites.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
          <label className="field">Status<select value={status} onChange={(e) => setStatus(e.target.value)}><option value="all">All</option>{STATUSES.map((s) => <option key={s} value={s}>{s === 'Delayed' ? 'Delayed (overdue)' : s}</option>)}</select></label>
          <label className="field">Priority<select value={priority} onChange={(e) => setPriority(e.target.value)}><option value="all">All</option>{PRIORITIES.map((s) => <option key={s}>{s}</option>)}</select></label>
          <label className="field">Due from<input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></label>
          <label className="field">Due to<input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></label>
          {filtered && <button className="btn btn-sm" style={{ alignSelf: 'flex-end' }} onClick={clear}>Clear filters</button>}
        </div>
      </div>
      <Tabs value={view} onChange={setView} label="Schedule view" tabs={[{ id: 'list', label: 'Task list' }, { id: 'daily', label: 'Daily' }, { id: 'weekly', label: 'Weekly' }, { id: 'monthly', label: 'Monthly' }]} />

      {view === 'list' && (
        <Card title="Assigned tasks" sub="Assigned by the Project Manager. Click a task to record progress, observations, photos and blockers, or to ask for clarification." bodyClass="">
          <DataTable dense rows={tasks} emptyText={filtered ? 'No tasks match these filters.' : 'No tasks assigned yet.'} columns={[
            { key: 'id', header: 'Task ID', render: (t) => <button className="link-btn" onClick={() => setOpenId(t.id)}>{t.milestone ? '◆ ' : ''}{t.id}</button> },
            { key: 'ps', header: 'Project / site', render: (t) => <>{ctx.myProjects.find((p) => p.id === t.projectId)?.short}<div className="cell-sub">{siteOf(t.siteId)?.name.split(': ')[1]} · {t.location}</div></> },
            { key: 't', header: 'Work activity', render: (t) => <span className="wrap-cell">{t.title}{t.blocker && <div className="cell-sub down">Blocker: {t.blocker}</div>}</span> },
            { key: 'team', header: 'Team / supervisor', render: (t) => { const tm = team(t); return <span className="wrap-cell">{tm.lead}<div className="cell-sub">{tm.crew}</div></span> } },
            { key: 'st', header: 'Planned start', render: (t) => formatDateShort(t.start) },
            { key: 'dl', header: 'Due date', render: (t) => <span className={t.status === 'Delayed' ? 'down' : ''}>{formatDateShort(t.deadline)}</span> },
            { key: 'pq', header: 'Planned qty', align: 'num', render: (t) => `${t.plannedQty} ${t.unit}` },
            { key: 'cq', header: 'Completed qty', align: 'num', render: (t) => `${t.done} ${t.unit}` },
            { key: 'pc', header: 'Progress', render: (t) => <div style={{ minWidth: 90 }}><div className="prog-row"><span /><b>{t.pct}%</b></div><Progress value={t.pct} tone={t.status === 'Delayed' ? 'bad' : ''} /></div> },
            { key: 'p', header: 'Priority', render: (t) => <Badge>{t.priority}</Badge> },
            { key: 's', header: 'Status', render: (t) => <Badge tone={statusTone(t.status)}>{t.status}</Badge> },
            { key: 'x', header: 'Actions', render: (t) => (
              <div className="cell-actions">
                <button className="btn btn-sm" onClick={() => setOpenId(t.id)}>View</button>
                {ctx.perms.work && t.status !== 'Completed' && <button className="btn btn-sm btn-primary" onClick={() => go('progress', `new=1&task=${t.id}`)}>Record progress</button>}
              </div>
            ) },
          ]} />
        </Card>
      )}

      {view === 'daily' && (
        <Card title={`Work on ${formatDate(day)}`} sub="Tasks planned on this day (and anything delayed)" bodyClass=""
          action={<label className="field">Day<input type="date" value={day} onChange={(e) => setDay(e.target.value || todayISO())} /></label>}>
          <DataTable rows={onDay(day)} emptyText="No work planned on this day." columns={[
            { key: 't', header: 'Task', render: (t) => <><button className="link-btn" onClick={() => setOpenId(t.id)}>{t.title}</button><div className="cell-sub">{t.id} · {t.location}</div></> },
            { key: 'q', header: 'Planned vs actual', render: (t) => <div style={{ minWidth: 160 }}><div className="prog-row"><span>{t.done} / {t.plannedQty} {t.unit}</span><b>{t.pct}%</b></div><Progress value={t.pct} tone={t.status === 'Delayed' ? 'bad' : ''} /><div className={`cell-sub ${t.variance < 0 ? 'down' : ''}`}>planned to date {t.plannedToDate} ({t.variance > 0 ? '+' : ''}{t.variance})</div></div> },
            { key: 'dl', header: 'Deadline', render: (t) => formatDate(t.deadline) },
            { key: 'p', header: 'Priority', render: (t) => <Badge>{t.priority}</Badge> },
            { key: 's', header: 'Status', render: (t) => <Badge tone={statusTone(t.status)}>{t.status}</Badge> },
          ]} />
        </Card>
      )}

      {view === 'weekly' && (
        <>
          <div className="toolbar plain"><label className="field">Week starting<input type="date" value={day} onChange={(e) => setDay(e.target.value || todayISO())} /></label></div>
          <div className="se-week">
            {week.map((date) => (
              <div key={date} className={`card se-day ${date === todayISO() ? 'today' : ''}`}>
                <div className="se-day-head">{formatDateShort(date)}</div>
                {onDay(date).length === 0 ? <div className="cell-sub">—</div> : onDay(date).map((t) => (
                  <button key={t.id} className={`se-chip tone-${statusTone(t.status)}`} onClick={() => setOpenId(t.id)} title={t.title}>
                    {t.milestone && t.deadline === date ? '◆ ' : ''}{t.title}
                  </button>
                ))}
              </div>
            ))}
          </div>
        </>
      )}

      {view === 'monthly' && (() => {
        const first = `${day.slice(0, 8)}01`
        const lead = (new Date(`${first}T00:00`).getDay() + 6) % 7 // Monday-first calendar
        const days = Array.from({ length: 42 }, (_, i) => addDays(first, i - lead))
        const month = day.slice(0, 7)
        return (
          <Card title={new Date(`${first}T00:00`).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })} sub="Monthly work plan: activities running each day; ◆ = milestone due. Click a day for its task list." bodyClass="card-body"
            action={<div className="cell-actions"><button className="btn btn-sm" onClick={() => setDay(addDays(first, -1))}>‹ Previous</button><button className="btn btn-sm" onClick={() => setDay(addDays(first, 32))}>Next ›</button></div>}>
            <div className="se-month">
              {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((w) => <div key={w} className="se-month-h">{w}</div>)}
              {days.map((date) => {
                const list = onDay(date)
                const ms = tasks.filter((t) => t.milestone && t.deadline === date)
                return (
                  <button key={date} className={`se-month-d ${date.slice(0, 7) !== month ? 'other' : ''} ${date === todayISO() ? 'today' : ''}`} onClick={() => { setDay(date); setView('daily') }} aria-label={`${formatDate(date)}: ${list.length} activities`}>
                    <span className="n">{Number(date.slice(8))}</span>
                    {list.length > 0 && <span className="c">{list.length} {list.length === 1 ? 'activity' : 'activities'}</span>}
                    {list.some((t) => t.status === 'Delayed') && <span className="c down">delayed work</span>}
                    {ms.map((t) => <span key={t.id} className="c ms">◆ {t.milestone}</span>)}
                  </button>
                )
              })}
            </div>
          </Card>
        )
      })()}
      <p className="cell-sub" style={{ marginTop: 10 }}>Material status for a task: {d.requests.filter((r) => r.taskId && ![MR.ISSUED, MR.CLOSED, MR.CANCELLED, MR.REJECTED].includes(r.status)).length} open request(s) are linked to tasks; open a task to see them.</p>
      {current && <TaskDrawer key={current.id} t={current} ctx={ctx} d={d} go={go} onClose={() => setOpenId(null)} />}
    </>
  )
}
