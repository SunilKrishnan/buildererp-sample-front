import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import DataTable from '../../components/DataTable.jsx'
import Icon from '../../components/Icon.jsx'
import { Badge, Card } from '../../components/UI.jsx'
import { siteOf, supervisorOf } from '../../services/site.js'
import { addDays, todayISO } from '../../utils/date.js'
import { formatDate } from '../../utils/format.js'
import { Drawer, FormError, Locked } from '../store-keeper/shared.jsx'
import { siteData } from './derive.js'
import { PhotoInput, PhotoStrip, projectIdOfSite, SiteSelect, useSiteEngineer } from './shared.jsx'
import QaRequestsCard from './QaRequests.jsx'
import { ncrStatus } from '../../services/qa.js'

const TYPES = ['Concrete', 'Reinforcement', 'Masonry', 'Finishing / formwork', 'Levels & PCC', 'Excavation & soil', 'Other']
const TEMPLATES = {
  Concrete: ['Mix and delivery ticket match the specification', 'Slump within specified range', 'Cubes cast and tagged', 'Compaction by vibrator, no honeycombing', 'Curing arranged'],
  Reinforcement: ['Bar diameter and spacing as per BBS', 'Cover blocks in place', 'Lap length and staggering', 'Starters aligned and tied', 'Formwork clean'],
  Masonry: ['Bricks soaked, quality as specified', 'Mortar mix as specified', 'Joints ≤ 10 mm, fully filled', 'Plumb and line within tolerance', 'Curing arranged'],
  'Finishing / formwork': ['Line and level within tolerance', 'Props and bracing adequate', 'Joints sealed', 'Release agent applied'],
  'Levels & PCC': ['Levels per drawing', 'Thickness as specified', 'Surface even'],
  'Excavation & soil': ['Depth and size per drawing', 'Founding strata as per soil report', 'Dewatering adequate', 'Edges barricaded'],
  Other: ['Item checked'],
}
const RESULTS = ['Pass', 'Fail', 'N/A']
/** Overall result shown in the register (from the recorded status, never typed by hand) */
export const resultOf = (q) => (q.status === 'Passed' ? 'Pass' : q.status === 'Failed' ? (q.reinspectionDate ? 'Needs Reinspection' : 'Fail') : q.status)

function InspectionForm({ ctx, existing, onClose }) {
  const sites = ctx.mySites
  const [f, setF] = useState(existing
    ? { ...existing, checklist: existing.checklist.map((c) => ({ ...c, result: c.result || '' })), tests: existing.tests.length ? existing.tests : [], photos: [], notes: existing.notes || '', reinspectionDate: '', severity: 'Major', correctiveAction: '' }
    : { siteId: sites.length === 1 ? sites[0].id : '', title: '', type: 'Reinforcement', location: '', date: todayISO(), checklist: TEMPLATES.Reinforcement.map((item) => ({ item, result: '' })), tests: [], photos: [], notes: '', severity: 'Major', correctiveAction: '', reinspectionDate: addDays(todayISO(), 3), responsible: '' })
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value })
  const setCheck = (i, k, v) => setF({ ...f, checklist: f.checklist.map((c, j) => (j === i ? { ...c, [k]: v } : c)) })
  const setTest = (i, k, v) => setF({ ...f, tests: f.tests.map((c, j) => (j === i ? { ...c, [k]: v } : c)) })
  const failed = f.checklist.some((c) => c.result === 'Fail') || f.tests.some((t) => t.result === 'Fail')
  const save = (e) => {
    e.preventDefault()
    const payload = { ...f, projectId: projectIdOfSite(f.siteId), checklist: f.checklist.map((c) => ({ ...c, result: c.result || null })) }
    if (existing ? ctx.act('completeInspection', { id: existing.id, ...payload }) : ctx.act('recordInspection', payload)) onClose()
  }
  return (
    <Drawer title={existing ? `Record result · ${existing.id}` : 'New inspection'} sub="Technical inspection within your scope; independent QA review follows" onClose={onClose} wide>
      <form className="receipt-form" onSubmit={save} noValidate>
        <div className="receipt-grid">
          {!existing && <>
            <SiteSelect value={f.siteId} sites={sites} onChange={(v) => setF({ ...f, siteId: v })} />
            <label className="field">Inspection type<select value={f.type} onChange={(e) => setF({ ...f, type: e.target.value, checklist: TEMPLATES[e.target.value].map((item) => ({ item, result: '' })) })}>{TYPES.map((t) => <option key={t}>{t}</option>)}</select></label>
            <label className="field span-2">Activity or material inspected<input value={f.title} onChange={set('title')} placeholder="e.g. Reinforcement before concrete pour, raft A5–A6" /></label>
            <label className="field">Work location<input value={f.location} onChange={set('location')} placeholder="Tower A, F7–F8" /></label>
            <label className="field">Date (future = schedule only)<input type="date" value={f.date} onChange={set('date')} /></label>
          </>}
        </div>
        <div className="sub-panel-head"><b>Checklist</b></div>
        <div style={{ padding: '0 14px' }}>
          {f.checklist.map((c, i) => (
            <div key={i} className="se-check">
              <input className="inline-input" value={c.item} onChange={(e) => setCheck(i, 'item', e.target.value)} aria-label="Checklist item" />
              <div className="chips">{RESULTS.map((r) => <button type="button" key={r} className={`chip ${c.result === r ? 'active' : ''}`} onClick={() => setCheck(i, 'result', c.result === r ? '' : r)}>{r}</button>)}</div>
            </div>
          ))}
          <button type="button" className="btn btn-sm" onClick={() => setF({ ...f, checklist: [...f.checklist, { item: '', result: '' }] })}><Icon name="plus" size={14} />Checklist item</button>
        </div>
        <div className="sub-panel-head"><b>Measurements & observations</b><span className="cell-sub">e.g. bar spacing 150 mm c/c against 150 specified; cover 48 mm against 50</span></div>
        <div style={{ padding: '0 14px' }}>
          {f.tests.map((t, i) => (
            <div key={i} className="se-check">
              <input className="inline-input" placeholder="Test (e.g. Slump)" value={t.name} onChange={(e) => setTest(i, 'name', e.target.value)} />
              <input className="inline-input" placeholder="Result (e.g. 90 mm)" value={t.value} onChange={(e) => setTest(i, 'value', e.target.value)} />
              <input className="inline-input" placeholder="Specification" value={t.spec} onChange={(e) => setTest(i, 'spec', e.target.value)} />
              <div className="chips">{['Pass', 'Fail'].map((r) => <button type="button" key={r} className={`chip ${t.result === r ? 'active' : ''}`} onClick={() => setTest(i, 'result', r)}>{r}</button>)}</div>
            </div>
          ))}
          <button type="button" className="btn btn-sm" onClick={() => setF({ ...f, tests: [...f.tests, { name: '', value: '', spec: '', result: 'Pass' }] })}><Icon name="plus" size={14} />Test result</button>
        </div>
        <div className="receipt-grid" style={{ marginTop: 12 }}>
          <PhotoInput value={f.photos} onChange={(photos) => setF({ ...f, photos })} label="Photos / supporting documents" />
          <label className="field span-2">{failed ? 'Defect description (required)' : 'Notes'}<input value={f.notes} onChange={set('notes')} placeholder={failed ? 'e.g. Bar spacing 200 mm at grid A6 against 150 specified' : ''} /></label>
          {failed && <>
            <label className="field">Severity<select value={f.severity} onChange={set('severity')}>{['Minor', 'Major', 'Critical'].map((x) => <option key={x}>{x}</option>)}</select></label>
            <label className="field">Reinspection date<input type="date" min={todayISO()} value={f.reinspectionDate} onChange={set('reinspectionDate')} /></label>
            <label className="field">Responsible person<select value={f.responsible || ctx.user.name} onChange={set('responsible')}>{[...new Set([ctx.user.name, supervisorOf(f.siteId)].filter(Boolean))].map((p) => <option key={p}>{p}</option>)}</select></label>
            <label className="field span-2">Corrective action<input value={f.correctiveAction} onChange={set('correctiveAction')} placeholder="e.g. Correct spacing and request reinspection" /></label>
          </>}
        </div>
        {failed && <div className="info-note warn sk-inline-note"><span>⚠</span><div>Result: <b>{f.reinspectionDate ? 'Needs Reinspection' : 'Fail'}</b>. A failed item raises a non-conformance report with the corrective action, the responsible person and the reinspection date.</div></div>}
        <p className="cell-sub" style={{ padding: '0 14px' }}>Your result is a technical site check. It then waits for independent QA review; it is not approved automatically and it is not a record that material was received into store stock.</p>
        <div className="sk-form-foot"><FormError error={ctx.error} /><div className="jv-submit"><button className="btn btn-primary" type="submit">{existing ? 'Save result' : 'Save inspection'}</button><button className="btn" type="button" onClick={onClose}>Cancel</button></div></div>
      </form>
    </Drawer>
  )
}

function InspectionView({ q, ctx, onClose }) {
  const [note, setNote] = useState('')
  const own = q.inspector === ctx.user.name
  return (
    <Drawer title={`${q.id} · ${q.title}`} sub={`${q.type} · ${q.location} · ${formatDate(q.date)}`} onClose={onClose}>
      <dl className="details">
        <dt>Inspector</dt><dd>{q.inspector} ({q.owner})</dd>
        <dt>Result</dt><dd><Badge>{resultOf(q)}</Badge>{q.reviewStatus && <> <Badge>{q.reviewStatus}</Badge></>}{q.reviewer ? ` by ${q.reviewer}` : ''}</dd>
        {q.ncrIds?.length > 0 && <><dt>Non-conformance</dt><dd>{q.ncrIds.join(', ')}</dd></>}
        {q.reinspectionDate && <><dt>Reinspection</dt><dd>{formatDate(q.reinspectionDate)}</dd></>}
        <dt>Notes</dt><dd>{q.notes || '—'}</dd>
        {q.source && <><dt>Source</dt><dd>{q.source} (read-only here)</dd></>}
      </dl>
      {q.checklist.length > 0 && <section className="drawer-section"><h3>Checklist</h3><ul className="perm-list">{q.checklist.map((c, i) => <li key={i} className={c.result === 'Fail' ? 'no' : 'ok'}><span>{c.result === 'Pass' ? '✓' : c.result === 'Fail' ? '✕' : '–'}</span><span>{c.item}{c.result ? '' : ' (not yet checked)'}</span></li>)}</ul></section>}
      {q.tests.length > 0 && <section className="drawer-section"><h3>Tests</h3><DataTable rowKey="name" rows={q.tests} columns={[{ key: 'name', header: 'Test' }, { key: 'value', header: 'Result' }, { key: 'spec', header: 'Specification' }, { key: 'result', header: '', render: (t) => <Badge tone={t.result === 'Fail' ? 'danger' : 'success'}>{t.result}</Badge> }]} /></section>}
      <PhotoStrip photos={q.photos} />
      {q.reviewStatus === 'Awaiting QA review' && (ctx.perms.qaReview && !own ? (
        <section className="drawer-section">
          <h3>Independent QA review</h3>
          <p className="cell-sub">No QA login exists in this demo; Admin holds the QA review permission.</p>
          <label className="field">Note<input value={note} onChange={(e) => setNote(e.target.value)} /></label>
          <div className="jv-submit" style={{ marginTop: 8 }}>
            <button className="btn btn-primary" onClick={() => ctx.act('qaReview', { id: q.id, accept: true, note }) && onClose()}>QA accept</button>
            <button className="btn" onClick={() => ctx.act('qaReview', { id: q.id, accept: false, note }) && onClose()}>QA reject</button>
          </div>
          <FormError error={ctx.error} />
        </section>
      ) : <div className="drawer-section"><Locked>QA review is independent; the Site Engineer cannot override it</Locked></div>)}
    </Drawer>
  )
}

/** Correction progress by the action owner; completion needs evidence and goes to QA for verification. */
function NcrAction({ n, ctx }) {
  const [note, setNote] = useState('')
  const [evidence, setEvidence] = useState('')
  if (!n.action) return <span className="cell-sub">—</span>
  const mine = n.action.owner === ctx.user.name
  const withQA = ['Awaiting Verification', 'Reinspection Required', 'Closed'].includes(ncrStatus(n))
  if (!mine || withQA) return <span className="cell-sub">{n.action.owner}{withQA && ncrStatus(n) !== 'Closed' ? ' · with QA' : ''}</span>
  return (
    <div className="cell-actions">
      <input className="inline-input" placeholder="What was done" value={note} onChange={(e) => setNote(e.target.value)} aria-label="Action note" />
      <input type="file" aria-label="Evidence of correction" onChange={(e) => setEvidence(e.target.files?.[0]?.name || '')} style={{ maxWidth: 170 }} />
      {n.action.status !== 'In Progress' && <button className="btn btn-sm" onClick={() => ctx.act('updateCorrectiveAction', { id: n.id, note: note || 'Correction started', done: false })}>Start</button>}
      <button className="btn btn-sm btn-primary" title="Evidence required; QA verifies and reinspects" onClick={() => ctx.act('updateCorrectiveAction', { id: n.id, note, evidence: evidence ? [evidence] : [], done: true }) && setNote('')}>Done</button>
    </div>
  )
}

export default function Quality({ notify, search }) {
  const ctx = useSiteEngineer(notify)
  const d = siteData(ctx)
  const [params, setParams] = useSearchParams()
  const [form, setForm] = useState(params.get('new') === '1' ? 'new' : null) // 'new' | inspection
  const [view, setView] = useState(null)
  const [status, setStatus] = useState(params.get('status') || 'all')
  const [type, setType] = useState('all')
  const q = (search || '').toLowerCase()
  const match = (x) => status === 'all' || (status === 'pending' ? ['Scheduled', 'Overdue'].includes(x.status) : status === 'qa' ? x.reviewStatus === 'Awaiting QA review' : resultOf(x) === status || x.status === status)
  const rows = [...d.inspections].filter((x) => match(x) && (type === 'all' || x.type === type) && (!q || `${x.id} ${x.title} ${x.type} ${x.location}`.toLowerCase().includes(q))).sort((a, b) => b.date.localeCompare(a.date))
  const closeForm = () => { setForm(null); if (params.get('new')) setParams({}) }
  const viewing = view && d.inspections.find((x) => x.id === view)
  const canRecord = (x) => x.owner === 'Site Engineer' && x.status === 'Scheduled' && (x.inspector === ctx.user.name || ctx.perms.qaReview)

  return (
    <>
      <QaRequestsCard ctx={ctx} />
      <Card title="Inspection schedule" sub="QA and third-party inspections are read-only here; your own technical inspections await independent QA review" bodyClass=""
        action={ctx.perms.inspect ? <button className="btn btn-primary btn-sm" onClick={() => setForm('new')}><Icon name="plus" size={14} />New inspection</button> : <Locked>View only</Locked>}>
        <div className="toolbar">
          <div className="filters">
            <label className="field">Result / status<select value={status} onChange={(e) => setStatus(e.target.value)}><option value="all">All</option><option value="pending">Pending (scheduled or overdue)</option><option value="qa">Awaiting QA review</option>{['Scheduled', 'Overdue', 'Pass', 'Fail', 'Needs Reinspection'].map((s) => <option key={s}>{s}</option>)}</select></label>
            <label className="field">Type<select value={type} onChange={(e) => setType(e.target.value)}><option value="all">All</option>{TYPES.map((s) => <option key={s}>{s}</option>)}</select></label>
          </div>
        </div>
        <DataTable dense rows={rows} emptyText="No inspections match these filters." columns={[
          { key: 'id', header: 'Inspection ID', render: (x) => <button className="link-btn" onClick={() => setView(x.id)}>{x.id}</button> },
          { key: 'l', header: 'Project / work area', render: (x) => <>{x.location}<div className="cell-sub">{x.siteId ? siteOf(x.siteId)?.name : 'Project-wide'}</div></> },
          { key: 't', header: 'Activity / material inspected', render: (x) => <span className="wrap-cell">{x.title}<div className="cell-sub">{x.type}</div></span> },
          { key: 'd', header: 'Date', render: (x) => <span className={x.status === 'Overdue' ? 'down' : ''}>{formatDate(x.date)}</span> },
          { key: 'c', header: 'Checklist', align: 'num', render: (x) => (x.checklist.length ? `${x.checklist.filter((c) => c.result === 'Pass').length}/${x.checklist.length} pass` : '—') },
          { key: 'i', header: 'Inspector', render: (x) => <>{x.inspector}<div className="cell-sub">{x.owner}</div></> },
          { key: 's', header: 'Result', render: (x) => <><Badge>{resultOf(x)}</Badge>{x.reinspectionDate && <div className="cell-sub">reinspect {formatDate(x.reinspectionDate)}</div>}</> },
          { key: 'qa', header: 'QA/QC review', render: (x) => (x.clearance ? <><Badge tone="success">QA-cleared</Badge><div className="cell-sub">{x.clearance.activity}</div></> : x.reviewStatus ? <Badge>{x.reviewStatus}</Badge> : <span className="cell-sub">{x.owner === 'Site Engineer' ? 'After result' : x.parentId ? `Reinspection of ${x.parentId}` : 'QA record'}</span>) },
          { key: 'x', header: '', render: (x) => <div className="cell-actions">{canRecord(x) && ctx.perms.inspect && <button className="btn btn-sm btn-primary" onClick={() => setForm(x)}>Record result</button>}<button className="btn btn-sm" onClick={() => setView(x.id)}>View</button></div> },
        ]} />
      </Card>

      <Card title="Non-conformances & corrective actions" sub="Defects found on your sites; the action owner updates progress, reinspection confirms closure" bodyClass="" className="section-gap">
        <DataTable dense rows={d.ncrs} emptyText="No non-conformances." columns={[
          { key: 'id', header: 'NCR', render: (n) => <><div className="cell-main">{n.id}</div><div className="cell-sub">{formatDate(n.reported)}</div></> },
          { key: 'd', header: 'Defect', render: (n) => <span className="wrap-cell">{n.description}</span> },
          { key: 's', header: 'Severity', render: (n) => <Badge>{n.severity}</Badge> },
          { key: 'a', header: 'Corrective action', render: (n) => (n.action ? <span className="wrap-cell">{n.action.text}<div className="cell-sub">{n.action.id} · {n.action.owner} · due {formatDate(n.action.due)} · {n.action.status}</div></span> : '—') },
          { key: 'r', header: 'Reinspection', render: (n) => (n.reinspectionDate ? formatDate(n.reinspectionDate) : '—') },
          { key: 'st', header: 'Status', render: (n) => <Badge>{ncrStatus(n)}</Badge> },
          { key: 'o', header: 'Owner / update', render: (n) => <NcrAction n={n} ctx={ctx} /> },
        ]} />
        <div style={{ padding: '0 18px 12px' }}><FormError error={ctx.error} /></div>
      </Card>

      {form && <InspectionForm ctx={ctx} existing={form === 'new' ? null : form} onClose={closeForm} />}
      {viewing && <InspectionView q={viewing} ctx={ctx} onClose={() => setView(null)} />}
    </>
  )
}
