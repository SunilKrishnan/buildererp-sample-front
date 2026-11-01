import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import DataTable from '../../components/DataTable.jsx'
import Icon from '../../components/Icon.jsx'
import { Badge, Card } from '../../components/UI.jsx'
import { ISSUE_CATEGORIES } from '../../data/demo/siteDemo.js'
import { ASSIGNABLE, pmOf, projectOf, siteOf } from '../../services/site.js'
import { addDays, todayISO } from '../../utils/date.js'
import { formatDate } from '../../utils/format.js'
import { Drawer, fmtStamp, FormError, Locked } from '../store-keeper/shared.jsx'
import { siteData } from './derive.js'
import { PhotoInput, PhotoStrip, projectIdOfSite, SiteSelect, useSiteEngineer } from './shared.jsx'

const PRIORITIES = ['Low', 'Medium', 'High', 'Critical']

// Who usually owns each kind of issue (the engineer can change it)
const OWNER_FOR = { 'Material shortage': 'Purchase Manager', 'Labour shortage': 'Site Supervisor', 'Equipment problem': 'Admin', 'Drawing clarification': 'Project Manager', 'Quality defect': 'Site Supervisor', 'Safety concern': 'Site Supervisor', 'Weather delay': 'Project Manager', Other: 'Project Manager' }

function IssueForm({ ctx, d, presetTask, onClose }) {
  const sites = ctx.mySites
  const t = presetTask && d.tasks.find((x) => x.id === presetTask)
  const first = t?.siteId || (sites.length === 1 ? sites[0].id : '')
  const [f, setF] = useState({
    siteId: first, category: 'Material shortage', title: t?.blocker ? t.blocker.split(';')[0] : t ? `${t.title}: ` : '', description: t ? `${t.id} ${t.title} (${t.location}). ${t.blocker || ''}` : '', priority: t?.status === 'Delayed' ? 'High' : 'Medium',
    assigneeKey: 'Purchase Manager', impact: t ? `${t.title} may stop` : '', proposed: '', photos: [], dueBy: addDays(todayISO(), 2), escalate: false, links: t ? [t.id] : [],
  })
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value })
  const people = ASSIGNABLE(f.siteId, projectIdOfSite(f.siteId))
  const submit = (e) => {
    e.preventDefault()
    if (ctx.act('createIssue', { ...f, projectId: projectIdOfSite(f.siteId), assignee: people.find((p) => p.role === f.assigneeKey) })) onClose()
  }
  return (
    <Drawer title="Report site issue" sub="Reference number is assigned on submission" onClose={onClose}>
      <form className="receipt-form" onSubmit={submit} noValidate>
        <div className="receipt-grid">
          <SiteSelect value={f.siteId} sites={sites} onChange={(v) => setF({ ...f, siteId: v })} />
          <label className="field">Category<select value={f.category} onChange={(e) => setF({ ...f, category: e.target.value, assigneeKey: OWNER_FOR[e.target.value] || f.assigneeKey })}>{ISSUE_CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select></label>
          <label className="field span-2">Title<input value={f.title} onChange={set('title')} /></label>
          <label className="field span-2">Detailed description<input value={f.description} onChange={set('description')} placeholder="What, where, since when" /></label>
          <label className="field">Priority<select value={f.priority} onChange={set('priority')}>{PRIORITIES.map((p) => <option key={p}>{p}</option>)}</select></label>
          <label className="field">Responsible role / person<select value={f.assigneeKey} onChange={set('assigneeKey')}>{people.map((p) => <option key={p.role} value={p.role}>{p.role}: {p.name}</option>)}</select></label>
          <label className="field">Required resolution date<input type="date" min={todayISO()} value={f.dueBy} onChange={set('dueBy')} /></label>
          <label className="check-row" style={{ alignSelf: 'end' }}><input type="checkbox" checked={f.escalate} onChange={(e) => setF({ ...f, escalate: e.target.checked })} />Escalate schedule impact to the Project Manager</label>
          <label className="field span-2">Impact on work<input value={f.impact} onChange={set('impact')} placeholder="e.g. Raft reinforcement work may stop" /></label>
          <label className="field span-2">Proposed resolution<input value={f.proposed} onChange={set('proposed')} /></label>
          <PhotoInput value={f.photos} onChange={(photos) => setF({ ...f, photos })} label="Supporting photos" />
        </div>
        <div className="sk-form-foot"><FormError error={ctx.error} />
          <div className="jv-submit"><button className="btn btn-primary" type="submit">Report issue</button><button className="btn" type="button" onClick={onClose}>Cancel</button></div>
          <p className="cell-sub">Critical issues, and high-priority issues that delay or stop work, are escalated to the Project Manager automatically. You report and update observations; supplier delivery status and purchase orders are updated only by the Purchase Manager and Store Keeper.</p>
        </div>
      </form>
    </Drawer>
  )
}

function IssueView({ i, ctx, onClose }) {
  const [text, setText] = useState('')
  const [status, setStatus] = useState('')
  const [assignTo, setAssignTo] = useState('')
  const [resolution, setResolution] = useState('')
  const people = ASSIGNABLE(i.siteId, i.projectId)
  const closed = i.status === 'Closed'
  const send = (extra = {}) => ctx.act('commentIssue', { id: i.id, text, status: status || undefined, resolution, assignee: assignTo ? people.find((p) => p.role === assignTo) : undefined, ...extra }) && (setText(''), setStatus(''), setAssignTo(''), setResolution(''))
  return (
    <Drawer title={`${i.id} · ${i.title}`} sub={`${i.category} · ${siteOf(i.siteId)?.name} · reported ${formatDate(i.reported)} by ${i.reportedBy}`} onClose={onClose} wide>
      <dl className="details">
        <dt>Priority / status</dt><dd><Badge>{i.priority}</Badge> <Badge>{i.status}</Badge>{i.escalated && <> <Badge tone="danger">Escalated to PM</Badge></>}</dd>
        <dt>Project / site</dt><dd>{projectOf(i.projectId)?.short} · {siteOf(i.siteId)?.name}</dd>
        <dt>Responsible</dt><dd>{i.assignee?.name} ({i.assignee?.role})</dd>
        <dt>Resolve by</dt><dd className={i.dueBy && i.dueBy < todayISO() && !['Resolved', 'Closed'].includes(i.status) ? 'down' : ''}>{i.dueBy ? formatDate(i.dueBy) : 'Not set'}</dd>
        <dt>Description</dt><dd>{i.description}</dd>
        <dt>Impact</dt><dd>{i.impact || '—'}</dd>
        <dt>Proposed resolution</dt><dd>{i.proposed || '—'}</dd>
        {i.links?.length > 0 && <><dt>Related</dt><dd>{i.links.join(', ')}{i.links.some((l) => /^PO-/.test(l)) && <div className="cell-sub"><Locked>PO delivery status is updated by the Purchase Manager / Store Keeper, not here</Locked></div>}</dd></>}
        {i.resolution && <><dt>Resolution</dt><dd>{i.resolution} ({formatDate(i.resolvedAt)})</dd></>}
      </dl>
      <PhotoStrip photos={i.photos} />
      <section className="drawer-section">
        <h3>Comments</h3>
        <ol className="audit-list">{i.comments.map((c, k) => <li key={k}><span className="cell-sub">{fmtStamp(c.at)}</span> <b>{c.by}</b>{c.role ? ` (${c.role})` : ''}<div>{c.text}</div></li>)}</ol>
      </section>
      {!closed && ctx.perms.work && (
        <section className="drawer-section">
          <h3>Update</h3>
          <div className="receipt-grid" style={{ padding: 0 }}>
            <label className="field span-2">Comment<input value={text} onChange={(e) => setText(e.target.value)} /></label>
            <label className="field">Status<select value={status} onChange={(e) => setStatus(e.target.value)}><option value="">No change</option><option>In Progress</option><option>Resolved</option></select></label>
            <label className="field">Reassign to<select value={assignTo} onChange={(e) => setAssignTo(e.target.value)}><option value="">No change</option>{people.map((p) => <option key={p.role} value={p.role}>{p.role}: {p.name}</option>)}</select></label>
            {status === 'Resolved' && <label className="field span-2">Resolution notes<input value={resolution} onChange={(e) => setResolution(e.target.value)} /></label>}
          </div>
          <div className="cell-actions" style={{ marginTop: 8 }}>
            <button className="btn btn-sm btn-primary" onClick={() => send()}>Save update</button>
            {!i.escalated && <button className="btn btn-sm" onClick={() => send({ escalate: true, text: text || 'Significant delay risk' })}>Escalate to Project Manager</button>}
          </div>
        </section>
      )}
      {i.status === 'Resolved' && (
        <section className="drawer-section">
          <p className="cell-sub">Resolved: {pmOf(i.projectId)} (Project Manager) checks the resolution and closes it in Project Manager Reviews.</p>
        </section>
      )}
      {closed && <Locked>Closed</Locked>}
      <FormError error={ctx.error} />
    </Drawer>
  )
}

export default function Issues({ notify, search, go }) {
  const ctx = useSiteEngineer(notify)
  const d = siteData(ctx)
  const [params, setParams] = useSearchParams()
  const [status, setStatus] = useState(params.get('status') || 'open')
  const [cat, setCat] = useState('all')
  const [prio, setPrio] = useState('all')
  const [view, setView] = useState(null)
  const q = (search || '').toLowerCase()
  const rows = [...d.issues]
    .filter((i) => status === 'all' || (status === 'open' ? !['Resolved', 'Closed'].includes(i.status) : i.status === status))
    .filter((i) => (cat === 'all' || i.category === cat) && (prio === 'all' || i.priority === prio))
    .filter((i) => !q || `${i.id} ${i.title} ${i.description}`.toLowerCase().includes(q))
    .sort((a, b) => PRIORITIES.indexOf(b.priority) - PRIORITIES.indexOf(a.priority) || b.reported.localeCompare(a.reported))
  const viewing = view && d.issues.find((i) => i.id === view)

  return (
    <>
      <Card title="Issue register" sub="Visible to you, the responsible person and the Project Manager" bodyClass=""
        action={ctx.perms.work ? <button className="btn btn-primary btn-sm" onClick={() => setParams({ new: '1' })}><Icon name="plus" size={14} />Report issue</button> : <Locked>View only</Locked>}>
        <div className="toolbar">
          <div className="filters">
            <label className="field">Status<select value={status} onChange={(e) => setStatus(e.target.value)}><option value="open">Open</option><option value="all">All</option>{['Open', 'In Progress', 'Resolved', 'Closed'].map((s) => <option key={s}>{s}</option>)}</select></label>
            <label className="field">Category<select value={cat} onChange={(e) => setCat(e.target.value)}><option value="all">All</option>{ISSUE_CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select></label>
            <label className="field">Priority<select value={prio} onChange={(e) => setPrio(e.target.value)}><option value="all">All</option>{PRIORITIES.map((c) => <option key={c}>{c}</option>)}</select></label>
          </div>
        </div>
        <DataTable dense rows={rows} emptyText="No issues match." columns={[
          { key: 'id', header: 'Issue ID', render: (i) => <><button className="link-btn" onClick={() => setView(i.id)}>{i.id}</button><div className="cell-sub">Reported {formatDate(i.reported)}</div></> },
          { key: 'ps', header: 'Project / site', render: (i) => <>{projectOf(i.projectId)?.short}<div className="cell-sub">{siteOf(i.siteId)?.name.split(': ')[1]}</div></> },
          { key: 't', header: 'Issue', render: (i) => <span className="wrap-cell"><b>{i.title}</b><div className="cell-sub">{i.category}</div></span> },
          { key: 'p', header: 'Priority', render: (i) => <Badge>{i.priority}</Badge> },
          { key: 'a', header: 'Responsible', render: (i) => <>{i.assignee?.name}<div className="cell-sub">{i.assignee?.role}</div></> },
          { key: 'im', header: 'Impact on work', render: (i) => <span className="cell-sub wrap-cell">{i.impact || '—'}</span> },
          { key: 'due', header: 'Resolve by', render: (i) => (i.dueBy ? <span className={i.dueBy < todayISO() && !['Resolved', 'Closed'].includes(i.status) ? 'down' : ''}>{formatDate(i.dueBy)}</span> : '—') },
          { key: 's', header: 'Status', render: (i) => <><Badge>{i.status}</Badge>{i.escalated && <div className="cell-sub down">↑ escalated</div>}</> },
          { key: 'c', header: 'Comments', align: 'num', render: (i) => i.comments.length },
          { key: 'x', header: '', render: (i) => <button className="btn btn-sm" onClick={() => setView(i.id)}>Open</button> },
        ]} />
      </Card>
      <Card title={<span className="title-with-count">Delayed work <span className="count-pill">{d.delayed.length}</span></span>} sub="Tasks past their due date, with your reason and corrective action. Dates are changed only by the Project Manager." bodyClass="" className="section-gap">
        <DataTable dense rows={d.delayed} emptyText="No delayed tasks." columns={[
          { key: 'id', header: 'Task', render: (t) => <><div className="cell-main">{t.id} · {t.title}</div><div className="cell-sub">{siteOf(t.siteId)?.name} · {t.location}</div></> },
          { key: 'dl', header: 'Due', render: (t) => <span className="down">{formatDate(t.deadline)} ({t.daysLate}d late)</span> },
          { key: 'q', header: 'Done', align: 'num', render: (t) => `${t.done} / ${t.plannedQty} ${t.unit}` },
          { key: 'r', header: 'Reason / corrective action', render: (t) => <span className="wrap-cell">{t.delayReason || <span className="down">Reason needed</span>}<div className="cell-sub">{t.correctiveAction}</div></span> },
          { key: 'pm', header: 'PM review', render: (t) => (t.pmReview ? <span className="cell-sub">{t.pmReview.accepted ? 'Accepted' : 'Revise'}: {t.pmReview.note}</span> : <span className="cell-sub">Not reviewed yet</span>) },
          { key: 'x', header: '', render: (t) => <div className="cell-actions"><button className="btn btn-sm" onClick={() => go('schedule', `task=${t.id}`)}>Update notes</button>{ctx.perms.work && !d.issues.some((i) => i.links?.includes(t.id) && !['Resolved', 'Closed'].includes(i.status)) && <button className="btn btn-sm" onClick={() => setParams({ new: '1', task: t.id })}>Raise issue</button>}</div> },
        ]} />
      </Card>
      {params.get('new') === '1' && <IssueForm ctx={ctx} d={d} presetTask={params.get('task')} onClose={() => setParams({})} />}
      {viewing && <IssueView key={viewing.id + viewing.comments.length} i={viewing} ctx={ctx} onClose={() => setView(null)} />}
    </>
  )
}
