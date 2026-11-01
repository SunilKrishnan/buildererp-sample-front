import { useState } from 'react'
import DataTable from '../../components/DataTable.jsx'
import { Badge, Card } from '../../components/UI.jsx'
import { fmtStamp } from '../store-keeper/shared.jsx'
import { qaNotifications, useQA } from './shared.jsx'

/** Notifications derived from the shared records (shown on screen only) and the activity history. */
export default function Activity({ notify, go, search }) {
  const ctx = useQA(notify)
  const [who, setWho] = useState('all')
  const q = (search || '').toLowerCase()
  const notes = qaNotifications(ctx)
  const { s } = ctx
  // Activity: every recorded event on QA-related records (who, when, what, comment)
  const events = [
    ...s.qaRequests.flatMap((r) => (r.history || []).map((h, i) => ({ ...h, ref: r.id, key: `${r.id}-${i}` }))),
    ...ctx.qaInspections.flatMap((x) => (x.history || []).map((h, i) => ({ ...h, ref: x.id, key: `${x.id}-${i}` }))),
    ...s.ncrs.flatMap((n) => (n.history || []).map((h, i) => ({ ...h, ref: n.id, key: `${n.id}-${i}` }))),
    ...s.materialTests.flatMap((t) => (t.history || []).map((h, i) => ({ ...h, ref: t.id, key: `${t.id}-${i}` }))),
    ...s.checklists.flatMap((c) => (c.history || []).map((h, i) => ({ ...h, ref: c.id, key: `${c.id}-${i}` }))),
  ].filter((e) => (who === 'all' || e.by === who) && (!q || `${e.ref} ${e.action} ${e.note} ${e.by}`.toLowerCase().includes(q)))
    .sort((a, b) => (b.at || '').localeCompare(a.at || ''))
    .map((e) => ({ ...e, id: e.key }))
  const people = [...new Set(events.map((e) => e.by))]
  return (
    <>
      <Card title="Notifications" sub="From the shared records; on screen only (nothing is emailed or sent by SMS). Choose which appear under Profile & Settings." bodyClass="">
        <DataTable dense rows={notes} emptyText="No notifications." columns={[
          { key: 'k', header: 'Type', render: (n) => <Badge tone={n.tone || 'info'}>{n.kind}</Badge> },
          { key: 'r', header: 'Ref.', render: (n) => <button className="link-btn" onClick={() => go(n.section)}>{n.ref}</button> },
          { key: 't', header: 'Details', render: (n) => <span className="wrap-cell">{n.text}</span> },
          { key: 'a', header: 'When', render: (n) => <span className="cell-sub">{fmtStamp(n.at)}</span> },
        ]} />
      </Card>
      <Card title="Activity history" sub="Who did what and when, with comments and status changes" bodyClass="" className="section-gap"
        action={<label className="field inline">Person<select value={who} onChange={(e) => setWho(e.target.value)}><option value="all">Everyone</option>{people.map((p) => <option key={p}>{p}</option>)}</select></label>}>
        <DataTable dense rows={events} limit={60} emptyText="No activity." columns={[
          { key: 'at', header: 'When', render: (e) => <span className="cell-sub">{fmtStamp(e.at)}</span> },
          { key: 'ref', header: 'Record', render: (e) => <span className="cell-main">{e.ref}</span> },
          { key: 'a', header: 'Action', render: (e) => <span className="wrap-cell">{e.action}{e.note ? <div className="cell-sub">{e.note}</div> : null}</span> },
          { key: 'b', header: 'By', render: (e) => <>{e.by}<div className="cell-sub">{e.role}</div></> },
        ]} />
      </Card>
    </>
  )
}
