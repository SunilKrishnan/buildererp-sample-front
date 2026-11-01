import QualityReadiness from './QualityReadiness.jsx'
import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import DataTable from '../../components/DataTable.jsx'
import Icon from '../../components/Icon.jsx'
import { Badge, Card, Progress as Bar } from '../../components/UI.jsx'
import { projectOf, siteOf } from '../../services/site.js'
import { todayISO } from '../../utils/date.js'
import { formatDate } from '../../utils/format.js'
import { ConfirmDialog, Drawer, fmtStamp, FormError, HistoryList, Locked } from '../store-keeper/shared.jsx'
import { PhotoInput, PhotoStrip } from '../site-engineer/shared.jsx'
import { engineerOf, shortName, supData, useSupervisor } from './shared.jsx'

const round2 = (n) => Math.round(n * 100) / 100

function ProgressForm({ ctx, d, existing, onClose }) {
  const [f, setF] = useState(existing
    ? { id: existing.id, taskId: existing.taskId, date: existing.date, qty: String(existing.qty), workers: String(existing.workers), workArea: existing.workArea, remarks: existing.remarks, photos: [] }
    : { taskId: '', date: todayISO(), qty: '', workers: '', workArea: '', remarks: '', photos: [] })
  const [confirming, setConfirming] = useState(false)
  const [error, setError] = useState('')
  const tasks = d.tasks.filter((t) => t.start <= f.date && (t.status !== 'Completed' || t.id === f.taskId))
  const t = d.tasks.find((x) => x.id === f.taskId)
  const pending = t ? round2(t.position.pending - (existing?.status === 'Submitted' ? existing.qty : 0)) : 0
  const today = Number(f.qty) || 0
  const cumulative = t ? round2(t.done + pending + today) : 0
  const remaining = t ? round2(t.plannedQty - cumulative) : 0
  const pick = (id) => {
    const x = d.tasks.find((y) => y.id === id)
    const a = d.allocationOf(id, f.date)
    setF({ ...f, taskId: id, workArea: x?.location || '', workers: a ? String(a.workerIds.length) : f.workers }); setError('')
  }
  const review = () => {
    if (!t) return setError('Select the task reference.')
    if (!(today > 0)) return setError('Completed quantity today must be more than 0.')
    if (remaining < 0) return setError(`That would leave ${remaining} ${t.unit}: remaining work cannot go below zero. Check the quantity.`)
    if (!(Number(f.workers) > 0)) return setError('Enter the number of workers involved.')
    setError(''); setConfirming(true)
  }
  const save = () => { const ok = ctx.act('submitProgress', f); setConfirming(false); if (ok) onClose() }
  const project = t && projectOf(t.projectId)

  return (
    <Drawer title={existing ? `Correct ${existing.id}` : "Record today's progress"} sub="Sent to the Site Engineer for verification; it counts towards task progress once verified" onClose={onClose} wide>
      {existing?.status === 'Returned' && <div className="info-note warn"><span>⚠</span><div><b>Returned by {existing.reviewedBy}:</b> {existing.reviewNote}</div></div>}
      <div className="receipt-form">
        <div className="receipt-grid">
          <label className="field">Task reference<select value={f.taskId} onChange={(e) => pick(e.target.value)} disabled={!!existing}><option value="">Select…</option>{tasks.map((x) => <option key={x.id} value={x.id}>{x.id} · {x.title}</option>)}</select></label>
          <label className="field">Date<input type="date" max={todayISO()} value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} disabled={!!existing} /></label>
          <label className="field span-2">Work area<input value={f.workArea} onChange={(e) => setF({ ...f, workArea: e.target.value })} /></label>
          <div className="field">Planned quantity<div className="sk-readonly">{t ? `${t.plannedQty} ${t.unit}` : '—'}</div></div>
          <div className="field">Unit<div className="sk-readonly">{t?.unit || '—'}</div></div>
          <label className="field">Completed today ({t?.unit || 'qty'})<input type="number" min="0" step="0.01" value={f.qty} onChange={(e) => { setF({ ...f, qty: e.target.value }); setError('') }} /></label>
          <label className="field">Workers involved<input type="number" min="0" step="1" value={f.workers} onChange={(e) => setF({ ...f, workers: e.target.value })} /></label>
          <label className="field span-2">Progress remarks<input value={f.remarks} onChange={(e) => setF({ ...f, remarks: e.target.value })} placeholder="e.g. Brickwork to sill level on 3 walls; curing arranged" /></label>
          <PhotoInput label="Progress photos (optional)" value={f.photos} onChange={(photos) => setF({ ...f, photos })} />
        </div>
        {t && (
          <div className={`info-note sk-inline-note ${remaining < 0 ? 'warn' : ''}`}><span>ℹ</span><div>
            <b>This target ({t.id}):</b> planned {t.plannedQty} {t.unit} · verified before {t.done} · awaiting verification {pending} · <b>today {today}</b> → cumulative {cumulative} · <b>remaining {remaining} {t.unit}</b>.
            <div className="cell-sub">Daily progress on this activity is not the overall project completion ({project?.name}: {project?.progress}% overall).</div>
          </div></div>
        )}
        <div className="sk-form-foot">
          <FormError error={error || ctx.error} />
          <div className="jv-submit"><button className="btn btn-primary" type="button" onClick={review}>Review & send for verification</button><button className="btn" type="button" onClick={onClose}>Cancel</button></div>
          <p className="cell-sub">One entry per task and day. Technical checks and quality inspections stay with the Site Engineer; recording progress does not pass any inspection.</p>
        </div>
      </div>
      {confirming && (
        <ConfirmDialog title={`Send ${today} ${t.unit} on ${t.id} for verification?`} confirmLabel="Send to Site Engineer" onCancel={() => setConfirming(false)} onConfirm={save}>
          <p>{t.title} · {formatDate(f.date)} · {f.workers} workers. Remaining after this: <b>{remaining} {t.unit}</b>.</p>
          <p className="cell-sub">{engineerOf(t.siteId)} (Site Engineer) verifies it; until then it shows as awaiting verification.</p>
        </ConfirmDialog>
      )}
    </Drawer>
  )
}

export default function Progress({ notify, search }) {
  const ctx = useSupervisor(notify)
  const d = supData(ctx)
  const [params, setParams] = useSearchParams()
  const [status, setStatus] = useState('all')
  const [edit, setEdit] = useState(null)
  const [view, setView] = useState(null)
  const creating = params.get('new') === '1'
  const q = (search || '').toLowerCase()
  const rows = [...d.progress].filter((p) => (status === 'all' || p.status === status) && (!q || `${p.id} ${p.taskId} ${p.remarks}`.toLowerCase().includes(q))).sort((a, b) => b.date.localeCompare(a.date) || b.at.localeCompare(a.at))
  const editing = edit && d.progress.find((p) => p.id === edit)
  const viewing = view && d.progress.find((p) => p.id === view)
  const close = () => { setEdit(null); if (creating) setParams({}) }

  return (
    <>
      <Card title="Activity progress" sub="Verified quantity counts towards the task; your entries awaiting verification are shown separately" bodyClass=""
        action={ctx.perms.supervise ? <button className="btn btn-primary btn-sm" onClick={() => setParams({ new: '1' })}><Icon name="plus" size={14} />Record progress</button> : <Locked>View only</Locked>}>
        <DataTable dense rows={d.tasks.filter((t) => t.start <= todayISO())} emptyText="No activities started yet." columns={[
          { key: 't', header: 'Activity', render: (t) => <span className="wrap-cell"><b>{t.title}</b><div className="cell-sub">{t.id} · {t.location}</div></span> },
          { key: 'pl', header: 'Planned', align: 'num', render: (t) => `${t.plannedQty} ${t.unit}` },
          { key: 'd', header: 'Verified', align: 'num', render: (t) => t.done },
          { key: 'pe', header: 'Awaiting verification', align: 'num', render: (t) => (t.position.pending ? <b>{t.position.pending}</b> : '—') },
          { key: 'r', header: 'Remaining', align: 'num', render: (t) => t.position.open },
          { key: 'p', header: 'Progress', render: (t) => <div style={{ minWidth: 100 }}><div className="prog-row"><span /><b>{t.pct}%</b></div><Bar value={t.pct} tone={t.status === 'Delayed' ? 'bad' : ''} /></div> },
          { key: 's', header: 'Status', render: (t) => <Badge>{t.status}</Badge> },
        ]} />
      </Card>
      <Card title="Your progress entries" sub="Submitted → Verified by the Site Engineer (counts) or Returned for correction" bodyClass="" className="section-gap">
        <div className="toolbar"><label className="field">Status<select value={status} onChange={(e) => setStatus(e.target.value)}><option value="all">All</option>{['Submitted', 'Verified', 'Returned'].map((x) => <option key={x}>{x}</option>)}</select></label></div>
        <DataTable dense rows={rows} emptyText="No progress recorded yet. Use Record progress after the day's work." columns={[
          { key: 'id', header: 'Entry', render: (p) => <><button className="link-btn" onClick={() => setView(p.id)}>{p.id}</button><div className="cell-sub">{formatDate(p.date)}</div></> },
          { key: 't', header: 'Task / area', render: (p) => <>{p.taskId}<div className="cell-sub">{p.workArea} · {shortName(siteOf(p.siteId)?.name)}</div></> },
          { key: 'q', header: 'Completed that day', align: 'num', render: (p) => <b>{p.qty} {p.unit}</b> },
          { key: 'w', header: 'Workers', align: 'num', render: (p) => p.workers },
          { key: 'rm', header: 'Remarks', render: (p) => <span className="cell-sub wrap-cell">{p.remarks || '—'}</span> },
          { key: 's', header: 'Status', render: (p) => <><Badge>{p.status === 'Submitted' ? 'Pending Verification' : p.status}</Badge>{p.reviewedBy && <div className="cell-sub">{p.reviewedBy}{p.reviewNote ? `: ${p.reviewNote}` : ''}</div>}</> },
          { key: 'x', header: '', render: (p) => (p.status === 'Returned' && p.by === ctx.user.name ? <button className="btn btn-sm btn-primary" onClick={() => setEdit(p.id)}>Correct</button> : <button className="btn btn-sm" onClick={() => setView(p.id)}>View</button>) },
        ]} />
      </Card>
      <QualityReadiness ctx={ctx} />
      {(creating || editing) && <ProgressForm key={edit || 'new'} ctx={ctx} d={d} existing={editing} onClose={close} />}
      {viewing && !editing && (
        <Drawer title={`${viewing.id} · ${viewing.taskId}`} sub={`${formatDate(viewing.date)} · ${viewing.qty} ${viewing.unit} · ${viewing.workers} workers`} onClose={() => setView(null)}>
          <dl className="details"><dt>Status</dt><dd><Badge>{viewing.status}</Badge></dd><dt>Work area</dt><dd>{viewing.workArea}</dd><dt>Remarks</dt><dd>{viewing.remarks || '—'}</dd><dt>Recorded</dt><dd>{viewing.by} · {fmtStamp(viewing.at)}</dd></dl>
          <PhotoStrip photos={viewing.photos} />
          <section className="drawer-section"><h3>History</h3><HistoryList items={viewing.history} /></section>
        </Drawer>
      )}
    </>
  )
}
