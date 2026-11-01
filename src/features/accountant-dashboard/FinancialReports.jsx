import DataTable from '../../components/DataTable.jsx'
import StatGrid from '../../components/StatGrid.jsx'
import { BarChart, Donut, HBarList } from '../../components/Charts.jsx'
import { Badge, Card } from '../../components/UI.jsx'
import { formatCompactINR, formatDate, formatINR, formatNumber } from '../../utils/format.js'
import { SectionToolbar } from './shared.jsx'
import { SupplierAccounts } from './SupplierPayments.jsx'
import { CustomerLink } from './CustomerAccount.jsx'

export const REPORT_VIEWS = ['Summary', 'Project cost & profit', 'Purchase register', 'Supplier ledger', 'Outstanding']

const COLORS = ['var(--chart-1)', 'var(--chart-2)', 'var(--chart-3)', 'var(--warning)', 'var(--muted)']

export function CashflowChart({ data }) {
  return (
    <Card title="Monthly Cash Flow" sub="Cash in from customers vs cash paid out">
      <BarChart data={data} xKey="x" keys={['inflow', 'outflow']} labels={['Inflow', 'Outflow']} colors={['var(--chart-3)', 'var(--chart-1)']} format={formatCompactINR} />
    </Card>
  )
}

export function BudgetHeadsChart({ data }) {
  return (
    <Card title="Budget vs Actual" sub="Planned spend to date vs actual, by cost head">
      <BarChart data={data} xKey="x" keys={['planned', 'actual']} labels={['Planned to date', 'Actual']} colors={['var(--chart-2)', 'var(--chart-1)']} format={formatCompactINR} />
    </Card>
  )
}

/** Budget vs actual, project expenses, income & expenditure and monthly cash flow. */
function SummaryReport({ reports }) {
  const r = reports
  const surplus = r.totals.income - r.totals.expenditure
  const lastClosing = r.cashflow[r.cashflow.length - 1]?.closing

  return (
    <>
      <StatGrid
        items={[
          { label: 'Income (receipts)', value: formatCompactINR(r.totals.income), sub: 'Selected range', tone: 'success' },
          { label: 'Expenditure (booked)', value: formatCompactINR(r.totals.expenditure), sub: 'Selected range' },
          { label: surplus >= 0 ? 'Surplus' : 'Deficit', value: formatCompactINR(Math.abs(surplus)), tone: surplus >= 0 ? 'success' : 'danger' },
          { label: 'Closing bank & cash', value: lastClosing != null ? formatCompactINR(lastClosing) : '-', sub: 'Per books, end of range' },
        ]}
      />

      <div className="grid halves">
        <BudgetHeadsChart data={r.budgetVsActual} />
        <Card title="Project Expenses by Category" sub="Booked in selected range">
          <Donut
            data={r.expenseByCategory}
            colors={COLORS}
            format={formatCompactINR}
            centerLabel="Total"
            centerValue={formatCompactINR(r.totals.expenditure)}
          />
        </Card>
      </div>

      <Card title="Budget vs Actual Spending" sub="Project lifetime to date, by cost head" bodyClass="" className="mb">
        <DataTable
          rowKey="x"
          rows={r.budgetVsActual}
          columns={[
            { key: 'label', header: 'Cost head', render: (x) => <span className="cell-main">{x.label}</span> },
            { key: 'lifetimeBudget', header: 'Lifetime budget', align: 'num', render: (x) => formatCompactINR(x.lifetimeBudget) },
            { key: 'planned', header: 'Planned to date', align: 'num', render: (x) => formatCompactINR(x.planned) },
            { key: 'actual', header: 'Actual to date', align: 'num', render: (x) => formatCompactINR(x.actual) },
            {
              key: 'variance', header: 'Variance', align: 'num',
              render: (x) => <span className={x.variance < 0 ? 'down' : 'up'}>{x.variance < 0 ? 'Over ' : 'Under '}{formatCompactINR(Math.abs(x.variance))}</span>,
            },
            { key: 'used', header: 'Budget used', align: 'num', render: (x) => (x.lifetimeBudget ? `${((x.actual / x.lifetimeBudget) * 100).toFixed(1)}%` : '-') },
          ]}
        />
      </Card>

      <Card title="Project-wise Expenses" sub="Booked in selected range" bodyClass="" className="mb">
        <DataTable
          rows={r.projectExpenses}
          columns={[
            { key: 'name', header: 'Project', render: (x) => <span className="cell-main">{x.name}</span> },
            ...r.expenseCategories.map((c) => ({ key: c, header: c, align: 'num', render: (x) => formatCompactINR(x[c]) })),
            { key: 'total', header: 'Total', align: 'num', render: (x) => <b>{formatCompactINR(x.total)}</b> },
          ]}
        />
      </Card>

      <div className="grid halves">
        <Card title="Income & Expenditure" sub="Customer receipts vs booked project expenses">
          <BarChart data={r.incomeExpenditure} xKey="x" keys={['income', 'expenditure']} labels={['Income', 'Expenditure']} colors={['var(--chart-3)', 'var(--chart-1)']} format={formatCompactINR} />
        </Card>
        <CashflowChart data={r.cashflow} />
      </div>

      <Card
        title="Monthly Cash Flow Statement"
        sub={`From the bank & cash books, which start on ${formatDate(r.booksStart)} in this demo. Earlier history (e.g. completed projects) is carried in the opening balances.`}
        bodyClass=""
        className="mb"
      >
        <DataTable
          rowKey="x"
          rows={r.cashflow}
          columns={[
            { key: 'x', header: 'Month', render: (x) => <span className="cell-main">{x.x}</span> },
            { key: 'inflow', header: 'Cash in', align: 'num', render: (x) => formatCompactINR(x.inflow) },
            { key: 'outflow', header: 'Cash out', align: 'num', render: (x) => formatCompactINR(x.outflow) },
            { key: 'net', header: 'Net', align: 'num', render: (x) => <span className={x.net < 0 ? 'down' : 'up'}>{formatCompactINR(x.net)}</span> },
            { key: 'closing', header: 'Closing balance', align: 'num', render: (x) => formatCompactINR(x.closing) },
          ]}
        />
      </Card>
    </>
  )
}

/** Collections vs cost per project. Margin is indicative, not recognised revenue. */
function ProjectCostReport({ rows }) {
  return (
    <Card title="Project Cost & Profit" sub="Completed projects: actual profit (sale value − final cost). Ongoing projects: indicative margin vs budgeted cost of units sold. Costs are construction only (land, approvals and finance costs are not in this demo); revenue recognition follows the company's accounting policy." bodyClass="" className="mb">
      <DataTable
        dense
        rows={rows}
        columns={[
          {
            key: 'name', header: 'Project',
            render: (r) => <><div className="cell-main">{r.name} <Badge>{r.status}</Badge></div><div className="cell-sub">{r.unitsSold} of {r.unitsTotal} units sold{r.completedOn ? ` · completed ${formatDate(r.completedOn)}` : ''}</div></>,
          },
          { key: 'bookingsValue', header: 'Sale value booked', align: 'num', render: (r) => formatCompactINR(r.bookingsValue) },
          { key: 'collected', header: 'Collected', align: 'num', render: (r) => formatCompactINR(r.collected) },
          { key: 'receivable', header: 'Receivable', align: 'num', render: (r) => formatCompactINR(r.receivable) },
          { key: 'budget', header: 'Cost budget', align: 'num', render: (r) => formatCompactINR(r.budget) },
          { key: 'costToDate', header: 'Cost to date', align: 'num', render: (r) => <><div>{formatCompactINR(r.costToDate)}</div><div className="cell-sub">{r.completionByCost}% of budget</div></> },
          {
            key: 'margin', header: 'Profit / margin', align: 'num',
            render: (r) => (
              <>
                <div className={r.margin < 0 ? 'down' : 'up'}>{formatCompactINR(r.margin)}</div>
                <div className="cell-sub">{r.marginBasis}{r.bookingsValue ? ` · ${Math.round((r.margin / r.bookingsValue) * 100)}% of sales` : ''}</div>
              </>
            ),
          },
        ]}
      />
    </Card>
  )
}

function PurchaseRegister({ rows }) {
  const total = (k) => rows.reduce((s, r) => s + r[k], 0)
  return (
    <Card title="Purchase Register" sub="All supplier invoices with taxable value and GST" bodyClass="" className="mb">
      <DataTable
        dense
        rows={rows}
        columns={[
          { key: 'invoiceDate', header: 'Date', render: (r) => formatDate(r.invoiceDate) },
          { key: 'supplier', header: 'Supplier & invoice', render: (r) => <><div className="cell-main">{r.supplier}</div><div className="cell-sub">{r.invoiceNo} · {r.poId}</div></> },
          { key: 'material', header: 'Material', render: (r) => <><div>{r.material}</div><div className="cell-sub">{formatNumber(r.invoicedQty)} {r.unit} @ ₹{formatNumber(r.invoiceRate)}</div></> },
          { key: 'taxable', header: 'Taxable value', align: 'num', render: (r) => formatINR(r.taxable) },
          { key: 'gst', header: 'GST', align: 'num', render: (r) => <><div>{formatINR(r.gst)}</div><div className="cell-sub">{r.gstRate}%</div></> },
          { key: 'amount', header: 'Invoice total', align: 'num', render: (r) => <b>{formatINR(r.amount)}</b> },
          { key: 'paymentStatus', header: 'Status', render: (r) => <Badge>{r.paymentStatus}</Badge> },
        ]}
      />
      <div className="table-more tb-total">
        Totals: taxable {formatINR(total('taxable'))} · GST {formatINR(total('gst'))} · invoices {formatINR(total('amount'))}
      </div>
    </Card>
  )
}

function OutstandingReport({ reports, receivables, payables, onOpenCustomer }) {
  const r = reports
  const openPayables = payables.filter((b) => b.paymentStatus !== 'Paid')
  return (
    <>
      <div className="grid halves">
        <Card title="Outstanding: Customer Receivables" sub="By days overdue, as of today">
          <HBarList rows={r.receivableAging} format={formatCompactINR} tone={(x) => (x.label.startsWith('Not') ? 'ok' : 'bad')} emptyText="Nothing outstanding." />
        </Card>
        <Card title="Outstanding: Supplier Payables" sub="By days overdue, as of today">
          <HBarList rows={r.payableAging} format={formatCompactINR} tone={(x) => (x.label.startsWith('Not') ? 'ok' : 'bad')} emptyText="Nothing outstanding." />
        </Card>
      </div>

      <div className="grid halves">
        <Card title="Customer Payments Outstanding" sub="Instalments due or overdue" bodyClass="">
          <DataTable
            dense
            rows={receivables}
            limit={12}
            emptyText="Nothing outstanding."
            columns={[
              { key: 'customer', header: 'Customer', render: (x) => <><CustomerLink row={x} onOpen={onOpenCustomer} /><div className="cell-sub">{x.unit} · {x.milestone}</div></> },
              { key: 'dueDate', header: 'Due', render: (x) => formatDate(x.dueDate) },
              { key: 'amount', header: 'Amount', align: 'num', render: (x) => formatINR(x.amount) },
              { key: 'status', header: 'Status', render: (x) => <Badge>{x.status}</Badge> },
            ]}
          />
        </Card>
        <Card title="Supplier Payments Outstanding" sub="Open invoices" bodyClass="">
          <DataTable
            dense
            rows={openPayables}
            limit={12}
            emptyText="Nothing outstanding."
            columns={[
              { key: 'supplier', header: 'Supplier', render: (x) => <><div className="cell-main">{x.supplier}</div><div className="cell-sub">{x.invoiceNo}</div></> },
              { key: 'dueDate', header: 'Due', render: (x) => formatDate(x.dueDate) },
              { key: 'balance', header: 'Amount', align: 'num', render: (x) => formatINR(x.balance) },
              { key: 'paymentStatus', header: 'Status', render: (x) => <Badge>{x.paymentStatus}</Badge> },
            ]}
          />
        </Card>
      </div>
    </>
  )
}

/** Financial reports: summary, project cost & margin, purchase register, supplier ledger, outstanding. */
export default function FinancialReports({ reports, view = 'Summary', onViewChange, receivables = [], payables = [], onOpenCustomer }) {
  return (
    <>
      <div className="report-tabs">
        <SectionToolbar statuses={REPORT_VIEWS} status={view} onStatusChange={onViewChange} />
      </div>
      {view === 'Project cost & profit' && <ProjectCostReport rows={reports.projectCost} />}
      {view === 'Purchase register' && <PurchaseRegister rows={reports.purchaseRegister} />}
      {view === 'Supplier ledger' && <SupplierAccounts accounts={reports.supplierAccounts} />}
      {view === 'Outstanding' && <OutstandingReport reports={reports} receivables={receivables} payables={payables} onOpenCustomer={onOpenCustomer} />}
      {view === 'Summary' && <SummaryReport reports={reports} />}
    </>
  )
}
