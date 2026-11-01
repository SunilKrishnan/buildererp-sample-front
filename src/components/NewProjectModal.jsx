import { useEffect } from 'react'
import Icon from './Icon.jsx'

export default function NewProjectModal({ open, onClose, onCreate }) {
  useEffect(() => {
    if (!open) return
    const onKey = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  const handleSubmit = (e) => {
    e.preventDefault()
    const f = Object.fromEntries(new FormData(e.target))
    onCreate({
      name: f.name,
      location: f.location,
      type: f.type,
      budget: Number(f.budget),
      deadline: f.deadline,
    })
  }

  return (
    <div className="modal" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-card" role="dialog" aria-modal="true" aria-labelledby="np-title">
        <div className="modal-head">
          <h3 id="np-title">New Project</h3>
          <button className="icon-btn" onClick={onClose} aria-label="Close"><Icon name="x" /></button>
        </div>
        <form className="form" onSubmit={handleSubmit}>
          <label>Project name<input required name="name" placeholder="e.g. Green Valley Villas" autoFocus /></label>
          <div className="form-row">
            <label>Location<input required name="location" placeholder="City" /></label>
            <label>
              Type
              <select name="type">
                <option>Residential</option>
                <option>Commercial</option>
                <option>Villa</option>
                <option>Infrastructure</option>
              </select>
            </label>
          </div>
          <div className="form-row">
            <label>Budget (₹ Cr)<input required name="budget" type="number" step="0.1" min="0" placeholder="12.5" /></label>
            <label>Deadline<input required name="deadline" type="date" /></label>
          </div>
          <div className="modal-foot">
            <button type="button" className="btn" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary">Create Project</button>
          </div>
        </form>
      </div>
    </div>
  )
}
