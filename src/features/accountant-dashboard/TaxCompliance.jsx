import DataTable from '../../components/DataTable.jsx'
import StatGrid from '../../components/StatGrid.jsx'
import Icon from '../../components/Icon.jsx'
import { Badge, Card } from '../../components/UI.jsx'
import { formatCompactINR, formatDate, formatINR, relativeDay } from '../../utils/format.js'
import { LockedNote, SectionToolbar, UndoButton } from './shared.jsx'

export const TAX_STATUSES = ['All', 'Due', 'Prepared', 'Filed']

/** GST, TDS and statutory due dates. Rules are demo configuration, not tax advice. */
export default function TaxCompliance({ tax, status = 'All', onStatusChange, canPrepare, onAct, onUndo, onOpenDocument }) {
  const { config, byMonth, filings } = tax
  const rows = filings.filter((f) => status === 'All' || f.status === status)
  const upcoming = filings.filter((f) => f.status !== 'Filed').sort((a, b) => a.due.localeCompare(b.due))
  const next = upcoming[0]
  const current = byMonth[byMonth.length - 1]

  const action = (f) => {
    if (f.changed) return <UndoButton onClick={() => onUndo('tax', f)} />
    if (f.status === 'Due') {
      if (!canPrepare) return <LockedNote>View only</LockedNote>
      return <button className="btn btn-sm" onClick={() => onAct('tax', f, 'Prepared', `Demo: ${f.form} for ${f.period} marked prepared on screen only. Nothing filed.`)}>Mark prepared</button>
    }
    if (f.status === 'Prepared') return <span className="cell-sub">Ready for filing by authorised signatory</span>
    return <span className="cell-sub">Filed {formatDate(f.filedOn)}</span>
  }

  return (
    <>
      <div className="info-note warn">
        <Icon name="alert" size={14} />
        <span>
          <b>Demo tax configuration.</b> {config.note} Current settings: GST on customer receipts {config.gstOnReceiptsRate}%
          {config.inputTaxCreditEligible ? ' with' : ' without'} input tax credit; TDS sections as listed below.
        </span>
      </div>

      <StatGrid
        items={[
          { label: 'Next due', value: next ? next.form : 'Nothing due', sub: next ? `${formatDate(next.due)} · ${relativeDay(next.due)}` : undefined, tone: next && next.daysLeft <= 7 ? 'warning' : undefined },
          { label: 'Filings open', value: upcoming.length, sub: 'Due or prepared' },
          { label: `GST collected · ${current?.label ?? ''}`, value: formatCompactINR(current?.gstOutput || 0), sub: `${config.gstOnReceiptsRate}% on receipts (so far)` },
          { label: `TDS deducted · ${current?.label ?? ''}`, value: formatCompactINR((current?.tds194C || 0) + (current?.tds192 || 0)), sub: 'Deposit by the 7th of next month' },
        ]}
      />

      <Card title="Filing & Payment Calendar" sub="Returns, challans and statutory payments with supporting documents" bodyClass="" className="mb">
        <SectionToolbar statuses={TAX_STATUSES} status={status} onStatusChange={onStatusChange} />
        <DataTable
          dense
          rows={rows}
          emptyText="No filings match this filter."
          columns={[
            { key: 'form', header: 'Return / payment', render: (f) => <><div className="cell-main">{f.form}</div><div className="cell-sub">{f.kind}</div></> },
            { key: 'period', header: 'Period' },
            { key: 'due', header: 'Due date', render: (f) => <><div>{formatDate(f.due)}</div>{f.status !== 'Filed' && <div className={`cell-sub ${f.daysLeft <= 7 ? 'down' : ''}`}>{relativeDay(f.due)}</div>}</> },
            { key: 'amount', header: 'Amount', align: 'num', render: (f) => (f.amount != null ? formatINR(f.amount) : <span className="cell-sub">Return only</span>) },
            { key: 'status', header: 'Status', render: (f) => <Badge>{f.status}</Badge> },
            {
              key: 'document', header: 'Reference & document',
              render: (f) => (f.reference
                ? <><div className="cell-sub">{f.reference}</div><button className="doc-link" onClick={() => onOpenDocument({ document: f.document })}><Icon name="file" size={14} />View</button></>
                : <span className="cell-sub">-</span>),
            },
            { key: 'actions', header: 'Action', render: action },
          ]}
        />
      </Card>

      <div className="grid halves-wide">
        <Card title="Monthly Tax Summary" sub="Computed from receipts, purchase invoices, contractor bills and salary runs" bodyClass="">
          <DataTable
            dense
            rowKey="month"
            rows={[...byMonth].reverse()}
            columns={[
              { key: 'label', header: 'Month', render: (m) => <span className="cell-main">{m.label}</span> },
              { key: 'receiptsValue', header: 'Customer receipts', align: 'num', render: (m) => formatINR(m.receiptsValue) },
              { key: 'gstOutput', header: `GST ${config.gstOnReceiptsRate}% (output)`, align: 'num', render: (m) => formatINR(m.gstOutput) },
              {
                key: 'gstOnPurchases', header: 'GST on purchases', align: 'num',
                render: (m) => <><div>{formatINR(m.gstOnPurchases)}</div><div className="cell-sub">{config.inputTaxCreditEligible ? 'ITC claimable' : 'ITC not claimed (cost)'}</div></>,
              },
              { key: 'tds194C', header: 'TDS 194C', align: 'num', render: (m) => formatINR(m.tds194C) },
              { key: 'tds192', header: 'TDS 192', align: 'num', render: (m) => formatINR(m.tds192) },
              { key: 'pfPt', header: 'PF & PT', align: 'num', render: (m) => formatINR(m.pfPt) },
            ]}
          />
        </Card>
        <Card title="Configured TDS Sections" sub="Demo settings: confirm with your CA" bodyClass="">
          <DataTable
            dense
            rowKey="section"
            rows={config.tdsSections}
            columns={[
              { key: 'section', header: 'Section', render: (s) => <><div className="cell-main">{s.section}</div><div className="cell-sub">{s.label}</div></> },
              { key: 'rate', header: 'Rate', align: 'num', render: (s) => (s.rate != null ? `${s.rate}%` : 'Slab') },
              { key: 'appliesTo', header: 'Applies to', render: (s) => <span className="cell-sub">{s.appliesTo}</span> },
            ]}
          />
        </Card>
      </div>
    </>
  )
}
