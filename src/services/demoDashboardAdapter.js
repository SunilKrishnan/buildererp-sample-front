/**
 * Builds the Admin Dashboard view-model from DEMO fixtures.
 * In the backend phase this aggregation moves server-side; the returned
 * shape is the contract the UI components expect.
 */
import * as D from '../data/demo/adminDashboardDemo.js'
import { addDays, bucketOf, diffDays, makeBuckets, shortDate, todayISO } from '../utils/date.js'

const sum = (arr, f) => arr.reduce((s, x) => s + (typeof f === 'function' ? f(x) : x[f] || 0), 0)
const countBy = (arr, key) => arr.reduce((m, x) => ((m[x[key]] = (m[x[key]] || 0) + 1), m), {})

export function listProjectOptions() {
  return D.projects.map((p) => ({ id: p.id, name: p.name, status: p.status, completedOn: p.completedOn || null }))
}

export function buildAdminDashboard({ projectId = 'all', from: requestedFrom, to }) {
  const T = todayISO()
  // Nothing exists before the earliest project start, so don't chart empty months
  const earliestStart = D.projects
    .filter((p) => projectId === 'all' || p.id === projectId)
    .map((p) => p.startDate)
    .sort()[0]
  const from = earliestStart && requestedFrom < earliestStart && earliestStart <= to ? earliestStart : requestedFrom
  const inProject = (r) => projectId === 'all' || r.projectId === projectId
  const inRange = (iso) => { const d = iso.slice(0, 10); return d >= from && d <= to }
  const scoped = (arr, key = 'date') => arr.filter((r) => inProject(r) && inRange(r[key]))
  const projectName = (id) => D.projects.find((p) => p.id === id)?.name ?? id
  const withProject = (r) => ({ ...r, projectName: projectName(r.projectId) })

  const projects = D.projects.filter((p) => projectId === 'all' || p.id === projectId)
  const buckets = makeBuckets(from, to)
  const series = (records, valueFn, dateKey = 'date') => {
    const out = buckets.map(() => 0)
    records.forEach((r) => { const i = bucketOf(buckets, r[dateKey]); if (i >= 0) out[i] += valueFn(r) })
    return out
  }

  // ----- Projects -----
  const projectRows = projects.map((p) => ({
    ...p,
    budgetAmount: p.budget * 1e7,
    actualAmount: p.spent * 1e7,
    budgetUsedPct: p.budget ? Math.round((p.spent / p.budget) * 100) : 0,
  }))

  // ----- Labour (snapshot as of today) -----
  const roster = D.labourRoster.filter(inProject)
  const registered = sum(roster, 'registered')
  const presentToday = sum(roster, 'presentToday')
  const byCategory = D.LABOUR_CATEGORIES.map((c) => ({
    label: c,
    value: sum(roster.filter((r) => r.category === c), 'registered'),
  })).filter((x) => x.value > 0)

  const expenses = scoped(D.expenses)
  const expenseOf = (cat, pid) => sum(expenses.filter((e) => e.category === cat && (!pid || e.projectId === pid)), 'amount')

  const labourCostByProject = projects
    .map((p) => ({ x: p.short, label: p.name, cost: expenseOf('Labour', p.id) }))
    .filter((r) => r.cost > 0)

  const attendance = scoped(D.attendanceDaily)
  const days = diffDays(from, to) + 1
  let attendanceTrend
  if (days <= 92) {
    attendanceTrend = []
    for (let d = from; d <= to; d = addDays(d, 1)) {
      const rows = attendance.filter((r) => r.date === d)
      if (rows.length) attendanceTrend.push({ x: shortDate(d), present: sum(rows, 'present'), absent: sum(rows, 'absent') })
    }
  } else {
    attendanceTrend = buckets.map((b) => {
      const rows = attendance.filter((r) => r.date >= b.start && r.date <= b.end)
      const nDays = new Set(rows.map((r) => r.date)).size || 1
      return { x: b.label, present: Math.round(sum(rows, 'present') / nDays), absent: Math.round(sum(rows, 'absent') / nDays) }
    })
  }

  const wagesPending = D.wagePayroll.filter((w) => inProject(w) && w.status === 'Pending').map(withProject)
  const advances = D.labourAdvances
    .filter(inProject)
    .map((a) => withProject({ ...a, outstanding: a.amount - a.recovered }))
    .filter((a) => a.outstanding > 0)

  const labour = {
    registered,
    presentToday,
    absentToday: registered - presentToday,
    direct: sum(roster, 'direct'),
    contractor: sum(roster, 'contractor'),
    byCategory,
    requirements: D.labourRequirements.filter(inProject).map(withProject),
    attendancePending: D.attendanceVerification.filter(inProject).map(withProject),
    labourCostByProject,
    labourCostTotal: expenseOf('Labour'),
    wagesPending,
    wagesPendingTotal: sum(wagesPending, 'amount'),
    advances,
    advancesOutstanding: sum(advances, 'outstanding'),
    attendanceTrend,
  }

  // ----- Purchase -----
  const allPOs = D.purchaseOrders.filter(inProject).map(withProject)
  const purchase = {
    materialRequests: D.materialRequests.filter((r) => inProject(r) && r.status === 'Pending').map(withProject),
    purchaseOrders: allPOs.filter((po) => inRange(po.date)),
    poStatusCounts: countBy(allPOs.filter((po) => inRange(po.date)), 'status'),
    deliveriesAwaiting: allPOs.filter((po) => po.status === 'Issued' || po.status === 'Partially Received'),
    invoicesAwaiting: D.supplierInvoices.filter((i) => inProject(i) && i.status !== 'Verified').map(withProject),
    purchaseExpense: expenseOf('Material'),
  }

  // ----- Inventory (stock is a snapshot, movements follow the date range) -----
  const stockRows = D.stock.filter(inProject).map(withProject)
  const moves = scoped(D.materialTransactions).map(withProject)
  const inventory = {
    items: stockRows,
    stockValue: sum(stockRows, (s) => s.qty * s.rate),
    lowStock: stockRows.filter((s) => s.qty > 0 && s.qty < s.reorder),
    outOfStock: stockRows.filter((s) => s.qty === 0),
    damaged: stockRows.filter((s) => s.damaged > 0),
    receipts: moves.filter((m) => m.type === 'Receipt'),
    issues: moves.filter((m) => m.type === 'Issue'),
  }

  // ----- Finance -----
  const paymentRows = scoped(D.payments).map(withProject)
  const pendingPayments = paymentRows.filter((p) => p.status === 'Pending')
  const completedPayments = paymentRows.filter((p) => p.status === 'Completed')
  const trendSeries = Object.fromEntries(
    ['Material', 'Labour', 'Contractor'].map((c) => [c, series(expenses.filter((e) => e.category === c), (e) => e.amount)])
  )
  const finance = {
    totalExpense: sum(expenses, 'amount'),
    byCategory: D.EXPENSE_CATEGORIES.map((c) => ({ label: c, value: expenseOf(c) })),
    labourExpense: expenseOf('Labour'),
    materialExpense: expenseOf('Material'),
    contractorPayments: sum(paymentRows.filter((p) => p.type === 'Contractor'), 'amount'),
    payments: paymentRows,
    pendingTotal: sum(pendingPayments, 'amount'),
    pendingCount: pendingPayments.length,
    completedTotal: sum(completedPayments, 'amount'),
    completedCount: completedPayments.length,
    budgetVsActual: projectRows.map((p) => ({ x: p.short, label: p.name, budget: p.budget, actual: p.spent })),
    expenseTrend: buckets.map((b, i) => ({
      x: b.label,
      Material: trendSeries.Material[i],
      Labour: trendSeries.Labour[i],
      Contractor: trendSeries.Contractor[i],
    })),
  }

  // ----- Sales -----
  const unitRows = D.units.filter(inProject).map(withProject)
  const allLeads = D.leads.filter(inProject).map(withProject)
  const leadsInRange = allLeads.filter((l) => inRange(l.date))
  const openLead = (l) => !['Booked', 'Lost'].includes(l.stage)
  const bookingRows = scoped(D.bookings).map(withProject)
  const allCollections = D.collections.filter(inProject).map(withProject)
  const received = allCollections.filter((c) => c.status === 'Received' && inRange(c.date))
  const outstanding = allCollections.filter((c) => c.status !== 'Received')
  const sales = {
    leads: leadsInRange,
    leadStages: countBy(leadsInRange, 'stage'),
    followUps: allLeads
      .filter((l) => openLead(l) && l.nextFollowUp && l.nextFollowUp <= addDays(T, 7))
      .sort((a, b) => a.nextFollowUp.localeCompare(b.nextFollowUp)),
    siteVisits: allLeads.filter((l) => l.siteVisit && l.siteVisit >= T).sort((a, b) => a.siteVisit.localeCompare(b.siteVisit)),
    bookings: bookingRows,
    bookingValue: sum(bookingRows, 'value'),
    units: unitRows,
    unitsTotal: {
      total: sum(unitRows, 'total'),
      available: sum(unitRows, 'available'),
      booked: sum(unitRows, 'booked'),
      sold: sum(unitRows, 'sold'),
    },
    collectedTotal: sum(received, 'amount'),
    outstanding: outstanding.sort((a, b) => a.date.localeCompare(b.date)),
    outstandingTotal: sum(outstanding, 'amount'),
    overdueTotal: sum(outstanding.filter((c) => c.status === 'Overdue'), 'amount'),
    trend: (() => {
      const b = series(bookingRows, (r) => r.value)
      const c = series(received, (r) => r.amount)
      return buckets.map((bk, i) => ({ x: bk.label, bookings: b[i], collections: c[i] }))
    })(),
  }

  // ----- Quality & Safety -----
  const quality = {
    inspections: D.inspections.filter(inProject).map(withProject),
    defects: D.defects.filter(inProject).map(withProject),
    correctiveActions: D.correctiveActions.filter((a) => inProject(a) && a.status !== 'Done').map(withProject),
    incidents: scoped(D.safetyIncidents).map(withProject),
    safetyTasks: D.safetyTasks.filter(inProject).map(withProject),
  }

  // ----- Purchase vs inventory movement chart -----
  const purchaseInventoryTrend = (() => {
    const po = series(purchase.purchaseOrders, (r) => r.amount)
    const rc = series(inventory.receipts, (r) => r.value)
    const is = series(inventory.issues, (r) => r.value)
    return buckets.map((b, i) => ({ x: b.label, ordered: po[i], received: rc[i], issued: is[i] }))
  })()

  const approvals = D.approvals.filter(inProject).map(withProject)
  const activeCount = projects.filter((p) => p.status !== 'Completed').length

  return {
    meta: { source: 'demo', notice: D.DEMO_NOTICE, filters: { projectId, from, to }, generatedAt: new Date().toISOString() },
    summary: {
      totalProjects: projects.length,
      activeProjects: activeCount,
      completedProjects: projects.filter((p) => p.status === 'Completed').length,
      delayedProjects: projects.filter((p) => p.status === 'Delayed' || p.status === 'At Risk').length,
      totalLabour: registered,
      presentToday,
      totalExpense: finance.totalExpense,
      units: sales.unitsTotal,
      outstandingCollections: sales.outstandingTotal,
    },
    projects: projectRows,
    labour,
    purchase,
    inventory,
    finance,
    sales,
    approvals,
    quality,
    activity: scoped(D.activity).map(withProject),
    charts: { purchaseInventoryTrend },
    approvalTypes: D.APPROVAL_TYPES,
  }
}
