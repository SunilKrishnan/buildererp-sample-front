import { useState } from 'react'
import DataTable from '../../components/DataTable.jsx'
import StatGrid from '../../components/StatGrid.jsx'
import { Badge, Card, Progress } from '../../components/UI.jsx'
import { LABOUR_CATEGORIES } from '../../data/demo/adminDashboardDemo.js'
import { labourNeed, siteOf, supervisorOf } from '../../services/site.js'
import { addDays, todayISO } from '../../utils/date.js'
import { formatDate, formatDateShort } from '../../utils/format.js'
import { FormError, Locked } from '../store-keeper/shared.jsx'
import { siteData } from './derive.js'
import { projectIdOfSite, SiteSelect, useSiteEngineer } from './shared.jsx'

function RequestForm({ ctx }) {
  const sites = ctx.mySites
  const [f, setF] = useState({ kind: 'Requirement', siteId: sites.length === 1 ? sites[0].id : '', category: 'Bar Bender', qty: '', hours: '2', neededBy: addDays(todayISO(), 2), note: '' })
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value })
  return (
    <form className="receipt-form" onSubmit={(e) => { e.preventDefault(); if (ctx.act('requestLabour', { ...f, projectId: projectIdOfSite(f.siteId) })) setF({ ...f, qty: '', note: '' }) }} noValidate>
      <div className="sub-panel-head"><b>Request labour or overtime</b><span className="cell-sub">Goes to the Site Supervisor and Project Manager; you do not allocate workers or record attendance</span></div>
      <div className="receipt-grid se-grid-4">
        <label className="field">Type<select value={f.kind} onChange={set('kind')}><option>Requirement</option><option>Overtime</option></select></label>
        <SiteSelect value={f.siteId} sites={sites} onChange={(v) => setF({ ...f, siteId: v })} />
        <label className="field">Trade<select value={f.category} onChange={set('category')}>{LABOUR_CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select></label>
        <label className="field">Workers<input type="number" min="1" step="1" value={f.qty} onChange={set('qty')} /></label>
        {f.kind === 'Overtime' && <label className="field">OT hours / day<input type="number" min="0.5" max="4" step="0.5" value={f.hours} onChange={set('hours')} /></label>}
        <label className="field">Needed by<input type="date" min={todayISO()} value={f.neededBy} onChange={set('neededBy')} /></label>
        <label className="field span-2">Work activity / reason<input value={f.note} onChange={set('note')} placeholder="e.g. Raft reinforcement A5–A8 (TSK-105)" /></label>
      </div>
      <div className="sk-form-foot"><FormError error={ctx.error} /><div className="jv-submit"><button className="btn btn-primary" type="submit">Send request</button></div></div>
    </form>
  )
}

export default function Labour({ notify }) {
  const ctx = useSiteEngineer(notify)
  const d = siteData(ctx)
  const s = ctx.site.state
  const requests = s.labourRequests.filter(ctx.inScope)
  const pendingByTrade = (cat) => requests.filter((r) => r.kind === 'Requirement' && r.category === cat && r.status === 'Pending').reduce((t, r) => t + r.qty, 0)
  const registered = d.roster.reduce((t, r) => t + r.registered, 0)
  const week = d.attendance.filter((a) => a.date >= addDays(todayISO(), -6)).sort((a, b) => a.date.localeCompare(b.date))
  const maxPresent = Math.max(1, ...week.map((a) => a.present + a.absent))
  // Productivity from submitted daily reports (last 7 days): quantity per worker-day for each activity
  const since = addDays(todayISO(), -6)
  const prod = d.tasks.map((t) => {
    const lines = d.countedReports.filter((r) => r.date >= since).flatMap((r) => r.entries.filter((e) => e.taskId === t.id).map((e) => ({ ...e, date: r.date })))
    const qty = lines.reduce((x, e) => x + Number(e.qty), 0)
    const workerDays = lines.reduce((x, e) => x + Number(e.workers), 0)
    return { id: t.id, title: t.title, unit: t.unit, qty, workerDays, days: lines.length, rate: workerDays ? Math.round((qty / workerDays) * 100) / 100 : null }
  }).filter((r) => r.workerDays > 0)
  const needs = ctx.mySites.map((x) => ({ site: x, ...labourNeed(s, x.id) }))
  const shortages = needs.flatMap((n) => n.rows.filter((r) => r.shortage > 0).map((r) => ({ ...r, site: n.site })))
  const activity = d.countedReports.filter((r) => r.date >= since).sort((a, b) => b.date.localeCompare(a.date))

  return (
    <>
      <div className="info-note"><span>ℹ</span><div>Attendance is recorded by the <b>Site Supervisor</b> ({ctx.mySites.map((x) => supervisorOf(x.id)).filter(Boolean).join(', ') || '—'}) and shown here read-only. Wages and payroll stay with Accounts. You plan requirements and coordinate.</div></div>
      <StatGrid items={[
        { label: 'Present today (project)', value: d.presentToday, sub: `of ${registered} registered` },
        { label: 'Absent today', value: d.attendanceToday.reduce((t, a) => t + a.absent, 0) },
        { label: 'Open labour requests', value: requests.filter((r) => r.status === 'Pending').length, tone: 'warning' },
        { label: 'Your site crew (named)', value: d.workers.filter((w) => w.present).length, sub: `present of ${d.workers.length} on the site list` },
      ]} />

      {shortages.length > 0 && (
        <div className="se-urgent" role="alert"><span>⚠</span><div><b>Labour shortage today:</b> {shortages.map((r) => `${r.trade} short by ${r.shortage} at ${r.site.name.split(': ')[1] || r.site.name} (needed ${r.required} for ${r.tasks.join(', ')}, allocated ${r.allocated})`).join('; ')}. Raise a requirement or overtime request below.</div></div>
      )}
      {needs.map((n) => (
        <Card key={n.site.id} title={`Labour needed vs allocated today · ${n.site.name}`} sub={n.allocation ? `Work allocation by ${n.allocation.by} (Site Supervisor): ${n.allocation.notes}` : 'No allocation recorded by the Site Supervisor today'} bodyClass="" className="mb">
          <DataTable rowKey="trade" rows={n.rows} emptyText="No crew needed today." columns={[
            { key: 'trade', header: 'Trade' },
            { key: 'required', header: 'Needed for planned work', align: 'num' },
            { key: 'allocated', header: 'Allocated by Supervisor', align: 'num' },
            { key: 'shortage', header: 'Shortage', align: 'num', render: (r) => (r.shortage ? <b className="down">{r.shortage}</b> : '—') },
            { key: 'tasks', header: 'For tasks', render: (r) => <span className="cell-sub">{r.tasks.join(', ') || 'Not needed today'}</span> },
          ]} />
        </Card>
      ))}

      <div className="grid halves">
        <Card title="Labour by trade" sub="Project roster (registered vs present today) and open requirements" bodyClass="">
          <DataTable rowKey="category" rows={d.roster} columns={[
            { key: 'category', header: 'Trade' },
            { key: 'r', header: 'Registered', align: 'num', render: (r) => r.registered },
            { key: 'c', header: 'Contractor / direct', align: 'num', render: (r) => `${r.contractor} / ${r.direct}` },
            { key: 'p', header: 'Present today', align: 'num', render: (r) => r.presentToday },
            { key: 'req', header: 'Required (open)', align: 'num', render: (r) => (pendingByTrade(r.category) ? <b className="down">+{pendingByTrade(r.category)}</b> : '—') },
          ]} />
        </Card>
        <Card title="Attendance, last 7 days" sub="From the Site Supervisor's daily muster (project-wide)">
          <div className="hbars">
            {week.map((a) => (
              <div key={a.date} className="hbar"><span className="hbar-label">{formatDateShort(a.date)}</span><Progress value={(a.present / maxPresent) * 100} /><span className="hbar-value">{a.present}</span></div>
            ))}
          </div>
          <div className="cell-sub" style={{ marginTop: 10, whiteSpace: 'normal' }}>Muster rolls: {d.musterRolls.map((m) => `${m.id} (${formatDate(m.date)}, ${m.workers} workers, ${m.submittedBy}: ${m.note})`).join('; ')}</div>
        </Card>
      </div>

      <div className="grid halves">
        <Card title="Your site crew today" sub="Named workers on your site list (allocation by the Site Supervisor)" bodyClass="">
          <DataTable rows={d.workers} emptyText="No named workers recorded for your sites." columns={[
            { key: 'name', header: 'Worker', render: (w) => <><div className="cell-main">{w.name}</div><div className="cell-sub">{w.id}</div></> },
            { key: 'trade', header: 'Trade' }, { key: 'contractor', header: 'Contractor' },
            { key: 'p', header: 'Today', render: (w) => <Badge>{w.present ? 'Present' : 'Absent'}</Badge> },
            { key: 'h', header: 'Hours', align: 'num', render: (w) => w.hours },
          ]} />
        </Card>
        <Card title="Productivity (last 7 days)" sub="Quantity per worker-day, from your submitted daily reports" bodyClass="">
          <DataTable rows={prod} emptyText="No submitted reports in the last 7 days." columns={[
            { key: 't', header: 'Activity', render: (r) => <span className="wrap-cell">{r.title}</span> },
            { key: 'q', header: 'Done', align: 'num', render: (r) => `${r.qty} ${r.unit}` },
            { key: 'w', header: 'Worker-days', align: 'num', render: (r) => r.workerDays },
            { key: 'r', header: 'Per worker-day', align: 'num', render: (r) => <b>{r.rate} {r.unit}</b> },
          ]} />
        </Card>
      </div>

      <Card title="Labour requirements & overtime requests" sub="Requests for your sites, including earlier ones on the project record" bodyClass="" className="section-gap">
        <DataTable dense rows={[...requests].sort((a, b) => a.neededBy.localeCompare(b.neededBy))} emptyText="No labour requests." columns={[
          { key: 'id', header: 'Ref.', render: (r) => <><div className="cell-main">{r.id}</div><div className="cell-sub">{r.kind}</div></> },
          { key: 'c', header: 'Trade', render: (r) => r.category },
          { key: 'q', header: 'Workers', align: 'num', render: (r) => <>{r.qty}{r.hours ? <div className="cell-sub">{r.hours} h OT/day</div> : null}</> },
          { key: 's', header: 'Site', render: (r) => (r.siteId ? siteOf(r.siteId)?.name : 'Project-wide') },
          { key: 'n', header: 'For', render: (r) => <span className="wrap-cell">{r.note}</span> },
          { key: 'd', header: 'Needed by', render: (r) => formatDate(r.neededBy) },
          { key: 'b', header: 'Requested by', render: (r) => r.requestedBy },
          { key: 'st', header: 'Status', render: (r) => <Badge>{r.status}</Badge> },
        ]} />
        <div style={{ padding: 14 }}>{ctx.perms.work ? <RequestForm ctx={ctx} /> : <Locked>View only</Locked>}</div>
      </Card>

      <Card title="Daily labour activity" sub="Workers per activity from submitted daily reports" bodyClass="" className="section-gap">
        <DataTable rows={activity} emptyText="No submitted reports this week." columns={[
          { key: 'date', header: 'Date', render: (r) => formatDate(r.date) },
          { key: 'id', header: 'Report' },
          { key: 'a', header: 'Activities and workers', render: (r) => <span className="wrap-cell">{r.entries.map((e) => `${s.tasks.find((t) => t.id === e.taskId)?.title.split(',')[0]}: ${e.workers}`).join(' · ')}</span> },
          { key: 'w', header: 'Total', align: 'num', render: (r) => r.entries.reduce((t, e) => t + Number(e.workers), 0) },
        ]} />
      </Card>
    </>
  )
}
