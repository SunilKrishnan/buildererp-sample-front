import { useState } from 'react'
import { useDemoSession } from '../../auth/DemoSession.jsx'
import { can, PERMISSIONS as P } from '../../auth/demoRoles.js'
import { MR } from '../../services/inventory.js'
import { actorOf } from '../../services/procurement.js'
import {
  attendanceOf, attendanceSummary, engineerOf, pmOf, progressPosition, siteOf, supervisorScope, taskView, workerOf, workersOf,
} from '../../services/site.js'
import { todayISO } from '../../utils/date.js'
import { useInventory } from '../store-keeper/InventoryContext.jsx'
import { useSite } from '../site-engineer/SiteContext.jsx'

/**
 * Everything a Site Supervisor page needs: the shared site + inventory records, the sites this
 * person supervises, permissions and an \`act\` helper that runs a guarded transition and reports it.
 */
export function useSupervisor(notify) {
  const { user, role } = useDemoSession()
  const site = useSite()
  const inv = useInventory()
  const scope = supervisorScope(user, role)
  const actor = actorOf(user, role)
  const [error, setError] = useState('')
  const has = (p) => can(role.id, p)
  return {
    user, role, actor, site, inv, scope, error, setError,
    perms: { attendance: has(P.ATTENDANCE_EDIT), supervise: has(P.SITE_SUPERVISE), safety: has(P.SAFETY_REPORT) },
    mySites: scope.siteIds.map(siteOf).filter(Boolean),
    inScope: (r) => !!r && scope.siteIds.includes(r.siteId),
    /** Run a site transition as the signed-in user. Returns true on success (and shows a toast). */
    act: (name, args) => {
      const r = site.actions[name](args, actor)
      if (!r.ok) { setError(r.error); return false }
      setError('')
      notify?.(`Demo: ${r.message}. Shown on the connected dashboards in this session; nothing is saved`)
      return true
    },
  }
}

export const shortName = (name = '') => name.split(': ')[1] || name
export { attendanceOf, engineerOf, pmOf, workerOf, workersOf }

/** Today's picture of the supervised sites, computed from the shared records. */
export function supData(ctx, date = todayISO()) {
  const s = ctx.site.state
  const inS = ctx.inScope
  const tasks = s.tasks.filter(inS).map((t) => ({ ...taskView(s, t, date), position: progressPosition(s, t.id) }))
  const active = tasks.filter((t) => t.start <= date && t.status !== 'Completed')
  const allocations = (s.allocations || []).filter(inS)
  const allocToday = allocations.filter((a) => a.date === date)
  const progress = (s.supervisorProgress || []).filter(inS)
  const progressToday = progress.filter((p) => p.date === date)
  const attendance = (s.attendanceRecords || []).filter(inS)
  const sums = ctx.scope.siteIds.map((id) => ({ siteId: id, ...attendanceSummary(s, id, date) }))
  const total = (k) => sums.reduce((t, x) => t + x[k], 0)
  const issues = s.issues.filter(inS)
  const openIssues = issues.filter((i) => !['Resolved', 'Closed'].includes(i.status))
  const safety = s.safety.filter(inS)
  const safetyOpen = safety.filter((x) => ['Open', 'Action in progress'].includes(x.status))
  const shortages = (s.shortageReports || []).filter(inS)
  const requests = ctx.inv.requests.filter((r) => ctx.scope.siteIds.includes(r.siteId) && r.status !== MR.DRAFT)
  const diary = s.diary.filter(inS)
  const workers = ctx.scope.siteIds.flatMap(workersOf)
  // A task counts as completed today when today's recorded quantity reaches its planned quantity
  const completedToday = tasks.filter((t) => progressToday.some((p) => p.taskId === t.id && p.status !== 'Returned') && t.position.open === 0)
  return {
    date, tasks, active, allocations, allocToday, progress, progressToday, attendance, sums, issues, openIssues, safety, safetyOpen, shortages, requests, diary, workers, completedToday,
    expected: total('expected'), present: total('present'), halfDay: total('halfDay'), absent: total('absent'), onLeave: total('onLeave'), notMarked: total('notMarked'),
    delayed: tasks.filter((t) => t.status === 'Delayed'),
    allocationOf: (taskId, d = date) => allocations.find((a) => a.taskId === taskId && a.date === d),
    taskOfWorker: (workerId, d = date) => allocations.find((a) => a.date === d && a.workerIds.includes(workerId)),
  }
}
