import { useState } from 'react'
import DataTable from '../../components/DataTable.jsx'
import { Badge, Card } from '../../components/UI.jsx'
import { docCategory, DOC_DISCIPLINES } from '../../data/demo/siteDemo.js'
import { latestApproved, latestRevision, projectOf, siteOf } from '../../services/site.js'
import { formatDate } from '../../utils/format.js'
import { Drawer, fmtStamp, FormError } from '../store-keeper/shared.jsx'
import { siteData } from './derive.js'
import { useSiteEngineer } from './shared.jsx'

const CATEGORIES = [...new Set(DOC_DISCIPLINES.map(docCategory))]
/** Approved (current), Draft (under review) or Superseded, from the recorded revisions only */
const revLabel = (doc, r) => (r === latestApproved(doc) ? 'Approved (current)' : r.status === 'Superseded' || (r.status === 'Approved' && r !== latestApproved(doc)) ? 'Superseded' : r.status === 'Under Review' ? 'Draft: under review' : r.status)
const revTone = (label) => (label.startsWith('Approved') ? 'success' : label === 'Superseded' ? 'muted' : 'warning')

/** Demo download: a small text file describing the register entry (no drawing files are stored). */
function downloadDemo(doc, r, notify) {
  const text = [
    'BUILDDESK DEMO DOCUMENT: not a real drawing or approval record', '',
    `Document: ${doc.id} ${doc.title}`, `Category: ${docCategory(doc.discipline)}`, `Project: ${projectOf(doc.projectId)?.name}`, `Work area: ${doc.siteId ? siteOf(doc.siteId)?.name : 'Project-wide'}`,
    `Revision: ${r.rev} (${revLabel(doc, r)})`, `Revision date: ${r.date}`, `Uploaded by: ${doc.uploadedBy}`, `Approval record: ${r.approvedBy ? `${r.approvedBy}, ${r.approvedAt}` : 'none'}`,
    `Change note: ${r.note || '-'}`, '', 'In the live system this would be the controlled drawing file.',
  ].join('\n')
  const url = URL.createObjectURL(new Blob([text], { type: 'text/plain' }))
  const a = Object.assign(document.createElement('a'), { href: url, download: `${doc.id}-${r.rev}-demo.txt` })
  document.body.appendChild(a); a.click(); a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
  notify(`Demo: downloaded a placeholder for ${doc.id} ${r.rev} (no real file is stored)`)
}

/** Demo preview sheet with a title block and the revision's status stamp. */
function Preview({ doc, r }) {
  const label = revLabel(doc, r)
  const stamp = label.startsWith('Approved') ? null : label === 'Superseded' ? 'SUPERSEDED · NOT FOR CONSTRUCTION' : 'DRAFT · NOT FOR CONSTRUCTION'
  return (
    <svg viewBox="0 0 420 260" className="se-doc-preview" role="img" aria-label={`Demo preview of ${doc.id} ${r.rev}: ${label}`}>
      <rect x="6" y="6" width="408" height="248" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <g stroke="currentColor" strokeOpacity="0.35" fill="none">
        <rect x="30" y="30" width="230" height="150" />
        {[0, 1, 2, 3].map((i) => <line key={`v${i}`} x1={30 + i * 76.6} y1="30" x2={30 + i * 76.6} y2="180" strokeDasharray="4 4" />)}
        {[0, 1, 2].map((i) => <line key={`h${i}`} x1="30" y1={30 + i * 75} x2="260" y2={30 + i * 75} strokeDasharray="4 4" />)}
        {[[60, 55], [136, 55], [213, 55], [60, 130], [136, 130], [213, 130]].map(([x, y]) => <rect key={`${x}${y}`} x={x - 9} y={y - 9} width="18" height="18" />)}
      </g>
      <rect x="280" y="30" width="120" height="150" fill="none" stroke="currentColor" strokeOpacity="0.6" />
      <text x="290" y="50" fontSize="9" fill="currentColor" fontWeight="700">{doc.id} · {r.rev}</text>
      <text x="290" y="66" fontSize="7" fill="currentColor">{docCategory(doc.discipline)}</text>
      <foreignObject x="288" y="72" width="108" height="60"><div style={{ fontSize: 7, lineHeight: 1.3 }}>{doc.title}</div></foreignObject>
      <text x="290" y="146" fontSize="7" fill="currentColor">Date {r.date}</text>
      <text x="290" y="160" fontSize="7" fill="currentColor">{r.approvedBy ? `Approved: ${r.approvedBy}` : 'Not approved'}</text>
      <text x="30" y="205" fontSize="9" fill="currentColor" fontWeight="700">DEMO PREVIEW: placeholder sheet, not the real drawing</text>
      <text x="30" y="222" fontSize="7" fill="currentColor">{projectOf(doc.projectId)?.name} · {doc.siteId ? siteOf(doc.siteId)?.name : 'Project-wide'}</text>
      {stamp && <text x="210" y="120" fontSize="15" fontWeight="800" fill="#d64545" fillOpacity="0.75" textAnchor="middle" transform="rotate(-18 210 120)">{stamp}</text>}
    </svg>
  )
}

function DocView({ doc, ctx, onClose, notify }) {
  const [q, setQ] = useState('')
  const current = latestApproved(doc)
  const latest = latestRevision(doc)
  const [shown, setShown] = useState(current || latest)
  const pendingNewer = latest !== current && latest.status === 'Under Review'
  return (
    <Drawer title={`${doc.id} · ${doc.title}`} sub={`${docCategory(doc.discipline)} · ${projectOf(doc.projectId)?.short} · ${doc.siteId ? siteOf(doc.siteId)?.name : 'Project-wide'}`} onClose={onClose} wide>
      {current ? <div className="info-note"><span>✓</span><div><b>Use {current.rev}</b> (approved {formatDate(current.date)} by {current.approvedBy}).{pendingNewer && <> {latest.rev} is a draft under review and is <b>not for construction</b>.</>}</div></div>
        : <div className="info-note warn"><span>⚠</span><div>No approved revision yet. {latest.rev} is {latest.status.toLowerCase()}: not for construction.</div></div>}
      <Preview doc={doc} r={shown} />
      <div className="cell-actions" style={{ margin: '8px 0 12px' }}>
        <button className="btn btn-sm" onClick={() => downloadDemo(doc, shown, notify)}>Download {shown.rev} (demo)</button>
        <span className="cell-sub">Showing {shown.rev}. Pick another revision below to preview it.</span>
      </div>
      <DataTable rowKey="rev" rows={[...doc.revisions].reverse()} columns={[
        { key: 'rev', header: 'Revision', render: (r) => <button className="link-btn" onClick={() => setShown(r)}>{r.rev}{r === shown ? ' (shown)' : ''}</button> },
        { key: 'date', header: 'Uploaded', render: (r) => formatDate(r.date) },
        { key: 'status', header: 'Status', render: (r) => { const l = revLabel(doc, r); return <Badge tone={revTone(l)}>{l}</Badge> } },
        { key: 'by', header: 'Approval record', render: (r) => (r.approvedBy ? `${r.approvedBy}, ${fmtStamp(r.approvedAt)}` : <span className="cell-sub">Not approved</span>) },
        { key: 'note', header: 'Change', render: (r) => <span className="cell-sub wrap-cell">{r.note || '—'}</span> },
      ]} />
      {ctx.perms.work && (
        <section className="drawer-section">
          <h3>Raise a clarification on this document</h3>
          <label className="field">Question for the Project Manager<input value={q} onChange={(e) => setQ(e.target.value)} placeholder="e.g. Grid A7 level differs from S-101 R2" /></label>
          <button className="btn btn-sm" style={{ marginTop: 8 }} onClick={() => ctx.act('sendClarification', { projectId: doc.projectId, siteId: doc.siteId, subject: `${doc.id}: clarification`, text: q, ref: doc.id }) && setQ('')}>Send clarification</button>
          <FormError error={ctx.error} />
        </section>
      )}
    </Drawer>
  )
}

export default function Documents({ notify, search }) {
  const ctx = useSiteEngineer(notify)
  const d = siteData(ctx)
  const [cat, setCat] = useState('all')
  const [approval, setApproval] = useState('all')
  const [view, setView] = useState(null)
  const q = (search || '').toLowerCase()
  const state = (x) => (latestRevision(x) === latestApproved(x) ? 'Approved' : latestApproved(x) ? 'Newer draft under review' : 'No approved revision')
  const rows = d.docs
    .filter((x) => (cat === 'all' || docCategory(x.discipline) === cat) && (approval === 'all' || state(x) === approval))
    .filter((x) => !q || `${x.id} ${x.title}`.toLowerCase().includes(q))
  const viewing = view && d.docs.find((x) => x.id === view)
  const pending = d.docs.filter((x) => latestRevision(x).status === 'Under Review')

  return (
    <>
      {pending.length > 0 && <div className="info-note warn"><span>⚠</span><div><b>Draft revisions under review, not for construction:</b> {pending.map((x) => `${x.id} ${latestRevision(x).rev}`).join(', ')}. Keep working to the current approved revision.</div></div>}
      <Card title="Drawing & document register" sub="A revision is marked approved only when an approval is recorded; older revisions are superseded. Files are demo placeholders." bodyClass="">
        <div className="toolbar">
          <div className="filters">
            <label className="field">Category<select value={cat} onChange={(e) => setCat(e.target.value)}><option value="all">All</option>{CATEGORIES.map((x) => <option key={x}>{x}</option>)}</select></label>
            <label className="field">Approval status<select value={approval} onChange={(e) => setApproval(e.target.value)}><option value="all">All</option>{['Approved', 'Newer draft under review', 'No approved revision'].map((x) => <option key={x}>{x}</option>)}</select></label>
          </div>
        </div>
        <DataTable dense rows={rows} emptyText="No documents match these filters." columns={[
          { key: 't', header: 'Document name', render: (x) => <span className="wrap-cell"><button className="link-btn" onClick={() => setView(x.id)}>{x.title}</button></span> },
          { key: 'id', header: 'Number / latest rev.', render: (x) => <>{x.id}<div className="cell-sub">{latestRevision(x).rev}</div></> },
          { key: 'p', header: 'Project / work area', render: (x) => <>{projectOf(x.projectId)?.short}<div className="cell-sub">{x.siteId ? siteOf(x.siteId)?.name.split(': ')[1] : 'Project-wide'}</div></> },
          { key: 'd', header: 'Category', render: (x) => docCategory(x.discipline) },
          { key: 'u', header: 'Uploaded', render: (x) => <>{formatDate(latestRevision(x).date)}<div className="cell-sub">{x.uploadedBy}</div></> },
          { key: 'c', header: 'Current revision', render: (x) => { const c = latestApproved(x); return c ? <><b>{c.rev}</b> <span className="cell-sub">{formatDate(c.date)}</span></> : <span className="down">None approved</span> } },
          { key: 'a', header: 'Approval status', render: (x) => { const l = latestRevision(x); const c = latestApproved(x); return l === c ? <Badge tone="success">Approved</Badge> : <><Badge tone="warning">{l.rev} draft</Badge>{c && <div className="cell-sub">use {c.rev}</div>}</> } },
          { key: 'x', header: 'Actions', render: (x) => <div className="cell-actions"><button className="btn btn-sm" onClick={() => setView(x.id)}>Preview</button><button className="btn btn-sm" onClick={() => downloadDemo(x, latestApproved(x) || latestRevision(x), notify)}>Download</button></div> },
        ]} />
      </Card>
      {viewing && <DocView doc={viewing} ctx={ctx} notify={notify} onClose={() => setView(null)} />}
    </>
  )
}
