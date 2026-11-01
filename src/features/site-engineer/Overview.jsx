import { useState } from 'react'
import Icon from '../../components/Icon.jsx'
import SummaryCard from '../../components/SummaryCard.jsx'
import { Badge, Card, Progress } from '../../components/UI.jsx'
import { MR } from '../../services/inventory.js'
import { pmOf, siteOf } from '../../services/site.js'
import { todayISO } from '../../utils/date.js'
import { formatDate, relativeDay } from '../../utils/format.js'
import { fmtQty, fmtStamp } from '../store-keeper/shared.jsx'
import { siteData } from './derive.js'
import { useSiteEngineer } from './shared.jsx'

// Material request status groups (each opens the request list filtered to those statuses)
const REQUEST_GROUPS = [
  ['Awaiting store check', [MR.SUBMITTED]], ['With Project Manager', [MR.PM_REVIEW]], ['Returned / draft', [MR.RETURNED, MR.DRAFT]],
  ['Approved, to issue', [MR.APPROVED, MR.PARTIAL]], ['Issued / closed', [MR.ISSUED, MR.CLOSED]], ['Rejected / cancelled', [MR.REJECTED, MR.CANCELLED]],
]
const NOTE_KINDS = ['All', 'Material', 'Inspection', 'Task', 'Site issue', 'Project Manager']

export default function Overview({ notify, go }) {
  const ctx = useSiteEngineer(notify)
  const d = siteData(ctx)
  const [noteKind, setNoteKind] = useState('All')
  const short = (name = '') => name.split(': ')[1] || name
  const cards = [
    { label: 'Assigned Projects', value: ctx.myProjects.length, sub: ctx.myProjects.map((p) => p.short).join(', '), icon: 'building', to: ['projects'] },
    { label: 'Active Sites', value: ctx.mySites.length, sub: ctx.mySites.map((s) => short(s.name)).join(', '), icon: 'pin', to: ['projects'] },
    { label: 'Tasks Due Today', value: d.dueToday.length, sub: d.dueToday.map((t) => t.id).join(', ') || `${d.activeToday.length} activities running today`, icon: 'calendar', to: ['schedule', 'due=today'], tone: d.dueToday.length ? 'warning' : undefined },
    { label: 'Overdue Tasks', value: d.delayed.length, sub: d.delayed.map((t) => `${t.id} (${t.daysLate}d)`).join(', ') || 'Nothing overdue', icon: 'alert', to: ['schedule', 'status=Delayed'], tone: d.delayed.length ? 'danger' : undefined },
    { label: 'Work Progress', value: `${d.workPct}%`, sub: `Planned by today ${d.plannedPct}% · ${d.tasks.filter((t) => t.status === 'Completed').length} of ${d.tasks.length} tasks complete`, icon: 'trend', to: ['progress'], tone: d.workPct < d.plannedPct ? 'warning' : undefined },
    { label: 'Pending Material Requests', value: d.pendingRequests.length, sub: `${d.requests.filter((r) => r.status === MR.PM_REVIEW).length} with PM · ${d.requests.filter((r) => [MR.APPROVED, MR.PARTIAL].includes(r.status) && r.shortage > 0).length} short (purchasing)`, icon: 'box', to: ['materials', 'status=open'] },
    { label: 'Pending Quality Inspections', value: d.pendingInspections.length, sub: `${d.pendingInspections.filter((q) => q.status === 'Overdue').length} overdue · ${d.awaitingQa.length} awaiting QA review`, icon: 'check', to: ['quality', 'status=pending'], tone: d.pendingInspections.some((q) => q.status === 'Overdue') ? 'warning' : undefined },
    { label: 'Open Site Issues', value: d.openIssues.length, sub: `${d.openIssues.filter((i) => i.escalated).length} escalated to the Project Manager`, icon: 'clipboard', to: ['issues', 'status=open'], tone: d.openIssues.some((i) => ['High', 'Critical'].includes(i.priority)) ? 'warning' : undefined },
  ]
  const requestsFor = (taskId) => d.requests.filter((r) => r.taskId === taskId && ![MR.CANCELLED, MR.REJECTED].includes(r.status))
  const notes = d.notes.filter((n) => noteKind === 'All' || n.kind.includes(noteKind) || (noteKind === 'Project Manager' && /Clarification|instruction|Report/.test(n.kind)))
  const projectRows = ctx.myProjects.map((p) => {
    const tasks = d.tasks.filter((t) => t.projectId === p.id)
    const pct = tasks.length ? Math.round(tasks.reduce((a, t) => a + t.pct, 0) / tasks.length) : null
    const planned = tasks.length ? Math.round(tasks.reduce((a, t) => a + (t.plannedQty ? Math.min(100, (t.plannedToDate / t.plannedQty) * 100) : 0), 0) / tasks.length) : null
    return { p, tasks, pct, planned, sites: ctx.mySites.filter((s) => s.project === p.name) }
  })

  return (
    <>
      <div className="se-quick">
        <button className="btn btn-primary" onClick={() => go('materials', 'new=1')} disabled={!ctx.perms.request}><Icon name="box" />New material request</button>
        <button className="btn" onClick={() => go('progress', 'new=1')} disabled={!ctx.perms.work}><Icon name="trend" />Record daily progress</button>
        <button className="btn" onClick={() => go('quality', 'new=1')} disabled={!ctx.perms.inspect}><Icon name="check" />New inspection</button>
        <button className="btn" onClick={() => go('issues', 'new=1')} disabled={!ctx.perms.work}><Icon name="alert" />Report site issue</button>
      </div>

      <div className="summary-grid">
        {cards.map((c) => <SummaryCard key={c.label} {...c} onClick={() => go(...c.to)} />)}
      </div>

      <div className="grid halves">
        <Card title="Today's work plan" sub={`${formatDate(todayISO())} · tasks running today, with their material requests`} bodyClass="" action={<button className="btn btn-sm" onClick={() => go('schedule')}>All tasks</button>}>
          {d.activeToday.length === 0 ? <div className="empty sm">No activities scheduled today.</div> : (
            <ul className="list sk-alerts">
              {d.activeToday.map((t) => (
                <li key={t.id} className="se-click" onClick={() => go('schedule', `task=${t.id}`)}>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div className="t">{t.title}</div>
                    <div className="s">{short(siteOf(t.siteId)?.name)} · {t.location} · {t.done} / {t.plannedQty} {t.unit} · planned completion {formatDate(t.deadline)}</div>
                    <Progress value={t.pct} tone={t.status === 'Delayed' ? 'bad' : ''} />
                    {requestsFor(t.id).map((r) => <div key={r.id} className="s">Material: {r.id} · {fmtQty(r.requested, r.material.unit)} {r.material.name} · <b>{r.status}</b></div>)}
                  </div>
                  <div className="r"><Badge>{t.status}</Badge><div>{t.pct}%</div></div>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title={<span className="title-with-count">Pending actions <span className="count-pill">{d.actions.length}</span></span>} sub="What needs you next; click to open it" bodyClass="">
          {d.actions.length === 0 ? <div className="empty sm">Nothing waiting for you.</div> : (
            <ul className="list sk-alerts">
              {d.actions.map((a) => (
                <li key={`${a.section}-${a.id}`} className="se-click" onClick={() => go(a.section, a.query)}>
                  <div className={`dot-ico sk-sev-${a.tone}`}><Icon name={a.tone === 'danger' ? 'alert' : 'check'} /></div>
                  <div style={{ minWidth: 0 }}><div className="t">{a.text}</div><div className="s">{a.id}</div></div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <div className="grid halves">
        <Card title="Material request status" sub="Your sites' requests: the same records the Project Manager, Store Keeper and Purchase Manager see" bodyClass="" action={<button className="btn btn-sm" onClick={() => go('materials')}>All requests</button>}>
          <div className="stat-grid compact-stats" style={{ margin: 0, padding: '14px 18px' }}>
            {REQUEST_GROUPS.map(([label, st]) => (
              <button key={label} className="stat se-stat-btn" onClick={() => go('materials', `status=${encodeURIComponent(st.join(','))}`)}>
                <div className="k">{label}</div><div className="v">{d.requests.filter((r) => st.includes(r.status)).length}</div>
              </button>
            ))}
          </div>
          <ul className="list sk-alerts">
            {d.requests.filter((r) => ![MR.ISSUED, MR.CLOSED, MR.CANCELLED, MR.REJECTED].includes(r.status)).sort((a, b) => b.at.localeCompare(a.at)).slice(0, 5).map((r) => (
              <li key={r.id} className="se-click" onClick={() => go('materials', `open=${r.id}`)}>
                <div style={{ minWidth: 0 }}><div className="t">{r.id} · {fmtQty(r.requested, r.material.unit)} {r.material.name}</div><div className="s">{short(r.site?.name)} · {r.purpose} · needed {formatDate(r.requiredBy)}{r.approved != null ? ` · issued ${r.issued} of ${r.approved}` : ''}{r.forwarded ? ` · shortage with purchasing (${r.forwarded.id}${r.forwarded.poId ? ` → ${r.forwarded.poId}` : ''})` : ''}</div></div>
                <div className="r"><Badge>{r.status}</Badge></div>
              </li>
            ))}
          </ul>
        </Card>

        <Card title="Upcoming deadlines" sub="Next 14 days: tasks, milestones, inspections, materials and safety actions" bodyClass="">
          {d.deadlines.length === 0 ? <div className="empty sm">Nothing due in the next 14 days.</div> : (
            <ul className="list sk-alerts">
              {d.deadlines.slice(0, 9).map((x) => (
                <li key={`${x.section}-${x.id}`} className="se-click" onClick={() => go(x.section, x.section === 'schedule' ? `task=${x.id}` : '')}>
                  <div className="dot-ico sk-sev-info"><Icon name="calendar" /></div>
                  <div style={{ minWidth: 0 }}><div className="t">{x.text}</div><div className="s">{x.id}</div></div>
                  <div className="r">{relativeDay(x.date)}<div>{formatDate(x.date)}</div></div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <div className="grid two-one">
        <Card title="Project-wise progress" sub="Actual = completed quantity of your scheduled tasks; planned = where the schedule expects you to be today" bodyClass="card-body">
          {projectRows.map(({ p, tasks, pct, planned, sites }) => (
            <div key={p.id} className="se-proj">
              <div className="prog-row"><span><b>{p.name}</b> · {sites.map((s) => short(s.name)).join(', ')} · PM {pmOf(p.id)}</span><b>{p.progress}% overall</b></div>
              <Progress value={p.progress} />
              {pct != null && <div className="cell-sub">Your scheduled work: <b>{pct}%</b> actual vs {planned}% planned to date · {tasks.filter((t) => t.status === 'Delayed').length} delayed · {tasks.length} tasks</div>}
            </div>
          ))}
          <div className="hbars" style={{ marginTop: 12 }}>
            {d.boq.map((b) => (
              <button key={b.id} className="hbar se-hbar" onClick={() => go('measurements')} title={`${b.executed} of ${b.approvedQty} ${b.unit}`}>
                <span className="hbar-label">{b.description.split(',')[0]}</span>
                <Progress value={b.pct} tone={b.pct >= 100 ? 'ok' : ''} />
                <span className="hbar-value">{b.pct}%</span>
              </button>
            ))}
          </div>
        </Card>

        <Card title={<span className="title-with-count">Urgent alerts <span className="count-pill">{d.alerts.length}</span></span>} sub="Shown on screen only; nothing is sent" bodyClass="">
          {d.alerts.length === 0 ? <div className="empty sm">No urgent alerts.</div> : (
            <ul className="list sk-alerts">
              {d.alerts.map((a) => (
                <li key={a.id} className="se-click" onClick={() => go(a.section)}>
                  <div className={`dot-ico sk-sev-${a.tone}`}><Icon name="alert" /></div>
                  <div style={{ minWidth: 0 }}><div className="t">{a.text}</div><div className="s">{a.id}</div></div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <Card title={<span className="title-with-count">Notifications & recent site activity <span className="count-pill">{d.notes.length}</span></span>}
        sub="Updates on your requests, inspections, tasks and issues from the shared demo records. On screen only: nothing is emailed or sent by SMS." bodyClass=""
        action={<div className="chips">{NOTE_KINDS.map((k) => <button key={k} className={`chip ${noteKind === k ? 'active' : ''}`} onClick={() => setNoteKind(k)}>{k}</button>)}</div>}>
        {notes.length === 0 ? <div className="empty sm">No notifications of this type.</div> : (
          <ul className="list sk-alerts">
            {notes.slice(0, 10).map((n, i) => (
              <li key={i} className="se-click" onClick={() => go(n.section, n.section === 'materials' ? `open=${n.ref}` : '')}>
                <div style={{ minWidth: 0 }}><div className="t">{n.kind} · {n.ref}</div><div className="s">{n.text}</div></div>
                <div className="r">{fmtStamp(n.at)}</div>
              </li>
            ))}
          </ul>
        )}
      </Card>
      <p className="cell-sub" style={{ marginTop: 10 }}>Demo data: figures come from the shared demo records for this browser session. Changes you make are not saved to a server and reset on reload.</p>
    </>
  )
}
