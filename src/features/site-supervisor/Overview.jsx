import DataTable from '../../components/DataTable.jsx'
import Icon from '../../components/Icon.jsx'
import SummaryCard from '../../components/SummaryCard.jsx'
import { Badge, Card, Progress } from '../../components/UI.jsx'
import { siteOf } from '../../services/site.js'
import { formatDate } from '../../utils/format.js'
import { fmtStamp } from '../store-keeper/shared.jsx'
import { shortName, supData, useSupervisor } from './shared.jsx'

export default function Overview({ notify, go }) {
  const ctx = useSupervisor(notify)
  const d = supData(ctx)
  const assignedTasks = [...new Set(d.allocToday.map((a) => a.taskId))]
  const cards = [
    { label: 'Workers Expected Today', value: d.expected, sub: ctx.mySites.map((s) => shortName(s.name)).join(', '), icon: 'users', to: ['attendance'] },
    { label: 'Workers Present', value: d.present + d.halfDay, sub: `${d.present} full day · ${d.halfDay} half day${d.notMarked ? ` · ${d.notMarked} not marked` : ''}`, icon: 'check', to: ['labour', 'status=Present'] },
    { label: 'Workers Absent', value: d.absent + d.onLeave, sub: `${d.absent} absent · ${d.onLeave} on leave`, icon: 'alert', to: ['labour', 'status=Absent'], tone: d.absent ? 'warning' : undefined },
    { label: 'Tasks Assigned Today', value: assignedTasks.length, sub: `${d.allocToday.reduce((t, a) => t + a.workerIds.length, 0)} workers allocated · ${d.active.length} activities open`, icon: 'calendar', to: ['allocation'], tone: d.active.length > assignedTasks.length ? 'warning' : undefined },
    { label: 'Tasks Completed Today', value: d.completedToday.length, sub: `${d.progressToday.length} progress entr${d.progressToday.length === 1 ? 'y' : 'ies'} recorded today`, icon: 'trend', to: ['progress'] },
    { label: 'Tasks Delayed', value: d.delayed.length, sub: d.delayed.map((t) => `${t.id} (${t.daysLate}d)`).join(', ') || 'None', icon: 'alert', to: ['reports', 'report=delays'], tone: d.delayed.length ? 'danger' : undefined },
    { label: 'Open Site Issues', value: d.openIssues.length, sub: `${d.openIssues.filter((i) => i.reportedBy === ctx.user.name).length} raised by you`, icon: 'clipboard', to: ['issues', 'status=open'], tone: d.openIssues.some((i) => ['High', 'Critical'].includes(i.priority)) ? 'warning' : undefined },
    { label: 'Safety Issues Requiring Action', value: d.safetyOpen.length, sub: `${d.safetyOpen.filter((x) => ['High', 'Critical'].includes(x.severity)).length} high severity`, icon: 'alert', to: ['safety', 'status=open'], tone: d.safetyOpen.length ? 'danger' : undefined },
  ]
  // Today's site activity: every open activity with today's crew and quantities
  const rows = d.active.map((t) => {
    const a = d.allocationOf(t.id)
    const p = d.progressToday.find((x) => x.taskId === t.id && x.status !== 'Returned')
    const last = [a?.at, p?.at, t.notesUpdatedAt].filter(Boolean).sort().pop()
    return { ...t, alloc: a, today: p, last }
  })
  const updates = [
    ...d.progress.flatMap((p) => p.history.map((h) => ({ at: h.at, text: `${p.id} ${p.taskId}: ${h.action}${h.note ? ` (${h.note})` : ''}`, by: h.by, to: 'progress' }))),
    ...d.issues.flatMap((i) => i.comments.map((c) => ({ at: c.at, text: `${i.id} ${i.title}: ${c.text}`, by: c.by, to: 'issues' }))),
    ...d.shortages.flatMap((x) => x.history.map((h) => ({ at: h.at, text: `${x.id}: ${h.action}`, by: h.by, to: 'materials' }))),
    ...d.allocations.map((a) => ({ at: a.at, text: `${a.taskId}: ${a.workerIds.length} workers allocated for ${a.date}`, by: a.by, to: 'allocation' })),
    ...d.diary.filter((x) => x.reviewedBy).map((x) => ({ at: x.reviewedAt, text: `Diary ${x.id} reviewed${x.reviewNote ? `: ${x.reviewNote}` : ''}`, by: x.reviewedBy, to: 'diary' })),
  ].filter((u) => u.at).sort((a, b) => b.at.localeCompare(a.at)).slice(0, 10)

  return (
    <>
      <div className="se-quick">
        <button className="btn btn-primary" onClick={() => go('attendance')} disabled={!ctx.perms.attendance}><Icon name="check" />Mark attendance</button>
        <button className="btn" onClick={() => go('allocation')} disabled={!ctx.perms.supervise}><Icon name="users" />Allocate work</button>
        <button className="btn" onClick={() => go('progress', 'new=1')} disabled={!ctx.perms.supervise}><Icon name="trend" />Record progress</button>
        <button className="btn" onClick={() => go('materials', 'new=1')} disabled={!ctx.perms.supervise}><Icon name="box" />Report shortage</button>
        <button className="btn" onClick={() => go('safety', 'new=1')} disabled={!ctx.perms.safety}><Icon name="alert" />Safety observation</button>
      </div>

      <div className="summary-grid">
        {cards.map((c) => <SummaryCard key={c.label} {...c} onClick={() => go(...c.to)} />)}
      </div>

      <Card title="Today's site activity" sub={`${formatDate(d.date)} · open activities approved by the Site Engineer / Project Manager, today's crew and quantities`} bodyClass="" action={<button className="btn btn-sm" onClick={() => go('allocation')}>Allocate work</button>}>
        <DataTable dense rows={rows} emptyText="No activities are open today." columns={[
          { key: 'a', header: 'Activity', render: (t) => <span className="wrap-cell"><b>{t.title}</b><div className="cell-sub">{t.id} · {t.location}</div></span> },
          { key: 's', header: 'Project / site', render: (t) => <>Sunrise Heights<div className="cell-sub">{shortName(siteOf(t.siteId)?.name)}</div></> },
          { key: 'w', header: 'Assigned workers', render: (t) => (t.alloc ? <>{t.alloc.workerIds.length}<div className="cell-sub">{t.alloc.team}</div></> : <button className="link-btn" onClick={() => go('allocation', `task=${t.id}`)}>Not allocated</button>) },
          { key: 'p', header: 'Planned qty', align: 'num', render: (t) => `${t.plannedQty} ${t.unit}` },
          { key: 'c', header: 'Completed qty', render: (t) => <div style={{ minWidth: 130 }}><div className="prog-row"><span>{t.done}{t.position.pending ? ` + ${t.position.pending} pending` : ''}</span><b>{t.pct}%</b></div><Progress value={t.pct} tone={t.status === 'Delayed' ? 'bad' : ''} />{t.today && <div className="cell-sub">today {t.today.qty} {t.unit} ({t.today.status})</div>}</div> },
          { key: 'st', header: 'Status', render: (t) => <Badge>{t.status}</Badge> },
          { key: 'u', header: 'Last updated', render: (t) => <span className="cell-sub">{t.last ? fmtStamp(t.last) : '—'}</span> },
        ]} />
      </Card>

      <div className="grid halves">
        <Card title="Attendance today" sub="From your saved muster" bodyClass="card-body" action={<button className="btn btn-sm" onClick={() => go('attendance')}>Open muster</button>}>
          {d.sums.map((x) => (
            <div key={x.siteId} className="se-proj">
              <div className="prog-row"><span><b>{shortName(siteOf(x.siteId)?.name)}</b> · {x.expected} expected</span><b>{x.present + x.halfDay} at work</b></div>
              <Progress value={x.expected ? ((x.present + x.halfDay) / x.expected) * 100 : 0} />
              <div className="cell-sub">{x.present} present · {x.halfDay} half day · {x.absent} absent · {x.onLeave} on leave{x.notMarked ? <span className="down"> · {x.notMarked} not marked yet</span> : ''}</div>
            </div>
          ))}
        </Card>
        <Card title="Delays, issues & safety" sub="Open items on your site" bodyClass="">
          <ul className="list sk-alerts">
            {d.delayed.map((t) => <li key={t.id} className="se-click" onClick={() => go('reports', 'report=delays')}><div className="dot-ico sk-sev-danger"><Icon name="alert" /></div><div style={{ minWidth: 0 }}><div className="t">{t.title}: {t.daysLate} day(s) late</div><div className="s">{t.id} · {t.done}/{t.plannedQty} {t.unit}{t.delayReason ? ` · ${t.delayReason}` : ''}</div></div></li>)}
            {d.openIssues.slice(0, 4).map((i) => <li key={i.id} className="se-click" onClick={() => go('issues')}><div className="dot-ico sk-sev-warning"><Icon name="clipboard" /></div><div style={{ minWidth: 0 }}><div className="t">{i.title}</div><div className="s">{i.id} · {i.category} · {i.assignee?.role} · {i.status}</div></div></li>)}
            {d.safetyOpen.slice(0, 4).map((x) => <li key={x.id} className="se-click" onClick={() => go('safety')}><div className="dot-ico sk-sev-danger"><Icon name="alert" /></div><div style={{ minWidth: 0 }}><div className="t">{x.kind}: {x.description}</div><div className="s">{x.id} · {x.severity} · {x.status}</div></div></li>)}
            {!d.delayed.length && !d.openIssues.length && !d.safetyOpen.length && <li><div className="empty sm">Nothing open.</div></li>}
          </ul>
        </Card>
      </div>

      <Card title="Recent updates" sub="Your records and the Site Engineer's responses" bodyClass="">
        {updates.length === 0 ? <div className="empty sm">No updates yet.</div> : (
          <ul className="list sk-alerts">
            {updates.map((u, i) => <li key={i} className="se-click" onClick={() => go(u.to)}><div style={{ minWidth: 0 }}><div className="t">{u.text}</div><div className="s">{u.by}</div></div><div className="r">{fmtStamp(u.at)}</div></li>)}
          </ul>
        )}
      </Card>
      <p className="cell-sub" style={{ marginTop: 10 }}>Demo data for Sunrise Heights, Tower A. Changes are kept in this browser tab only and reset on reload; they are not saved to a server or shared with other users.</p>
    </>
  )
}
