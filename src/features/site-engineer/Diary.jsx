import { useState } from 'react'
import DataTable from '../../components/DataTable.jsx'
import Icon from '../../components/Icon.jsx'
import { Badge, Card } from '../../components/UI.jsx'
import { materialOf } from '../../services/inventory.js'
import { siteOf, siteStoreOf } from '../../services/site.js'
import { todayISO } from '../../utils/date.js'
import { formatDate } from '../../utils/format.js'
import { Drawer, FormError, Locked } from '../store-keeper/shared.jsx'
import { issuesOn } from './DailyProgress.jsx'
import { siteData } from './derive.js'
import { PhotoInput, PhotoStrip, projectIdOfSite, SiteSelect, useSiteEngineer } from './shared.jsx'

/** Facts for a diary day that already exist in other records (shown, never re-entered). */
function dayFacts(ctx, d, siteId, date) {
  const att = d.attendance.find((a) => a.date === date)
  const store = siteStoreOf(siteId)
  const received = ctx.inv.state.receipts.filter((g) => g.storeId === store && g.deliveryDate === date)
  const issued = issuesOn(ctx.inv, siteId, date)
  const dpr = d.reports.find((r) => r.siteId === siteId && r.date === date)
  const equipment = d.equipment.filter((q) => q.siteId === siteId)
  return { att, received, issued, dpr, equipment }
}

function Facts({ f }) {
  return (
    <dl className="details se-facts">
      <dt>Workers present</dt><dd>{f.att ? `${f.att.present} present, ${f.att.absent} absent (project muster, Site Supervisor)` : 'No muster recorded'}</dd>
      <dt>Equipment</dt><dd>{f.equipment.map((q) => `${q.name} (${q.status})`).join(', ') || '—'}</dd>
      <dt>Materials received</dt><dd>{f.received.length ? f.received.map((g) => `${g.id}: ${g.delivered} ${materialOf(g.sku)?.unit} ${materialOf(g.sku)?.name} (${g.status})`).join('; ') : 'None at the site store'}</dd>
      <dt>Materials issued to site</dt><dd>{f.issued.length ? f.issued.map((i) => `${i.id}: ${i.qty} ${i.material.unit} ${i.material.name}`).join('; ') : 'None'}</dd>
      <dt>Daily report</dt><dd>{f.dpr ? `${f.dpr.id} (${f.dpr.status})` : 'Not yet prepared'}</dd>
    </dl>
  )
}

function DiaryForm({ ctx, d, entry, onClose }) {
  const sites = ctx.mySites
  const [f, setF] = useState(entry || { siteId: sites.length === 1 ? sites[0].id : '', date: todayISO(), weather: '', activities: '', labour: '', materials: '', equipmentNotes: '', quality: '', instructions: '', visitors: '', delays: '', safety: '', tomorrow: '', remarks: '', photos: [] })
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value })
  const facts = f.siteId ? dayFacts(ctx, d, f.siteId, f.date) : null
  const save = (submit) => ctx.act('saveDiary', { entry: { ...f, projectId: projectIdOfSite(f.siteId) }, submit }) && onClose()
  return (
    <Drawer title={entry ? `Edit ${entry.id}` : 'New diary entry'} sub="One entry per site per day" onClose={onClose} wide>
      <div className="receipt-form">
        <div className="receipt-grid">
          <SiteSelect value={f.siteId} sites={sites} onChange={(v) => setF({ ...f, siteId: v })} />
          <label className="field">Date<input type="date" max={todayISO()} value={f.date} onChange={set('date')} /></label>
          <label className="field span-2">Weather / site conditions (required to submit)<input value={f.weather} onChange={set('weather')} placeholder="e.g. Clear, 31 °C; light rain 2–3 pm; pit dry" /></label>
        </div>
        {facts && <><div className="sub-panel-head"><b>From site records</b><span className="cell-sub">Read-only: avoids double counting</span></div><div style={{ padding: '0 14px' }}><Facts f={facts} /></div></>}
        <div className="receipt-grid" style={{ marginTop: 10 }}>
          <label className="field span-2">Work performed (required to submit)<input value={f.activities} onChange={set('activities')} placeholder={facts?.dpr ? `See ${facts.dpr.id}` : 'e.g. Pour F7 (6 cu.m); shuttering F11'} /></label>
          <label className="field span-2">Labour observations<input value={f.labour || ''} onChange={set('labour')} placeholder="e.g. 2 bar benders absent; masons shifted to F7 pour" /></label>
          <label className="field span-2">Materials received or used (confirmed only)<input value={f.materials || ''} onChange={set('materials')} placeholder="Store receipts and issues are listed above; add only what you confirmed on site" /></label>
          <label className="field span-2">Equipment observations<input value={f.equipmentNotes || ''} onChange={set('equipmentNotes')} placeholder="e.g. Vibrator #2 still down; mixer serviced" /></label>
          <label className="field span-2">Quality issues<input value={f.quality || ''} onChange={set('quality')} placeholder="e.g. Honeycomb at F3 repaired (CA-0011)" /></label>
          <label className="field span-2">Site instructions received<input value={f.instructions} onChange={set('instructions')} /></label>
          <label className="field span-2">Visitors and site events<input value={f.visitors} onChange={set('visitors')} /></label>
          <label className="field span-2">Delays and blockers<input value={f.delays} onChange={set('delays')} /></label>
          <label className="field span-2">Safety observations<input value={f.safety} onChange={set('safety')} /></label>
          <label className="field span-2">Tomorrow's plan<input value={f.tomorrow || ''} onChange={set('tomorrow')} placeholder="e.g. Pour F8 after QA rebar check; finish shuttering F12" /></label>
          <label className="field span-2">Notes<input value={f.remarks} onChange={set('remarks')} /></label>
          <PhotoInput value={f.photos} onChange={(photos) => setF({ ...f, photos })} />
        </div>
        <div className="sk-form-foot"><FormError error={ctx.error} />
          <div className="jv-submit"><button className="btn btn-primary" onClick={() => save(true)}>Submit</button><button className="btn" onClick={() => save(false)}>Save draft</button><button className="btn" onClick={onClose}>Cancel</button></div>
        </div>
      </div>
    </Drawer>
  )
}

export default function Diary({ notify, search }) {
  const ctx = useSiteEngineer(notify)
  const d = siteData(ctx)
  const [form, setForm] = useState(null) // 'new' | entry
  const [view, setView] = useState(null)
  const q = (search || '').toLowerCase()
  const rows = ctx.site.state.diary.filter(ctx.inScope).filter((x) => !q || `${x.id} ${x.activities} ${x.delays}`.toLowerCase().includes(q)).sort((a, b) => b.date.localeCompare(a.date))
  const viewing = view && rows.find((x) => x.id === view)

  return (
    <>
      <Card title="Daily site diary" sub="Submitted entries are kept as the site record; drafts can be edited" bodyClass=""
        action={ctx.perms.work ? <button className="btn btn-primary btn-sm" onClick={() => setForm('new')}><Icon name="plus" size={14} />New entry</button> : <Locked>View only</Locked>}>
        <DataTable dense rows={rows} emptyText="No diary entries." columns={[
          { key: 'id', header: 'Entry', render: (x) => <><button className="link-btn" onClick={() => setView(x.id)}>{formatDate(x.date)}</button><div className="cell-sub">{x.id}</div></> },
          { key: 's', header: 'Site', render: (x) => siteOf(x.siteId)?.name },
          { key: 'w', header: 'Weather', render: (x) => x.weather || '—' },
          { key: 'a', header: 'Activities', render: (x) => <span className="wrap-cell">{x.activities || '—'}</span> },
          { key: 'dl', header: 'Delays / blockers', render: (x) => <span className="cell-sub wrap-cell">{x.delays || '—'}</span> },
          { key: 'tm', header: "Tomorrow's plan", render: (x) => <span className="cell-sub wrap-cell">{x.tomorrow || '—'}</span> },
          { key: 'p', header: 'Prepared by', render: (x) => <>{x.preparedBy}<div className="cell-sub">{x.role || 'Site Engineer'}</div></> },
          { key: 'st', header: 'Status', render: (x) => <Badge>{x.status}</Badge> },
          { key: 'x', header: '', render: (x) => <div className="cell-actions"><button className="btn btn-sm" onClick={() => setView(x.id)}>Open</button>{x.status === 'Draft' && ctx.perms.work && x.preparedBy === ctx.user.name && <button className="btn btn-sm btn-primary" onClick={() => setForm(x)}>Edit</button>}{x.status === 'Submitted' && ctx.perms.work && x.preparedBy !== ctx.user.name && <button className="btn btn-sm btn-primary" onClick={() => ctx.act('reviewDiary', { id: x.id })}>Mark reviewed</button>}</div> },
        ]} />
      </Card>
      {form && <DiaryForm ctx={ctx} d={d} entry={form === 'new' ? null : form} onClose={() => setForm(null)} />}
      {viewing && (
        <Drawer title={`Site diary · ${formatDate(viewing.date)}`} sub={`${siteOf(viewing.siteId)?.name} · ${viewing.preparedBy} · ${viewing.status}`} onClose={() => setView(null)}>
          <dl className="details">
            <dt>Weather / conditions</dt><dd>{viewing.weather || '—'}</dd><dt>Work performed</dt><dd>{viewing.activities || '—'}</dd>
            <dt>Labour</dt><dd>{viewing.labour || '—'}</dd><dt>Materials (confirmed)</dt><dd>{viewing.materials || '—'}</dd>
            <dt>Equipment</dt><dd>{viewing.equipmentNotes || '—'}</dd><dt>Quality issues</dt><dd>{viewing.quality || '—'}</dd>
            <dt>Instructions</dt><dd>{viewing.instructions || '—'}</dd><dt>Visitors / events</dt><dd>{viewing.visitors || '—'}</dd>
            <dt>Delays / blockers</dt><dd>{viewing.delays || '—'}</dd><dt>Safety</dt><dd>{viewing.safety || '—'}</dd>
            <dt>Tomorrow's plan</dt><dd>{viewing.tomorrow || '—'}</dd><dt>Notes</dt><dd>{viewing.remarks || '—'}</dd>
          </dl>
          <section className="drawer-section"><h3>From site records</h3><Facts f={dayFacts(ctx, d, viewing.siteId, viewing.date)} /></section>
          <PhotoStrip photos={viewing.photos} />
        </Drawer>
      )}
    </>
  )
}
