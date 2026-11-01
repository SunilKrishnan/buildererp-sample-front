import { useState } from 'react'
import DataTable from '../../components/DataTable.jsx'
import { Badge, Card } from '../../components/UI.jsx'
import { latestApproved, latestRevision } from '../../services/site.js'
import { formatDate } from '../../utils/format.js'
import { Drawer } from '../store-keeper/shared.jsx'
import { siteName, useQA } from './shared.jsx'

/** The shared document register (read only for QA). Approval comes only from the recorded approval. */
export default function Drawings({ notify, search }) {
  const ctx = useQA(notify)
  const [disc, setDisc] = useState('all')
  const [viewId, setViewId] = useState(null)
  const q = (search || '').toLowerCase()
  const docs = ctx.s.documents.filter((d) => (disc === 'all' || d.discipline === disc) && (!q || `${d.id} ${d.title}`.toLowerCase().includes(q)))
  const usedBy = (id) => ({
    checklists: ctx.s.checklists.filter((c) => (c.basis || []).includes(id)).map((c) => c.id),
    inspections: ctx.s.inspections.filter((x) => (x.drawingRefs || []).includes(id)).map((x) => x.id),
  })
  const viewing = viewId && ctx.s.documents.find((d) => d.id === viewId)
  return (
    <>
      <div className="info-note"><span>ℹ</span><div>Inspect against the <b>latest approved revision</b>. A newer revision that is under review or draft is shown but is not a construction requirement until its approval is recorded in the document register (by the approver named there, not by QA).</div></div>
      <Card title="Drawings & specifications" bodyClass=""
        action={<label className="field inline">Discipline<select value={disc} onChange={(e) => setDisc(e.target.value)}><option value="all">All</option>{[...new Set(ctx.s.documents.map((d) => d.discipline))].map((x) => <option key={x}>{x}</option>)}</select></label>}>
        <DataTable dense rows={docs} emptyText="No documents match." columns={[
          { key: 'id', header: 'Document no.', render: (d) => <button className="link-btn" onClick={() => setViewId(d.id)}>{d.id}</button> },
          { key: 't', header: 'Title', render: (d) => <span className="wrap-cell">{d.title}<div className="cell-sub">{d.discipline} · {siteName(d.siteId)}</div></span> },
          { key: 'a', header: 'Current (approved)', render: (d) => { const a = latestApproved(d); return a ? <><Badge tone="success">{a.rev} Approved</Badge><div className="cell-sub">effective {formatDate(a.date)} · {a.approvedBy}</div></> : <Badge tone="danger">No approved revision</Badge> } },
          { key: 'l', header: 'Latest revision', render: (d) => { const l = latestRevision(d); const a = latestApproved(d); return l === a ? <span className="cell-sub">Same</span> : <><Badge>{l.status}</Badge><div className="cell-sub down">{l.rev}: not for construction</div></> } },
          { key: 'u', header: 'Used by', render: (d) => { const u = usedBy(d.id); return <span className="cell-sub wrap-cell">{[...u.checklists, ...u.inspections.slice(0, 4)].join(', ') || '—'}{u.inspections.length > 4 ? ` +${u.inspections.length - 4}` : ''}</span> } },
          { key: 'x', header: '', render: (d) => <button className="btn btn-sm" onClick={() => setViewId(d.id)}>History</button> },
        ]} />
      </Card>
      {viewing && (
        <Drawer title={`${viewing.id} · ${viewing.title}`} sub={`${viewing.discipline} · ${siteName(viewing.siteId)}`} onClose={() => setViewId(null)}>
          <DataTable dense rows={[...viewing.revisions].reverse().map((r) => ({ ...r, id: r.rev }))} columns={[
            { key: 'rev', header: 'Revision', render: (r) => <span className="cell-main">{r.rev}</span> },
            { key: 'd', header: 'Date', render: (r) => formatDate(r.date) },
            { key: 's', header: 'Status', render: (r) => <Badge>{r.status}</Badge> },
            { key: 'b', header: 'Approved by', render: (r) => r.approvedBy || '—' },
            { key: 'n', header: 'Note', render: (r) => <span className="cell-sub wrap-cell">{r.note || ''}</span> },
          ]} />
          <p className="cell-sub" style={{ marginTop: 8 }}>Related: {(() => { const u = usedBy(viewing.id); return [...u.checklists, ...u.inspections].join(', ') || 'none' })()}</p>
        </Drawer>
      )}
    </>
  )
}
