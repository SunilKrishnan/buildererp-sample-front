import DataTable from '../../components/DataTable.jsx'
import { Card } from '../../components/UI.jsx'
import { projects } from '../../data/mockData.js'
import { formatINR } from '../../utils/format.js'

/**
 * Material purchase cost by project, from the shared supplier invoices. Only VERIFIED invoices are
 * cost (the accounting event); open POs are commitments and advances are prepayments, so neither
 * is counted. Store-to-store transfers move stock and are never purchases. Each invoice is counted
 * once, at its verified amount (after any debit note).
 */
export default function ProjectPurchaseCost({ bills, pos, advances }) {
  const ids = [...new Set([...bills.map((b) => b.projectId), ...pos.map((p) => p.projectId)])].filter(Boolean)
  const rows = ids.map((id) => {
    const b = bills.filter((x) => x.projectId === id)
    const verified = b.filter((x) => x.verification === 'Verified')
    const pending = b.filter((x) => x.verification !== 'Verified')
    const open = pos.filter((p) => p.projectId === id && p.sku && ['Approved', 'Sent to Supplier', 'Partially Delivered'].includes(p.status))
    const adv = advances.filter((a) => pos.some((p) => p.id === a.poId && p.projectId === id))
    return {
      id, name: projects.find((p) => p.id === id)?.name || id,
      cost: verified.reduce((t, x) => t + (x.verifiedAmount || 0), 0), invoices: verified.length,
      debit: verified.reduce((t, x) => t + (x.debitNote?.amount || 0), 0),
      pendingAmt: pending.reduce((t, x) => t + x.amount, 0), pendingCount: pending.length,
      commitment: open.reduce((t, p) => t + Math.round(p.pending * p.rate), 0),
      advance: adv.reduce((t, a) => t + a.amount - (a.adjusted || []).reduce((s, x) => s + x.amount, 0), 0),
      paid: b.reduce((t, x) => t + x.paidAmount, 0), payable: verified.reduce((t, x) => t + x.balance, 0),
    }
  })
  return (
    <Card title="Material purchase cost by project" sub="From verified supplier invoices only. POs, advances and store transfers are shown separately and never counted as cost." bodyClass="" className="mb">
      <DataTable dense rowKey="id" rows={rows} emptyText="No supplier invoices yet." columns={[
        { key: 'name', header: 'Project' },
        { key: 'cost', header: 'Verified cost', align: 'num', render: (r) => <><b>{formatINR(r.cost)}</b><div className="cell-sub">{r.invoices} invoice(s){r.debit ? ` · debit notes ${formatINR(r.debit)}` : ''}</div></> },
        { key: 'pend', header: 'Awaiting verification (not cost yet)', align: 'num', render: (r) => <>{formatINR(r.pendingAmt)}<div className="cell-sub">{r.pendingCount} invoice(s)</div></> },
        { key: 'com', header: 'Open PO commitment', align: 'num', render: (r) => formatINR(r.commitment) },
        { key: 'adv', header: 'Unadjusted advances', align: 'num', render: (r) => formatINR(r.advance) },
        { key: 'paid', header: 'Paid', align: 'num', render: (r) => formatINR(r.paid) },
        { key: 'pay', header: 'Payable (verified, unpaid)', align: 'num', render: (r) => formatINR(r.payable) },
      ]} />
    </Card>
  )
}
