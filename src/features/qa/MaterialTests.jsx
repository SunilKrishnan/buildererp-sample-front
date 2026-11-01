import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import DataTable from '../../components/DataTable.jsx'
import Icon from '../../components/Icon.jsx'
import { Badge, Card } from '../../components/UI.jsx'
import { TEST_TYPES } from '../../data/demo/qaDemo.js'
import { materialOf } from '../../services/inventory.js'
import * as Q from '../../services/qa.js'
import { formatDate, formatNumber } from '../../utils/format.js'
import { Drawer, FormError, HistoryList, Locked } from '../store-keeper/shared.jsx'
import { docRefLabel, materialName, useQA } from './shared.jsx'

/** GRN facts come from the Store Keeper's records (read only here). */
function GrnFacts({ ctx, t }) {
  const g = t.grnId && ctx.inv.state.receipts.find((x) => x.id === t.grnId)
  const po = t.poId && ctx.inv.state.purchaseOrders.find((p) => p.id === t.poId)
  if (!g && !po) return <span className="cell-sub">{t.source || '—'}</span>
  return (
    <>
      <div>{po?.vendor || g?.supplier || '—'}</div>
      <div className="cell-sub">{t.poId || '—'} · {t.grnId || 'GRN before stock records'}</div>
      {g && <div className="cell-sub">Store: {formatNumber(g.delivered)} delivered · {g.accepted == null ? 'inspection pending' : `${formatNumber(g.accepted)} accepted · ${formatNumber(g.rejected)} rejected`}</div>}
    </>
  )
}

function Register({ ctx, onClose }) {
  const grns = [...ctx.inv.state.receipts].sort((a, b) => b.deliveryDate.localeCompare(a.deliveryDate))
  const [f, setF] = useState({ grnId: grns[0]?.id || '', testType: TEST_TYPES[0], lab: '', sampleRef: '', sampleDate: ctx.today, batch: '', spec: 'SP-03', external: true })
  const set = (k) => (e) => setF({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value })
  const g = grns.find((x) => x.id === f.grnId)
  return (
    <Drawer title="Register sample / certificate" sub="Linked to the Store Keeper's goods receipt; QA never changes received, accepted or rejected quantities" onClose={() => { ctx.setError(''); onClose() }}>
      <div className="receipt-form">
        <div className="receipt-grid">
          <label className="field span-2">Goods receipt (GRN)<select value={f.grnId} onChange={set('grnId')}>{grns.map((x) => <option key={x.id} value={x.id}>{x.id} · {x.po} · {materialOf(x.sku)?.name} · {x.supplier}</option>)}</select></label>
          {g && <p className="cell-sub span-2">Store record: {formatNumber(g.delivered)} {materialOf(g.sku)?.unit} delivered {formatDate(g.deliveryDate)} · {g.status}</p>}
          <label className="field">Test type<select value={f.testType} onChange={set('testType')}>{TEST_TYPES.map((t) => <option key={t}>{t}</option>)}</select></label>
          <label className="field">Laboratory / organisation<input value={f.lab} onChange={set('lab')} placeholder="e.g. TPI Labs, supplier certificate" /></label>
          <label className="field">Sample / test reference<input value={f.sampleRef} onChange={set('sampleRef')} /></label>
          <label className="field">Batch / lot (if available)<input value={f.batch} onChange={set('batch')} /></label>
          <label className="field">Sample date<input type="date" max={ctx.today} value={f.sampleDate} onChange={set('sampleDate')} /></label>
          <label className="field">Applicable specification<select value={f.spec} onChange={set('spec')}><option value="">To be confirmed</option>{ctx.s.documents.filter((d) => d.revisions.some((r) => r.status === 'Approved')).map((d) => <option key={d.id} value={d.id}>{docRefLabel(ctx.s, d.id)}</option>)}</select></label>
          <label className="check-row span-2"><input type="checkbox" checked={f.external} onChange={set('external')} /> Sent to an external laboratory (awaiting report)</label>
        </div>
        <div className="sk-form-foot"><FormError error={ctx.error} /><div className="jv-submit"><button className="btn btn-primary" onClick={() => ctx.act('registerMaterialTest', { ...f, receipts: ctx.inv.state.receipts }) && onClose()}>Register</button><button className="btn" onClick={onClose}>Cancel</button></div></div>
      </div>
    </Drawer>
  )
}

function TestDrawer({ ctx, t, onClose }) {
  const [mode, setMode] = useState(null) // 'report' | 'review'
  const [rep, setRep] = useState({ testDate: ctx.today, reportRef: '', reportFile: '', results: [{ parameter: '', value: '', unit: '' }] })
  const [rev, setRev] = useState({ decision: 'Accepted', note: '' })
  return (
    <Drawer title={`${t.id} · ${materialName(t)}`} sub={`${t.testType} · ${t.lab}`} onClose={() => { ctx.setError(''); onClose() }} wide>
      <dl className="details">
        <dt>Status</dt><dd><Badge>{t.status}</Badge></dd>
        <dt>Material</dt><dd>{materialName(t)}{t.sku ? ` (${t.sku})` : ''}</dd>
        <dt>Supplier / PO / GRN</dt><dd><GrnFacts ctx={ctx} t={t} /></dd>
        <dt>Batch / lot</dt><dd>{t.batch || '—'}</dd>
        <dt>Sample ref.</dt><dd>{t.sampleRef} · sampled {formatDate(t.sampleDate)}</dd>
        <dt>Test date</dt><dd>{t.testDate ? formatDate(t.testDate) : 'Not tested yet'}</dd>
        <dt>Specification</dt><dd>{t.spec ? docRefLabel(ctx.s, t.spec) : 'To be confirmed'}</dd>
        <dt>Report</dt><dd>{t.reportRef || 'Not received'}{t.reportFile ? ` · ${t.reportFile} (demo: file name only)` : ''}</dd>
        <dt>Reviewer</dt><dd>{t.reviewer ? `${t.reviewer}${t.reviewNote ? ` · ${t.reviewNote}` : ''}` : '—'}</dd>
      </dl>
      {t.results.length > 0 && (
        <div className="table-wrap" style={{ marginTop: 10 }}><table className="qa-check"><thead><tr><th>Parameter</th><th>Result (as stated in the report)</th><th>Unit</th></tr></thead>
          <tbody>{t.results.map((r, i) => <tr key={i}><td>{r.parameter}</td><td>{r.value}</td><td>{r.unit}</td></tr>)}</tbody></table></div>
      )}
      <p className="cell-sub" style={{ marginTop: 8 }}>Demo values are illustrative. A material is accepted only by a QA review of the recorded report; stock quantities stay with the Store Keeper.</p>
      {ctx.perms.manage && !mode && (
        <div className="jv-submit" style={{ marginTop: 12 }}>
          {['Sample Taken', 'Awaiting Report', 'Retest Required'].includes(t.status) && <button className="btn btn-primary" onClick={() => setMode('report')}>Record report received</button>}
          {t.status === 'Report Received' && ctx.perms.review && <button className="btn btn-primary" onClick={() => setMode('review')}>Review result</button>}
        </div>
      )}
      {mode === 'report' && (
        <div className="receipt-form" style={{ marginTop: 12 }}>
          <div className="receipt-grid">
            <label className="field">Test date<input type="date" max={ctx.today} value={rep.testDate} onChange={(e) => setRep({ ...rep, testDate: e.target.value })} /></label>
            <label className="field">Report / certificate ref.<input value={rep.reportRef} onChange={(e) => setRep({ ...rep, reportRef: e.target.value })} /></label>
            <label className="field span-2">Report attachment<input type="file" onChange={(e) => setRep({ ...rep, reportFile: e.target.files?.[0]?.name || '' })} /><span className="cell-sub">Demo: only the file name is kept; nothing is uploaded.</span></label>
          </div>
          {rep.results.map((r, i) => (
            <div key={i} className="receipt-grid qa-meas">
              <label className="field">Parameter<input value={r.parameter} onChange={(e) => setRep({ ...rep, results: rep.results.map((x, j) => (j === i ? { ...x, parameter: e.target.value } : x)) })} /></label>
              <label className="field">Result as stated<input value={r.value} onChange={(e) => setRep({ ...rep, results: rep.results.map((x, j) => (j === i ? { ...x, value: e.target.value } : x)) })} /></label>
              <label className="field">Unit<input value={r.unit} onChange={(e) => setRep({ ...rep, results: rep.results.map((x, j) => (j === i ? { ...x, unit: e.target.value } : x)) })} /></label>
            </div>
          ))}
          <button type="button" className="link-btn" style={{ marginLeft: 18 }} onClick={() => setRep({ ...rep, results: [...rep.results, { parameter: '', value: '', unit: '' }] })}>+ Add result</button>
          <div className="sk-form-foot"><FormError error={ctx.error} /><div className="jv-submit"><button className="btn btn-primary" onClick={() => ctx.act('recordTestReport', { id: t.id, ...rep }) && setMode(null)}>Save report</button><button className="btn" onClick={() => setMode(null)}>Cancel</button></div></div>
        </div>
      )}
      {mode === 'review' && (
        <div className="receipt-form" style={{ marginTop: 12 }}>
          <div className="receipt-grid">
            <label className="field">Decision<select value={rev.decision} onChange={(e) => setRev({ ...rev, decision: e.target.value })}><option>Accepted</option><option>Rejected</option><option>Retest Required</option></select></label>
            <label className="field">{rev.decision === 'Accepted' ? 'Note (optional)' : 'Reason (required)'}<input value={rev.note} onChange={(e) => setRev({ ...rev, note: e.target.value })} /></label>
          </div>
          <div className="sk-form-foot"><FormError error={ctx.error} /><div className="jv-submit"><button className="btn btn-primary" onClick={() => ctx.act('reviewMaterialTest', { id: t.id, ...rev }) && setMode(null)}>Record decision</button><button className="btn" onClick={() => setMode(null)}>Cancel</button></div></div>
        </div>
      )}
      <div className="sub-panel-head" style={{ marginTop: 14 }}><b>History</b></div>
      <HistoryList items={[...t.history].reverse()} />
    </Drawer>
  )
}

export default function MaterialTests({ notify, search }) {
  const ctx = useQA(notify)
  const [params, setParams] = useSearchParams()
  const [status, setStatus] = useState(params.get('status') || 'all')
  const [adding, setAdding] = useState(params.get('new') === '1')
  const openId = params.get('open')
  const q = (search || '').toLowerCase()
  const rows = ctx.s.materialTests
    .filter((t) => status === 'all' || (status === 'pending' ? ['Sample Taken', 'Awaiting Report', 'Report Received', 'Retest Required'].includes(t.status) : t.status === status))
    .filter((t) => !q || `${t.id} ${materialName(t)} ${t.grnId} ${t.poId} ${t.testType} ${t.lab}`.toLowerCase().includes(q))
    .sort((a, b) => b.sampleDate.localeCompare(a.sampleDate))
  const current = openId && ctx.s.materialTests.find((t) => t.id === openId)
  return (
    <>
      <div className="info-note"><span>ℹ</span><div>The Store Keeper records receipt, accepted and rejected quantities on the GRN. QA records certificates and test results against that GRN and decides on the evidence. A QA rejection is shown to the Store Keeper and Purchase Manager; it does not change stock here.</div></div>
      <Card title="Material quality & test records" bodyClass=""
        action={ctx.perms.manage ? <button className="btn btn-primary btn-sm" onClick={() => setAdding(true)}><Icon name="plus" size={14} />Register sample</button> : <Locked>View only</Locked>}>
        <div className="toolbar"><label className="field">Status<select value={status} onChange={(e) => setStatus(e.target.value)}><option value="all">All</option><option value="pending">Pending (not reviewed)</option>{Q.TEST_STATUSES.map((s) => <option key={s}>{s}</option>)}</select></label></div>
        <DataTable dense rows={rows} emptyText="No material test records match." columns={[
          { key: 'id', header: 'Test', render: (t) => <><button className="link-btn" onClick={() => setParams({ open: t.id })}>{t.id}</button><div className="cell-sub">{t.sampleRef}</div></> },
          { key: 'm', header: 'Material', render: (t) => <>{materialName(t)}<div className="cell-sub">{t.sku || ''}{t.batch ? ` · ${t.batch}` : ''}</div></> },
          { key: 'g', header: 'Supplier / PO / GRN', render: (t) => <GrnFacts ctx={ctx} t={t} /> },
          { key: 't', header: 'Test / laboratory', render: (t) => <span className="wrap-cell">{t.testType}<div className="cell-sub">{t.lab}</div></span> },
          { key: 'd', header: 'Sampled / tested', render: (t) => <>{formatDate(t.sampleDate)}<div className="cell-sub">{t.testDate ? formatDate(t.testDate) : 'awaiting test'}</div></> },
          { key: 'r', header: 'Report', render: (t) => <span className="cell-sub">{t.reportRef || '—'}</span> },
          { key: 's', header: 'Status', render: (t) => <><Badge>{t.status}</Badge>{t.reviewer && <div className="cell-sub">{t.reviewer}</div>}</> },
          { key: 'x', header: '', render: (t) => <button className={`btn btn-sm ${t.status === 'Report Received' && ctx.perms.review ? 'btn-primary' : ''}`} onClick={() => setParams({ open: t.id })}>{t.status === 'Report Received' && ctx.perms.review ? 'Review' : 'View'}</button> },
        ]} />
      </Card>
      {adding && <Register ctx={ctx} onClose={() => { setAdding(false); if (params.get('new')) setParams({}) }} />}
      {current && <TestDrawer key={current.id} ctx={ctx} t={current} onClose={() => setParams({})} />}
    </>
  )
}
