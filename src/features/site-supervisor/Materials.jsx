import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import DataTable from '../../components/DataTable.jsx'
import Icon from '../../components/Icon.jsx'
import { Badge, Card } from '../../components/UI.jsx'
import { findStock, materialOf, storeOf } from '../../services/inventory.js'
import { siteOf, siteStoreOf } from '../../services/site.js'
import { addDays, todayISO } from '../../utils/date.js'
import { formatDate } from '../../utils/format.js'
import { ConfirmDialog, Drawer, fmtQty, FormError, HistoryList, Locked, qtyStep } from '../store-keeper/shared.jsx'
import { engineerOf, shortName, supData, useSupervisor } from './shared.jsx'

function ShortageForm({ ctx, d, onClose }) {
  const siteId = ctx.mySites[0]?.id || ''
  const [f, setF] = useState({ siteId, sku: '', required: '', available: '', neededBy: addDays(todayISO(), 1), taskId: '', remarks: '' })
  const [confirming, setConfirming] = useState(false)
  const [error, setError] = useState('')
  const m = f.sku ? materialOf(f.sku) : null
  const store = siteStoreOf(f.siteId)
  const row = f.sku ? findStock(ctx.inv.stock, f.sku, store) : null
  const shortage = Math.max(0, (Number(f.required) || 0) - (Number(f.available) || 0))
  const set = (k) => (e) => { setF({ ...f, [k]: e.target.value }); setError('') }
  const review = () => {
    if (!m) return setError('Select the material.')
    if (!(Number(f.required) > 0)) return setError('Enter the quantity the work needs.')
    if (f.available === '' || Number(f.available) < 0) return setError('Enter the usable quantity you counted on site (0 if none).')
    if (shortage <= 0) return setError('Available covers the requirement: there is no shortage to report.')
    setConfirming(true)
  }
  const save = () => { const ok = ctx.act('reportShortage', f); setConfirming(false); if (ok) onClose() }
  return (
    <Drawer title="Report a material shortage" sub={`To ${engineerOf(f.siteId)} (Site Engineer), who raises the formal material request if needed`} onClose={onClose}>
      <div className="receipt-form">
        <div className="receipt-grid">
          <label className="field">Site<select value={f.siteId} onChange={set('siteId')}>{ctx.mySites.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select></label>
          <label className="field">For activity (optional)<select value={f.taskId} onChange={set('taskId')}><option value="">—</option>{d.active.filter((t) => t.siteId === f.siteId).map((t) => <option key={t.id} value={t.id}>{t.id} · {t.title}</option>)}</select></label>
          <label className="field span-2">Material (material master)<select value={f.sku} onChange={set('sku')}><option value="">Select…</option>{ctx.inv.state.materials.map((x) => <option key={x.sku} value={x.sku}>{x.name} ({x.unit})</option>)}</select></label>
          <label className="field">Site requirement ({m?.unit || 'qty'})<input type="number" min="0" step={qtyStep(m?.unit)} value={f.required} onChange={set('required')} /></label>
          <label className="field">Usable quantity on site ({m?.unit || 'qty'})<input type="number" min="0" step={qtyStep(m?.unit)} value={f.available} onChange={set('available')} placeholder="Your count" /></label>
          <label className="field">Needed by<input type="date" min={todayISO()} value={f.neededBy} onChange={set('neededBy')} /></label>
          <div className="field">Shortage<div className="sk-readonly">{m ? `${shortage} ${m.unit}` : '—'}</div></div>
          <label className="field span-2">Remarks<input value={f.remarks} onChange={set('remarks')} placeholder="e.g. Brickwork tomorrow needs 10 bags; only 4 usable bags (2 set hard)" /></label>
        </div>
        {m && <div className="info-note sk-inline-note"><span>ℹ</span><div>Store record for reference: {row ? `${fmtQty(row.availableForIssue, m.unit)} free for issue at ${storeOf(store)?.name}` : `not stocked at ${storeOf(store)?.name || 'the site store'}`}. Your count is what you report; you cannot change store stock.</div></div>}
        <div className="sk-form-foot">
          <FormError error={error || ctx.error} />
          <div className="jv-submit"><button className="btn btn-primary" onClick={review}>Review & report</button><button className="btn" onClick={onClose}>Cancel</button></div>
          <p className="cell-sub">This is a report, not a material request. The Site Engineer raises the request; the Store Keeper checks stock and the Project Manager approves it.</p>
        </div>
      </div>
      {confirming && (
        <ConfirmDialog title={`Report a shortage of ${shortage} ${m.unit} ${m.name}?`} confirmLabel="Report to Site Engineer" onCancel={() => setConfirming(false)} onConfirm={save}>
          <p>Needed {f.required} by {formatDate(f.neededBy)}; usable on site {f.available}.</p>
        </ConfirmDialog>
      )}
    </Drawer>
  )
}

export default function Materials({ notify }) {
  const ctx = useSupervisor(notify)
  const d = supData(ctx)
  const [params, setParams] = useSearchParams()
  const [view, setView] = useState(null)
  const creating = params.get('new') === '1'
  const stores = ctx.scope.siteIds.map(siteStoreOf)
  const stock = ctx.inv.stock.filter((s) => stores.includes(s.storeId)).sort((a, b) => a.material.name.localeCompare(b.material.name))
  const viewing = view && d.shortages.find((x) => x.id === view)
  const reqOf = (id) => d.requests.find((r) => r.id === id)

  return (
    <>
      <div className="info-note"><span>ℹ</span><div>View only: stock belongs to the Store Keeper and material requests to the Site Engineer. You report shortages; the Site Engineer raises the formal request, which follows Store Keeper check → Project Manager approval → issue.</div></div>
      <Card title="Shortage reports" sub="Reported by you to the Site Engineer, with the material request raised for each" bodyClass=""
        action={ctx.perms.supervise ? <button className="btn btn-primary btn-sm" onClick={() => setParams({ new: '1' })}><Icon name="plus" size={14} />Report shortage</button> : <Locked>View only</Locked>}>
        <DataTable dense rows={[...d.shortages].sort((a, b) => b.at.localeCompare(a.at))} emptyText="No shortages reported." columns={[
          { key: 'id', header: 'Report', render: (x) => <><button className="link-btn" onClick={() => setView(x.id)}>{x.id}</button><div className="cell-sub">{formatDate(x.at.slice(0, 10))}</div></> },
          { key: 'm', header: 'Material', render: (x) => <>{materialOf(x.sku)?.name}<div className="cell-sub">{materialOf(x.sku)?.unit}</div></> },
          { key: 'r', header: 'Site requirement', align: 'num', render: (x) => x.required },
          { key: 'a', header: 'Reported available', align: 'num', render: (x) => x.available },
          { key: 's', header: 'Shortage', align: 'num', render: (x) => <b className="down">{x.shortage}</b> },
          { key: 'n', header: 'Needed by', render: (x) => formatDate(x.neededBy) },
          { key: 'mr', header: 'Material request', render: (x) => { const r = x.requestRef && reqOf(x.requestRef); return r ? <>{r.id}<div className="cell-sub"><Badge>{r.status}</Badge> issued {r.issued}{r.approved != null ? ` of ${r.approved}` : ''}</div></> : <span className="cell-sub">Not raised yet</span> } },
          { key: 'st', header: 'Remarks / status', render: (x) => <><Badge>{x.status}</Badge><div className="cell-sub wrap-cell">{x.closeNote || x.remarks}</div></> },
        ]} />
      </Card>

      <Card title="Material requests for your site" sub="Raised by the Site Engineer (statuses from the shared request record)" bodyClass="" className="section-gap">
        <DataTable dense rows={[...d.requests].sort((a, b) => b.at.localeCompare(a.at)).slice(0, 15)} emptyText="No requests." columns={[
          { key: 'id', header: 'Request', render: (r) => <><div className="cell-main">{r.id}</div><div className="cell-sub">{r.requestedBy}</div></> },
          { key: 'm', header: 'Material', render: (r) => <span className="wrap-cell">{r.material.name}<div className="cell-sub">{r.purpose}</div></span> },
          { key: 'q', header: 'Requested / approved / issued', align: 'num', render: (r) => `${r.requested} / ${r.approved ?? '—'} / ${r.issued} ${r.material.unit}` },
          { key: 'n', header: 'Needed by', render: (r) => formatDate(r.requiredBy) },
          { key: 's', header: 'Status', render: (r) => <><Badge>{r.status}</Badge>{r.forwarded && <div className="cell-sub">shortage with purchasing ({r.forwarded.id})</div>}</> },
        ]} />
      </Card>

      <Card title="Site store stock" sub={`Store Keeper's records for ${stores.map((x) => storeOf(x)?.name).join(', ')} (view only)`} bodyClass="" className="section-gap">
        <DataTable dense rowKey="key" rows={stock} emptyText="No stock records." columns={[
          { key: 'm', header: 'Material', render: (s) => s.material.name },
          { key: 'u', header: 'Unit', render: (s) => s.material.unit },
          { key: 'o', header: 'On hand', align: 'num', render: (s) => fmtQty(s.onHand) },
          { key: 'r', header: 'Reserved for requests', align: 'num', render: (s) => fmtQty(s.reserved) },
          { key: 'f', header: 'Free for issue', align: 'num', render: (s) => <b>{fmtQty(s.availableForIssue)}</b> },
          { key: 's', header: 'Status', render: (s) => <Badge>{s.status}</Badge> },
        ]} />
      </Card>

      {creating && <ShortageForm ctx={ctx} d={d} onClose={() => setParams({})} />}
      {viewing && (
        <Drawer title={`${viewing.id} · ${materialOf(viewing.sku)?.name}`} sub={`${shortName(siteOf(viewing.siteId)?.name)} · reported by ${viewing.reportedBy}`} onClose={() => setView(null)}>
          <dl className="details"><dt>Requirement / available / shortage</dt><dd>{viewing.required} / {viewing.available} / {viewing.shortage} {materialOf(viewing.sku)?.unit}</dd><dt>For</dt><dd>{viewing.taskId || '—'} · {viewing.remarks}</dd><dt>Status</dt><dd><Badge>{viewing.status}</Badge>{viewing.requestRef ? ` · ${viewing.requestRef}` : ''}</dd></dl>
          <section className="drawer-section"><h3>History</h3><HistoryList items={viewing.history} /></section>
        </Drawer>
      )}
    </>
  )
}
