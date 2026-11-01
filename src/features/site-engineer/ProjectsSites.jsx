import { useState } from 'react'
import DataTable from '../../components/DataTable.jsx'
import Icon from '../../components/Icon.jsx'
import { Badge, Card, Progress } from '../../components/UI.jsx'
import { SITES } from '../../data/demo/inventoryDemo.js'
import { SITE_CONTACTS } from '../../data/demo/siteDemo.js'
import { PHASES, phaseOf, pmOf, siteOf } from '../../services/site.js'
import { diffDays, todayISO } from '../../utils/date.js'
import { formatDate } from '../../utils/format.js'
import { Drawer, fmtStamp, Locked } from '../store-keeper/shared.jsx'
import { siteData } from './derive.js'
import { useSiteEngineer } from './shared.jsx'

/** Planned progress by time: share of the project period elapsed today */
const plannedPct = (p) => Math.max(0, Math.min(100, Math.round((diffDays(p.startDate, todayISO()) / Math.max(1, diffDays(p.startDate, p.deadline))) * 100)))
const short = (name = '') => name.split(': ')[1] || name

/** Project → tower / site → work area → tasks, from the assigned schedule */
function Hierarchy({ p, sites, d, go }) {
  return (
    <ul className="se-tree">
      <li><b>{p.short}</b>
        <ul>
          {sites.map((s) => {
            const tasks = d.tasks.filter((t) => t.siteId === s.id)
            const areas = [...new Set(tasks.map((t) => t.location))]
            return (
              <li key={s.id}><b>{short(s.name)}</b> <span className="cell-sub">· {s.stage}</span>
                <ul>
                  {areas.length === 0 && <li className="cell-sub">No tasks scheduled</li>}
                  {areas.map((a) => (
                    <li key={a}>{a.replace(`${short(s.name)}, `, '')}
                      <ul>
                        {tasks.filter((t) => t.location === a).map((t) => (
                          <li key={t.id}><button className="link-btn" onClick={() => go('schedule', `task=${t.id}`)}>{t.id} {t.title}</button> <Badge>{t.status}</Badge> <span className="cell-sub">{t.pct}%</span></li>
                        ))}
                      </ul>
                    </li>
                  ))}
                </ul>
              </li>
            )
          })}
        </ul>
      </li>
    </ul>
  )
}

/** Foundation → Structure → Finishing, current phase highlighted */
function PhaseSteps({ stage }) {
  const cur = PHASES.indexOf(phaseOf(stage))
  return <ol className="se-phases" aria-label={`Phase: ${phaseOf(stage)}`}>{PHASES.map((ph, i) => <li key={ph} className={i < cur ? 'done' : i === cur ? 'current' : ''}>{ph}</li>)}</ol>
}

function Contacts({ siteIds }) {
  const rows = siteIds.flatMap((id) => (SITE_CONTACTS[id] || []).map((c, i) => ({ ...c, key: `${id}-${i}`, site: siteOf(id)?.name })))
  return <DataTable rowKey="key" rows={rows} emptyText="No contacts recorded." columns={[
    { key: 'role', header: 'Contact', render: (c) => <><div className="cell-main">{c.role}</div><div className="cell-sub">{c.site}</div></> },
    { key: 'name', header: 'Name' }, { key: 'phone', header: 'Phone', render: (c) => <a className="link-btn" href={`tel:${c.phone.replace(/[^+\d]/g, '')}`}>{c.phone}</a> },
  ]} />
}

function ProjectDetail({ p, ctx, d, onClose, go }) {
  const sites = ctx.scope.siteIds.map((id) => ({ ...siteOf(id), meta: SITES.find((s) => s.id === id) })).filter((s) => s.project === p.name)
  const approved = d.docs.filter((x) => x.projectId === p.id).map((x) => ({ ...x, approved: d.latestApproved(x) })).filter((x) => x.approved)
  return (
    <Drawer title={p.name} sub={`${p.id} · ${p.location}`} onClose={onClose} wide>
      <dl className="details">
        <dt>Project Manager</dt><dd>{pmOf(p.id)}</dd>
        <dt>Type</dt><dd>{p.type} · {p.units} units</dd>
        <dt>Start / target</dt><dd>{formatDate(p.startDate)} → {formatDate(p.deadline)}</dd>
        <dt>Current stage</dt><dd>{p.stage}<PhaseSteps stage={p.stage} /></dd>
        <dt>Progress</dt><dd>Actual {p.progress}% · planned by today {plannedPct(p)}% <Badge>{p.status}</Badge></dd>
      </dl>
      <p className="cell-sub" style={{ marginTop: 8 }}><Locked>Budget and site assignments are managed by the Project Manager / Admin</Locked></p>
      <section className="drawer-section">
        <h3>Towers, work areas & tasks</h3>
        <Hierarchy p={p} sites={sites} d={d} go={go} />
      </section>
      <section className="drawer-section">
        <h3>Your sites</h3>
        <DataTable rows={sites} emptyText="No sites." columns={[
          { key: 'name', header: 'Site', render: (s) => <><div className="cell-main">{s.name}</div><div className="cell-sub">{s.id}</div></> },
          { key: 'stage', header: 'Current stage', render: (s) => s.stage },
          { key: 'sup', header: 'Site Supervisor', render: (s) => s.meta?.supervisor || '—' },
          { key: 'w', header: 'Workers', align: 'num', render: (s) => s.workers },
          { key: 'safety', header: 'Safety', render: (s) => <Badge>{s.safety}</Badge> },
        ]} />
      </section>
      <section className="drawer-section">
        <h3>Site contact details</h3>
        <Contacts siteIds={sites.map((x) => x.id)} />
      </section>
      <section className="drawer-section">
        <h3>Approved drawings & documents ({approved.length})</h3>
        <DataTable rows={approved} emptyText="No approved documents yet." columns={[
          { key: 'id', header: 'No.', render: (x) => <span className="cell-main">{x.id}</span> },
          { key: 't', header: 'Title', render: (x) => <span className="wrap-cell">{x.title}</span> },
          { key: 'r', header: 'Approved rev.', render: (x) => <>{x.approved.rev} <span className="cell-sub">{formatDate(x.approved.date)}</span></> },
        ]} />
        <button className="btn btn-sm" style={{ marginTop: 8 }} onClick={() => go('drawings')}>Open document register</button>
      </section>
      <section className="drawer-section">
        <h3>Recent activity</h3>
        {d.notes.filter((n) => !n.ref || d.tasks.concat(d.requests, d.issues, d.inspections).some((x) => x.id === n.ref && x.projectId === p.id) || n.kind.includes('instruction') || n.kind === 'Clarification').slice(0, 8).map((n, i) => (
          <div key={i} className="cell-sub" style={{ padding: '4px 0' }}>{fmtStamp(n.at)} · <b>{n.kind}</b> {n.ref}: {n.text}</div>
        ))}
      </section>
    </Drawer>
  )
}

export default function ProjectsSites({ notify, go, search }) {
  const ctx = useSiteEngineer(notify)
  const d = siteData(ctx)
  const [status, setStatus] = useState('all')
  const [loc, setLoc] = useState('all')
  const [stage, setStage] = useState('all')
  const [open, setOpen] = useState(null)
  const q = (search || '').toLowerCase()
  const list = ctx.myProjects
    .filter((p) => (status === 'all' || p.status === status) && (loc === 'all' || p.location === loc) && (stage === 'all' || phaseOf(p.stage) === stage))
    .filter((p) => !q || `${p.name} ${p.id} ${p.location}`.toLowerCase().includes(q))
  const current = open && ctx.myProjects.find((p) => p.id === open)

  return (
    <>
      <div className="toolbar plain">
        <div className="filters">
          <label className="field">Status<select value={status} onChange={(e) => setStatus(e.target.value)}><option value="all">All</option>{[...new Set(ctx.myProjects.map((p) => p.status))].map((s) => <option key={s}>{s}</option>)}</select></label>
          <label className="field">Location<select value={loc} onChange={(e) => setLoc(e.target.value)}><option value="all">All</option>{[...new Set(ctx.myProjects.map((p) => p.location))].map((s) => <option key={s}>{s}</option>)}</select></label>
          <label className="field">Construction stage<select value={stage} onChange={(e) => setStage(e.target.value)}><option value="all">All</option>{PHASES.map((s) => <option key={s}>{s}</option>)}</select></label>
        </div>
      </div>
      {list.length === 0 && <div className="card state"><h3>No projects match</h3><p>Clear the filters to see all your assigned projects.</p></div>}
      <div className="grid cards-3">
        {list.map((p) => {
          const sites = ctx.mySites.filter((s) => s.project === p.name)
          const approved = d.docs.filter((x) => x.projectId === p.id && d.latestApproved(x)).length
          return (
            <div key={p.id} className="card proj">
              <div className="proj-top">
                <div><h3>{p.name}</h3><div className="loc"><Icon name="pin" />{p.location} · {p.id}</div></div>
                <Badge>{p.status}</Badge>
              </div>
              <PhaseSteps stage={p.stage} />
              <div className="prog-row"><span>{p.stage}</span><b>{p.progress}% actual</b></div>
              <Progress value={p.progress} tone={p.progress < plannedPct(p) - 10 ? 'bad' : ''} />
              <div className="cell-sub">Planned by today: {plannedPct(p)}% (time elapsed in the project period)</div>
              <div className="proj-meta">
                <div><div className="k">Project Manager</div><div className="v">{pmOf(p.id)}</div></div>
                <div><div className="k">Start</div><div className="v">{formatDate(p.startDate)}</div></div>
                <div><div className="k">Target</div><div className="v">{formatDate(p.deadline)}</div></div>
              </div>
              <div className="cell-sub">Your sites: {sites.map((s) => `${s.name} (Supervisor ${SITES.find((x) => x.id === s.id)?.supervisor || '—'})`).join(', ')}</div>
              <div className="cell-sub">{approved} approved drawings / documents · Site office {sites.map((x) => SITE_CONTACTS[x.id]?.[0]?.phone).filter(Boolean).join(', ') || '—'}</div>
              <div className="cell-actions">
                <button className="btn btn-sm btn-primary" onClick={() => setOpen(p.id)}>Open project</button>
                <button className="btn btn-sm" onClick={() => go('schedule')}>Tasks</button>
              </div>
            </div>
          )
        })}
      </div>
      <p className="cell-sub" style={{ marginTop: 12 }}>Only projects and sites assigned to you are listed. Other projects are not visible to your role.</p>
      {current && <ProjectDetail p={current} ctx={ctx} d={d} go={go} onClose={() => setOpen(null)} />}
    </>
  )
}
