import { useState } from 'react'
import DataTable from '../../components/DataTable.jsx'
import { Badge, Card } from '../../components/UI.jsx'
import { STORES } from '../../data/demo/inventoryDemo.js'
import { projects } from '../../data/mockData.js'
import { materialOf, projectOf, storeOf } from '../../services/inventory.js'
import { downloadCsv, fmtQty, fmtStamp } from './shared.jsx'

export const MOVEMENT_TYPES = ['Opening balance', 'Receipt', 'Issue', 'Return', 'Transfer', 'Adjustment']
const TYPE_TONE = { Receipt: 'success', Return: 'success', Issue: 'info', Transfer: 'muted', Adjustment: 'warning', 'Opening balance': 'muted' }

export const movementColumns = [
  { key: 'at', header: 'Date and time', render: (m) => fmtStamp(m.at), csv: (m) => m.at.replace('T', ' ') },
  { key: 'ref', header: 'Reference', render: (m) => <span className="cell-main">{m.ref}</span> },
  { key: 'm', header: 'Material', render: (m) => materialOf(m.sku).name, csv: (m) => materialOf(m.sku).name },
  { key: 's', header: 'Project / store', render: (m) => <><div>{storeOf(m.storeId).name}</div>{m.projectId && <div className="cell-sub">{projectOf(m.projectId)?.short}</div>}</>, csv: (m) => storeOf(m.storeId).name },
  { key: 'type', header: 'Type', render: (m) => <Badge tone={TYPE_TONE[m.type]}>{m.type}</Badge> },
  { key: 'qtyIn', header: 'Qty in', align: 'num', render: (m) => (m.qtyIn ? <span className="up">+{fmtQty(m.qtyIn)}</span> : '') },
  { key: 'qtyOut', header: 'Qty out', align: 'num', render: (m) => (m.qtyOut ? <span className="down">−{fmtQty(m.qtyOut)}</span> : '') },
  { key: 'balanceAfter', header: 'Balance after', align: 'num', render: (m) => <b>{fmtQty(m.balanceAfter, materialOf(m.sku).unit)}</b> },
  { key: 'related', header: 'Related PO / request', render: (m) => m.related || '—' },
  { key: 'by', header: 'Recorded by' },
  { key: 'notes', header: 'Notes', render: (m) => <span className="cell-sub wrap-cell">{m.notes}</span> },
]

export default function Movements({ inv, params, search }) {
  const [sku, setSku] = useState(params.get('sku') || 'all')
  const [store, setStore] = useState(params.get('store') || 'all')
  const [project, setProject] = useState('all')
  const [type, setType] = useState('all')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [ref, setRef] = useState('')
  const q = `${ref} ${search || ''}`.trim().toLowerCase()

  const rows = inv.movements
    .filter((m) => sku === 'all' || m.sku === sku)
    .filter((m) => store === 'all' || m.storeId === store)
    .filter((m) => project === 'all' || (project === 'company' ? !m.projectId : m.projectId === project))
    .filter((m) => type === 'all' || m.type === type)
    .filter((m) => (!from || m.at.slice(0, 10) >= from) && (!to || m.at.slice(0, 10) <= to))
    .filter((m) => !q || `${m.ref} ${m.related} ${materialOf(m.sku).name}`.toLowerCase().includes(q))
    .slice().reverse()

  return (
    <Card title="Stock Movement History" sub="Every confirmed stock change, newest first. Pending inspections, requests and unreviewed adjustments do not appear until they change stock." bodyClass=""
      action={<button className="btn btn-sm" onClick={() => downloadCsv('stock-movements-demo.csv', movementColumns, rows)}>Export CSV</button>}>
      <div className="toolbar">
        <div className="filters">
          <label className="field">Material
            <select value={sku} onChange={(e) => setSku(e.target.value)}>
              <option value="all">All materials</option>
              {inv.state.materials.map((m) => <option key={m.sku} value={m.sku}>{m.name}</option>)}
            </select>
          </label>
          <label className="field">Store
            <select value={store} onChange={(e) => setStore(e.target.value)}>
              <option value="all">All stores</option>
              {STORES.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </label>
          <label className="field">Project
            <select value={project} onChange={(e) => setProject(e.target.value)}>
              <option value="all">All projects</option>
              {projects.map((p) => <option key={p.id} value={p.id}>{p.short}</option>)}
              <option value="company">Company store</option>
            </select>
          </label>
          <label className="field">Type
            <select value={type} onChange={(e) => setType(e.target.value)}>
              <option value="all">All types</option>
              {MOVEMENT_TYPES.map((t) => <option key={t}>{t}</option>)}
            </select>
          </label>
          <label className="field">From<input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></label>
          <label className="field">To<input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></label>
          <label className="field field-search">Reference no.<input type="search" value={ref} onChange={(e) => setRef(e.target.value)} placeholder="GRN-, MI-, PO-, MR-…" /></label>
        </div>
      </div>
      <div className="filter-note" style={{ padding: '0 18px' }}>{rows.length} movements · balances are per material per store</div>
      <DataTable dense rows={rows} columns={movementColumns} emptyText="No stock movements match these filters." />
    </Card>
  )
}
