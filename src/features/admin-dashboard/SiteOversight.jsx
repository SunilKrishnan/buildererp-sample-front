import { Link } from 'react-router-dom'
import DataTable from '../../components/DataTable.jsx'
import SummaryCard from '../../components/SummaryCard.jsx'
import { Badge, Card, Progress } from '../../components/UI.jsx'
import { projects } from '../../data/mockData.js'
import { PROJECT_MANAGERS } from '../../data/demo/inventoryDemo.js'
import { siteOf, taskView } from '../../services/site.js'
import { useInventory } from '../store-keeper/InventoryContext.jsx'
import { useSite } from '../site-engineer/SiteContext.jsx'

/**
 * Admin oversight of site work, live from the shared site and stores records. Admin watches;
 * the Project Manager reviews daily reports, delays and material requirements.
 */
export default function SiteOversight({ compact = false, onOpen }) {
  const { state: s } = useSite()
  const inv = useInventory()
  const tasks = s.tasks.map((t) => taskView(s, t))
  const sites = [...new Set(s.assignments.flatMap((a) => a.siteIds))]
  const activeProjects = projects.filter((p) => p.status !== 'Completed')
  const delayedProjects = [...new Set(tasks.filter((t) => t.status === 'Delayed').map((t) => t.projectId))]
  const dprWaiting = s.reports.filter((r) => r.status === 'Submitted')
  const critical = s.issues.filter((i) => !['Resolved', 'Closed'].includes(i.status) && (i.priority === 'Critical' || i.escalated))
  const safetyEsc = s.safety.filter((x) => ['High', 'Critical'].includes(x.severity) && !['Verified closed', 'Action done'].includes(x.status))
  const poPending = inv.poViews.filter((p) => p.status === 'Pending Approval')
  const adjPending = inv.state.adjustments.filter((a) => a.status === 'Pending Review')
  const reviews = s.inspections.filter((q) => q.reviewStatus === 'Awaiting QA review').length + s.safety.filter((x) => x.status === 'Action done').length

  const cards = [
    { label: 'Active projects / sites', value: `${activeProjects.length} / ${sites.length}`, sub: 'With site teams assigned', icon: 'building', to: () => onOpen?.('projects') },
    { label: 'Projects with delayed work', value: delayedProjects.length, sub: `${tasks.filter((t) => t.status === 'Delayed').length} delayed task(s)`, icon: 'alert', tone: delayedProjects.length ? 'danger' : undefined, link: '/dashboards/project-manager?tab=schedule' },
    { label: 'Daily reports with PM', value: dprWaiting.length, sub: 'Awaiting Project Manager review (oversight)', icon: 'trend', link: '/dashboards/project-manager?tab=reports' },
    { label: 'Critical issues / safety escalations', value: `${critical.length} / ${safetyEsc.length}`, sub: 'Open, escalated or critical', icon: 'clipboard', tone: critical.length + safetyEsc.length ? 'warning' : undefined, to: () => onOpen?.('approvals') },
    { label: 'POs awaiting approval', value: poPending.length, sub: 'Above the Purchase Manager limit', icon: 'cart', tone: poPending.length ? 'warning' : undefined, to: () => onOpen?.('approvals') },
    { label: 'Stock adjustments / QA & safety reviews', value: `${adjPending.length} / ${reviews}`, sub: 'Waiting for Admin', icon: 'check', to: () => onOpen?.('approvals') },
  ]
  const rows = activeProjects.map((p) => {
    const t = tasks.filter((x) => x.projectId === p.id)
    return {
      id: p.id, name: p.name, stage: p.stage, progress: p.progress, pm: PROJECT_MANAGERS[p.id],
      scheduled: t.length ? Math.round(t.reduce((a, x) => a + x.pct, 0) / t.length) : null,
      delayed: t.filter((x) => x.status === 'Delayed'),
      issues: s.issues.filter((i) => i.projectId === p.id && !['Resolved', 'Closed'].includes(i.status)),
      escalations: s.safety.filter((x) => x.projectId === p.id && ['High', 'Critical'].includes(x.severity) && x.status !== 'Verified closed').length,
      dpr: s.reports.filter((r) => r.projectId === p.id && r.status === 'Submitted').length,
    }
  })

  return (
    <>
      <div className="section-title"><h2>Site oversight</h2><span className="cell-sub">Live from the site, stores and purchase records</span></div>
      <div className="summary-grid">
        {cards.map((c) => (c.link
          ? <Link key={c.label} to={c.link} className="se-card-link"><SummaryCard label={c.label} value={c.value} sub={c.sub} icon={c.icon} tone={c.tone} /></Link>
          : <SummaryCard key={c.label} label={c.label} value={c.value} sub={c.sub} icon={c.icon} tone={c.tone} onClick={c.to} />))}
      </div>
      {!compact && (
        <Card title="Project progress and significant delays" sub="Overall progress from the project record; scheduled work from submitted daily reports" bodyClass="" className="mb">
          <DataTable dense rowKey="id" rows={rows} columns={[
            { key: 'name', header: 'Project', render: (r) => <><Link className="link-btn" to={`/projects/${r.id}`}>{r.name}</Link><div className="cell-sub">{r.stage} · PM {r.pm}</div></> },
            { key: 'p', header: 'Overall progress', render: (r) => <div style={{ minWidth: 120 }}><div className="prog-row"><span /><b>{r.progress}%</b></div><Progress value={r.progress} /></div> },
            { key: 's', header: 'Scheduled work done', align: 'num', render: (r) => (r.scheduled == null ? '—' : `${r.scheduled}%`) },
            { key: 'd', header: 'Delays', render: (r) => (r.delayed.length ? <span className="wrap-cell down">{r.delayed.map((t) => `${t.id} ${t.title} (${t.daysLate}d${t.delayReason ? `: ${t.delayReason}` : ''})`).join('; ')}</span> : <Badge tone="success">On schedule</Badge>) },
            { key: 'i', header: 'Open issues', align: 'num', render: (r) => <>{r.issues.length}{r.issues.some((i) => i.escalated) && <div className="cell-sub down">{r.issues.filter((i) => i.escalated).length} escalated</div>}</> },
            { key: 'e', header: 'Safety escalations', align: 'num', render: (r) => r.escalations },
            { key: 'r', header: 'Reports with PM', align: 'num', render: (r) => r.dpr },
            { key: 'x', header: '', render: (r) => <div className="cell-actions"><Link className="btn btn-sm" to="/dashboards/project-manager">PM reviews</Link><Link className="btn btn-sm" to="/site/reports">Site reports</Link></div> },
          ]} />
          <div className="card-body cell-sub">Sites: {sites.map((id) => siteOf(id)?.name).join(', ')}. Admin oversees; the Project Manager reviews daily reports, delays and material requirements.</div>
        </Card>
      )}
    </>
  )
}
