import { useEffect, useState } from 'react'
import { useDemoSession } from '../../auth/DemoSession.jsx'
import { can, PERMISSIONS as P } from '../../auth/demoRoles.js'
import Icon from '../../components/Icon.jsx'
import { actorOf } from '../../services/procurement.js'
import { inScope, projectOf, scopeFor, siteOf } from '../../services/site.js'
import { useInventory } from '../store-keeper/InventoryContext.jsx'
import { useSite } from './SiteContext.jsx'

/**
 * Everything a Site Engineer page needs: shared site + inventory state, the signed-in user's
 * scope (assigned projects / sites only), permissions and an `act` helper that runs a guarded
 * transition and reports the result.
 */
export function useSiteEngineer(notify) {
  const { user, role } = useDemoSession()
  const site = useSite()
  const inv = useInventory()
  const scope = scopeFor(site.state, user, role)
  const has = (p) => can(role.id, p)
  const actor = actorOf(user, role)
  const [error, setError] = useState('')
  const report = (r) => {
    if (!r.ok) { setError(r.error); return false }
    setError('')
    notify?.(`Demo: ${r.message}. Temporary, resets on reload`)
    return true
  }
  return {
    user, role, actor, site, inv, scope, error, setError,
    perms: {
      work: has(P.SITE_WORK), request: has(P.MATERIAL_REQUEST_CREATE), inspect: has(P.QUALITY_INSPECT), qaReview: has(P.QUALITY_REVIEW),
      safety: has(P.SAFETY_REPORT), safetyVerify: has(P.SAFETY_VERIFY),
    },
    myProjects: scope.projectIds.map(projectOf).filter(Boolean),
    mySites: scope.siteIds.map(siteOf).filter(Boolean),
    inScope: (r) => inScope(scope, r),
    act: (name, args) => report(site.actions[name](args, actor)),
    actInv: (name, args, who = actor) => report(inv.actions[name](args, who)),
  }
}

/** Photo picker: images stay in this browser tab only (object URLs), nothing is uploaded. */
export function PhotoInput({ value = [], onChange, label = 'Site photographs' }) {
  useEffect(() => () => value.forEach((p) => p.local && URL.revokeObjectURL(p.url)), []) // eslint-disable-line react-hooks/exhaustive-deps
  const add = (e) => {
    const files = [...e.target.files].filter((f) => f.type.startsWith('image/')).slice(0, 6 - value.length)
    onChange([...value, ...files.map((f) => ({ name: f.name, url: URL.createObjectURL(f), local: true }))])
    e.target.value = ''
  }
  return (
    <div className="field span-2">
      {label}
      <div className="se-photos">
        {value.map((p, i) => (
          <figure key={p.url} className="se-photo">
            <img src={p.url} alt={p.name} />
            <button type="button" className="icon-btn" aria-label={`Remove ${p.name}`} onClick={() => onChange(value.filter((_, j) => j !== i))}><Icon name="x" size={12} /></button>
          </figure>
        ))}
        {value.length < 6 && (
          <label className="se-photo-add">
            <Icon name="plus" /><span>Add photo</span>
            <input type="file" accept="image/*" multiple onChange={add} className="sr-only" />
          </label>
        )}
      </div>
      <span className="cell-sub">Kept in this browser tab only for the demo; not uploaded or saved.</span>
    </div>
  )
}

export function PhotoStrip({ photos }) {
  if (!photos?.length) return null
  return <div className="se-photos">{photos.map((p) => <figure key={p.url} className="se-photo"><img src={p.url} alt={p.name} /></figure>)}</div>
}

/** Site picker limited to the engineer's assigned sites. */
export function SiteSelect({ value, onChange, sites, label = 'Site' }) {
  return (
    <label className="field">{label}
      <select value={value} onChange={(e) => onChange(e.target.value)}>
        {sites.length !== 1 && <option value="">Select…</option>}
        {sites.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
      </select>
    </label>
  )
}

export const projectIdOfSite = (siteId) => siteOf(siteId)?.project === 'Palm Grove Villas' ? 'P-102' : 'P-101'
