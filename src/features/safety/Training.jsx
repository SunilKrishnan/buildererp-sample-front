import { useState } from 'react'
import DataTable from '../../components/DataTable.jsx'
import Icon from '../../components/Icon.jsx'
import { Badge, Card } from '../../components/UI.jsx'
import { SITES } from '../../data/demo/inventoryDemo.js'
import { TRAINING_REQUIREMENTS, TRAINING_TYPES } from '../../data/demo/safetyDemo.js'
import * as SF from '../../services/safety.js'
import { workerOf, workersOf } from '../../services/site.js'
import { todayISO } from '../../utils/date.js'
import { formatDate } from '../../utils/format.js'
import { Drawer, FormError, Locked } from '../store-keeper/shared.jsx'
import { siteName, useSafety } from './shared.jsx'

function TrainingForm({ ctx, onClose }) {
  const [f, setF] = useState({ siteId: 'S-01', type: 'Toolbox talk', title: '', date: todayISO(), trainer: ctx.user.name, attendees: [], docs: '' })
  const crew = workersOf(f.siteId)
  const toggle = (id) => setF({ ...f, attendees: f.attendees.includes(id) ? f.attendees.filter((x) => x !== id) : [...f.attendees, id] })
  return (
    <Drawer title="Record training" sub="Attendance is recorded against the worker register" onClose={onClose} wide>
      <div className="receipt-form">
        <div className="receipt-grid">
          <label className="field">Site<select value={f.siteId} onChange={(e) => setF({ ...f, siteId: e.target.value, attendees: [] })}>{SITES.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select></label>
          <label className="field">Type<select value={f.type} onChange={(e) => setF({ ...f, type: e.target.value })}>{TRAINING_TYPES.map((x) => <option key={x}>{x}</option>)}</select></label>
          <label className="field span-2">Topic<input value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} placeholder="e.g. Scaffold access and guard rails" /></label>
          <label className="field">Date<input type="date" max={todayISO()} value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} /></label>
          <label className="field">Trainer<input value={f.trainer} onChange={(e) => setF({ ...f, trainer: e.target.value })} /></label>
          <label className="field span-2">Supporting documents (names, comma separated)<input value={f.docs} onChange={(e) => setF({ ...f, docs: e.target.value })} placeholder="e.g. Attendance sheet" /></label>
        </div>
        <div className="sub-panel-head"><b>Attendance ({f.attendees.length})</b><button type="button" className="link-btn" onClick={() => setF({ ...f, attendees: crew.map((w) => w.id) })}>Select all</button></div>
        <div className="pm-picker" style={{ padding: '0 14px' }}>{crew.map((w) => <label key={w.id} className="check-row"><input type="checkbox" checked={f.attendees.includes(w.id)} onChange={() => toggle(w.id)} /><span>{w.name} <span className="cell-sub">· {w.trade}</span></span></label>)}</div>
        <div className="sk-form-foot"><FormError error={ctx.error} /><div className="jv-submit"><button className="btn btn-primary" onClick={() => ctx.act('recordTraining', { ...f, docs: f.docs.split(',').map((x) => x.trim()) }) && onClose()}>Save training record</button><button className="btn" onClick={onClose}>Cancel</button></div></div>
      </div>
    </Drawer>
  )
}

export default function Training({ notify, search }) {
  const ctx = useSafety(notify)
  const [creating, setCreating] = useState(false)
  const [status, setStatus] = useState('due')
  const [type, setType] = useState('all')
  const q = (search || '').toLowerCase()
  const req = SF.trainingStatus(ctx.s, 'S-01', ctx.today).concat(SF.trainingStatus(ctx.s, 'S-02', ctx.today))
    .filter((r) => (status === 'all' || (status === 'due' ? r.status !== 'Valid' : r.status === status)) && (type === 'all' || r.type === type))
    .filter((r) => !q || `${r.worker.id} ${r.worker.name} ${r.type}`.toLowerCase().includes(q))
  const canRecord = ctx.perms.manage || ctx.perms.report
  return (
    <>
      <Card title="Required training by worker" sub={`Requirements (demo company policy): ${TRAINING_REQUIREMENTS.map((r) => `${r.type} for ${r.trades === 'all' ? 'all workers' : r.trades.join(', ')}${r.renewMonths ? `, renew every ${r.renewMonths} months` : ''}`).join('; ')}`} bodyClass="">
        <div className="toolbar"><div className="filters">
          <label className="field">Show<select value={status} onChange={(e) => setStatus(e.target.value)}><option value="due">Due or incomplete</option><option value="all">All</option>{['Not completed', 'Expired', 'Due soon', 'Valid'].map((x) => <option key={x}>{x}</option>)}</select></label>
          <label className="field">Training<select value={type} onChange={(e) => setType(e.target.value)}><option value="all">All</option>{TRAINING_REQUIREMENTS.map((r) => <option key={r.type}>{r.type}</option>)}</select></label>
        </div></div>
        <DataTable dense rowKey="key" rows={req} emptyText="Everyone's required training is valid." columns={[
          { key: 'w', header: 'Worker', render: (r) => <><div className="cell-main">{r.worker.name}</div><div className="cell-sub">{r.worker.id} · {r.worker.trade} · {siteName(r.worker.siteId)}</div></> },
          { key: 't', header: 'Required training', render: (r) => r.type },
          { key: 'l', header: 'Last completed', render: (r) => (r.last ? <>{formatDate(r.last.date)}<div className="cell-sub">{r.last.id} · {r.last.trainer}</div></> : '—') },
          { key: 'r', header: 'Renewal due', render: (r) => (r.renewal ? formatDate(r.renewal) : '—') },
          { key: 's', header: 'Status', render: (r) => <Badge tone={r.status === 'Valid' ? 'success' : r.status === 'Due soon' ? 'warning' : 'danger'}>{r.status}</Badge> },
        ]} />
      </Card>
      <Card title="Training sessions" sub="Toolbox talks, inductions and task training with attendance" bodyClass="" className="section-gap"
        action={canRecord ? <button className="btn btn-primary btn-sm" onClick={() => setCreating(true)}><Icon name="plus" size={14} />Record training</button> : <Locked>View only</Locked>}>
        <DataTable dense rows={[...(ctx.s.trainingSessions || [])].sort((a, b) => b.date.localeCompare(a.date))} emptyText="No sessions." columns={[
          { key: 'id', header: 'Session', render: (t) => <><div className="cell-main">{t.id}</div><div className="cell-sub">{formatDate(t.date)}</div></> },
          { key: 't', header: 'Training', render: (t) => <span className="wrap-cell">{t.type}<div className="cell-sub">{t.title}</div></span> },
          { key: 'tr', header: 'Trainer', render: (t) => t.trainer },
          { key: 'a', header: 'Attendance', align: 'num', render: (t) => <span title={t.attendees.map((id) => workerOf(id)?.name).join(', ')}>{t.attendees.length}</span> },
          { key: 'r', header: 'Renewal', render: (t) => (t.renewMonths ? `${t.renewMonths} months` : 'Not required') },
          { key: 'd', header: 'Documents', render: (t) => <span className="cell-sub">{t.docs.join(', ') || '—'}</span> },
        ]} />
      </Card>
      {creating && <TrainingForm ctx={ctx} onClose={() => setCreating(false)} />}
    </>
  )
}
