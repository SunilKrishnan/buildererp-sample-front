import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import DataTable from '../../components/DataTable.jsx'
import { Badge, Card } from '../../components/UI.jsx'
import * as Q from '../../services/qa.js'
import { formatDate } from '../../utils/format.js'
import { Drawer, FormError } from '../store-keeper/shared.jsx'
import { InspStatus, InspectionDrawer, InspectorSelect, useQA } from './shared.jsx'

function ScheduleRe({ ctx, n, onClose }) {
  const [f, setF] = useState({ date: ctx.today, time: '10:00', inspector: ctx.user.name })
  const orig = ctx.s.inspections.find((x) => x.id === n.fromInspection)
  return (
    <Drawer title={`Schedule reinspection · ${n.id}`} sub={orig ? `${orig.id} · ${orig.title}` : n.description} onClose={() => { ctx.setError(''); onClose() }}>
      {orig && <div className="info-note warn"><span>⚠</span><div><b>Original result ({orig.id}): {orig.status}.</b> {orig.notes || ''} {orig.checklist.filter((c) => c.result === 'Fail').map((c) => `${c.item}: ${c.observation}`).join('; ')}</div></div>}
      <p className="cell-sub">Correction completed {n.action?.completedAt ? formatDate(n.action.completedAt.slice(0, 10)) : '—'} · verified by {n.verification?.by || '—'}. The original record stays unchanged; the reinspection is a new linked record.</p>
      <div className="receipt-form">
        <div className="receipt-grid">
          <label className="field">Date<input type="date" min={ctx.today} value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} /></label>
          <label className="field">Time<input type="time" value={f.time} onChange={(e) => setF({ ...f, time: e.target.value })} /></label>
          <InspectorSelect value={f.inspector} onChange={(v) => setF({ ...f, inspector: v })} />
        </div>
        <div className="sk-form-foot"><FormError error={ctx.error} /><div className="jv-submit"><button className="btn btn-primary" onClick={() => ctx.act('scheduleReinspection', { ncrId: n.id, ...f }) && onClose()}>Schedule reinspection</button><button className="btn" onClick={onClose}>Cancel</button></div></div>
      </div>
    </Drawer>
  )
}

export default function Reinspection({ notify }) {
  const ctx = useQA(notify)
  const [params, setParams] = useSearchParams()
  const [openId, setOpenId] = useState(null)
  const scheduling = params.get('ncr') && ctx.s.ncrs.find((n) => n.id === params.get('ncr'))
  const toSchedule = ctx.s.ncrs.filter((n) => Q.ncrStatus(n) === 'Reinspection Required' && !(n.reinspectionId && Q.OPEN_INSPECTION.includes(ctx.s.inspections.find((x) => x.id === n.reinspectionId)?.status)))
  const toVerify = ctx.s.ncrs.filter((n) => Q.ncrStatus(n) === 'Awaiting Verification')
  const reinspections = ctx.s.inspections.filter((x) => x.parentId).sort((a, b) => b.date.localeCompare(a.date))
  // Every failed inspection with its full chain of results
  const chains = ctx.s.inspections.filter((x) => !x.parentId && ['Failed', 'Conditional'].includes(x.status)).map((x) => ({ id: x.id, root: x, chain: Q.chainOf(ctx.s, x) }))
  return (
    <>
      <div className="grid halves">
        <Card title="Reinspections to schedule" sub="Correction verified by QA" bodyClass="">
          <DataTable dense rows={toSchedule} emptyText="Nothing waiting to be scheduled." columns={[
            { key: 'id', header: 'NCR', render: (n) => <><div className="cell-main">{n.id}</div><div className="cell-sub">{n.fromInspection || ''}</div></> },
            { key: 'd', header: 'Original failure', render: (n) => <span className="wrap-cell cell-sub">{n.description}</span> },
            { key: 'c', header: 'Corrected', render: (n) => (n.action?.completedAt ? formatDate(n.action.completedAt.slice(0, 10)) : '—') },
            { key: 'x', header: '', render: (n) => (ctx.perms.manage ? <button className="btn btn-sm btn-primary" onClick={() => setParams({ ncr: n.id })}>Schedule</button> : null) },
          ]} />
        </Card>
        <Card title="Corrections awaiting QA verification" sub="Verify on the NCR before reinspection" bodyClass="">
          <DataTable dense rows={toVerify} emptyText="No corrections waiting." columns={[
            { key: 'id', header: 'NCR', render: (n) => <span className="cell-main">{n.id}</span> },
            { key: 'a', header: 'Correction reported', render: (n) => <span className="wrap-cell cell-sub">{n.action?.owner}: {n.action?.note || '—'}</span> },
            { key: 'e', header: 'Evidence', render: (n) => <span className="cell-sub">{n.action?.evidence?.length || 0}</span> },
          ]} />
        </Card>
      </div>

      <Card title="Reinspections" sub="Each reinspection is a separate record; the original result is kept" bodyClass="" className="section-gap">
        <DataTable dense rows={reinspections} emptyText="No reinspections yet." columns={[
          { key: 'id', header: 'Reinspection', render: (x) => <button className="link-btn" onClick={() => setOpenId(x.id)}>{x.id}</button> },
          { key: 'o', header: 'Original', render: (x) => <span className="cell-sub">{x.parentId} · {ctx.s.inspections.find((p) => p.id === x.parentId)?.status}</span> },
          { key: 'n', header: 'NCR', render: (x) => x.forNcr || '—' },
          { key: 'd', header: 'Date', render: (x) => `${formatDate(x.date)} ${x.time || ''}` },
          { key: 'i', header: 'Inspector', render: (x) => x.inspector },
          { key: 's', header: 'Result', render: (x) => <InspStatus q={x} today={ctx.today} /> },
          { key: 'c', header: 'Closure', render: (x) => { const n = ctx.s.ncrs.find((r) => r.id === x.forNcr); return n ? <Badge>{Q.ncrStatus(n)}</Badge> : '—' } },
          { key: 'x', header: '', render: (x) => <button className={`btn btn-sm ${ctx.perms.manage && Q.OPEN_INSPECTION.includes(x.status) && x.date <= ctx.today ? 'btn-primary' : ''}`} onClick={() => setOpenId(x.id)}>{ctx.perms.manage && Q.OPEN_INSPECTION.includes(x.status) && x.date <= ctx.today ? 'Record result' : 'View'}</button> },
        ]} />
      </Card>

      <Card title="Result history of failed inspections" sub="Original failure and every later result" bodyClass="" className="section-gap">
        <DataTable dense rows={chains} emptyText="No failed inspections." columns={[
          { key: 'id', header: 'Original', render: (c) => <><button className="link-btn" onClick={() => setOpenId(c.root.id)}>{c.root.id}</button><div className="cell-sub">{c.root.title}</div></> },
          { key: 'h', header: 'History', render: (c) => <span className="wrap-cell">{c.chain.map((x) => `${x.id} ${Q.inspectionStatus(x, ctx.today)}`).join(' → ')}</span> },
          { key: 'n', header: 'NCRs', render: (c) => <span className="cell-sub">{c.chain.flatMap((x) => x.ncrIds || []).map((id) => `${id} (${Q.ncrStatus(ctx.s.ncrs.find((n) => n.id === id) || { status: '?' })})`).join(', ') || '—'}</span> },
        ]} />
      </Card>

      {scheduling && <ScheduleRe ctx={ctx} n={scheduling} onClose={() => setParams({})} />}
      {openId && <InspectionDrawer key={openId} ctx={ctx} id={openId} initialMode={(() => { const x = ctx.s.inspections.find((i) => i.id === openId); return ctx.perms.manage && x && x.parentId && Q.OPEN_INSPECTION.includes(x.status) && x.date <= ctx.today ? 'result' : null })()} onClose={() => setOpenId(null)} />}
    </>
  )
}
