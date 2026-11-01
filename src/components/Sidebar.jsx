import { NavLink } from 'react-router-dom'
import Icon from './Icon.jsx'
import { useDemoSession } from '../auth/DemoSession.jsx'
import { navGroupsForRole } from '../config/navigation.js'

export default function Sidebar() {
  const { user, role } = useDemoSession()
  const groups = navGroupsForRole(role)

  return (
    <aside className="sidebar">
      <div className="brand">
        <div className="brand-logo"><Icon name="building" size={20} /></div>
        <div>
          <div className="brand-name">BuildDesk</div>
          <div className="brand-sub">Construction ERP</div>
        </div>
      </div>

      <nav className="nav">
        {groups.map((g) => (
          <div key={g.label} style={{ display: 'contents' }}>
            <div className="nav-label">{g.label}</div>
            {g.items.map((it) => (
              <NavLink key={it.to} to={it.to}>
                <Icon name={it.icon} />
                {it.label}
              </NavLink>
            ))}
          </div>
        ))}
      </nav>

      <div className="sidebar-foot">
        <div className="avatar">{user.initials}</div>
        <div>
          <div className="who-name">{user.name}</div>
          <div className="who-role">{role.title} · demo user</div>
        </div>
      </div>
    </aside>
  )
}
