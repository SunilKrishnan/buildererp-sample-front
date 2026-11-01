import { useState } from 'react'
import DataTable from '../../components/DataTable.jsx'
import Icon from '../../components/Icon.jsx'
import { Badge, Card, Chips } from '../../components/UI.jsx'
import { formatCompactINR, formatDate, formatINR } from '../../utils/format.js'

const TYPES = ['All', 'Money in', 'Money out', 'Transfers']
const typeOf = (t) => (t.kind === 'transfer' ? 'Transfers' : t.amount >= 0 ? 'Money in' : 'Money out')

/** Bank accounts, petty cash and every money movement through them. */
export default function BankCash({ accounts, txns, onOpen }) {
  const [account, setAccount] = useState('All')
  const [type, setType] = useState('All')
  const accountOptions = ['All', ...accounts.map((a) => a.short)]
  const selected = accounts.find((a) => a.short === account)
  const rows = txns.filter((t) => (account === 'All' || t.accountName === account) && (type === 'All' || typeOf(t) === type))

  return (
    <>
      <div className="bank-cards">
        {accounts.map((a) => (
          <button key={a.id} className={`card bank-card ${account === a.short ? 'active' : ''}`} onClick={() => setAccount(account === a.short ? 'All' : a.short)}>
            <div className="kpi-top">
              <span>{a.name}</span>
              <div className="kpi-icon"><Icon name={a.kind === 'Bank' ? 'bank' : 'wallet'} /></div>
            </div>
            <div className="kpi-value">{formatCompactINR(a.balance)}</div>
            <div className="kpi-foot">{a.kind === 'Bank' ? `${a.bank} · ${a.number}` : 'Cash in hand, as per books'}</div>
            <div className="bank-flows">
              <span className="up">+ {formatCompactINR(a.inflow)}</span>
              <span className="down">− {formatCompactINR(a.outflow)}</span>
              <span className="cell-sub">in selected range</span>
            </div>
            {a.kind === 'Bank' && (
              <div className={`cell-sub ${a.toReconcile ? 'down' : ''}`}>{a.toReconcile ? `${a.toReconcile} items to reconcile` : 'Fully reconciled'}</div>
            )}
          </button>
        ))}
      </div>

      <div className="info-note">
        <Icon name="bank" size={14} />
        <span>
          Customer collections go to the RERA designated account. Money moves to the operations account only against
          certified project cost (demo rule). Supplier, contractor, wage and salary payments go out from the operations account;
          small site bills and labour advances from petty cash.{' '}
          <button className="link-btn" onClick={() => onOpen('reconciliation')}>Reconcile with bank statement ›</button>
        </span>
      </div>

      <Card
        title="Bank & Cash Register"
        sub={selected ? `${selected.name}: transactions in the selected range with running balance` : 'All accounts: transactions in the selected range'}
        bodyClass=""
        className="mb"
      >
        <div className="toolbar">
          <Chips options={accountOptions} value={account} onChange={setAccount} />
          <label className="field inline">
            Type
            <select value={type} onChange={(e) => setType(e.target.value)}>
              {TYPES.map((t) => <option key={t}>{t}</option>)}
            </select>
          </label>
        </div>
        <DataTable
          dense
          rows={rows}
          limit={60}
          emptyText="No transactions match these filters."
          columns={[
            { key: 'date', header: 'Date', render: (r) => formatDate(r.date) },
            ...(account === 'All' ? [{ key: 'accountName', header: 'Account' }] : []),
            { key: 'party', header: 'Party & details', render: (r) => <><div className="cell-main">{r.party}</div><div className="cell-sub">{r.desc}</div></> },
            { key: 'ref', header: 'Mode & reference', render: (r) => <><div>{r.method || '-'}</div><div className="cell-sub">{r.ref}</div></> },
            { key: 'in', header: 'Money in', align: 'num', render: (r) => (r.amount > 0 ? <span className="up">{formatINR(r.amount)}</span> : '') },
            { key: 'out', header: 'Money out', align: 'num', render: (r) => (r.amount < 0 ? formatINR(-r.amount) : '') },
            ...(account !== 'All' ? [{ key: 'balance', header: 'Balance', align: 'num', render: (r) => (r.balance != null ? formatINR(r.balance) : '-') }] : []),
            { key: 'recon', header: 'Statement', render: (r) => (r.recon === 'Cash' ? <span className="cell-sub">Cash</span> : <Badge>{r.recon}</Badge>) },
          ]}
        />
      </Card>
    </>
  )
}
