import { useCallback, useMemo } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import DataTable from '../../components/DataTable.jsx'
import Icon from '../../components/Icon.jsx'
import { Badge, Card, Chips, PageHead } from '../../components/UI.jsx'
import { DemoTag, ErrorState, LoadingState } from '../../components/StateViews.jsx'
import { useDemoSession } from '../../auth/DemoSession.jsx'
import { formatDate, formatINR } from '../../utils/format.js'
import { stageOf, useBillWorkflow } from './BillWorkflowContext.jsx'
import { approvalRuleFor, approverCheck, holdReasons, reportFor } from './billRules.js'
import { useBillReviews } from './useBillReviews.js'
import BillReviewPanel, { AiBadge, RecordChips } from './BillReviewPanel.jsx'

const VIEWS = ['Awaiting decision', 'Decided', 'All in workflow']

/** Approver's view: supplier bills forwarded by the Accountant, with evidence, notes and AI findings. */
export default function BillApprovals({ notify }) {
  const { user, role } = useDemoSession()
  const { stateOf } = useBillWorkflow()
  const { status, data, error } = useBillReviews()
  const [params, setParams] = useSearchParams()
  const view = VIEWS.includes(params.get('view')) ? params.get('view') : VIEWS[0]
  const billId = params.get('bill')
  const billTab = params.get('btab') || 'review'

  const rows = useMemo(() => {
    if (!data) return []
    return data.bills
      .map((b) => {
        const s = stateOf(b)
        if (s.historic || s.approval === 'Not submitted') return null
        const rec = reportFor(b, s, data.bills)
        const rule = approvalRuleFor(s.recommendedAmount ?? b.amount, data.approvalRules)
        return { ...b, s, rec, stage: stageOf(s), held: holdReasons(rec.report, s), check: approverCheck({ state: s, report: rec.report, user, role, rule }), rule }
      })
      .filter(Boolean)
      .filter((r) => view === 'All in workflow' || (view === 'Awaiting decision' ? r.s.approval.startsWith('Awaiting') : !r.s.approval.startsWith('Awaiting')))
  }, [data, stateOf, view, user, role])

  const set = useCallback((patch) => {
    const next = new URLSearchParams(params)
    Object.entries(patch).forEach(([k, v]) => (v ? next.set(k, v) : next.delete(k)))
    setParams(next)
  }, [params, setParams])

  const open = data && billId ? data.bills.find((b) => b.id === billId) : null

  return (
    <>
      <Link className="back-link" to={role.id === 'admin' ? '/dashboard' : '/accounts/expenses'}>‹ {role.id === 'admin' ? 'Admin Dashboard' : 'Expenses & Bills'}</Link>
      <PageHead title="Bill Approvals" sub="Supplier bills verified by Accounts and waiting for an authorised decision">
        <DemoTag />
      </PageHead>

      {status === 'error' ? <ErrorState message={error?.message} /> : !data ? <LoadingState blocks={2} /> : (
        <>
          <div className="info-note">
            <Icon name="check" size={14} />
            <span>
              Approval rules (demo configuration): {data.approvalRules.map((r) => r.label).join(' · ')}. The approver must be a different person from the
              verifier, and bills with missing mandatory records or unreviewed discrepancies stay held. You are viewing as <b>{role.label}</b>.
            </span>
          </div>
          <Card title="Supplier bills" sub="Open a bill to see the supplier bill, purchase order, site confirmation, AI comparison and the accountant's notes" bodyClass="" className="mb">
            <div className="toolbar"><Chips options={VIEWS} value={view} onChange={(v) => set({ view: v === VIEWS[0] ? null : v })} /></div>
            <DataTable
              dense
              rows={rows}
              emptyText={view === 'Awaiting decision' ? 'No bills are waiting for approval. The Accountant forwards bills from Expenses & Bills.' : 'Nothing here yet.'}
              columns={[
                { key: 'bill', header: 'Bill', render: (r) => <><div className="cell-main">{r.vendor}</div><div className="cell-sub">{r.billNo} · {formatDate(r.date)} · {r.projectName}</div></> },
                {
                  key: 'amount', header: 'Amount', align: 'num',
                  render: (r) => (
                    <>
                      <div>{formatINR(r.amount)}</div>
                      {r.s.recommendedAmount != null && r.s.recommendedAmount !== r.amount && <div className="cell-sub down">recommended {formatINR(r.s.recommendedAmount)}</div>}
                      {r.s.advanceAdjust > 0 && <div className="cell-sub">− advance {formatINR(r.s.advanceAdjust)} · net {formatINR((r.s.recommendedAmount ?? r.amount) - r.s.advanceAdjust)}</div>}
                    </>
                  ),
                },
                { key: 'records', header: 'Records', render: (r) => <RecordChips records={r.rec.records} mandatory={r.mandatory} onOpen={(k) => set({ bill: r.id, btab: k })} /> },
                { key: 'ai', header: 'AI check', render: (r) => <AiBadge report={r.rec.report} notes={r.s.findingNotes} /> },
                { key: 'by', header: 'Verified by', render: (r) => r.s.verifiedBy || '-' },
                { key: 'stage', header: 'Status', render: (r) => <><Badge>{r.stage}</Badge>{r.held.length > 0 && <div className="cell-sub down">Held</div>}</> },
                { key: 'open', header: '', render: (r) => <button className={`btn btn-sm ${r.check.ok ? 'btn-primary' : ''}`} onClick={() => set({ bill: r.id, btab: null })}>{r.check.ok ? 'Review & decide' : 'Review'}</button> },
              ]}
            />
          </Card>
        </>
      )}

      {open && (
        <BillReviewPanel
          key={`${open.id}-${billTab}`}
          bill={open}
          rec={reportFor(open, stateOf(open), data.bills)}
          initialTab={billTab}
          role={role}
          user={user}
          approvalRules={data.approvalRules}
          mode="approver"
          notify={notify}
          onClose={() => set({ bill: null, btab: null })}
        />
      )}
    </>
  )
}
