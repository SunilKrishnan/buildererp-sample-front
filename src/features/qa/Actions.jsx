import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import DataTable from '../../components/DataTable.jsx'
import { Badge, Card } from '../../components/UI.jsx'
import * as Q from '../../services/qa.js'
import { engineerOf, pmOf, supervisorOf } from '../../services/site.js'
import { formatDate } from '../../utils/format.js'
import { Drawer, FormError } from '../store-keeper/shared.jsx'
import { NcrDrawer } from './Ncrs.jsx'
import { siteName, useQA } from './shared.jsx'

/** Progress / completion by the responsible person (or the site team). QA cannot mark its own verification work done. */
export function ProgressForm({ ctx, n, onClose }) {
  const [f, setF] = useState({ note: '', evidence: '', done: false })
  return (
    <Drawer title={`Update ${n.action.id}`} sub={n.action.text} onClose={() => { ctx.setError(''); onClose() }}>
      <div className="receipt-form">
        <div className="receipt-grid">
          <label className="field span-2">Progress note<input value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} placeholder="What was done" /></label>
          <label className="field span-2">Evidence of correction<input type="file" onChange={(e) => setF({ ...f, evidence: e.target.files?.[0]?.name || '' })} /><span className="cell-sub">Demo: only the file name is kept; nothing is uploaded.</span></label>
          <label className="check-row span-2"><input type="checkbox" checked={f.done} onChange={(e) => setF({ ...f, done: e.target.checked })} /> Correction complete: request QA verification</label>
        </div>
        <div className="sk-form-foot"><FormError error={ctx.error} /><div className="jv-submit"><button className="btn btn-primary" onClick={() => ctx.act('updateCorrectiveAction', { id: n.id, note: f.note, evidence: f.evidence ? [f.evidence] : [], done: f.done }) && onClose()}>Save update</button><button className="btn" onClick={onClose}>Cancel</button></div></div>
      </div>
    </Drawer>
  )
}

export default function Actions({ notify, search, go }) {
  const ctx = useQA(notify)
  const [params] = useSearchParams()
  const [status, setStatus] = useState(params.get('status') || 'open')
  const [updating, setUpdating] = useState(null)
  const [viewing, setViewing] = useState(null)
  const q = (search || '').toLowerCase()
  const all = ctx.s.ncrs.filter((n) => n.action)
  const overdue = (n) => n.action.status !== 'Done' && n.action.due < ctx.today && Q.ncrStatus(n) !== 'Closed'
  const rows = all
    .filter((n) => status === 'all' || (status === 'open' ? Q.ncrStatus(n) !== 'Closed' : status === 'overdue' ? overdue(n) : status === 'verify' ? Q.ncrStatus(n) === 'Awaiting Verification' : Q.ncrStatus(n) === 'Closed'))
    .filter((n) => !q || `${n.action.id} ${n.id} ${n.action.text} ${n.action.owner}`.toLowerCase().includes(q))
    .sort((a, b) => a.action.due.localeCompare(b.action.due))
  const canUpdate = (n) => [n.action.owner, engineerOf(n.siteId), supervisorOf(n.siteId), pmOf(n.projectId)].includes(ctx.user.name) && !['Awaiting Verification', 'Reinspection Required', 'Closed'].includes(Q.ncrStatus(n))
  const up = updating && ctx.s.ncrs.find((n) => n.id === updating)
  const vw = viewing && ctx.s.ncrs.find((n) => n.id === viewing)
  return (
    <>
      <Card title="Corrective actions" sub="The responsible person records progress and evidence; only the authorised QA verifier closes an action that needs verification" bodyClass=""
        action={<label className="field inline">Show<select value={status} onChange={(e) => setStatus(e.target.value)}><option value="open">Open</option><option value="overdue">Overdue</option><option value="verify">Awaiting QA verification</option><option value="closed">Closed</option><option value="all">All</option></select></label>}>
        <DataTable dense rows={rows} emptyText="No corrective actions match." columns={[
          { key: 'id', header: 'Action', render: (n) => <><div className="cell-main">{n.action.id}</div><button className="link-btn cell-sub" onClick={() => setViewing(n.id)}>{n.id}</button></> },
          { key: 'a', header: 'Required action', render: (n) => <span className="wrap-cell">{n.action.text}<div className="cell-sub">{siteName(n.siteId)}{n.location ? ` · ${n.location}` : ''}</div></span> },
          { key: 'o', header: 'Responsible', render: (n) => <>{n.action.owner}<div className="cell-sub">{n.action.role || n.responsibleRole || ''}</div></> },
          { key: 'd', header: 'Target', render: (n) => <span className={overdue(n) ? 'down' : ''}>{formatDate(n.action.due)}{overdue(n) && <div className="cell-sub down">overdue</div>}</span> },
          { key: 'p', header: 'Priority', render: (n) => <Badge>{n.action.priority || (n.severity === 'Minor' ? 'Normal' : 'High')}</Badge> },
          { key: 'g', header: 'Progress / evidence', render: (n) => <span className="cell-sub wrap-cell">{n.action.progress?.length ? n.action.progress[n.action.progress.length - 1].note : n.action.note || '—'}{n.action.evidence?.length ? ` · ${n.action.evidence.length} evidence` : ''}</span> },
          { key: 'v', header: 'Verification', render: (n) => <><Badge>{Q.ncrStatus(n)}</Badge>{n.closedAt && <div className="cell-sub">closed {formatDate(n.closedAt.slice(0, 10))}</div>}</> },
          {
            key: 'x', header: '', render: (n) => (
              <div className="cell-actions">
                {canUpdate(n) && <button className="btn btn-sm btn-primary" onClick={() => setUpdating(n.id)}>Update progress</button>}
                {ctx.perms.review && Q.ncrStatus(n) === 'Awaiting Verification' && <button className="btn btn-sm btn-primary" onClick={() => setViewing(n.id)}>Verify</button>}
                <button className="btn btn-sm" onClick={() => setViewing(n.id)}>View</button>
              </div>
            ),
          },
        ]} />
      </Card>
      {up && <ProgressForm ctx={ctx} n={up} onClose={() => setUpdating(null)} />}
      {vw && <NcrDrawer key={vw.id} ctx={ctx} n={vw} go={go} onClose={() => setViewing(null)} />}
    </>
  )
}
