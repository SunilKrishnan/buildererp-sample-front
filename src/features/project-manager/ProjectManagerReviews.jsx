import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import DataTable from '../../components/DataTable.jsx'
import SummaryCard from '../../components/SummaryCard.jsx'
import Tabs from '../../components/Tabs.jsx'
import { DemoTag } from '../../components/StateViews.jsx'
import { Badge, Card, PageHead, Progress } from '../../components/UI.jsx'
import { useDemoSession } from '../../auth/DemoSession.jsx'
import { can, PERMISSIONS as P } from '../../auth/demoRoles.js'
import { PROJECT_MANAGERS } from '../../data/demo/inventoryDemo.js'
import { MR, REQUEST_STATUSES } from '../../services/inventory.js'
import { actorOf, estimateOf } from '../../services/procurement.js'
import { boqView, dprLines, siteOf, taskView } from '../../services/site.js'
import { formatDate, formatINR } from '../../utils/format.js'
import { QaSummary } from '../qa/links.jsx'
import { SafetySummary } from '../safety/links.jsx'
import { ncrStatus } from '../../services/qa.js'
import { useInventory } from '../store-keeper/InventoryContext.jsx'
import { Drawer, fmtQty, fmtStamp, FormError, HistoryList, Locked } from '../store-keeper/shared.jsx'
import { useSite } from '../site-engineer/SiteContext.jsx'

const TABS = [
  { id: 'overview', label: 'Overview' }, { id: 'reports', label: 'Daily reports' }, { id: 'materials', label: 'Material requests' },
  { id: 'schedule', label: 'Schedule & delays' }, { id: 'boq', label: 'BOQ & measurements' }, { id: 'issues', label: 'Site issues' },
  { id: 'quality', label: 'Quality & safety' }, { id: 'messages', label: 'Instructions & clarifications' },
]

/** The signed-in user's view: a Project Manager sees the projects they manage; Admin sees all, read-only. */
function usePM(notify) {
  const { user, role } = useDemoSession()
  const site = useSite()
  const inv = useInventory()
  const actor = actorOf(user, role)
  const [error, setError] = useState('')
  const projectIds = role.id === 'admin' ? Object.keys(PROJECT_MANAGERS) : Object.keys(PROJECT_MANAGERS).filter((id) => PROJECT_MANAGERS[id] === user.name)
  const report = (r) => { if (!r.ok) { setError(r.error); return false } setError(''); notify(`Demo: ${r.message}. Temporary, resets on reload`); return true }
  return {
    user, role, actor, site, inv, projectIds, error, notify,
    canReview: can(role.id, P.PROJECT_REVIEW), canDecideRequests: can(role.id, P.MATERIAL_REQUEST_APPROVE),
    mine: (r) => projectIds.includes(r.projectId),
    act: (name, args) => report(site.actions[name](args, actor)),
    actInv: (name, args) => report(inv.actions[name](args, actor)),
  }
}
const ReadOnly = () => <Locked>Decided by the project's Project Manager (view only)</Locked>

function Reports({ pm }) {
  const s = pm.site.state
  const [open, setOpen] = useState(null)
  const [note, setNote] = useState('')
  const rows = s.reports.filter(pm.mine).filter((r) => r.status !== 'Draft').sort((a, b) => (a.status === 'Submitted' ? -1 : 1) - (b.status === 'Submitted' ? -1 : 1) || b.date.localeCompare(a.date))
  const r = open && rows.find((x) => x.id === open)
  return (
    <Card title="Daily progress reports" sub="Submitted by Site Engineers; review or return with comments. Drafts are not shown." bodyClass="">
      <DataTable dense rows={rows} emptyText="No reports." columns={[
        { key: 'id', header: 'Report', render: (x) => <><button className="link-btn" onClick={() => { setOpen(x.id); setNote('') }}>{x.id}</button><div className="cell-sub">{formatDate(x.date)}</div></> },
        { key: 's', header: 'Site', render: (x) => siteOf(x.siteId)?.name }, { key: 'by', header: 'Prepared by', render: (x) => x.preparedBy },
        { key: 'a', header: 'Activities', render: (x) => <span className="wrap-cell">{x.entries.map((e) => `${s.tasks.find((t) => t.id === e.taskId)?.title.split(',')[0]} ${e.qty}`).join(' · ')}</span> },
        { key: 'p', header: 'Problems', render: (x) => <span className="cell-sub wrap-cell">{x.problems || '—'}</span> },
        { key: 'st', header: 'Status', render: (x) => <Badge>{x.status}</Badge> },
        { key: 'x', header: '', render: (x) => <button className={`btn btn-sm ${x.status === 'Submitted' ? 'btn-primary' : ''}`} onClick={() => { setOpen(x.id); setNote('') }}>{x.status === 'Submitted' ? 'Review' : 'Open'}</button> },
      ]} />
      {r && (
        <Drawer title={`${r.id} · ${formatDate(r.date)}`} sub={`${siteOf(r.siteId)?.name} · ${r.preparedBy}`} onClose={() => setOpen(null)} wide>
          <DataTable rowKey="taskId" rows={dprLines(s, r)} columns={[
            { key: 'a', header: 'Activity', render: (l) => l.task?.title }, { key: 'p', header: 'Planned', align: 'num', render: (l) => `${l.planned} ${l.unit}` },
            { key: 't', header: 'Today', align: 'num', render: (l) => <b>{l.qty}</b> }, { key: 'c', header: 'Cumulative', align: 'num', render: (l) => `${l.cumulative} (${l.pct}%)` },
            { key: 'w', header: 'Workers', align: 'num', render: (l) => l.workers }, { key: 's', header: 'Status', render: (l) => <Badge>{l.status}</Badge> },
          ]} />
          <dl className="details" style={{ marginTop: 12 }}><dt>Problems</dt><dd>{r.problems || '—'}</dd><dt>Remarks</dt><dd>{r.remarks || '—'}</dd><dt>Next-day plan</dt><dd>{r.nextDayPlan || '—'}</dd>{r.reviewNote && <><dt>Review note</dt><dd>{r.reviewNote}</dd></>}</dl>
          {r.status === 'Submitted' && (pm.canReview ? (
            <section className="drawer-section">
              <label className="field">Comment (required to return)<input value={note} onChange={(e) => setNote(e.target.value)} /></label>
              <div className="cell-actions" style={{ marginTop: 8 }}>
                <button className="btn btn-primary" onClick={() => pm.act('reviewDpr', { id: r.id, approve: true, note }) && setOpen(null)}>Mark reviewed</button>
                <button className="btn" onClick={() => pm.act('reviewDpr', { id: r.id, approve: false, note }) && setOpen(null)}>Return for correction</button>
              </div>
              <FormError error={pm.error} />
            </section>
          ) : <ReadOnly />)}
          <section className="drawer-section"><h3>History</h3><HistoryList items={r.history} /></section>
        </Drawer>
      )}
    </Card>
  )
}

function Materials({ pm }) {
  const [status, setStatus] = useState(MR.PM_REVIEW)
  const [open, setOpen] = useState(null)
  const [f, setF] = useState({ qty: '', reason: '' })
  // Drafts belong to the Site Engineer and are not sent to anyone
  const rows = pm.inv.requests.filter((r) => pm.projectIds.includes(r.site?.projectId) && r.status !== MR.DRAFT).filter((r) => status === 'all' || r.status === status).sort((a, b) => b.at.localeCompare(a.at))
  const r = open && pm.inv.requests.find((x) => x.id === open)
  const decide = (decision) => pm.actInv('decideRequest', { id: r.id, decision, qty: f.qty, reason: f.reason }) && setOpen(null)
  const close = () => pm.actInv('closeRequest', { id: r.id, reason: f.reason }) && setOpen(null)
  return (
    <Card title="Material requirements" sub="Stock-checked by the Store Keeper, then reviewed by you for need, quantity, urgency and budget relevance, whatever the stock. You do not issue stock or buy." bodyClass="">
      <div className="toolbar"><label className="field">Status<select value={status} onChange={(e) => setStatus(e.target.value)}><option value="all">All</option>{REQUEST_STATUSES.filter((x) => x !== MR.DRAFT).map((x) => <option key={x}>{x}</option>)}</select></label></div>
      <DataTable dense rows={rows} emptyText="Nothing waiting for your review." columns={[
        { key: 'id', header: 'Request', render: (x) => <><button className="link-btn" onClick={() => { setOpen(x.id); setF({ qty: String(x.requested), reason: '' }) }}>{x.id}</button><div className="cell-sub">{x.requestedBy}</div></> },
        { key: 'm', header: 'Material', render: (x) => <>{x.material.name}{x.supplementTo && <div className="cell-sub">Additional to {x.supplementTo}</div>}<div className="cell-sub wrap-cell">{x.purpose}</div></> },
        { key: 's', header: 'Site', render: (x) => x.site?.name },
        { key: 'q', header: 'Requested', align: 'num', render: (x) => fmtQty(x.requested, x.material.unit) },
        { key: 'a', header: 'Free stock', align: 'num', render: (x) => <>{fmtQty(x.available)}{x.shortage > 0 && <div className="cell-sub down">short {fmtQty(x.shortage)}</div>}</> },
        { key: 'p', header: 'Priority / needed', render: (x) => <><Badge>{x.priority}</Badge><div className="cell-sub">{formatDate(x.requiredBy)}</div></> },
        { key: 'st', header: 'Status', render: (x) => <Badge>{x.status}</Badge> },
      ]} />
      {r && (
        <Drawer title={`${r.id} · ${r.material.name}`} sub={`${r.site?.name} · requested by ${r.requestedBy}`} onClose={() => setOpen(null)}>
          <dl className="details">
            <dt>Requested</dt><dd>{fmtQty(r.requested, r.material.unit)} by {formatDate(r.requiredBy)} · {r.priority}</dd>
            <dt>Reason / work</dt><dd>{r.purpose}{r.workArea ? ` · ${r.workArea}` : ''}{r.taskId ? ` · task ${r.taskId}` : ''}</dd>
            {r.remarks && <><dt>Notes</dt><dd>{r.remarks}</dd></>}
            {r.attachments?.length > 0 && <><dt>Attachments</dt><dd>{r.attachments.join(', ')}</dd></>}
            <dt>Estimated value</dt><dd>{formatINR(estimateOf(r.sku, r.requested))} at the master rate (for budget relevance; not a purchase)</dd>
            <dt>Store Keeper's stock check</dt><dd>{r.checkedBy ? `${r.checkedBy}: ${r.checkNote}` : 'Not checked yet'}</dd>
            <dt>Free stock now</dt><dd>{fmtQty(r.available, r.material.unit)} at {r.store.name}{r.shortage > 0 && !['Approved', 'Partially Issued'].includes(r.status) && <span className="down"> · approving the full quantity leaves {fmtQty(r.shortage)} to purchase</span>}</dd>
            {r.approved != null && <><dt>Approved / issued / remaining</dt><dd>{r.approved} / {r.issued} / {r.remaining}{r.forwarded ? ` · shortage with purchasing as ${r.forwarded.id}${r.forwarded.poId ? ` → ${r.forwarded.poId}` : ''}` : ''}</dd></>}
            {r.reason && <><dt>{r.status === MR.RETURNED ? 'Returned because' : r.status === MR.CANCELLED ? 'Cancelled' : r.status === MR.CLOSED ? 'Closed because' : 'Rejection reason'}</dt><dd>{r.reason}</dd></>}
          </dl>
          {r.status === MR.PM_REVIEW && (pm.canDecideRequests ? (
            <section className="drawer-section">
              <div className="receipt-grid" style={{ padding: 0 }}>
                <label className="field">Approve quantity (partial allowed)<input type="number" min="0" value={f.qty} onChange={(e) => setF({ ...f, qty: e.target.value })} /></label>
                <label className="field">Comment (required to return, reject or part-approve)<input value={f.reason} onChange={(e) => setF({ ...f, reason: e.target.value })} /></label>
              </div>
              <div className="cell-actions" style={{ marginTop: 8 }}>
                <button className="btn btn-primary" onClick={() => decide('approve')}>Approve</button>
                <button className="btn" onClick={() => decide('return')}>Return for clarification</button>
                <button className="btn" onClick={() => decide('reject')}>Reject</button>
              </div>
              <p className="cell-sub">Approval reserves the free stock for this request and lets the Store Keeper issue it. Any shortage is forwarded by the Store Keeper as a purchase requisition; approving this request does not approve a purchase order.</p>
              <FormError error={pm.error} />
            </section>
          ) : <ReadOnly />)}
          {r.status === MR.RETURNED && <p className="cell-sub">Returned to {r.requestedBy}; it comes back to you when corrected and resubmitted.</p>}
          {r.status === MR.SUBMITTED && <p className="cell-sub">Waiting for the Store Keeper's stock check before your review.</p>}
          {[MR.APPROVED, MR.PARTIAL].includes(r.status) && pm.canDecideRequests && (
            <section className="drawer-section">
              <h3>Close the unissued balance</h3>
              <label className="field">Reason (required)<input value={f.reason} onChange={(e) => setF({ ...f, reason: e.target.value })} placeholder="e.g. Design change; balance not needed" /></label>
              <button className="btn btn-sm" style={{ marginTop: 8 }} onClick={close}>Close request</button>
              <FormError error={pm.error} />
            </section>
          )}
          <section className="drawer-section"><h3>History</h3>{r.history?.length ? <HistoryList items={r.history} /> : <p className="cell-sub">Earlier demo record.</p>}</section>
        </Drawer>
      )}
    </Card>
  )
}

function Schedule({ pm }) {
  const s = pm.site.state
  const [note, setNote] = useState({})
  const tasks = s.tasks.filter(pm.mine).map((t) => taskView(s, t))
  return (
    <Card title="Planned vs actual" sub="From submitted daily reports. Review delays and the Site Engineer's corrective action." bodyClass="">
      <DataTable dense rows={tasks} columns={[
        { key: 't', header: 'Task', render: (t) => <><div className="cell-main">{t.title}</div><div className="cell-sub">{t.id} · {siteOf(t.siteId)?.name}</div></> },
        { key: 'd', header: 'Deadline', render: (t) => formatDate(t.deadline) },
        { key: 'p', header: 'Planned to date', align: 'num', render: (t) => `${t.plannedToDate} ${t.unit}` },
        { key: 'a', header: 'Actual', render: (t) => { const pend = (s.supervisorProgress || []).filter((p) => p.taskId === t.id && p.status === 'Submitted').reduce((x, p) => x + p.qty, 0); return <div style={{ minWidth: 110 }}><div className="prog-row"><span>{t.done}</span><b>{t.pct}%</b></div><Progress value={t.pct} tone={t.status === 'Delayed' ? 'bad' : ''} />{pend > 0 && <div className="cell-sub">+{pend} from Site Supervisor, awaiting engineer verification</div>}</div> } },
        { key: 'v', header: 'Variance', align: 'num', render: (t) => <span className={t.variance < 0 ? 'down' : 'up'}>{t.variance}</span> },
        { key: 's', header: 'Status', render: (t) => <Badge>{t.status}</Badge> },
        { key: 'r', header: 'Delay reason / corrective action', render: (t) => (t.status === 'Delayed' ? <span className="wrap-cell">{t.delayReason || <span className="down">No reason given</span>}<div className="cell-sub">{t.correctiveAction}</div>{t.pmReview && <div className="cell-sub">PM: {t.pmReview.accepted ? 'accepted' : 'not accepted'}, {t.pmReview.note}</div>}</span> : <span className="cell-sub">—</span>) },
        { key: 'x', header: '', render: (t) => (t.status === 'Delayed' && pm.canReview ? (
          <div className="cell-actions">
            <input className="inline-input" placeholder="Your comment" value={note[t.id] || ''} onChange={(e) => setNote({ ...note, [t.id]: e.target.value })} aria-label={`Comment on ${t.id}`} />
            <button className="btn btn-sm btn-primary" onClick={() => pm.act('reviewTaskDelay', { id: t.id, accept: true, note: note[t.id] })}>Accept plan</button>
            <button className="btn btn-sm" onClick={() => pm.act('reviewTaskDelay', { id: t.id, accept: false, note: note[t.id] })}>Revise</button>
          </div>
        ) : null) },
      ]} />
      <div style={{ padding: '0 18px 12px' }}><FormError error={pm.error} /></div>
    </Card>
  )
}

function Boq({ pm }) {
  const s = pm.site.state
  const [note, setNote] = useState('')
  const items = s.boq.filter(pm.mine).map((b) => boqView(s, b))
  const revisions = items.filter((b) => b.pendingRevision)
  const measures = s.measurements.filter((m) => m.status === 'Pending Verification' && items.some((b) => b.id === m.boqId))
  return (
    <>
      <Card title="BOQ revisions waiting for approval" sub="Approved quantities change only when you approve" bodyClass="">
        <DataTable rows={revisions} emptyText="No revisions pending." columns={[
          { key: 'id', header: 'BOQ', render: (b) => <><div className="cell-main">{b.id}</div><div className="cell-sub wrap-cell">{b.description}</div></> },
          { key: 'q', header: 'Change', render: (b) => `${b.pendingRevision.from} → ${b.pendingRevision.to} ${b.unit}` },
          { key: 'e', header: 'Executed', align: 'num', render: (b) => b.executed },
          { key: 'r', header: 'Reason', render: (b) => <span className="wrap-cell">{b.pendingRevision.reason}<div className="cell-sub">{b.pendingRevision.requestedBy}</div></span> },
          { key: 'x', header: '', render: (b) => (pm.canReview ? <div className="cell-actions"><button className="btn btn-sm btn-primary" onClick={() => pm.act('decideBoqRevision', { id: b.id, approve: true, note })}>Approve</button><button className="btn btn-sm" onClick={() => pm.act('decideBoqRevision', { id: b.id, approve: false, note })}>Reject</button></div> : <ReadOnly />) },
        ]} />
      </Card>
      <Card title="Measurements waiting for verification" bodyClass="" className="section-gap">
        <DataTable rows={measures} emptyText="No measurements pending." columns={[
          { key: 'id', header: 'Ref.', render: (m) => <><div className="cell-main">{m.id}</div><div className="cell-sub">{m.boqId} · {formatDate(m.date)}</div></> },
          { key: 'q', header: 'Quantity', align: 'num', render: (m) => `${m.qty} ${s.boq.find((b) => b.id === m.boqId)?.unit}` },
          { key: 'd', header: 'Details', render: (m) => <span className="wrap-cell">{m.details}</span> },
          { key: 'by', header: 'Recorded by', render: (m) => m.recordedBy },
          { key: 'x', header: '', render: (m) => (pm.canReview ? <div className="cell-actions"><button className="btn btn-sm btn-primary" onClick={() => pm.act('verifyMeasurement', { id: m.id, approve: true })}>Verify</button><button className="btn btn-sm" onClick={() => pm.act('verifyMeasurement', { id: m.id, approve: false, note: note || 'Recheck dimensions' })}>Reject</button></div> : <ReadOnly />) },
        ]} />
        <div style={{ padding: '10px 18px' }}><input className="inline-input se-grow" placeholder="Comment for rejections" value={note} onChange={(e) => setNote(e.target.value)} aria-label="Comment" /><FormError error={pm.error} /></div>
      </Card>
    </>
  )
}

function Issues({ pm }) {
  const s = pm.site.state
  const [text, setText] = useState({})
  const rows = s.issues.filter(pm.mine).filter((i) => i.status !== 'Closed').sort((a, b) => (b.escalated ? 1 : 0) - (a.escalated ? 1 : 0))
  return (
    <Card title="Site issues" sub="Escalated issues first. Comment, or close after checking the resolution." bodyClass="">
      <DataTable dense rows={rows} emptyText="No open issues." columns={[
        { key: 'id', header: 'Issue', render: (i) => <><div className="cell-main">{i.id} · {i.title}</div><div className="cell-sub">{siteOf(i.siteId)?.name} · {i.reportedBy} · {formatDate(i.reported)}</div></> },
        { key: 'p', header: 'Priority', render: (i) => <><Badge>{i.priority}</Badge>{i.escalated && <div className="cell-sub down">escalated</div>}</> },
        { key: 'a', header: 'Assigned to', render: (i) => `${i.assignee?.name} (${i.assignee?.role})` },
        { key: 'im', header: 'Impact / resolution', render: (i) => <span className="cell-sub wrap-cell">{i.resolution || i.impact || '—'}</span> },
        { key: 's', header: 'Status', render: (i) => <Badge>{i.status}</Badge> },
        { key: 'x', header: '', render: (i) => (pm.canReview ? (
          <div className="cell-actions">
            <input className="inline-input" placeholder="Comment" value={text[i.id] || ''} onChange={(e) => setText({ ...text, [i.id]: e.target.value })} aria-label={`Comment on ${i.id}`} />
            <button className="btn btn-sm" onClick={() => pm.act('commentIssue', { id: i.id, text: text[i.id] }) && setText({ ...text, [i.id]: '' })}>Comment</button>
            {i.status === 'Resolved' && <button className="btn btn-sm btn-primary" onClick={() => pm.act('commentIssue', { id: i.id, text: text[i.id] || 'Resolution checked', status: 'Closed' })}>Close</button>}
          </div>
        ) : <ReadOnly />) },
      ]} />
      <div style={{ padding: '0 18px 12px' }}><FormError error={pm.error} /></div>
    </Card>
  )
}

function Quality({ pm }) {
  const s = pm.site.state
  const insp = s.inspections.filter(pm.mine)
  const safety = s.safety.filter(pm.mine).filter((x) => x.status !== 'Verified closed')
  return (
    <>
      <div className="info-note"><span>ℹ</span><div>For your oversight and project-level coordination of corrective work. Inspections, verification and QA clearance are recorded by the QA Engineer; technical inspections by Site Engineers.</div></div>
      <QaSummary projectIds={pm.projectIds} title="Quality summary (QA)" />
      <SafetySummary notify={pm.notify} projectIds={pm.projectIds} title="Safety summary (Safety Officer)" />
      <Card title="Inspections" bodyClass="">
        <DataTable dense rows={insp} columns={[
          { key: 'id', header: 'Inspection', render: (q) => <><div className="cell-main">{q.title}</div><div className="cell-sub">{q.id} · {q.type}</div></> },
          { key: 'd', header: 'Date', render: (q) => formatDate(q.date) }, { key: 'i', header: 'Inspector', render: (q) => q.inspector },
          { key: 's', header: 'Result / QA', render: (q) => <><Badge>{q.status}</Badge>{q.reviewStatus && <div className="cell-sub">{q.reviewStatus}</div>}{q.clearance && <div className="cell-sub up">QA-cleared: {q.clearance.activity.toLowerCase()}</div>}{q.parentId && <div className="cell-sub">Reinspection of {q.parentId}</div>}{(q.ncrIds || []).length > 0 && <div className="cell-sub">{q.ncrIds.map((id) => `${id} (${ncrStatus(pm.site.state.ncrs.find((n) => n.id === id) || { status: '?' })})`).join(', ')}</div>}</> },
        ]} />
      </Card>
      <Card title="Open safety items" bodyClass="" className="section-gap">
        <DataTable dense rows={safety} emptyText="No open safety items." columns={[
          { key: 'id', header: 'Ref.', render: (x) => <><div className="cell-main">{x.id}</div><div className="cell-sub">{formatDate(x.date)}</div></> },
          { key: 'sev', header: 'Severity', render: (x) => <Badge tone={['High', 'Critical'].includes(x.severity) ? 'danger' : 'warning'}>{x.severity}</Badge> },
          { key: 'd', header: 'Description', render: (x) => <span className="wrap-cell">{x.description}</span> },
          { key: 'a', header: 'Action', render: (x) => <span className="cell-sub wrap-cell">{x.action} · {x.actionOwner} · {x.actionDue ? formatDate(x.actionDue) : '—'}</span> },
          { key: 's', header: 'Status', render: (x) => <><Badge>{x.status}</Badge>{x.escalation && <div className="cell-sub">↑ {x.escalation}</div>}</> },
        ]} />
      </Card>
    </>
  )
}

function Messages({ pm }) {
  const s = pm.site.state
  const [reply, setReply] = useState({})
  const engineers = s.assignments.filter((a) => pm.projectIds.includes(a.projectId))
  const [f, setF] = useState({ to: engineers[0]?.engineer || '', subject: '', text: '' })
  const msgs = s.messages.filter(pm.mine)
  return (
    <Card title="Instructions & clarifications" bodyClass="card-body">
      {msgs.map((m) => (
        <div key={m.id} className="se-thread">
          <div className="se-thread-head"><b>{m.subject}</b> <Badge>{m.kind}</Badge> <Badge>{m.status}</Badge><span className="cell-sub"> {m.id} · {m.from} → {m.to} · {fmtStamp(m.at)}</span></div>
          <p>{m.text}</p>
          {m.replies.map((r, i) => <div key={i} className="se-reply"><b>{r.by}</b> <span className="cell-sub">{fmtStamp(r.at)}</span><div>{r.text}</div></div>)}
          {pm.canReview && m.status === 'Open' && m.kind === 'Clarification' && (
            <div className="cell-actions" style={{ marginTop: 8 }}>
              <input className="inline-input se-grow" placeholder="Answer" value={reply[m.id] || ''} onChange={(e) => setReply({ ...reply, [m.id]: e.target.value })} aria-label="Answer" />
              <button className="btn btn-sm btn-primary" onClick={() => pm.act('replyMessage', { id: m.id, text: reply[m.id], close: true })}>Answer</button>
            </div>
          )}
        </div>
      ))}
      {pm.canReview && (
        <form className="receipt-form" style={{ marginTop: 14 }} onSubmit={(e) => { e.preventDefault(); const a = engineers.find((x) => x.engineer === f.to); if (pm.act('sendInstruction', { ...f, projectId: a?.projectId, siteId: a?.siteIds[0] })) setF({ ...f, subject: '', text: '' }) }} noValidate>
          <div className="sub-panel-head"><b>New instruction to a Site Engineer</b></div>
          <div className="receipt-grid">
            <label className="field">To<select value={f.to} onChange={(e) => setF({ ...f, to: e.target.value })}>{engineers.map((a) => <option key={a.engineer}>{a.engineer}</option>)}</select></label>
            <label className="field">Subject<input value={f.subject} onChange={(e) => setF({ ...f, subject: e.target.value })} /></label>
            <label className="field span-2">Instruction<input value={f.text} onChange={(e) => setF({ ...f, text: e.target.value })} /></label>
          </div>
          <div className="sk-form-foot"><div className="jv-submit"><button className="btn btn-primary" type="submit">Send instruction</button></div></div>
        </form>
      )}
      <FormError error={pm.error} />
    </Card>
  )
}

export default function ProjectManagerReviews({ notify }) {
  const pm = usePM(notify)
  const [params, setParams] = useSearchParams()
  const tab = TABS.some((t) => t.id === params.get('tab')) ? params.get('tab') : 'overview'
  const s = pm.site.state
  const reports = s.reports.filter(pm.mine).filter((r) => r.status === 'Submitted')
  const requests = pm.inv.requests.filter((r) => pm.projectIds.includes(r.site?.projectId) && r.status === MR.PM_REVIEW)
  const tasks = s.tasks.filter(pm.mine).map((t) => taskView(s, t))
  const delayed = tasks.filter((t) => t.status === 'Delayed')
  const revisions = s.boq.filter(pm.mine).filter((b) => (b.revisions || []).some((r) => r.status === 'Pending'))
  const measures = s.measurements.filter((m) => m.status === 'Pending Verification' && s.boq.some((b) => b.id === m.boqId && pm.mine(b)))
  const escalated = s.issues.filter(pm.mine).filter((i) => i.escalated && !['Resolved', 'Closed'].includes(i.status))
  const resolved = s.issues.filter(pm.mine).filter((i) => i.status === 'Resolved')
  const clar = s.messages.filter(pm.mine).filter((m) => m.kind === 'Clarification' && m.status === 'Open')
  const counts = { reports: reports.length, materials: requests.length, schedule: delayed.filter((t) => !t.pmReview).length, boq: revisions.length + measures.length, issues: escalated.length + resolved.length, messages: clar.length }
  const cards = [
    { label: 'Daily reports to review', value: reports.length, icon: 'trend', tab: 'reports' },
    { label: 'Material requests to decide', value: requests.length, icon: 'box', tab: 'materials', tone: requests.length ? 'warning' : undefined },
    { label: 'Delayed tasks', value: delayed.length, icon: 'alert', tab: 'schedule', tone: delayed.length ? 'danger' : undefined },
    { label: 'BOQ revisions / measurements', value: revisions.length + measures.length, icon: 'percent', tab: 'boq' },
    { label: 'Escalated / resolved issues', value: `${escalated.length} / ${resolved.length}`, icon: 'clipboard', tab: 'issues' },
    { label: 'Open clarifications', value: clar.length, icon: 'bell', tab: 'messages' },
  ]
  const go = (id) => setParams(id === 'overview' ? {} : { tab: id })
  const props = { pm }

  return (
    <>
      <PageHead title="Project Manager Reviews" sub={pm.role.id === 'admin' ? 'All projects (Admin: view only; decisions belong to each Project Manager)' : `Projects you manage: ${pm.projectIds.join(', ') || 'none'}`}>
        <DemoTag />
      </PageHead>
      <Tabs label="Review sections" value={tab} onChange={go} tabs={TABS.map((t) => ({ ...t, count: counts[t.id] || 0 }))} />
      {tab === 'overview' && (
        <>
          <div className="summary-grid">{cards.map((c) => <SummaryCard key={c.label} {...c} onClick={() => go(c.tab)} />)}</div>
          <Card title="Project progress" sub="Planned vs actual from submitted daily reports" bodyClass="">
            <DataTable dense rowKey="id" rows={pm.projectIds.map((id) => {
              const t = tasks.filter((x) => x.projectId === id)
              return { id, sites: [...new Set(t.map((x) => siteOf(x.siteId)?.name))].join(', ') || '—', pct: t.length ? Math.round(t.reduce((a, x) => a + x.pct, 0) / t.length) : 0, delayed: t.filter((x) => x.status === 'Delayed').length, issues: s.issues.filter((i) => i.projectId === id && !['Resolved', 'Closed'].includes(i.status)).length }
            })} columns={[
              { key: 'id', header: 'Project', render: (r) => <Link className="link-btn" to={`/projects/${r.id}`}>{r.id}</Link> },
              { key: 'sites', header: 'Sites with schedules' },
              { key: 'pct', header: 'Scheduled work done', render: (r) => <div style={{ minWidth: 120 }}><div className="prog-row"><span /><b>{r.pct}%</b></div><Progress value={r.pct} /></div> },
              { key: 'delayed', header: 'Delayed tasks', align: 'num' }, { key: 'issues', header: 'Open issues', align: 'num' },
            ]} />
          </Card>
        </>
      )}
      {tab === 'reports' && <Reports {...props} />}
      {tab === 'materials' && <Materials {...props} />}
      {tab === 'schedule' && <Schedule {...props} />}
      {tab === 'boq' && <Boq {...props} />}
      {tab === 'issues' && <Issues {...props} />}
      {tab === 'quality' && <Quality {...props} />}
      {tab === 'messages' && <Messages {...props} />}
    </>
  )
}
