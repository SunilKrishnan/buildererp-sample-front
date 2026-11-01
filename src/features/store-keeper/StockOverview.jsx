import { useState } from 'react'
import DataTable from '../../components/DataTable.jsx'
import Icon from '../../components/Icon.jsx'
import { Badge, Card } from '../../components/UI.jsx'
import { MATERIAL_CATEGORIES } from '../../data/demo/inventoryDemo.js'
import { projects } from '../../data/mockData.js'
import { storeProjectLabel } from '../../services/inventory.js'
import { formatCompactINR } from '../../utils/format.js'
import MaterialFormModal from './MaterialFormModal.jsx'
import { fmtQty, fmtStamp, GLOSSARY, storeOptions, Term } from './shared.jsx'

const SORTS = {
  material: { label: 'Material (A–Z)', fn: (a, b) => a.material.name.localeCompare(b.material.name) || a.store.name.localeCompare(b.store.name) },
  free: { label: 'Free for issue vs reorder (lowest first)', fn: (a, b) => a.availableForIssue / (a.reorder || 1) - b.availableForIssue / (b.reorder || 1) },
  value: { label: 'Stock value (highest first)', fn: (a, b) => b.value - a.value },
  updated: { label: 'Last updated (newest first)', fn: (a, b) => (b.lastUpdated || '').localeCompare(a.lastUpdated || '') },
  store: { label: 'Store', fn: (a, b) => a.store.name.localeCompare(b.store.name) || a.material.name.localeCompare(b.material.name) },
}

function LocationCell({ row, editable, onSave }) {
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState(row.location)
  if (!editing) {
    return (
      <div className="cell-actions">
        <span>{row.location || '—'}</span>
        {editable && <button className="link-btn" onClick={() => { setValue(row.location); setEditing(true) }} aria-label={`Change storage location of ${row.material.name}`}>Edit</button>}
      </div>
    )
  }
  const save = (e) => {
    e.preventDefault()
    if (value.trim()) { onSave(value.trim()); setEditing(false) }
  }
  return (
    <form className="cell-actions" onSubmit={save}>
      <input className="inline-input" value={value} onChange={(e) => setValue(e.target.value)} aria-label="Storage location" autoFocus />
      <button className="btn btn-sm btn-primary" type="submit" disabled={!value.trim()}>Save</button>
      <button className="btn btn-sm" type="button" onClick={() => setEditing(false)}>Cancel</button>
    </form>
  )
}

export default function StockOverview({ inv, perms, search, go, notify }) {
  const [q, setQ] = useState('')
  const [project, setProject] = useState('all')
  const [store, setStore] = useState('all')
  const [category, setCategory] = useState('all')
  const [status, setStatus] = useState('all')
  const [sort, setSort] = useState('material')
  const [materialForm, setMaterialForm] = useState(null) // { sku? }

  const text = `${q} ${search || ''}`.trim().toLowerCase()
  const rows = inv.stock
    .filter((r) => project === 'all' || (project === 'company' ? !r.projectId : r.projectId === project))
    .filter((r) => store === 'all' || r.storeId === store)
    .filter((r) => category === 'all' || r.material.category === category)
    .filter((r) => status === 'all' || r.status === status)
    .filter((r) => !text || text.split(/\s+/).every((w) => `${r.material.name} ${r.sku} ${r.material.category} ${r.store.name} ${r.location}`.toLowerCase().includes(w)))
    .sort(SORTS[sort].fn)

  const clear = () => { setQ(''); setProject('all'); setStore('all'); setCategory('all'); setStatus('all') }
  const filtered = q || project !== 'all' || store !== 'all' || category !== 'all' || status !== 'all'

  return (
    <Card title="Stock Overview" sub="Usable stock per material and store. Free for issue = on hand − reserved − on hold." bodyClass=""
      action={perms.materialMaster && <button className="btn btn-primary btn-sm" onClick={() => setMaterialForm({})}><Icon name="plus" size={14} />Add Material</button>}>
      <div className="toolbar">
        <div className="filters">
          <label className="field field-search">Search
            <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Material, code, location…" />
          </label>
          <label className="field">Project
            <select value={project} onChange={(e) => setProject(e.target.value)}>
              <option value="all">All projects</option>
              {projects.map((p) => <option key={p.id} value={p.id}>{p.short}</option>)}
              <option value="company">Company store</option>
            </select>
          </label>
          <label className="field">Store
            <select value={store} onChange={(e) => setStore(e.target.value)}>
              <option value="all">All stores</option>
              {storeOptions.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
            </select>
          </label>
          <label className="field">Category
            <select value={category} onChange={(e) => setCategory(e.target.value)}>
              <option value="all">All categories</option>
              {MATERIAL_CATEGORIES.map((c) => <option key={c}>{c}</option>)}
            </select>
          </label>
          <label className="field">Stock status
            <select value={status} onChange={(e) => setStatus(e.target.value)}>
              {['all', 'In Stock', 'Low Stock', 'Out of Stock'].map((s) => <option key={s} value={s}>{s === 'all' ? 'All' : s}</option>)}
            </select>
          </label>
          <label className="field">Sort by
            <select value={sort} onChange={(e) => setSort(e.target.value)}>
              {Object.entries(SORTS).map(([id, s]) => <option key={id} value={id}>{s.label}</option>)}
            </select>
          </label>
        </div>
      </div>
      <div className="filter-note" style={{ padding: '0 18px' }}>
        {rows.length} of {inv.stock.length} stock lines
        {search && <span>· also matching top-bar search “{search}”</span>}
        {filtered && <button className="link-btn" onClick={clear}>Clear filters</button>}
      </div>
      <DataTable
        dense
        rowKey="key"
        rows={rows}
        emptyText="No stock lines match these filters."
        columns={[
          { key: 'name', header: 'Material', render: (r) => <><div className="cell-main">{r.material.name}</div><div className="cell-sub">{r.sku}</div></> },
          { key: 'cat', header: 'Category', render: (r) => r.material.category },
          { key: 'unit', header: 'Unit', render: (r) => r.material.unit },
          { key: 'onHand', header: <Term tip={GLOSSARY.onHand}>Available</Term>, align: 'num', render: (r) => <><b>{fmtQty(r.onHand)}</b>{r.awaitingInspection > 0 && <div className="cell-sub">+{fmtQty(r.awaitingInspection)} awaiting inspection</div>}</> },
          { key: 'res', header: <Term tip={GLOSSARY.reserved}>Reserved</Term>, align: 'num', render: (r) => <>{fmtQty(r.reserved)}{r.onHold > 0 && <div className="cell-sub" title={GLOSSARY.onHold}>+{fmtQty(r.onHold)} on hold</div>}</> },
          { key: 'free', header: <Term tip={GLOSSARY.available}>Free for issue</Term>, align: 'num', render: (r) => <b className={r.status === 'In Stock' ? '' : 'sk-warn-text'}>{fmtQty(r.availableForIssue)}</b> },
          { key: 'reorder', header: <Term tip={GLOSSARY.reorder}>Reorder level</Term>, align: 'num', render: (r) => fmtQty(r.reorder) },
          { key: 'loc', header: 'Storage location', render: (r) => <LocationCell row={r} editable={perms.locations} onSave={(v) => { inv.actions.setLocation(r.key, v); notify(`Demo: storage location of ${r.material.name} set to “${v}”. Stock balances are unchanged; moving stock between stores needs a transfer record (not saved)`) }} /> },
          { key: 'store', header: 'Project / Store', render: (r) => <><div>{r.store.name}</div><div className="cell-sub">{storeProjectLabel(r.store)}</div></> },
          { key: 'upd', header: 'Last updated', render: (r) => fmtStamp(r.lastUpdated) },
          { key: 'status', header: 'Stock status', render: (r) => <Badge>{r.status}</Badge> },
          { key: 'value', header: 'Value', align: 'num', render: (r) => formatCompactINR(r.value) },
          {
            key: 'act', header: 'Actions', render: (r) => (
              <div className="cell-actions">
                <button className="btn btn-sm" onClick={() => go('movements', { sku: r.sku, store: r.storeId })}>History</button>
                {perms.materialMaster && <button className="btn btn-sm" onClick={() => setMaterialForm({ sku: r.sku })}>Edit</button>}
                {r.status !== 'In Stock' && <button className="btn btn-sm" onClick={() => go('reorder')}>Reorder</button>}
              </div>
            ),
          },
        ]}
      />
      {materialForm && <MaterialFormModal sku={materialForm.sku} inv={inv} perms={perms} notify={notify} onClose={() => setMaterialForm(null)} defaultStoreId={store === 'all' ? '' : store} />}
    </Card>
  )
}
