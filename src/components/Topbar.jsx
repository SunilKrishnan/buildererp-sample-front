import { useLocation, useNavigate } from 'react-router-dom'
import Icon from './Icon.jsx'
import { useDemoSession } from '../auth/DemoSession.jsx'
import { can, PERMISSIONS, ROLES, ROLE_IDS } from '../auth/demoRoles.js'
import { ROLE_DASHBOARDS, dashboardsForRole, homePathForRole } from '../config/navigation.js'

export default function Topbar({ theme, onToggleTheme, onMenu, onNew, search, onSearch }) {
  const { role, setRole } = useDemoSession()
  const location = useLocation()
  const navigate = useNavigate()

  const changeRole = (id) => {
    setRole(id)
    // If the current dashboard isn't one the new role uses, go to that role's home dashboard.
    const onDashboard = ROLE_DASHBOARDS.some((d) => d.to === location.pathname)
    const visible = dashboardsForRole(ROLES[id]).some((d) => d.to === location.pathname)
    if (onDashboard && !visible) navigate(homePathForRole(ROLES[id]))
  }

  return (
    <header className="topbar">
      <button className="icon-btn menu-btn" onClick={onMenu} aria-label="Open menu">
        <Icon name="menu" />
      </button>

      <div className="search">
        <Icon name="search" />
        <input
          type="search"
          placeholder="Search projects, materials, invoices…"
          value={search}
          onChange={(e) => onSearch(e.target.value)}
        />
      </div>

      <div className="top-actions">
        <span className="demo-pill hide-sm" title="No backend connected. All data is illustrative.">Demo mode</span>
        <label className="role-preview" title="Design preview only. This is not a login and does not secure anything.">
          <span className="hide-sm">Preview as</span>
          <select value={role.id} onChange={(e) => changeRole(e.target.value)} aria-label="Preview the prototype as role (demo only)">
            {ROLE_IDS.map((id) => <option key={id} value={id}>{ROLES[id].label}</option>)}
          </select>
        </label>
        <button className="icon-btn" onClick={onToggleTheme} aria-label="Toggle theme">
          <Icon name={theme === 'dark' ? 'sun' : 'moon'} />
        </button>
        <button className="icon-btn has-dot" aria-label="Notifications">
          <Icon name="bell" />
        </button>
        {can(role.id, PERMISSIONS.PROJECT_CREATE) && (
          <button className="btn btn-primary" onClick={onNew}>
            <Icon name="plus" />
            <span className="hide-sm">New Project</span>
          </button>
        )}
      </div>
    </header>
  )
}
