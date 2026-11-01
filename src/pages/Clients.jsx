import { useState } from 'react'
import { Badge, Card, Chips, Kpi, PageHead } from '../components/UI.jsx'
import { clients } from '../data/mockData.js'

const stages = ['New Lead', 'Contacted', 'Site Visit', 'Negotiation', 'Booked', 'Lost']

export default function Clients({ search }) {
  const [filter, setFilter] = useState('All')
  const q = search.toLowerCase()
  const list = clients.filter(
    (c) =>
      (filter === 'All' || c.stage === filter) &&
      (!q || `${c.name} ${c.interest} ${c.source} ${c.owner}`.toLowerCase().includes(q))
  )
  const booked = clients.filter((c) => c.stage === 'Booked').length
  const open = clients.filter((c) => !['Booked', 'Lost'].includes(c.stage)).length

  return (
    <>
      <PageHead title="Clients & Leads" sub="Sales pipeline for all projects" />

      <div className="grid kpis">
        <Kpi label="Total Leads" value={clients.length} icon="users" delta={18} foot="this month" />
        <Kpi label="Open Pipeline" value={open} icon="handshake" />
        <Kpi label="Bookings" value={booked} icon="check" />
        <Kpi label="Conversion" value={`${Math.round((booked / clients.length) * 100)}%`} icon="trend" />
      </div>

      <Card title="Pipeline" bodyClass="card-body">
        <div className="grid" style={{ gridTemplateColumns: `repeat(auto-fit, minmax(120px, 1fr))`, gap: 10 }}>
          {stages.map((s) => {
            const n = clients.filter((c) => c.stage === s).length
            return (
              <div key={s} className="card" style={{ padding: 14, boxShadow: 'none', background: 'var(--surface-2)' }}>
                <div className="cell-sub">{s}</div>
                <div className="kpi-value" style={{ fontSize: 22 }}>{n}</div>
              </div>
            )
          })}
        </div>
      </Card>

      <div style={{ height: 16 }} />

      <Card bodyClass="">
        <div className="toolbar">
          <Chips options={['All', ...stages]} value={filter} onChange={setFilter} />
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>Client</th><th>Interested in</th><th>Source</th><th>Budget</th><th>Owner</th><th>Stage</th></tr>
            </thead>
            <tbody>
              {list.map((c) => (
                <tr key={c.name}>
                  <td><div className="cell-main">{c.name}</div><div className="cell-sub">{c.phone}</div></td>
                  <td>{c.interest}</td>
                  <td>{c.source}</td>
                  <td>{c.budget}</td>
                  <td>{c.owner}</td>
                  <td><Badge>{c.stage}</Badge></td>
                </tr>
              ))}
            </tbody>
          </table>
          {list.length === 0 && <div className="empty">No clients found.</div>}
        </div>
      </Card>
    </>
  )
}
