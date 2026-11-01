import { Link } from 'react-router-dom'
import DataTable from '../../components/DataTable.jsx'
import { Badge, Card, Chips, Progress } from '../../components/UI.jsx'
import { formatCompactINR, formatDate } from '../../utils/format.js'

export const PROJECT_STATUS_FILTERS = ['All', 'Active', 'On Track', 'Delayed', 'At Risk', 'Completed']

const matchStatus = (p, f) =>
  f === 'All' ||
  (f === 'Active' && p.status !== 'Completed') ||
  (f === 'Delayed' ? p.status === 'Delayed' || p.status === 'At Risk' : p.status === f)

const progressTone = (p) => (p.status === 'Completed' ? 'ok' : p.status === 'At Risk' ? 'bad' : p.status === 'Delayed' ? 'warn' : '')

export default function ProjectOverview({ projects, status = 'All', onStatusChange, search = '', limit }) {
  const q = search.toLowerCase()
  const rows = projects.filter(
    (p) => matchStatus(p, status) && (!q || `${p.name} ${p.location} ${p.manager}`.toLowerCase().includes(q))
  )

  const columns = [
    {
      key: 'name', header: 'Project',
      render: (p) => (
        <>
          <Link to={`/projects/${p.id}`} className="cell-main link">{p.name}</Link>
          <div className="cell-sub">{p.id} · {p.type}{p.stage ? ` · ${p.stage}` : ''}</div>
        </>
      ),
    },
    { key: 'location', header: 'Location' },
    { key: 'manager', header: 'Project Manager' },
    { key: 'startDate', header: 'Start', render: (p) => formatDate(p.startDate) },
    { key: 'deadline', header: 'Expected completion', render: (p) => formatDate(p.deadline) },
    {
      key: 'progress', header: 'Progress',
      render: (p) => (
        <div style={{ minWidth: 120 }}>
          <div className="prog-row"><b>{p.progress}%</b></div>
          <Progress value={p.progress} tone={progressTone(p)} />
        </div>
      ),
    },
    { key: 'budget', header: 'Budget', align: 'num', render: (p) => formatCompactINR(p.budgetAmount) },
    {
      key: 'actual', header: 'Actual spend', align: 'num',
      render: (p) => (
        <>
          <div>{formatCompactINR(p.actualAmount)}</div>
          <div className={`cell-sub ${p.budgetUsedPct > p.progress + 10 ? 'down' : ''}`}>{p.budgetUsedPct}% of budget</div>
        </>
      ),
    },
    { key: 'status', header: 'Status', render: (p) => <Badge>{p.status}</Badge> },
    { key: 'view', header: '', render: (p) => <Link className="btn btn-sm" to={`/projects/${p.id}`}>View</Link> },
  ]

  return (
    <Card title="Project Overview" sub="Budget figures and progress are demo values" bodyClass="">
      {onStatusChange && (
        <div className="toolbar" style={{ marginTop: 12 }}>
          <Chips options={PROJECT_STATUS_FILTERS} value={status} onChange={onStatusChange} />
        </div>
      )}
      <div style={{ marginTop: onStatusChange ? 0 : 12 }}>
        <DataTable columns={columns} rows={rows} limit={limit} emptyText="No projects match these filters." />
      </div>
    </Card>
  )
}
