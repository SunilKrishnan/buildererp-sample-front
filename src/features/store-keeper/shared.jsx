import { useEffect, useRef, useState } from 'react'
import Icon from '../../components/Icon.jsx'
import { useDemoSession } from '../../auth/DemoSession.jsx'
import { can, PERMISSIONS as P } from '../../auth/demoRoles.js'
import { STORES } from '../../data/demo/inventoryDemo.js'
import { allowsDecimals, storeProjectLabel } from '../../services/inventory.js'
import { actorOf } from '../../services/procurement.js'
import { formatNumber } from '../../utils/format.js'

/** What the previewed role may do on the Store Keeper pages (demo rules, see auth/demoRoles.js). */
export function useStorePerms() {
  const { user, role } = useDemoSession()
  const has = (p) => can(role.id, p)
  return {
    user: { ...user, role: role.label }, role,
    actor: actorOf(user, role), // who is recorded in the audit trail
    receive: has(P.GOODS_RECEIVE),
    issue: has(P.MATERIAL_ISSUE),
    review: has(P.MATERIAL_REQUEST_REVIEW),
    approve: has(P.MATERIAL_REQUEST_APPROVE), // Project Manager only (simulated in this demo)
    move: has(P.STOCK_MOVE),
    locations: has(P.STOCK_LOCATIONS),
    materialMaster: has(P.MATERIAL_MASTER),
    adjustRequest: has(P.STOCK_ADJUST_REQUEST),
    adjustApprove: has(P.STOCK_ADJUST_APPROVE),
    discrepancyReview: has(P.DISCREPANCY_REVIEW),
    purchaseRequest: has(P.PURCHASE_REQUEST_RAISE),
    reviewRequisition: has(P.REQUISITION_REVIEW),
    approvePO: has(P.PO_APPROVE),
  }
}

/** Plain-language explanations for inventory terms (shown as tooltips) */
export const GLOSSARY = {
  onHand: 'Usable stock physically in the store. Excludes rejected, damaged and uninspected material.',
  reserved: 'Approved for a site request but not yet issued. Cannot be given to anyone else.',
  available: 'Free for a new issue = stock on hand − reserved − on hold.',
  onHold: 'Held back because a stock reduction (e.g. damage) is waiting for review.',
  reorder: 'When free stock reaches this level, the material should be re-ordered.',
  grn: 'Goods Receipt Note: the store record of a supplier delivery.',
  shortage: 'How far free stock is below what is needed.',
  suggested: 'Brings free stock up to twice the reorder level, after counting quantity already on order or awaiting inspection.',
  adjustment: 'A correction to book stock (count difference, damage). Needs a reason and review by someone else.',
  onOrder: 'Ordered on a purchase order but not yet delivered.',
}

export function Term({ tip, children }) {
  return <span className="term" title={tip} tabIndex={0} aria-label={`${typeof children === 'string' ? children : ''}: ${tip}`}>{children}<sup aria-hidden="true">?</sup></span>
}

export const fmtQty = (n, unit) => (n == null ? '—' : `${formatNumber(n)}${unit ? ` ${unit}` : ''}`)
export const qtyStep = (unit) => (allowsDecimals(unit) ? '0.01' : '1')
export const fmtStamp = (s) => {
  if (!s) return '—'
  const d = new Date(s)
  return `${d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}, ${s.slice(11, 16)}`
}

export const storeOptions = STORES.map((s) => ({ id: s.id, label: `${s.name}`, sub: storeProjectLabel(s) }))

export function Locked({ children }) {
  return <span className="locked-note"><Icon name="lock" size={12} />{children}</span>
}

export function FormError({ error, show = true }) {
  if (!error || !show) return null
  return <div className="form-error" role="alert"><Icon name="alert" size={14} />{error}</div>
}

/** Calls the latest `handler` on Escape (registered once, so re-renders don't re-run focus logic). */
function useEscape(handler, when = () => true) {
  const ref = useRef(handler)
  ref.current = handler
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape' && when()) ref.current() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
}

/** Side panel for forms and record details (reuses the existing drawer styles). */
export function Drawer({ title, sub, onClose, children, foot, wide }) {
  const closeRef = useRef(null)
  useEscape(onClose, () => !document.querySelector('.sk-confirm')) // a confirm dialog on top closes first
  useEffect(() => { closeRef.current?.focus() }, [])
  return (
    <div className="drawer-scrim" onClick={onClose}>
      <aside className={`drawer ${wide ? 'drawer-wide' : ''}`} role="dialog" aria-modal="true" aria-labelledby="sk-drawer-title" onClick={(e) => e.stopPropagation()}>
        <div className="drawer-head">
          <div>
            <h2 id="sk-drawer-title">{title}</h2>
            {sub && <div className="cell-sub">{sub}</div>}
          </div>
          <button ref={closeRef} className="icon-btn" onClick={onClose} aria-label="Close"><Icon name="x" /></button>
        </div>
        <div className="drawer-body">{children}</div>
        <div className="drawer-foot">
          {foot || <span className="cell-sub">Demo: changes show on screen for this session only. Nothing is saved or sent.</span>}
        </div>
      </aside>
    </div>
  )
}

/**
 * Confirmation before any action that changes records. The confirm button works once:
 * it is disabled after the first click so a double click cannot record the action twice.
 */
export function ConfirmDialog({ title, children, confirmLabel = 'Confirm', onConfirm, onCancel, confirmDisabled = false }) {
  const okRef = useRef(null)
  const cardRef = useRef(null)
  const firedRef = useRef(false)
  const [busy, setBusy] = useState(false)
  const confirm = () => {
    if (firedRef.current) return
    firedRef.current = true
    setBusy(true)
    // A refused action (validation) re-enables the button so the user can correct and retry
    if (onConfirm() === false) { firedRef.current = false; setBusy(false) }
  }
  useEscape(onCancel)
  // Focus once on open: the first field if the dialog has one, otherwise the confirm button
  useEffect(() => { (cardRef.current?.querySelector('input') || okRef.current)?.focus() }, [])
  return (
    <div className="modal sk-confirm" onClick={onCancel}>
      <div ref={cardRef} className="modal-card" role="alertdialog" aria-modal="true" aria-labelledby="sk-confirm-title" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head"><h3 id="sk-confirm-title">{title}</h3></div>
        <div className="sk-confirm-body">
          {children}
          <p className="cell-sub">Demo: this changes the on-screen records for this session only.</p>
          <div className="modal-foot">
            <button className="btn" type="button" onClick={onCancel}>Cancel</button>
            <button ref={okRef} className="btn btn-primary" type="button" onClick={confirm} disabled={confirmDisabled || busy}>{busy ? 'Saving…' : confirmLabel}</button>
          </div>
        </div>
      </div>
    </div>
  )
}

/** Marks a control that stands in for a role with no login in this demo. */
export function SimNote({ children }) {
  return <div className="info-note sim-note"><span aria-hidden="true">⚙</span><div><b>Demo simulation.</b> {children}</div></div>
}

/** Request history (who did what, when) */
export function HistoryList({ items }) {
  if (!items?.length) return null
  return (
    <ol className="audit-list">
      {items.map((h, i) => (
        <li key={i}>
          <span className="cell-sub">{fmtStamp(h.at)}</span> <b>{h.action}</b> · {h.by}{h.role ? ` (${h.role})` : ''}
          {h.from && h.to && h.from !== h.to ? <div className="cell-sub">Status: {h.from} → <b>{h.to}</b></div> : null}
          {h.note ? <div className="cell-sub">{h.note}</div> : null}
        </li>
      ))}
    </ol>
  )
}

/** "Before → after" stock line used in confirmations */
export function StockChange({ label, before, after, unit }) {
  return (
    <div className="stock-change">
      <span>{label}</span>
      <b>{fmtQty(before, unit)}</b><span aria-hidden="true">→</span><b className={after < before ? 'down' : after > before ? 'up' : ''}>{fmtQty(after, unit)}</b>
    </div>
  )
}

/** Download rows as a CSV file in the browser (nothing leaves the device). */
export function downloadCsv(filename, columns, rows) {
  const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`
  const text = [columns.map((c) => esc(c.header)).join(','), ...rows.map((r) => columns.map((c) => esc(c.csv ? c.csv(r) : r[c.key])).join(','))].join('\n')
  const url = URL.createObjectURL(new Blob([text], { type: 'text/csv;charset=utf-8' }))
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
