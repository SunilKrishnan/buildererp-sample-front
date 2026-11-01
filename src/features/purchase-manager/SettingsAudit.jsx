import { useState } from 'react'
import DataTable from '../../components/DataTable.jsx'
import { Card } from '../../components/UI.jsx'
import { PERMISSIONS as P, ROLE_IDS, ROLES, can } from '../../auth/demoRoles.js'
import { REQUISITION_ADMIN_REVIEW_ABOVE, SUPPLIER_PAYMENT_APPROVER } from '../../data/demo/procurementDemo.js'
import { nextId } from '../../services/inventory.js'
import { POLICY } from '../../services/procurement.js'
import { downloadCsv, fmtStamp } from '../store-keeper/shared.jsx'
import { money } from './shared.jsx'

const PERM_ROWS = [
  [P.PURCHASE_REQUEST_RAISE, 'Raise purchase requisitions'],
  [P.REQUISITION_REVIEW, `Review requisitions above ${money(REQUISITION_ADMIN_REVIEW_ABOVE)}`],
  [P.PROCUREMENT_MANAGE, 'Quotations, supplier selection, POs, delivery follow-up'],
  [P.SUPPLIER_MANAGE, 'Add / edit suppliers'],
  [P.SUPPLIER_VIEW, 'View suppliers'],
  [P.PO_APPROVE, `Approve POs above ${money(POLICY.PO_PM_APPROVAL_LIMIT)}`],
  [P.GOODS_RECEIVE, 'Receive and inspect deliveries (GRN)'],
  [P.EXPENSE_VERIFY, 'Verify supplier invoices'],
  [P.SUPPLIER_PAYMENT_RELEASE, 'Release supplier payments'],
  [P.PAYMENT_RECORD, 'Record payments'],
]

/** Every recorded change: the session audit trail plus each record's own history. */
function timeline(state) {
  const fromHistory = (kind, list) => list.flatMap((r) => (r.history || []).map((h, i) => ({ key: `${r.id}-${i}`, ref: r.id, kind, ...h })))
  const audit = (state.audit || []).map((a) => ({ key: a.id, kind: 'Session action', ...a }))
  const seen = new Set(audit.map((a) => `${a.ref}|${a.at}`))
  return [
    ...fromHistory('Requisition', state.purchaseRequests),
    ...fromHistory('Purchase order', state.purchaseOrders),
    ...fromHistory('Supplier', state.suppliers),
    ...audit.filter((a) => !a.ref?.match(/^(PR|PO|SUP)-/) || !seen.has(`${a.ref}|${a.at}`)),
  ].filter((e, i, all) => all.findIndex((x) => x.ref === e.ref && x.at === e.at && x.action === e.action) === i)
    .sort((a, b) => (b.at || '').localeCompare(a.at || ''))
}

export default function SettingsAudit({ inv }) {
  const [q, setQ] = useState('')
  const [kind, setKind] = useState('all')
  const s = inv.state
  const numbering = [
    { key: 'pr', record: 'Purchase requisition', prefix: 'PR-', next: nextId(s.purchaseRequests, 'PR-') },
    { key: 'qt', record: 'Quotation', prefix: 'QT-', next: nextId(s.purchaseRequests.flatMap((r) => r.quotes || []), 'QT-') },
    { key: 'po', record: 'Purchase order', prefix: 'PO-', next: nextId(s.purchaseOrders, 'PO-') },
    { key: 'sup', record: 'Supplier', prefix: 'SUP-', next: nextId(s.suppliers, 'SUP-').replace(/SUP-(\d+)$/, (_, n) => `SUP-${n.padStart(3, '0')}`) },
    { key: 'grn', record: 'Goods receipt (Store Keeper)', prefix: 'GRN-', next: nextId(s.receipts, 'GRN-') },
  ]
  const text = q.trim().toLowerCase()
  const events = timeline(s)
    .filter((e) => kind === 'all' || e.kind === kind)
    .filter((e) => !text || `${e.ref} ${e.by} ${e.action} ${e.note || ''}`.toLowerCase().includes(text))
  const auditCols = [
    { key: 'at', header: 'When', render: (e) => fmtStamp(e.at), csv: (e) => e.at },
    { key: 'ref', header: 'Record', render: (e) => <><div className="cell-main">{e.ref}</div><div className="cell-sub">{e.kind}</div></> },
    { key: 'action', header: 'Action' },
    { key: 'by', header: 'By', render: (e) => <>{e.by}{e.role && <div className="cell-sub">{e.role}</div>}</> },
    { key: 'note', header: 'Note', render: (e) => <span className="cell-sub wrap-cell">{e.note || '—'}</span> },
  ]

  return (
    <>
      <div className="grid halves">
        <Card title="Numbering & configuration" sub="Demo configuration. In the backend phase these are set by Admin and numbers are issued by the server." bodyClass="">
          <DataTable rowKey="key" rows={numbering} columns={[
            { key: 'record', header: 'Record' }, { key: 'prefix', header: 'Prefix' }, { key: 'next', header: 'Next number' },
          ]} />
        </Card>
        <Card title="Approval limits" sub="Company policy (demo values)">
          <dl className="details">
            <dt>PO approval</dt><dd>Up to {money(POLICY.PO_PM_APPROVAL_LIMIT)} goods value: approved by the Purchase Manager on submission. Above it: Admin.</dd>
            <dt>Requisition review</dt><dd>Estimated above {money(REQUISITION_ADMIN_REVIEW_ABOVE)}: Admin reviews before quotations.</dd>
            <dt>Supplier selection</dt><dd>At least two quotations; a written reason when not choosing the lowest landed cost.</dd>
            <dt>Supplier payments</dt><dd>Verified by Accounts, released by {SUPPLIER_PAYMENT_APPROVER}. Not done by the Purchase Manager.</dd>
            <dt>Segregation</dt><dd>Nobody approves a PO they raised.</dd>
          </dl>
        </Card>
      </div>

      <Card title="Role permissions (purchasing)" sub="From the existing role set. Preview another role with “Preview as” in the top bar." bodyClass="" className="section-gap">
        <div className="table-wrap dense">
          <table>
            <thead><tr><th>Permission</th>{ROLE_IDS.map((id) => <th key={id}>{ROLES[id].label}</th>)}</tr></thead>
            <tbody>
              {PERM_ROWS.map(([perm, label]) => (
                <tr key={perm}><td>{label}</td>{ROLE_IDS.map((id) => <td key={id} className={can(id, perm) ? 'up' : 'cell-sub'}>{can(id, perm) ? '✓' : '—'}</td>)}</tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card title="Audit history" sub="Who created, edited, approved, rejected or sent each record. Session changes reset on reload." bodyClass="" className="section-gap"
        action={<button className="btn btn-sm" onClick={() => downloadCsv('purchase-audit-demo.csv', auditCols, events)}>Export CSV</button>}>
        <div className="toolbar">
          <div className="filters">
            <label className="field field-search">Search<input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="PO-2316, Deepak, approved…" /></label>
            <label className="field">Record type
              <select value={kind} onChange={(e) => setKind(e.target.value)}>{['all', 'Requisition', 'Purchase order', 'Supplier', 'Session action'].map((k) => <option key={k} value={k}>{k === 'all' ? 'All' : k}</option>)}</select>
            </label>
          </div>
        </div>
        <DataTable dense rowKey="key" rows={events} columns={auditCols} limit={200} emptyText="No history matches." />
      </Card>
    </>
  )
}
