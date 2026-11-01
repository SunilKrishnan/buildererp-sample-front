import { useEffect } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import { DemoTag } from '../../components/StateViews.jsx'
import { PageHead } from '../../components/UI.jsx'
import { SUPERVISOR_SECTIONS, supervisorPath } from '../../config/navigation.js'
import { useSupervisor } from './shared.jsx'
import Overview from './Overview.jsx'
import Attendance from './Attendance.jsx'
import Allocation from './Allocation.jsx'
import Labour from './Labour.jsx'
import Progress from './Progress.jsx'
import Materials from './Materials.jsx'
import Issues from './Issues.jsx'
import Safety from './Safety.jsx'
import Diary from './Diary.jsx'
import Reports from './Reports.jsx'

const PAGES = { overview: Overview, attendance: Attendance, allocation: Allocation, labour: Labour, progress: Progress, materials: Materials, issues: Issues, safety: Safety, diary: Diary, reports: Reports }

/**
 * Site Supervisor Dashboard: one page per section (/supervisor/:section), all reading the shared
 * site and inventory records. A supervisor sees only the sites where they are the named supervisor.
 */
export default function SiteSupervisorDashboard({ search, notify }) {
  const { section = 'overview' } = useParams()
  const navigate = useNavigate()
  const ctx = useSupervisor(notify)
  const meta = SUPERVISOR_SECTIONS.find((s) => s.id === section)
  useEffect(() => { window.scrollTo?.(0, 0) }, [section])
  if (!meta) return <Navigate to={supervisorPath('overview')} replace />
  const Page = PAGES[section]
  const go = (id, query = '') => navigate(`${supervisorPath(id)}${query ? `?${query}` : ''}`)

  return (
    <>
      <PageHead title={section === 'overview' ? 'Site Supervisor Dashboard' : meta.label} sub={meta.sub}>
        <DemoTag />
      </PageHead>
      {ctx.scope.all && <div className="info-note"><span>ℹ</span><div>Viewing as <b>Admin</b>: every site is shown for oversight. A Site Supervisor sees only the sites they supervise.</div></div>}
      {ctx.scope.siteIds.length === 0
        ? <div className="card state"><h3>No site assigned</h3><p>You see site records once you are named as the Site Supervisor of a site.</p></div>
        : <Page key={section} search={search} notify={notify} go={go} />}
    </>
  )
}
