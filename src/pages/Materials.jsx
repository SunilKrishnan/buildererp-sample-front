import { useState } from 'react'
import { Link } from 'react-router-dom'
import { DemoTag } from '../components/StateViews.jsx'
import { Badge, Card, Chips, Kpi, PageHead } from '../components/UI.jsx'
import Icon from '../components/Icon.jsx'
import { useInventory } from '../features/store-keeper/InventoryContext.jsx'
import MaterialFormModal from '../features/store-keeper/MaterialFormModal.jsx'
import { useStorePerms } from '../features/store-keeper/shared.jsx'
import { stockByMaterial } from '../services/inventory.js'
import { formatINR, formatNumber } from '../utils/format.js'

// Company-wide stock per material, totalled across all stores. Uses the same inventory
// records as the Store Keeper Dashboard, which shows each store separately.
export default function Materials({ search, notify }) {
  const inv = useInventory()
  const perms = useStorePerms()
  const [filter, setFilter] = useState('All')
  const [materialForm, setMaterialForm] = useState(null) // { sku? }
  const materials = stockByMaterial(inv.stock)
  const q = search.toLowerCase()
  const list = materials
    .filter(
      (m) =>
        (filter === 'All' || m.status === filter) &&
        (!q || `${m.material.name} ${m.sku} ${m.material.supplier} ${m.material.category}`.toLowerCase().includes(q))
    )
    .sort((a, b) => a.material.name.localeCompare(b.material.name))
  const value = materials.reduce((s, m) => s + m.value, 0)
  const low = materials.filter((m) => m.status !== 'In Stock').length

  return (
    <>
      <PageHead title="Materials & Inventory" sub="Stock across all stores and reorder alerts">
        <DemoTag />
        <Link className="btn" to="/dashboards/store-keeper?tab=stock">Stock by store</Link>
        {perms.materialMaster && <button className="btn btn-primary" onClick={() => setMaterialForm({})}><Icon name="plus" />Add Material</button>}
      </PageHead>

      <div className="grid kpis">
        <Kpi label="Total SKUs" value={materials.length} icon="box" />
        <Kpi label="Stock Value" value={formatINR(value)} icon="rupee" />
        <Kpi label="Below Reorder" value={low} icon="alert" foot="at one or more stores" />
        <Kpi label="Suppliers" value={new Set(materials.map((m) => m.material.supplier)).size} icon="handshake" />
      </div>

      <Card bodyClass="">
        <div className="toolbar">
          <Chips options={['All', 'In Stock', 'Low Stock', 'Out of Stock']} value={filter} onChange={setFilter} />
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>Material</th><th>Supplier</th><th className="num">In stock</th><th className="num">Reserved</th><th className="num">Free for issue</th><th className="num">Reorder level</th><th className="num">Rate</th><th>Status</th><th></th></tr>
            </thead>
            <tbody>
              {list.map((m) => (
                <tr key={m.sku}>
                  <td><div className="cell-main">{m.material.name}</div><div className="cell-sub">{m.sku} · {m.stores} {m.stores === 1 ? 'store' : 'stores'}</div></td>
                  <td>{m.material.supplier}</td>
                  <td className="num">{formatNumber(m.onHand)} {m.material.unit}</td>
                  <td className="num">{formatNumber(m.reserved + m.onHold)}</td>
                  <td className="num">{formatNumber(m.availableForIssue)}</td>
                  <td className="num">{formatNumber(m.reorder)}</td>
                  <td className="num">{formatINR(m.material.rate)}</td>
                  <td><Badge>{m.status}</Badge>{m.belowAt.length > 0 && <div className="cell-sub">{m.belowAt.join(', ')}</div>}</td>
                  <td>
                    <div className="cell-actions">
                      {perms.materialMaster && <button className="btn" onClick={() => setMaterialForm({ sku: m.sku })}>Edit</button>}
                      {m.status !== 'In Stock' && <Link className="btn" to="/dashboards/store-keeper?tab=reorder">Reorder</Link>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {list.length === 0 && <div className="empty">No materials found.</div>}
        </div>
      </Card>
      <p className="cell-sub" style={{ marginTop: 10 }}>Demo: added or edited materials are temporary and reset when the page is reloaded. Nothing is saved to a database.</p>
      {materialForm && <MaterialFormModal sku={materialForm.sku} inv={inv} perms={perms} notify={notify} onClose={() => setMaterialForm(null)} />}
    </>
  )
}
