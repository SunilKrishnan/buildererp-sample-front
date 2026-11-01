import { createContext, useCallback, useContext, useMemo, useState } from 'react'
import { DEMO_USERS, ROLES } from './demoRoles.js'

/**
 * Demo session: which illustrative user/role the prototype is previewed as.
 * This is NOT a login. There is no authentication, and switching role is a
 * design-review convenience. Replace with the real auth session in the backend phase.
 */
const DemoSessionContext = createContext(null)

const STORAGE_KEY = 'demoRole'

const getInitialRole = () => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved && ROLES[saved]) return saved
  } catch {}
  return 'admin'
}

export function DemoSessionProvider({ children }) {
  const [roleId, setRoleId] = useState(getInitialRole)

  const setRole = useCallback((id) => {
    if (!ROLES[id]) return
    setRoleId(id)
    try { localStorage.setItem(STORAGE_KEY, id) } catch {}
  }, [])

  const value = useMemo(() => ({ user: DEMO_USERS[roleId], role: ROLES[roleId], setRole }), [roleId, setRole])
  return <DemoSessionContext.Provider value={value}>{children}</DemoSessionContext.Provider>
}

export function useDemoSession() {
  const ctx = useContext(DemoSessionContext)
  if (!ctx) throw new Error('useDemoSession must be used inside <DemoSessionProvider>')
  return ctx
}
