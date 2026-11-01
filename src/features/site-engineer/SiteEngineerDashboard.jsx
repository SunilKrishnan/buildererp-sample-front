import { useEffect } from 'react'
import { Navigate, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { DemoTag } from '../../components/StateViews.jsx'
import Tabs from '../../components/Tabs.jsx'
import { PageHead } from '../../components/UI.jsx'
import { SITE_SECTION_ALIASES, SITE_SECTIONS, siteLink } from '../../config/navigation.js'
import { useSiteEngineer } from './shared.jsx'
import Overview from './Overview.jsx'
import ProjectsSites from './ProjectsSites.jsx'
import Schedule from './Schedule.jsx'
import DailyProgress from './DailyProgress.jsx'
import MaterialRequests from './MaterialRequests.jsx'
import Labour from './Labour.jsx'
import Quality from './Quality.jsx'
import Safety from './Safety.jsx'
import Documents from './Documents.jsx'
import Issues from './Issues.jsx'
import Equipment from './Equipment.jsx'
import Measurements from './Measurements.jsx'
import Diary from './Diary.jsx'
import Reports from './Reports.jsx'
import Communication from './Communication.jsx'
import Profile from './Profile.jsx'

// Section → page, or tab → page for sections with tabs (see SITE_SECTIONS)
const PAGES = {
  overview: Overview, projects: ProjectsSites, materials: MaterialRequests, issues: Issues, drawings: Documents, settings: Profile,
  schedule: { tasks: Schedule, communication: Communication },
  progress: { reports: DailyProgress, measurements: Measurements, labour: Labour, equipment: Equipment },
  quality: { inspections: Quality, safety: Safety },
  diary: { diary: Diary, reports: Reports },
}

/**
 * Site Engineer Dashboard: one page per section (/site/:section, tabs via ?tab=), all reading the
 * shared site and inventory records. A Site Engineer sees only their assigned projects and sites.
 */
export default function SiteEngineerDashboard({ search, notify }) {
  const { section = 'overview' } = useParams()
  const [params, setParams] = useSearchParams()
  const navigate = useNavigate()
  const ctx = useSiteEngineer(notify)
  const meta = SITE_SECTIONS.find((s) => s.id === section)
  useEffect(() => { window.scrollTo?.(0, 0) }, [section])
  // Old section links (e.g. /site/safety) open the section and tab that now hold them
  if (!meta && SITE_SECTION_ALIASES[section]) return <Navigate to={siteLink(section, params.toString())} replace />
  if (!meta) return <Navigate to={siteLink('overview')} replace />
  const tab = meta.tabs ? (meta.tabs.find((t) => t.id === params.get('tab')) || meta.tabs[0]) : null
  const Page = tab ? PAGES[section][tab.id] : PAGES[section]
  /** Open a section (old ids work too) with an optional query, e.g. go('materials', 'new=1') */
  const go = (id, query = '') => navigate(siteLink(id, query))
  const noScope = ctx.scope.projectIds.length === 0

  return (
    <>
      <PageHead title={section === 'overview' ? 'Site Engineer Dashboard' : meta.label} sub={meta.sub}>
        <DemoTag />
      </PageHead>
      {ctx.scope.all && <div className="info-note"><span>ℹ</span><div>Viewing as <b>Admin</b>: all sites are shown for oversight. A Site Engineer sees only their assigned projects and sites.</div></div>}
      {meta.tabs && <Tabs label={meta.label} value={tab.id} onChange={(id) => setParams(id === meta.tabs[0].id ? {} : { tab: id })} tabs={meta.tabs} />}
      {noScope
        ? <div className="card state"><h3>No projects assigned</h3><p>You can see project data once the Project Manager assigns you to a site.</p></div>
        : <Page key={`${section}-${tab?.id || ''}`} search={search} notify={notify} go={go} />}
    </>
  )
}
