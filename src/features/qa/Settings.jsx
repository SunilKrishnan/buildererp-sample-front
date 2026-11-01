import { useState } from 'react'
import { Card } from '../../components/UI.jsx'
import { PERMISSIONS as P, can } from '../../auth/demoRoles.js'
import { projects } from '../../data/mockData.js'
import { QA_INSPECTORS } from '../../data/demo/qaDemo.js'
import { ConfirmDialog } from '../store-keeper/shared.jsx'
import { useQA } from './shared.jsx'

const PREF_LABELS = {
  requests: 'New inspection requests', assigned: 'Inspections assigned to me', upcoming: 'Upcoming / overdue inspections', failed: 'Failed inspection results',
  ncr: 'New NCRs', deadlines: 'Corrective actions nearing their deadline', reinspection: 'Corrections to verify and reinspections', materials: 'Material test reports to review',
}
const PERMS = [
  [P.QA_MANAGE, 'Schedule and record QA inspections, checklists, NCRs and material test records'],
  [P.QUALITY_REVIEW, 'Verify corrections, review material test results and Site Engineer inspections'],
  [P.QA_CLEARANCE, 'Record QA clearance for the next activity (e.g. concrete pour)'],
  [P.INVENTORY_VIEW, 'View GRNs, POs and stock (read only)'],
]
const NOT_ALLOWED = ['Change stock balances, received / accepted / rejected quantities', 'Change purchase prices or purchase orders', 'Record or approve payments and other financial records', 'Approve drawings or specifications (the document approver does)']

export default function Settings({ notify }) {
  const ctx = useQA(notify)
  const [prefs, setPrefs] = useState({ ...ctx.s.qaPrefs })
  const [resetting, setResetting] = useState(false)
  const me = QA_INSPECTORS.find((i) => i.name === ctx.user.name)
  return (
    <>
      <div className="grid halves">
        <Card title="Profile">
          <dl className="details">
            <dt>Name</dt><dd>{ctx.user.name}</dd>
            <dt>Role</dt><dd>{ctx.role.label} ({ctx.role.title})</dd>
            <dt>Organisation</dt><dd>{me?.org || '—'}</dd>
            <dt>Authorised inspector</dt><dd>{me ? 'Yes' : 'No'}</dd>
            <dt>Projects</dt><dd>{projects.map((p) => p.name).join(', ')}</dd>
          </dl>
          <p className="cell-sub">Demo profile: the role preview is not a login.</p>
        </Card>
        <Card title="Permissions">
          <ul className="perm-list">
            {PERMS.map(([p, label]) => <li key={p} className={can(ctx.role.id, p) ? 'ok' : ''}><span>{can(ctx.role.id, p) ? '✓' : '–'}</span><span>{label}</span></li>)}
            {NOT_ALLOWED.map((t) => <li key={t}><span>✕</span><span className="cell-sub">{t}</span></li>)}
          </ul>
        </Card>
      </div>
      <Card title="Notification preferences" sub="Which notifications appear on the Notifications page (on screen only)" className="section-gap">
        <div className="pm-picker">
          {Object.entries(PREF_LABELS).map(([k, label]) => <label key={k} className="check-row"><input type="checkbox" checked={prefs[k] !== false} onChange={(e) => setPrefs({ ...prefs, [k]: e.target.checked })} /> {label}</label>)}
        </div>
        <div className="jv-submit" style={{ marginTop: 10 }}><button className="btn btn-primary" onClick={() => ctx.act('setQaPrefs', prefs)}>Save preferences</button></div>
      </Card>
      <Card title="Demo data" className="section-gap">
        <p>All quality records are demo data kept in this browser session. Nothing is saved; reloading the page resets them.</p>
        <button className="btn" onClick={() => setResetting(true)}>Reset site and quality demo data</button>
      </Card>
      {resetting && (
        <ConfirmDialog title="Reset site and quality demo data?" confirmLabel="Reset" onCancel={() => setResetting(false)}
          onConfirm={() => { ctx.site.actions.reset(); setPrefs({ ...ctx.s.qaPrefs }); notify?.('Demo: site and quality records reset to the demo data'); setResetting(false) }}>
          <p>This also resets the Site Engineer and Site Supervisor records changed in this session (they share the same records). Stock and purchasing records are not affected.</p>
        </ConfirmDialog>
      )}
    </>
  )
}
