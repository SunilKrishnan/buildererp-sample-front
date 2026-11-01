import { useState } from 'react'
import DataTable from '../../components/DataTable.jsx'
import { Badge, Card } from '../../components/UI.jsx'
import * as SF from '../../services/safety.js'
import { latestApproved, latestRevision, workerOf } from '../../services/site.js'
import { formatDate } from '../../utils/format.js'
import { siteName, useSafety } from './shared.jsx'

const SAFETY_DISCIPLINES = ['Risk assessment', 'Method statement', 'Safety plan', 'Inspection checklist']

/** Text report of a record, downloaded in the browser (demo: no file storage). */
function download(name, lines, notify) {
  const url = URL.createObjectURL(new Blob([['BUILDDESK DEMO SAFETY RECORD: demo data, not a real record', '', ...lines].join('\n')], { type: 'text/plain' }))
  const a = Object.assign(document.createElement('a'), { href: url, download: `${name}-demo.txt` })
  document.body.appendChild(a); a.click(); a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
  notify?.(`Demo: ${name} report downloaded from the on-screen record (no file storage)`)
}

export default function Documents({ notify, search }) {
  const ctx = useSafety(notify)
  const s = ctx.s
  const [kind, setKind] = useState('all')
  const q = (search || '').toLowerCase()
  const register = s.documents.filter((d) => SAFETY_DISCIPLINES.includes(d.discipline))
  const records = [
    ...(s.safetyInspections || []).filter((x) => !['Scheduled'].includes(x.status)).map((x) => ({ key: x.id, kind: 'Safety inspection report', ref: x.id, title: `${x.category} · ${x.workArea}`, date: x.date, status: x.status,
      lines: [`Inspection ${x.id}: ${x.category}`, `Site: ${siteName(x.siteId)}, ${x.workArea}`, `Date: ${x.date}  Inspector: ${x.inspector}`, `Result: ${x.status}  Severity: ${x.severity || '-'}`, '', ...x.checklist.map((c) => `[${c.result || ' '}] ${c.item}`), '', `Findings: ${x.findings || '-'}`] })),
    ...s.safety.filter((x) => SF.isIncident(x) && x.investigation).map((x) => ({ key: x.id, kind: 'Incident investigation report', ref: x.id, title: `${x.kind}: ${x.description}`, date: x.date, status: x.incidentStage,
      lines: [`Incident ${x.id} (${x.kind})`, `Site: ${siteName(x.siteId)} ${x.location || ''}`, `Date: ${x.date} ${x.time || ''}`, `Description: ${x.description}`, `Immediate response: ${x.immediateAction || '-'}`, `Findings: ${x.investigation.findings}`, `Root cause: ${x.investigation.rootCause || 'not yet established'}`, 'People involved: restricted (held by the Safety Officer)'] })),
    ...(s.trainingSessions || []).map((t) => ({ key: t.id, kind: 'Training record', ref: t.id, title: `${t.type}: ${t.title}`, date: t.date, status: `${t.attendees.length} attended`,
      lines: [`Training ${t.id}: ${t.type}`, `Topic: ${t.title}`, `Date: ${t.date}  Trainer: ${t.trainer}`, '', 'Attendance:', ...t.attendees.map((id) => `- ${workerOf(id)?.name} (${id})`)] })),
    ...(s.permits || []).filter((p) => p.status !== 'Draft').map((p) => ({ key: p.id, kind: 'Permit record', ref: p.id, title: `${p.type}: ${p.activity}`, date: p.validFrom.slice(0, 10), status: SF.permitStatus(p),
      lines: [`Permit ${p.id}: ${p.type}`, `Work area: ${p.workArea}`, `Valid: ${p.validFrom} to ${p.validTo}`, `Hazards: ${p.hazards}`, 'Precautions:', ...p.precautions.map((x) => `- ${x}`), `Approver: ${p.approver || 'not approved'}`, `Status: ${SF.permitStatus(p)}`, p.closure ? `Closure: ${p.closure.handover}` : ''] })),
    ...(s.drills || []).filter((d) => d.status === 'Completed').map((d) => ({ key: d.id, kind: 'Emergency drill record', ref: d.id, title: d.type, date: d.date, status: d.status, lines: [`Drill ${d.id}: ${d.type}`, `Date: ${d.date}`, `Attendance: ${d.attendance}`, `Outcome: ${d.outcome}`] })),
    ...(s.safetyActions || []).filter((a) => a.evidence.length).map((a) => ({ key: a.id, kind: 'Corrective action evidence', ref: a.id, title: a.text, date: a.evidence.slice(-1)[0].at.slice(0, 10), status: a.status, lines: [`Corrective action ${a.id} (${a.sourceType} ${a.sourceId || ''})`, `Required: ${a.text}`, `Responsible: ${a.owner}`, '', 'Evidence:', ...a.evidence.map((e) => `- ${e.at} ${e.by}: ${e.text}`), `Verified by: ${a.verifiedBy || 'not yet verified'}`] })),
  ].filter((r) => (kind === 'all' || r.kind === kind) && (!q || `${r.ref} ${r.title}`.toLowerCase().includes(q))).sort((a, b) => b.date.localeCompare(a.date))
  return (
    <>
      <Card title="Safety documents (document register)" sub="Risk assessments, method statements and safety plans from the shared document register. Approved revisions are current; drafts are not for use." bodyClass="">
        <DataTable dense rows={register} emptyText="No safety documents." columns={[
          { key: 'id', header: 'No.', render: (d) => <span className="cell-main">{d.id}</span> }, { key: 't', header: 'Document', render: (d) => <span className="wrap-cell">{d.title}<div className="cell-sub">{d.discipline}</div></span> },
          { key: 'r', header: 'Current revision', render: (d) => { const a = latestApproved(d); return a ? `${a.rev} (${formatDate(a.date)})` : <span className="down">None approved</span> } },
          { key: 's', header: 'Approval', render: (d) => { const l = latestRevision(d); return l === latestApproved(d) ? <Badge tone="success">Approved</Badge> : <Badge tone="warning">{l.rev} {l.status}</Badge> } },
          { key: 'x', header: '', render: (d) => <button className="btn btn-sm" onClick={() => download(d.id, [`${d.id} ${d.title}`, `Category: ${d.discipline}`, ...d.revisions.map((r) => `${r.rev} ${r.date} ${r.status}${r.approvedBy ? ` (approved by ${r.approvedBy})` : ''} ${r.note || ''}`)], notify)}>Download</button> },
        ]} />
      </Card>
      <Card title="Safety record reports" sub="Generated from the safety records; downloads are demo text files (no file storage in this prototype)" bodyClass="" className="section-gap">
        <div className="toolbar"><label className="field">Type<select value={kind} onChange={(e) => setKind(e.target.value)}><option value="all">All</option>{['Safety inspection report', 'Incident investigation report', 'Training record', 'Permit record', 'Emergency drill record', 'Corrective action evidence'].map((x) => <option key={x}>{x}</option>)}</select></label></div>
        <DataTable dense rows={records} emptyText="No records." columns={[
          { key: 'k', header: 'Type', render: (r) => r.kind }, { key: 'ref', header: 'Ref.', render: (r) => <span className="cell-main">{r.ref}</span> },
          { key: 't', header: 'Title', render: (r) => <span className="wrap-cell">{r.title}</span> }, { key: 'd', header: 'Date', render: (r) => formatDate(r.date) },
          { key: 's', header: 'Status', render: (r) => <Badge>{r.status}</Badge> }, { key: 'x', header: '', render: (r) => <button className="btn btn-sm" onClick={() => download(r.ref, r.lines, notify)}>Download</button> },
        ]} />
      </Card>
    </>
  )
}
