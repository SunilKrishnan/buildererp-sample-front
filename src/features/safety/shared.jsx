import { useState } from 'react'
import { useDemoSession } from '../../auth/DemoSession.jsx'
import { can, PERMISSIONS as P } from '../../auth/demoRoles.js'
import { Badge } from '../../components/UI.jsx'
import { HAZARD_CATEGORIES } from '../../data/demo/safetyDemo.js'
import { SITES } from '../../data/demo/inventoryDemo.js'
import { actorOf } from '../../services/procurement.js'
import * as SF from '../../services/safety.js'
import { engineerOf, pmOf, siteOf, supervisorOf } from '../../services/site.js'
import { addDays, todayISO } from '../../utils/date.js'
import { formatDate } from '../../utils/format.js'
import { Drawer, FormError, HistoryList, Locked, fmtStamp } from '../store-keeper/shared.jsx'
import { PhotoInput, PhotoStrip } from '../site-engineer/shared.jsx'
import { useSite } from '../site-engineer/SiteContext.jsx'

export const SEV_TONE = { Low: 'muted', Medium: 'warning', High: 'danger', Critical: 'danger' }
export const SevBadge = ({ s }) => (s ? <Badge tone={SEV_TONE[s]}>{s}</Badge> : <span className="cell-sub">—</span>)
export const siteName = (id) => (id ? siteOf(id)?.name || id : 'Project-wide')
export const PROJECT_NAMES = { 'P-101': 'Sunrise Heights Apartments', 'P-102': 'Palm Grove Villas' }

/**
 * Safety page context for any role: shared site records, permissions and an `act` helper that
 * runs a guarded safety transition and reports the result.
 */
export function useSafety(notify) {
  const { user, role } = useDemoSession()
  const site = useSite()
  const actor = actorOf(user, role)
  const [error, setError] = useState('')
  const has = (p) => can(role.id, p)
  return {
    user, role, actor, site, s: site.state, today: todayISO(), error, setError,
    perms: { manage: has(P.SAFETY_MANAGE), verify: has(P.SAFETY_VERIFY), report: has(P.SAFETY_REPORT), approvePermit: has(P.PERMIT_APPROVE), sensitive: has(P.SAFETY_MANAGE) || has(P.SAFETY_VERIFY) || has(P.PROJECT_REVIEW) },
    act: (name, args) => {
      const r = site.actions[name](args, actor)
      if (!r.ok) { setError(r.error); return false }
      setError('')
      notify?.(`Demo: ${r.message}. Shown on the connected dashboards in this session; nothing is saved`)
      return true
    },
  }
}

/** People a correction can be assigned to on a site (existing named roles only) */
export function responsibleOptions(siteId) {
  return [
    { role: 'Site Supervisor', name: supervisorOf(siteId) }, { role: 'Site Engineer', name: engineerOf(siteId) },
    { role: 'Project Manager', name: pmOf(SITES.find((x) => x.id === siteId)?.projectId) }, { role: 'Store Keeper', name: 'Vijay Pawar' },
  ].filter((p) => p.name)
}

/** Assign-a-correction form (Safety Officer). */
export function AssignAction({ ctx, sourceType, sourceId, siteId, defaultText = '', onDone }) {
  const people = responsibleOptions(siteId)
  const [f, setF] = useState({ text: defaultText, who: people[0]?.role || '', priority: 'Normal', due: addDays(todayISO(), 2) })
  const p = people.find((x) => x.role === f.who)
  const save = () => ctx.act('assignSafetyAction', { sourceType, sourceId, text: f.text, owner: p?.name, ownerRole: p?.role, priority: f.priority, due: f.due }) && (setF({ ...f, text: '' }), onDone?.())
  return (
    <div className="receipt-grid" style={{ padding: 0 }}>
      <label className="field span-2">Required correction<input value={f.text} onChange={(e) => setF({ ...f, text: e.target.value })} placeholder="e.g. Re-fix boards and guard rail; re-tag the scaffold" /></label>
      <label className="field">Responsible<select value={f.who} onChange={(e) => setF({ ...f, who: e.target.value })}>{people.map((x) => <option key={x.role} value={x.role}>{x.role}: {x.name}</option>)}</select></label>
      <label className="field">Priority<select value={f.priority} onChange={(e) => setF({ ...f, priority: e.target.value })}>{['Normal', 'High', 'Urgent'].map((x) => <option key={x}>{x}</option>)}</select></label>
      <label className="field">Target date<input type="date" min={todayISO()} value={f.due} onChange={(e) => setF({ ...f, due: e.target.value })} /></label>
      <div className="field" style={{ alignSelf: 'end' }}><button className="btn btn-primary btn-sm" onClick={save}>Assign correction</button></div>
    </div>
  )
}

/** One corrective action: progress, evidence (responsible person) and verification (verifier). */
export function ActionDrawer({ a, ctx, onClose }) {
  const [note, setNote] = useState('')
  const [photos, setPhotos] = useState([])
  const mine = a.owner === ctx.user.name
  const canWork = (mine || ctx.perms.manage) && ['Assigned', 'In Progress', 'Returned for Correction'].includes(a.status)
  const canVerify = ctx.perms.verify && a.status === 'Awaiting Verification' && a.submittedBy !== ctx.user.name && a.owner !== ctx.user.name
  return (
    <Drawer title={`${a.id} · corrective action`} sub={`${a.sourceType}${a.sourceId ? ` ${a.sourceId}` : ''} · ${siteName(a.siteId)}`} onClose={onClose} wide>
      <dl className="details">
        <dt>Required correction</dt><dd>{a.text}</dd>
        <dt>Responsible</dt><dd>{a.owner}{a.ownerRole ? ` (${a.ownerRole})` : ''} · assigned by {a.assignedBy}</dd>
        <dt>Priority / target</dt><dd><Badge>{a.priority}</Badge> <span className={SF.caOverdue(a, ctx.today) ? 'down' : ''}>{formatDate(a.due)}{SF.caOverdue(a, ctx.today) ? ' (overdue)' : ''}</span></dd>
        <dt>Status</dt><dd><Badge>{a.status}</Badge>{a.verifiedBy ? ` · verified by ${a.verifiedBy}` : ''}{a.closedAt ? ` · closed ${fmtStamp(a.closedAt)}` : ''}</dd>
        {a.returnNote && a.status === 'Returned for Correction' && <><dt>Returned because</dt><dd className="down">{a.returnNote}</dd></>}
      </dl>
      {a.notes.length > 0 && <section className="drawer-section"><h3>Progress notes</h3><ol className="audit-list">{a.notes.map((n, i) => <li key={i}><span className="cell-sub">{fmtStamp(n.at)}</span> <b>{n.by}</b><div>{n.text}</div></li>)}</ol></section>}
      {a.evidence.length > 0 && <section className="drawer-section"><h3>Completion evidence</h3><ol className="audit-list">{a.evidence.map((n, i) => <li key={i}><span className="cell-sub">{fmtStamp(n.at)}</span> <b>{n.by}</b><div>{n.text}</div><PhotoStrip photos={n.photos} /></li>)}</ol></section>}
      {canWork && (
        <section className="drawer-section">
          <h3>{mine ? 'Your update' : 'Update'}</h3>
          <label className="field">What was done<input value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Boards re-fixed, guard rail installed, scaffold re-tagged" /></label>
          {mine && <PhotoInput label="Evidence photos (optional)" value={photos} onChange={setPhotos} />}
          <div className="cell-actions" style={{ marginTop: 8 }}>
            <button className="btn btn-sm" onClick={() => ctx.act('updateSafetyAction', { id: a.id, note }) && setNote('')}>Save progress</button>
            {mine && <button className="btn btn-sm btn-primary" onClick={() => ctx.act('submitSafetyEvidence', { id: a.id, text: note, photos }) && onClose()}>Submit completion evidence</button>}
          </div>
          {!mine && <p className="cell-sub">Completion evidence is submitted by {a.owner}.</p>}
        </section>
      )}
      {a.status === 'Awaiting Verification' && (canVerify ? (
        <section className="drawer-section">
          <h3>Verification on site</h3>
          <label className="field">Verifier's note (required to return)<input value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Checked at 3 pm: boards fixed, rail at both levels" /></label>
          <div className="cell-actions" style={{ marginTop: 8 }}>
            <button className="btn btn-sm btn-primary" onClick={() => ctx.act('verifySafetyAction', { id: a.id, accept: true, note }) && onClose()}>Verified: close action</button>
            <button className="btn btn-sm" onClick={() => ctx.act('verifySafetyAction', { id: a.id, accept: false, note }) && onClose()}>Return for correction</button>
          </div>
        </section>
      ) : <div className="drawer-section"><Locked>{ctx.perms.verify ? 'You submitted or own this correction; another verifier must check it' : 'Waiting for the Safety Officer to verify on site'}</Locked></div>)}
      <FormError error={ctx.error} />
      <section className="drawer-section"><h3>History</h3><HistoryList items={a.history} /></section>
    </Drawer>
  )
}

/** A hazard or incident with its review, investigation, corrective actions and closure. */
export function RecordDrawer({ x, ctx, onClose, onOpenAction }) {
  const s = ctx.s
  const acts = SF.actionsFor(s, x.id)
  const incident = SF.isIncident(x)
  const [rv, setRv] = useState({ severity: x.severity, category: x.category || 'Other', immediateAction: x.immediateAction || '', controlled: !!x.workStopped, note: '', linkedNcr: x.linkedNcr || '' })
  const [inv, setInv] = useState({ findings: x.investigation?.findings || '', rootCause: x.investigation?.rootCause || '', witnesses: '', peopleInvolved: x.peopleInvolved || '', injuryDetails: x.injuryDetails || '' })
  const [closeNote, setCloseNote] = useState('')
  const open = x.status !== 'Verified closed'
  const high = SF.HIGH.includes(x.severity)
  const ncr = x.linkedNcr && s.ncrs.find((n) => n.id === x.linkedNcr)
  return (
    <Drawer title={`${x.id} · ${x.kind}`} sub={`${PROJECT_NAMES[x.projectId] || x.projectId} · ${siteName(x.siteId)}${x.location ? ` · ${x.location}` : ''}`} onClose={onClose} wide>
      {high && open && !x.workStopped && <div className="se-urgent" role="alert"><span>⚠</span><div><b>High risk, not yet confirmed controlled.</b> The work must not continue until the hazard is controlled.</div></div>}
      <dl className="details">
        <dt>Category / severity</dt><dd>{x.category || '—'} · <SevBadge s={x.severity} /></dd>
        <dt>Reported</dt><dd>{x.reportedBy}{x.reporterRole ? ` (${x.reporterRole})` : ''} · {formatDate(x.date)} {x.time || ''}</dd>
        <dt>Description</dt><dd>{x.description}</dd>
        <dt>Immediate action</dt><dd>{x.immediateAction || '—'}{x.workStopped ? ' · work stopped / area made safe' : ''}</dd>
        {x.proposedAction && <><dt>Reporter's suggestion</dt><dd>{x.proposedAction}</dd></>}
        <dt>Responsible team</dt><dd>{x.responsibleTeam || '—'}</dd>
        <dt>Status</dt><dd><Badge>{SF.recordStage(x)}</Badge>{x.reviewedBy ? ` · reviewed by ${x.reviewedBy}` : ''}{x.escalation ? ` · escalated to ${x.escalation}` : ''}</dd>
        {ncr && <><dt>Linked quality NCR</dt><dd>{ncr.id} ({ncr.status}): {ncr.description}</dd></>}
        {incident && <>
          <dt>People involved</dt><dd>{ctx.perms.sensitive ? x.peopleInvolved || '—' : <Locked>Restricted (privacy)</Locked>}</dd>
          <dt>Injury / damage</dt><dd>{ctx.perms.sensitive ? x.injuryDetails || '—' : <Locked>Restricted (privacy)</Locked>}</dd>
          <dt>Investigation</dt><dd><Badge>{x.incidentStage || 'Reported'}</Badge>{x.investigation ? ` · ${x.investigation.findings}${x.investigation.rootCause ? ` · root cause: ${x.investigation.rootCause}` : ''}` : ''}</dd>
          {ctx.perms.sensitive && (x.witnesses || []).length > 0 && <><dt>Witness statements</dt><dd>{x.witnesses.map((w, i) => <div key={i}>{w.text} <span className="cell-sub">{fmtStamp(w.at)}</span></div>)}</dd></>}
        </>}
      </dl>
      <PhotoStrip photos={x.photos} />

      {open && ctx.perms.manage && (
        <section className="drawer-section">
          <h3>Safety Officer review</h3>
          <div className="receipt-grid" style={{ padding: 0 }}>
            <label className="field">Risk severity<select value={rv.severity} onChange={(e) => setRv({ ...rv, severity: e.target.value })}>{['Low', 'Medium', 'High', 'Critical'].map((v) => <option key={v}>{v}</option>)}</select></label>
            <label className="field">Category<select value={rv.category} onChange={(e) => setRv({ ...rv, category: e.target.value })}>{HAZARD_CATEGORIES.map((v) => <option key={v}>{v}</option>)}</select></label>
            <label className="field span-2">Immediate precautions in place<input value={rv.immediateAction} onChange={(e) => setRv({ ...rv, immediateAction: e.target.value })} /></label>
            <label className="field">Linked quality NCR (optional)<select value={rv.linkedNcr} onChange={(e) => setRv({ ...rv, linkedNcr: e.target.value })}><option value="">None</option>{s.ncrs.filter((n) => n.projectId === x.projectId).map((n) => <option key={n.id} value={n.id}>{n.id}</option>)}</select></label>
            <label className="field">Note (required if severity changes)<input value={rv.note} onChange={(e) => setRv({ ...rv, note: e.target.value })} /></label>
            <label className="check-row span-2"><input type="checkbox" checked={rv.controlled} onChange={(e) => setRv({ ...rv, controlled: e.target.checked })} />Hazard is controlled: work stopped or area made safe</label>
          </div>
          <button className="btn btn-sm btn-primary" style={{ marginTop: 8 }} onClick={() => ctx.act('reviewSafetyRecord', { id: x.id, ...rv })}>{x.reviewedBy ? 'Update review' : 'Record review'}</button>
        </section>
      )}

      {incident && open && ctx.perms.manage && (
        <section className="drawer-section">
          <h3>Investigation</h3>
          <div className="receipt-grid" style={{ padding: 0 }}>
            <label className="field span-2">Findings<input value={inv.findings} onChange={(e) => setInv({ ...inv, findings: e.target.value })} /></label>
            <label className="field span-2">Root cause (once established)<input value={inv.rootCause} onChange={(e) => setInv({ ...inv, rootCause: e.target.value })} /></label>
            <label className="field">People involved (restricted)<input value={inv.peopleInvolved} onChange={(e) => setInv({ ...inv, peopleInvolved: e.target.value })} /></label>
            <label className="field">Injury / damage details (restricted)<input value={inv.injuryDetails} onChange={(e) => setInv({ ...inv, injuryDetails: e.target.value })} /></label>
            <label className="field span-2">Add witness statement<input value={inv.witnesses} onChange={(e) => setInv({ ...inv, witnesses: e.target.value })} /></label>
          </div>
          <div className="cell-actions" style={{ marginTop: 8 }}>
            <button className="btn btn-sm" onClick={() => ctx.act('recordInvestigation', { id: x.id, ...inv, complete: false }) && setInv({ ...inv, witnesses: '' })}>Save investigation</button>
            <button className="btn btn-sm btn-primary" onClick={() => ctx.act('recordInvestigation', { id: x.id, ...inv, complete: true }) && setInv({ ...inv, witnesses: '' })}>Complete investigation</button>
          </div>
        </section>
      )}

      <section className="drawer-section">
        <h3>Corrective actions ({acts.length})</h3>
        {acts.length === 0 && <p className="cell-sub">None yet.{x.reviewedBy ? '' : ' The Safety Officer assigns corrections after review.'}</p>}
        <ol className="audit-list">{acts.map((a) => <li key={a.id}><button className="link-btn" onClick={() => onOpenAction?.(a.id)}>{a.id}</button> <Badge>{a.status}</Badge> {a.text}<div className="cell-sub">{a.owner} · due {formatDate(a.due)}{SF.caOverdue(a, ctx.today) ? ' (overdue)' : ''}</div></li>)}</ol>
        {open && ctx.perms.manage && x.reviewedBy && <AssignAction ctx={ctx} sourceType={incident ? 'Incident' : 'Hazard'} sourceId={x.id} siteId={x.siteId} defaultText={acts.length ? '' : x.proposedAction} />}
      </section>

      {open && (ctx.perms.verify ? (
        <section className="drawer-section">
          <h3>Closure</h3>
          <p className="cell-sub">Closes only when every corrective action is verified{incident ? ' and the investigation with root cause is complete' : ''}.</p>
          <label className="field">Closure note{acts.length ? '' : ' (required when no action was needed)'}<input value={closeNote} onChange={(e) => setCloseNote(e.target.value)} /></label>
          <button className="btn btn-sm btn-primary" style={{ marginTop: 8 }} onClick={() => ctx.act('closeSafetyRecord', { id: x.id, note: closeNote }) && onClose()}>Close {incident ? 'incident' : 'hazard'}</button>
        </section>
      ) : <div className="drawer-section"><Locked>Closed by the Safety Officer after verification</Locked></div>)}
      <FormError error={ctx.error} />
      <section className="drawer-section"><h3>History</h3><HistoryList items={x.history} /></section>
    </Drawer>
  )
}

/** Opens the record or action drawer from anywhere (pages pass the ids they want shown). */
export function SafetyDrawers({ ctx, recordId, actionId, onRecord, onAction }) {
  const rec = recordId && ctx.s.safety.find((x) => x.id === recordId)
  const act = actionId && (ctx.s.safetyActions || []).find((x) => x.id === actionId)
  return (
    <>
      {rec && !act && <RecordDrawer key={rec.id + rec.status + (rec.history || []).length} x={rec} ctx={ctx} onClose={() => onRecord(null)} onOpenAction={onAction} />}
      {act && <ActionDrawer key={act.id + act.status + act.notes.length} a={act} ctx={ctx} onClose={() => onAction(null)} />}
    </>
  )
}
