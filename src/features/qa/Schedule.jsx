import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import DataTable from '../../components/DataTable.jsx'
import Icon from '../../components/Icon.jsx'
import { Badge, Card, Chips } from '../../components/UI.jsx'
import { projects, sites } from '../../data/mockData.js'
import { QA_INSPECTORS } from '../../data/demo/qaDemo.js'
import * as Q from '../../services/qa.js'
import { addDays } from '../../utils/date.js'
import { formatDate } from '../../utils/format.js'
import { Drawer, FormError, Locked } from '../store-keeper/shared.jsx'
import { InspStatus, InspectionDrawer, InspectorSelect, docRefLabel, siteName, useQA } from './shared.jsx'

export const INSPECTION_TYPES = ['Reinforcement', 'Finishing / formwork', 'Concrete', 'Levels & PCC', 'Excavation & soil', 'Masonry', 'Waterproofing', 'Electrical', 'Plumbing', 'Other']
const SITE_PROJECT = { 'S-01': 'P-101', 'S-02': 'P-101', 'S-03': 'P-102' }

/** Schedule an inspection directly (not from a request): walk-round, hold point, client request. */
function NewInspection({ ctx, onClose }) {
  const usable = ctx.s.checklists.filter((c) => Q.checklistBasis(ctx.s, c).usable)
  const approvedDocs = ctx.s.documents.filter((d) => d.revisions.some((r) => r.status === 'Approved'))
  const [f, setF] = useState({ siteId: 'S-01', title: '', location: '', type: 'Reinforcement', taskId: '', checklistId: usable[0]?.id || '', drawingRefs: [], date: ctx.today, time: '10:00', inspector: ctx.user.name, priority: 'Normal' })
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value })
  const tasks = ctx.s.tasks.filter((t) => t.siteId === f.siteId)
  return (
    <Drawer title="Schedule inspection" sub="Scheduling does not complete anything: the result is recorded after the inspection" onClose={() => { ctx.setError(''); onClose() }}>
      <div className="receipt-form">
        <div className="receipt-grid">
          <label className="field">Site<select value={f.siteId} onChange={set('siteId')}>{sites.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select></label>
          <label className="field">Related task<select value={f.taskId} onChange={(e) => { const t = tasks.find((x) => x.id === e.target.value); setF({ ...f, taskId: e.target.value, title: f.title || t?.title || '', location: f.location || t?.location || '' }) }}><option value="">None</option>{tasks.map((t) => <option key={t.id} value={t.id}>{t.id} · {t.title}</option>)}</select></label>
          <label className="field span-2">Work activity<input value={f.title} onChange={set('title')} placeholder="e.g. Raft foundation reinforcement, grid A5–A8" /></label>
          <label className="field">Tower / floor / location<input value={f.location} onChange={set('location')} /></label>
          <label className="field">Inspection type<select value={f.type} onChange={set('type')}>{INSPECTION_TYPES.map((t) => <option key={t}>{t}</option>)}</select></label>
          <label className="field span-2">Checklist (in use)<select value={f.checklistId} onChange={set('checklistId')}>{usable.map((c) => <option key={c.id} value={c.id}>{c.id} · {c.title}</option>)}</select></label>
          <label className="field span-2">Drawing / specification
            <select value="" onChange={(e) => e.target.value && setF({ ...f, drawingRefs: [...new Set([...f.drawingRefs, e.target.value])] })}><option value="">Add an approved document…</option>{approvedDocs.map((d) => <option key={d.id} value={d.id}>{docRefLabel(ctx.s, d.id)} · {d.title}</option>)}</select>
            <span className="cell-sub">{f.drawingRefs.length ? f.drawingRefs.map((d) => docRefLabel(ctx.s, d)).join(', ') : 'None added'}</span>
          </label>
          <label className="field">Date<input type="date" min={ctx.today} value={f.date} onChange={set('date')} /></label>
          <label className="field">Time<input type="time" value={f.time} onChange={set('time')} /></label>
          <InspectorSelect value={f.inspector} onChange={(v) => setF({ ...f, inspector: v })} />
          <label className="field">Priority<select value={f.priority} onChange={set('priority')}><option>Normal</option><option>High</option><option>Urgent</option></select></label>
        </div>
        <div className="sk-form-foot">
          <FormError error={ctx.error} />
          <div className="jv-submit"><button className="btn btn-primary" onClick={() => ctx.act('scheduleInspection', { ...f, projectId: SITE_PROJECT[f.siteId] }) && onClose()}>Schedule inspection</button><button className="btn" onClick={onClose}>Cancel</button></div>
        </div>
      </div>
    </Drawer>
  )
}

function WeekCalendar({ ctx, rows, start, onOpen }) {
  const days = Array.from({ length: 7 }, (_, i) => addDays(start, i))
  return (
    <div className="qa-week">
      {days.map((d) => {
        const list = rows.filter((q) => q.date === d).sort((a, b) => (a.time || '').localeCompare(b.time || ''))
        return (
          <div key={d} className={`qa-day ${d === ctx.today ? 'today' : ''}`}>
            <div className="qa-day-head">{new Date(`${d}T00:00`).toLocaleDateString('en-IN', { weekday: 'short', day: '2-digit', month: 'short' })}</div>
            {list.length ? list.map((q) => (
              <button key={q.id} className="qa-slot" onClick={() => onOpen(q.id)}>
                <b>{q.time || '—'}</b> {q.title}<div className="cell-sub">{q.inspector} · {Q.inspectionStatus(q, ctx.today)}</div>
              </button>
            )) : <div className="cell-sub">—</div>}
          </div>
        )
      })}
    </div>
  )
}

export default function Schedule({ notify, search }) {
  const ctx = useQA(notify)
  const [params, setParams] = useSearchParams()
  const [view, setView] = useState('List')
  const [f, setF] = useState({ project: 'all', site: 'all', from: '', to: '', type: 'all', inspector: 'all', status: params.get('status') || 'all' })
  const [open, setOpen] = useState(null) // { id, mode }
  const [creating, setCreating] = useState(params.get('new') === '1')
  const [weekStart, setWeekStart] = useState(addDays(ctx.today, -((new Date(`${ctx.today}T00:00`).getDay() + 6) % 7)))
  const q = (search || '').toLowerCase()
  const st = (x) => Q.inspectionStatus(x, ctx.today)
  const rows = ctx.qaInspections
    .filter((x) => f.project === 'all' || x.projectId === f.project)
    .filter((x) => f.site === 'all' || x.siteId === f.site)
    .filter((x) => (!f.from || x.date >= f.from) && (!f.to || x.date <= f.to))
    .filter((x) => f.type === 'all' || x.type === f.type)
    .filter((x) => f.inspector === 'all' || Q.inspectorName(x.inspector) === f.inspector)
    .filter((x) => f.status === 'all' || (f.status === 'pending' ? ['Overdue', 'In Progress'].includes(st(x)) : f.status === 'upcoming' ? Q.OPEN_INSPECTION.includes(x.status) && x.date >= ctx.today : st(x) === f.status))
    .filter((x) => !q || `${x.id} ${x.title} ${x.location} ${x.inspector} ${x.type}`.toLowerCase().includes(q))
    .sort((a, b) => a.date.localeCompare(b.date) || (a.time || '').localeCompare(b.time || ''))
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value })
  const closeNew = () => { setCreating(false); if (params.get('new')) setParams({}) }

  return (
    <>
      <Card title="Inspection schedule" sub="QA and third-party inspections. A scheduled inspection is only completed when its result is submitted." bodyClass=""
        action={ctx.perms.manage ? <button className="btn btn-primary btn-sm" onClick={() => setCreating(true)}><Icon name="plus" size={14} />Schedule inspection</button> : <Locked>View only</Locked>}>
        <div className="toolbar">
          <div className="filters">
            <label className="field">Project<select value={f.project} onChange={set('project')}><option value="all">All</option>{projects.map((p) => <option key={p.id} value={p.id}>{p.short || p.name}</option>)}</select></label>
            <label className="field">Site<select value={f.site} onChange={set('site')}><option value="all">All</option>{sites.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select></label>
            <label className="field">From<input type="date" value={f.from} onChange={set('from')} /></label>
            <label className="field">To<input type="date" value={f.to} onChange={set('to')} /></label>
            <label className="field">Type<select value={f.type} onChange={set('type')}><option value="all">All</option>{INSPECTION_TYPES.map((t) => <option key={t}>{t}</option>)}</select></label>
            <label className="field">Inspector<select value={f.inspector} onChange={set('inspector')}><option value="all">All</option>{QA_INSPECTORS.map((i) => <option key={i.name}>{i.name}</option>)}</select></label>
            <label className="field">Status<select value={f.status} onChange={set('status')}><option value="all">All</option><option value="upcoming">Upcoming (open)</option><option value="pending">Pending (overdue / draft)</option>{['Scheduled', 'Overdue', 'In Progress', 'Passed', 'Failed', 'Conditional'].map((s) => <option key={s}>{s}</option>)}</select></label>
          </div>
          <Chips options={['List', 'Calendar']} value={view} onChange={setView} />
        </div>
        {view === 'Calendar' ? (
          <div className="card-body">
            <div className="jv-submit" style={{ marginBottom: 8 }}>
              <button className="btn btn-sm" onClick={() => setWeekStart(addDays(weekStart, -7))}>← Previous week</button>
              <button className="btn btn-sm" onClick={() => setWeekStart(addDays(ctx.today, -((new Date(`${ctx.today}T00:00`).getDay() + 6) % 7)))}>This week</button>
              <button className="btn btn-sm" onClick={() => setWeekStart(addDays(weekStart, 7))}>Next week →</button>
            </div>
            <WeekCalendar ctx={ctx} rows={rows} start={weekStart} onOpen={(id) => setOpen({ id })} />
          </div>
        ) : (
          <DataTable dense rows={rows} emptyText="No inspections match these filters." columns={[
            { key: 'id', header: 'Inspection ID', render: (x) => <><button className="link-btn" onClick={() => setOpen({ id: x.id })}>{x.id}</button>{x.parentId && <div className="cell-sub">reinspection of {x.parentId}</div>}</> },
            { key: 'p', header: 'Project / site', render: (x) => <>{projects.find((p) => p.id === x.projectId)?.short || x.projectId}<div className="cell-sub">{siteName(x.siteId)}</div></> },
            { key: 'l', header: 'Location', render: (x) => <span className="wrap-cell">{x.location}</span> },
            { key: 'a', header: 'Work activity', render: (x) => <span className="wrap-cell">{x.title}<div className="cell-sub">{x.type}</div></span> },
            { key: 'r', header: 'Requested by', render: (x) => x.requestedBy || '—' },
            { key: 'i', header: 'Inspector', render: (x) => x.inspector },
            { key: 'd', header: 'Scheduled', render: (x) => <span className={st(x) === 'Overdue' ? 'down' : ''}>{formatDate(x.date)}<div className="cell-sub">{x.time || ''}</div></span> },
            { key: 'pr', header: 'Priority', render: (x) => <Badge>{x.priority || 'Normal'}</Badge> },
            { key: 's', header: 'Status', render: (x) => <InspStatus q={x} today={ctx.today} /> },
            { key: 'ref', header: 'Task / drawing', render: (x) => <span className="cell-sub wrap-cell">{[x.taskId, ...(x.drawingRefs || [])].filter(Boolean).join(' · ') || '—'}</span> },
            {
              key: 'x', header: '', render: (x) => (
                <div className="cell-actions">
                  {ctx.perms.manage && x.owner === 'QA' && Q.OPEN_INSPECTION.includes(x.status) && x.date <= ctx.today && <button className="btn btn-sm btn-primary" onClick={() => setOpen({ id: x.id, mode: 'result' })}>Record result</button>}
                  {ctx.perms.manage && x.owner === 'QA' && Q.OPEN_INSPECTION.includes(x.status) && <button className="btn btn-sm" onClick={() => setOpen({ id: x.id, mode: 'reschedule' })}>Reschedule</button>}
                  <button className="btn btn-sm" onClick={() => setOpen({ id: x.id })}>View</button>
                </div>
              ),
            },
          ]} />
        )}
      </Card>
      {creating && <NewInspection ctx={ctx} onClose={closeNew} />}
      {open && <InspectionDrawer key={`${open.id}-${open.mode || ''}`} ctx={ctx} id={open.id} initialMode={open.mode || null} onClose={() => setOpen(null)} />}
    </>
  )
}
