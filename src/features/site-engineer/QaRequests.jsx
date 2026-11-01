import { useState } from 'react'
import DataTable from '../../components/DataTable.jsx'
import Icon from '../../components/Icon.jsx'
import { Badge, Card } from '../../components/UI.jsx'
import * as Q from '../../services/qa.js'
import { latestApproved, latestRevision } from '../../services/site.js'
import { addDays, todayISO } from '../../utils/date.js'
import { formatDate } from '../../utils/format.js'
import { Drawer, FormError, Locked, fmtStamp } from '../store-keeper/shared.jsx'
import { PhotoInput, projectIdOfSite } from './shared.jsx'

const docLabel = (s, id) => {
  const d = s.documents.find((x) => x.id === id)
  if (!d) return id
  const a = latestApproved(d)
  return a ? `${d.id} ${a.rev}` : `${d.id} ${latestRevision(d).rev} (not approved)`
}

/** Request a QA inspection (new, or completing the Site Supervisor's "work ready" notice). */
function RequestForm({ ctx, base, onClose }) {
  const s = ctx.site.state
  const usable = s.checklists.filter((c) => Q.checklistBasis(s, c).usable)
  const docs = s.documents.filter((d) => latestApproved(d))
  const [f, setF] = useState({
    id: base?.id, siteId: base?.siteId || ctx.mySites[0]?.id || '', location: base?.location || '', activity: base?.activity || '', taskId: base?.taskId || '',
    checklistId: base?.checklistId || usable[0]?.id || '', drawingRefs: base?.drawingRefs || [], requiredDate: base?.requiredDate || addDays(todayISO(), 1),
    readinessConfirmed: false, docs: (base?.docs || []).join(', '), note: '', photos: [],
  })
  const set = (k) => (e) => setF({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value })
  const tasks = s.tasks.filter((t) => t.siteId === f.siteId)
  const submit = () => ctx.act('submitInspectionRequest', { ...f, projectId: projectIdOfSite(f.siteId), docs: f.docs.split(',').map((x) => x.trim()).filter(Boolean) }) && onClose()
  return (
    <Drawer title={base ? `Request QA inspection · ${base.id}` : 'Request QA inspection'} sub="QA schedules the inspection; nothing is cleared until QA records a pass and clearance" onClose={() => { ctx.setError(''); onClose() }}>
      {base?.readiness && <div className="info-note"><span>ℹ</span><div>Reported ready by <b>{base.readiness.by}</b> ({fmtStamp(base.readiness.at)}): {base.readiness.note}</div></div>}
      {base?.returnReason && <div className="info-note warn"><span>⚠</span><div>Returned by QA: {base.returnReason}</div></div>}
      <div className="receipt-form">
        <div className="receipt-grid">
          <label className="field">Site<select value={f.siteId} onChange={set('siteId')} disabled={!!base}>{ctx.mySites.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select></label>
          <label className="field">Related task<select value={f.taskId} onChange={set('taskId')}><option value="">None</option>{tasks.map((t) => <option key={t.id} value={t.id}>{t.id} · {t.title}</option>)}</select></label>
          <label className="field span-2">Activity ready for inspection<input value={f.activity} onChange={set('activity')} placeholder="e.g. Raft reinforcement, grid A1–A4" /></label>
          <label className="field">Work location<input value={f.location} onChange={set('location')} placeholder="Tower, floor, grid" /></label>
          <label className="field">Required inspection date<input type="date" min={todayISO()} value={f.requiredDate} onChange={set('requiredDate')} /></label>
          <label className="field span-2">Applicable checklist<select value={f.checklistId} onChange={set('checklistId')}>{usable.map((c) => <option key={c.id} value={c.id}>{c.id} · {c.title}</option>)}</select></label>
          <label className="field span-2">Drawing / specification
            <select value="" onChange={(e) => e.target.value && setF({ ...f, drawingRefs: [...new Set([...f.drawingRefs, e.target.value])] })}><option value="">Add an approved document…</option>{docs.map((d) => <option key={d.id} value={d.id}>{docLabel(s, d.id)} · {d.title}</option>)}</select>
            <span className="cell-sub">{f.drawingRefs.length ? f.drawingRefs.map((d) => docLabel(s, d)).join(', ') : 'None added'}</span>
          </label>
          <label className="field span-2">Supporting documents (references)<input value={f.docs} onChange={set('docs')} placeholder="e.g. BBS rev 2, pour card" /></label>
          <PhotoInput value={f.photos} onChange={(photos) => setF({ ...f, photos })} />
          <label className="field span-2">Note for QA<input value={f.note} onChange={set('note')} placeholder="e.g. needed before concrete pour" /></label>
          <label className="check-row span-2"><input type="checkbox" checked={f.readinessConfirmed} onChange={set('readinessConfirmed')} /> I have checked the work is technically ready for inspection</label>
        </div>
        <div className="sk-form-foot"><FormError error={ctx.error} /><div className="jv-submit"><button className="btn btn-primary" onClick={submit}>Send request to QA</button><button className="btn" onClick={onClose}>Cancel</button></div></div>
      </div>
    </Drawer>
  )
}

/** QA inspection requests for the engineer's sites, with the outcome from QA. */
export default function QaRequestsCard({ ctx }) {
  const [form, setForm] = useState(null) // 'new' | request
  const s = ctx.site.state
  const rows = s.qaRequests.filter(ctx.inScope).sort((a, b) => (b.submittedAt || b.readiness?.at || '').localeCompare(a.submittedAt || a.readiness?.at || ''))
  const outcome = (r) => {
    const q = r.inspectionId && s.inspections.find((x) => x.id === r.inspectionId)
    if (!q) return <span className="cell-sub">—</span>
    const last = Q.latestInChain(s, q)
    return <>{last.id} · <Badge>{Q.inspectionStatus(last)}</Badge>{last.clearance && <div className="cell-sub up">QA-cleared: {last.clearance.activity.toLowerCase()}</div>}{(last.ncrIds || q.ncrIds || []).length > 0 && <div className="cell-sub">{[...(q.ncrIds || []), ...(last.ncrIds || [])].filter((v, i, a) => a.indexOf(v) === i).join(', ')}</div>}</>
  }
  return (
    <Card title="QA inspection requests" sub="Site Supervisor reports work ready → you check technical readiness and request → QA schedules, inspects and clears" bodyClass="" className="mb"
      action={ctx.perms.inspect ? <button className="btn btn-primary btn-sm" onClick={() => setForm('new')}><Icon name="plus" size={14} />Request QA inspection</button> : <Locked>View only</Locked>}>
      <DataTable dense rows={rows} emptyText="No QA inspection requests on your sites." columns={[
        { key: 'id', header: 'Request', render: (r) => <><div className="cell-main">{r.id}</div><div className="cell-sub">{r.submittedAt ? fmtStamp(r.submittedAt) : `ready ${fmtStamp(r.readiness?.at)}`}</div></> },
        { key: 'a', header: 'Activity / location', render: (r) => <span className="wrap-cell">{r.activity}<div className="cell-sub">{r.location}</div></span> },
        { key: 'r', header: 'Ready (Supervisor)', render: (r) => <span className="cell-sub wrap-cell">{r.readiness?.by}: {r.readiness?.note}</span> },
        { key: 'd', header: 'Required', render: (r) => formatDate(r.requiredDate) },
        { key: 's', header: 'Status', render: (r) => <><Badge>{r.status}</Badge>{r.returnReason && r.status.startsWith('Returned') && <div className="cell-sub down">{r.returnReason}</div>}</> },
        { key: 'o', header: 'QA result', render: outcome },
        { key: 'x', header: '', render: (r) => (ctx.perms.inspect && ['Ready – awaiting Site Engineer', 'Returned to Site Engineer'].includes(r.status) ? <button className="btn btn-sm btn-primary" onClick={() => setForm(r)}>Check & request</button> : null) },
      ]} />
      {form && <RequestForm ctx={ctx} base={form === 'new' ? null : form} onClose={() => setForm(null)} />}
    </Card>
  )
}
