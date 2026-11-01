import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import DataTable from '../../components/DataTable.jsx'
import Icon from '../../components/Icon.jsx'
import { Badge, Card } from '../../components/UI.jsx'
import { ASSIGNABLE, siteOf } from '../../services/site.js'
import { addDays, todayISO } from '../../utils/date.js'
import { formatDate } from '../../utils/format.js'
import { ConfirmDialog, Drawer, fmtStamp, FormError, Locked } from '../store-keeper/shared.jsx'
import { PhotoInput, PhotoStrip } from '../site-engineer/shared.jsx'
import { shortName, supData, useSupervisor } from './shared.jsx'

// Supervisor's categories → the shared register's category and the role that reviews it
export const SUP_CATEGORIES = [
  { label: 'Labour shortage', category: 'Labour shortage', reviewer: 'Site Engineer' },
  { label: 'Material shortage', category: 'Material shortage', reviewer: 'Site Engineer' },
  { label: 'Equipment breakdown', category: 'Equipment problem', reviewer: 'Site Engineer' },
  { label: 'Weather delay', category: 'Weather delay', reviewer: 'Site Engineer' },
  { label: 'Work-area obstruction', category: 'Work-area obstruction', reviewer: 'Site Engineer' },
  { label: 'Scheduling conflict', category: 'Scheduling conflict', reviewer: 'Project Manager' },
  { label: 'General site issue', category: 'Other', reviewer: 'Site Engineer' },
]
const labelOf = (category) => SUP_CATEGORIES.find((c) => c.category === category)?.label || category
const PRIORITIES = ['Low', 'Medium', 'High', 'Critical']

function IssueForm({ ctx, onClose }) {
  const siteId = ctx.mySites[0]?.id || ''
  const [f, setF] = useState({ siteId, cat: 'Labour shortage', reviewer: 'Site Engineer', workArea: '', title: '', description: '', priority: 'Medium', impact: '', dueBy: addDays(todayISO(), 1), photos: [] })
  const [confirming, setConfirming] = useState(false)
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value })
  const c = SUP_CATEGORIES.find((x) => x.label === f.cat)
  const projectId = siteOf(f.siteId)?.project === 'Palm Grove Villas' ? 'P-102' : 'P-101'
  const people = ASSIGNABLE(f.siteId, projectId).filter((p) => ['Site Engineer', 'Project Manager'].includes(p.role))
  const assignee = people.find((p) => p.role === f.reviewer)
  const save = () => { const ok = ctx.act('createIssue', { ...f, category: c.category, projectId, assignee }); setConfirming(false); if (ok) onClose() }
  return (
    <Drawer title="Report a site issue" sub="Issue ID, date and time are recorded on submission" onClose={onClose}>
      <div className="receipt-form">
        <div className="receipt-grid">
          <label className="field">Site<select value={f.siteId} onChange={set('siteId')}>{ctx.mySites.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select></label>
          <label className="field">Work area<input value={f.workArea} onChange={set('workArea')} placeholder="e.g. Tower A, F11–F12" /></label>
          <label className="field">Category<select value={f.cat} onChange={(e) => { const x = SUP_CATEGORIES.find((y) => y.label === e.target.value); setF({ ...f, cat: x.label, reviewer: x.reviewer }) }}>{SUP_CATEGORIES.map((x) => <option key={x.label}>{x.label}</option>)}</select></label>
          <label className="field">Severity / priority<select value={f.priority} onChange={set('priority')}>{PRIORITIES.map((p) => <option key={p}>{p}</option>)}</select></label>
          <label className="field span-2">Short title<input value={f.title} onChange={set('title')} placeholder="e.g. 4 masons short for site office brickwork" /></label>
          <label className="field span-2">Description<input value={f.description} onChange={set('description')} placeholder="What happened, where, since when" /></label>
          <label className="field span-2">Impact on work<input value={f.impact} onChange={set('impact')} placeholder="e.g. Brickwork will stop at 2 pm" /></label>
          <label className="field">Reviewed by<select value={f.reviewer} onChange={set('reviewer')}>{people.map((p) => <option key={p.role} value={p.role}>{p.role}: {p.name}</option>)}</select></label>
          <label className="field">Resolution needed by<input type="date" min={todayISO()} value={f.dueBy} onChange={set('dueBy')} /></label>
          <PhotoInput label="Photos (optional)" value={f.photos} onChange={(photos) => setF({ ...f, photos })} />
        </div>
        <div className="sk-form-foot">
          <FormError error={ctx.error} />
          <div className="jv-submit"><button className="btn btn-primary" onClick={() => setConfirming(true)}>Review & report</button><button className="btn" onClick={onClose}>Cancel</button></div>
          <p className="cell-sub">Technical issues go to the Site Engineer; schedule and budget conflicts to the Project Manager. Critical issues, and high ones that stop work, are escalated to the Project Manager automatically.</p>
        </div>
      </div>
      {confirming && (
        <ConfirmDialog title={`Report "${f.title || 'site issue'}"?`} confirmLabel="Report issue" onCancel={() => setConfirming(false)} onConfirm={save}>
          <p>{f.cat} · {f.priority} · to {assignee?.name} ({f.reviewer}).</p>
        </ConfirmDialog>
      )}
    </Drawer>
  )
}

function IssueView({ i, ctx, onClose }) {
  const [text, setText] = useState('')
  const [status, setStatus] = useState('')
  const mine = i.assignee?.name === ctx.user.name
  const send = () => ctx.act('commentIssue', { id: i.id, text, status: status || undefined, resolution: status === 'Resolved' ? text : undefined }) && (setText(''), setStatus(''))
  return (
    <Drawer title={`${i.id} · ${i.title}`} sub={`${labelOf(i.category)} · ${shortName(siteOf(i.siteId)?.name)}${i.workArea ? ` · ${i.workArea}` : ''}`} onClose={onClose} wide>
      <dl className="details">
        <dt>Reported</dt><dd>{i.reportedBy} · {formatDate(i.reported)}{i.comments[0] ? ` ${i.comments[0].at.slice(11, 16)}` : ''}</dd>
        <dt>Severity / status</dt><dd><Badge>{i.priority}</Badge> <Badge>{i.status}</Badge>{i.escalated && <> <Badge tone="danger">Escalated to PM</Badge></>}</dd>
        <dt>Reviewing</dt><dd>{i.assignee?.name} ({i.assignee?.role})</dd>
        <dt>Description</dt><dd>{i.description}</dd>
        <dt>Impact</dt><dd>{i.impact || '—'}</dd>
        {i.resolution && <><dt>Resolution</dt><dd>{i.resolution}</dd></>}
      </dl>
      <PhotoStrip photos={i.photos} />
      <section className="drawer-section"><h3>Updates</h3><ol className="audit-list">{i.comments.map((c, k) => <li key={k}><span className="cell-sub">{fmtStamp(c.at)}</span> <b>{c.by}</b>{c.role ? ` (${c.role})` : ''}<div>{c.text}</div></li>)}</ol></section>
      {!['Resolved', 'Closed'].includes(i.status) && ctx.perms.supervise ? (
        <section className="drawer-section">
          <h3>Add observation or resolution notes</h3>
          <label className="field">Note<input value={text} onChange={(e) => setText(e.target.value)} placeholder="e.g. JCB cleared the heap at 4:30 pm; access restored" /></label>
          <label className="field" style={{ marginTop: 8 }}>Status<select value={status} onChange={(e) => setStatus(e.target.value)}><option value="">No change</option><option>In Progress</option>{mine && <option>Resolved</option>}</select></label>
          <button className="btn btn-sm btn-primary" style={{ marginTop: 8 }} onClick={send}>Save update</button>
          {!mine && <p className="cell-sub">{i.assignee?.name} ({i.assignee?.role}) marks it resolved after checking; the Project Manager closes it.</p>}
          <FormError error={ctx.error} />
        </section>
      ) : <Locked>{i.status === 'Closed' ? 'Closed' : 'Resolved: waiting for the Project Manager to close'}</Locked>}
    </Drawer>
  )
}

export default function Issues({ notify, search }) {
  const ctx = useSupervisor(notify)
  const d = supData(ctx)
  const [params, setParams] = useSearchParams()
  const [status, setStatus] = useState(params.get('status') || 'all')
  const [cat, setCat] = useState('all')
  const [view, setView] = useState(null)
  const q = (search || '').toLowerCase()
  const rows = [...d.issues]
    .filter((i) => status === 'all' || (status === 'open' ? !['Resolved', 'Closed'].includes(i.status) : i.status === status))
    .filter((i) => cat === 'all' || i.category === cat)
    .filter((i) => !q || `${i.id} ${i.title} ${i.description}`.toLowerCase().includes(q))
    .sort((a, b) => b.reported.localeCompare(a.reported))
  const viewing = view && d.issues.find((i) => i.id === view)

  return (
    <>
      <Card title="Site issues & delays" sub="Shared with the Site Engineer and Project Manager" bodyClass=""
        action={ctx.perms.supervise ? <button className="btn btn-primary btn-sm" onClick={() => setParams({ new: '1' })}><Icon name="plus" size={14} />Report issue</button> : <Locked>View only</Locked>}>
        <div className="toolbar"><div className="filters">
          <label className="field">Status<select value={status} onChange={(e) => setStatus(e.target.value)}><option value="all">All</option><option value="open">Open</option>{['Open', 'In Progress', 'Resolved', 'Closed'].map((s) => <option key={s}>{s}</option>)}</select></label>
          <label className="field">Category<select value={cat} onChange={(e) => setCat(e.target.value)}><option value="all">All</option>{[...new Set(d.issues.map((i) => i.category))].map((c) => <option key={c} value={c}>{labelOf(c)}</option>)}</select></label>
        </div></div>
        <DataTable dense rows={rows} emptyText="No issues match." columns={[
          { key: 'id', header: 'Issue ID', render: (i) => <><button className="link-btn" onClick={() => setView(i.id)}>{i.id}</button><div className="cell-sub">{formatDate(i.reported)}</div></> },
          { key: 's', header: 'Site / area', render: (i) => <>{shortName(siteOf(i.siteId)?.name)}<div className="cell-sub">{i.workArea || '—'}</div></> },
          { key: 't', header: 'Issue', render: (i) => <span className="wrap-cell"><b>{i.title}</b><div className="cell-sub">{labelOf(i.category)}</div></span> },
          { key: 'p', header: 'Severity', render: (i) => <Badge>{i.priority}</Badge> },
          { key: 'b', header: 'Reported by', render: (i) => <>{i.reportedBy}<div className="cell-sub">{i.reporterRole || ''}</div></> },
          { key: 'a', header: 'Reviewing', render: (i) => <>{i.assignee?.name}<div className="cell-sub">{i.assignee?.role}</div></> },
          { key: 'st', header: 'Status', render: (i) => <><Badge>{i.status}</Badge>{i.resolution && <div className="cell-sub wrap-cell">{i.resolution}</div>}</> },
          { key: 'x', header: '', render: (i) => <button className="btn btn-sm" onClick={() => setView(i.id)}>Open</button> },
        ]} />
      </Card>
      {params.get('new') === '1' && <IssueForm ctx={ctx} onClose={() => setParams({})} />}
      {viewing && <IssueView key={viewing.id + viewing.comments.length} i={viewing} ctx={ctx} onClose={() => setView(null)} />}
    </>
  )
}
