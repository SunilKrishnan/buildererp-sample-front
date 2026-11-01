import { useState } from 'react'
import DataTable from '../../components/DataTable.jsx'
import { Badge, Card } from '../../components/UI.jsx'
import { formatDate } from '../../utils/format.js'
import { fmtQty } from '../store-keeper/shared.jsx'
import { money } from './shared.jsx'

/**
 * Coordination view only. Accounts verifies bills, posts the accounts and records payments;
 * the Purchase Manager sees the status and makes sure PO / GRN / invoice references line up.
 */
export default function Bills({ inv, search }) {
  const [show, setShow] = useState('open')
  const q = (search || '').toLowerCase()
  const bills = inv.supplierBills
    .filter((b) => show === 'all' || b.paymentStatus !== 'Paid')
    .filter((b) => !q || `${b.id} ${b.invoiceNo} ${b.supplier} ${b.poId}`.toLowerCase().includes(q))
    .sort((a, b) => b.invoiceDate.localeCompare(a.invoiceDate))
  const withTerms = inv.poViews.filter((p) => p.advancePct || p.advances.length)

  return (
    <>
      <div className="info-note">
        <span>ℹ</span>
        <div>View only. <b>Accounts</b> verifies supplier bills against the PO and the Store Keeper&apos;s GRN, posts the entries and records payments; Admin releases payments.
          Use this page to follow up mismatches with suppliers and to make sure every invoice carries the right PO and GRN reference.</div>
      </div>

      <Card title="Supplier invoices against purchase orders" sub="Three-way match: PO (ordered) × GRN (accepted at store) × invoice (billed)" bodyClass=""
        action={<label className="field inline">Show<select value={show} onChange={(e) => setShow(e.target.value)}><option value="open">Unpaid</option><option value="all">All</option></select></label>}>
        <DataTable
          dense
          rows={bills}
          emptyText="No supplier invoices match."
          columns={[
            { key: 'id', header: 'Invoice', render: (b) => <><div className="cell-main">{b.invoiceNo}</div><div className="cell-sub">{b.id} · {formatDate(b.invoiceDate)}</div></> },
            { key: 's', header: 'Supplier', render: (b) => b.supplier },
            { key: 'refs', header: 'PO / GRN', render: (b) => <><div>{b.poId}</div><div className="cell-sub wrap-cell">{b.grnId}</div></> },
            { key: 'q', header: 'Billed / accepted', align: 'num', render: (b) => <>{fmtQty(b.invoicedQty)} / {fmtQty(b.acceptedQty, b.unit)}{b.rejectedQty > 0 && <div className="cell-sub down">{b.rejectedQty} rejected</div>}</> },
            { key: 'a', header: 'Invoice amount', align: 'num', render: (b) => money(b.amount) },
            { key: 'm', header: 'Match', render: (b) => <><Badge tone={b.matchStatus === 'Matched' ? 'success' : b.matchStatus === 'Awaiting inspection' ? 'warning' : 'danger'}>{b.matchStatus}</Badge>{b.matchIssues.length > 0 && <div className="cell-sub wrap-cell">{b.matchIssues[0]}</div>}</> },
            { key: 'v', header: 'Verification', render: (b) => <><Badge>{b.verification}</Badge>{b.debitNote && <div className="cell-sub">Debit note {money(b.debitNote.amount)}</div>}</> },
            { key: 'p', header: 'Payment', render: (b) => <><Badge>{b.paymentStatus}</Badge><div className="cell-sub">due {formatDate(b.dueDate)}</div></> },
            { key: 'bal', header: 'Balance', align: 'num', render: (b) => <>{money(b.balance)}{b.advanceAdjusted > 0 && <div className="cell-sub">advance adj. {money(b.advanceAdjusted)}</div>}</> },
          ]}
        />
      </Card>

      <Card title="Advances and payment terms" sub="Advance terms are set on the PO; Accounts pays and adjusts advances against invoices" bodyClass="" className="section-gap">
        <DataTable
          dense
          rows={withTerms}
          emptyText="No purchase orders with advance terms."
          columns={[
            { key: 'id', header: 'PO', render: (p) => <><div className="cell-main">{p.id}</div><div className="cell-sub">{p.vendor}</div></> },
            { key: 't', header: 'Payment terms', render: (p) => p.paymentTerms },
            { key: 'tot', header: 'PO total', align: 'num', render: (p) => money(p.total) },
            { key: 'adv', header: 'Advance per terms', align: 'num', render: (p) => (p.advancePct ? <>{money(p.advance)}<div className="cell-sub">{p.advancePct}%</div></> : '—') },
            { key: 'paid', header: 'Advance paid', render: (p) => (p.advances.length ? p.advances.map((a) => <div key={a.id}>{money(a.amount)} <span className="cell-sub">{formatDate(a.date)} · {a.mode} {a.reference}</span></div>) : <span className="cell-sub">Not paid yet</span>) },
            { key: 'adj', header: 'Adjusted against invoices', align: 'num', render: (p) => money(p.advances.reduce((s, a) => s + (a.adjusted || []).reduce((t, x) => t + x.amount, 0), 0)) },
            { key: 'd', header: 'Delivery', render: (p) => <Badge>{p.status}</Badge> },
          ]}
        />
      </Card>
    </>
  )
}
