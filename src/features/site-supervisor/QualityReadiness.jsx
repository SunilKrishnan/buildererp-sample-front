import { useState } from 'react'
import DataTable from '../../components/DataTable.jsx'
import Icon from '../../components/Icon.jsx'
import { Badge, Card } from '../../components/UI.jsx'
import * as Q from '../../services/qa.js'
import { addDays, todayISO } from '../../utils/date.js'
import { formatDate } from '../../utils/format.js'
import { PhotoInput } from '../site-engineer/shared.jsx'
import { Drawer, FormError, fmtStamp } from '../store-keeper/shared.jsx'

/**
 * Site Supervisor side of quality: report work ready for inspection (goes to the Site Engineer),
 * see inspection outcomes on the site, and record progress on corrections assigned to you.
 */
export default function QualityReadiness({ ctx }) {
  const s = ctx.site.state
  const [ready, setReady] = useState(false)
  const [upd, setUpd] = useState(null)
  const [f, setF] = useState({ siteId: ctx.mySites[0]?.id || '', taskId: '', activity: '', location: '', note: '', requiredDate: addDays(todayISO(), 1), photos: [] })
  const [u, setU] = useState({ note: '', evidence: '', done: false })
  const tasks = s.tasks.filter((t) => t.siteId === f.siteId)
  const requests = s.qaRequests.filter(ctx.inScope).sort((a, b) => (b.readiness?.at || '').localeCompare(a.readiness?.at || ''))
  const outcomes = s.inspections.filter((q) => ctx.inScope(q) && q.owner === 'QA' && ['Passed', 'Failed', 'Conditional'].includes(q.status)).sort((a, b) => (b.recordedAt || '').localeCompare(a.recordedAt || '')).slice(0, 8)
  const mine = s.ncrs.filter((n) => ctx.inScope(n) && n.action && Q.ncrStatus(n) !== 'Closed' && (n.action.owner === ctx.user.name || n.responsibleRole === 'Site Supervisor'))
  const current = upd && s.ncrs.find((n) => n.id === upd)
  return (
    <>
      <Card title="Work ready for inspection" sub="Report completed work; the Site Engineer checks it and requests the QA inspection. Reporting does not pass any inspection." bodyClass="" className="section-gap"
        action={ctx.perms.supervise ? <button className="btn btn-primary btn-sm" onClick={() => setReady(true)}><Icon name="plus" size={14} />Report work ready</button> : null}>
        <DataTable dense rows={requests} emptyText="Nothing reported ready yet." columns={[
          { key: 'id', header: 'Ref.', render: (r) => <><div className="cell-main">{r.id}</div><div className="cell-sub">{fmtStamp(r.readiness?.at)}</div></> },
          { key: 'a', header: 'Work / location', render: (r) => <span className="wrap-cell">{r.activity}<div className="cell-sub">{r.location}</div></span> },
          { key: 'n', header: 'Your observation', render: (r) => <span className="cell-sub wrap-cell">{r.readiness?.note}</span> },
          { key: 's', header: 'Status', render: (r) => <Badge>{r.status}</Badge> },
          { key: 'q', header: 'Inspection', render: (r) => { const q = r.inspectionId && s.inspections.find((x) => x.id === r.inspectionId); const last = q && Q.latestInChain(s, q); return last ? <>{last.id} · {Q.inspectionStatus(last)}{last.date && Q.OPEN_INSPECTION.includes(last.status) ? ` ${formatDate(last.date)} ${last.time || ''}` : ''}</> : '—' } },
        ]} />
      </Card>
      <Card title="Inspection outcomes and required corrections" bodyClass="" className="section-gap">
        <DataTable dense rows={outcomes} emptyText="No QA results on your site yet." columns={[
          { key: 'id', header: 'Inspection', render: (q) => <><div className="cell-main">{q.id}</div><div className="cell-sub">{q.title}</div></> },
          { key: 'r', header: 'Result', render: (q) => <><Badge>{q.status}</Badge>{q.clearance && <div className="cell-sub up">Cleared: {q.clearance.activity.toLowerCase()}</div>}</> },
          { key: 'n', header: 'Comments', render: (q) => <span className="cell-sub wrap-cell">{q.notes || '—'}</span> },
        ]} />
        <div className="sub-panel-head" style={{ marginTop: 10 }}><b>Corrections assigned to you</b></div>
        <DataTable dense rows={mine} emptyText="No corrections assigned to you." columns={[
          { key: 'id', header: 'NCR / action', render: (n) => <><div className="cell-main">{n.id}</div><div className="cell-sub">{n.action.id}</div></> },
          { key: 'a', header: 'Required correction', render: (n) => <span className="wrap-cell">{n.action.text}<div className="cell-sub">{n.location || ''}</div></span> },
          { key: 'd', header: 'Target', render: (n) => <span className={n.action.due < todayISO() ? 'down' : ''}>{formatDate(n.action.due)}</span> },
          { key: 's', header: 'Status', render: (n) => <Badge>{Q.ncrStatus(n)}</Badge> },
          { key: 'x', header: '', render: (n) => (['Awaiting Verification', 'Reinspection Required'].includes(Q.ncrStatus(n)) ? <span className="cell-sub">With QA</span> : <button className="btn btn-sm btn-primary" onClick={() => { setU({ note: '', evidence: '', done: false }); setUpd(n.id) }}>Update</button>) },
        ]} />
        <div style={{ padding: '0 18px 12px' }}><FormError error={ctx.error} /></div>
      </Card>
      {ready && (
        <Drawer title="Report work ready for inspection" onClose={() => { ctx.setError(''); setReady(false) }}>
          <div className="receipt-form">
            <div className="receipt-grid">
              <label className="field">Site<select value={f.siteId} onChange={(e) => setF({ ...f, siteId: e.target.value })}>{ctx.mySites.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select></label>
              <label className="field">Task<select value={f.taskId} onChange={(e) => { const t = tasks.find((x) => x.id === e.target.value); setF({ ...f, taskId: e.target.value, activity: f.activity || t?.title || '', location: f.location || t?.location || '' }) }}><option value="">None</option>{tasks.map((t) => <option key={t.id} value={t.id}>{t.id} · {t.title}</option>)}</select></label>
              <label className="field span-2">Work completed<input value={f.activity} onChange={(e) => setF({ ...f, activity: e.target.value })} /></label>
              <label className="field">Location<input value={f.location} onChange={(e) => setF({ ...f, location: e.target.value })} /></label>
              <label className="field">Inspection wanted by<input type="date" min={todayISO()} value={f.requiredDate} onChange={(e) => setF({ ...f, requiredDate: e.target.value })} /></label>
              <label className="field span-2">Site observation<input value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} placeholder="e.g. tying complete, cover blocks placed" /></label>
              <PhotoInput value={f.photos} onChange={(photos) => setF({ ...f, photos })} />
            </div>
            <div className="sk-form-foot"><FormError error={ctx.error} /><div className="jv-submit"><button className="btn btn-primary" onClick={() => ctx.act('reportWorkReady', { ...f, projectId: f.siteId === 'S-03' ? 'P-102' : 'P-101' }) && setReady(false)}>Send to Site Engineer</button><button className="btn" onClick={() => setReady(false)}>Cancel</button></div></div>
          </div>
        </Drawer>
      )}
      {current && (
        <Drawer title={`Update ${current.action.id}`} sub={current.action.text} onClose={() => { ctx.setError(''); setUpd(null) }}>
          <div className="receipt-form">
            <div className="receipt-grid">
              <label className="field span-2">Progress note<input value={u.note} onChange={(e) => setU({ ...u, note: e.target.value })} /></label>
              <label className="field span-2">Evidence (photo / document)<input type="file" onChange={(e) => setU({ ...u, evidence: e.target.files?.[0]?.name || '' })} /><span className="cell-sub">Demo: only the file name is kept.</span></label>
              <label className="check-row span-2"><input type="checkbox" checked={u.done} onChange={(e) => setU({ ...u, done: e.target.checked })} /> Correction complete: request QA verification</label>
            </div>
            <div className="sk-form-foot"><FormError error={ctx.error} /><div className="jv-submit"><button className="btn btn-primary" onClick={() => ctx.act('updateCorrectiveAction', { id: current.id, note: u.note, evidence: u.evidence ? [u.evidence] : [], done: u.done }) && setUpd(null)}>Save update</button><button className="btn" onClick={() => setUpd(null)}>Cancel</button></div></div>
          </div>
        </Drawer>
      )}
    </>
  )
}
