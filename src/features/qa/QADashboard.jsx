import { useEffect } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import { DemoTag } from '../../components/StateViews.jsx'
import { PageHead } from '../../components/UI.jsx'
import { QA_SECTIONS, qaPath } from '../../config/navigation.js'
import { useDemoSession } from '../../auth/DemoSession.jsx'
import Overview from './Overview.jsx'
import Schedule from './Schedule.jsx'
import Requests from './Requests.jsx'
import Checklists from './Checklists.jsx'
import Records from './Records.jsx'
import MaterialTests from './MaterialTests.jsx'
import Ncrs from './Ncrs.jsx'
import Actions from './Actions.jsx'
import Reinspection from './Reinspection.jsx'
import Drawings from './Drawings.jsx'
import Documents from './Documents.jsx'
import Reports from './Reports.jsx'
import Activity from './Activity.jsx'
import Settings from './Settings.jsx'

const PAGES = {
  overview: Overview, schedule: Schedule, requests: Requests, checklists: Checklists, records: Records, materials: MaterialTests, ncr: Ncrs,
  actions: Actions, reinspection: Reinspection, drawings: Drawings, documents: Documents, reports: Reports, activity: Activity, settings: Settings,
}
// Roles other than QA may open these sections for viewing (e.g. Accounts: verified quality documents)
const VIEW_ONLY_NOTE = {
  admin: 'Viewing as Admin: quality records are shown for oversight. Inspections, verification and clearance are recorded by the QA Engineer.',
  accountant: 'View only: verified quality documents for project and supplier records. Inspection authority stays with QA.',
}

/**
 * QA Dashboard: one page per section (/qa/:section, overview at /dashboards/qa), all reading the
 * shared site records (inspections, NCRs, documents) and the inventory records (GRNs, POs).
 */
export default function QADashboard({ search, notify }) {
  const { section = 'overview' } = useParams()
  const navigate = useNavigate()
  const { role } = useDemoSession()
  const meta = QA_SECTIONS.find((s) => s.id === section)
  useEffect(() => { window.scrollTo?.(0, 0) }, [section])
  if (!meta) return <Navigate to={qaPath('overview')} replace />
  const Page = PAGES[section]
  /** Open a section with an optional query, e.g. go('schedule', 'status=Overdue') */
  const go = (id, query = '') => navigate(`${qaPath(id)}${query ? `?${query}` : ''}`)
  return (
    <>
      <PageHead title={section === 'overview' ? 'QA Dashboard' : meta.label} sub={meta.sub}>
        <DemoTag />
      </PageHead>
      {role.id !== 'qa' && <div className="info-note"><span>ℹ</span><div>{VIEW_ONLY_NOTE[role.id] || 'View only for your role. Quality records are maintained by the QA Engineer.'}</div></div>}
      <Page key={section} search={search} notify={notify} go={go} />
    </>
  )
}
