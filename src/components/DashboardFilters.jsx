import { RANGE_OPTIONS } from '../utils/date.js'
import { formatDate } from '../utils/format.js'

// `children` renders extra page-specific fields (search, status…) after the shared ones.
export default function DashboardFilters({ projectOptions, projectId, range, from, to, resolved, onChange, children }) {
  return (
    <div className="filters">
      <label className="field">
        Project
        <select value={projectId} onChange={(e) => onChange({ project: e.target.value === 'all' ? null : e.target.value })}>
          <option value="all">All projects</option>
          {projectOptions.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
      </label>

      <label className="field">
        Date range
        <select
          value={range}
          onChange={(e) => {
            const r = e.target.value
            onChange(r === 'custom' ? { range: r, from: resolved.from, to: resolved.to } : { range: r, from: null, to: null })
          }}
        >
          {RANGE_OPTIONS.map((r) => (
            <option key={r.id} value={r.id}>{r.label}</option>
          ))}
        </select>
      </label>

      {range === 'custom' && (
        <>
          <label className="field">
            From
            <input type="date" value={from || resolved.from} max={to || resolved.to} onChange={(e) => onChange({ from: e.target.value })} />
          </label>
          <label className="field">
            To
            <input type="date" value={to || resolved.to} min={from || resolved.from} onChange={(e) => onChange({ to: e.target.value })} />
          </label>
        </>
      )}

      {range !== 'custom' && (
        <div className="field-hint">{range === 'all' ? 'All records' : `${formatDate(resolved.from)} – ${formatDate(resolved.to)}`}</div>
      )}

      {children}
    </div>
  )
}
