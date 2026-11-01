import { Link, useParams } from 'react-router-dom'
import StatGrid from '../components/StatGrid.jsx'
import { DemoTag, EmptyState } from '../components/StateViews.jsx'
import { Badge, Card, PageHead, Progress } from '../components/UI.jsx'
import { formatDate } from '../utils/format.js'
import { useDemoSession } from '../auth/DemoSession.jsx'
import { useSite } from '../features/site-engineer/SiteContext.jsx'
import { scopeFor } from '../services/site.js'
import { PROJECT_MANAGERS } from '../data/demo/inventoryDemo.js'

export default function ProjectDetails({ projects }) {
  const { projectId } = useParams()
  const { user, role } = useDemoSession()
  const site = useSite()
  const notAssigned = (role.id === 'siteengineer' && !scopeFor(site.state, user, role).projectIds.includes(projectId))
    || (role.id === 'projectmanager' && PROJECT_MANAGERS[projectId] !== user.name)
  const p = notAssigned ? null : projects.find((x) => x.id === projectId)

  if (!p) {
    return (
      <EmptyState
        title={notAssigned ? 'Not assigned to you' : 'Project not found'}
        message={notAssigned ? `You are not assigned to project ${projectId}. Ask the Project Manager for access.` : `No project with ID "${projectId}".`}
        action={<Link className="btn" to="/projects">Back to projects</Link>}
      />
    )
  }

  const used = p.budget ? Math.round((p.spent / p.budget) * 100) : 0

  return (
    <>
      <Link to="/projects" className="back-link">← All projects</Link>
      <PageHead title={p.name} sub={`${p.id} · ${p.type} · ${p.location}`}>
        <Badge>{p.status}</Badge>
        <DemoTag />
      </PageHead>

      <StatGrid
        items={[
          { label: 'Progress', value: `${p.progress}%` },
          { label: 'Budget', value: `₹${p.budget.toFixed(1)} Cr` },
          { label: 'Actual spend', value: `₹${p.spent.toFixed(1)} Cr`, sub: `${used}% of budget`, tone: used > p.progress + 10 ? 'danger' : undefined },
          { label: 'Units', value: p.units, sub: p.unitsSold != null ? `${p.unitsSold} sold${p.unitsBooked ? `, ${p.unitsBooked} booked` : ''}` : undefined },
        ]}
      />

      <div className="grid halves">
        <Card title="Project Information">
          <dl className="details">
            <dt>Project Manager</dt><dd>{p.manager}</dd>
            <dt>Location</dt><dd>{p.location}</dd>
            {p.stage && <><dt>Current stage</dt><dd>{p.stage}</dd></>}
            <dt>Start date</dt><dd>{p.startDate ? formatDate(p.startDate) : '—'}</dd>
            {p.completedOn ? (
              <>
                <dt>Completed on</dt><dd>{formatDate(p.completedOn)}</dd>
                {p.handoverBy && <><dt>Handover completed</dt><dd>{formatDate(p.handoverBy)}</dd></>}
              </>
            ) : (
              <><dt>Expected completion</dt><dd>{formatDate(p.deadline)}</dd></>
            )}
            <dt>Status</dt><dd><Badge>{p.status}</Badge></dd>
          </dl>
        </Card>
        <Card title="Progress vs Budget">
          <div className="prog-row"><span>Physical progress</span><b>{p.progress}%</b></div>
          <Progress value={p.progress} />
          <div className="prog-row" style={{ marginTop: 16 }}><span>Budget used</span><b>{used}%</b></div>
          <Progress value={used} tone={used > p.progress + 10 ? 'bad' : 'warn'} />
          <p className="cell-sub" style={{ marginTop: 16 }}>
            Detailed project module (schedule, BOQ, documents) is planned for a later phase.
          </p>
          <Link className="btn" to={`/dashboard?project=${p.id}`}>Open dashboard for this project</Link>
        </Card>
      </div>
    </>
  )
}
