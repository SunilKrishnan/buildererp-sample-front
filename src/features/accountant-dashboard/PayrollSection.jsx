import DataTable from '../../components/DataTable.jsx'
import StatGrid from '../../components/StatGrid.jsx'
import Icon from '../../components/Icon.jsx'
import { Badge, Card, Progress } from '../../components/UI.jsx'
import { formatCompactINR, formatDate, formatINR, formatNumber } from '../../utils/format.js'
import { LockedNote, SectionToolbar, UndoButton } from './shared.jsx'
import { useSite } from '../site-engineer/SiteContext.jsx'
import { attendanceSummary, siteOf } from '../../services/site.js'
import { addDays, todayISO } from '../../utils/date.js'

/** Daily muster recorded by the Site Supervisor in this session: read-only input for payroll checks. */
function SupervisorMuster() {
  const site = useSite()
  const recs = site.state.attendanceRecords || []
  const sites = [...new Set(recs.map((a) => a.siteId))]
  const rows = sites.flatMap((id) => Array.from({ length: 7 }, (_, i) => addDays(todayISO(), -i)).map((date) => ({ key: `${id}-${date}`, siteId: id, date, ...attendanceSummary(site.state, id, date) })).filter((r) => r.recorded))
  return (
    <Card title="Site muster (Site Supervisor)" sub="Named-worker attendance recorded on site, last 7 days. Read-only here: worker-days for checking payroll; wages are still paid only through the approved weekly batch." bodyClass="" className="mb">
      <DataTable dense rowKey="key" rows={rows} emptyText="No muster recorded yet." columns={[
        { key: 'date', header: 'Date', render: (r) => formatDate(r.date) },
        { key: 'site', header: 'Site', render: (r) => siteOf(r.siteId)?.name },
        { key: 'p', header: 'Present', align: 'num', render: (r) => r.present },
        { key: 'h', header: 'Half day', align: 'num', render: (r) => r.halfDay },
        { key: 'a', header: 'Absent', align: 'num', render: (r) => r.absent },
        { key: 'l', header: 'On leave', align: 'num', render: (r) => r.onLeave },
        { key: 'wd', header: 'Worker-days', align: 'num', render: (r) => <b>{r.present + r.halfDay / 2}</b> },
      ]} />
    </Card>
  )
}

export const PAYROLL_STATUSES = ['All', 'Awaiting Verification', 'Pending Approval', 'Approved', 'Paid']
const sumOf = (rows, k) => rows.reduce((s, r) => s + r[k], 0)

/** Direct labour wages from verified attendance, with labour advances.
 * Contractor bills and staff salaries are separate pages (different kinds of payment). */
export default function PayrollSection({ payroll, status = 'All', onStatusChange, perms, onAct, onUndo, notify, compact = false }) {
  const { canVerifyPayroll, canApprovePayroll } = perms
  const batches = payroll.batches.filter((b) => (compact ? b.status !== 'Paid' : status === 'All' || b.status === status))

  const batchAction = (r) => {
    if (r.changed) return <UndoButton onClick={() => onUndo('payroll', r)} />
    if (r.status === 'Awaiting Verification') {
      if (r.verifiedDays < r.workerDays) {
        return (
          <div className="cell-actions">
            <LockedNote>Attendance not fully verified</LockedNote>
            <button className="btn btn-sm" onClick={() => notify(`Demo: reminder to site engineer not sent. ${r.id} is unchanged.`)}>Remind site</button>
          </div>
        )
      }
      if (!canVerifyPayroll) return <LockedNote>View only</LockedNote>
      return (
        <button className="btn btn-sm btn-primary" onClick={() => onAct('payroll', r, 'Pending Approval', `Demo: ${r.id} verified on screen only and sent for Admin approval. Nothing saved.`)}>
          Verify payroll
        </button>
      )
    }
    if (r.status === 'Pending Approval') {
      if (!canApprovePayroll) return <LockedNote>Awaiting Admin approval</LockedNote>
      return (
        <button className="btn btn-sm btn-primary" onClick={() => onAct('payroll', r, 'Approved', `Demo: ${r.id} approved on screen only. No wages paid.`)}>
          Approve
        </button>
      )
    }
    if (r.status === 'Approved') return <span className="cell-sub">Ready for release</span>
    return <span className="cell-sub">Paid {r.paidOn ? formatDate(r.paidOn) : ''}</span>
  }

  const batchColumns = [
    {
      key: 'id', header: 'Batch',
      render: (r) => <><div className="cell-main">{r.id}</div><div className="cell-sub">Week ending {formatDate(r.weekEnding)} · {formatNumber(r.workers)} workers</div></>,
    },
    {
      key: 'verified', header: 'Verified attendance',
      render: (r) => {
        const pct = Math.round((r.verifiedDays / r.workerDays) * 100)
        return (
          <div className="attendance-cell">
            <Progress value={pct} tone={pct >= 100 ? 'ok' : 'warn'} />
            <span className="cell-sub">{formatNumber(r.verifiedDays)} / {formatNumber(r.workerDays)} worker-days</span>
          </div>
        )
      },
    },
    {
      key: 'gross', header: 'Wages', align: 'num',
      render: (r) => (
        <>
          <div>{formatINR(r.gross)}</div>
          <div className="cell-sub">
            OT +{formatINR(r.overtime)}{r.advanceRecovery ? ` · Adv −${formatINR(r.advanceRecovery)}` : ''}
          </div>
        </>
      ),
    },
    { key: 'net', header: 'Net payable', align: 'num', render: (r) => <b>{formatINR(r.net)}</b> },
    { key: 'status', header: 'Status', render: (r) => <Badge>{r.status}</Badge> },
    { key: 'actions', header: 'Action', render: batchAction },
  ]

  const attendanceNote = (
    <div className="info-note">
      <Icon name="lock" size={14} />
      <span>
        Attendance comes from site-verified muster rolls and is <b>read-only</b> here. Wages are calculated as verified
        worker-days × daily rate. Corrections need an Attendance Correction request approved by the Site Engineer or Admin.
      </span>
    </div>
  )

  if (compact) {
    return (
      <Card title="Payroll In Progress" sub="Batches not yet paid" bodyClass="" className="mb">
        <DataTable rows={batches} columns={batchColumns.filter((c) => c.key !== 'gross')} emptyText="No payroll batches in progress." />
      </Card>
    )
  }

  const all = payroll.batches
  const paid = all.filter((b) => b.status === 'Paid')
  const awaitingApproval = all.filter((b) => b.status === 'Pending Approval')
  const latest = all[0]
  return (
    <>
      <StatGrid
        items={[
          { label: 'Wages paid', value: formatCompactINR(sumOf(paid, 'net')), sub: `${paid.length} weekly batches`, tone: 'success' },
          { label: 'Payroll awaiting approval', value: formatCompactINR(sumOf(awaitingApproval, 'net')), sub: `${awaitingApproval.length} batches`, tone: awaitingApproval.length ? 'warning' : undefined },
          { label: 'Latest week attendance verified', value: latest ? `${Math.round((latest.verifiedDays / latest.workerDays) * 100)}%` : '-', sub: latest ? `Week ending ${formatDate(latest.weekEnding)}` : undefined },
          { label: 'Wages to process', value: formatCompactINR(payroll.payrollOpen), sub: 'Unpaid weekly batches' },
          { label: 'Advances outstanding', value: formatCompactINR(payroll.advancesOutstanding), sub: `${payroll.advances.length} workers` },
        ]}
      />

      {attendanceNote}
      <SupervisorMuster />

      <Card title="Weekly Payroll" sub="Direct labour, calculated from verified attendance" bodyClass="" className="mb">
        <SectionToolbar statuses={PAYROLL_STATUSES} status={status} onStatusChange={onStatusChange} />
        <DataTable dense rows={batches} columns={batchColumns} emptyText="No payroll batches match these filters." />
      </Card>

      <Card title="Labour Advances" sub="Outstanding, recovered through payroll" bodyClass="" className="mb">
          <DataTable
            rows={payroll.advances}
            emptyText="No outstanding advances."
            columns={[
              { key: 'labourer', header: 'Worker', render: (r) => <><div className="cell-main">{r.labourer}</div><div className="cell-sub">{r.id} · {formatDate(r.date)}</div></> },
              { key: 'amount', header: 'Given', align: 'num', render: (r) => formatINR(r.amount) },
              { key: 'recovered', header: 'Recovered', align: 'num', render: (r) => formatINR(r.recovered) },
              { key: 'outstanding', header: 'Outstanding', align: 'num', render: (r) => formatINR(r.outstanding) },
            ]}
          />
      </Card>
    </>
  )
}
