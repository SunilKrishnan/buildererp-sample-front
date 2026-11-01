import { useState } from 'react'
import DataTable from '../../components/DataTable.jsx'
import Tabs from '../../components/Tabs.jsx'
import { Badge, Card } from '../../components/UI.jsx'
import { STORES } from '../../data/demo/inventoryDemo.js'
import {
  findStock, materialOf, returnedByIssue, round2, siteOf, storeOf, validateAdjustment, validateReturn, validateTransfer,
} from '../../services/inventory.js'
import { InspectForm } from './Receipts.jsx'
import { ConfirmDialog, Drawer, fmtQty, fmtStamp, FormError, GLOSSARY, Locked, qtyStep, StockChange, Term } from './shared.jsx'

const ADJ_KINDS = ['Count correction', 'Damaged', 'Other']

// ---------- Returns from site ----------

function ReturnForm({ inv, perms, notify, onDone }) {
  const reqById = Object.fromEntries(inv.state.requests.map((r) => [r.id, r]))
  const returned = returnedByIssue(inv.state.returns)
  const options = inv.state.issues
    .map((i) => ({ i, r: reqById[i.requestId], left: round2(i.qty - (returned[i.id] || 0)) }))
    .filter((o) => o.r && o.left > 0)
    .sort((a, b) => b.i.at.localeCompare(a.i.at))
  const [f, setF] = useState({ issueId: options[0]?.i.id || '', qty: '', returnedBy: '', reason: '', notes: '' })
  const [touched, setTouched] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const sel = options.find((o) => o.i.id === f.issueId)
  const error = validateReturn(f, sel?.i, sel?.r, inv.state.returns)
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value })
  if (!options.length) return <div className="empty sm">No issued material is available to return.</div>
  const m = materialOf(sel.r.sku)

  return (
    <form className="receipt-form" onSubmit={(e) => { e.preventDefault(); setTouched(true); if (!error) setConfirming(true) }} noValidate>
      <div className="sub-panel-head"><b>Material returned from site</b><span className="cell-sub">Held out of usable stock until inspected</span></div>
      <div className="receipt-grid">
        <label className="field span-2">Original issue
          <select value={f.issueId} onChange={set('issueId')}>
            {options.map((o) => <option key={o.i.id} value={o.i.id}>{o.i.id} · {materialOf(o.r.sku).name} · {siteOf(o.r.siteId)?.name} · up to {o.left} {materialOf(o.r.sku).unit}</option>)}
          </select>
        </label>
        <label className="field">Returned quantity ({m.unit})<input type="number" min="0" step={qtyStep(m.unit)} value={f.qty} onChange={set('qty')} /></label>
        <label className="field">Returned by<input value={f.returnedBy} onChange={set('returnedBy')} placeholder={siteOf(sel.r.siteId)?.supervisor} /></label>
        <label className="field span-2">Reason<input value={f.reason} onChange={set('reason')} placeholder="e.g. work finished, excess material" /></label>
        <label className="field span-2">Notes<input value={f.notes} onChange={set('notes')} placeholder="Optional condition notes" /></label>
      </div>
      <div className="sk-form-foot">
        <FormError error={error} show={touched} />
        <div className="jv-submit">
          <button className="btn btn-primary" type="submit">Record return</button>
          <button className="btn" type="button" onClick={onDone}>Cancel</button>
        </div>
      </div>
      {confirming && (
        <ConfirmDialog title="Record site return?" confirmLabel="Record return" onCancel={() => setConfirming(false)}
          onConfirm={() => { inv.actions.recordReturn(f, sel.r, perms.user); notify(`Demo: return of ${f.qty} ${m.unit} ${m.name} recorded, pending inspection (not saved)`); onDone() }}>
          <p>{fmtQty(Number(f.qty), m.unit)} of {m.name} back to {storeOf(sel.r.storeId).name}.</p>
          <p className="cell-sub">Usable stock does not change until the return is inspected and accepted.</p>
        </ConfirmDialog>
      )}
    </form>
  )
}

function ReturnsPanel({ inv, perms, notify }) {
  const [adding, setAdding] = useState(false)
  const [inspecting, setInspecting] = useState(null)
  const rows = [...inv.state.returns].sort((a, b) => b.at.localeCompare(a.at))
  const current = inspecting && inv.state.returns.find((r) => r.id === inspecting)
  return (
    <Card title="Returns from site" sub="Unused material sent back to the store. Only the accepted quantity returns to usable stock; damaged quantity is recorded separately." bodyClass=""
      action={perms.move ? <button className="btn btn-primary btn-sm" onClick={() => setAdding(true)}>Record return</button> : <Locked>Store Keeper</Locked>}>
      <DataTable
        dense
        rows={rows}
        emptyText="No returns recorded."
        columns={[
          { key: 'id', header: 'Return ref.', render: (r) => <><div className="cell-main">{r.id}</div><div className="cell-sub">{fmtStamp(r.at)}</div></> },
          { key: 'iss', header: 'Original issue', render: (r) => r.issueId },
          { key: 'site', header: 'From site', render: (r) => siteOf(r.siteId)?.name },
          { key: 'm', header: 'Material', render: (r) => <><div>{materialOf(r.sku).name}</div><div className="cell-sub">To {storeOf(r.storeId).name}</div></> },
          { key: 'q', header: 'Returned', align: 'num', render: (r) => fmtQty(r.qty, materialOf(r.sku).unit) },
          { key: 'a', header: 'Accepted', align: 'num', render: (r) => fmtQty(r.accepted) },
          { key: 'd', header: 'Damaged', align: 'num', render: (r) => <span className={r.damaged ? 'down' : ''}>{fmtQty(r.damaged)}</span> },
          { key: 'by', header: 'Returned / received by', render: (r) => <><div>{r.returnedBy}</div><div className="cell-sub">{r.receivedBy}</div></> },
          { key: 'why', header: 'Reason', render: (r) => <span className="cell-sub">{r.reason}{r.notes ? `. ${r.notes}` : ''}</span> },
          { key: 's', header: 'Status', render: (r) => <Badge>{r.status}</Badge> },
          { key: 'x', header: '', render: (r) => r.status === 'Pending Inspection' && (perms.move ? <button className="btn btn-sm btn-primary" onClick={() => setInspecting(r.id)}>Inspect</button> : <Locked>Store Keeper</Locked>) },
        ]}
      />
      {adding && <Drawer title="Record site return" onClose={() => setAdding(false)}><ReturnForm inv={inv} perms={perms} notify={notify} onDone={() => setAdding(false)} /></Drawer>}
      {current && (
        <Drawer title={`Inspect ${current.id}`} sub={`${materialOf(current.sku).name} from ${siteOf(current.siteId)?.name}`} onClose={() => setInspecting(null)}>
          <InspectForm total={current.qty} unit={materialOf(current.sku).unit} label="Returned" stockBefore={findStock(inv.stock, current.sku, current.storeId)?.onHand || 0}
            onCancel={() => setInspecting(null)}
            onSubmit={(v) => { inv.actions.inspectReturn(current.id, v, perms.user); notify(`Demo: ${current.id} inspected. ${v.accepted} added back to usable stock (not saved)`); setInspecting(null) }} />
        </Drawer>
      )}
    </Card>
  )
}

// ---------- Transfers ----------

function TransferForm({ inv, perms, notify, onDone }) {
  const [f, setF] = useState({ fromStoreId: 'CW', toStoreId: 'SHA', sku: '', qty: '', receivedBy: '', reason: '' })
  const [touched, setTouched] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const sourceRows = inv.stock.filter((s) => s.storeId === f.fromStoreId && s.availableForIssue > 0)
  const sku = sourceRows.some((s) => s.sku === f.sku) ? f.sku : sourceRows[0]?.sku || ''
  const form = { ...f, sku }
  const error = validateTransfer(form, inv.stock)
  const m = materialOf(sku)
  const src = findStock(inv.stock, sku, f.fromStoreId)
  const dst = findStock(inv.stock, sku, f.toStoreId)
  const n = Number(f.qty) || 0
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value })
  return (
    <form className="receipt-form" onSubmit={(e) => { e.preventDefault(); setTouched(true); if (!error) setConfirming(true) }} noValidate>
      <div className="sub-panel-head"><b>Store-to-store transfer</b><span className="cell-sub">Moves stock; never creates new stock</span></div>
      <div className="receipt-grid">
        <label className="field">From store<select value={f.fromStoreId} onChange={set('fromStoreId')}>{STORES.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
        <label className="field">To store<select value={f.toStoreId} onChange={set('toStoreId')}>{STORES.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
        <label className="field span-2">Material
          <select value={sku} onChange={set('sku')}>
            {sourceRows.length === 0 && <option value="">No free stock in this store</option>}
            {sourceRows.map((s) => <option key={s.sku} value={s.sku}>{s.material.name} · {s.availableForIssue} {s.material.unit} free</option>)}
          </select>
        </label>
        <label className="field">Quantity{m ? ` (${m.unit})` : ''}<input type="number" min="0" step={qtyStep(m?.unit)} value={f.qty} onChange={set('qty')} /></label>
        <label className="field">Received by (destination)<input value={f.receivedBy} onChange={set('receivedBy')} placeholder="Optional" /></label>
        <label className="field span-2">Reason<input value={f.reason} onChange={set('reason')} placeholder="e.g. urgent requirement at Tower A" /></label>
      </div>
      <div className="sk-form-foot">
        <FormError error={error} show={touched} />
        <div className="jv-submit">
          <button className="btn btn-primary" type="submit">Review & confirm transfer</button>
          <button className="btn" type="button" onClick={onDone}>Cancel</button>
        </div>
      </div>
      {confirming && (
        <ConfirmDialog title={`Transfer ${fmtQty(n, m.unit)} of ${m.name}?`} confirmLabel="Confirm transfer" onCancel={() => setConfirming(false)}
          onConfirm={() => { inv.actions.recordTransfer(form, perms.user); notify(`Demo: ${n} ${m.unit} ${m.name} moved from ${storeOf(f.fromStoreId).name} to ${storeOf(f.toStoreId).name} (not saved)`); onDone() }}>
          <StockChange label={storeOf(f.fromStoreId).name} before={src.onHand} after={round2(src.onHand - n)} unit={m.unit} />
          <StockChange label={storeOf(f.toStoreId).name} before={dst?.onHand || 0} after={round2((dst?.onHand || 0) + n)} unit={m.unit} />
          <p className="cell-sub">Total stock across stores stays the same.</p>
        </ConfirmDialog>
      )}
    </form>
  )
}

function TransfersPanel({ inv, perms, notify }) {
  const [adding, setAdding] = useState(false)
  return (
    <Card title="Transfers between stores" sub="One transfer = stock out of the source store and the same quantity into the destination." bodyClass=""
      action={perms.move ? <button className="btn btn-primary btn-sm" onClick={() => setAdding(true)}>Record transfer</button> : <Locked>Store Keeper</Locked>}>
      <DataTable
        dense
        rows={[...inv.state.transfers].sort((a, b) => b.at.localeCompare(a.at))}
        emptyText="No transfers recorded."
        columns={[
          { key: 'id', header: 'Transfer ref.', render: (t) => <><div className="cell-main">{t.id}</div><div className="cell-sub">{fmtStamp(t.at)}</div></> },
          { key: 'm', header: 'Material', render: (t) => materialOf(t.sku).name },
          { key: 'q', header: 'Quantity', align: 'num', render: (t) => fmtQty(t.qty, materialOf(t.sku).unit) },
          { key: 'f', header: 'From', render: (t) => storeOf(t.fromStoreId).name },
          { key: 't', header: 'To', render: (t) => storeOf(t.toStoreId).name },
          { key: 'by', header: 'Recorded / received by', render: (t) => <><div>{t.recordedBy}</div><div className="cell-sub">{t.receivedBy || '—'}</div></> },
          { key: 'r', header: 'Reason', render: (t) => <span className="cell-sub">{t.reason}</span> },
        ]}
      />
      {adding && <Drawer title="Record transfer" onClose={() => setAdding(false)}><TransferForm inv={inv} perms={perms} notify={notify} onDone={() => setAdding(false)} /></Drawer>}
    </Card>
  )
}

// ---------- Adjustments and damage ----------

function AdjustmentForm({ inv, perms, notify, onDone }) {
  const [f, setF] = useState({ storeId: 'SHA', sku: '', kind: 'Count correction', qty: '', reason: '' })
  const [touched, setTouched] = useState(false)
  const rows = inv.stock.filter((s) => s.storeId === f.storeId)
  const sku = rows.some((s) => s.sku === f.sku) ? f.sku : rows[0]?.sku || ''
  const form = { ...f, sku }
  const error = validateAdjustment(form, inv.stock)
  const row = findStock(inv.stock, sku, f.storeId)
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value })
  return (
    <form className="receipt-form" onSubmit={(e) => {
      e.preventDefault(); setTouched(true)
      if (error) return
      inv.actions.raiseAdjustment(form, perms.user)
      notify(`Demo: adjustment sent for review. Stock is unchanged until someone else approves it (not saved)`)
      onDone()
    }} noValidate>
      <div className="sub-panel-head"><b>Stock correction</b><span className="cell-sub">Never overwrites stock. Applied only after review by someone else.</span></div>
      <div className="receipt-grid">
        <label className="field">Store<select value={f.storeId} onChange={set('storeId')}>{STORES.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
        <label className="field">Material<select value={sku} onChange={set('sku')}>{rows.map((s) => <option key={s.sku} value={s.sku}>{s.material.name}</option>)}</select></label>
        <label className="field">Type<select value={f.kind} onChange={set('kind')}>{ADJ_KINDS.map((k) => <option key={k}>{k}</option>)}</select></label>
        <label className="field">Change ({row?.material.unit}; + adds, − removes)<input type="number" step={qtyStep(row?.material.unit)} value={f.qty} onChange={set('qty')} placeholder={f.kind === 'Damaged' ? 'e.g. -3' : 'e.g. -2 or 1'} /></label>
        <label className="field span-2">Reason (required)<input value={f.reason} onChange={set('reason')} placeholder="e.g. monthly count found 2 bags less than book stock" /></label>
      </div>
      {row && <p className="cell-sub">Book stock {fmtQty(row.onHand, row.material.unit)} · free for issue {fmtQty(row.availableForIssue, row.material.unit)}. A pending reduction is held back from issue until reviewed.</p>}
      <div className="sk-form-foot">
        <FormError error={error} show={touched} />
        <div className="jv-submit">
          <button className="btn btn-primary" type="submit">Send for review</button>
          <button className="btn" type="button" onClick={onDone}>Cancel</button>
        </div>
      </div>
    </form>
  )
}

function AdjustmentsPanel({ inv, perms, notify }) {
  const [adding, setAdding] = useState(false)
  const [reviewing, setReviewing] = useState(null) // { a, approve }
  const [note, setNote] = useState('')
  const action = (a) => {
    if (a.status !== 'Pending Review') return <span className="cell-sub">{a.reviewedBy ? `${a.status} by ${a.reviewedBy}` : ''}{a.reviewNote ? `: ${a.reviewNote}` : ''}</span>
    if (!perms.adjustApprove) return <Locked>Needs Admin review</Locked>
    if (a.raisedBy === perms.user.name) return <Locked>Raised by you. Needs another reviewer</Locked>
    return (
      <div className="cell-actions">
        <button className="btn btn-sm btn-primary" onClick={() => { setNote(''); setReviewing({ a, approve: true }) }}>Approve</button>
        <button className="btn btn-sm" onClick={() => { setNote(''); setReviewing({ a, approve: false }) }}>Reject</button>
      </div>
    )
  }
  const r = reviewing && findStock(inv.stock, reviewing.a.sku, reviewing.a.storeId)
  return (
    <Card title={<Term tip={GLOSSARY.adjustment}>Stock adjustments & damage</Term>} sub="Corrections and damaged stock are clearly recorded with a reason and reviewed; nothing is silently overwritten." bodyClass=""
      action={perms.adjustRequest ? <button className="btn btn-primary btn-sm" onClick={() => setAdding(true)}>Raise adjustment</button> : null}>
      <DataTable
        dense
        rows={[...inv.state.adjustments].sort((a, b) => b.at.localeCompare(a.at))}
        emptyText="No adjustments recorded."
        columns={[
          { key: 'id', header: 'Adjustment ref.', render: (a) => <><div className="cell-main">{a.id}</div><div className="cell-sub">{fmtStamp(a.at)}</div></> },
          { key: 'k', header: 'Type', render: (a) => <Badge tone={a.kind === 'Damaged' ? 'danger' : 'warning'}>{a.kind}</Badge> },
          { key: 'm', header: 'Material', render: (a) => <><div>{materialOf(a.sku).name}</div><div className="cell-sub">{storeOf(a.storeId).name}</div></> },
          { key: 'q', header: 'Change', align: 'num', render: (a) => <b className={a.qty < 0 ? 'down' : 'up'}>{a.qty > 0 ? '+' : ''}{fmtQty(a.qty, materialOf(a.sku).unit)}</b> },
          { key: 'r', header: 'Reason', render: (a) => <span className="wrap-cell">{a.reason}</span> },
          { key: 'by', header: 'Raised by', render: (a) => a.raisedBy },
          { key: 's', header: 'Review status', render: (a) => <Badge>{a.status}</Badge> },
          { key: 'x', header: 'Review', render: action },
        ]}
      />
      {adding && <Drawer title="Raise stock adjustment" onClose={() => setAdding(false)}><AdjustmentForm inv={inv} perms={perms} notify={notify} onDone={() => setAdding(false)} /></Drawer>}
      {reviewing && (
        <ConfirmDialog title={`${reviewing.approve ? 'Approve' : 'Reject'} ${reviewing.a.id}?`} confirmLabel={reviewing.approve ? 'Approve adjustment' : 'Reject adjustment'}
          confirmDisabled={!reviewing.approve && !note.trim()}
          onCancel={() => setReviewing(null)}
          onConfirm={() => {
            if (!inv.actions.reviewAdjustment(reviewing.a.id, reviewing.approve, note.trim(), perms.user)) { notify(`${reviewing.a.id} has already been reviewed.`); setReviewing(null); return }
            notify(`Demo: ${reviewing.a.id} ${reviewing.approve ? 'approved and applied to stock' : 'rejected; stock unchanged'} (not saved)`)
            setReviewing(null)
          }}>
          <p>{reviewing.a.kind}: {reviewing.a.qty > 0 ? '+' : ''}{reviewing.a.qty} {materialOf(reviewing.a.sku).unit} of {materialOf(reviewing.a.sku).name} at {storeOf(reviewing.a.storeId).name}. Reason: {reviewing.a.reason}</p>
          {reviewing.approve && r && <StockChange label="Stock on hand" before={r.onHand} after={round2(r.onHand + reviewing.a.qty)} unit={r.material.unit} />}
          <label className="field">{reviewing.approve ? 'Review note (optional)' : 'Reason for rejecting (required)'}<input value={note} onChange={(e) => setNote(e.target.value)} /></label>
        </ConfirmDialog>
      )}
    </Card>
  )
}

export default function ReturnsTransfers(props) {
  const [sub, setSub] = useState('returns')
  const s = props.inv.summary
  return (
    <>
      <Tabs label="Returns, transfers and adjustments" value={sub} onChange={setSub} tabs={[
        { id: 'returns', label: 'Returns from site', count: s.pendingReturns.length },
        { id: 'transfers', label: 'Transfers' },
        { id: 'adjustments', label: 'Adjustments & damage', count: s.pendingAdj.length },
      ]} />
      {sub === 'returns' && <ReturnsPanel {...props} />}
      {sub === 'transfers' && <TransfersPanel {...props} />}
      {sub === 'adjustments' && <AdjustmentsPanel {...props} />}
    </>
  )
}
