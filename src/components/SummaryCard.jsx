import Icon from './Icon.jsx'

export default function SummaryCard({ label, value, sub, icon, tone, onClick, children }) {
  const Tag = onClick ? 'button' : 'div'
  return (
    <Tag className={`card summary-card ${tone ? `tone-${tone}` : ''}`} onClick={onClick} type={onClick ? 'button' : undefined}>
      <div className="kpi-top">
        <span>{label}</span>
        <div className="kpi-icon"><Icon name={icon} /></div>
      </div>
      <div className="kpi-value">{value}</div>
      {sub && <div className="kpi-foot">{sub}</div>}
      {children}
    </Tag>
  )
}
