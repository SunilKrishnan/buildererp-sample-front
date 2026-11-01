import { useCallback, useEffect, useState } from 'react'
import { Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import Sidebar from './components/Sidebar.jsx'
import Topbar from './components/Topbar.jsx'
import NewProjectModal from './components/NewProjectModal.jsx'
import { projects as seedProjects } from './data/mockData.js'
import { todayISO } from './utils/date.js'
import { useDemoSession } from './auth/DemoSession.jsx'
import { homePathForRole } from './config/navigation.js'

import AdminDashboard from './features/admin-dashboard/AdminDashboard.jsx'
import AccountantDashboard from './features/accountant-dashboard/AccountantDashboard.jsx'
import BillApprovals from './features/bill-review/BillApprovals.jsx'
import StoreKeeperDashboard from './features/store-keeper/StoreKeeperDashboard.jsx'
import PurchaseManagerDashboard from './features/purchase-manager/PurchaseManagerDashboard.jsx'
import SuppliersPage from './pages/SuppliersPage.jsx'
import SiteEngineerDashboard from './features/site-engineer/SiteEngineerDashboard.jsx'
import ProjectManagerReviews from './features/project-manager/ProjectManagerReviews.jsx'
import SiteSupervisorDashboard from './features/site-supervisor/SiteSupervisorDashboard.jsx'
import QADashboard from './features/qa/QADashboard.jsx'
import SafetyDashboard from './features/safety/SafetyDashboard.jsx'
import Projects from './pages/Projects.jsx'
import ProjectDetails from './pages/ProjectDetails.jsx'
import Sites from './pages/Sites.jsx'
import Materials from './pages/Materials.jsx'
import PurchaseOrders from './pages/PurchaseOrders.jsx'
import Labour from './pages/Labour.jsx'
import Finance from './pages/Finance.jsx'
import Clients from './pages/Clients.jsx'
import Settings from './pages/Settings.jsx'
import NotFound from './pages/NotFound.jsx'

const getInitialTheme = () => {
  try {
    const saved = localStorage.getItem('theme')
    if (saved) return saved
  } catch {}
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

export default function App() {
  const location = useLocation()
  const navigate = useNavigate()
  const { role } = useDemoSession()
  const [theme, setTheme] = useState(getInitialTheme)
  const [navOpen, setNavOpen] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [projects, setProjects] = useState(seedProjects)
  const [toast, setToast] = useState('')

  useEffect(() => {
    setSearch('')
    setNavOpen(false)
  }, [location.pathname])

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    try { localStorage.setItem('theme', theme) } catch {}
  }, [theme])

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(''), 3200)
    return () => clearTimeout(t)
  }, [toast])

  const closeModal = useCallback(() => setModalOpen(false), [])

  const createProject = (p) => {
    const id = `P-${100 + projects.length + 1}`
    setProjects([{ id, short: p.name, startDate: todayISO(), ...p, spent: 0, progress: 0, status: 'On Track', units: 0, manager: 'Admin User' }, ...projects])
    setModalOpen(false)
    setToast(`Demo: "${p.name}" added for this session only (not saved)`)
    navigate('/projects')
  }

  const pageProps = { projects, search, notify: setToast }

  return (
    <div className={`app ${navOpen ? 'nav-open' : ''}`}>
      <Sidebar />
      <div className="scrim" onClick={() => setNavOpen(false)} />

      <div className="main">
        <Topbar
          theme={theme}
          onToggleTheme={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          onMenu={() => setNavOpen(true)}
          onNew={() => setModalOpen(true)}
          search={search}
          onSearch={setSearch}
        />
        <main className="content">
          <Routes>
            <Route path="/" element={<Navigate to={homePathForRole(role)} replace />} />
            <Route path="/dashboard" element={<AdminDashboard {...pageProps} />} />
            <Route path="/dashboards" element={<Navigate to={homePathForRole(role)} replace />} />
            <Route path="/dashboards/admin" element={<Navigate to="/dashboard" replace />} />
            {/* One layout route for all Accounts pages, so on-screen demo changes survive moving between them */}
            <Route element={<AccountantDashboard {...pageProps} />}>
              <Route path="/dashboards/accountant" element={null} />
              <Route path="/accounts/:section" element={null} />
            </Route>
            <Route path="/accounts" element={<Navigate to="/dashboards/accountant" replace />} />
            <Route path="/dashboards/store-keeper" element={<StoreKeeperDashboard {...pageProps} />} />
            <Route path="/dashboards/purchase-manager" element={<PurchaseManagerDashboard {...pageProps} />} />
            <Route path="/suppliers" element={<SuppliersPage {...pageProps} />} />
            <Route path="/dashboards/site-engineer" element={<SiteEngineerDashboard {...pageProps} />} />
            <Route path="/site/:section" element={<SiteEngineerDashboard {...pageProps} />} />
            <Route path="/dashboards/project-manager" element={<ProjectManagerReviews {...pageProps} />} />
            <Route path="/dashboards/site-supervisor" element={<SiteSupervisorDashboard {...pageProps} />} />
            <Route path="/supervisor/:section" element={<SiteSupervisorDashboard {...pageProps} />} />
            <Route path="/dashboards/qa" element={<QADashboard {...pageProps} />} />
            <Route path="/qa/:section" element={<QADashboard {...pageProps} />} />
            <Route path="/dashboards/safety-officer" element={<SafetyDashboard {...pageProps} />} />
            <Route path="/safety/:section" element={<SafetyDashboard {...pageProps} />} />
            <Route path="/approvals/bills" element={<BillApprovals {...pageProps} />} />
            <Route path="/projects" element={<Projects {...pageProps} />} />
            <Route path="/projects/:projectId" element={<ProjectDetails {...pageProps} />} />
            <Route path="/sites" element={<Sites {...pageProps} />} />
            <Route path="/materials" element={<Materials {...pageProps} />} />
            <Route path="/purchase-orders" element={<PurchaseOrders {...pageProps} />} />
            <Route path="/labour" element={<Labour {...pageProps} />} />
            <Route path="/finance" element={<Finance {...pageProps} />} />
            <Route path="/clients" element={<Clients {...pageProps} />} />
            <Route path="/settings" element={<Settings {...pageProps} />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </main>
      </div>

      <NewProjectModal open={modalOpen} onClose={closeModal} onCreate={createProject} />
      <div className={`toast ${toast ? 'show' : ''}`} role="status">{toast}</div>
    </div>
  )
}
