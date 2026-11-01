// tabs: [{ id, label, count? }]
export default function Tabs({ tabs, value, onChange, label = 'Sections' }) {
  return (
    <div className="tabs" role="tablist" aria-label={label}>
      {tabs.map((t) => (
        <button
          key={t.id}
          role="tab"
          aria-selected={value === t.id}
          className={`tab ${value === t.id ? 'active' : ''}`}
          onClick={() => onChange(t.id)}
        >
          {t.label}
          {t.count > 0 && <span className="count">{t.count}</span>}
        </button>
      ))}
    </div>
  )
}
