import { useState } from 'react'
import DataTable from '../../components/DataTable.jsx'
import Icon from '../../components/Icon.jsx'
import { Badge, Card } from '../../components/UI.jsx'
import * as Q from '../../services/qa.js'
import { latestApproved } from '../../services/site.js'
import { formatDate } from '../../utils/format.js'
import { Drawer, FormError } from '../store-keeper/shared.jsx'
import { inspectionHtml, materialName, printRecord, useQA } from './shared.jsx'

/** One list of quality documents built from the records themselves (no second copy of any record). */
export function qualityDocuments(ctx) {
  const { s } = ctx
  const out = []
  for (const q of s.inspections.filter((x) => ['Passed', 'Failed', 'Conditional'].includes(x.status) && x.owner !== 'Site Engineer')) {
    out.push({ id: `rep-${q.id}`, type: q.parentId ? 'Reinspection report' : 'Inspection report', title: `${q.id} · ${q.title}`, ref: q.id, date: (q.recordedAt || q.date).slice(0, 10), by: q.recordedBy || q.inspector, verified: true, print: () => printRecord(`Inspection ${q.id}`, inspectionHtml(ctx, q)) })
  }
  for (const t of s.materialTests.filter((x) => x.reportRef)) {
    const type = /cube|slump/i.test(t.testType) ? 'Concrete test record' : /certificate/i.test(t.testType) ? (t.lab === 'Supplier certificate' ? 'Supplier quality certificate' : 'Material test certificate') : 'Laboratory report'
    out.push({ id: `mt-${t.id}`, type, title: `${t.reportRef} · ${materialName(t)}`, ref: [t.id, t.grnId, t.poId].filter(Boolean).join(' · '), date: t.testDate, by: t.lab, verified: t.status === 'Accepted', file: t.reportFile, status: t.status })
  }
  for (const n of s.ncrs.filter((x) => x.source === 'QA record (demo)' || x.demo)) {
    out.push({ id: `ncr-${n.id}`, type: 'NCR report', title: `${n.id} · ${n.description}`, ref: n.id, date: n.reported, by: n.reportedBy, verified: Q.ncrStatus(n) === 'Closed', status: Q.ncrStatus(n) })
    for (const e of n.action?.evidence || []) out.push({ id: `ev-${n.id}-${e}`, type: 'Corrective action evidence', title: typeof e === 'string' ? e : e.name, ref: `${n.action.id} · ${n.id}`, date: n.action.completedAt?.slice(0, 10) || n.reported, by: n.action.owner, verified: !!n.verification })
  }
  for (const d of s.documents.filter((x) => ['Specification', 'Inspection checklist', 'Method statement'].includes(x.discipline))) {
    const a = latestApproved(d)
    if (a) out.push({ id: `doc-${d.id}`, type: 'Approved specification / checklist', title: `${d.id} ${a.rev} · ${d.title}`, ref: d.id, date: a.date, by: a.approvedBy, verified: true })
  }
  for (const c of s.checklists.filter((x) => Q.checklistBasis(s, x).usable)) out.push({ id: `cl-${c.id}`, type: 'Approved specification / checklist', title: `${c.id} v${c.version} · ${c.title}`, ref: c.basis.join(', '), date: (c.createdAt || '').slice(0, 10), by: c.createdBy, verified: true })
  for (const d of s.qaDocs) out.push({ id: d.id, type: d.type, title: d.title, ref: d.ref, date: d.at.slice(0, 10), by: d.addedBy, verified: d.verified, file: d.fileName, attached: true })
  return out.sort((a, b) => (b.date || '').localeCompare(a.date || ''))
}

export default function Documents({ notify, search }) {
  const ctx = useQA(notify)
  const verifiedOnly = !ctx.perms.manage // other roles (e.g. Accounts) see verified documents only
  const [type, setType] = useState('all')
  const [adding, setAdding] = useState(false)
  const [f, setF] = useState({ title: '', type: Q.QA_DOC_TYPES[0], ref: '', fileName: '' })
  const q = (search || '').toLowerCase()
  const rows = qualityDocuments(ctx)
    .filter((d) => !verifiedOnly || d.verified)
    .filter((d) => type === 'all' || d.type === type)
    .filter((d) => !q || `${d.title} ${d.ref} ${d.type}`.toLowerCase().includes(q))
  return (
    <>
      <div className="info-note"><span>ℹ</span><div>{verifiedOnly ? 'Verified quality documents only (view). ' : ''}Documents are listed from the inspection, test and NCR records themselves. Demo: attachments keep the file name only; nothing is uploaded or stored.</div></div>
      <Card title="Quality documents" bodyClass=""
        action={ctx.perms.manage ? <button className="btn btn-primary btn-sm" onClick={() => setAdding(true)}><Icon name="plus" size={14} />Attach document</button> : null}>
        <div className="toolbar"><label className="field">Type<select value={type} onChange={(e) => setType(e.target.value)}><option value="all">All</option>{[...new Set([...Q.QA_DOC_TYPES, 'Approved specification / checklist'])].map((t) => <option key={t}>{t}</option>)}</select></label></div>
        <DataTable dense rows={rows} emptyText={verifiedOnly ? 'No verified documents.' : 'No documents.'} columns={[
          { key: 't', header: 'Document', render: (d) => <span className="wrap-cell">{d.title}{d.file && <div className="cell-sub">{d.file}</div>}</span> },
          { key: 'ty', header: 'Type', render: (d) => <span className="cell-sub">{d.type}</span> },
          { key: 'r', header: 'Linked record', render: (d) => <span className="cell-sub wrap-cell">{d.ref}</span> },
          { key: 'd', header: 'Date', render: (d) => (d.date ? formatDate(d.date) : '—') },
          { key: 'b', header: 'By', render: (d) => d.by || '—' },
          { key: 'v', header: 'Status', render: (d) => (d.verified ? <Badge tone="success">Verified</Badge> : <Badge tone="warning">{d.status || 'Not verified'}</Badge>) },
          {
            key: 'x', header: '', render: (d) => (
              <div className="cell-actions">
                {d.print && <button className="btn btn-sm" onClick={d.print}>Print</button>}
                {d.attached && !d.verified && ctx.perms.review && <button className="btn btn-sm" onClick={() => ctx.act('verifyQaDocument', { id: d.id })}>Verify</button>}
              </div>
            ),
          },
        ]} />
        <div style={{ padding: '0 18px 12px' }}><FormError error={ctx.error} /></div>
      </Card>
      {adding && (
        <Drawer title="Attach quality document" sub="Linked to an existing record; no duplicate supplier or material record is created" onClose={() => { ctx.setError(''); setAdding(false) }}>
          <div className="receipt-form">
            <div className="receipt-grid">
              <label className="field span-2">Title<input value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} /></label>
              <label className="field">Type<select value={f.type} onChange={(e) => setF({ ...f, type: e.target.value })}>{Q.QA_DOC_TYPES.map((t) => <option key={t}>{t}</option>)}</select></label>
              <label className="field">Linked record<select value={f.ref} onChange={(e) => setF({ ...f, ref: e.target.value })}><option value="">Select…</option>
                {[...ctx.s.inspections.filter((x) => x.owner === 'QA').map((x) => x.id), ...ctx.s.ncrs.map((n) => n.id), ...ctx.s.materialTests.map((t) => t.id), ...ctx.inv.state.receipts.map((g) => g.id)].map((id) => <option key={id}>{id}</option>)}
              </select></label>
              <label className="field span-2">File<input type="file" onChange={(e) => setF({ ...f, fileName: e.target.files?.[0]?.name || '' })} /><span className="cell-sub">Demo: only the file name is kept.</span></label>
            </div>
            <div className="sk-form-foot"><FormError error={ctx.error} /><div className="jv-submit"><button className="btn btn-primary" onClick={() => ctx.act('addQaDocument', f) && (setAdding(false), setF({ title: '', type: Q.QA_DOC_TYPES[0], ref: '', fileName: '' }))}>Attach</button><button className="btn" onClick={() => setAdding(false)}>Cancel</button></div></div>
          </div>
        </Drawer>
      )}
    </>
  )
}
