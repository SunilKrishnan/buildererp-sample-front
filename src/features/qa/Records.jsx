import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import DataTable from '../../components/DataTable.jsx'
import { Card } from '../../components/UI.jsx'
import * as Q from '../../services/qa.js'
import { formatDate } from '../../utils/format.js'
import { fmtStamp } from '../store-keeper/shared.jsx'
import { INSPECTION_TYPES } from './Schedule.jsx'
import { InspStatus, InspectionDrawer, siteName, useQA } from './shared.jsx'

/** All inspection records (QA, third-party and the Site Engineer's technical inspections). */
export default function Records({ notify, search }) {
  const ctx = useQA(notify)
  const [params, setParams] = useSearchParams()
  const [status, setStatus] = useState(params.get('status') || 'all')
  const [type, setType] = useState('all')
  const [owner, setOwner] = useState('all')
  const openId = params.get('open')
  const q = (search || '').toLowerCase()
  const st = (x) => Q.inspectionStatus(x, ctx.today)
  const rows = ctx.s.inspections
    .filter((x) => owner === 'all' || x.owner === owner)
    .filter((x) => status === 'all' || (status === 'completed' ? ['Passed', 'Failed', 'Conditional'].includes(x.status) : status === 'review' ? x.reviewStatus === 'Awaiting QA review' : status === 'Failed' ? ['Failed', 'Conditional'].includes(x.status) : st(x) === status))
    .filter((x) => type === 'all' || x.type === type)
    .filter((x) => !q || `${x.id} ${x.title} ${x.location} ${x.inspector}`.toLowerCase().includes(q))
    .sort((a, b) => b.date.localeCompare(a.date))
  const open = (id) => setParams(id ? { open: id } : {})
  return (
    <>
      <Card title="Inspection records" sub="Results are never overwritten: a reinspection is a separate record linked to the original" bodyClass="">
        <div className="toolbar"><div className="filters">
          <label className="field">Status / result<select value={status} onChange={(e) => setStatus(e.target.value)}><option value="all">All</option><option value="completed">Completed</option><option value="review">Awaiting QA review (Site Engineer records)</option>{['Scheduled', 'Overdue', 'In Progress', 'Passed', 'Failed', 'Conditional'].map((s) => <option key={s}>{s}</option>)}</select></label>
          <label className="field">Type<select value={type} onChange={(e) => setType(e.target.value)}><option value="all">All</option>{INSPECTION_TYPES.map((t) => <option key={t}>{t}</option>)}</select></label>
          <label className="field">Recorded by<select value={owner} onChange={(e) => setOwner(e.target.value)}><option value="all">All</option><option value="QA">QA</option><option value="Third-party">Third-party</option><option value="Site Engineer">Site Engineer (technical)</option></select></label>
        </div></div>
        <DataTable dense rows={rows} emptyText="No inspection records match." columns={[
          { key: 'id', header: 'Reference', render: (x) => <><button className="link-btn" onClick={() => open(x.id)}>{x.id}</button>{x.parentId && <div className="cell-sub">of {x.parentId}</div>}</> },
          { key: 'l', header: 'Project / location', render: (x) => <>{siteName(x.siteId)}<div className="cell-sub">{x.location}</div></> },
          { key: 'a', header: 'Activity / type', render: (x) => <span className="wrap-cell">{x.title}<div className="cell-sub">{x.type}</div></span> },
          { key: 'i', header: 'Inspector', render: (x) => <>{x.inspector}<div className="cell-sub">{x.owner}</div></> },
          { key: 'd', header: 'Date', render: (x) => formatDate(x.date) },
          { key: 'c', header: 'Checklist', align: 'num', render: (x) => (x.checklist.length ? `${x.checklist.filter((c) => c.result === 'Pass').length}/${x.checklist.filter((c) => c.result && c.result !== 'N/A').length || x.checklist.length}` : '—') },
          { key: 's', header: 'Result', render: (x) => <InspStatus q={x} today={ctx.today} /> },
          { key: 'n', header: 'NCR / review', render: (x) => <span className="cell-sub">{(x.ncrIds || []).join(', ') || x.reviewStatus || '—'}</span> },
          { key: 'r', header: 'Recorded', render: (x) => <span className="cell-sub">{x.recordedAt ? fmtStamp(x.recordedAt) : '—'}</span> },
        ]} />
      </Card>
      {openId && <InspectionDrawer key={openId} ctx={ctx} id={openId} onClose={() => open(null)} />}
    </>
  )
}
