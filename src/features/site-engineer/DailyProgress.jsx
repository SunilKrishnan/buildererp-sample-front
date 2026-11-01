import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import DataTable from '../../components/DataTable.jsx'
import Icon from '../../components/Icon.jsx'
import { Badge, Card } from '../../components/UI.jsx'
import { materialOf } from '../../services/inventory.js'
import { dprLines, pmOf, projectOf, siteOf, validateDpr } from '../../services/site.js'
import { todayISO } from '../../utils/date.js'
import { formatDate } from '../../utils/format.js'
import { ConfirmDialog, Drawer, fmtQty, fmtStamp, FormError, HistoryList, Locked } from '../store-keeper/shared.jsx'
import { siteData } from './derive.js'
import { PhotoInput, PhotoStrip, SiteSelect, useSiteEngineer } from './shared.jsx'

const LINE_STATUS = ['In Progress', 'Completed', 'Stopped', 'Not Started']

/** Store issues to this site on a date: shown as "materials used", never typed in again. */
export function issuesOn(inv, siteId, date) {
  const reqById = Object.fromEntries(inv.state.requests.map((r) => [r.id, r]))
  return inv.state.issues.filter((i) => reqById[i.requestId]?.siteId === siteId && i.at.startsWith(date)).map((i) => ({ ...i, req: reqById[i.requestId], material: materialOf(reqById[i.requestId].sku) }))
}

function ReportForm({ ctx, d, report, presetTask, onClose }) {
  const sites = ctx.mySites
  const preset = presetTask && d.tasks.find((t) => t.id === presetTask)
  const blank = { id: null, siteId: preset?.siteId || (sites.length === 1 ? sites[0].id : ''), date: todayISO(), workArea: preset?.location || '', entries: preset ? [{ taskId: preset.id, qty: '', workers: '', status: 'In Progress' }] : [], photos: [], problems: preset?.blocker || '', quality: '', materialsNote: '', remarks: '', nextDayPlan: '' }
  const [f, setF] = useState(report ? { ...report, entries: report.entries.map((e) => ({ ...e, qty: String(e.qty), workers: String(e.workers) })) } : blank)
  const [tried, setTried] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const projectId = siteOf(f.siteId)?.project === 'Palm Grove Villas' ? 'P-102' : 'P-101'
  const s = ctx.site.state
  const siteTasks = d.tasks.filter((t) => t.siteId === f.siteId && t.start <= f.date && (t.status !== 'Completed' || f.entries.some((e) => e.taskId === t.id)))
  const lines = dprLines(s, { ...f, id: f.id || '__new', entries: f.entries.map((e) => ({ ...e, qty: Number(e.qty) || 0 })) })
  const setLine = (i, k, v) => setF({ ...f, entries: f.entries.map((e, j) => (j === i ? { ...e, [k]: v } : e)) })
  const used = f.siteId ? issuesOn(ctx.inv, f.siteId, f.date) : []
  const live = tried ? validateDpr(s, { ...f, projectId }, { submit: true }) : ''
  const save = (submit) => { setTried(true); setConfirming(false); if (ctx.act('saveDpr', { report: { ...f, projectId }, submit })) onClose() }
  // Check everything first, then ask for confirmation before the report goes to the Project Manager
  const review = () => { setTried(true); if (!validateDpr(s, { ...f, projectId }, { submit: true })) setConfirming(true) }

  return (
    <Drawer title={f.id ? `${f.status === 'Returned' ? 'Correct' : 'Edit'} ${f.id}` : 'New daily progress report'} sub="Quantities count towards progress only after you submit" onClose={onClose} wide>
      {report?.status === 'Returned' && <div className="info-note warn"><span>⚠</span><div><b>Returned by {report.reviewedBy}:</b> {report.reviewNote}</div></div>}
      <div className="receipt-form">
        <div className="receipt-grid">
          <div className="field">Project<div className="sk-readonly">{f.siteId ? projectOf(projectId)?.name : '—'}</div></div>
          <SiteSelect value={f.siteId} sites={sites} onChange={(v) => setF({ ...f, siteId: v, entries: [] })} label="Site / tower" />
          <label className="field">Work date<input type="date" max={todayISO()} value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} /></label>
          <label className="field">Floor / work area<input value={f.workArea || ''} onChange={(e) => setF({ ...f, workArea: e.target.value })} placeholder="e.g. Footings F7–F9, ground level" /></label>
        </div>
        <div className="sub-panel-head"><b>Work activities</b><span className="cell-sub">Cumulative = brought forward + submitted reports + today</span></div>
        <div className="table-wrap dense se-dpr-lines">
          <table>
            <thead><tr><th>Activity performed</th><th className="num">Planned qty</th><th className="num">Before today</th><th className="num">Completed today</th><th>Unit</th><th className="num">Cumulative</th><th className="num">Remaining</th><th className="num">Workers</th><th>Status</th><th></th></tr></thead>
            <tbody>
              {f.entries.map((en, i) => {
                const l = lines[i]
                const over = l && l.cumulative > l.planned
                return (
                  <tr key={i}>
                    <td><select value={en.taskId} onChange={(e) => setLine(i, 'taskId', e.target.value)} aria-label="Activity"><option value="">Select…</option>{siteTasks.map((t) => <option key={t.id} value={t.id}>{t.id} · {t.title}</option>)}</select></td>
                    <td className="num">{l?.task ? `${l.planned} ${l.unit}` : '—'}</td>
                    <td className="num">{l?.task ? l.before : '—'}</td>
                    <td className="num"><input className="inline-input se-num" type="number" min="0" step="0.01" value={en.qty} onChange={(e) => setLine(i, 'qty', e.target.value)} aria-label="Quantity today" /></td>
                    <td>{l?.unit || '—'}</td>
                    <td className={`num ${over ? 'down' : ''}`}>{l?.task ? <>{l.cumulative}<div className="cell-sub">{l.pct}%</div></> : '—'}</td>
                    <td className="num">{l?.task ? l.remaining : '—'}</td>
                    <td className="num"><input className="inline-input se-num" type="number" min="0" step="1" value={en.workers} onChange={(e) => setLine(i, 'workers', e.target.value)} aria-label="Workers" /></td>
                    <td><select value={en.status} onChange={(e) => setLine(i, 'status', e.target.value)} aria-label="Line status">{LINE_STATUS.map((x) => <option key={x}>{x}</option>)}</select></td>
                    <td><button type="button" className="icon-btn" aria-label="Remove line" onClick={() => setF({ ...f, entries: f.entries.filter((_, j) => j !== i) })}><Icon name="x" size={14} /></button></td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          {f.entries.length === 0 && <div className="empty sm">Add the activities worked on today.</div>}
        </div>
        <div style={{ padding: '8px 14px' }}><button type="button" className="btn btn-sm" disabled={!f.siteId} onClick={() => setF({ ...f, entries: [...f.entries, { taskId: '', qty: '', workers: '', status: 'In Progress' }] })}><Icon name="plus" size={14} />Add activity</button></div>
        {lines.some((l) => l.task && l.cumulative > l.planned) && <div className="info-note warn sk-inline-note"><span>⚠</span><div>Cumulative is above the task's planned quantity. It is accepted only while the BOQ item stays within its approved quantity; otherwise request a BOQ revision.</div></div>}

        <div className="sub-panel-head"><b>Materials issued to this site (store records)</b><span className="cell-sub">Confirmed by the Store Keeper; shown, not re-entered</span></div>
        <div style={{ padding: '0 14px' }}>{used.length ? used.map((i) => <div key={i.id} className="cell-sub">{i.id}: {fmtQty(i.qty, i.material.unit)} {i.material.name} ({i.requestId})</div>) : <span className="cell-sub">No material issued to this site on {formatDate(f.date)}.</span>}</div>

        <div className="receipt-grid" style={{ marginTop: 12 }}>
          <PhotoInput value={f.photos} onChange={(photos) => setF({ ...f, photos })} />
          <label className="field span-2">Materials used, if known (site estimate)<input value={f.materialsNote || ''} onChange={(e) => setF({ ...f, materialsNote: e.target.value })} placeholder="e.g. approx. 42 bags cement, 6 cu.m M-sand on F7 (not a store record)" /></label>
          <label className="field span-2">Work quality observations<input value={f.quality || ''} onChange={(e) => setF({ ...f, quality: e.target.value })} placeholder="e.g. Slump 90 mm, cubes cast; minor honeycomb at F3 repaired" /></label>
          <label className="field span-2">Delay or blocker / reason for shortfall{f.entries.some((e) => e.status === 'Stopped') ? ' (required)' : ''}<input value={f.problems} onChange={(e) => setF({ ...f, problems: e.target.value })} placeholder="e.g. Brickwork 80 of 100 sq.m: material delivery delay" /></label>
          <label className="field span-2">Notes<input value={f.remarks} onChange={(e) => setF({ ...f, remarks: e.target.value })} /></label>
          <label className="field span-2">Next-day plan (required to submit)<input value={f.nextDayPlan} onChange={(e) => setF({ ...f, nextDayPlan: e.target.value })} /></label>
        </div>
        <div className="sk-form-foot">
          <FormError error={ctx.error || live} />
          <div className="jv-submit">
            <button className="btn btn-primary" type="button" onClick={review}>Review & submit</button>
            <button className="btn" type="button" onClick={() => save(false)}>Save draft</button>
            <button className="btn" type="button" onClick={onClose}>Cancel</button>
          </div>
        </div>
      </div>
      {confirming && (
        <ConfirmDialog title="Submit this daily progress report?" confirmLabel="Submit to Project Manager" onCancel={() => setConfirming(false)} onConfirm={() => save(true)}>
          <p>{siteOf(f.siteId)?.name} · {formatDate(f.date)}{f.workArea ? ` · ${f.workArea}` : ''}</p>
          <ul className="perm-list">{lines.map((l) => <li key={l.taskId} className="ok"><span>•</span><span>{l.task?.title}: <b>{l.qty} {l.unit}</b> today → {l.cumulative} of {l.planned} ({l.pct}%)</span></li>)}</ul>
          <p className="cell-sub">Once submitted, the quantities count towards task progress and the Overview, and the report goes to {pmOf(projectId)} for review. You cannot edit it unless it is returned.</p>
        </ConfirmDialog>
      )}
    </Drawer>
  )
}

function ReportView({ r, ctx, onClose, onEdit }) {
  const lines = dprLines(ctx.site.state, r)
  const used = issuesOn(ctx.inv, r.siteId, r.date)
  return (
    <Drawer title={`${r.id} · ${formatDate(r.date)}`} sub={`${siteOf(r.siteId)?.name} · prepared by ${r.preparedBy}`} onClose={onClose} wide
      foot={['Draft', 'Returned'].includes(r.status) && ctx.perms.work ? <button className="btn btn-primary" onClick={onEdit}>{r.status === 'Returned' ? 'Correct and resubmit' : 'Edit draft'}</button> : null}>
      <dl className="details"><dt>Status</dt><dd><Badge>{r.status}</Badge>{r.reviewedBy ? ` by ${r.reviewedBy}` : ''}{r.reviewNote ? `: ${r.reviewNote}` : ''}</dd></dl>
      <DataTable rowKey="taskId" rows={lines} columns={[
        { key: 'a', header: 'Activity', render: (l) => <>{l.task?.title}<div className="cell-sub">{l.taskId}</div></> },
        { key: 'p', header: 'Planned', align: 'num', render: (l) => `${l.planned} ${l.unit}` },
        { key: 't', header: 'Today', align: 'num', render: (l) => <b>{l.qty}</b> },
        { key: 'c', header: 'Cumulative', align: 'num', render: (l) => `${l.cumulative} (${l.pct}%)` },
        { key: 'r', header: 'Remaining', align: 'num', render: (l) => l.remaining },
        { key: 'w', header: 'Workers', align: 'num', render: (l) => l.workers },
        { key: 's', header: 'Status', render: (l) => <Badge>{l.status}</Badge> },
      ]} />
      <dl className="details" style={{ marginTop: 12 }}>
        <dt>Materials used</dt><dd>{used.length ? used.map((i) => `${i.qty} ${i.material.unit} ${i.material.name} (${i.id})`).join('; ') : 'None issued that day'}</dd>
        {r.workArea && <><dt>Work area</dt><dd>{r.workArea}</dd></>}
        {r.materialsNote && <><dt>Materials used (site estimate)</dt><dd>{r.materialsNote}</dd></>}
        {r.quality && <><dt>Quality observations</dt><dd>{r.quality}</dd></>}
        <dt>Delay / blocker</dt><dd>{r.problems || '—'}</dd>
        <dt>Notes</dt><dd>{r.remarks || '—'}</dd>
        <dt>Next-day plan</dt><dd>{r.nextDayPlan || '—'}</dd>
      </dl>
      <PhotoStrip photos={r.photos} />
      <section className="drawer-section"><h3>History</h3><HistoryList items={r.history} /></section>
    </Drawer>
  )
}

/** Execution progress recorded by the Site Supervisor: verify (counts towards the task) or return. */
function SupervisorEntries({ ctx }) {
  const s = ctx.site.state
  const [note, setNote] = useState({})
  const rows = (s.supervisorProgress || []).filter(ctx.inScope).sort((a, b) => (a.status === 'Submitted' ? -1 : 1) - (b.status === 'Submitted' ? -1 : 1) || b.date.localeCompare(a.date))
  if (!rows.length) return null
  const waiting = rows.filter((r) => r.status === 'Submitted').length
  return (
    <Card title={<span className="title-with-count">Site Supervisor progress <span className="count-pill">{waiting}</span></span>} sub="Quantities recorded by the Site Supervisor. They count towards task progress only after you verify them; verifying is not a quality inspection." bodyClass="" className="mb">
      <DataTable dense rows={rows} columns={[
        { key: 'id', header: 'Entry', render: (r) => <><div className="cell-main">{r.id}</div><div className="cell-sub">{formatDate(r.date)} · {r.by}</div></> },
        { key: 't', header: 'Task / area', render: (r) => <span className="wrap-cell">{r.taskId} · {s.tasks.find((t) => t.id === r.taskId)?.title}<div className="cell-sub">{r.workArea}</div></span> },
        { key: 'q', header: 'Completed that day', align: 'num', render: (r) => <b>{r.qty} {r.unit}</b> },
        { key: 'w', header: 'Workers', align: 'num', render: (r) => r.workers },
        { key: 'rm', header: 'Remarks', render: (r) => <span className="cell-sub wrap-cell">{r.remarks || '—'}</span> },
        { key: 'st', header: 'Status', render: (r) => <><Badge>{r.status === 'Submitted' ? 'Pending Verification' : r.status}</Badge>{r.reviewNote && <div className="cell-sub">{r.reviewNote}</div>}</> },
        { key: 'x', header: '', render: (r) => (r.status === 'Submitted' && ctx.perms.work ? (
          <div className="cell-actions">
            <input className="inline-input" placeholder="Note (required to return)" value={note[r.id] || ''} onChange={(e) => setNote({ ...note, [r.id]: e.target.value })} aria-label={`Note on ${r.id}`} />
            <button className="btn btn-sm btn-primary" onClick={() => ctx.act('reviewProgress', { id: r.id, approve: true, note: note[r.id] })}>Verify</button>
            <button className="btn btn-sm" onClick={() => ctx.act('reviewProgress', { id: r.id, approve: false, note: note[r.id] })}>Return</button>
          </div>
        ) : null) },
      ]} />
      <div style={{ padding: '0 18px 12px' }}><FormError error={ctx.error} /></div>
    </Card>
  )
}

export default function DailyProgress({ notify, search }) {
  const ctx = useSiteEngineer(notify)
  const d = siteData(ctx)
  const [params, setParams] = useSearchParams()
  const [status, setStatus] = useState('all')
  const [view, setView] = useState(null)
  const [edit, setEdit] = useState(null)
  const creating = params.get('new') === '1'
  const q = (search || '').toLowerCase()
  const rows = [...d.reports].filter((r) => (status === 'all' || r.status === status) && (!q || `${r.id} ${r.remarks} ${r.problems}`.toLowerCase().includes(q))).sort((a, b) => b.date.localeCompare(a.date))
  const viewing = view && d.reports.find((r) => r.id === view)
  const editing = edit && d.reports.find((r) => r.id === edit)
  const close = () => { setEdit(null); if (creating) setParams({}) }

  return (
    <>
      <SupervisorEntries ctx={ctx} />
      <Card title="Daily progress reports" sub={`Submitted reports go to the Project Manager for review. ${d.reports.filter((r) => r.status === 'Submitted').length} awaiting review.`} bodyClass=""
        action={ctx.perms.work ? <button className="btn btn-primary btn-sm" onClick={() => setParams({ new: '1' })}><Icon name="plus" size={14} />New report</button> : <Locked>View only</Locked>}>
        <div className="toolbar"><label className="field">Status<select value={status} onChange={(e) => setStatus(e.target.value)}><option value="all">All</option>{['Draft', 'Submitted', 'Reviewed', 'Returned'].map((s) => <option key={s}>{s}</option>)}</select></label></div>
        <DataTable dense rows={rows} emptyText="No reports yet." columns={[
          { key: 'id', header: 'Report', render: (r) => <><button className="link-btn" onClick={() => setView(r.id)}>{r.id}</button><div className="cell-sub">{formatDate(r.date)}</div></> },
          { key: 's', header: 'Site', render: (r) => siteOf(r.siteId)?.name },
          { key: 'a', header: 'Activity: completed (cumulative of planned)', render: (r) => <span className="wrap-cell">{dprLines(ctx.site.state, r).map((l) => `${l.task?.title.split(',')[0]}: ${l.qty} ${l.unit} (${l.cumulative} of ${l.planned})`).join(' · ')}</span> },
          { key: 'w', header: 'Workers', align: 'num', render: (r) => r.entries.reduce((t, e) => t + Number(e.workers || 0), 0) },
          { key: 'p', header: 'Delay / blocker', render: (r) => <span className="cell-sub wrap-cell">{r.problems || '—'}</span> },
          { key: 'st', header: 'Status', render: (r) => <><Badge>{r.status}</Badge>{r.reviewedBy && <div className="cell-sub">{r.reviewedBy}</div>}</> },
          { key: 'x', header: '', render: (r) => <div className="cell-actions"><button className="btn btn-sm" onClick={() => setView(r.id)}>Open</button>{['Draft', 'Returned'].includes(r.status) && ctx.perms.work && <button className="btn btn-sm btn-primary" onClick={() => setEdit(r.id)}>{r.status === 'Draft' ? 'Edit' : 'Correct'}</button>}</div> },
        ]} />
      </Card>
      {(creating || editing) && <ReportForm key={edit || 'new'} ctx={ctx} d={d} report={editing} presetTask={params.get('task')} onClose={close} />}
      {viewing && !editing && <ReportView r={viewing} ctx={ctx} onClose={() => setView(null)} onEdit={() => { setEdit(viewing.id); setView(null) }} />}
      <p className="cell-sub" style={{ marginTop: 10 }}>Last update {fmtStamp(d.reports.map((r) => r.submittedAt || '').sort().pop())}. Demo: reports are kept for this session only.</p>
    </>
  )
}
