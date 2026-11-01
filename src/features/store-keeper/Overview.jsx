import DataTable from '../../components/DataTable.jsx'
import AssignedIssues from '../site-engineer/AssignedIssues.jsx'
import Icon from '../../components/Icon.jsx'
import SummaryCard from '../../components/SummaryCard.jsx'
import { DemoTag } from '../../components/StateViews.jsx'
import { Badge, Card } from '../../components/UI.jsx'
import { materialOf, storeOf } from '../../services/inventory.js'
import { formatCompactINR } from '../../utils/format.js'
import { fmtQty, fmtStamp } from './shared.jsx'

const ALERT_ICON = { danger: 'alert', warning: 'alert', info: 'clipboard' }

export default function Overview({ inv, perms, go, notify }) {
  const s = inv.summary
  const reqById = Object.fromEntries(inv.state.requests.map((r) => [r.id, r]))
  const cards = [
    { label: 'Total Material Types', value: s.materialTypes, sub: `In stock now, of ${s.catalogTypes} stocked across ${new Set(inv.stock.map((x) => x.storeId)).size} stores`, icon: 'box', tab: 'stock' },
    { label: 'Total Stock Value', value: formatCompactINR(s.stockValue), sub: 'Usable stock on hand × rate', icon: 'rupee', tab: 'stock' },
    { label: 'Materials Received Today', value: s.receivedToday.length, sub: `${s.receivedToday.filter((g) => g.status === 'Accepted').length} accepted · ${s.receivedToday.filter((g) => g.status !== 'Accepted').length} awaiting inspection`, icon: 'download', tab: 'receipts' },
    { label: 'Materials Issued Today', value: s.issuedToday.length, sub: 'Confirmed issues to sites', icon: 'trend', tab: 'issues' },
    { label: 'Low Stock Items', value: s.low.length, sub: `${s.low.filter((x) => x.status === 'Out of Stock').length} out of stock`, icon: 'alert', tab: 'reorder', tone: s.low.length ? 'warning' : undefined },
    { label: 'Pending Material Requests', value: s.pendingRequests.length, sub: 'To review, approve or issue', icon: 'clipboard', tab: 'requests' },
    { label: 'Pending Receipts / Inspections', value: s.pendingReceipts.length + s.pendingReturns.length, sub: `${s.pendingReceipts.length} deliveries · ${s.pendingReturns.length} site returns`, icon: 'check', tab: s.pendingReceipts.length ? 'receipts' : 'returns', tone: s.pendingReceipts.length + s.pendingReturns.length ? 'warning' : undefined },
    { label: 'Stock Discrepancies', value: s.discrepancies, sub: `${s.openReceiptDisc.length} delivery · ${s.pendingAdj.length} adjustments under review`, icon: 'percent', tab: 'reports', tone: s.discrepancies ? 'danger' : undefined },
  ]

  return (
    <>
      <div className="summary-grid">
        {cards.map((c) => (
          <SummaryCard key={c.label} label={c.label} value={c.value} sub={c.sub} icon={c.icon} tone={c.tone}
            onClick={() => go(c.tab, c.label === 'Stock Discrepancies' ? { report: 'discrepancy' } : {})} />
        ))}
      </div>

      <div className="grid two-one">
        <Card title={<span className="title-with-count">Alerts <span className="count-pill">{inv.alerts.length}</span></span>} sub="Shown on screen only. No notifications or messages are sent." action={<DemoTag>Demo alerts</DemoTag>} bodyClass="">
          {inv.alerts.length === 0 ? <div className="empty sm">No alerts. Stock, deliveries and requests are in order.</div> : (
            <ul className="list sk-alerts">
              {inv.alerts.map((a) => (
                <li key={a.id}>
                  <div className={`dot-ico sk-sev-${a.severity}`}><Icon name={ALERT_ICON[a.severity]} /></div>
                  <div style={{ minWidth: 0 }}>
                    <div className="t">{a.type}: {a.material}</div>
                    <div className="s">{a.text}</div>
                  </div>
                  <div className="r">
                    <button className="link-btn" onClick={() => go(a.tab)} title="Open the related section">{a.ref}</button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title="Your responsibilities" sub={`What ${perms.role.label} can do here (demo rules)`}>
          <ul className="perm-list">
            {[
              [perms.receive, 'Record deliveries; check and accept / reject quantities'],
              [perms.issue, 'Issue approved materials to sites'],
              [perms.review, 'Check stock for requests the Project Manager has approved'],
              [perms.move, 'Record site returns and store transfers'],
              [perms.locations, 'Manage storage locations'],
              [perms.adjustRequest, 'Raise stock corrections with a reason'],
              [perms.purchaseRequest, 'Forward shortages to the Purchase Manager'],
              [perms.approve, 'Approve site material requests (Project Manager)'],
              [perms.adjustApprove, 'Approve stock adjustments (never your own)'],
              [perms.discrepancyReview, 'Close delivery discrepancies'],
              [false, 'Create purchase orders (Purchase Manager)'],
              [false, 'Approve supplier payments (Admin / Accounts)'],
            ].map(([ok, text]) => (
              <li key={text} className={ok ? 'ok' : 'no'}><span>{ok ? '✓' : '✕'}</span><span>{text}</span></li>
            ))}
          </ul>
        </Card>
      </div>

      <div className="grid halves">
        <Card title="Received today" sub="Supplier deliveries recorded today" bodyClass="" action={<button className="btn btn-sm" onClick={() => go('receipts')}>All receipts</button>}>
          <DataTable
            rows={s.receivedToday}
            emptyText="No deliveries recorded today."
            columns={[
              { key: 'id', header: 'GRN', render: (g) => <><div className="cell-main">{g.id}</div><div className="cell-sub">{g.po}</div></> },
              { key: 'm', header: 'Material', render: (g) => <><div>{materialOf(g.sku).name}</div><div className="cell-sub">{storeOf(g.storeId).name}</div></> },
              { key: 'q', header: 'Accepted / delivered', align: 'num', render: (g) => `${g.accepted ?? '—'} / ${fmtQty(g.delivered, materialOf(g.sku).unit)}` },
              { key: 'st', header: 'Status', render: (g) => <Badge>{g.status}</Badge> },
            ]}
          />
        </Card>
        <Card title="Issued today" sub="Materials handed over to sites today" bodyClass="" action={<button className="btn btn-sm" onClick={() => go('issues')}>All issues</button>}>
          <DataTable
            rows={s.issuedToday.map((i) => ({ ...i, req: reqById[i.requestId] }))}
            emptyText="No materials issued today."
            columns={[
              { key: 'id', header: 'Issue', render: (i) => <><div className="cell-main">{i.id}</div><div className="cell-sub">{i.requestId} · {fmtStamp(i.at)}</div></> },
              { key: 'm', header: 'Material', render: (i) => materialOf(i.req.sku).name },
              { key: 'q', header: 'Qty', align: 'num', render: (i) => fmtQty(i.qty, materialOf(i.req.sku).unit) },
              { key: 'r', header: 'Received by', render: (i) => i.receivedBy },
            ]}
          />
        </Card>
      </div>
      <AssignedIssues roleLabel="Store Keeper" actor={perms.actor} notify={notify} />
    </>
  )
}
