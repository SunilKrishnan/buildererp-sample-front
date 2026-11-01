import { Link } from 'react-router-dom'
import { EmptyState } from '../components/StateViews.jsx'
import { useDemoSession } from '../auth/DemoSession.jsx'
import { homePathForRole } from '../config/navigation.js'

export default function NotFound() {
  const { role } = useDemoSession()
  return (
    <EmptyState
      title="Page not found"
      message="The page you're looking for doesn't exist."
      action={<Link className="btn btn-primary" to={homePathForRole(role)}>Go to dashboard</Link>}
    />
  )
}
