import { useState } from 'react'
import DataTable from '../../components/DataTable.jsx'
import StatGrid from '../../components/StatGrid.jsx'
import { Badge, Card, Progress } from '../../components/UI.jsx'
import { materialOf } from '../../services/inventory.js'
import { siteOf } from '../../services/site.js'
import { addDays, todayISO } from '../../utils/date.js'
import { formatDate } from '../../utils/format.js'
import { Drawer, FormError, Locked } from '../store-keeper/shared.jsx'
import { siteData } from './derive.js'
import { projectIdOfSite, SiteSelect, useSiteEngineer } from './shared.jsx'

const since = () => addDays(todayISO(), -6)

function RequestForm({ ctx, equipment }) {
  const sites = ctx.mySites
  const [f, setF] = useState({ kind: 'Requirement', siteId: sites.length === 1 ? sites[0].id : '', equipmentId: '', name: '', from: addDays(todayISO(), 3), to: '', note: '' })
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value })
  return (
    <form className="receipt-form" onSubmit={(e) => { e.preventDefault(); if (ctx.act('requestEquipment', { ...f, projectId: projectIdOfSite(f.siteId) })) setF({ ...f, name: '', note: '', equipmentId: '' }) }} noValidate>
      <div className="sub-panel-head"><b>Raise an equipment request</b><span className="cell-sub">Requirement, breakdown or maintenance; Admin / Project Manager arrange it</span></div>
      <div className="receipt-grid se-grid-4">
        <label className="field">Type<select value={f.kind} onChange={(e) => setF({ ...f, kind: e.target.value, from: e.target.value === 'Requirement' ? addDays(todayISO(), 3) : todayISO() })}><option>Requirement</option><option>Breakdown</option><option>Maintenance</option></select></label>
        <SiteSelect value={f.siteId} sites={sites} onChange={(v) => setF({ ...f, siteId: v })} />
        {f.kind === 'Requirement'
          ? <label className="field">Equipment needed<input value={f.name} onChange={set('name')} placeholder="e.g. Concrete pump" /></label>
          : <label className="field">Equipment<select value={f.equipmentId} onChange={set('equipmentId')}><option value="">Select…</option>{equipment.map((q) => <option key={q.id} value={q.id}>{q.id} · {q.name}</option>)}</select></label>}
        <label className="field">{f.kind === 'Requirement' ? 'Needed from' : 'Date'}<input type="date" value={f.from} onChange={set('from')} /></label>
        {f.kind === 'Requirement' && <label className="field">Needed until<input type="date" min={f.from} value={f.to} onChange={set('to')} /></label>}
        <label className="field span-2">Details<input value={f.note} onChange={set('note')} /></label>
      </div>
      <div className="sk-form-foot"><FormError error={ctx.error} /><div className="jv-submit"><button className="btn btn-primary" type="submit">Raise request</button></div></div>
    </form>
  )
}

function EquipmentView({ q, ctx, logs, onClose }) {
  const [f, setF] = useState({ date: todayISO(), hours: '', downtime: '0', reason: '' })
  const reqs = ctx.site.state.equipmentRequests.filter((r) => r.equipmentId === q.id)
  return (
    <Drawer title={`${q.id} · ${q.name}`} sub={`${q.category} · ${q.ownership} · ${siteOf(q.siteId)?.name}`} onClose={onClose}>
      <dl className="details"><dt>Status</dt><dd><Badge>{q.status}</Badge>{q.note ? ` ${q.note}` : ''}</dd><dt>Planned use</dt><dd>{q.hoursPerDay} h / day</dd></dl>
      <section className="drawer-section"><h3>Usage log</h3>
        <DataTable rows={[...logs].sort((a, b) => b.date.localeCompare(a.date))} columns={[
          { key: 'date', header: 'Date', render: (l) => formatDate(l.date) }, { key: 'hours', header: 'Worked (h)', align: 'num' },
          { key: 'downtime', header: 'Downtime (h)', align: 'num' }, { key: 'reason', header: 'Reason', render: (l) => l.reason || '—' },
        ]} />
      </section>
      {ctx.perms.work && (
        <form className="receipt-form" style={{ marginTop: 12 }} onSubmit={(e) => { e.preventDefault(); if (ctx.act('logEquipment', { equipmentId: q.id, ...f })) setF({ ...f, hours: '', reason: '' }) }} noValidate>
          <div className="sub-panel-head"><b>Log usage</b></div>
          <div className="receipt-grid">
            <label className="field">Date<input type="date" max={todayISO()} value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} /></label>
            <label className="field">Hours worked<input type="number" min="0" max="24" step="0.5" value={f.hours} onChange={(e) => setF({ ...f, hours: e.target.value })} /></label>
            <label className="field">Downtime (h)<input type="number" min="0" max="24" step="0.5" value={f.downtime} onChange={(e) => setF({ ...f, downtime: e.target.value })} /></label>
            <label className="field">Downtime reason<input value={f.reason} onChange={(e) => setF({ ...f, reason: e.target.value })} /></label>
          </div>
          <div className="sk-form-foot"><FormError error={ctx.error} /><div className="jv-submit"><button className="btn btn-primary" type="submit">Save log</button></div></div>
        </form>
      )}
      {reqs.length > 0 && <section className="drawer-section"><h3>Requests & breakdowns</h3>{reqs.map((r) => <div key={r.id} className="cell-sub">{r.id} · {r.kind} · {formatDate(r.from)} · {r.status}: {r.note}</div>)}</section>}
    </Drawer>
  )
}

export default function Equipment({ notify }) {
  const ctx = useSiteEngineer(notify)
  const d = siteData(ctx)
  const [view, setView] = useState(null)
  const s = ctx.site.state
  const from = since()
  const util = (q) => {
    const logs = s.equipmentLogs.filter((l) => l.equipmentId === q.id && l.date >= from)
    const hours = logs.reduce((t, l) => t + l.hours, 0)
    const down = logs.reduce((t, l) => t + l.downtime, 0)
    return { logs, hours, down, pct: Math.round((hours / (q.hoursPerDay * 7)) * 100) }
  }
  const rows = d.equipment.map((q) => ({ ...q, u: util(q) }))
  const requests = s.equipmentRequests.filter(ctx.inScope).sort((a, b) => b.at.localeCompare(a.at))
  // Fuel: diesel issued by the store to your sites (stock issue records; not entered here)
  const reqById = Object.fromEntries(ctx.inv.state.requests.map((r) => [r.id, r]))
  const fuel = ctx.inv.state.issues.filter((i) => reqById[i.requestId]?.sku === 'MAT-DSL' && ctx.scope.siteIds.includes(reqById[i.requestId]?.siteId))
  const viewing = view && rows.find((q) => q.id === view)

  return (
    <>
      <StatGrid items={[
        { label: 'Equipment on your sites', value: rows.length },
        { label: 'Available / working', value: rows.filter((q) => ['Working', 'Idle'].includes(q.status)).length },
        { label: 'Breakdowns', value: rows.filter((q) => q.status === 'Breakdown').length, tone: rows.some((q) => q.status === 'Breakdown') ? 'danger' : undefined },
        { label: 'Downtime, last 7 days', value: `${rows.reduce((t, q) => t + q.u.down, 0)} h` },
      ]} />
      <Card title="Equipment & machinery" sub="Company-owned and hired equipment on your sites (hired items reference PO-2311)" bodyClass="">
        <DataTable dense rows={rows} emptyText="No equipment on your sites." columns={[
          { key: 'n', header: 'Equipment', render: (q) => <><button className="link-btn" onClick={() => setView(q.id)}>{q.name}</button><div className="cell-sub">{q.id} · {q.category}</div></> },
          { key: 'o', header: 'Ownership', render: (q) => <span className="cell-sub wrap-cell">{q.ownership}</span> },
          { key: 's', header: 'Site', render: (q) => siteOf(q.siteId)?.name },
          { key: 'a', header: 'Availability', render: (q) => <Badge tone={q.status === 'Breakdown' ? 'danger' : q.status === 'Idle' ? 'muted' : 'success'}>{q.status === 'Breakdown' ? 'Not available' : 'Available'}</Badge> },
          { key: 'st', header: 'Operating status', render: (q) => <>{q.status}{q.note && <div className="cell-sub wrap-cell">{q.note}</div>}</> },
          { key: 'u', header: 'Utilisation (7 days)', render: (q) => <div style={{ minWidth: 120 }}><div className="prog-row"><span>{q.u.hours} h</span><b>{q.u.pct}%</b></div><Progress value={q.u.pct} /></div> },
          { key: 'd', header: 'Downtime', align: 'num', render: (q) => `${q.u.down} h` },
          { key: 'x', header: '', render: (q) => <button className="btn btn-sm" onClick={() => setView(q.id)}>History</button> },
        ]} />
      </Card>
      <Card title="Requests, breakdowns & maintenance" sub="Raised from your sites" bodyClass="" className="section-gap">
        <DataTable dense rows={requests} emptyText="No requests." columns={[
          { key: 'id', header: 'Ref.', render: (r) => <><div className="cell-main">{r.id}</div><div className="cell-sub">{r.kind}</div></> },
          { key: 'n', header: 'Equipment', render: (r) => r.name },
          { key: 'd', header: 'Dates', render: (r) => `${formatDate(r.from)}${r.to ? ` → ${formatDate(r.to)}` : ''}` },
          { key: 'note', header: 'Details', render: (r) => <span className="wrap-cell">{r.note}</span> },
          { key: 'b', header: 'Raised by', render: (r) => r.requestedBy },
          { key: 's', header: 'Status', render: (r) => <Badge>{r.status}</Badge> },
        ]} />
        <div style={{ padding: 14 }}>{ctx.perms.work ? <RequestForm ctx={ctx} equipment={d.equipment} /> : <Locked>View only</Locked>}</div>
      </Card>
      <Card title="Fuel usage" sub="Diesel issued by the store to your sites (from stock issue records)" bodyClass="" className="section-gap">
        <DataTable rows={fuel} emptyText="No diesel issued to your sites in the store records." columns={[
          { key: 'id', header: 'Issue' }, { key: 'd', header: 'Date', render: (i) => formatDate(i.at.slice(0, 10)) },
          { key: 'q', header: 'Quantity', align: 'num', render: (i) => `${i.qty} ${materialOf('MAT-DSL').unit}` }, { key: 'r', header: 'Received by', render: (i) => i.receivedBy },
        ]} />
      </Card>
      {viewing && <EquipmentView q={viewing} ctx={ctx} logs={viewing.u.logs} onClose={() => setView(null)} />}
    </>
  )
}
