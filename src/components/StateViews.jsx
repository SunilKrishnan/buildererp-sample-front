import Icon from './Icon.jsx'

export function LoadingState({ blocks = 8 }) {
  return (
    <div aria-busy="true" aria-label="Loading dashboard">
      <div className="summary-grid">
        {Array.from({ length: blocks }, (_, i) => <div key={i} className="skeleton" style={{ height: 112 }} />)}
      </div>
      <div className="grid halves">
        <div className="skeleton" style={{ height: 280 }} />
        <div className="skeleton" style={{ height: 280 }} />
      </div>
    </div>
  )
}

export function ErrorState({ message, onRetry }) {
  return (
    <div className="card state" role="alert">
      <div className="state-icon danger"><Icon name="alert" size={22} /></div>
      <h3>Couldn't load dashboard data</h3>
      <p>{message || 'Something went wrong.'}</p>
      {onRetry && <button className="btn btn-primary" onClick={onRetry}>Try again</button>}
    </div>
  )
}

export function EmptyState({ title = 'No data', message, action }) {
  return (
    <div className="card state">
      <div className="state-icon"><Icon name="box" size={22} /></div>
      <h3>{title}</h3>
      {message && <p>{message}</p>}
      {action}
    </div>
  )
}

export function DemoTag({ children = 'Demo data' }) {
  return <span className="demo-tag" title="Illustrative data for UI review, not real figures">{children}</span>
}
