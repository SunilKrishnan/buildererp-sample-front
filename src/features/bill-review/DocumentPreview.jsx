import { useEffect, useRef } from 'react'
import Icon from '../../components/Icon.jsx'
import { formatDate, formatINR } from '../../utils/format.js'

const rate = (n) => `₹${Number(n).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`

function Lines({ lines, gstRate, quantityNote }) {
  const priced = lines.every((l) => l.qty != null)
  const taxable = priced ? lines.reduce((s, l) => s + l.qty * l.rate, 0) : 0
  return (
    <table className="doc-lines">
      <thead><tr><th>Description</th><th className="num">Qty / period</th><th className="num">Rate</th>{priced && <th className="num">Amount</th>}</tr></thead>
      <tbody>
        {lines.map((l) => (
          <tr key={l.item}>
            <td>{l.desc}</td>
            <td className="num">{l.qty != null ? `${l.qty} ${l.unit}` : quantityNote}</td>
            <td className="num">{rate(l.rate)} / {l.unit.replace(/s$/, '')}</td>
            {priced && <td className="num">{formatINR(l.qty * l.rate)}</td>}
          </tr>
        ))}
      </tbody>
      {priced && (
        <tfoot>
          <tr><td colSpan={3}>Taxable value</td><td className="num">{formatINR(taxable)}</td></tr>
          <tr><td colSpan={3}>GST @ {gstRate}%</td><td className="num">{formatINR(Math.round((taxable * gstRate) / 100))}</td></tr>
          <tr className="total"><td colSpan={3}>Total</td><td className="num">{formatINR(Math.round(taxable * (1 + gstRate / 100)))}</td></tr>
        </tfoot>
      )}
    </table>
  )
}

/**
 * Document-style preview of a supplier bill, purchase order/agreement or site confirmation.
 * DEMO: rendered from the structured demo record. No original file is stored or read.
 */
export default function DocumentPreview({ kind, bill, onClose }) {
  const closeRef = useRef(null)
  useEffect(() => {
    closeRef.current?.focus()
    const onKey = (e) => e.key === 'Escape' && (e.stopPropagation(), onClose())
    document.addEventListener('keydown', onKey, true)
    return () => document.removeEventListener('keydown', onKey, true)
  }, [onClose])

  const rec = bill.record || {}
  const po = rec.po
  const site = rec.site
  const fileName = kind === 'bill' ? bill.document : kind === 'po' ? po?.document : site?.document

  let body
  if (kind === 'bill') {
    body = (
      <>
        <header className="voucher-head">
          <div>
            <div className="voucher-company">{rec.supplierOnBill || bill.vendor}</div>
            <div className="cell-sub">GSTIN: {rec.gstin || 'not shown'}</div>
          </div>
          <div className="voucher-no">
            <div className="voucher-title">Tax Invoice</div>
            <div>No. <b>{bill.billNo}</b></div>
            <div>Date {formatDate(bill.date)}</div>
          </div>
        </header>
        <dl className="voucher-grid">
          <dt>Bill to</dt><dd>BuildDesk Demo Builders</dd>
          <dt>Project</dt><dd>{rec.projectOnBill || bill.projectName}</dd>
          <dt>Description</dt><dd>{rec.description || bill.category}</dd>
          {rec.period && <><dt>Service period</dt><dd>{formatDate(rec.period.from)} – {formatDate(rec.period.to)}</dd></>}
          {rec.equipment && <><dt>Equipment</dt><dd>{rec.equipment}</dd></>}
        </dl>
        {rec.lines ? <Lines lines={rec.lines} gstRate={rec.gstRate || 0} /> : <p>Total amount: <b>{formatINR(bill.amount)}</b> (no itemised lines in the demo record)</p>}
      </>
    )
  } else if (kind === 'po' && po) {
    body = (
      <>
        <header className="voucher-head">
          <div>
            <div className="voucher-company">BuildDesk Demo Builders</div>
            <div className="cell-sub">Purchase department · issued by {po.issuedBy}</div>
          </div>
          <div className="voucher-no">
            <div className="voucher-title">{po.type}</div>
            <div>No. <b>{po.id}</b></div>
            <div>Date {formatDate(po.date)}</div>
          </div>
        </header>
        <dl className="voucher-grid">
          <dt>Supplier</dt><dd>{po.supplier}</dd>
          <dt>Supplier GSTIN</dt><dd>{po.gstin || 'Not GST-registered'}</dd>
          <dt>Project</dt><dd>{po.project}</dd>
        </dl>
        <Lines lines={po.lines} gstRate={po.gstRate || 0} quantityNote="As per site record" />
        <h4 className="doc-h4">Terms</h4>
        <ol className="terms">{po.terms.map((t) => <li key={t}>{t}</li>)}</ol>
        {po.advances?.length > 0 && (
          <>
            <h4 className="doc-h4">Advance paid</h4>
            <table className="doc-lines">
              <thead><tr><th>Date</th><th>Purpose</th><th>Reference</th><th className="num">Amount</th></tr></thead>
              <tbody>{po.advances.map((a) => <tr key={a.id}><td>{formatDate(a.date)}</td><td>{a.purpose}</td><td>{a.mode} {a.reference}</td><td className="num">{formatINR(a.amount)}</td></tr>)}</tbody>
            </table>
          </>
        )}
      </>
    )
  } else if (kind === 'site' && site?.status === 'Confirmed') {
    body = (
      <>
        <header className="voucher-head">
          <div>
            <div className="voucher-company">{bill.projectName}</div>
            <div className="cell-sub">Site record</div>
          </div>
          <div className="voucher-no">
            <div className="voucher-title">Site Confirmation</div>
            <div>Date {formatDate(site.date)}</div>
          </div>
        </header>
        <dl className="voucher-grid">
          <dt>Supplier</dt><dd>{bill.vendor}</dd>
          <dt>Work / service</dt><dd>{rec.description || bill.category}</dd>
          {rec.equipment && <><dt>Equipment</dt><dd>{rec.equipment}</dd></>}
          <dt>Confirmed by</dt><dd>{site.by}{site.role ? `, ${site.role}` : ''}</dd>
        </dl>
        <table className="doc-lines">
          <thead><tr><th>Item</th><th className="num">Confirmed quantity</th></tr></thead>
          <tbody>
            {site.lines.map((l) => <tr key={l.item}><td>{rec.lines?.find((x) => x.item === l.item)?.desc || l.item}</td><td className="num">{l.qty} {l.unit}</td></tr>)}
          </tbody>
        </table>
        {site.note && <p className="voucher-line" style={{ marginTop: 12 }}>Remarks: {site.note}</p>}
        <div className="voucher-foot"><span /><span className="voucher-sign">{site.by}</span></div>
      </>
    )
  } else {
    body = <div className="empty sm">This record is not available yet.</div>
  }

  return (
    <div className="voucher-scrim" onClick={(e) => { e.stopPropagation(); onClose() }}>
      <div className="voucher-dialog" role="dialog" aria-modal="true" aria-label={`Preview: ${fileName || kind}`} onClick={(e) => e.stopPropagation()}>
        <div className="voucher-actions no-print">
          <span className="cell-sub doc-file"><Icon name="file" size={14} /> {fileName || 'No file'}</span>
          <button ref={closeRef} className="btn" onClick={onClose}>Close</button>
        </div>
        <article className="voucher">
          <div className="voucher-watermark" aria-hidden="true">DEMO</div>
          {body}
          <p className="voucher-demo">DEMO PREVIEW generated from the demo record. The original file is not stored or read in this prototype.</p>
        </article>
      </div>
    </div>
  )
}
