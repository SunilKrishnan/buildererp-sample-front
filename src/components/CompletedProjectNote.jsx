import Icon from './Icon.jsx'
import { formatDate } from '../utils/format.js'

/** Shown when a completed project is viewed with a short date range that hides most of its history. */
export default function CompletedProjectNote({ project, range, onShowAll }) {
  if (!project || project.status !== 'Completed' || range === 'all') return null
  return (
    <div className="info-note" role="note">
      <Icon name="calendar" size={14} />
      <span>
        <b>{project.name}</b> was completed{project.completedOn ? ` on ${formatDate(project.completedOn)}` : ''}, so most of its
        receipts, bills and costs are older than the selected date range.{' '}
        <button className="link-btn" onClick={onShowAll}>Show all time</button>
      </span>
    </div>
  )
}
