import Icon from '../../components/Icon.jsx'
import { Chips } from '../../components/UI.jsx'

/** Case-insensitive match of every search term against any of the given fields. */
export function matchesSearch(row, fields, terms) {
  if (!terms.length) return true
  const hay = fields.map((f) => String(row[f] ?? '')).join(' ').toLowerCase()
  return terms.every((t) => hay.includes(t))
}

/** Status chips + optional note, shown above a section table. */
export function SectionToolbar({ statuses, status, onStatusChange, children }) {
  return (
    <div className="toolbar">
      {statuses && <Chips options={statuses} value={status} onChange={onStatusChange} />}
      {children}
    </div>
  )
}

/** Explains why an action is not available to the current demo role. */
export function LockedNote({ children }) {
  return (
    <span className="locked-note" title="Demo permission preview, not real access control">
      <Icon name="lock" size={13} />
      {children}
    </span>
  )
}

/** Undo for a status changed on screen during this session (demo only). */
export function UndoButton({ onClick }) {
  return <button className="btn btn-sm" onClick={onClick} title="Revert this on-screen change">Undo</button>
}
