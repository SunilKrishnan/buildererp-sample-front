import { useState } from 'react'
import DataTable from '../../components/DataTable.jsx'
import Icon from '../../components/Icon.jsx'
import { Badge, Card } from '../../components/UI.jsx'
import { materialOf } from '../../services/inventory.js'
import { attendanceSummary, siteOf, siteStoreOf } from '../../services/site.js'
import { todayISO } from '../../utils/date.js'
import { formatDate } from '../../utils/format.js'
import { ConfirmDialog, Drawer, FormError, Locked } from '../store-keeper/shared.jsx'
import { issuesOn } from '../site-engineer/DailyProgress.jsx'
import { PhotoInput, PhotoStrip } from '../site-engineer/shared.jsx'
import { shortName, useSupervisor } from './shared.jsx'

const FIELDS = [
  ['weather', 'Weather (as you observed it; optional)', 'e.g. Clear morning, light rain after 3 pm'],
  ['activities', 'Work performed (required)', 'e.g. Brickwork site office 80 sq.m; shuttering F11'],
  ['materials', 'Materials received or used (verified only)', 'Only quantities you counted or the store confirmed'],
  ['equipment', 'Equipment used', 'e.g. Mixer 10/7, vibrator #1'],
  ['delays', 'Delays / issues', 'e.g. Vibrator #2 down (ISS-603)'],
  ['safety', 'Safety observations', 'e.g. Helmets not worn at F10; work stopped, helmets issued'],
  ['instructions', 'Instructions received', 'e.g. Site Engineer: cubes for every pour'],
  ['tomorrow', 'Next-day plan (required to submit)', 'e.g. Brickwork balance 20 sq.m; shuttering F12'],
  ['remarks', 'Remarks', ''],
]

/** Facts already in other records for that day (shown, never typed in twice) */
function Facts({ ctx, siteId, date }) {
  const a = attendanceSummary(ctx.site.state, siteId, date)
  const store = siteStoreOf(siteId)
  const received = ctx.inv.state.receipts.filter((g) => g.storeId === store && g.deliveryDate === date && g.status === 'Accepted')
  const issued = issuesOn(ctx.inv, siteId, date)
  return (
    <dl className="details se-facts">
      <dt>Workers present (muster)</dt><dd>{a.recorded ? `${a.present} present, ${a.halfDay} half day, ${a.absent} absent, ${a.onLeave} on leave of ${a.expected}` : 'Attendance not recorded for this date'}</dd>
      <dt>Received at site store (accepted GRNs)</dt><dd>{received.length ? received.map((g) => `${g.id}: ${g.accepted} ${materialOf(g.sku)?.unit} ${materialOf(g.sku)?.name}`).join('; ') : 'None'}</dd>
      <dt>Issued to site by the store</dt><dd>{issued.length ? issued.map((i) => `${i.id}: ${i.qty} ${i.material.unit} ${i.material.name}`).join('; ') : 'None'}</dd>
    </dl>
  )
}

function DiaryForm({ ctx, entry, onClose }) {
  const sites = ctx.mySites
  const [f, setF] = useState(entry || { siteId: sites[0]?.id || '', date: todayISO(), photos: [], ...Object.fromEntries(FIELDS.map(([k]) => [k, ''])) })
  const [confirming, setConfirming] = useState(false)
  const [error, setError] = useState('')
  const set = (k) => (e) => { setF({ ...f, [k]: e.target.value }); setError('') }
  const pid = siteOf(f.siteId)?.project === 'Palm Grove Villas' ? 'P-102' : 'P-101'
  const save = (submit) => {
    setConfirming(false)
    const a = attendanceSummary(ctx.site.state, f.siteId, f.date)
    if (ctx.act('saveDiary', { entry: { ...f, projectId: pid, workersPresent: a.recorded ? a.present + a.halfDay : null }, submit })) onClose()
  }
  const review = () => {
    if (!f.activities.trim()) return setError('Describe the work performed.')
    if (!f.tomorrow.trim()) return setError('Add the next-day plan to submit.')
    setConfirming(true)
  }
  return (
    <Drawer title={entry ? `Edit ${entry.id}` : 'New diary entry'} sub="One entry per site and day for you; drafts can be edited until submitted" onClose={onClose} wide>
      <div className="receipt-form">
        <div className="receipt-grid">
          <label className="field">Site<select value={f.siteId} onChange={set('siteId')} disabled={!!entry}>{sites.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select></label>
          <label className="field">Date<input type="date" max={todayISO()} value={f.date} onChange={set('date')} disabled={!!entry} /></label>
        </div>
        <div className="sub-panel-head"><b>From site records</b><span className="cell-sub">Read-only</span></div>
        <div style={{ padding: '0 14px' }}><Facts ctx={ctx} siteId={f.siteId} date={f.date} /></div>
        <div className="receipt-grid" style={{ marginTop: 10 }}>
          {FIELDS.map(([k, label, ph]) => <label key={k} className="field span-2">{label}<input value={f[k] || ''} onChange={set(k)} placeholder={ph} /></label>)}
          <PhotoInput value={f.photos || []} onChange={(photos) => setF({ ...f, photos })} />
        </div>
        <div className="sk-form-foot">
          <FormError error={error || ctx.error} />
          <div className="jv-submit"><button className="btn btn-primary" onClick={review}>Submit for review</button><button className="btn" onClick={() => save(false)}>Save draft</button><button className="btn" onClick={onClose}>Cancel</button></div>
        </div>
      </div>
      {confirming && (
        <ConfirmDialog title={`Submit the diary for ${formatDate(f.date)}?`} confirmLabel="Submit to Site Engineer" onCancel={() => setConfirming(false)} onConfirm={() => save(true)}>
          <p>After submitting, the Site Engineer reviews it and you can no longer edit it.</p>
        </ConfirmDialog>
      )}
    </Drawer>
  )
}

export default function Diary({ notify, search }) {
  const ctx = useSupervisor(notify)
  const [form, setForm] = useState(null)
  const [view, setView] = useState(null)
  const [mineOnly, setMineOnly] = useState(true)
  const q = (search || '').toLowerCase()
  const rows = ctx.site.state.diary.filter(ctx.inScope).filter((x) => !mineOnly || x.preparedBy === ctx.user.name)
    .filter((x) => !q || `${x.id} ${x.activities} ${x.delays}`.toLowerCase().includes(q)).sort((a, b) => b.date.localeCompare(a.date))
  const viewing = view && rows.find((x) => x.id === view)
  return (
    <>
      <Card title="Site diary" sub="Your daily record, submitted to the Site Engineer for review" bodyClass=""
        action={ctx.perms.supervise ? <button className="btn btn-primary btn-sm" onClick={() => setForm('new')}><Icon name="plus" size={14} />New entry</button> : <Locked>View only</Locked>}>
        <div className="toolbar"><label className="check-row"><input type="checkbox" checked={mineOnly} onChange={(e) => setMineOnly(e.target.checked)} />My entries only</label></div>
        <DataTable dense rows={rows} emptyText="No diary entries yet." columns={[
          { key: 'd', header: 'Date', render: (x) => <><button className="link-btn" onClick={() => setView(x.id)}>{formatDate(x.date)}</button><div className="cell-sub">{x.id}</div></> },
          { key: 's', header: 'Site', render: (x) => shortName(siteOf(x.siteId)?.name) },
          { key: 'w', header: 'Workers', align: 'num', render: (x) => x.workersPresent ?? '—' },
          { key: 'a', header: 'Work performed', render: (x) => <span className="wrap-cell">{x.activities || '—'}</span> },
          { key: 'n', header: 'Next-day plan', render: (x) => <span className="cell-sub wrap-cell">{x.tomorrow || '—'}</span> },
          { key: 'b', header: 'By', render: (x) => <>{x.preparedBy}<div className="cell-sub">{x.role || 'Site Engineer'}</div></> },
          { key: 'st', header: 'Status', render: (x) => <><Badge>{x.status}</Badge>{x.reviewedBy && <div className="cell-sub">{x.reviewedBy}</div>}</> },
          { key: 'x', header: '', render: (x) => <div className="cell-actions"><button className="btn btn-sm" onClick={() => setView(x.id)}>Open</button>{x.status === 'Draft' && x.preparedBy === ctx.user.name && <button className="btn btn-sm btn-primary" onClick={() => setForm(x)}>Edit</button>}</div> },
        ]} />
      </Card>
      {form && <DiaryForm ctx={ctx} entry={form === 'new' ? null : form} onClose={() => setForm(null)} />}
      {viewing && (
        <Drawer title={`Site diary · ${formatDate(viewing.date)}`} sub={`${siteOf(viewing.siteId)?.name} · ${viewing.preparedBy} · ${viewing.status}`} onClose={() => setView(null)}>
          <dl className="details">{FIELDS.map(([k, label]) => <span key={k} style={{ display: 'contents' }}><dt>{label.replace(/ \(.*\)$/, '')}</dt><dd>{viewing[k] || '—'}</dd></span>)}{viewing.reviewNote && <><dt>Review note</dt><dd>{viewing.reviewNote}</dd></>}</dl>
          <section className="drawer-section"><h3>From site records</h3><Facts ctx={ctx} siteId={viewing.siteId} date={viewing.date} /></section>
          <PhotoStrip photos={viewing.photos} />
        </Drawer>
      )}
    </>
  )
}
