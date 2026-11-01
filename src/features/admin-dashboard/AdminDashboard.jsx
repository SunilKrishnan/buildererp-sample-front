import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import Icon from '../../components/Icon.jsx'
import Tabs from '../../components/Tabs.jsx'
import { PageHead } from '../../components/UI.jsx'
import { DemoTag, EmptyState, ErrorState, LoadingState } from '../../components/StateViews.jsx'
import CompletedProjectNote from '../../components/CompletedProjectNote.jsx'
import { getProjectOptions } from '../../services/dashboardService.js'
import { recordApprovalDecision } from '../../services/approvalService.js'
import { resolveDateRange } from '../../utils/date.js'
import { useAdminDashboard } from './useAdminDashboard.js'
import { useDemoSession } from '../../auth/DemoSession.jsx'
import { dashboardsForRole } from '../../config/navigation.js'
import { useBillWorkflow } from '../bill-review/BillWorkflowContext.jsx'
import { useBillReviews } from '../bill-review/useBillReviews.js'

import DashboardFilters from '../../components/DashboardFilters.jsx'
import SummaryCards from './SummaryCards.jsx'
import ProjectOverview, { PROJECT_STATUS_FILTERS } from './ProjectOverview.jsx'
import LabourOverview from './LabourOverview.jsx'
import PurchaseOverview from './PurchaseOverview.jsx'
import ActionCentre, { LiveStores } from './ActionCentre.jsx'
import { QaSummary } from '../qa/links.jsx'
import { SafetySummary } from '../safety/links.jsx'
import { useInventory } from '../store-keeper/InventoryContext.jsx'
import { useSite } from '../site-engineer/SiteContext.jsx'
import { siteAdminItems } from '../../services/site.js'
import SiteOversight from './SiteOversight.jsx'
import FinanceOverview from './FinanceOverview.jsx'
import SalesOverview from './SalesOverview.jsx'
import ApprovalCentre from './ApprovalCentre.jsx'
import QualitySafety from './QualitySafety.jsx'
import RecentActivity from './RecentActivity.jsx'
import DashboardCharts, { AttendanceTrendChart, BudgetVsActualChart, ProjectProgressChart, SalesCollectionsChart } from './DashboardCharts.jsx'

const TAB_IDS = ['overview', 'approvals', 'projects', 'labour', 'purchase', 'finance', 'sales', 'quality', 'reports']

export default function AdminDashboard({ search = '', notify }) {
  const { role } = useDemoSession()
  const roleDashboards = dashboardsForRole(role).filter((d) => d.id !== 'admin')
  const billReviews = useBillReviews()
  const { stateOf: billStateOf } = useBillWorkflow()
  const billsAwaiting = (billReviews.data?.bills || []).filter((b) => billStateOf(b).approval === 'Awaiting Approval').length
  const [params, setParams] = useSearchParams()
  // Shared purchase / stores / payables records: items waiting for an Admin decision
  const siteState = useSite().state
  const adminActions = useInventory().adminItems.filter((i) => i.actionable && !i.watch).length + siteAdminItems(siteState).filter((i) => i.actionable && !i.watch).length
  const tab = TAB_IDS.includes(params.get('tab')) ? params.get('tab') : 'overview'
  const projectId = params.get('project') || 'all'
  const [projectOptions, setProjectOptions] = useState([])
  useEffect(() => { getProjectOptions().then(setProjectOptions).catch(() => setProjectOptions([])) }, [])
  const selectedProject = projectOptions.find((p) => p.id === projectId)
  // Completed projects default to all time: their records are mostly older than 30 days
  const range = params.get('range') || (selectedProject?.status === 'Completed' ? 'all' : '30d')
  const rawFrom = params.get('from')
  const rawTo = params.get('to')
  const projectStatus = PROJECT_STATUS_FILTERS.includes(params.get('pstatus')) ? params.get('pstatus') : 'All'
  const approvalType = params.get('atype') || 'All'
  const preview = params.get('preview') // UI review only: loading | error | empty

  const resolved = useMemo(() => resolveDateRange(range, rawFrom, rawTo), [range, rawFrom, rawTo])
  const filters = useMemo(() => ({ projectId, ...resolved }), [projectId, resolved])
  const { status, data, error, reload } = useAdminDashboard(filters, preview)


  // Local-only approval decisions (demo). Keyed by approval id.
  const [decisions, setDecisions] = useState({})

  const updateParams = useCallback(
    (patch, { replace = true } = {}) => {
      const next = new URLSearchParams(params)
      Object.entries(patch).forEach(([k, v]) => (v == null || v === '' ? next.delete(k) : next.set(k, v)))
      setParams(next, { replace })
    },
    [params, setParams]
  )

  const openTab = useCallback(
    (id, extra = {}) => {
      updateParams({ tab: id === 'overview' ? null : id, pstatus: extra.status ?? null, atype: extra.type ?? null }, { replace: false })
      window.scrollTo({ top: 0 })
    },
    [updateParams]
  )

  const approvals = useMemo(
    () => (data ? data.approvals.map((a) => ({ ...a, status: decisions[a.id] || a.status })) : []),
    [data, decisions]
  )
  const pendingCount = approvals.filter((a) => a.status === 'Pending').length

  const decide = async (item, decision) => {
    await recordApprovalDecision(item.id, decision)
    setDecisions((d) => {
      const next = { ...d }
      if (decision === 'Pending') delete next[item.id]
      else next[item.id] = decision
      return next
    })
    notify?.(
      decision === 'Pending'
        ? `${item.id} moved back to pending (demo)`
        : `Demo: ${item.id} marked ${decision.toLowerCase()} on screen only. No real transaction.`
    )
  }

  const tabs = [
    { id: 'overview', label: 'Overview' },
    { id: 'approvals', label: 'Approvals', count: pendingCount + adminActions },
    { id: 'projects', label: 'Projects' },
    { id: 'labour', label: 'Labour' },
    { id: 'purchase', label: 'Purchase & Inventory' },
    { id: 'finance', label: 'Finance' },
    { id: 'sales', label: 'Sales & Bookings' },
    { id: 'quality', label: 'Quality & Safety' },
    { id: 'reports', label: 'Reports' },
  ]

  const projectLabel = projectId === 'all' ? 'All projects' : projectOptions.find((p) => p.id === projectId)?.name || projectId

  let body
  if (status === 'error') body = <ErrorState message={error?.message} onRetry={reload} />
  else if (!data) body = <LoadingState />
  else if (data.projects.length === 0)
    body = (
      <EmptyState
        title="No projects to show"
        message="There is no data for the selected project or date range."
        action={<button className="btn" onClick={() => updateParams({ project: null, range: null, from: null, to: null, preview: null })}>Reset filters</button>}
      />
    )
  else body = renderTab()

  function renderTab() {
    switch (tab) {
      case 'approvals':
        return <><ActionCentre notify={notify} /><ApprovalCentre key={approvalType} approvals={approvals} types={data.approvalTypes} onDecide={decide} initialType={approvalType} /></>
      case 'projects':
        return <><SiteOversight onOpen={openTab} /><ProjectOverview projects={data.projects} status={projectStatus} search={search} onStatusChange={(s) => updateParams({ pstatus: s === 'All' ? null : s })} /></>
      case 'labour':
        return <><LabourOverview labour={data.labour} /><AttendanceTrendChart data={data.labour.attendanceTrend} /></>
      case 'purchase':
        return <><PurchaseOverview purchase={data.purchase} /><div className="section-title"><h2>Stores (live)</h2><Link className="btn btn-sm" to="/dashboards/store-keeper">Store Keeper Dashboard</Link></div><LiveStores /></>
      case 'finance':
        return <FinanceOverview finance={data.finance} />
      case 'sales':
        return <><SalesOverview sales={data.sales} /><SalesCollectionsChart data={data.sales.trend} /></>
      case 'quality':
        return <><QaSummary title="Quality (live QA records)" /><SafetySummary notify={notify} title="Safety (live Safety Officer records)" /><QualitySafety quality={data.quality} /></>
      case 'reports':
        return <DashboardCharts data={data} />
      default:
        return (
          <>
            <SummaryCards summary={data.summary} pendingApprovals={pendingCount + adminActions} onOpen={openTab} />
            <SiteOversight compact onOpen={openTab} />
            <ActionCentre compact notify={notify} />
            <ApprovalCentre compact approvals={approvals} types={data.approvalTypes} onDecide={decide} onOpenAll={(t) => openTab('approvals', { type: t })} />
            <div className="grid halves">
              <ProjectProgressChart projects={data.projects} />
              <BudgetVsActualChart data={data.finance.budgetVsActual} />
            </div>
            <div className="grid two-one">
              <div>
                <ProjectOverview projects={data.projects} limit={5} search={search} />
                <div className="section-gap" />
                <div className="section-title"><h2>Quality & Safety</h2><button className="btn btn-sm" onClick={() => openTab('quality')}>Details</button></div>
                <QualitySafety quality={data.quality} compact />
              </div>
              <RecentActivity activity={data.activity} limit={10} />
            </div>
          </>
        )
    }
  }

  return (
    <>
      <PageHead title="Admin Dashboard" sub={`${projectLabel} · business overview`}>
        <Link className={`btn ${billsAwaiting ? 'btn-primary' : ''}`} to="/approvals/bills" title="Supplier bills forwarded by Accounts">
          <Icon name="check" />Bill approvals{billsAwaiting ? ` (${billsAwaiting})` : ''}
        </Link>
        {roleDashboards.map((d) => (
          <Link key={d.id} className="btn" to={d.to} title="Open this role's dashboard"><Icon name={d.icon} />{d.label}</Link>
        ))}
        <button className="btn" onClick={reload} disabled={status === 'loading' && !!data}>
          <Icon name="trend" />Refresh
        </button>
      </PageHead>

      <div className="dash-controls">
        <DashboardFilters
          projectOptions={projectOptions}
          projectId={projectId}
          range={range}
          from={rawFrom}
          to={rawTo}
          resolved={resolved}
          onChange={updateParams}
        />
        <DemoTag />
      </div>

      <CompletedProjectNote project={selectedProject} range={range} onShowAll={() => updateParams({ range: 'all', from: null, to: null })} />

      <Tabs tabs={tabs} value={tab} onChange={(id) => openTab(id)} label="Dashboard sections" />

      {body}
    </>
  )
}
