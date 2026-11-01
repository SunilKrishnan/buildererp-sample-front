import { useState } from 'react'
import DataTable from '../../components/DataTable.jsx'
import { Card } from '../../components/UI.jsx'
import { fmtStamp } from '../store-keeper/shared.jsx'
import { useSafety } from './shared.jsx'

/** Every recorded step on safety records (the records' own histories), newest first. Nothing here can be edited or deleted. */
export default function Activity({ notify, search }) {
  const ctx = useSafety(notify)
  const s = ctx.s
  const [type, setType] = useState('all')
  const [who, setWho] = useState('')
  const q = `${search || ''} ${who}`.trim().toLowerCase()
  const rows = [
    ...s.safety.flatMap((x) => (x.history || []).map((h) => ({ ...h, ref: x.id, type: 'Hazard / incident' }))),
    ...(s.safetyActions || []).flatMap((x) => x.history.map((h) => ({ ...h, ref: x.id, type: 'Corrective action' }))),
    ...(s.safetyInspections || []).flatMap((x) => x.history.map((h) => ({ ...h, ref: x.id, type: 'Inspection' }))),
    ...(s.permits || []).flatMap((x) => x.history.map((h) => ({ ...h, ref: x.id, type: 'Permit' }))),
    ...(s.audit || []).filter((a) => /^(PPE|PPC|TRN|EP|FEQ|DRL|RN)-/.test(a.ref)).map((a) => ({ ...a, type: 'PPE / training / emergency' })),
  ].filter((h) => h.at && (type === 'all' || h.type === type) && (!q || `${h.ref} ${h.action} ${h.by} ${h.note}`.toLowerCase().includes(q)))
    .sort((a, b) => b.at.localeCompare(a.at)).map((h, i) => ({ ...h, key: `${h.ref}-${h.at}-${i}` }))
  return (
    <Card title="Safety activity history" sub="Traceable history of status changes, assignments, verification and closure. Records are never deleted or silently overwritten." bodyClass="">
      <div className="toolbar"><div className="filters">
        <label className="field">Record type<select value={type} onChange={(e) => setType(e.target.value)}><option value="all">All</option>{['Hazard / incident', 'Corrective action', 'Inspection', 'Permit', 'PPE / training / emergency'].map((x) => <option key={x}>{x}</option>)}</select></label>
        <label className="field">Person<input value={who} onChange={(e) => setWho(e.target.value)} placeholder="Name" /></label>
      </div></div>
      <DataTable dense rowKey="key" rows={rows.slice(0, 200)} emptyText="No activity." columns={[
        { key: 'at', header: 'When', render: (h) => fmtStamp(h.at) }, { key: 'ref', header: 'Record', render: (h) => <><div className="cell-main">{h.ref}</div><div className="cell-sub">{h.type}</div></> },
        { key: 'a', header: 'Action', render: (h) => <span className="wrap-cell">{h.action}{h.from && h.to && h.from !== h.to && <div className="cell-sub">{h.from} → <b>{h.to}</b></div>}</span> },
        { key: 'n', header: 'Comment / reason', render: (h) => <span className="cell-sub wrap-cell">{h.note || '—'}</span> }, { key: 'b', header: 'By', render: (h) => <>{h.by}<div className="cell-sub">{h.role}</div></> },
      ]} />
    </Card>
  )
}
