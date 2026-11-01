import { useState } from 'react'
import { Badge, Card, Chips, Kpi, PageHead } from '../components/UI.jsx'
import { labour, formatINR } from '../data/mockData.js'
import { useSite } from '../features/site-engineer/SiteContext.jsx'
import { todayISO } from '../utils/date.js'

export default function Labour({ search }) {
  const site = useSite()
  // Today's status from the Site Supervisor's muster where recorded; otherwise the register's demo value
  const crew = labour.map((w) => {
    const a = (site.state.attendanceRecords || []).find((x) => x.workerId === w.id && x.date === todayISO())
    return a ? { ...w, present: ['Present', 'Half Day'].includes(a.status), hours: a.status === 'Half Day' ? 4 : a.status === 'Present' ? 8 : 0, status: a.status } : { ...w, status: w.present ? 'Present' : 'Absent' }
  })
  const [filter, setFilter] = useState('All')
  const q = search.toLowerCase()
  const list = crew.filter(
    (w) =>
      (filter === 'All' || (filter === 'Present' ? w.present : !w.present)) &&
      (!q || `${w.name} ${w.trade} ${w.site} ${w.contractor}`.toLowerCase().includes(q))
  )


  const present = crew.filter((w) => w.present)
  const wages = present.reduce((s, w) => s + w.wage, 0)

  return (
    <>
      <PageHead title="Labour & Attendance" sub={`Today · ${new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}`} />

      <div className="grid kpis">
        <Kpi label="Total Workforce" value={crew.length} icon="users" />
        <Kpi label="Present" value={present.length} icon="check" foot={`${Math.round((present.length / crew.length) * 100)}% attendance`} />
        <Kpi label="Absent" value={crew.length - present.length} icon="alert" />
        <Kpi label="Wages Today" value={formatINR(wages)} icon="rupee" />
      </div>

      <Card bodyClass="">
        <div className="toolbar">
          <Chips options={['All', 'Present', 'Absent']} value={filter} onChange={setFilter} />
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>Worker</th><th>Trade</th><th>Site</th><th>Contractor</th><th className="num">Daily wage</th><th className="num">Hours</th><th>Attendance</th></tr>
            </thead>
            <tbody>
              {list.map((w) => (
                <tr key={w.id}>
                  <td><div className="cell-main">{w.name}</div><div className="cell-sub">{w.id}</div></td>
                  <td>{w.trade}</td>
                  <td>{w.site}</td>
                  <td>{w.contractor}</td>
                  <td className="num">{formatINR(w.wage)}</td>
                  <td className="num">{w.hours}</td>
                  <td><Badge>{w.status}</Badge></td>
                </tr>
              ))}
            </tbody>
          </table>
          {list.length === 0 && <div className="empty">No workers found.</div>}
        </div>
      </Card>
    </>
  )
}
