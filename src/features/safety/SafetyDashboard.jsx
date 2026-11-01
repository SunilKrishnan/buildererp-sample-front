import { useEffect } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import { useDemoSession } from '../../auth/DemoSession.jsx'
import { DemoTag } from '../../components/StateViews.jsx'
import { PageHead } from '../../components/UI.jsx'
import { SAFETY_SECTIONS, safetyPath } from '../../config/navigation.js'
import Overview from './Overview.jsx'
import Inspections from './Inspections.jsx'
import Hazards from './Hazards.jsx'
import Incidents from './Incidents.jsx'
import Actions from './Actions.jsx'
import PPE from './PPE.jsx'
import Training from './Training.jsx'
import Permits from './Permits.jsx'
import Emergency from './Emergency.jsx'
import Documents from './Documents.jsx'
import Reports from './Reports.jsx'
import Activity from './Activity.jsx'

const PAGES = { overview: Overview, inspections: Inspections, hazards: Hazards, incidents: Incidents, actions: Actions, ppe: PPE, training: Training, permits: Permits, emergency: Emergency, documents: Documents, reports: Reports, activity: Activity }

/**
 * Safety Officer Dashboard: one page per section (/safety/:section, overview at
 * /dashboards/safety-officer), all on the shared site records.
 */
export default function SafetyDashboard({ search, notify }) {
  const { section = 'overview' } = useParams()
  const navigate = useNavigate()
  const { role } = useDemoSession()
  const meta = SAFETY_SECTIONS.find((s) => s.id === section)
  useEffect(() => { window.scrollTo?.(0, 0) }, [section])
  if (!meta) return <Navigate to={safetyPath('overview')} replace />
  const Page = PAGES[section]
  const go = (id, query = '') => navigate(`${safetyPath(id)}${query ? `?${query}` : ''}`)
  return (
    <>
      <PageHead title={section === 'overview' ? 'Safety Officer Dashboard' : meta.label} sub={meta.sub}><DemoTag /></PageHead>
      {role.id !== 'safetyofficer' && <div className="info-note"><span>ℹ</span><div>{role.id === 'admin' ? 'Viewing as Admin: safety records for oversight. Review, verification and closure are recorded by the Safety Officer; you can approve permits to work.' : 'View only for your role. Safety records are maintained by the Safety Officer.'}</div></div>}
      <Page key={section} search={search} notify={notify} go={go} />
    </>
  )
}
