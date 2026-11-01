// Figures for the Safety pages and summaries, computed from the shared records (no stored totals).
import * as SF from '../../services/safety.js'
import { todayISO } from '../../utils/date.js'

export function safetyFigures(s, { projectIds = null, siteIds = null } = {}, today = todayISO()) {
  const inP = (r) => (!projectIds || projectIds.includes(r.projectId)) && (!siteIds || !r.siteId || siteIds.includes(r.siteId))
  const records = s.safety.filter(inP)
  const hazards = records.filter((x) => !SF.isIncident(x))
  const incidents = records.filter(SF.isIncident)
  const openHazards = hazards.filter((x) => x.status !== 'Verified closed')
  const highRisk = openHazards.filter((x) => SF.HIGH.includes(x.severity))
  const actions = (s.safetyActions || []).filter(inP)
  const overdue = actions.filter((a) => SF.caOverdue(a, today))
  const awaitingVerification = actions.filter((a) => a.status === 'Awaiting Verification')
  const inspections = (s.safetyInspections || []).filter(inP)
  const inspectionsDue = inspections.filter((q) => ['Scheduled', 'In Progress'].includes(q.status) && q.date <= today)
  const month = today.slice(0, 7)
  const monthIncidents = incidents.filter((x) => x.date.startsWith(month))
  const checks = (s.ppeChecks || []).filter(inP).sort((a, b) => b.date.localeCompare(a.date))
  const latestCheck = checks[0]
  const ppeCompliance = latestCheck ? Math.round((latestCheck.compliant / latestCheck.observed) * 100) : null
  const siteIdsForTraining = [...new Set((siteIds || ['S-01', 'S-02']).filter(Boolean))]
  const training = siteIdsForTraining.flatMap((id) => SF.trainingStatus(s, id, today))
  const trainingDue = training.filter((t) => t.status !== 'Valid')
  const permits = (s.permits || []).filter(inP)
  return {
    records, hazards, incidents, openHazards, highRisk, actions, overdue, awaitingVerification, inspections, inspectionsDue, monthIncidents,
    nearMisses: monthIncidents.filter((x) => x.kind === 'Near miss'), checks, latestCheck, ppeCompliance, training, trainingDue, permits,
    awaitingReview: records.filter((x) => !x.reviewedBy && x.status !== 'Verified closed'),
  }
}
