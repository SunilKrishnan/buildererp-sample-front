import { Card, PageHead } from '../components/UI.jsx'

const toggles = [
  { label: 'Low stock alerts', sub: 'Notify when materials drop below reorder level', on: true },
  { label: 'PO approval requests', sub: 'Email me when a purchase order needs approval', on: true },
  { label: 'Daily site reports', sub: 'Summary of all site progress at 7 PM', on: false },
  { label: 'Safety incidents', sub: 'Instant alert for any reported incident', on: true },
]

export default function Settings({ notify }) {
  const save = (e) => {
    e.preventDefault()
    notify('Demo: settings are not saved yet (no backend connected)')
  }

  return (
    <>
      <PageHead title="Settings" sub="Company profile and notification preferences" />

      <div className="grid halves">
        <Card title="Company Profile">
          <form className="form" onSubmit={save}>
            <label>Company name<input defaultValue="ABC Builders" /></label>
            <div className="form-row">
              <label>GSTIN<input placeholder="15-digit GSTIN" /></label>
              <label>Phone<input defaultValue="+91 20 4000 5000" /></label>
            </div>
            <label>Email<input type="email" defaultValue="admin@example.com" /></label>
            <label>Address<input defaultValue="Baner Road, Pune, Maharashtra" /></label>
            <div className="form-row">
              <label>Currency
                <select defaultValue="INR"><option value="INR">INR (₹)</option><option value="USD">USD ($)</option></select>
              </label>
              <label>Financial year start
                <select defaultValue="April"><option>April</option><option>January</option></select>
              </label>
            </div>
            <div><button className="btn btn-primary" type="submit">Save changes</button></div>
          </form>
        </Card>

        <Card title="Notifications">
          {toggles.map((t) => (
            <div key={t.label} className="switch-row">
              <div>
                <div className="cell-main">{t.label}</div>
                <div className="s">{t.sub}</div>
              </div>
              <label className="switch">
                <input type="checkbox" defaultChecked={t.on} />
                <span />
              </label>
            </div>
          ))}
        </Card>
      </div>
    </>
  )
}
