import Icon from '../../components/Icon.jsx'
import AssignedIssues from '../site-engineer/AssignedIssues.jsx'
import SummaryCard from '../../components/SummaryCard.jsx'
import { Badge, Card } from '../../components/UI.jsx'
import { materialOf, storeOf } from '../../services/inventory.js'
import { awaitingComparison, POLICY } from '../../services/procurement.js'
import { formatCompactINR } from '../../utils/format.js'
import { money } from './shared.jsx'

const FLOW = [
  ['Store Keeper', 'Stock shortage → purchase requisition'],
  ['Purchase Manager', 'Quotations → supplier selection → PO'],
  ['Admin', `Approves POs above ${money(POLICY.PO_PM_APPROVAL_LIMIT)} (company policy)`],
  ['Supplier → Store Keeper', 'Delivery → inspection → GRN → stock update'],
  ['Accountant', 'Invoice verification → accounts → payment records'],
]

export default function Overview({ inv, perms, go, notify }) {
  const prs = inv.state.purchaseRequests
  const pos = inv.poViews
  const pendingPRs = prs.filter((p) => p.status === 'Sent to Purchase Manager')
  const adminPRs = prs.filter((p) => p.status === 'Awaiting Admin Review')
  const toCompare = prs.filter(awaitingComparison)
  const toOrder = prs.filter((p) => p.status === 'Supplier Selected')
  const pendingApproval = pos.filter((p) => p.status === 'Pending Approval')
  const drafts = pos.filter((p) => p.status === 'Draft')
  const toSend = pos.filter((p) => p.status === 'Approved')
  const awaitingDelivery = pos.filter((p) => p.open)
  const delayed = pos.filter((p) => p.delayed)
  const live = pos.filter((p) => !['Draft', 'Cancelled', 'Rejected'].includes(p.status))
  const purchaseValue = live.reduce((s, p) => s + p.goods, 0)
  const unpaid = inv.supplierBills.filter((b) => b.paymentStatus !== 'Paid' && b.balance > 0)
  const unpaidValue = unpaid.reduce((s, b) => s + b.balance, 0)

  const cards = [
    { label: 'Pending Purchase Requisitions', value: pendingPRs.length, sub: `${adminPRs.length} more awaiting Admin review`, icon: 'clipboard', tab: 'requisitions', tone: pendingPRs.length ? 'warning' : undefined },
    { label: 'Quotations Awaiting Comparison', value: toCompare.length, sub: `${toOrder.length} supplier selected, PO not yet created`, icon: 'percent', tab: 'quotations', tone: toCompare.length ? 'warning' : undefined },
    { label: 'POs Awaiting Approval', value: pendingApproval.length, sub: `${money(pendingApproval.reduce((s, p) => s + p.goods, 0))} with Admin · ${drafts.length} draft`, icon: 'check', tab: 'orders' },
    { label: 'Orders Awaiting Delivery', value: awaitingDelivery.length, sub: `${toSend.length} approved, not yet sent`, icon: 'box', tab: 'deliveries' },
    { label: 'Delayed Deliveries', value: delayed.length, sub: delayed.length ? delayed.map((p) => p.id).join(', ') : 'All deliveries on time', icon: 'alert', tab: 'deliveries', tone: delayed.length ? 'danger' : undefined },
    { label: 'Total Purchase Value', value: formatCompactINR(purchaseValue), sub: `${live.length} approved / pending POs, before GST`, icon: 'rupee', tab: 'reports' },
    { label: 'Supplier Payments Pending', value: formatCompactINR(unpaidValue), sub: `${unpaid.length} invoices · view only, handled by Accounts`, icon: 'wallet', tab: 'bills' },
  ]

  const todo = [
    ...(perms.reviewRequisition ? adminPRs.map((p) => ({ key: p.id, tone: 'warning', text: `${p.id}: review ${p.qty} ${materialOf(p.sku)?.unit} ${materialOf(p.sku)?.name} (above review limit)`, tab: 'requisitions', label: 'Admin review' })) : []),
    ...pendingPRs.map((p) => ({ key: p.id, tone: 'warning', text: `${p.id}: ${p.qty} ${materialOf(p.sku)?.unit} ${materialOf(p.sku)?.name} for ${storeOf(p.storeId)?.name}`, tab: 'requisitions', label: 'Review / request quotations' })),
    ...toCompare.map((p) => ({ key: `c-${p.id}`, tone: 'info', text: `${p.id}: ${p.quotes.length} quotations received for ${materialOf(p.sku)?.name}`, tab: 'quotations', label: 'Compare & select' })),
    ...toOrder.map((p) => ({ key: `o-${p.id}`, tone: 'info', text: `${p.id}: supplier selected, create the PO`, tab: 'orders', label: 'Create PO' })),
    ...drafts.map((p) => ({ key: p.id, tone: 'info', text: `${p.id}: draft PO to ${p.vendor} (${money(p.goods)})`, tab: 'orders', label: 'Submit' })),
    ...(perms.approvePO ? pendingApproval.map((p) => ({ key: `a-${p.id}`, tone: 'warning', text: `${p.id}: ${p.vendor}, ${money(p.goods)} needs Admin approval`, tab: 'orders', label: 'Approve / reject' })) : []),
    ...toSend.map((p) => ({ key: `s-${p.id}`, tone: 'info', text: `${p.id}: approved, send to ${p.vendor}`, tab: 'orders', label: 'Send to supplier' })),
    ...delayed.map((p) => ({ key: `d-${p.id}`, tone: 'danger', text: `${p.id}: ${p.pending} ${p.unit} from ${p.vendor} is ${p.delayDays} day${p.delayDays > 1 ? 's' : ''} late`, tab: 'deliveries', label: 'Follow up' })),
  ]

  return (
    <>
      <div className="summary-grid">
        {cards.map((c) => <SummaryCard key={c.label} {...c} onClick={() => go(c.tab)} />)}
      </div>

      <div className="grid two-one">
        <Card title={<span className="title-with-count">Your purchasing work <span className="count-pill">{todo.length}</span></span>} sub="Open items, most urgent first" bodyClass="">
          {todo.length === 0 ? <div className="empty sm">Nothing waiting. All requisitions and orders are moving.</div> : (
            <ul className="list sk-alerts">
              {[...todo].sort((a, b) => ({ danger: 0, warning: 1, info: 2 }[a.tone] - { danger: 0, warning: 1, info: 2 }[b.tone])).map((t) => (
                <li key={t.key}>
                  <div className={`dot-ico sk-sev-${t.tone}`}><Icon name={t.tone === 'danger' ? 'alert' : 'clipboard'} /></div>
                  <div style={{ minWidth: 0 }}><div className="t">{t.text}</div></div>
                  <div className="r"><button className="btn btn-sm" onClick={() => go(t.tab)}>{t.label}</button></div>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title="How purchasing connects" sub="Each step is done by its own role">
          <ol className="pm-flow">
            {FLOW.map(([who, what]) => <li key={who}><b>{who}</b><span>{what}</span></li>)}
          </ol>
          <p className="cell-sub" style={{ whiteSpace: 'normal' }}>
            You prepare POs and follow up deliveries. The Store Keeper receives goods and adds accepted quantity to stock; Accounts verifies
            bills and records payments. <Badge tone="muted">Demo</Badge> Changes reset on reload; nothing is sent to suppliers.
          </p>
        </Card>
      </div>
      <AssignedIssues roleLabel="Purchase Manager" actor={perms.actor} notify={notify} />
    </>
  )
}
