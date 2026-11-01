import { useState } from 'react'
import { useDemoSession } from '../../auth/DemoSession.jsx'
import { can, PERMISSIONS as P } from '../../auth/demoRoles.js'
import { Badge } from '../../components/UI.jsx'
import { QA_INSPECTORS } from '../../data/demo/qaDemo.js'
import { materialOf } from '../../services/inventory.js'
import { actorOf } from '../../services/procurement.js'
import * as Q from '../../services/qa.js'
import { latestApproved, latestRevision, siteOf } from '../../services/site.js'
import { todayISO } from '../../utils/date.js'
import { formatDate } from '../../utils/format.js'
import { useInventory } from '../store-keeper/InventoryContext.jsx'
import { Drawer, FormError, HistoryList, fmtStamp } from '../store-keeper/shared.jsx'
import { useSite } from '../site-engineer/SiteContext.jsx'

/**
 * Everything a QA page needs: shared site records (inspections, NCRs, documents, QA lists),
 * the inventory records (GRNs / POs, read only), permissions and an `act` helper that runs a
 * guarded transition and reports the result.
 */
export function useQA(notify) {
  const { user, role } = useDemoSession()
  const site = useSite()
  const inv = useInventory()
  const actor = actorOf(user, role)
  const [error, setError] = useState('')
  const has = (p) => can(role.id, p)
  const s = site.state
  const today = todayISO()
  return {
    user, role, actor, site, inv, s, today, error, setError,
    perms: { manage: has(P.QA_MANAGE), review: has(P.QUALITY_REVIEW), clear: has(P.QA_CLEARANCE) },
    /** Run a QA transition. Returns true on success (and shows a toast). */
    act: (name, args) => {
      const r = site.actions[name](args, actor)
      if (!r.ok) { setError(r.error); return false }
      setError('')
      notify?.(`Demo: ${r.message}. Shown on the connected dashboards in this session; nothing is saved`)
      return true
    },
    qaInspections: s.inspections.filter((q) => q.owner === 'QA' || q.owner === 'Third-party'),
    isMine: (q) => Q.inspectorName(q.inspector) === user.name,
  }
}

export const siteName = (id) => (id ? siteOf(id)?.name || id : 'Project-wide')
export const docOf = (s, id) => s.documents.find((d) => d.id === id)
/** "S-102 R0 (approved)" — the revision that is current for construction */
export function docRefLabel(s, id) {
  const d = docOf(s, id)
  if (!d) return id
  const a = latestApproved(d)
  const last = latestRevision(d)
  return `${d.id} ${a ? `${a.rev} (approved)` : `${last.rev} (${last.status.toLowerCase()}, not approved)`}`
}
export const materialName = (t) => (t.sku ? materialOf(t.sku)?.name || t.sku : t.material)

/** Status badge with Overdue derived from the date */
export function InspStatus({ q, today }) {
  const st = Q.inspectionStatus(q, today)
  return <><Badge>{st}</Badge>{q.clearance && <div className="cell-sub up">Cleared: {q.clearance.activity.toLowerCase()}</div>}{q.attempt > 1 && <div className="cell-sub">Attempt {q.attempt}</div>}</>
}

export function InspectorSelect({ value, onChange, label = 'Assigned QA inspector' }) {
  return (
    <label className="field">{label}
      <select value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">Select…</option>
        {QA_INSPECTORS.map((i) => <option key={i.name} value={i.name}>{i.name} · {i.org}</option>)}
      </select>
    </label>
  )
}

/** Clickable summary cards (same look as the dashboard stat tiles) */
export function CardGrid({ items }) {
  return (
    <div className="stat-grid">
      {items.map((s) => (
        <button key={s.label} type="button" className={`stat stat-btn ${s.tone ? `tone-${s.tone}` : ''}`} onClick={s.onClick} title={`Open: ${s.label}`}>
          <div className="k">{s.label}</div>
          <div className="v">{s.value}</div>
          {s.sub && <div className="s">{s.sub}</div>}
        </button>
      ))}
    </div>
  )
}

/** Simple browser print of one record (no file is created or uploaded). */
export function printRecord(title, html) {
  const w = window.open('', '_blank', 'width=900,height=700')
  if (!w) return false
  w.document.write(`<!doctype html><title>${title}</title><style>body{font:13px/1.5 system-ui,sans-serif;padding:24px;color:#111}h1{font-size:18px}table{border-collapse:collapse;width:100%;margin:10px 0}td,th{border:1px solid #ccc;padding:4px 6px;text-align:left;vertical-align:top}.demo{color:#b45309;font-weight:600}</style>${html}<p class="demo">Demo record for review only. Not an official inspection report.</p>`)
  w.document.close()
  w.focus()
  w.print()
  return true
}
const esc = (v) => String(v ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]))
export function inspectionHtml(ctx, q) {
  const chain = Q.chainOf(ctx.s, q)
  return `<h1>Inspection report ${esc(q.id)}</h1>
  <p><b>${esc(q.title)}</b><br>${esc(siteName(q.siteId))} · ${esc(q.location)}<br>Type: ${esc(q.type)} · Inspector: ${esc(q.inspector)} · Date: ${esc(q.date)} ${esc(q.time || '')}<br>
  Result: <b>${esc(Q.inspectionStatus(q))}</b>${q.clearance ? ` · Cleared for ${esc(q.clearance.activity)} by ${esc(q.clearance.by)}` : ''}<br>Drawings: ${esc((q.drawingRefs || []).map((d) => docRefLabel(ctx.s, d)).join(', ') || '—')}</p>
  <table><tr><th>#</th><th>Check item</th><th>Acceptance criteria</th><th>Result</th><th>Observation</th></tr>
  ${q.checklist.map((c, i) => `<tr><td>${i + 1}</td><td>${esc(c.item)}</td><td>${esc(c.criteria || '')}</td><td>${esc(c.result || '—')}</td><td>${esc(c.observation || '')}</td></tr>`).join('')}</table>
  ${q.measurements?.length ? `<p><b>Measurements / observations</b></p><table>${q.measurements.map((m) => `<tr><td>${esc(m.name)}</td><td>${esc(m.value)}</td><td>${esc(m.ref || '')}</td></tr>`).join('')}</table>` : ''}
  <p><b>Comments:</b> ${esc(q.notes || '—')}</p><p><b>NCRs:</b> ${esc((q.ncrIds || []).join(', ') || 'None')}</p>
  <p><b>Inspection history:</b> ${chain.map((x) => `${esc(x.id)} (${esc(x.status)})`).join(' → ')}</p>`
}

/** Record result form (checklist, measurements, overall result, NCR assignment when not passed). */
function ResultForm({ ctx, q, onDone }) {
  const usable = ctx.s.checklists.filter((c) => Q.checklistBasis(ctx.s, c).usable)
  const [clId, setClId] = useState(q.checklistId || '')
  const base = q.checklist.length ? q.checklist : (usable.find((c) => c.id === clId)?.items || [])
  const [items, setItems] = useState(base.map((c) => ({ ...c, result: c.result || '', observation: c.observation || '' })))
  const [meas, setMeas] = useState(q.measurements?.length ? q.measurements : [{ name: '', value: '', ref: '' }])
  const [result, setResult] = useState('')
  const [comments, setComments] = useState(q.notes || '')
  const resp = Q.responsibleOptions(q.siteId, q.projectId)
  const [ncr, setNcr] = useState({ category: q.type, severity: 'Major', responsible: resp[0]?.name || '', requiredAction: '', target: '' })
  const failed = items.some((c) => c.result === 'Fail')
  const set = (i, k) => (e) => setItems(items.map((c, j) => (j === i ? { ...c, [k]: e.target.value } : c)))
  const pickChecklist = (id) => { setClId(id); setItems((usable.find((c) => c.id === id)?.items || []).map((c) => ({ ...c, result: '', observation: '' }))) }
  const payload = () => ({ id: q.id, checklistId: clId, checklist: items, measurements: meas.filter((m) => m.name.trim()), comments })
  const respRole = resp.find((r) => r.name === ncr.responsible)?.role
  const submit = () => {
    if (ctx.act('submitInspectionResult', { ...payload(), result, ncr: { ...ncr, responsibleRole: respRole } })) onDone()
  }
  return (
    <div className="receipt-form" style={{ marginTop: 14 }}>
      <div className="sub-panel-head"><b>Record inspection result</b><span className="cell-sub">Submitted results are final; corrections are checked by a separate reinspection.</span></div>
      {!q.checklist.length && (
        <div className="receipt-grid"><label className="field span-2">Checklist (this older record has none)
          <select value={clId} onChange={(e) => pickChecklist(e.target.value)}><option value="">Select…</option>{usable.map((c) => <option key={c.id} value={c.id}>{c.id} · {c.title}</option>)}</select>
        </label></div>
      )}
      <div className="table-wrap"><table className="qa-check">
        <thead><tr><th>Check item</th><th>Acceptance criteria (source)</th><th>Result</th><th>Observation</th></tr></thead>
        <tbody>{items.map((c, i) => (
          <tr key={c.id || i}>
            <td>{c.item}</td><td className="cell-sub wrap-cell">{c.criteria}</td>
            <td><select aria-label={`Result: ${c.item}`} value={c.result} onChange={set(i, 'result')}><option value="">—</option>{Q.RESULT_OPTIONS.map((r) => <option key={r}>{r}</option>)}</select></td>
            <td><input aria-label={`Observation: ${c.item}`} value={c.observation} onChange={set(i, 'observation')} placeholder={c.result === 'Fail' ? 'Required for a failed item' : 'Optional'} /></td>
          </tr>
        ))}</tbody>
      </table></div>
      <div className="sub-panel-head" style={{ marginTop: 10 }}><b>Measurements & observations</b><span className="cell-sub">Record measured values as found; limits are in the referenced drawing / specification.</span></div>
      {meas.map((m, i) => (
        <div key={i} className="receipt-grid qa-meas">
          <label className="field">What was measured<input value={m.name} onChange={(e) => setMeas(meas.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} /></label>
          <label className="field">Value found<input value={m.value} onChange={(e) => setMeas(meas.map((x, j) => (j === i ? { ...x, value: e.target.value } : x)))} /></label>
          <label className="field">Reference<input value={m.ref} onChange={(e) => setMeas(meas.map((x, j) => (j === i ? { ...x, ref: e.target.value } : x)))} placeholder="Drawing / spec" /></label>
        </div>
      ))}
      <button type="button" className="link-btn" style={{ marginLeft: 18 }} onClick={() => setMeas([...meas, { name: '', value: '', ref: '' }])}>+ Add measurement</button>
      <div className="receipt-grid">
        <label className="field">Overall result
          <select value={result} onChange={(e) => setResult(e.target.value)}>
            <option value="">Select…</option>
            {!failed && <option>Pass</option>}<option>Fail</option>{Q.ALLOW_CONDITIONAL && <option value="Conditional">Conditional / requires action</option>}
          </select>
        </label>
        <label className="field">{result && result !== 'Pass' ? 'Reason (required)' : 'Comments'}<input value={comments} onChange={(e) => setComments(e.target.value)} /></label>
      </div>
      {result && result !== 'Pass' && (
        <>
          <div className="sub-panel-head"><b>Non-conformance and corrective action</b><span className="cell-sub">Raised and linked to {q.id}</span></div>
          <div className="receipt-grid">
            <label className="field">Defect category<select value={ncr.category} onChange={(e) => setNcr({ ...ncr, category: e.target.value })}>{[q.type, ...Q.DEFECT_CATEGORIES.filter((c) => c !== q.type)].map((c) => <option key={c}>{c}</option>)}</select></label>
            <label className="field">Severity<select value={ncr.severity} onChange={(e) => setNcr({ ...ncr, severity: e.target.value })}>{Q.SEVERITIES.map((c) => <option key={c}>{c}</option>)}</select></label>
            <label className="field">Responsible<select value={ncr.responsible} onChange={(e) => setNcr({ ...ncr, responsible: e.target.value })}>{resp.map((r) => <option key={r.name} value={r.name}>{r.name} ({r.role})</option>)}</select></label>
            <label className="field">Target date<input type="date" min={todayISO()} value={ncr.target} onChange={(e) => setNcr({ ...ncr, target: e.target.value })} /></label>
            <label className="field span-2">Required corrective action<input value={ncr.requiredAction} onChange={(e) => setNcr({ ...ncr, requiredAction: e.target.value })} /></label>
          </div>
        </>
      )}
      <div className="sk-form-foot">
        <FormError error={ctx.error} />
        <div className="jv-submit">
          <button className="btn btn-primary" type="button" onClick={submit}>Submit result</button>
          <button className="btn" type="button" onClick={() => ctx.act('saveInspectionDraft', payload()) && onDone()}>Save draft</button>
        </div>
      </div>
    </div>
  )
}

/** Inspection detail: record, checklist, links, history; QA actions where permitted. */
export function InspectionDrawer({ ctx, id, onClose, initialMode = null }) {
  const q = ctx.s.inspections.find((x) => x.id === id)
  const [mode, setMode] = useState(initialMode) // 'result' | 'reschedule' | 'clear'
  const [rs, setRs] = useState({ date: q?.date || '', time: q?.time || '10:00', inspector: Q.inspectorName(q?.inspector || ''), note: '' })
  const [clear, setClear] = useState({ activity: /reinforcement|shuttering|formwork|sleeve/i.test(q?.title || '') ? 'Concrete pour' : '', note: '' })
  if (!q) return null
  const chain = Q.chainOf(ctx.s, q)
  const open = Q.OPEN_INSPECTION.includes(q.status)
  const isQA = q.owner === 'QA'
  const ncrs = (q.ncrIds || []).map((n) => ctx.s.ncrs.find((x) => x.id === n)).filter(Boolean)
  const req = q.requestId && ctx.s.qaRequests.find((r) => r.id === q.requestId)
  const task = q.taskId && ctx.s.tasks.find((t) => t.id === q.taskId)
  return (
    <Drawer title={`${q.id} · ${q.title}`} sub={`${siteName(q.siteId)} · ${q.location}`} onClose={() => { ctx.setError(''); onClose() }} wide>
      <dl className="details">
        <dt>Status</dt><dd><InspStatus q={q} today={ctx.today} /></dd>
        <dt>Type</dt><dd>{q.type} · priority {q.priority || 'Normal'}</dd>
        <dt>Scheduled</dt><dd>{formatDate(q.date)} {q.time || ''} · {q.inspector}</dd>
        <dt>Requested by</dt><dd>{q.requestedBy || '—'}{req ? ` · ${req.id}` : ''}</dd>
        <dt>Related task</dt><dd>{task ? `${task.id} · ${task.title}` : q.taskId || '—'}</dd>
        <dt>Drawings / specs</dt><dd>{(q.drawingRefs || []).map((d) => docRefLabel(ctx.s, d)).join(', ') || '—'}</dd>
        <dt>Checklist</dt><dd>{q.checklistId ? `${q.checklistId} · ${ctx.s.checklists.find((c) => c.id === q.checklistId)?.title || ''}` : '—'}</dd>
        {q.recordedAt && <><dt>Result recorded</dt><dd>{fmtStamp(q.recordedAt)} by {q.recordedBy || q.inspector}</dd></>}
        {q.notes && <><dt>Comments</dt><dd>{q.notes}</dd></>}
        {q.clearance && <><dt>QA clearance</dt><dd className="up">{q.clearance.activity} · {q.clearance.by} · {fmtStamp(q.clearance.at)}{q.clearance.note ? ` · ${q.clearance.note}` : ''}</dd></>}
        {q.reviewStatus && <><dt>QA review</dt><dd>{q.reviewStatus}{q.reviewer ? ` · ${q.reviewer}` : ''}</dd></>}
      </dl>

      {chain.length > 1 && (
        <div className="info-note" style={{ marginTop: 12 }}><span>↻</span><div><b>Inspection history (kept in full):</b> {chain.map((x) => `${x.id} ${x.status}${x.recordedAt ? ` (${formatDate(x.recordedAt.slice(0, 10))})` : ''}`).join(' → ')}</div></div>
      )}
      {ncrs.length > 0 && <div className="info-note warn" style={{ marginTop: 8 }}><span>⚠</span><div>Linked NCR{ncrs.length > 1 ? 's' : ''}: {ncrs.map((n) => `${n.id} (${Q.ncrStatus(n)})`).join(', ')}</div></div>}

      {mode !== 'result' && q.checklist.length > 0 && (
        <div className="table-wrap" style={{ marginTop: 12 }}><table className="qa-check">
          <thead><tr><th>Check item</th><th>Acceptance criteria (source)</th><th>Result</th><th>Observation</th></tr></thead>
          <tbody>{q.checklist.map((c, i) => <tr key={c.id || i}><td>{c.item}</td><td className="cell-sub wrap-cell">{c.criteria || '—'}</td><td>{c.result ? <Badge tone={c.result === 'Fail' ? 'danger' : c.result === 'Pass' ? 'success' : 'muted'}>{c.result}</Badge> : <span className="cell-sub">Not recorded</span>}</td><td className="wrap-cell">{c.observation || ''}</td></tr>)}</tbody>
        </table></div>
      )}
      {mode !== 'result' && q.measurements?.length > 0 && <p className="cell-sub" style={{ marginTop: 8 }}>Measurements: {q.measurements.map((m) => `${m.name}: ${m.value}${m.ref ? ` (${m.ref})` : ''}`).join(' · ')}</p>}

      {isQA && ctx.perms.manage && open && mode === 'result' && <ResultForm ctx={ctx} q={q} onDone={() => setMode(null)} />}
      {isQA && ctx.perms.manage && open && mode === 'reschedule' && (
        <div className="receipt-form" style={{ marginTop: 14 }}>
          <div className="receipt-grid">
            <label className="field">New date<input type="date" min={ctx.today} value={rs.date} onChange={(e) => setRs({ ...rs, date: e.target.value })} /></label>
            <label className="field">Time<input type="time" value={rs.time} onChange={(e) => setRs({ ...rs, time: e.target.value })} /></label>
            <InspectorSelect value={rs.inspector} onChange={(v) => setRs({ ...rs, inspector: v })} />
            <label className="field">Reason (required)<input value={rs.note} onChange={(e) => setRs({ ...rs, note: e.target.value })} /></label>
          </div>
          <div className="sk-form-foot"><FormError error={ctx.error} /><div className="jv-submit"><button className="btn btn-primary" onClick={() => ctx.act('rescheduleInspection', { id: q.id, ...rs }) && setMode(null)}>Save schedule</button><button className="btn" onClick={() => setMode(null)}>Cancel</button></div></div>
        </div>
      )}
      {isQA && ctx.perms.clear && mode === 'clear' && (
        <div className="receipt-form" style={{ marginTop: 14 }}>
          <div className="receipt-grid">
            <label className="field">Activity cleared<input value={clear.activity} onChange={(e) => setClear({ ...clear, activity: e.target.value })} placeholder="e.g. Concrete pour" /></label>
            <label className="field">Note<input value={clear.note} onChange={(e) => setClear({ ...clear, note: e.target.value })} /></label>
          </div>
          <div className="sk-form-foot"><FormError error={ctx.error} /><div className="jv-submit"><button className="btn btn-primary" onClick={() => ctx.act('recordClearance', { id: q.id, ...clear }) && setMode(null)}>Record QA clearance</button><button className="btn" onClick={() => setMode(null)}>Cancel</button></div></div>
        </div>
      )}

      {!mode && (
        <div className="jv-submit" style={{ marginTop: 14, flexWrap: 'wrap' }}>
          {isQA && ctx.perms.manage && open && (q.date <= ctx.today
            ? <button className="btn btn-primary" onClick={() => { ctx.setError(''); setMode('result') }}>Record result</button>
            : <span className="cell-sub">Results can be recorded from {formatDate(q.date)}.</span>)}
          {isQA && ctx.perms.manage && open && <button className="btn" onClick={() => { ctx.setError(''); setMode('reschedule') }}>Reschedule / reassign</button>}
          {isQA && ctx.perms.clear && q.status === 'Passed' && !q.clearance && <button className="btn" onClick={() => { ctx.setError(''); setMode('clear') }}>Record QA clearance</button>}
          {q.reviewStatus === 'Awaiting QA review' && ctx.perms.review && <><button className="btn btn-primary" onClick={() => ctx.act('qaReview', { id: q.id, accept: true, note: 'Reviewed by QA' })}>QA accept</button><button className="btn" onClick={() => ctx.act('qaReview', { id: q.id, accept: false, note: 'Returned by QA' })}>QA reject</button></>}
          <button className="btn" onClick={() => printRecord(`Inspection ${q.id}`, inspectionHtml(ctx, q))}>Print report</button>
          {!ctx.perms.manage && <span className="cell-sub">View only for your role.</span>}
        </div>
      )}
      {!mode && <FormError error={ctx.error} />}
      <div className="sub-panel-head" style={{ marginTop: 14 }}><b>Review and closure history</b></div>
      {q.history?.length ? <HistoryList items={[...q.history].reverse()} /> : <p className="cell-sub">Earlier record: no history captured before this session.</p>}
    </Drawer>
  )
}

/** Notifications derived from the shared records (nothing is sent). */
export function qaNotifications(ctx) {
  const { s, today } = ctx
  const soon = (d) => d >= today && d <= new Date(Date.parse(today) + 3 * 864e5).toISOString().slice(0, 10)
  const out = []
  for (const r of s.qaRequests.filter((x) => x.status === 'Submitted')) out.push({ id: `rq-${r.id}`, kind: 'New inspection request', ref: r.id, at: r.submittedAt, text: `${r.activity} · ${r.location} · by ${r.submittedBy}, needed ${formatDate(r.requiredDate)}`, section: 'requests', pref: 'requests' })
  for (const q of ctx.qaInspections.filter((x) => Q.OPEN_INSPECTION.includes(x.status))) {
    if (ctx.isMine(q) && q.date >= today) out.push({ id: `as-${q.id}`, kind: q.date === today ? 'Inspection today' : 'Assigned inspection', ref: q.id, at: `${q.date}T${q.time || '09:00'}`, text: `${q.title} · ${formatDate(q.date)} ${q.time || ''}`, section: 'schedule', pref: 'assigned' })
    if (Q.inspectionStatus(q, today) === 'Overdue') out.push({ id: `od-${q.id}`, kind: 'Inspection overdue', tone: 'danger', ref: q.id, at: `${q.date}T23:00`, text: `${q.title}: no result recorded since ${formatDate(q.date)}`, section: 'schedule', pref: 'upcoming' })
  }
  for (const q of s.inspections.filter((x) => ['Failed', 'Conditional'].includes(x.status) && x.recordedAt)) out.push({ id: `fl-${q.id}`, kind: 'Failed inspection', tone: 'danger', ref: q.id, at: q.recordedAt, text: `${q.title}: ${q.notes || 'see NCR'}`, section: 'records', pref: 'failed' })
  for (const n of s.ncrs.filter((x) => Q.ncrStatus(x) !== 'Closed')) {
    if (n.reported >= new Date(Date.parse(today) - 7 * 864e5).toISOString().slice(0, 10)) out.push({ id: `nc-${n.id}`, kind: 'NCR raised', tone: 'warning', ref: n.id, at: `${n.reported}T12:00`, text: n.description, section: 'ncr', pref: 'ncr' })
    if (n.action && n.action.status !== 'Done' && (n.action.due < today || soon(n.action.due))) out.push({ id: `dl-${n.id}`, kind: n.action.due < today ? 'Corrective action overdue' : 'Corrective action due soon', tone: n.action.due < today ? 'danger' : 'warning', ref: n.action.id, at: `${n.action.due}T09:00`, text: `${n.action.text} · ${n.action.owner} · due ${formatDate(n.action.due)}`, section: 'actions', pref: 'deadlines' })
    if (Q.ncrStatus(n) === 'Awaiting Verification') out.push({ id: `vr-${n.id}`, kind: 'Correction to verify', tone: 'warning', ref: n.id, at: n.action?.completedAt || `${n.reported}T12:00`, text: `${n.action?.owner}: ${n.action?.note || 'correction completed'}`, section: 'actions', pref: 'reinspection' })
    if (Q.ncrStatus(n) === 'Reinspection Required' && !n.reinspectionId) out.push({ id: `ri-${n.id}`, kind: 'Reinspection to schedule', tone: 'warning', ref: n.id, at: `${n.reported}T12:00`, text: n.description, section: 'reinspection', pref: 'reinspection' })
  }
  for (const t of s.materialTests.filter((x) => x.status === 'Report Received')) out.push({ id: `mt-${t.id}`, kind: 'Test report to review', tone: 'warning', ref: t.id, at: `${t.testDate}T12:00`, text: `${materialName(t)} · ${t.testType} · ${t.reportRef}`, section: 'materials', pref: 'materials' })
  return out.filter((n) => s.qaPrefs?.[n.pref] !== false).sort((a, b) => (b.at || '').localeCompare(a.at || ''))
}
