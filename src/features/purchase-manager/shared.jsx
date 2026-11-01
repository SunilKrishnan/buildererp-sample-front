import { useState } from 'react'
import { useDemoSession } from '../../auth/DemoSession.jsx'
import { can, PERMISSIONS as P } from '../../auth/demoRoles.js'
import { actorOf } from '../../services/procurement.js'
import { formatINR } from '../../utils/format.js'

/** What the previewed role may do on the purchasing pages (demo rules, see auth/demoRoles.js). */
export function usePurchasePerms() {
  const { user, role } = useDemoSession()
  const has = (p) => can(role.id, p)
  return {
    user, role, actor: actorOf(user, role),
    manage: has(P.PROCUREMENT_MANAGE), // requisitions, quotations, POs, follow-up
    suppliers: has(P.SUPPLIER_MANAGE),
    viewSuppliers: has(P.SUPPLIER_VIEW) || has(P.SUPPLIER_MANAGE),
    approvePO: has(P.PO_APPROVE), // Admin: POs above the Purchase Manager's limit
    reviewRequisition: has(P.REQUISITION_REVIEW), // Admin: requisitions above the review limit
  }
}

/**
 * Run a guarded workflow action from the inventory context and report the result.
 * Returns true when the action was applied; the error is kept for display.
 */
// Row buttons that replace each other in the same place: after "Submit" the PO row shows "Send to
// supplier" where the click landed, so a double click would run both steps. A second of these on
// the same PO within this window is ignored.
const ROW_STEPS = ['submitPurchaseOrder', 'sendPurchaseOrder']
const lastRowStepAt = {}
const ACT_GAP_MS = 600

export function useAct(inv, perms, notify) {
  const [error, setError] = useState('')
  const act = (name, args) => {
    const rowStep = ROW_STEPS.includes(name)
    if (rowStep && Date.now() - (lastRowStepAt[args?.id] || 0) < ACT_GAP_MS) return false
    const r = inv.actions[name](args, perms.actor)
    if (!r.ok) { setError(r.error); return false }
    if (rowStep) lastRowStepAt[args.id] = Date.now()
    setError('')
    notify(`Demo: ${r.message}. Temporary, resets on reload`)
    return true
  }
  return { act, error, setError }
}

export const money = (n) => formatINR(Math.round(n || 0))

/** Priority / required date for requisitions that predate those fields. */
export function requisitionMeta(pr, inv) {
  const req = pr.requestRef ? inv.requests.find((r) => r.id === pr.requestRef) : null
  // Still owed to the site on the originating request (approved − issued), from the shared request record
  const outstanding = req && req.approved != null ? Math.max(0, req.approved - req.issued) : null
  const row = inv.stock.find((s) => s.sku === pr.sku && s.storeId === pr.storeId)
  return {
    req, row, outstanding, site: req?.site || null,
    priority: pr.priority || req?.priority || (row?.status === 'Out of Stock' ? 'High' : 'Normal'),
    requiredBy: pr.requiredBy || req?.requiredBy || null,
  }
}

export const STARS = (n) => '★★★★★'.slice(0, n) + '☆☆☆☆☆'.slice(0, 5 - n)
