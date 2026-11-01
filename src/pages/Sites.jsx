import Icon from '../components/Icon.jsx'
import { Badge, Kpi, PageHead } from '../components/UI.jsx'
import { sites } from '../data/mockData.js'

export default function Sites({ search }) {
  const q = search.toLowerCase()
  const list = sites.filter((s) => !q || `${s.name} ${s.project} ${s.engineer} ${s.stage}`.toLowerCase().includes(q))
  const workers = sites.reduce((s, x) => s + x.workers, 0)
  const incidents = sites.filter((s) => s.safety === 'Incident').length

  return (
    <>
      <PageHead title="Sites" sub="Live status from every active construction site" />

      <div className="grid kpis">
        <Kpi label="Active Sites" value={sites.length} icon="pin" />
        <Kpi label="Workers Today" value={workers} icon="hardhat" delta={4.6} foot="vs yesterday" />
        <Kpi label="Safety Incidents" value={incidents} icon="alert" foot="this week" />
        <Kpi label="Reports Submitted" value={`${sites.length}/${sites.length}`} icon="check" foot="daily progress reports" />
      </div>

      <div className="grid cards-3">
        {list.map((s) => (
          <div key={s.id} className="card proj">
            <div className="proj-top">
              <div>
                <h3>{s.name}</h3>
                <div className="loc"><Icon name="building" />{s.project}</div>
              </div>
              <Badge>{s.safety}</Badge>
            </div>
            <div className="proj-meta">
              <div><div className="k">Workers</div><div className="v">{s.workers}</div></div>
              <div><div className="k">Weather</div><div className="v">{s.weather}</div></div>
              <div><div className="k">Site ID</div><div className="v">{s.id}</div></div>
            </div>
            <div>
              <div className="cell-sub">Current stage</div>
              <div className="cell-main" style={{ marginTop: 2 }}>{s.stage}</div>
            </div>
            <div className="prog-row" style={{ margin: 0 }}>
              <span>👷 {s.engineer}</span>
              <span>Updated {s.lastReport}</span>
            </div>
          </div>
        ))}
      </div>
    </>
  )
}
