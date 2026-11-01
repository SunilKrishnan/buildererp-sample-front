import { useState } from 'react'
import { Link } from 'react-router-dom'
import Icon from '../components/Icon.jsx'
import { Badge, Card, Chips, PageHead, Progress } from '../components/UI.jsx'
import { formatCr } from '../data/mockData.js'
import { useDemoSession } from '../auth/DemoSession.jsx'
import { useSite } from '../features/site-engineer/SiteContext.jsx'
import { scopeFor } from '../services/site.js'
import { PROJECT_MANAGERS } from '../data/demo/inventoryDemo.js'

const filters = ['All', 'On Track', 'Delayed', 'At Risk', 'Completed']

export default function Projects({ projects: allProjects, search }) {
  const [filter, setFilter] = useState('All')
  const { user, role } = useDemoSession()
  const site = useSite()
  // A Site Engineer sees only assigned projects, even when opening this page by URL
  const projects = role.id === 'siteengineer' ? allProjects.filter((p) => scopeFor(site.state, user, role).projectIds.includes(p.id))
    : role.id === 'projectmanager' ? allProjects.filter((p) => PROJECT_MANAGERS[p.id] === user.name) : allProjects
  const q = search.toLowerCase()

  const list = projects.filter(
    (p) =>
      (filter === 'All' || p.status === filter) &&
      (!q || `${p.name} ${p.location} ${p.type} ${p.manager}`.toLowerCase().includes(q))
  )

  return (
    <>
      <PageHead title="Projects" sub={`${projects.length} project${projects.length === 1 ? '' : 's'} ·${formatCr(projects.reduce((s, p) => s + p.budget, 0))} total value`} />

      <Card bodyClass="" className="" >
        <div className="toolbar" style={{ borderBottom: 0 }}>
          <Chips options={filters} value={filter} onChange={setFilter} />
        </div>
      </Card>

      <div className="grid cards-3" style={{ marginTop: 16 }}>
        {list.map((p) => (
          <div key={p.id} className="card proj">
            <div className="proj-top">
              <div>
                <h3><Link to={`/projects/${p.id}`} className="link">{p.name}</Link></h3>
                <div className="loc"><Icon name="pin" />{p.location} · {p.type}</div>
              </div>
              <Badge>{p.status}</Badge>
            </div>
            <div>
              <div className="prog-row"><span>Progress</span><b>{p.progress}%</b></div>
              <Progress value={p.progress} tone={p.status === 'Completed' ? 'ok' : p.status === 'At Risk' ? 'bad' : p.status === 'Delayed' ? 'warn' : ''} />
            </div>
            <div className="proj-meta">
              <div><div className="k">Budget</div><div className="v">{formatCr(p.budget)}</div></div>
              <div><div className="k">Spent</div><div className="v">{formatCr(p.spent)}</div></div>
              <div><div className="k">Units</div><div className="v">{p.units}</div></div>
            </div>
            <div className="prog-row" style={{ margin: 0 }}>
              <span>👤 {p.manager}</span>
              <span>
                {p.completedOn ? 'Completed' : 'Due'}{' '}
                {new Date(p.completedOn || p.deadline).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })}
              </span>
            </div>
          </div>
        ))}
      </div>
      {list.length === 0 && <div className="card empty">No projects match your filters.</div>}
    </>
  )
}
