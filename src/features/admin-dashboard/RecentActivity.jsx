import Icon from '../../components/Icon.jsx'
import { Card } from '../../components/UI.jsx'
import { DemoTag } from '../../components/StateViews.jsx'
import { formatDate, relativeDay } from '../../utils/format.js'

const TYPE_STYLE = {
  project: ['building', 'info'],
  attendance: ['users', 'success'],
  purchase: ['cart', 'info'],
  approval: ['check', 'warning'],
  inventory: ['box', 'success'],
  sales: ['handshake', 'success'],
  safety: ['alert', 'danger'],
  finance: ['wallet', 'warning'],
}

export default function RecentActivity({ activity, limit = 10 }) {
  const items = activity.slice(0, limit)
  const groups = items.reduce((acc, a) => {
    const day = a.date.slice(0, 10)
    ;(acc[day] = acc[day] || []).push(a)
    return acc
  }, {})

  return (
    <Card title="Recent Activity" sub="Newest first" action={<DemoTag>Demo activity</DemoTag>}>
      {items.length === 0 && <div className="empty sm">No activity in the selected range.</div>}
      {Object.entries(groups).map(([day, rows]) => (
        <div key={day} className="activity-day">
          <div className="activity-date">{relativeDay(day)} · {formatDate(day)}</div>
          <ul className="list">
            {rows.map((a) => {
              const [icon, tone] = TYPE_STYLE[a.type] || ['grid', 'info']
              return (
                <li key={a.id}>
                  <div className="dot-ico" style={{ background: `var(--${tone}-soft)`, color: `var(--${tone})` }}>
                    <Icon name={icon} />
                  </div>
                  <div>
                    <div className="t">{a.text}</div>
                    <div className="s">{a.actor} · {a.projectName}</div>
                  </div>
                  <div className="r">{a.date.slice(11, 16)}</div>
                </li>
              )
            })}
          </ul>
        </div>
      ))}
    </Card>
  )
}
