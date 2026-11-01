import { useState } from 'react'
import DataTable from '../../components/DataTable.jsx'
import { Badge, Card } from '../../components/UI.jsx'
import { projects } from '../../data/mockData.js'
import { PROJECT_MANAGERS, SITES, STORES } from '../../data/demo/inventoryDemo.js'
import {
  ACTIVE_REQUEST_STATUSES, findStock, issuableFor, issuedByRequest, ISSUABLE_REQUEST_STATUSES, MR, REQUEST_STATUSES, round2, storeProjectLabel, validateIssue,
} from '../../services/inventory.js'
import { estimateOf, POLICY } from '../../services/procurement.js'
import { formatDate, formatINR } from '../../utils/format.js'
import { ConfirmDialog, Drawer, fmtQty, fmtStamp, FormError, GLOSSARY, HistoryList, Locked, qtyStep, StockChange, Term } from './shared.jsx'

// Drafts are the requester's own; the store never sees them
const STORE_STATUSES = REQUEST_STATUSES.filter((s) => s !== MR.DRAFT)

/** Issue approved material against a request. Stock decreases only on confirmation. */
export function IssueDrawer({ req, inv, perms, notify, onClose }) {
  const issued = issuedByRequest(inv.state.issues)
  const { remaining, free, max } = issuableFor(req, inv.stock, issued)
  const row = findStock(inv.stock, req.sku, req.storeId)
  const unit = req.material.unit
  const [f, setF] = useState({ qty: String(max), receivedBy: req.site?.supervisor || '', notes: '' })
  const [touched, setTouched] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const error = validateIssue(f, req, inv.stock, inv.state.issues)
  const qty = Number(f.qty) || 0

  return (
    <Drawer title={`Issue material · ${req.id}`} sub={`${req.material.name} to ${req.site?.name}`} onClose={onClose}>
      <dl className="details">
        <dt>Requested by</dt><dd>{req.requestedBy}</dd>
        <dt>Approved by</dt><dd>{req.approvedBy || '—'}</dd>
        <dt>Requested / approved</dt><dd>{fmtQty(req.requested, unit)} / {fmtQty(req.approved, unit)}</dd>
        <dt>Already issued</dt><dd>{fmtQty(issued[req.id] || 0, unit)}</dd>
        <dt>Issue from</dt><dd>{req.store.name}</dd>
        <dt>Stock on hand</dt><dd>{fmtQty(row?.onHand || 0, unit)}</dd>
        <dt><Term tip={GLOSSARY.reserved}>Reserved</Term></dt><dd>{fmtQty(row?.reserved || 0, unit)} (of which {fmtQty(remaining, unit)} for this request){row?.onHold ? ` · ${fmtQty(row.onHold, unit)} on hold` : ''}</dd>
        <dt>Can issue now</dt><dd><b>{fmtQty(max, unit)}</b>{free < remaining && <span className="down"> · short by {fmtQty(round2(remaining - free), unit)}</span>}</dd>
      </dl>

      {max <= 0 ? (
        <div className="info-note warn sk-inline-note" style={{ marginTop: 14 }}><span>⚠</span><div>Nothing can be issued: stock is reserved for other requests or on hold. Forward the shortage to the Purchase Manager from the request list.</div></div>
      ) : (
        <form className="receipt-form" style={{ marginTop: 16 }} onSubmit={(e) => { e.preventDefault(); setTouched(true); if (!error) setConfirming(true) }} noValidate>
          <div className="sub-panel-head"><b>Material issue</b><span className="cell-sub">Reference assigned on confirmation · issued by {perms.user.name}</span></div>
          <div className="receipt-grid">
            <label className="field">Issue quantity ({unit})<input type="number" min="0" max={max} step={qtyStep(unit)} value={f.qty} onChange={(e) => setF({ ...f, qty: e.target.value })} /></label>
            <label className="field">Received by (at site)<input value={f.receivedBy} onChange={(e) => setF({ ...f, receivedBy: e.target.value })} /></label>
            <label className="field span-2">Notes<input value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} placeholder="Optional, e.g. vehicle no., gate pass" /></label>
          </div>
          <div className="sk-form-foot">
            <FormError error={error} show={touched || qty > max} />
            <div className="jv-submit">
              <button className="btn btn-primary" type="submit">Review & confirm issue</button>
              <button className="btn" type="button" onClick={onClose}>Cancel</button>
            </div>
          </div>
        </form>
      )}

      {confirming && (
        <ConfirmDialog title={`Issue ${fmtQty(qty, unit)} of ${req.material.name}?`} confirmLabel="Confirm issue" onCancel={() => setConfirming(false)}
          onConfirm={() => {
            if (!inv.actions.issueMaterial(req, f, perms.user)) { notify(`Not issued: ${req.id} has changed (already issued or stock no longer free). Check the request.`); onClose(); return }
            notify(`Demo: ${fmtQty(qty, unit)} issued to ${req.site?.name} against ${req.id} (not saved)`)
            onClose()
          }}>
          <StockChange label="Stock on hand" before={row.onHand} after={round2(row.onHand - qty)} unit={unit} />
          <StockChange label="Reserved" before={row.reserved} after={round2(row.reserved - qty)} unit={unit} />
          <StockChange label="Free for issue" before={row.availableForIssue} after={row.availableForIssue} unit={unit} />
          <p className="cell-sub">Received by {f.receivedBy} at {req.site?.name}.</p>
        </ConfirmDialog>
      )}
    </Drawer>
  )
}

export default function Requests({ inv, perms, notify, search }) {
  const [status, setStatus] = useState('open')
  const [project, setProject] = useState('all')
  const [panel, setPanel] = useState(null) // { kind: 'issue' | 'decide' | 'new' | 'view', id }
  const [confirm, setConfirm] = useState(null) // { kind: 'check' | 'shortage', req }
  const q = (search || '').toLowerCase()

  const rows = inv.requests
    .filter((r) => r.status !== MR.DRAFT)
    .filter((r) => status === 'all' || (status === 'open' ? ACTIVE_REQUEST_STATUSES.includes(r.status) : status === 'action' ? r.status === MR.SUBMITTED || ISSUABLE_REQUEST_STATUSES.includes(r.status) : r.status === status))
    .filter((r) => project === 'all' || r.site?.projectId === project)
    .filter((r) => !q || `${r.id} ${r.material.name} ${r.requestedBy} ${r.site?.name}`.toLowerCase().includes(q))
    .sort((a, b) => b.at.localeCompare(a.at))
  const current = panel && inv.requests.find((r) => r.id === panel.id)
  const toCheck = inv.requests.filter((r) => r.status === MR.SUBMITTED).length
  const toIssue = inv.requests.filter((r) => ISSUABLE_REQUEST_STATUSES.includes(r.status) && r.need - r.shortage > 0).length

  const action = (r) => {
    const out = []
    if (r.status === MR.SUBMITTED) {
      out.push(perms.review
        ? <button key="c" className="btn btn-sm btn-primary" onClick={() => setConfirm({ kind: 'check', req: r })}>Check stock & send to PM</button>
        : <Locked key="c">Store Keeper checks stock</Locked>)
    }
    // Issue and purchasing wait for the Project Manager's approval
    if ([MR.PM_REVIEW, MR.RETURNED].includes(r.status)) {
      out.push(<span key="a" className="cell-sub">{r.status === MR.RETURNED ? 'Returned to the requester for clarification' : `With ${PROJECT_MANAGERS[r.site?.projectId] || 'the Project Manager'} (PM)`}</span>)
      out.push(<Locked key="l">No issue until approved</Locked>)
    }
    if (ISSUABLE_REQUEST_STATUSES.includes(r.status)) {
      const can = r.need - r.shortage > 0
      out.push(perms.issue
        ? <button key="i" className={`btn btn-sm ${can ? 'btn-primary' : ''}`} disabled={!can} title={can ? '' : 'No free stock to issue yet'} onClick={() => setPanel({ kind: 'issue', id: r.id })}>{r.shortage > 0 && can ? 'Issue available' : 'Issue'}</button>
        : <Locked key="i">Issued by the Store Keeper</Locked>)
    }
    // A shortage is forwarded only after Project Manager approval, and never turns into a PO by itself
    if (r.shortage > 0 && ISSUABLE_REQUEST_STATUSES.includes(r.status)) {
      out.push(r.forwarded
        ? <span key="s" className="cell-sub">Shortage sent as {r.forwarded.id}{r.forwarded.poId ? ` → ${r.forwarded.poId}` : ''}</span>
        : perms.purchaseRequest
          ? <button key="s" className="btn btn-sm" onClick={() => setConfirm({ kind: 'shortage', req: r })}>Forward shortage</button>
          : null)
    }
    out.push(<button key="h" className="link-btn" onClick={() => setPanel({ kind: 'view', id: r.id })}>History</button>)
    if ([MR.REJECTED, MR.CANCELLED, MR.CLOSED].includes(r.status) && r.reason) out.push(<span key="r" className="cell-sub">{r.reason}</span>)
    return <div className="cell-actions">{out}</div>
  }

  return (
    <>
      {(toCheck > 0 || toIssue > 0) && <div className="info-note"><span>ℹ</span><div>{toCheck > 0 && <><b>{toCheck} new request{toCheck > 1 ? 's' : ''} to check.</b> Record usable stock and send to the Project Manager. </>}{toIssue > 0 && <><b>{toIssue} approved request{toIssue > 1 ? 's' : ''} can be issued.</b> </>}Stock reduces only when you confirm an issue.</div></div>}
      <Card title="Material Requests" sub="Site Engineer request → Store Keeper checks usable stock → Project Manager reviews (always) → Store Keeper issues, or forwards the shortage to the Purchase Manager as a linked requisition." bodyClass=""
        action={<span className="cell-sub">Raised by Site Engineers from their dashboard</span>}>
        <div className="toolbar">
          <div className="filters">
            <label className="field">Status
              <select value={status} onChange={(e) => setStatus(e.target.value)}>
                <option value="open">Open (not yet fully issued)</option>
                <option value="action">Needs store action</option>
                <option value="all">All requests</option>
                {STORE_STATUSES.map((s) => <option key={s}>{s}</option>)}
              </select>
            </label>
            <label className="field">Project
              <select value={project} onChange={(e) => setProject(e.target.value)}>
                <option value="all">All projects</option>
                {projects.map((p) => <option key={p.id} value={p.id}>{p.short}</option>)}
              </select>
            </label>
          </div>
        </div>
        <DataTable
          dense
          rows={rows}
          emptyText="No material requests match these filters."
          columns={[
            { key: 'id', header: 'Request no.', render: (r) => <><button className="link-btn" onClick={() => setPanel({ kind: 'view', id: r.id })}>{r.id}</button><div className="cell-sub">{fmtStamp(r.at)}</div></> },
            { key: 'by', header: 'Requested by', render: (r) => <><div>{r.requestedBy}</div><div className="cell-sub">Needed by {formatDate(r.requiredBy)}</div></> },
            { key: 'site', header: 'Project / site', render: (r) => <><div>{r.site?.name}</div><div className="cell-sub">From {r.store.name}</div></> },
            { key: 'm', header: 'Material', render: (r) => <><div>{r.material.name}</div><div className="cell-sub wrap-cell">{r.purpose}</div></> },
            { key: 'q', header: 'Requested', align: 'num', render: (r) => <>{fmtQty(r.requested, r.material.unit)}{r.supplementTo && <div className="cell-sub">additional to {r.supplementTo}</div>}</> },
            { key: 'ap', header: 'Approved', align: 'num', render: (r) => fmtQty(r.approved) },
            { key: 'is', header: 'Issued', align: 'num', render: (r) => fmtQty(r.issued) },
            { key: 'rem', header: 'Remaining', align: 'num', render: (r) => (r.approved != null ? <b>{fmtQty(Math.max(0, r.approved - r.issued))}</b> : '—') },
            { key: 'av', header: <Term tip={GLOSSARY.available}>Available</Term>, align: 'num', render: (r) => <>{fmtQty(r.available)}{r.shortage > 0 && <div className="cell-sub down">short {fmtQty(r.shortage)}</div>}</> },
            { key: 'p', header: 'Priority', render: (r) => <Badge>{r.priority}</Badge> },
            { key: 's', header: 'Review status', render: (r) => <><Badge>{r.status}</Badge>{r.checkedBy && <div className="cell-sub">checked by {r.checkedBy}</div>}{r.forwarded && <div className="cell-sub">{r.forwarded.id}{r.forwarded.poId ? ` → ${r.forwarded.poId}` : ''}</div>}</> },
            { key: 'x', header: 'Action', render: action },
          ]}
        />
      </Card>

      {confirm?.kind === 'check' && (() => {
        const r = confirm.req
        return (
          <ConfirmDialog title={`Send ${r.id} to the Project Manager?`} confirmLabel="Record check & send for PM review" onCancel={() => setConfirm(null)}
            onConfirm={() => {
              const res = inv.actions.checkRequest(r.id, '', perms.actor)
              if (!res.ok) { notify(res.error); setConfirm(null); return }
              notify(`Demo: ${res.message}. No message was sent`)
              setConfirm(null)
            }}>
            <p>{r.requestedBy} requests <b>{fmtQty(r.requested, r.material.unit)}</b> of {r.material.name} for {r.site?.name}, from {r.store.name}.</p>
            <p>Usable stock free for issue: <b>{fmtQty(r.available, r.material.unit)}</b>{r.shortage > 0 ? <span className="down"> · short by {fmtQty(r.shortage, r.material.unit)}</span> : ' · enough stock'}</p>
            <p className="cell-sub">Every request goes to the Project Manager whatever the stock. Nothing is reserved until the PM approves; stock reduces only when you confirm an issue. A shortage is forwarded for purchase only after approval, and never as a purchase order.</p>
          </ConfirmDialog>
        )
      })()}
      {confirm?.kind === 'shortage' && (() => {
        const r = confirm.req
        return (
          <ConfirmDialog title="Forward shortage to the Purchase Manager?" confirmLabel="Create material requisition" onCancel={() => setConfirm(null)}
            onConfirm={() => {
              const res = inv.actions.raiseRequisition({ sku: r.sku, storeId: r.storeId, qty: r.shortage, reason: `Shortage against ${r.id} (${r.site?.name})`, requestRef: r.id }, perms.actor)
              if (!res.ok) { notify(res.error); setConfirm(null); return }
              notify(`Demo: ${res.message}. No order placed, nothing sent`)
              setConfirm(null)
            }}>
            <p>Creates a <b>material requisition</b> for {fmtQty(r.shortage, r.material.unit)} of {r.material.name} for {storeProjectLabel(r.store)}.</p>
            <p>Estimated value {formatINR(estimateOf(r.sku, r.shortage))}{estimateOf(r.sku, r.shortage) > POLICY.REQUISITION_ADMIN_REVIEW_ABOVE ? ': above the review limit, so Admin reviews it first.' : '.'}</p>
            <p className="cell-sub">It does not place a supplier order or create a payment. The Purchase Manager obtains quotations and raises the purchase order; POs up to {formatINR(POLICY.PO_PM_APPROVAL_LIMIT)} are approved by the Purchase Manager, above that by Admin.</p>
          </ConfirmDialog>
        )
      })()}

      {current && panel.kind === 'issue' && <IssueDrawer req={current} inv={inv} perms={perms} notify={notify} onClose={() => setPanel(null)} />}
      {current && panel.kind === 'view' && (
        <Drawer title={`Request ${current.id}`} sub={`${current.material.name} for ${current.site?.name}`} onClose={() => setPanel(null)}>
          <dl className="details">
            <dt>Status</dt><dd><Badge>{current.status}</Badge></dd>
            <dt>Requested by</dt><dd>{current.requestedBy}</dd>
            <dt>Requested / approved</dt><dd>{fmtQty(current.requested, current.material.unit)} / {fmtQty(current.approved, current.material.unit)}</dd>
            <dt>Issued</dt><dd>{fmtQty(current.issued, current.material.unit)}</dd>
            <dt>Decided by</dt><dd>{current.approvedBy || current.reviewedBy || '—'}{current.reason ? ` · ${current.reason}` : ''}</dd>
            <dt>Stock check</dt><dd>{current.checkedBy ? `${current.checkedBy}: ${current.checkNote || 'checked'}` : current.status === MR.SUBMITTED ? 'Waiting for the store' : '—'}</dd>
            <dt>Linked records</dt><dd>{[...inv.state.issues.filter((i) => i.requestId === current.id).map((i) => `${i.id} (${i.qty}, ${i.at.slice(0, 10)}, ${i.issuedBy} → ${i.receivedBy})`), ...inv.state.purchaseRequests.filter((p) => p.requestRef === current.id).map((p) => `${p.id} (${p.status})${p.poId ? ` → ${p.poId}` : ''}${p.poId ? inv.state.receipts.filter((g) => g.po === p.poId).map((g) => ` → ${g.id}`).join('') : ''}`)].join(' · ') || '—'}</dd>
            <dt>Shortage forwarded</dt><dd>{current.forwarded ? `${current.forwarded.id} (${current.forwarded.status})${current.forwarded.poId ? ` → ${current.forwarded.poId}` : ''}` : '—'}</dd>
          </dl>
          <div className="sub-panel-head" style={{ marginTop: 14 }}><b>History</b></div>
          {current.history?.length ? <HistoryList items={current.history} /> : <p className="cell-sub">Earlier demo record: history before this session is summarised in the fields above.</p>}
        </Drawer>
      )}
    </>
  )
}
