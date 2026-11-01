import { useState } from 'react'
import DataTable from '../../components/DataTable.jsx'
import { Badge, Card } from '../../components/UI.jsx'
import { siteOf } from '../../services/site.js'
import { formatDate } from '../../utils/format.js'
import { FormError } from '../store-keeper/shared.jsx'
import { useSite } from './SiteContext.jsx'

/**
 * Site issues assigned to a role (e.g. Store Keeper, Purchase Manager), from the same records the
 * Site Engineer raised. The assignee can comment and mark them resolved.
 */
export default function AssignedIssues({ roleLabel, actor, notify }) {
  const { state, actions } = useSite()
  const [note, setNote] = useState({})
  const [error, setError] = useState('')
  const rows = state.issues.filter((i) => i.assignee?.role === roleLabel && !['Closed'].includes(i.status))
  if (!rows.length) return null
  const update = (i, status) => {
    const r = actions.commentIssue({ id: i.id, text: note[i.id] || '', status, resolution: status === 'Resolved' ? note[i.id] : undefined }, { ...actor, role: roleLabel })
    if (!r.ok) { setError(r.error); return }
    setError('')
    setNote({ ...note, [i.id]: '' })
    notify?.(`Demo: ${r.message}. Temporary, resets on reload`)
  }
  return (
    <Card title={<span className="title-with-count">Site issues assigned to you <span className="count-pill">{rows.length}</span></span>} sub="Raised by Site Engineers" bodyClass="" className="section-gap">
      <DataTable dense rows={rows} columns={[
        { key: 'id', header: 'Issue', render: (i) => <><div className="cell-main">{i.id} · {i.title}</div><div className="cell-sub">{siteOf(i.siteId)?.name} · {i.reportedBy} · {formatDate(i.reported)}</div></> },
        { key: 'p', header: 'Priority', render: (i) => <Badge>{i.priority}</Badge> },
        { key: 'im', header: 'Impact', render: (i) => <span className="cell-sub wrap-cell">{i.impact || i.description}</span> },
        { key: 's', header: 'Status', render: (i) => <Badge>{i.status}</Badge> },
        { key: 'x', header: 'Respond', render: (i) => (i.status === 'Resolved' ? <span className="cell-sub">{i.resolution}</span> : (
          <div className="cell-actions">
            <input className="inline-input" placeholder="Comment / resolution" value={note[i.id] || ''} onChange={(e) => setNote({ ...note, [i.id]: e.target.value })} aria-label={`Comment on ${i.id}`} />
            <button className="btn btn-sm" onClick={() => update(i)}>Comment</button>
            <button className="btn btn-sm btn-primary" onClick={() => update(i, 'Resolved')}>Resolved</button>
          </div>
        )) },
      ]} />
      {error && <div style={{ padding: '0 18px 12px' }}><FormError error={error} /></div>}
    </Card>
  )
}
