import { useState } from 'react'
import DataTable from '../../components/DataTable.jsx'
import { Badge, Card, Progress } from '../../components/UI.jsx'
import { todayISO } from '../../utils/date.js'
import { formatDate } from '../../utils/format.js'
import { Drawer, fmtStamp, FormError, Locked } from '../store-keeper/shared.jsx'
import { siteData } from './derive.js'
import { PhotoInput, PhotoStrip, useSiteEngineer } from './shared.jsx'

function BoqView({ b, ctx, onClose }) {
  const [m, setM] = useState({ date: todayISO(), qty: '', details: '', sheetRef: '', photos: [] })
  const [rev, setRev] = useState({ to: '', reason: '' })
  const entries = ctx.site.state.measurements.filter((x) => x.boqId === b.id).sort((a, c) => c.date.localeCompare(a.date))
  const free = Math.round((b.executed - b.measuredVerified - b.measuredPending) * 100) / 100
  return (
    <Drawer title={`${b.id} · ${b.unit}`} sub={b.description} onClose={onClose} wide>
      <div className="stat-grid compact-stats" style={{ marginTop: 0 }}>
        <div className="stat"><div className="k">Approved</div><div className="v">{b.approvedQty}</div><div className="s">{b.originalQty !== b.approvedQty ? `original ${b.originalQty}` : 'as tendered'}</div></div>
        <div className="stat"><div className="k">Executed</div><div className="v">{b.executed}</div><div className="s">{b.pct}% · this week {b.thisPeriod}</div></div>
        <div className="stat"><div className="k">Remaining</div><div className="v">{b.remaining}</div></div>
        <div className="stat"><div className="k">Measured</div><div className="v">{b.measuredVerified}</div><div className="s">+{b.measuredPending} pending · {free} not measured</div></div>
      </div>

      <section className="drawer-section">
        <h3>Measurement book</h3>
        <DataTable rows={entries} emptyText="No measurements yet." columns={[
          { key: 'id', header: 'Ref.', render: (x) => <><div className="cell-main">{x.id}</div><div className="cell-sub">{x.sheetRef}</div></> },
          { key: 'date', header: 'Date', render: (x) => formatDate(x.date) },
          { key: 'qty', header: 'Quantity', align: 'num', render: (x) => `${x.qty} ${b.unit}` },
          { key: 'details', header: 'Measurement details', render: (x) => <span className="wrap-cell">{x.details}</span> },
          { key: 'st', header: 'Verification', render: (x) => <><Badge>{x.status}</Badge>{x.verifiedBy && <div className="cell-sub">{x.verifiedBy}</div>}</> },
          { key: 'pm', header: '', render: (x) => (x.status === 'Pending Verification' ? <span className="cell-sub">With Project Manager</span> : null) },
        ]} />
        {entries.some((x) => x.photos?.length) && entries.map((x) => <PhotoStrip key={x.id} photos={x.photos} />)}
      </section>

      {ctx.perms.work ? (
        <form className="receipt-form" onSubmit={(e) => { e.preventDefault(); if (ctx.act('addMeasurement', { boqId: b.id, ...m })) setM({ ...m, qty: '', details: '', sheetRef: '', photos: [] }) }} noValidate>
          <div className="sub-panel-head"><b>Record measurement</b><span className="cell-sub">Up to {free} {b.unit} of executed work is not yet measured</span></div>
          <div className="receipt-grid">
            <label className="field">Measurement date<input type="date" max={todayISO()} value={m.date} onChange={(e) => setM({ ...m, date: e.target.value })} /></label>
            <label className="field">Quantity ({b.unit})<input type="number" min="0" step="0.01" value={m.qty} onChange={(e) => setM({ ...m, qty: e.target.value })} /></label>
            <label className="field span-2">Measurement details (L × B × D, pour cards, BBS…)<input value={m.details} onChange={(e) => setM({ ...m, details: e.target.value })} /></label>
            <label className="field">Measurement sheet ref.<input value={m.sheetRef} onChange={(e) => setM({ ...m, sheetRef: e.target.value })} placeholder="Auto if blank" /></label>
            <PhotoInput value={m.photos} onChange={(photos) => setM({ ...m, photos })} label="Photos / measurement sheets" />
          </div>
          <div className="sk-form-foot"><FormError error={ctx.error} /><div className="jv-submit"><button className="btn btn-primary" type="submit">Record measurement</button></div></div>
        </form>
      ) : <Locked>View only</Locked>}

      <section className="drawer-section">
        <h3>Approved quantity revisions</h3>
        {(b.revisions || []).length === 0 ? <p className="cell-sub">No revisions. The approved quantity is as tendered.</p> : (
          <DataTable rows={b.revisions} columns={[
            { key: 'id', header: 'Revision' }, { key: 'q', header: 'Change', render: (r) => `${r.from} → ${r.to} ${b.unit}` },
            { key: 'reason', header: 'Reason', render: (r) => <span className="wrap-cell">{r.reason}</span> },
            { key: 'by', header: 'Requested', render: (r) => <>{r.requestedBy}<div className="cell-sub">{fmtStamp(r.requestedAt)}</div></> },
            { key: 's', header: 'Decision', render: (r) => <><Badge>{r.status}</Badge>{r.decidedBy && <div className="cell-sub">{r.decidedBy}</div>}</> },
          ]} />
        )}
        {b.pendingRevision ? (
          <div className="info-note" style={{ marginTop: 10 }}><span>ℹ</span><div>Revision {b.pendingRevision.id} ({b.pendingRevision.from} → {b.pendingRevision.to} {b.unit}) is with the Project Manager. Until approved, the approved quantity stays {b.approvedQty}.</div></div>
        ) : ctx.perms.work && (
          <form className="receipt-form" style={{ marginTop: 10 }} onSubmit={(e) => { e.preventDefault(); if (ctx.act('requestBoqRevision', { id: b.id, ...rev })) setRev({ to: '', reason: '' }) }} noValidate>
            <div className="sub-panel-head"><b>Request a revision</b><span className="cell-sub">Never changed silently: the Project Manager must approve</span></div>
            <div className="receipt-grid">
              <label className="field">Proposed approved quantity ({b.unit})<input type="number" min="0" step="0.01" value={rev.to} onChange={(e) => setRev({ ...rev, to: e.target.value })} /></label>
              <label className="field">Reason / reference<input value={rev.reason} onChange={(e) => setRev({ ...rev, reason: e.target.value })} placeholder="e.g. S-101 R2 increased F9–F12" /></label>
            </div>
            <div className="sk-form-foot"><div className="jv-submit"><button className="btn" type="submit">Send for approval</button></div></div>
          </form>
        )}
      </section>
      <FormError error={ctx.error} />
    </Drawer>
  )
}

export default function Measurements({ notify, search }) {
  const ctx = useSiteEngineer(notify)
  const d = siteData(ctx)
  const [view, setView] = useState(null)
  const q = (search || '').toLowerCase()
  const rows = d.boq.filter((b) => !q || `${b.id} ${b.description}`.toLowerCase().includes(q))
  const viewing = view && d.boq.find((b) => b.id === view)
  const verification = (b) => (b.executed === 0 ? 'Not started' : b.measuredVerified >= b.executed ? 'Fully measured' : b.measuredPending > 0 ? 'Pending verification' : 'Measurement due')

  return (
    <>
      <div className="info-note"><span>ℹ</span><div>Executed = completed quantity from submitted daily reports. Remaining = approved − executed. Measurements certify executed work and cannot exceed it. Approved quantities change only through a revision approved by the Project Manager.</div></div>
      <Card title="BOQ tracking" sub="Your sites' bill of quantities" bodyClass="">
        <DataTable dense rows={rows} emptyText="No BOQ items." columns={[
          { key: 'id', header: 'BOQ item', render: (b) => <><button className="link-btn" onClick={() => setView(b.id)}>{b.id}</button><div className="cell-sub wrap-cell">{b.description}</div></> },
          { key: 'u', header: 'Unit', render: (b) => b.unit },
          { key: 'a', header: 'Approved', align: 'num', render: (b) => <>{b.approvedQty}{b.originalQty !== b.approvedQty && <div className="cell-sub">rev. from {b.originalQty}</div>}{b.pendingRevision && <div className="cell-sub down">revision pending</div>}</> },
          { key: 'p', header: 'Planned (tasks)', align: 'num', render: (b) => b.planned },
          { key: 't', header: 'This week', align: 'num', render: (b) => b.thisPeriod },
          { key: 'e', header: 'Executed', align: 'num', render: (b) => <b>{b.executed}</b> },
          { key: 'r', header: 'Remaining', align: 'num', render: (b) => b.remaining },
          { key: 'pc', header: 'Progress', render: (b) => <div style={{ minWidth: 110 }}><div className="prog-row"><span /><b>{b.pct}%</b></div><Progress value={b.pct} tone={b.pct >= 100 ? 'ok' : ''} /></div> },
          { key: 'm', header: 'Measured', align: 'num', render: (b) => <>{b.measuredVerified}{b.measuredPending > 0 && <div className="cell-sub">+{b.measuredPending} pending</div>}</> },
          { key: 'v', header: 'Verification', render: (b) => <Badge>{verification(b)}</Badge> },
        ]} />
      </Card>
      {viewing && <BoqView key={viewing.id} b={viewing} ctx={ctx} onClose={() => setView(null)} />}
    </>
  )
}
