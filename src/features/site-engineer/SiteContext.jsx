import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react'
import * as Site from '../../services/site.js'
import * as Q from '../../services/qa.js'
import * as SF from '../../services/safety.js'

const S = { ...Site, ...Q, ...SF } // site, QA and safety transitions share one state

/**
 * Site records for this browser session (DEMO: never saved, reset on reload). Lives at app level
 * next to the inventory state so the Site Engineer, Site Supervisor, Project Manager, QA, Store
 * Keeper and Purchase Manager screens see the same issues, inspections and NCRs. Material requests themselves live in the inventory state.
 */
const SiteContext = createContext(null)

const TRANSITIONS = [
  'saveDpr', 'reviewDpr', 'updateTaskNotes', 'addTaskObservation', 'addMeasurement', 'verifyMeasurement', 'requestBoqRevision', 'decideBoqRevision',
  'recordInspection', 'completeInspection', 'qaReview', 'updateNcrAction', 
  'createIssue', 'commentIssue', 'reviewDiary',
  // Site Supervisor (and the Site Engineer's review of supervisor records)
  // QA (services/qa.js)
  ...Q.QA_TRANSITIONS,
  // Safety (services/safety.js)
  ...SF.SAFETY_TRANSITIONS,
  'saveAttendance', 'allocateWork', 'submitProgress', 'reviewProgress', 'reportShortage', 'handleShortage', 'requestEquipment', 'logEquipment', 'requestLabour', 'saveDiary', 'sendClarification', 'replyMessage', 'setPrefs', 'addWeatherRestriction', 'liftWeatherRestriction', 'sendInstruction', 'reviewTaskDelay',
]

export function SiteProvider({ children }) {
  const [state, setState] = useState(S.initialSiteState)
  const ref = useRef(state)

  /** Run a guarded transition against the latest state. Returns { ok, message } or { ok: false, error }. */
  const run = useCallback((fn, args, actor) => {
    const r = fn(ref.current, args, actor)
    if (r.error) return { ok: false, error: r.error }
    ref.current = r.state
    setState(r.state)
    return { ok: true, message: r.message }
  }, [])

  const actions = useMemo(() => ({
    ...Object.fromEntries(TRANSITIONS.map((name) => [name, (args, actor) => run(S[name], args, actor)])),
    /** Back to the demo records (Settings → Reset demo data) */
    reset: () => { const fresh = S.initialSiteState(); ref.current = fresh; setState(fresh) },
  }), [run])
  const value = useMemo(() => ({ state, actions }), [state, actions])
  return <SiteContext.Provider value={value}>{children}</SiteContext.Provider>
}

export function useSite() {
  const ctx = useContext(SiteContext)
  if (!ctx) throw new Error('useSite must be used inside <SiteProvider>')
  return ctx
}
