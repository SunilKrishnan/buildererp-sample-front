import DataTable from '../../components/DataTable.jsx'
import StatGrid from '../../components/StatGrid.jsx'
import { Badge, Card } from '../../components/UI.jsx'
import { formatDateShort, relativeDay } from '../../utils/format.js'

export default function QualitySafety({ quality, compact = false }) {
  const q = quality
  const openDefects = q.defects.filter((d) => d.status !== 'Closed')
  const openIncidents = q.incidents.filter((i) => i.status !== 'Closed')
  const overdueTasks = q.safetyTasks.filter((t) => t.status === 'Overdue')

  const stats = (
    <StatGrid
      items={[
        { label: 'Pending inspections', value: q.inspections.length, sub: `${q.inspections.filter((i) => i.status === 'Overdue').length} overdue` },
        { label: 'Open defects', value: openDefects.length, tone: openDefects.some((d) => d.severity === 'Critical') ? 'danger' : undefined },
        { label: 'Corrective actions open', value: q.correctiveActions.length },
        { label: 'Safety incidents (range)', value: q.incidents.length, sub: `${openIncidents.length} under investigation`, tone: openIncidents.length ? 'danger' : undefined },
        { label: 'Safety tasks', value: q.safetyTasks.length, sub: `${overdueTasks.length} overdue`, tone: overdueTasks.length ? 'warning' : undefined },
      ]}
    />
  )
  if (compact) return stats

  return (
    <>
      {stats}
      <div className="grid halves">
        <Card title="Pending Inspections" bodyClass="">
          <DataTable
            rows={q.inspections}
            columns={[
              { key: 'item', header: 'Inspection', render: (r) => <><div className="cell-main">{r.item}</div><div className="cell-sub">{r.projectName}</div></> },
              { key: 'date', header: 'Scheduled', render: (r) => `${formatDateShort(r.date)} · ${relativeDay(r.date)}` },
              { key: 'inspector', header: 'Inspector' },
              { key: 'status', header: 'Status', render: (r) => <Badge>{r.status}</Badge> },
            ]}
          />
        </Card>
        <Card title="Reported Defects" bodyClass="">
          <DataTable
            rows={openDefects}
            columns={[
              { key: 'description', header: 'Defect', render: (r) => <><div className="cell-main">{r.description}</div><div className="cell-sub">{r.id} · {r.projectName}</div></> },
              { key: 'severity', header: 'Severity', render: (r) => <Badge>{r.severity}</Badge> },
              { key: 'reported', header: 'Reported', render: (r) => relativeDay(r.reported) },
              { key: 'status', header: 'Status', render: (r) => <Badge>{r.status}</Badge> },
            ]}
          />
        </Card>
      </div>

      <Card title="Corrective Actions" bodyClass="" className="mb">
        <DataTable
          rows={q.correctiveActions}
          emptyText="No open corrective actions."
          columns={[
            { key: 'id', header: 'CA #' },
            { key: 'defectId', header: 'Defect' },
            { key: 'action', header: 'Action' },
            { key: 'owner', header: 'Owner' },
            { key: 'due', header: 'Due', render: (r) => <span className={relativeDay(r.due).includes('ago') ? 'down' : ''}>{relativeDay(r.due)}</span> },
            { key: 'status', header: 'Status', render: (r) => <Badge>{r.status}</Badge> },
          ]}
        />
      </Card>

      <div className="grid halves">
        <Card title="Safety Incidents" sub="Selected date range" bodyClass="">
          <DataTable
            rows={q.incidents}
            emptyText="No incidents in this period."
            columns={[
              { key: 'date', header: 'Date', render: (r) => formatDateShort(r.date) },
              { key: 'type', header: 'Type', render: (r) => <Badge>{r.type}</Badge> },
              { key: 'description', header: 'Description', render: (r) => <><div>{r.description}</div><div className="cell-sub">{r.projectName}</div></> },
              { key: 'status', header: 'Status', render: (r) => <Badge>{r.status}</Badge> },
            ]}
          />
        </Card>
        <Card title="Safety Tasks" bodyClass="">
          <DataTable
            rows={q.safetyTasks}
            columns={[
              { key: 'task', header: 'Task', render: (r) => <><div className="cell-main">{r.task}</div><div className="cell-sub">{r.projectName}</div></> },
              { key: 'owner', header: 'Owner' },
              { key: 'due', header: 'Due', render: (r) => relativeDay(r.due) },
              { key: 'status', header: 'Status', render: (r) => <Badge tone={r.status === 'Overdue' ? 'danger' : 'warning'}>{r.status}</Badge> },
            ]}
          />
        </Card>
      </div>
    </>
  )
}
