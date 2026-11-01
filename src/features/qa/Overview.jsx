import DataTable from '../../components/DataTable.jsx'
import Icon from '../../components/Icon.jsx'
import { Badge, Card } from '../../components/UI.jsx'
import { projects } from '../../data/mockData.js'
import * as Q from '../../services/qa.js'
import { formatDate } from '../../utils/format.js'
import { fmtStamp } from '../store-keeper/shared.jsx'
import { CardGrid, InspStatus, materialName, qaNotifications, useQA } from './shared.jsx'

export default function Overview({ notify, go }) {
  const ctx = useQA(notify)
  const { s, today } = ctx
  const insp = ctx.qaInspections
  const st = (q) => Q.inspectionStatus(q, today)
  const scheduled = insp.filter((q) => st(q) === 'Scheduled')
  const pending = insp.filter((q) => ['Overdue', 'In Progress'].includes(st(q)))
  const completed = insp.filter((q) => ['Passed', 'Failed', 'Conditional'].includes(q.status))
  const failed = insp.filter((q) => ['Failed', 'Conditional'].includes(q.status))
  const openNcr = s.ncrs.filter((n) => Q.ncrStatus(n) !== 'Closed')
  const overdueCa = openNcr.filter((n) => n.action && n.action.status !== 'Done' && n.action.due < today)
  const testsPending = s.materialTests.filter((t) => ['Sample Taken', 'Awaiting Report', 'Report Received', 'Retest Required'].includes(t.status))
  const reinspDue = openNcr.filter((n) => Q.ncrStatus(n) === 'Reinspection Required' || ['Awaiting Verification'].includes(Q.ncrStatus(n)))
  const todays = insp.filter((q) => q.date === today && Q.OPEN_INSPECTION.includes(q.status)).sort((a, b) => (a.time || '').localeCompare(b.time || ''))
  const upcoming = insp.filter((q) => q.date > today && Q.OPEN_INSPECTION.includes(q.status)).sort((a, b) => a.date.localeCompare(b.date)).slice(0, 6)
  const recent = insp.filter((q) => q.recordedAt).sort((a, b) => b.recordedAt.localeCompare(a.recordedAt)).slice(0, 6)
  const needAction = openNcr.filter((n) => ['Open', 'Assigned', 'Correction in Progress', 'Returned for Correction'].includes(Q.ncrStatus(n)))
  const reports = s.materialTests.filter((t) => t.testDate).sort((a, b) => b.testDate.localeCompare(a.testDate)).slice(0, 5)
  const alerts = qaNotifications(ctx).filter((n) => n.tone === 'danger' || n.kind === 'Correction to verify' || n.kind === 'New inspection request').slice(0, 6)
  const byProject = projects.map((p) => {
    const pi = insp.filter((q) => q.projectId === p.id)
    const done = pi.filter((q) => ['Passed', 'Failed', 'Conditional'].includes(q.status))
    return { id: p.id, name: p.name, total: pi.length, done: done.length, passed: done.filter((q) => q.status === 'Passed').length, open: s.ncrs.filter((n) => n.projectId === p.id && Q.ncrStatus(n) !== 'Closed').length, major: s.ncrs.filter((n) => n.projectId === p.id && Q.ncrStatus(n) !== 'Closed' && n.severity !== 'Minor').length }
  }).filter((p) => p.total || p.open)

  return (
    <>
      <CardGrid items={[
        { label: 'Inspections Scheduled', value: scheduled.length, sub: `${todays.length} today`, onClick: () => go('schedule', 'status=Scheduled') },
        { label: 'Inspections Pending', value: pending.length, sub: 'Past date or draft, no result', tone: pending.length ? 'warning' : undefined, onClick: () => go('schedule', 'status=pending') },
        { label: 'Inspections Completed', value: completed.length, sub: 'Result submitted', tone: 'success', onClick: () => go('records', 'status=completed') },
        { label: 'Inspections Failed', value: failed.length, sub: 'Fail or conditional', tone: failed.length ? 'danger' : undefined, onClick: () => go('records', 'status=Failed') },
        { label: 'Open Defects', value: openNcr.length, sub: `${openNcr.filter((n) => n.severity !== 'Minor').length} major / critical`, tone: openNcr.length ? 'warning' : undefined, onClick: () => go('ncr', 'status=open') },
        { label: 'Corrective Actions Overdue', value: overdueCa.length, tone: overdueCa.length ? 'danger' : undefined, onClick: () => go('actions', 'status=overdue') },
        { label: 'Material Tests Pending', value: testsPending.length, sub: `${s.materialTests.filter((t) => t.status === 'Report Received').length} reports to review`, onClick: () => go('materials', 'status=pending') },
        { label: 'Reinspections Due', value: reinspDue.length, sub: 'Verify / reinspect', tone: reinspDue.length ? 'warning' : undefined, onClick: () => go('reinspection') },
      ]} />

      {ctx.perms.manage && (
        <div className="jv-submit" style={{ margin: '4px 0 16px', flexWrap: 'wrap' }}>
          <button className="btn btn-primary" onClick={() => go('schedule', 'new=1')}><Icon name="plus" size={14} />Create inspection</button>
          <button className="btn" onClick={() => go('ncr', 'new=1')}><Icon name="alert" size={14} />Record defect</button>
          <button className="btn" onClick={() => go('materials', 'new=1')}><Icon name="box" size={14} />Add test result</button>
        </div>
      )}

      <div className="grid halves">
        <Card title="Today's inspection schedule" sub={formatDate(today)} bodyClass="">
          <DataTable dense rows={todays} emptyText="No inspections scheduled today." columns={[
            { key: 't', header: 'Time', render: (q) => q.time || '—' },
            { key: 'w', header: 'Inspection', render: (q) => <button className="link-btn" onClick={() => go('records', `open=${q.id}`)}>{q.title}</button> },
            { key: 'l', header: 'Location', render: (q) => <span className="cell-sub">{q.location}</span> },
            { key: 'i', header: 'Inspector', render: (q) => q.inspector },
          ]} />
        </Card>
        <Card title="Urgent quality alerts" sub="From the shared records; nothing is sent" bodyClass="">
          <DataTable dense rows={alerts} emptyText="No urgent alerts." columns={[
            { key: 'k', header: 'Alert', render: (n) => <Badge tone={n.tone || 'info'}>{n.kind}</Badge> },
            { key: 'r', header: 'Ref.', render: (n) => <button className="link-btn" onClick={() => go(n.section)}>{n.ref}</button> },
            { key: 't', header: 'Details', render: (n) => <span className="wrap-cell cell-sub">{n.text}</span> },
          ]} />
        </Card>
      </div>

      <div className="grid halves section-gap">
        <Card title="Recent inspection results" bodyClass="">
          <DataTable dense rows={recent} emptyText="No results recorded yet." columns={[
            { key: 'id', header: 'Inspection', render: (q) => <><button className="link-btn" onClick={() => go('records', `open=${q.id}`)}>{q.id}</button><div className="cell-sub">{q.title}</div></> },
            { key: 'd', header: 'Recorded', render: (q) => fmtStamp(q.recordedAt) },
            { key: 's', header: 'Result', render: (q) => <InspStatus q={q} today={today} /> },
          ]} />
        </Card>
        <Card title="Defects requiring action" bodyClass="">
          <DataTable dense rows={needAction} emptyText="No defects waiting for correction." columns={[
            { key: 'id', header: 'NCR', render: (n) => <button className="link-btn" onClick={() => go('ncr', `open=${n.id}`)}>{n.id}</button> },
            { key: 'd', header: 'Defect', render: (n) => <span className="wrap-cell">{n.description}</span> },
            { key: 'o', header: 'Responsible', render: (n) => <>{n.action?.owner || n.responsible || '—'}<div className={`cell-sub ${n.action?.due < today ? 'down' : ''}`}>due {n.action?.due ? formatDate(n.action.due) : '—'}</div></> },
            { key: 's', header: 'Status', render: (n) => <Badge>{Q.ncrStatus(n)}</Badge> },
          ]} />
        </Card>
      </div>

      <div className="grid halves section-gap">
        <Card title="Upcoming inspections" bodyClass="">
          <DataTable dense rows={upcoming} emptyText="Nothing scheduled after today." columns={[
            { key: 'd', header: 'Date', render: (q) => `${formatDate(q.date)} ${q.time || ''}` },
            { key: 'w', header: 'Inspection', render: (q) => <button className="link-btn" onClick={() => go('records', `open=${q.id}`)}>{q.title}</button> },
            { key: 'p', header: 'Priority', render: (q) => <Badge>{q.priority || 'Normal'}</Badge> },
          ]} />
        </Card>
        <Card title="Recently submitted test reports" bodyClass="">
          <DataTable dense rows={reports} emptyText="No test reports yet." columns={[
            { key: 'id', header: 'Test', render: (t) => <><button className="link-btn" onClick={() => go('materials', `open=${t.id}`)}>{t.id}</button><div className="cell-sub">{materialName(t)}</div></> },
            { key: 't', header: 'Type', render: (t) => <span className="cell-sub wrap-cell">{t.testType}</span> },
            { key: 's', header: 'Status', render: (t) => <Badge>{t.status}</Badge> },
          ]} />
        </Card>
      </div>

      <Card title="Project-wise quality summary" sub="Counts from the recorded inspections and NCRs" bodyClass="" className="section-gap">
        <DataTable dense rows={byProject} emptyText="No quality records." columns={[
          { key: 'n', header: 'Project', render: (p) => <span className="cell-main">{p.name}</span> },
          { key: 't', header: 'Inspections', align: 'num', render: (p) => p.total },
          { key: 'd', header: 'Completed', align: 'num', render: (p) => p.done },
          { key: 'r', header: 'Pass rate', align: 'num', render: (p) => (p.done ? `${Math.round((p.passed / p.done) * 100)}%` : '—') },
          { key: 'o', header: 'Open NCRs', align: 'num', render: (p) => p.open },
          { key: 'm', header: 'Major / critical open', align: 'num', render: (p) => <span className={p.major ? 'down' : ''}>{p.major}</span> },
        ]} />
      </Card>
    </>
  )
}
