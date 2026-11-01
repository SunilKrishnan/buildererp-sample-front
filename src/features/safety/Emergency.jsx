import { useState } from 'react'
import DataTable from '../../components/DataTable.jsx'
import { Badge, Card } from '../../components/UI.jsx'
import { SITE_CONTACTS } from '../../data/demo/siteDemo.js'
import { SITES } from '../../data/demo/inventoryDemo.js'
import { addDays, todayISO } from '../../utils/date.js'
import { formatDate } from '../../utils/format.js'
import { FormError } from '../store-keeper/shared.jsx'
import { siteName, useSafety } from './shared.jsx'

export default function Emergency({ notify }) {
  const ctx = useSafety(notify)
  const s = ctx.s
  const m = ctx.perms.manage
  const [pt, setPt] = useState({ kind: 'Assembly point', siteId: 'S-01', location: '', verified: false })
  const [fc, setFc] = useState({ siteId: 'S-01', item: '', location: '', result: '', nextDue: addDays(todayISO(), 30) })
  const [dr, setDr] = useState({ siteId: 'S-01', type: '', date: addDays(todayISO(), 7) })
  const [out, setOut] = useState({})
  const [rn, setRn] = useState('')
  const contacts = Object.entries(SITE_CONTACTS).flatMap(([siteId, list]) => list.map((c, i) => ({ key: `${siteId}-${i}`, siteId, ...c })))

  return (
    <>
      <div className="info-note"><span>ℹ</span><div>Demo project information. Phone numbers in the demo are masked; locations not yet confirmed on site are marked <b>To verify</b>. Confirm all emergency details on site before relying on them.</div></div>
      <div className="grid halves">
        <Card title="Emergency contact directory" sub="From the existing site contact records" bodyClass="">
          <DataTable dense rowKey="key" rows={contacts} columns={[
            { key: 's', header: 'Site', render: (c) => siteName(c.siteId) }, { key: 'r', header: 'Contact', render: (c) => <><div className="cell-main">{c.role}</div><div className="cell-sub">{c.name}</div></> },
            { key: 'p', header: 'Phone', render: (c) => <a className="link-btn" href={`tel:${c.phone.replace(/[^+\d]/g, '')}`}>{c.phone}</a> },
          ]} />
        </Card>
        <Card title="Assembly points & first aid" sub="Recorded by the Safety Officer" bodyClass="">
          <DataTable dense rows={s.emergencyPoints || []} emptyText="None recorded." columns={[
            { key: 'k', header: 'Type', render: (p) => <span className="cell-main">{p.kind}</span> }, { key: 'l', header: 'Location', render: (p) => <span className="wrap-cell">{p.location}<div className="cell-sub">{siteName(p.siteId)}</div></span> },
            { key: 'v', header: 'Verified', render: (p) => <Badge tone={p.verified ? 'success' : 'warning'}>{p.verified ? 'Verified on site' : 'To verify'}</Badge> },
            { key: 'x', header: '', render: (p) => (m && !p.verified ? <button className="btn btn-sm" onClick={() => ctx.act('saveEmergencyPoint', { ...p, verified: true })}>Mark verified</button> : null) },
          ]} />
          {m && <div className="receipt-grid se-grid-4" style={{ padding: 14 }}>
            <label className="field">Type<select value={pt.kind} onChange={(e) => setPt({ ...pt, kind: e.target.value })}>{['Assembly point', 'First-aid room', 'First-aid kit', 'Fire point', 'Emergency exit'].map((x) => <option key={x}>{x}</option>)}</select></label>
            <label className="field">Site<select value={pt.siteId} onChange={(e) => setPt({ ...pt, siteId: e.target.value })}>{SITES.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select></label>
            <label className="field span-2">Location<input value={pt.location} onChange={(e) => setPt({ ...pt, location: e.target.value })} /></label>
            <label className="check-row"><input type="checkbox" checked={pt.verified} onChange={(e) => setPt({ ...pt, verified: e.target.checked })} />Checked on site</label>
            <div className="field"><button className="btn btn-sm btn-primary" onClick={() => ctx.act('saveEmergencyPoint', pt) && setPt({ ...pt, location: '' })}>Add</button></div>
          </div>}
        </Card>
      </div>

      <div className="grid halves">
        <Card title="Fire equipment inspections" bodyClass="">
          <DataTable dense rows={[...(s.fireChecks || [])].sort((a, b) => b.date.localeCompare(a.date))} columns={[
            { key: 'i', header: 'Equipment', render: (f) => <><div className="cell-main">{f.item}</div><div className="cell-sub">{f.location}</div></> },
            { key: 'd', header: 'Checked', render: (f) => formatDate(f.date) }, { key: 'r', header: 'Result', render: (f) => <span className="wrap-cell">{f.result}</span> },
            { key: 'n', header: 'Next due', render: (f) => <span className={f.nextDue < ctx.today ? 'down' : ''}>{formatDate(f.nextDue)}{f.nextDue < ctx.today ? ' (overdue)' : ''}</span> },
          ]} />
          {m && <div className="receipt-grid se-grid-4" style={{ padding: 14 }}>
            <label className="field">Equipment<input value={fc.item} onChange={(e) => setFc({ ...fc, item: e.target.value })} placeholder="e.g. Extinguisher (CO2)" /></label>
            <label className="field">Location<input value={fc.location} onChange={(e) => setFc({ ...fc, location: e.target.value })} /></label>
            <label className="field">Result<input value={fc.result} onChange={(e) => setFc({ ...fc, result: e.target.value })} /></label>
            <label className="field">Next check<input type="date" value={fc.nextDue} onChange={(e) => setFc({ ...fc, nextDue: e.target.value })} /></label>
            <div className="field"><button className="btn btn-sm btn-primary" onClick={() => ctx.act('recordFireCheck', fc) && setFc({ ...fc, item: '', location: '', result: '' })}>Record check</button></div>
          </div>}
        </Card>
        <Card title="Emergency drills" bodyClass="">
          <DataTable dense rows={[...(s.drills || [])].sort((a, b) => b.date.localeCompare(a.date))} columns={[
            { key: 't', header: 'Drill', render: (d) => <><div className="cell-main">{d.id} · {d.type}</div><div className="cell-sub">{formatDate(d.date)}</div></> },
            { key: 'a', header: 'Attendance', align: 'num', render: (d) => d.attendance ?? '—' },
            { key: 'o', header: 'Outcome', render: (d) => (d.status === 'Completed' ? <span className="wrap-cell">{d.outcome}{d.evacuationMinutes ? <div className="cell-sub">Mustered in {d.evacuationMinutes} min</div> : null}</span> : m && d.date <= ctx.today ? (
              <div className="cell-actions">
                <input className="inline-input" type="number" placeholder="Attended" value={out[d.id]?.attendance || ''} onChange={(e) => setOut({ ...out, [d.id]: { ...out[d.id], attendance: e.target.value } })} aria-label="Attendance" />
                <input className="inline-input" placeholder="Outcome" value={out[d.id]?.outcome || ''} onChange={(e) => setOut({ ...out, [d.id]: { ...out[d.id], outcome: e.target.value } })} aria-label="Outcome" />
                <button className="btn btn-sm" onClick={() => ctx.act('recordDrill', { id: d.id, ...out[d.id] })}>Record</button>
              </div>
            ) : <span className="cell-sub">Scheduled</span>) },
            { key: 's', header: 'Status', render: (d) => <Badge>{d.status}</Badge> },
          ]} />
          {m && <div className="receipt-grid se-grid-4" style={{ padding: 14 }}>
            <label className="field span-2">Drill type<input value={dr.type} onChange={(e) => setDr({ ...dr, type: e.target.value })} placeholder="e.g. Fire evacuation drill" /></label>
            <label className="field">Date<input type="date" min={todayISO()} value={dr.date} onChange={(e) => setDr({ ...dr, date: e.target.value })} /></label>
            <div className="field"><button className="btn btn-sm btn-primary" onClick={() => ctx.act('scheduleDrill', dr) && setDr({ ...dr, type: '' })}>Schedule drill</button></div>
          </div>}
        </Card>
      </div>

      <Card title="Emergency readiness observations" bodyClass="">
        <DataTable dense rows={s.readinessNotes || []} emptyText="None recorded." columns={[{ key: 'd', header: 'Date', render: (r) => formatDate(r.date) }, { key: 's', header: 'Site', render: (r) => siteName(r.siteId) }, { key: 't', header: 'Observation', render: (r) => <span className="wrap-cell">{r.text}</span> }, { key: 'b', header: 'By', render: (r) => r.by }]} />
        {ctx.perms.report && <div className="cell-actions" style={{ padding: 14 }}><input className="inline-input se-grow" value={rn} onChange={(e) => setRn(e.target.value)} placeholder="e.g. Extinguisher at F3 blocked by stacked plywood" aria-label="Observation" /><button className="btn btn-sm" onClick={() => ctx.act('addReadinessNote', { siteId: 'S-01', text: rn }) && setRn('')}>Add observation</button></div>}
        <div style={{ padding: '0 18px 12px' }}><FormError error={ctx.error} /></div>
      </Card>
    </>
  )
}
