// Compact stat tiles used inside dashboard sections.
// items: [{ label, value, sub?, tone?: 'danger' | 'warning' | 'success' }]
export default function StatGrid({ items }) {
  return (
    <div className="stat-grid">
      {items.map((s) => (
        <div key={s.label} className={`stat ${s.tone ? `tone-${s.tone}` : ''}`}>
          <div className="k">{s.label}</div>
          <div className="v">{s.value}</div>
          {s.sub && <div className="s">{s.sub}</div>}
        </div>
      ))}
    </div>
  )
}
