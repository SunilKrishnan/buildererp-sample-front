// Sidebar structure. Each role sees only its own dashboard and the items whose
// `audience` includes it (omit = every role). Other role dashboards a role may open
// (ROLES[role].dashboards) are reached through page shortcuts, not the sidebar.
// Hiding a link is a convenience, not security: every page is still reachable by URL.

export const ROLE_DASHBOARDS = [
  { id: 'admin', to: '/dashboard', label: 'Admin Dashboard', icon: 'grid' },
  { id: 'accountant', to: '/dashboards/accountant', label: 'Accountant Dashboard', icon: 'rupee' },
  { id: 'storekeeper', to: '/dashboards/store-keeper', label: 'Store Keeper Dashboard', icon: 'clipboard' },
  { id: 'purchasemanager', to: '/dashboards/purchase-manager', label: 'Purchase Manager Dashboard', icon: 'cart' },
  { id: 'siteengineer', to: '/dashboards/site-engineer', label: 'Site Engineer Dashboard', icon: 'hardhat' },
  { id: 'sitesupervisor', to: '/dashboards/site-supervisor', label: 'Site Supervisor Dashboard', icon: 'users' },
  { id: 'projectmanager', to: '/dashboards/project-manager', label: 'Project Manager Reviews', icon: 'check' },
  { id: 'qa', to: '/dashboards/qa', label: 'QA Dashboard', icon: 'check' },
  { id: 'safetyofficer', to: '/dashboards/safety-officer', label: 'Safety Officer Dashboard', icon: 'alert' },
]

// Accounts workspace: one page per accountant section (see AccountantDashboard).
// Grouped under sidebar headings. Salaries, labour wages and contractor bills are
// deliberately separate pages: they are different kinds of payment.
export const ACCOUNTS_SECTIONS = [
  { id: 'receipts', label: 'Income & Receipts', icon: 'trend', group: 'Receivables & Payables' },
  { id: 'expenses', label: 'Expenses & Bills', icon: 'file', group: 'Receivables & Payables' },
  { id: 'suppliers', label: 'Supplier Payments', icon: 'cart', group: 'Receivables & Payables' },
  { id: 'contractors', label: 'Contractor Bills', icon: 'clipboard', group: 'Receivables & Payables' },
  { id: 'salaries', label: 'Employee Payroll', icon: 'briefcase', group: 'Payroll' },
  { id: 'payroll', label: 'Labour Payroll', icon: 'hardhat', group: 'Payroll' },
  { id: 'bank', label: 'Bank & Cash', icon: 'bank', group: 'Banking & Books' },
  { id: 'reconciliation', label: 'Bank Reconciliation', icon: 'link', group: 'Banking & Books' },
  { id: 'journals', label: 'Journal Entries', icon: 'book', group: 'Banking & Books' },
  { id: 'tax', label: 'Tax & Compliance', icon: 'percent', group: 'Banking & Books' },
  { id: 'approvals', label: 'Financial Approvals', icon: 'check', group: 'Control' },
  { id: 'reports', label: 'Financial Reports', icon: 'chart', group: 'Control' },
]
// Site Engineer workspace: 10 sections, one page each, grouped in the sidebar. Sections with more
// than one part show them as tabs (?tab=); the first tab is the default.
export const SITE_SECTIONS = [
  { id: 'overview', label: 'Overview', sub: 'Today on your sites: work plan, deadlines, materials, inspections, issues and notifications' },
  { id: 'projects', label: 'My Projects & Sites', icon: 'building', group: 'Site Work', sub: 'Projects, towers, work areas and tasks assigned to you' },
  { id: 'schedule', label: 'Tasks & Work Schedule', icon: 'calendar', group: 'Site Work', sub: 'Assigned work, progress, observations, blockers and clarifications',
    tabs: [{ id: 'tasks', label: 'Tasks & schedule' }, { id: 'communication', label: 'Instructions & clarifications' }] },
  { id: 'progress', label: 'Daily Work Progress', icon: 'trend', group: 'Site Work', sub: 'Daily progress reports for Project Manager review, measurements, labour and equipment',
    tabs: [{ id: 'reports', label: 'Daily progress' }, { id: 'measurements', label: 'Measurements & BOQ' }, { id: 'labour', label: 'Labour' }, { id: 'equipment', label: 'Equipment' }] },
  { id: 'materials', label: 'Material Requests', icon: 'box', group: 'Materials', sub: 'Request → Project Manager review → Store Keeper stock check → issue, or purchase for a shortage' },
  { id: 'quality', label: 'Quality Inspections', icon: 'check', group: 'Quality & Issues', sub: 'Technical inspections, checklists, defects, corrective actions and safety observations',
    tabs: [{ id: 'inspections', label: 'Inspections & defects' }, { id: 'safety', label: 'Safety observations' }] },
  { id: 'issues', label: 'Site Issues & Delays', icon: 'clipboard', group: 'Quality & Issues', sub: 'Report, assign and follow site problems and delays to resolution' },
  { id: 'drawings', label: 'Drawings & Documents', icon: 'file', group: 'Documents & Reports', sub: 'Approved, draft and superseded revisions of drawings and documents' },
  { id: 'diary', label: 'Site Diary & Reports', icon: 'book', group: 'Documents & Reports', sub: 'Daily site diary and reports from your site records',
    tabs: [{ id: 'diary', label: 'Site diary' }, { id: 'reports', label: 'Reports' }] },
  { id: 'settings', label: 'Settings', icon: 'gear', group: 'Account', sub: 'Your profile, assignments, permissions, notifications and demo data' },
]
// Earlier section ids (bookmarks, links inside pages) → their section and tab today
export const SITE_SECTION_ALIASES = {
  measurements: ['progress', 'measurements'], labour: ['progress', 'labour'], equipment: ['progress', 'equipment'],
  safety: ['quality', 'safety'], communication: ['schedule', 'communication'], reports: ['diary', 'reports'], profile: ['settings'],
}
// Site Supervisor workspace: 10 sections at /supervisor/:section (overview at /dashboards/site-supervisor)
export const SUPERVISOR_SECTIONS = [
  { id: 'overview', label: 'Overview', sub: "Today's crew, work, progress, issues and safety on your site" },
  { id: 'attendance', label: 'Labour Attendance', icon: 'check', group: 'Crew', sub: 'Daily muster: present, absent, half day or on leave, with check-in / check-out' },
  { id: 'allocation', label: 'Daily Work Allocation', icon: 'calendar', group: 'Crew', sub: 'Allocate present workers to activities approved by the Site Engineer / Project Manager' },
  { id: 'labour', label: 'Labour & Teams', icon: 'users', group: 'Crew', sub: 'Workers on your site: trade, team, attendance and today\'s task' },
  { id: 'progress', label: 'Work Progress', icon: 'trend', group: 'Execution', sub: "Today's completed quantities, sent to the Site Engineer for verification" },
  { id: 'materials', label: 'Materials & Shortages', icon: 'box', group: 'Execution', sub: 'Site stock and requests (view only); report shortages to the Site Engineer' },
  { id: 'issues', label: 'Site Issues & Delays', icon: 'clipboard', group: 'Site Reporting', sub: 'Report labour, material, equipment, weather, access and scheduling problems' },
  { id: 'safety', label: 'Safety Observations', icon: 'alert', group: 'Site Reporting', sub: 'Unsafe acts, near misses and incidents, with the immediate action taken' },
  { id: 'diary', label: 'Site Diary', icon: 'book', group: 'Site Reporting', sub: 'Your daily diary, submitted to the Site Engineer for review' },
  { id: 'reports', label: 'Reports & History', icon: 'chart', group: 'Site Reporting', sub: 'Attendance, allocation, progress, delays, issues, safety and diary history' },
]
// QA workspace: 14 sections at /qa/:section (overview at /dashboards/qa)
export const QA_SECTIONS = [
  { id: 'overview', label: 'Overview', sub: 'Inspections, defects, corrective actions and material tests across your projects' },
  { id: 'schedule', label: 'Inspection Schedule', icon: 'calendar', group: 'Inspections', sub: 'Upcoming and completed inspections: assign, schedule, reschedule and record results' },
  { id: 'requests', label: 'Inspection Requests', icon: 'bell', group: 'Inspections', sub: 'Work reported ready by the Site Supervisor and requested by the Site Engineer' },
  { id: 'checklists', label: 'Quality Checklists', icon: 'clipboard', group: 'Inspections', sub: 'Checklists by activity; acceptance criteria come from approved drawings and specifications' },
  { id: 'records', label: 'Inspection Records', icon: 'file', group: 'Inspections', sub: 'Every inspection with its checklist, observations, result and history' },
  { id: 'materials', label: 'Material Quality & Tests', icon: 'box', group: 'Materials & Defects', sub: 'Certificates and test results against the Store Keeper\'s GRNs and the POs' },
  { id: 'ncr', label: 'Defects & NCRs', icon: 'alert', group: 'Materials & Defects', sub: 'Non-conformance reports: assignment, root cause, correction, verification and closure' },
  { id: 'actions', label: 'Corrective Actions', icon: 'check', group: 'Materials & Defects', sub: 'Actions from inspections and NCRs; QA verifies before closure' },
  { id: 'reinspection', label: 'Reinspection', icon: 'trend', group: 'Materials & Defects', sub: 'Reinspections of corrected work; the original result is always kept' },
  { id: 'drawings', label: 'Drawings & Specifications', icon: 'book', group: 'Documents', sub: 'The shared document register: latest approved revision and history' },
  { id: 'documents', label: 'Quality Documents', icon: 'file', group: 'Documents', sub: 'Inspection reports, certificates, lab reports, NCR reports and evidence' },
  { id: 'reports', label: 'Reports & Analytics', icon: 'chart', group: 'Insights', sub: 'Completion, pass / fail, NCRs, overdue actions and material tests from the recorded data' },
  { id: 'activity', label: 'Notifications & Activity', icon: 'bell', group: 'Insights', sub: 'What needs your attention and who did what, when' },
  { id: 'settings', label: 'Profile & Settings', icon: 'gear', group: 'Account', sub: 'Your profile, permissions, notification preferences and demo data' },
]
// Safety Officer workspace: 12 sections at /safety/:section (overview at /dashboards/safety-officer)
export const SAFETY_SECTIONS = [
  { id: 'overview', label: 'Safety Overview', sub: 'Hazards, inspections, actions, incidents, PPE and training across your projects' },
  { id: 'inspections', label: 'Safety Inspections', icon: 'check', group: 'Site Safety', sub: 'Scheduled safety inspections with checklists, findings and results' },
  { id: 'hazards', label: 'Hazard Reports', icon: 'alert', group: 'Site Safety', sub: 'Unsafe conditions and acts: review, immediate control and correction' },
  { id: 'incidents', label: 'Incident Management', icon: 'clipboard', group: 'Site Safety', sub: 'Accidents, injuries, property damage and near misses: report, investigate, close' },
  { id: 'actions', label: 'Corrective Actions', icon: 'trend', group: 'Site Safety', sub: 'Corrections from hazards, inspections and incidents, closed only after verification' },
  { id: 'ppe', label: 'PPE Management', icon: 'hardhat', group: 'People & Permits', sub: 'PPE issued to workers and field compliance checks' },
  { id: 'training', label: 'Safety Training', icon: 'users', group: 'People & Permits', sub: 'Inductions, toolbox talks and task training, with renewals due' },
  { id: 'permits', label: 'Permit to Work', icon: 'file', group: 'People & Permits', sub: 'Hot work, height, confined space, excavation and electrical isolation permits' },
  { id: 'emergency', label: 'Emergency Preparedness', icon: 'bell', group: 'People & Permits', sub: 'Contacts, assembly points, first aid, fire equipment and drills' },
  { id: 'documents', label: 'Safety Documents', icon: 'book', group: 'Records', sub: 'Risk assessments, method statements and safety record reports' },
  { id: 'reports', label: 'Reports & Analytics', icon: 'chart', group: 'Records', sub: 'Summaries from the safety records' },
  { id: 'activity', label: 'Activity History', icon: 'clipboard', group: 'Records', sub: 'Who did what and when on every safety record' },
]
export const safetyPath = (section) => (section && section !== 'overview' ? `/safety/${section}` : '/dashboards/safety-officer')

export const qaPath = (section) => (section && section !== 'overview' ? `/qa/${section}` : '/dashboards/qa')

export const supervisorPath = (section) => (section && section !== 'overview' ? `/supervisor/${section}` : '/dashboards/site-supervisor')

export const sitePath = (section) => (section && section !== 'overview' ? `/site/${section}` : '/dashboards/site-engineer')
/** Link to a section (or an old section id) with optional extra query, e.g. siteLink('safety', 'new=1') */
export function siteLink(id, query = '') {
  const [section, tab] = SITE_SECTION_ALIASES[id] || [id]
  const q = [tab && `tab=${tab}`, query].filter(Boolean).join('&')
  return `${sitePath(section)}${q ? `?${q}` : ''}`
}

export const accountsPath = (section) => (section && section !== 'overview' ? `/accounts/${section}` : '/dashboards/accountant')

const ADMIN = ['admin']
const ACCOUNTANT = ['accountant']
const STOREKEEPER = ['storekeeper']
const PURCHASE = ['purchasemanager']
const SITE = ['siteengineer']
const PROJECT = ['projectmanager']
const SUPERVISOR = ['sitesupervisor']
const QA = ['qa']
const SAFETY = ['safetyofficer']
const OFFICE = ['admin', 'accountant'] // pages the Store Keeper and Purchase Manager do not use

export const moduleNavGroups = [
  {
    label: 'Overview',
    items: [
      { ownDashboard: true }, // replaced by the signed-in role's own dashboard
      // Site Engineers see their assigned projects under My Projects & Sites instead
      { to: '/projects', label: 'Projects', icon: 'building', audience: [...OFFICE, ...STOREKEEPER, ...PURCHASE, ...PROJECT] },
      { to: '/sites', label: 'Sites', icon: 'pin', audience: ADMIN },
      { to: '/approvals/bills', label: 'Bill Approvals', icon: 'check', audience: ADMIN },
    ],
  },
  ...[...new Set(ACCOUNTS_SECTIONS.map((s) => s.group))].map((group) => ({
    label: group,
    items: ACCOUNTS_SECTIONS.filter((s) => s.group === group)
      .map((s) => ({ to: accountsPath(s.id), label: s.label, icon: s.icon, audience: ACCOUNTANT })),
  })),
  ...[...new Set(SITE_SECTIONS.filter((s) => s.group).map((s) => s.group))].map((group) => ({
    label: group,
    items: SITE_SECTIONS.filter((s) => s.group === group).map((s) => ({ to: sitePath(s.id), label: s.label, icon: s.icon, audience: SITE })),
  })),
  ...[...new Set(SUPERVISOR_SECTIONS.filter((s) => s.group).map((s) => s.group))].map((group) => ({
    label: group,
    items: SUPERVISOR_SECTIONS.filter((s) => s.group === group).map((s) => ({ to: supervisorPath(s.id), label: s.label, icon: s.icon, audience: SUPERVISOR })),
  })),
  ...[...new Set(SAFETY_SECTIONS.filter((s) => s.group).map((s) => s.group))].map((group) => ({
    label: group,
    items: SAFETY_SECTIONS.filter((s) => s.group === group).map((s) => ({ to: safetyPath(s.id), label: s.label, icon: s.icon, audience: SAFETY })),
  })),
  ...[...new Set(QA_SECTIONS.filter((s) => s.group).map((s) => s.group))].map((group) => ({
    label: group,
    items: QA_SECTIONS.filter((s) => s.group === group).map((s) => ({ to: qaPath(s.id), label: s.label, icon: s.icon, audience: QA })),
  })),
  {
    label: 'Operations',
    items: [
      // Admin reaches the Store Keeper Dashboard here; a Store Keeper sees it as their own dashboard
      { to: '/dashboards/store-keeper', label: 'Store Keeper', icon: 'clipboard', audience: ADMIN },
      { to: '/dashboards/purchase-manager', label: 'Purchase Manager', icon: 'cart', audience: ADMIN },
      { to: '/dashboards/site-engineer', label: 'Site Engineer', icon: 'hardhat', audience: ADMIN },
      { to: '/dashboards/site-supervisor', label: 'Site Supervisor', icon: 'users', audience: ADMIN },
      { to: '/dashboards/project-manager', label: 'Project Manager reviews', icon: 'check', audience: ADMIN },
      { to: '/dashboards/qa', label: 'QA Dashboard', icon: 'check', audience: ADMIN },
      { to: '/dashboards/safety-officer', label: 'Safety Officer', icon: 'alert', audience: ADMIN },
      // Verified quality documents (certificates, reports) for project / supplier records; view only
      { to: '/qa/documents', label: 'Quality Documents', icon: 'file', audience: ACCOUNTANT },
      { to: '/materials', label: 'Materials', icon: 'box', audience: [...ADMIN, ...STOREKEEPER, ...PURCHASE, ...PROJECT] },
      // Supplier records: managed by the Purchase Manager, view only for Accounts
      { to: '/suppliers', label: 'Suppliers', icon: 'handshake', audience: [...OFFICE, ...PURCHASE] },
      { to: '/purchase-orders', label: 'Purchase Orders', icon: 'cart', audience: [...OFFICE, ...STOREKEEPER, ...PURCHASE] },
      { to: '/labour', label: 'Labour', icon: 'users', audience: OFFICE },
    ],
  },
  {
    label: 'Business',
    items: [
      // The Accounts pages replace the older Finance page for accountants
      { to: '/finance', label: 'Finance', icon: 'wallet', audience: ADMIN },
      { to: '/clients', label: 'Clients & Leads', icon: 'handshake', audience: OFFICE },
      // Site Engineers use Profile & Settings in their own workspace
      { to: '/settings', label: 'Settings', icon: 'gear', audience: [...OFFICE, ...STOREKEEPER, ...PURCHASE, ...PROJECT] },
    ],
  },
]

export const dashboardsForRole = (role) => ROLE_DASHBOARDS.filter((d) => role?.dashboards.includes(d.id))

export const homePathForRole = (role) => dashboardsForRole(role)[0]?.to || '/projects'

/** Sidebar groups for a role: its own dashboard plus only the items meant for it. */
export function navGroupsForRole(role) {
  const own = ROLE_DASHBOARDS.find((d) => d.id === role?.id)
  return moduleNavGroups
    .map((g) => ({
      label: g.label,
      items: g.items
        .map((it) => (it.ownDashboard ? own : it))
        .filter((it) => it && (!it.audience || it.audience.includes(role?.id))),
    }))
    .filter((g) => g.items.length)
}
