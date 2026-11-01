import { useState } from 'react'
import DataTable from '../../components/DataTable.jsx'
import { Badge, Card } from '../../components/UI.jsx'
import { projects } from '../../data/mockData.js'
import { issuableFor, issuedByRequest, ISSUABLE_REQUEST_STATUSES } from '../../services/inventory.js'
import { formatDate } from '../../utils/format.js'
import { IssueDrawer } from './Requests.jsx'
import { fmtQty, fmtStamp, Locked } from './shared.jsx'

export default function Issues({ inv, perms, notify, search }) {
  const [issuing, setIssuing] = useState(null)
  const [project, setProject] = useState('all')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const issued = issuedByRequest(inv.state.issues)
  const reqById = Object.fromEntries(inv.requests.map((r) => [r.id, r]))
  // Approved by the Project Manager and stock-checked by the store
  const ready = inv.requests.filter((r) => ISSUABLE_REQUEST_STATUSES.includes(r.status))
  const q = (search || '').toLowerCase()
  const rows = inv.state.issues
    .map((i) => ({ ...i, req: reqById[i.requestId] }))
    .filter((i) => i.req)
    .filter((i) => project === 'all' || i.req.site?.projectId === project)
    .filter((i) => (!from || i.at.slice(0, 10) >= from) && (!to || i.at.slice(0, 10) <= to))
    .filter((i) => !q || `${i.id} ${i.requestId} ${i.req.material.name} ${i.receivedBy} ${i.req.site?.name}`.toLowerCase().includes(q))
    .sort((a, b) => b.at.localeCompare(a.at))
  const current = issuing && inv.requests.find((r) => r.id === issuing)

  return (
    <>
      <Card title="Ready to issue" sub="Approved by the Project Manager and stock-checked. Their open quantity is reserved until issued." bodyClass="">
        <DataTable
          dense
          rows={ready}
          emptyText="No approved requests are waiting to be issued."
          columns={[
            { key: 'id', header: 'Request', render: (r) => <><div className="cell-main">{r.id} <Badge>{r.status}</Badge></div><div className="cell-sub">Approved by {r.approvedBy}</div></> },
            { key: 'site', header: 'Project / site', render: (r) => r.site?.name },
            { key: 'm', header: 'Material', render: (r) => <><div>{r.material.name}</div><div className="cell-sub">From {r.store.name}</div></> },
            { key: 'a', header: 'Approved', align: 'num', render: (r) => fmtQty(r.approved, r.material.unit) },
            { key: 'i', header: 'Issued', align: 'num', render: (r) => fmtQty(issued[r.id] || 0) },
            { key: 'c', header: 'Can issue now', align: 'num', render: (r) => { const x = issuableFor(r, inv.stock, issued); return <b className={x.max < x.remaining ? 'down' : ''}>{fmtQty(x.max)}</b> } },
            { key: 'd', header: 'Needed by', render: (r) => formatDate(r.requiredBy) },
            { key: 'x', header: '', render: (r) => (perms.issue ? <button className="btn btn-sm btn-primary" onClick={() => setIssuing(r.id)}>Issue</button> : <Locked>Store Keeper</Locked>) },
          ]}
        />
      </Card>

      <Card title="Material issue register" sub="Every confirmed issue to a project or site. Stock was reduced at the moment each issue was confirmed." bodyClass="" className="section-gap">
        <div className="toolbar">
          <div className="filters">
            <label className="field">Project
              <select value={project} onChange={(e) => setProject(e.target.value)}>
                <option value="all">All projects</option>
                {projects.map((p) => <option key={p.id} value={p.id}>{p.short}</option>)}
              </select>
            </label>
            <label className="field">From<input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></label>
            <label className="field">To<input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></label>
          </div>
        </div>
        <DataTable
          dense
          rows={rows}
          emptyText="No issues match these filters."
          columns={[
            { key: 'id', header: 'Issue ref.', render: (i) => <><div className="cell-main">{i.id}</div><div className="cell-sub">{fmtStamp(i.at)}</div></> },
            { key: 'r', header: 'Request ref.', render: (i) => i.requestId },
            { key: 'site', header: 'Project / site', render: (i) => i.req.site?.name },
            { key: 'm', header: 'Material', render: (i) => i.req.material.name },
            { key: 'rq', header: 'Requested', align: 'num', render: (i) => fmtQty(i.req.requested) },
            { key: 'ap', header: 'Approved', align: 'num', render: (i) => fmtQty(i.req.approved) },
            { key: 'q', header: 'Issued', align: 'num', render: (i) => <b>{fmtQty(i.qty)}</b> },
            { key: 'u', header: 'Unit', render: (i) => i.req.material.unit },
            { key: 'rb', header: 'Requested by', render: (i) => i.req.requestedBy },
            { key: 'ab', header: 'Approved by', render: (i) => i.req.approvedBy || '—' },
            { key: 'ib', header: 'Issued by', render: (i) => i.issuedBy },
            { key: 'rc', header: 'Received by', render: (i) => i.receivedBy },
            { key: 's', header: 'Issue status', render: (i) => <Badge>{i.req.status}</Badge> },
            { key: 'n', header: 'Notes', render: (i) => <span className="cell-sub">{i.notes || '—'}</span> },
          ]}
        />
      </Card>

      {current && <IssueDrawer req={current} inv={inv} perms={perms} notify={notify} onClose={() => setIssuing(null)} />}
    </>
  )
}
