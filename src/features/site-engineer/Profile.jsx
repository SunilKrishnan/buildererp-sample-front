import { useState } from 'react'
import DataTable from '../../components/DataTable.jsx'
import { Card } from '../../components/UI.jsx'
import { PERMISSIONS as P, can } from '../../auth/demoRoles.js'
import { pmOf, siteOf, supervisorOf } from '../../services/site.js'
import { formatDate } from '../../utils/format.js'
import { ConfirmDialog, fmtStamp } from '../store-keeper/shared.jsx'
import { useSiteEngineer } from './shared.jsx'

const PERM_LABELS = [
  [P.SITE_WORK, 'Daily progress, diary, measurements, task notes, site issues, equipment and labour requests'],
  [P.MATERIAL_REQUEST_CREATE, 'Raise material requests for assigned sites'],
  [P.QUALITY_INSPECT, 'Record technical inspections'],
  [P.SAFETY_REPORT, 'Report hazards and follow safety actions'],
  [P.INVENTORY_VIEW, 'View stock availability'],
  [P.MATERIAL_REQUEST_APPROVE, 'Approve material requests (Project Manager)'],
  [P.QUALITY_REVIEW, 'Independent QA review'],
  [P.SAFETY_VERIFY, 'Verify safety closure'],
  [P.ATTENDANCE_EDIT, 'Record attendance (Site Supervisor)'],
  [P.PROCUREMENT_MANAGE, 'Quotations and purchase orders (Purchase Manager)'],
  [P.PO_APPROVE, 'Approve purchases (Admin)'],
  [P.EXPENSE_VERIFY, 'Verify bills and payments (Accounts)'],
]
// Rules that hold for every Site Engineer, whatever else the role can do
const NEVER = [
  'Approve your own material requests (the Project Manager reviews them)',
  'Change approved schedules, planned quantities or project budgets',
  'Approve your own project or site assignments',
  "Mark material as issued, record goods receipts or change a supplier's delivery status",
  'Create purchase orders: a material request never creates one by itself',
]
const PREFS = [
  ['materialUpdates', 'Material request updates'], ['instructions', 'Project Manager instructions'], ['inspections', 'Inspection follow-ups'],
  ['issues', 'Site issue comments'], ['safety', 'High-priority safety alerts'], ['dailyDigest', 'Daily digest at 7 pm'],
]

export default function Profile({ notify }) {
  const ctx = useSiteEngineer(notify)
  const [resetting, setResetting] = useState(false)
  const { user, role } = ctx
  const a = ctx.scope.assignments[0]
  const prefs = ctx.site.state.prefs
  const activity = [
    ...(ctx.site.state.audit || []).filter((x) => x.by === user.name),
    ...(ctx.inv.state.audit || []).filter((x) => x.by === user.name),
  ].sort((x, y) => (y.at || '').localeCompare(x.at || ''))
  const assignments = ctx.scope.assignments.flatMap((x) => x.siteIds.map((id) => ({ key: `${x.engineer}-${id}`, engineer: x.engineer, projectId: x.projectId, siteId: id, since: x.since })))

  return (
    <>
      <div className="grid halves">
        <Card title="Profile" sub="From the demo sign-in (no real authentication in this phase)">
          <dl className="details">
            <dt>Name</dt><dd>{user.name}</dd><dt>Role</dt><dd>{role.title}</dd><dt>User ID</dt><dd>{user.id}</dd>
            <dt>Phone</dt><dd>{a?.phone || '—'}</dd><dt>Email</dt><dd>{a?.email || '—'}</dd>
            <dt>Reports to</dt><dd>{ctx.myProjects.map((p) => `${pmOf(p.id)} (Project Manager, ${p.short})`).join(', ')}</dd>
          </dl>
        </Card>
        <Card title="Notification preferences" sub="Which updates appear in Overview notifications. On screen only for this session; nothing is emailed or sent by SMS.">
          {PREFS.map(([k, label]) => (
            <div key={k} className="switch-row">
              <div>{label}</div>
              <label className="switch"><input type="checkbox" checked={!!prefs[k]} onChange={(e) => ctx.act('setPrefs', { [k]: e.target.checked })} aria-label={label} /><span /></label>
            </div>
          ))}
        </Card>
      </div>
      <Card title="Assigned projects and sites" sub="Set by the Project Manager; you cannot see other sites" bodyClass="" className="section-gap">
        <DataTable rowKey="key" rows={assignments} columns={[
          { key: 'p', header: 'Project', render: (x) => <>{ctx.myProjects.find((p) => p.id === x.projectId)?.name}<div className="cell-sub">{x.projectId}</div></> },
          { key: 's', header: 'Site', render: (x) => siteOf(x.siteId)?.name },
          { key: 'e', header: 'Site Engineer', render: (x) => x.engineer },
          { key: 'sup', header: 'Site Supervisor', render: (x) => supervisorOf(x.siteId) || '—' },
          { key: 'since', header: 'Since', render: (x) => formatDate(x.since) },
        ]} />
      </Card>
      <div className="grid halves section-gap">
        <Card title="Role permissions" sub={`What ${role.title} can do (existing role rules)`}>
          <ul className="perm-list">{PERM_LABELS.map(([p, label]) => <li key={p} className={can(role.id, p) ? 'ok' : 'no'}><span>{can(role.id, p) ? '✓' : '✕'}</span><span>{label}</span></li>)}</ul>
        </Card>
        <Card title="Never done from this dashboard" sub="Separate roles keep request, review, approval, receipt, issue and payment apart">
          <ul className="perm-list">{NEVER.map((t) => <li key={t} className="no"><span>✕</span><span>{t}</span></li>)}</ul>
        </Card>
      </div>
      <Card title="Demo data & limitations" sub="This is a frontend prototype" className="section-gap">
        <ul className="perm-list">
          <li className="no"><span>ℹ</span><span>All projects, tasks, requests, inspections and issues are illustrative demo records, not real company data.</span></li>
          <li className="no"><span>ℹ</span><span>Your changes are kept in this browser tab only. They are not saved to a server, not shared in real time with other users and are lost on reload.</span></li>
          <li className="no"><span>ℹ</span><span>Other dashboards (Project Manager, Store Keeper, Purchase Manager) show your changes when you switch role with "Preview as" in this same tab.</span></li>
          <li className="no"><span>ℹ</span><span>Photos and documents stay in this tab; nothing is uploaded. Notifications are on screen only.</span></li>
        </ul>
        <button className="btn btn-sm" style={{ marginTop: 10 }} onClick={() => setResetting(true)}>Reset demo data</button>
      </Card>
      {resetting && (
        <ConfirmDialog title="Reset all demo data?" confirmLabel="Reset demo data" onCancel={() => setResetting(false)}
          onConfirm={() => { ctx.site.actions.reset(); ctx.inv.actions.reset(); setResetting(false); notify?.('Demo data reset to the starting records for every dashboard') }}>
          <p>Site records (reports, tasks, inspections, issues, diary) and store records (material requests, stock, issues, purchasing) go back to the starting demo data. Everything you changed in this session is discarded.</p>
        </ConfirmDialog>
      )}
      <Card title="Recent activity" sub="Your actions in this session" bodyClass="" className="section-gap">
        <DataTable rowKey="id" rows={activity.slice(0, 30)} emptyText="No actions yet in this session." columns={[
          { key: 'at', header: 'When', render: (x) => fmtStamp(x.at) }, { key: 'ref', header: 'Record' }, { key: 'action', header: 'Action' }, { key: 'note', header: 'Note', render: (x) => <span className="cell-sub">{x.note || '—'}</span> },
        ]} />
      </Card>
    </>
  )
}
