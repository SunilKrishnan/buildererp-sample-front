import { Link } from 'react-router-dom'
import DataTable from '../../components/DataTable.jsx'
import StatGrid from '../../components/StatGrid.jsx'
import { Badge, Card } from '../../components/UI.jsx'
import * as Q from '../../services/qa.js'
import { todayISO } from '../../utils/date.js'
import { formatDate } from '../../utils/format.js'
import { useInventory } from '../store-keeper/InventoryContext.jsx'
import { useSite } from '../site-engineer/SiteContext.jsx'
import { materialName } from './shared.jsx'

/**
 * Read-only QA views for other dashboards, from the same records the QA Dashboard uses.
 * None of these change stock, purchases or payments.
 */

/** Store Keeper: QA test status of one GRN (QA never changes the quantities on it). */
export function GrnQuality({ grnId }) {
  const tests = useSite().state.materialTests.filter((t) => t.grnId === grnId)
  return (
    <>
      <dt>QA material tests</dt>
      <dd>{tests.length ? tests.map((t) => <div key={t.id}>{t.id} · {t.testType} · <Badge>{t.status}</Badge>{t.reviewNote && t.status !== 'Accepted' ? <div className="cell-sub">{t.reviewNote}</div> : null}</div>) : <span className="cell-sub">No QA test recorded</span>}
        <div className="cell-sub">QA records results only; stock quantities stay as recorded on this GRN.</div></dd>
    </>
  )
}

/** Purchase Manager: material quality issues by supplier / PO (rejected, retest, awaiting report). */
export function SupplierQualityCard() {
  const s = useSite().state
  const inv = useInventory()
  const rows = s.materialTests.filter((t) => t.poId && t.status !== 'Accepted').map((t) => ({ ...t, vendor: inv.state.purchaseOrders.find((p) => p.id === t.poId)?.vendor || '—' }))
  return (
    <Card title="Material quality on deliveries" sub="From QA test records against the GRNs; follow up with the supplier where QA rejects or asks for a retest" bodyClass="" className="section-gap">
      <DataTable dense rows={rows} emptyText="No open material quality issues." columns={[
        { key: 'v', header: 'Supplier / PO', render: (t) => <>{t.vendor}<div className="cell-sub">{t.poId} · {t.grnId || '—'}</div></> },
        { key: 'm', header: 'Material', render: (t) => materialName(t) },
        { key: 't', header: 'Test', render: (t) => <span className="cell-sub wrap-cell">{t.testType} · {t.lab}</span> },
        { key: 's', header: 'QA status', render: (t) => <><Badge>{t.status}</Badge>{t.reviewNote && <div className="cell-sub wrap-cell">{t.reviewNote}</div>}</> },
      ]} />
    </Card>
  )
}

/** Project Manager / Admin: quality summary, major defects and overdue actions. */
export function QaSummary({ projectIds = null, title = 'Quality (QA records)' }) {
  const s = useSite().state
  const today = todayISO()
  const inP = (r) => !projectIds || projectIds.includes(r.projectId)
  const insp = s.inspections.filter((q) => inP(q) && q.owner === 'QA')
  const done = insp.filter((q) => ['Passed', 'Failed', 'Conditional'].includes(q.status))
  const ncrs = s.ncrs.filter((n) => inP(n) && Q.ncrStatus(n) !== 'Closed')
  const major = ncrs.filter((n) => n.severity !== 'Minor')
  const overdue = ncrs.filter((n) => n.action && n.action.status !== 'Done' && n.action.due < today)
  const late = insp.filter((q) => Q.inspectionStatus(q, today) === 'Overdue')
  const cleared = insp.filter((q) => q.clearance)
  const watch = [...major, ...overdue.filter((n) => !major.includes(n))]
  return (
    <>
      <div className="section-title"><h2>{title}</h2><Link className="btn btn-sm" to="/dashboards/qa">QA Dashboard</Link></div>
      <StatGrid items={[
        { label: 'Inspections completed', value: done.length, sub: `${done.filter((q) => q.status === 'Passed').length} passed · ${done.filter((q) => q.status !== 'Passed').length} failed` },
        { label: 'Inspections overdue', value: late.length, tone: late.length ? 'warning' : undefined, sub: 'Scheduled, no result yet' },
        { label: 'Open NCRs', value: ncrs.length, sub: `${major.length} major / critical`, tone: major.length ? 'danger' : undefined },
        { label: 'Corrective actions overdue', value: overdue.length, tone: overdue.length ? 'danger' : undefined },
        { label: 'QA clearances', value: cleared.length, sub: 'e.g. cleared for concrete pour', tone: 'success' },
      ]} />
      <Card title="Major defects and overdue corrective actions" bodyClass="" className="mb">
        <DataTable dense rows={watch} emptyText="No major defects or overdue actions." columns={[
          { key: 'id', header: 'NCR', render: (n) => <><div className="cell-main">{n.id}</div><div className="cell-sub">{formatDate(n.reported)}</div></> },
          { key: 'd', header: 'Defect', render: (n) => <span className="wrap-cell">{n.description}</span> },
          { key: 's', header: 'Severity', render: (n) => <Badge>{n.severity}</Badge> },
          { key: 'a', header: 'Corrective action', render: (n) => <span className="cell-sub wrap-cell">{n.action ? `${n.action.text} · ${n.action.owner} · due ${formatDate(n.action.due)}` : '—'}</span> },
          { key: 'st', header: 'Status', render: (n) => <><Badge>{Q.ncrStatus(n)}</Badge>{n.action && n.action.status !== 'Done' && n.action.due < today && <div className="cell-sub down">overdue</div>}</> },
        ]} />
      </Card>
    </>
  )
}
