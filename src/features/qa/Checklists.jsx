import { useState } from 'react'
import DataTable from '../../components/DataTable.jsx'
import Icon from '../../components/Icon.jsx'
import { Badge, Card } from '../../components/UI.jsx'
import { CHECKLIST_CATEGORIES } from '../../data/demo/qaDemo.js'
import * as Q from '../../services/qa.js'
import { Drawer, FormError, HistoryList, Locked } from '../store-keeper/shared.jsx'
import { docRefLabel, useQA } from './shared.jsx'

function ChecklistForm({ ctx, existing, onClose }) {
  const [f, setF] = useState(existing ? { ...existing, items: existing.items.map((x) => ({ ...x })), note: '' } : { title: '', category: CHECKLIST_CATEGORIES[0], basis: [], items: [{ item: '', criteria: '' }], note: '' })
  const setItem = (i, k) => (e) => setF({ ...f, items: f.items.map((x, j) => (j === i ? { ...x, [k]: e.target.value } : x)) })
  return (
    <Drawer title={existing ? `Revise ${existing.id}` : 'New checklist'} sub="Acceptance criteria must come from the approved drawing / specification: reference it rather than writing tolerances here" onClose={() => { ctx.setError(''); onClose() }} wide>
      <div className="receipt-form">
        <div className="receipt-grid">
          <label className="field span-2">Title<input value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} /></label>
          <label className="field">Category<select value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })}>{CHECKLIST_CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select></label>
          <label className="field">Source document(s)
            <select value="" onChange={(e) => e.target.value && setF({ ...f, basis: [...new Set([...f.basis, e.target.value])] })}><option value="">Add from the document register…</option>{ctx.s.documents.map((d) => <option key={d.id} value={d.id}>{docRefLabel(ctx.s, d.id)} · {d.title}</option>)}</select>
            <span className="cell-sub">{f.basis.length ? f.basis.map((b) => <span key={b}>{docRefLabel(ctx.s, b)} <button type="button" className="link-btn" onClick={() => setF({ ...f, basis: f.basis.filter((x) => x !== b) })}>remove</button>{' '}</span>) : 'None: the checklist stays a draft'}</span>
          </label>
        </div>
        <div className="sub-panel-head"><b>Check items</b></div>
        {f.items.map((x, i) => (
          <div key={i} className="receipt-grid qa-meas">
            <label className="field">Check item<input value={x.item} onChange={setItem(i, 'item')} /></label>
            <label className="field span-2">Acceptance criteria / source reference<input value={x.criteria} onChange={setItem(i, 'criteria')} placeholder="e.g. As per approved drawing S-102, bar schedule" /></label>
          </div>
        ))}
        <button type="button" className="link-btn" style={{ marginLeft: 18 }} onClick={() => setF({ ...f, items: [...f.items, { item: '', criteria: '' }] })}>+ Add item</button>
        {existing && <div className="receipt-grid"><label className="field span-2">Reason for revision<input value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} /></label></div>}
        <div className="sk-form-foot"><FormError error={ctx.error} /><div className="jv-submit"><button className="btn btn-primary" onClick={() => ctx.act('saveChecklist', f) && onClose()}>{existing ? 'Save revision' : 'Create checklist'}</button><button className="btn" onClick={onClose}>Cancel</button></div></div>
      </div>
    </Drawer>
  )
}

export default function Checklists({ notify, search }) {
  const ctx = useQA(notify)
  const [form, setForm] = useState(null)
  const [viewId, setViewId] = useState(null)
  const [cat, setCat] = useState('all')
  const q = (search || '').toLowerCase()
  const rows = ctx.s.checklists.filter((c) => (cat === 'all' || c.category === cat) && (!q || `${c.id} ${c.title} ${c.category}`.toLowerCase().includes(q)))
  const viewing = viewId && ctx.s.checklists.find((c) => c.id === viewId)
  return (
    <>
      <div className="info-note"><span>ℹ</span><div>Checklist items point to the approved drawing or specification that defines the requirement. A checklist is <b>in use</b> only when every source document has an approved revision; otherwise it stays a draft and cannot be used for an inspection. Demo checklists are illustrative, not approved engineering standards.</div></div>
      <Card title="Quality checklists" bodyClass=""
        action={ctx.perms.manage ? <button className="btn btn-primary btn-sm" onClick={() => setForm('new')}><Icon name="plus" size={14} />New checklist</button> : <Locked>View only</Locked>}>
        <div className="toolbar"><label className="field">Category<select value={cat} onChange={(e) => setCat(e.target.value)}><option value="all">All</option>{CHECKLIST_CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select></label></div>
        <DataTable dense rows={rows} emptyText="No checklists in this category." columns={[
          { key: 'id', header: 'Checklist', render: (c) => <><button className="link-btn" onClick={() => setViewId(c.id)}>{c.id}</button><div className="cell-sub">v{c.version}</div></> },
          { key: 't', header: 'Title', render: (c) => <span className="wrap-cell">{c.title}<div className="cell-sub">{c.category}</div></span> },
          { key: 'b', header: 'Source documents', render: (c) => <span className="cell-sub wrap-cell">{c.basis.map((b) => docRefLabel(ctx.s, b)).join(', ') || 'None'}</span> },
          { key: 'n', header: 'Items', align: 'num', render: (c) => c.items.length },
          { key: 's', header: 'Status', render: (c) => { const b = Q.checklistBasis(ctx.s, c); return <><Badge tone={b.usable ? 'success' : 'warning'}>{b.usable ? 'In use' : 'Draft'}</Badge>{!b.usable && <div className="cell-sub wrap-cell">{b.label}</div>}</> } },
          { key: 'x', header: '', render: (c) => <div className="cell-actions"><button className="btn btn-sm" onClick={() => setViewId(c.id)}>View</button>{ctx.perms.manage && <button className="btn btn-sm" onClick={() => setForm(c)}>Revise</button>}</div> },
        ]} />
      </Card>
      {form && <ChecklistForm ctx={ctx} existing={form === 'new' ? null : form} onClose={() => setForm(null)} />}
      {viewing && (
        <Drawer title={`${viewing.id} · ${viewing.title}`} sub={`${viewing.category} · version ${viewing.version}`} onClose={() => setViewId(null)} wide>
          {viewing.note && <div className="info-note"><span>ℹ</span><div>{viewing.note}</div></div>}
          <p className="cell-sub">Source: {viewing.basis.map((b) => docRefLabel(ctx.s, b)).join(', ') || 'none yet'} · {Q.checklistBasis(ctx.s, viewing).label}</p>
          <div className="table-wrap"><table className="qa-check">
            <thead><tr><th>#</th><th>Check item</th><th>Acceptance criteria</th><th>Result</th><th>Observation</th><th>Photo</th></tr></thead>
            <tbody>{viewing.items.map((x) => <tr key={x.id}><td>{x.id}</td><td>{x.item}</td><td className="cell-sub wrap-cell">{x.criteria}</td><td className="cell-sub">Pass / Fail / N/A</td><td className="cell-sub">At inspection</td><td className="cell-sub">Optional</td></tr>)}</tbody>
          </table></div>
          <p className="cell-sub" style={{ marginTop: 8 }}>Inspector, date and time are recorded automatically with the result.</p>
          <div className="sub-panel-head" style={{ marginTop: 12 }}><b>History</b></div>
          <HistoryList items={[...viewing.history].reverse()} />
        </Drawer>
      )}
    </>
  )
}
