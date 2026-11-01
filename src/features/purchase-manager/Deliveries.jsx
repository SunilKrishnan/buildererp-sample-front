import { useState } from 'react'
import { Link } from 'react-router-dom'
import DataTable from '../../components/DataTable.jsx'
import StatGrid from '../../components/StatGrid.jsx'
import { Badge, Card } from '../../components/UI.jsx'
import { todayISO } from '../../utils/date.js'
import { formatDate } from '../../utils/format.js'
import { Drawer, fmtQty, fmtStamp, FormError, Locked } from '../store-keeper/shared.jsx'
import { useAct } from './shared.jsx'
import { SupplierQualityCard } from '../qa/links.jsx'

const deliveryState = (p) => (p.delayed ? `Delayed ${p.delayDays}d` : p.status === 'Completed' ? (p.pendingInspection ? 'Delivered, inspection pending' : 'Delivered') : p.delivered > 0 ? 'Partially delivered' : 'Awaiting delivery')
const TONE = (s) => (s.startsWith('Delayed') ? 'danger' : s.startsWith('Delivered,') || s === 'Partially delivered' ? 'warning' : s === 'Delivered' ? 'success' : 'info')

function FollowUp({ po, inv, perms, notify, onClose }) {
  const [note, setNote] = useState('')
  const [date, setDate] = useState('')
  const { act, error } = useAct(inv, perms, notify)
  return (
    <Drawer title={`Follow up ${po.id}`} sub={`${po.vendor} · ${fmtQty(po.pending, po.unit)} ${po.material?.name} pending`} onClose={onClose}>
      <dl className="details">
        <dt>Expected</dt><dd>{formatDate(po.expected)}{po.originalExpected !== po.expected ? ` (originally ${formatDate(po.originalExpected)})` : ''}</dd>
        <dt>Delivered so far</dt><dd>{fmtQty(po.delivered, po.unit)} of {fmtQty(po.qty, po.unit)}</dd>
        <dt>Status</dt><dd><Badge tone={TONE(deliveryState(po))}>{deliveryState(po)}</Badge></dd>
      </dl>
      <section className="drawer-section">
        <h3>Follow-up notes</h3>
        {(po.followUps || []).length === 0 ? <p className="cell-sub">No follow-up recorded yet.</p> : (
          <ol className="audit-list">{[...po.followUps].reverse().map((f, i) => <li key={i}><span className="cell-sub">{fmtStamp(f.at)}</span> <b>{f.by}</b>{f.revisedExpected ? ` · revised to ${formatDate(f.revisedExpected)}` : ''}<div>{f.note}</div></li>)}</ol>
        )}
      </section>
      {perms.manage ? (
        <form className="receipt-form" style={{ marginTop: 16 }} onSubmit={(e) => { e.preventDefault(); if (act('addFollowUp', { id: po.id, note, revisedExpected: date || null })) { setNote(''); setDate('') } }}>
          <div className="sub-panel-head"><b>Add follow-up</b><span className="cell-sub">Demo: no call or message is made</span></div>
          <div className="receipt-grid">
            <label className="field span-2">What the supplier said<input value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Lorry dispatched today, ETA tomorrow 10 am" /></label>
            <label className="field">Revised delivery date (optional)<input type="date" min={todayISO()} value={date} onChange={(e) => setDate(e.target.value)} /></label>
          </div>
          <div className="sk-form-foot"><FormError error={error} /><div className="jv-submit"><button className="btn btn-primary" type="submit">Save follow-up</button></div></div>
        </form>
      ) : <Locked>Follow-up is done by the Purchase Manager</Locked>}
    </Drawer>
  )
}

export default function Deliveries({ inv, perms, notify, search }) {
  const [show, setShow] = useState('open')
  const [openId, setOpenId] = useState(null)
  const tracked = inv.poViews.filter((p) => p.sku && !p.receivedBeforeStockRecords && p.sentAt && p.status !== 'Cancelled')
  const q = (search || '').toLowerCase()
  const rows = tracked
    .filter((p) => show === 'all' || (show === 'delayed' ? p.delayed : show === 'partial' ? p.status === 'Partially Delivered' : p.open || p.pendingInspection))
    .filter((p) => !q || `${p.id} ${p.vendor} ${p.material?.name}`.toLowerCase().includes(q))
    .sort((a, b) => (b.delayDays - a.delayDays) || a.expected.localeCompare(b.expected))
  const current = openId && inv.poViews.find((p) => p.id === openId)
  const open = tracked.filter((p) => p.open)

  return (
    <>
      <StatGrid items={[
        { label: 'Orders awaiting delivery', value: open.length },
        { label: 'Delayed', value: tracked.filter((p) => p.delayed).length, tone: tracked.some((p) => p.delayed) ? 'danger' : undefined },
        { label: 'Partially delivered', value: tracked.filter((p) => p.status === 'Partially Delivered').length, tone: 'warning' },
        { label: 'Awaiting store inspection', value: tracked.filter((p) => p.pendingInspection).length, sub: 'Store Keeper inspects and adds to stock' },
      ]} />
      <Card title="Delivery Tracking" sub="Ordered vs delivered from the Store Keeper's goods receipts (GRN). You follow up; the Store Keeper receives and inspects." bodyClass="">
        <div className="toolbar">
          <label className="field">Show
            <select value={show} onChange={(e) => setShow(e.target.value)}>
              <option value="open">Open orders</option>
              <option value="delayed">Delayed only</option>
              <option value="partial">Partially delivered</option>
              <option value="all">All sent orders</option>
            </select>
          </label>
        </div>
        <DataTable
          dense
          rows={rows}
          emptyText="No orders match."
          columns={[
            { key: 'id', header: 'PO', render: (p) => <><div className="cell-main">{p.id}</div><div className="cell-sub">{p.vendor}</div></> },
            { key: 'm', header: 'Material', render: (p) => <>{p.material?.name}<div className="cell-sub">to {p.store?.name}</div></> },
            { key: 'e', header: 'Expected', render: (p) => <>{formatDate(p.expected)}{p.originalExpected !== p.expected && <div className="cell-sub">was {formatDate(p.originalExpected)}</div>}</> },
            { key: 'o', header: 'Ordered', align: 'num', render: (p) => fmtQty(p.qty, p.unit) },
            { key: 'd', header: 'Delivered', align: 'num', render: (p) => fmtQty(p.delivered) },
            { key: 'a', header: 'Accepted', align: 'num', render: (p) => <>{fmtQty(p.accepted)}{p.rejected > 0 && <div className="cell-sub down">{p.rejected} rejected</div>}</> },
            { key: 'p', header: 'Pending', align: 'num', render: (p) => <b className={p.pending ? '' : 'up'}>{fmtQty(p.pending)}</b> },
            { key: 's', header: 'Status', render: (p) => <Badge tone={TONE(deliveryState(p))}>{deliveryState(p)}</Badge> },
            { key: 'g', header: 'GRN / inspection', render: (p) => (p.grns.length ? <Link className="link-btn" to="/dashboards/store-keeper?tab=receipts" title="Open the Store Keeper's receipts">{p.grns.map((g) => `${g.id} (${g.status === 'Accepted' ? `${g.accepted} accepted` : 'inspection pending'})`).join(', ')}</Link> : <span className="cell-sub">No delivery yet</span>) },
            { key: 'f', header: 'Last follow-up', render: (p) => { const f = p.followUps?.[p.followUps.length - 1]; return f ? <span className="cell-sub wrap-cell">{fmtStamp(f.at)}: {f.note}</span> : <span className="cell-sub">—</span> } },
            { key: 'x', header: '', render: (p) => (p.open ? <button className={`btn btn-sm ${p.delayed ? 'btn-primary' : ''}`} onClick={() => setOpenId(p.id)}>Follow up</button> : null) },
          ]}
        />
      </Card>
      <SupplierQualityCard />
      {current && <FollowUp po={current} inv={inv} perms={perms} notify={notify} onClose={() => setOpenId(null)} />}
    </>
  )
}
