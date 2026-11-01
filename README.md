# BuildDesk: Builders ERP (Frontend Prototype)

UI/UX prototype: **Admin Dashboard** and **Accountant Dashboard** (plus module pages). There is no backend, database or authentication yet.
All figures on screen are **demo data** and are labelled as such in the UI.

Demo portfolio: **Sunrise Heights Apartments** (P-101, under construction, excavation & foundation) and
**Palm Grove Villas** (P-102, 24 villas, completed and handed over, fully sold, in the defect liability period).
Completed-project data uses its own random stream, so adding it doesn't change the apartment figures. The demo books start
on the apartment project's start date; the villa's earlier history comes in as opening balances.

## Run

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # production build check
```

## Stack

React 18 · Vite 5 · JavaScript (JSX) · plain CSS (design tokens in `src/styles.css`) · React Router DOM v6.
Charts are hand-rolled SVG, with no chart library.

## Structure

```
src/
  App.jsx                     Routes + app shell (sidebar, topbar, modal, toast)
  styles.css                  Design tokens (light/dark) and all component styles
  components/                 Shared UI: Icon, UI (Badge, Card, Chips, Kpi…), Charts, DataTable, StatGrid,
                              Tabs, StateViews (loading/empty/error/demo tag), SummaryCard, DashboardFilters
  auth/                       DEMO roles & permissions (demoRoles.js) and the role-preview session
                              (DemoSession.jsx). Not a login and not access control.
  config/navigation.js        Sidebar groups and the list of role dashboards
  features/admin-dashboard/   Admin Dashboard feature
    AdminDashboard.jsx        Container: URL filters, tabs, data loading, approval state
    useAdminDashboard.js      Data hook (loading / success / error)
    DashboardFilters.jsx      Project + date-range filters
    SummaryCard(s).jsx        Section A
    ProjectOverview.jsx       Section B
    LabourOverview.jsx        Section C
    PurchaseOverview.jsx      Section D
    InventoryAlerts.jsx       Section E
    FinanceOverview.jsx       Section F
    SalesOverview.jsx         Section G
    ApprovalCentre.jsx        Section H
    QualitySafety.jsx         Section I
    RecentActivity.jsx        Section J
    DashboardCharts.jsx       Section K
  features/accountant-dashboard/
    AccountantDashboard.jsx   Container: URL filters/search, tabs, on-screen-only status changes
    WorkQueue.jsx             "My work today": role-aware task list that opens the overview
    FinancialSummary.jsx      A. Money received / paid, expenses, receivables, supplier dues, overdue
    ReceiptsSection.jsx       B. Customer receipts and outstanding instalments
    ExpensesSection.jsx       C. Expense bills with category, bill no., document, verification
    SupplierPayments.jsx      D. Supplier invoices vs approved PO + GRN, due dates, payment status
    ContractorBills.jsx       Contractor accounts per work order, RA bills, advances, retention, TDS
    EmployeePayroll.jsx       Staff salary & incentive runs (separate from labour wages)
    PayrollSection.jsx        E. Labour wages from verified (read-only) attendance, labour advances
    BankCash.jsx              Bank/cash accounts and transaction register
    BankReconciliation.jsx    Match ERP transactions with the bank statement; reconciliation statement
    JournalEntries.jsx        Manual journals (draft → approval → posted), general ledger, trial balance
    TaxCompliance.jsx         GST/TDS monthly figures and filing calendar (demo configuration)
    FinanceApprovals.jsx      F. Pending financial approvals, permission-aware actions
    PermissionSummary.jsx        What the previewed role can/can't do
    FinancialReports.jsx      G. Budget vs actual, project expenses, I&E, outstanding, cash flow
  services/                   Integration boundary. UI talks only to these modules
    config.js                 DATA_SOURCE ('demo') and API base URL
    dashboardService.js       getAdminDashboard(filters), getProjectOptions()
    approvalService.js        recordApprovalDecision(): demo, nothing is persisted
    accountantService.js      getAccountantDashboard(filters), recordAccountingAction(): demo only
    demoAccountantAdapter.js  Builds the accountant view-model from demo fixtures
    ledger.js                 General ledger / trial balance from journals (pure functions)
    demoDashboardAdapter.js   Builds the dashboard view-model from demo fixtures
    apiClient.js              fetch wrapper for the future backend (unused for now)
  data/
    demo/adminDashboardDemo.js  Seeded demo fixtures for the dashboard
    demo/accountantDashboardDemo.js  Accounting fixtures, built on the admin fixtures
    demo/accountingBooksDemo.js      Employees & salary runs, bank & cash, statement status, chart of
                                     accounts, journal entries (all balanced), tax configuration
    mockData.js                 Demo data for the other module pages
  pages/                      Other module screens (Projects, Sites, Materials, …),
                              ProjectDetails, NotFound
  utils/                      date.js (ranges, buckets), format.js (₹ lakh/crore etc.)
```

## Dashboard URL state

Tabs and filters live in the query string, so views are linkable and the back button works:

`/dashboard?tab=labour&project=P-102&range=90d`

- `tab`: overview · approvals · projects · labour · purchase · finance · sales · quality · reports
- `project`: a project id, or omit for all
- `range`: today · 7d · 30d · 90d · fy · custom (with `from` / `to` as YYYY-MM-DD)
- `preview=loading|error|empty`: forces a UI state for design review

## Role dashboards & demo permissions

- `/dashboard`: Admin Dashboard · `/dashboards/accountant`: Accountant Dashboard (home: "My work today").
- Accounts pages, each with its own sidebar link: `/accounts/receipts|expenses|suppliers|contractors|salaries|payroll|`
  `bank|reconciliation|journals|tax|approvals|reports`.
- Salaries (Employee Payroll), labour wages (Labour Payroll) and contractor payments (Contractor Bills) are kept on
  separate pages; the dashboard only summarises them.
- Tax rates, sections and due dates are demo configuration in `accountingBooksDemo.js` (`TAX_CONFIG`). They must be set
  for the company's transactions and confirmed with its CA before real use.
  Query params: `project`, `range`, `from`, `to`, `q`, `status`, `as`, `preview`. Old `?tab=` links redirect.
  All Accounts pages share one layout route, so on-screen demo changes survive moving between them.
- The sidebar is role-based (`config/navigation.js`): each role sees only its own items. Admin: Admin Dashboard and
  all module pages. Accountant: Accountant Dashboard, the Accounts pages, Projects, Purchase Orders, Labour,
  Clients & Leads, Settings. Admin opens the Accountant Dashboard from the Admin Dashboard header shortcut.
- The **Preview as** selector in the top bar switches the demo user/role. It changes which dashboards
  appear in the sidebar and which action buttons are shown. It is a design-review aid, **not authentication**,
  and nothing it hides is protected.
- Accountant (demo rules): can verify bills, invoices, payroll and contractor measurements and schedule supplier
  payments; can approve only expense claims ≤ ₹50k, petty cash ≤ ₹25k and labour advances ≤ ₹10k; cannot approve
  own requests, supplier payment release, payroll, contractor bills or refunds; cannot edit attendance.
- The Accountant Dashboard always shows actions as an **Accountant** by default. An Admin can switch to their
  own permissions with the "Actions shown for" toggle (`?as=admin`); an Accountant cannot switch up.
- All Verify / Schedule / Approve actions change status on screen only and reset on reload.
- Customer accounts (click a customer name): payment schedule, payment history, **Record receipt** → **Verify with bank**
  (matched to the demo bank statement by reference, or amount and date) → receipt number and printable demo voucher.
  Cheques stay "in clearing" until cleared; unmatched or differing amounts are not counted as paid. Reminders show a
  ready message; WhatsApp/SMS/email are listed as not configured. Logic: `services/customerLedger.js`.
- Supplier bills (Expenses & Bills): **Compare with Purchase Order** runs a *simulated* AI comparison
  (`services/billComparison.js`, rule-based; no AI model or document reading) of the bill against the purchase
  order/agreement and the site confirmation. Accountant reviews findings, verifies and forwards; the authorised approver
  decides on **Bill Approvals** (`/approvals/bills`); payment is recorded only after approval. Verification, approval and
  payment are separate statuses. Demo records: `data/demo/billVerificationDemo.js`; workflow state:
  `features/bill-review/BillWorkflowContext.jsx` (session only).

## Store Keeper Dashboard (`/dashboards/store-keeper`)

Tabs (`?tab=`): overview · stock · receipts · requests · issues · reorder · movements · returns · reports (`&report=`).
Store Keeper is a preview role (**Preview as → Store Keeper**, demo user Vijay Pawar). Admin opens it from
**Operations → Store Keeper** or the Admin Dashboard header.

- **One source of stock.** Demo records live in `data/demo/inventoryDemo.js` (catalogue, stores, opening balances,
  PO lines, GRNs, requests, issues, returns, transfers, adjustments, requisitions). Balances are never stored:
  `services/inventory.js` recalculates them from confirmed transactions. The Store Keeper Dashboard, **Materials** page
  (company totals across stores) and **Purchase Orders** page (store receipt per PO, requisitions from stores) all read
  the same session state from `features/store-keeper/InventoryContext.jsx`.
- **Stock rules:** receipts add only the *accepted* quantity after inspection; rejected/damaged never becomes usable;
  approved-not-issued request quantity is *reserved*; stock falls only when an issue is confirmed; free for issue =
  on hand − reserved − on hold; returns add only the accepted quantity after inspection; a transfer is one record with
  two movements; adjustments need a reason and change stock only after someone else approves them (pending reductions
  are held back from issue).
- **Roles (demo):** Store Keeper receives, inspects, issues, records returns/transfers, manages locations, raises
  adjustments and material requisitions. Approving requests and adjustments and closing delivery discrepancies is Admin
  (never your own). The Store Keeper cannot create POs or approve purchases/payments. A requisition only appears on the
  Purchase Orders page for the Purchase Manager; it places no order.
- **Add / edit materials** (Materials page header, or Store Keeper → Stock): master details (name, unique code, category,
  unit, default supplier, rate) are kept apart from stock records (store, location, reorder level, optional opening
  stock). Opening stock is an "Opening balance" history entry with its source and person, never a goods receipt. A
  material stocked at several stores is one row on Materials and one stock record per store. Code and unit lock once
  any transaction or opening stock exists; opening stock is fixed after creation (correct it with an adjustment).
  Stock value = on hand × current rate. Admin and Store Keeper can add/edit (`materials.manage`).
- Alerts are on screen only; nothing is sent. CSV export is generated in the browser. Everything resets on reload.

## Purchase Manager Dashboard (`/dashboards/purchase-manager`)

Tabs (`?tab=`): overview · requisitions · suppliers · quotations (`&pr=`) · orders (`&po=`, `&create=`) · deliveries · bills ·
reports (`&report=`) · settings. Preview role **Purchase Manager** (demo user Deepak Rao); Admin opens it from
**Operations → Purchase Manager**. Supplier records are also at `/suppliers` (view only for Accounts).

- Flow: Store Keeper requisition → (Admin review above ₹5 L) → Purchase Manager requests quotations → records quotes
  (rate, GST, transport, delivery days, terms, quality) → compares landed cost → selects (written reason required when not
  the lowest) → draft PO → submit: approved within the ₹1 L goods-value limit, otherwise Admin approves (never the person who
  raised it) → **sent to supplier** (the store can receive only after this) → delivery follow-up with revised dates →
  Store Keeper GRN / inspection → Accounts invoice verification and payment (view only here).
- Logic: `services/procurement.js` (guarded transitions; each refuses actions not valid for the record's current status,
  writes record history and the audit trail). Seeds: `data/demo/procurementDemo.js` (suppliers, quotation history, POs).
- Policy values are demo configuration (`PO_PM_APPROVAL_LIMIT`, `REQUISITION_ADMIN_REVIEW_ABOVE`). Nothing is sent to
  suppliers; PO print / download is a demo document. Everything resets on reload.

## Site Engineer Dashboard (`/dashboards/site-engineer`, sections at `/site/:section`)

Preview role **Site Engineer** (demo user Karan Joshi, Tower A). 10 sidebar sections (`SITE_SECTIONS` in
`config/navigation.js`); sections with several parts use tabs (`?tab=`):

| Section | URL | Tabs |
| --- | --- | --- |
| Overview | `/dashboards/site-engineer` | 8 summary cards (each opens its filtered section), today's work plan, pending actions, material request status, deadlines, project-wise progress, alerts, notifications |
| My Projects & Sites | `/site/projects` | Project → tower → work area → task hierarchy, planned vs actual, documents, recent activity |
| Tasks & Work Schedule | `/site/schedule` | Tasks & schedule (filters: project, site, status, priority, due date; list / daily / weekly / monthly) · Instructions & clarifications |
| Daily Work Progress | `/site/progress` | Daily progress · Measurements & BOQ · Labour · Equipment |
| Material Requests | `/site/materials` | Draft, submit, correct a returned request, cancel, track to issue |
| Quality Inspections | `/site/quality` | Inspections & defects · Safety observations |
| Site Issues & Delays | `/site/issues` | Issue register and delayed work |
| Drawings & Documents | `/site/drawings` | Register with approved / draft / superseded revisions, demo preview and download |
| Site Diary & Reports | `/site/diary` | Site diary · Reports (Daily Progress, Weekly Summary, Task Completion, Material Request History, Quality Inspection, Site Issue, plus analytics; CSV export) |
| Settings | `/site/settings` | Profile, assignments, permissions, notification preferences, demo limitations, reset demo data |

Earlier section URLs (`/site/measurements`, `/site/safety`, `/site/reports`, `/site/profile`…) redirect to the section and
tab that now hold them (`SITE_SECTION_ALIASES`). A Site Engineer sees only assigned projects / sites
(`SITE_ASSIGNMENTS`); `/projects` and project pages are filtered too. Admin opens it from **Operations → Site Engineer**
with all sites visible.

- Records: `data/demo/siteDemo.js` (BOQ, tasks, daily reports, measurements, drawings, issues, equipment, diary,
  instructions). Existing quality, safety, labour roster, attendance and labour-requirement records are reused from the
  Admin fixtures with the same ids. Logic: `services/site.js`; session state: `features/site-engineer/SiteContext.jsx`.
- Quantities: task done = brought-forward + Submitted/Reviewed daily reports (drafts never count); BOQ executed = its
  tasks; remaining = approved − executed; measurements cannot exceed executed; approved quantities change only via a
  Project Manager-approved revision. Daily reports beyond the approved BOQ are refused.
- Material requests use the shared inventory workflow (Store Keeper stock check → Project Manager review, whatever the
  stock → issue, or shortage → linked purchase requisition → Purchase Manager → PO → GRN → issue), tracked per request
  with requested / approved / issued / remaining quantities. Statuses (`MR` in `services/inventory.js`, the same on
  every dashboard): Draft → Submitted → Pending Project Manager Review → Approved / Returned / Rejected → Partially
  Issued / Issued, or Closed (unissued balance closed by the PM or requester). Cancelled by the requester before approval.
  Each status is set only by its action, and every history entry records who, when, previous → new status and the reason.
- Task observations, blockers and photos are recorded on the task (`addTaskObservation`); planned quantities, dates and
  budgets stay as the Project Manager set them. Photos stay in the browser tab (object URLs), nothing is uploaded.
- Project Manager, Site Supervisor, QA and Safety have no login in this demo. PM decisions are labelled simulations;
  QA review and safety-closure verification use Admin as the stand-in. Attendance is read-only (Site Supervisor).

## Site Supervisor Dashboard (`/dashboards/site-supervisor`, sections at `/supervisor/:section`)

Preview role **Site Supervisor** (demo user Ravi Shinde, the named supervisor of Tower A). The Site Supervisor already existed
in the data as the person who keeps the muster and allocates crews; this adds a login for that existing role
(`sitesupervisor` in `auth/demoRoles.js`: attendance, supervision and safety reporting only). Admin opens it from
**Operations → Site Supervisor** with every site visible. Sections: Overview, Labour Attendance, Daily Work Allocation,
Labour & Teams, Work Progress, Materials & Shortages, Site Issues & Delays, Safety Observations, Site Diary, Reports & History.

- Workers come from the one named register (`labour` in `data/mockData.js`, 25 at Tower A). Attendance is one record per
  worker, site and date (re-saving updates it; changing a saved status needs a reason); it feeds the Site Engineer's
  labour page, the Admin Labour page and a read-only muster on Accounts → Labour Payroll. Nothing is paid from it.
- Allocation: only workers marked present / half day, one activity per worker per day, only activities already open
  (assigned by the Project Manager / Site Engineer); planned quantity, dates and budget are never changed here.
- Progress: one entry per task and day, never beyond the planned quantity (pending entries count against it); it
  counts towards task progress only after the Site Engineer verifies it (Daily Work Progress), and a DPR line for the same
  task and day is refused so work is never counted twice. Verification is not a quality inspection.
- Shortages are reports to the Site Engineer, who raises the formal material request from them (Store Keeper check →
  Project Manager → issue). The supervisor sees store stock and requests read-only.
- Issues go to the Site Engineer (technical) or Project Manager (scheduling conflicts); the supervisor adds notes but
  cannot resolve someone else's issue or close one. Safety observations go to the Site Engineer (incidents and high
  severity also to the PM) and are closed only by the safety reviewer. The supervisor's diary is reviewed by the Site Engineer.
- Records: `ATTENDANCE_RECORDS`, `WORK_ALLOCATIONS`, `SUPERVISOR_PROGRESS`, `SHORTAGE_REPORTS` in `data/demo/siteDemo.js`;
  rules in `services/site.js`; pages in `features/site-supervisor/`.

## Safety Officer Dashboard (`/dashboards/safety-officer`, sections at `/safety/:section`)

Preview role **Safety Officer** (demo user Sneha Kulkarni). The Safety Officer already existed in the records as the
"authorised safety reviewer" (Admin used to stand in); this adds the login (`safetyofficer`: `safety.report`,
`safety.manage`, `safety.verify`; no stock, purchasing or payment permissions). 12 sections: Safety Overview, Safety
Inspections, Hazard Reports, Incident Management, Corrective Actions, PPE Management, Safety Training, Permit to Work,
Emergency Preparedness, Safety Documents, Reports & Analytics, Activity History.

- One hazard / incident register (`state.safety`, the existing records with the same ids). Incidents are its accident,
  injury, damage and near-miss records; a near miss is never counted as an injury. Reporting, investigation (findings,
  root cause, restricted people / injury details) and closure are separate steps.
- Flow: anyone with `safety.report` (Site Engineer, Site Supervisor) reports → Safety Officer reviews severity and the
  immediate control (high risk cannot be reviewed or reported without it) → assigns corrective actions (owner, priority,
  target date) → the owner records progress and submits evidence → a verifier (`safety.verify`, never the submitter)
  verifies or returns it → the record closes only when every action is verified (and, for incidents, the investigation
  is complete). Every step keeps previous → new status, who, when and why; records are never deleted.
- Corrective actions (`state.safetyActions`) are one register built from the actions on the existing records and the
  existing safety tasks (same ids), plus failed safety inspections.
- Safety inspections are separate from QA inspections; hazards can link a QA NCR (shown on the NCR in the QA dashboard).
- PPE issue records use the worker register; compliance comes only from field checks, never from issue records.
- Permits: prepared by the Safety Officer, approved by the project's Project Manager (or Admin; never the preparer),
  activated after the precautions are checked. Expired, suspended, draft and unapproved permits are shown as not valid.
- Checklists, training requirements and emergency points are DEMO templates / placeholders to be replaced by the
  company's approved checklists and verified site information. No real numbers or addresses are invented.
- Integrations: Site Supervisor and Site Engineer report hazards / incidents and work on corrections assigned to them
  (`MySafetyActions`); the Site Engineer also sees permits and restrictions on the site. Project Manager and Admin see a
  safety summary (`SafetySummary`) and can approve permits; Admin's Action Centre lists permit approvals, actions
  awaiting verification, overdue actions and high-risk hazards. Logic: `services/safety.js`; data:
  `data/demo/safetyDemo.js`; pages: `features/safety/`.

## Project Manager Reviews (`/dashboards/project-manager`) and cross-dashboard workflow

Preview role **Project Manager** (existing role; demo user Rahul Mehta, P-101). One review page, not a separate dashboard:
daily reports (review / return), material requirements (approve, partial approve with reason, return for clarification,
reject with reason), planned vs actual
and delay reviews, BOQ revisions and measurement verification, site issues (comment / close), quality & safety oversight,
instructions and clarifications. A PM decides only for projects they manage; Admin can open the page read-only.
The earlier "simulated" Site Engineer / Project Manager buttons were removed: each decision now happens in one place.

Connected flow (one shared record at every step): Site Engineer material request → Store Keeper records usable stock
(free = on hand − reserved − on hold) → Project Manager review whatever the stock (approve / part-approve / return /
reject; the requester cannot approve their own; approval reserves free stock) → Store Keeper issue (partial allowed,
capped at approved outstanding and free stock) and/or the shortage forwarded as a requisition linked by `requestRef`,
never automatically and never as a PO (requisitions with no site request are labelled "Reorder — no site request";
Admin reviews above ₹5 L: approve / return for correction / reject) → Purchase Manager quotations → PO (Admin approval above ₹1 L) → sent → Store Keeper
GRN (accepted / rejected) → stock and the request's outstanding quantity → Accountant invoice verified at accepted value
→ Admin payment release → payment. Admin's Action Centre also carries QA reviews and safety verifications (Admin stands in
for the QA / Safety roles, which have no login), site issues assigned to Admin, and watch items (delays, escalations,
reports with the PM). Accountant reports include material cost by project from verified invoices only (POs are
commitments, advances are prepayments, transfers are never purchases). Repeated submissions are refused by status /
duplicate checks.

Purchase orders: Draft → Pending Approval (only above the Purchase Manager's ₹1 L limit) → Approved / Rejected, or
returned to Draft for correction with a mandatory reason → Sent to Supplier (only once approved) → Partially Delivered →
Completed, or Cancelled. A material request approval is never treated as PO approval. Delivered / accepted / rejected
quantities always come from the Store Keeper's GRNs; the Purchase Manager records follow-ups and revised dates only.
Supplier invoices: the Accountant matches invoice × PO × GRN (quantity and rate mismatches flagged), verifies at the
accepted value, requests payment release (Admin approves), then records payments; advance paid, invoice total, advance
adjusted, payments made and balance are shown separately, and Unpaid / Partially Paid / Paid follow recorded payments.

All of this is frontend demo state (`InventoryProvider`, `SiteProvider`): it is shared by every dashboard in the same
browser tab (switch role with "Preview as"), is not multi-user, and resets on reload. Settings → Reset demo data
restores the starting records.

## Backend phase: what to replace

1. Implement the real endpoints, then change the non-demo branches in `services/dashboardService.js`
   and `services/approvalService.js` to call `apiRequest(...)`.
2. Return the same shape that `buildAdminDashboard()` returns (that function documents the contract),
   or map the API response to it inside the service.
3. Set `VITE_DATA_SOURCE=api` and `VITE_API_BASE_URL=...` in `.env`.
4. Do the same for `services/accountantService.js` (contract: `buildAccountantDashboard()`).
   For inventory, load the same record shapes in `services/inventoryService.js` and record each action on the server,
   which must recalculate stock and enforce the permissions and segregation of duties.
5. Replace `auth/` with the real session; enforce permissions and approval limits on the server.
6. Delete `services/demo*Adapter.js` and `data/demo/` once nothing imports them.

No Admin Dashboard component imports demo data directly, so those components need no changes.
The older module pages in `pages/` still read `data/mockData.js` and will get their own services when those modules are built.
