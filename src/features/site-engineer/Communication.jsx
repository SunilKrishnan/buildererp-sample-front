import { useState } from 'react'
import DataTable from '../../components/DataTable.jsx'
import Tabs from '../../components/Tabs.jsx'
import { Badge, Card } from '../../components/UI.jsx'
import { pmOf } from '../../services/site.js'
import { formatDate } from '../../utils/format.js'
import { fmtStamp, FormError } from '../store-keeper/shared.jsx'
import { siteData } from './derive.js'
import { projectIdOfSite, useSiteEngineer } from './shared.jsx'

function Thread({ m, ctx }) {
  const [text, setText] = useState('')
  const toMe = m.to === ctx.user.name || ctx.scope.all
  return (
    <div className="se-thread">
      <div className="se-thread-head"><b>{m.subject}</b> <Badge>{m.kind}</Badge> <Badge>{m.status}</Badge><span className="cell-sub"> {m.id} · {m.from} → {m.to} · {fmtStamp(m.at)}{m.ref ? ` · re ${m.ref}` : ''}</span></div>
      <p>{m.text}</p>
      {m.replies.map((r, i) => <div key={i} className="se-reply"><b>{r.by}</b> <span className="cell-sub">{fmtStamp(r.at)}</span><div>{r.text}</div></div>)}
      {!['Acknowledged', 'Answered'].includes(m.status) && (
        <div className="cell-actions" style={{ marginTop: 8 }}>
          <input className="inline-input se-grow" placeholder={toMe ? 'Reply / acknowledge' : 'Add a follow-up'} value={text} onChange={(e) => setText(e.target.value)} aria-label="Reply" />
          <button className="btn btn-sm" onClick={() => ctx.act('replyMessage', { id: m.id, text }) && setText('')}>Reply</button>
          {m.kind === 'Instruction' && toMe && <button className="btn btn-sm btn-primary" onClick={() => ctx.act('replyMessage', { id: m.id, text: text || 'Acknowledged.', close: true }) && setText('')}>Acknowledge</button>}
        </div>
      )}
    </div>
  )
}

function Approvals({ ctx, d, go }) {
  const s = ctx.site.state
  const dprs = d.reports.filter((r) => r.status === 'Submitted')
  const items = [
    ...dprs.map((r) => ({ key: r.id, kind: 'Daily progress report', ref: r.id, text: `${formatDate(r.date)} · ${r.entries.length} activities`, section: 'progress', dpr: r })),
    ...d.requests.filter((r) => r.status === 'Pending Project Manager Review').map((r) => ({ key: r.id, kind: 'Material request', ref: r.id, text: `${r.requested} ${r.material.unit} ${r.material.name}`, section: 'materials' })),
    ...s.measurements.filter((m) => m.status === 'Pending Verification' && d.boq.some((b) => b.id === m.boqId)).map((m) => ({ key: m.id, kind: 'Measurement', ref: `${m.id} (${m.boqId})`, text: `${m.qty} · ${m.details}`, section: 'measurements' })),
    ...d.boq.filter((b) => b.pendingRevision).map((b) => ({ key: b.pendingRevision.id, kind: 'BOQ revision', ref: `${b.id} ${b.pendingRevision.id}`, text: `${b.pendingRevision.from} → ${b.pendingRevision.to} ${b.unit}: ${b.pendingRevision.reason}`, section: 'measurements' })),
    ...d.issues.filter((i) => i.escalated && !['Resolved', 'Closed'].includes(i.status)).map((i) => ({ key: i.id, kind: 'Escalated issue', ref: i.id, text: i.title, section: 'issues' })),
    ...s.labourRequests.filter((r) => ctx.inScope(r) && r.status === 'Pending').map((r) => ({ key: r.id, kind: `Labour ${r.kind.toLowerCase()}`, ref: r.id, text: `${r.qty} ${r.category}: ${r.note}`, section: 'labour' })),
  ]
  return (
    <>
      <div className="info-note"><span>ℹ</span><div>Waiting for {ctx.myProjects.map((p) => pmOf(p.id)).join(', ')} (Project Manager). Decisions are made in Project Manager Reviews and appear under Updates; you cannot approve your own items.</div></div>
      <DataTable dense rowKey="key" rows={items} emptyText="Nothing is waiting for the Project Manager." columns={[
        { key: 'kind', header: 'Waiting for PM' }, { key: 'ref', header: 'Ref.' }, { key: 'text', header: 'Item', render: (x) => <span className="wrap-cell">{x.text}</span> },
        { key: 'x', header: '', render: (x) => <button className="btn btn-sm" onClick={() => go(x.section)}>Open</button> },
      ]} />
      <FormError error={ctx.error} />
    </>
  )
}

export default function Communication({ notify, go }) {
  const ctx = useSiteEngineer(notify)
  const d = siteData(ctx)
  const [tab, setTab] = useState('updates')
  const [kind, setKind] = useState('all')
  const [f, setF] = useState({ subject: '', text: '', siteId: ctx.mySites[0]?.id || '' })
  const messages = ctx.site.state.messages.filter((m) => ctx.inScope(m) && (ctx.scope.all || m.to === ctx.user.name || m.from === ctx.user.name))
  const kinds = [...new Set(d.notes.map((n) => n.kind))]
  const notes = d.notes.filter((n) => kind === 'all' || n.kind === kind)
  const open = messages.filter((m) => !['Acknowledged', 'Answered'].includes(m.status))

  return (
    <>
      <Tabs value={tab} onChange={setTab} label="Communication" tabs={[
        { id: 'updates', label: 'Updates' }, { id: 'messages', label: 'Instructions & clarifications', count: open.length }, { id: 'approvals', label: 'Waiting for Project Manager' },
      ]} />
      {tab === 'updates' && (
        <Card title="Updates on your records" sub="Only your assigned projects and your requests, reports and issues. Nothing is sent by email or SMS." bodyClass="">
          <div className="toolbar"><label className="field">Type<select value={kind} onChange={(e) => setKind(e.target.value)}><option value="all">All</option>{kinds.map((k) => <option key={k}>{k}</option>)}</select></label></div>
          <DataTable dense rowKey="i" rows={notes.map((n, i) => ({ ...n, i }))} emptyText="No updates." columns={[
            { key: 'at', header: 'When', render: (n) => fmtStamp(n.at) }, { key: 'kind', header: 'Type' }, { key: 'ref', header: 'Ref.' },
            { key: 'text', header: 'Update', render: (n) => <span className="wrap-cell">{n.text}</span> },
            { key: 'x', header: '', render: (n) => <button className="btn btn-sm" onClick={() => go(n.section)}>Open</button> },
          ]} />
        </Card>
      )}
      {tab === 'messages' && (
        <Card title="Instructions & clarifications" sub="Uses the project's records; no separate chat system" bodyClass="card-body">
          {messages.length === 0 && <div className="empty sm">No messages.</div>}
          {messages.map((m) => <Thread key={m.id + m.replies.length} m={m} ctx={ctx} />)}
          {ctx.perms.work && (
            <form className="receipt-form" style={{ marginTop: 14 }} onSubmit={(e) => { e.preventDefault(); if (ctx.act('sendClarification', { ...f, projectId: projectIdOfSite(f.siteId) })) setF({ ...f, subject: '', text: '' }) }} noValidate>
              <div className="sub-panel-head"><b>New clarification request</b><span className="cell-sub">To the Project Manager</span></div>
              <div className="receipt-grid">
                <label className="field">Subject<input value={f.subject} onChange={(e) => setF({ ...f, subject: e.target.value })} /></label>
                <label className="field">Site<select value={f.siteId} onChange={(e) => setF({ ...f, siteId: e.target.value })}>{ctx.mySites.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select></label>
                <label className="field span-2">Question<input value={f.text} onChange={(e) => setF({ ...f, text: e.target.value })} /></label>
              </div>
              <div className="sk-form-foot"><FormError error={ctx.error} /><div className="jv-submit"><button className="btn btn-primary" type="submit">Send</button></div></div>
            </form>
          )}
        </Card>
      )}
      {tab === 'approvals' && <Card title="Waiting for Project Manager" sub="Approval and rejection comments appear under Updates" bodyClass="card-body"><Approvals ctx={ctx} d={d} go={go} /></Card>}
    </>
  )
}
