/**
 * DEMO INVENTORY RECORDS: one shared source for the Store Keeper Dashboard, the
 * Materials page, the Purchase Orders page and inventory reports.
 *
 * Stock balances are NOT stored here. They are calculated from confirmed
 * transactions (opening balance + accepted receipts + issues + accepted returns
 * + transfers + approved adjustments) by services/inventory.js, so every screen
 * shows the same figures. Illustrative only; replace with API data in the backend phase.
 */
import { addDays, todayISO } from '../../utils/date.js'

const T = todayISO()
const at = (daysAgo, time = '10:00') => `${addDays(T, -daysAgo)}T${time}`
const due = (daysAhead) => addDays(T, daysAhead)

// People (existing BuildDesk roles only: Store Keeper, Site Engineer / Supervisor,
// Purchase Manager, Accountant, Admin). Names are illustrative.
export const PEOPLE = {
  storeKeeper: 'Vijay Pawar', // the demo Store Keeper user
  warehouseKeeper: 'Ganesh More', // Store Keeper at the central warehouse
  engineerA: 'Karan Joshi', // Site Engineer, Tower A
  engineerB: 'Meera Pillai', // Site Engineer, Tower B
  engineerVillas: 'Amol Patil', // Site Engineer, Palm Grove Villas (help desk); Nikhil Deshpande is the Project Manager
  supervisorA: 'Ravi Shinde', // Supervisor, Tower A
  supervisorB: 'Imran Shaikh', // Supervisor, Tower B
  purchaseManager: 'Deepak Rao', // Purchase Manager
  admin: 'Admin User',
}
// Project Managers review site material requests (need, quantity, urgency, budget)
export const PROJECT_MANAGERS = { 'P-101': 'Rahul Mehta', 'P-102': 'Nikhil Deshpande' }

export const MATERIAL_CATEGORIES = ['Cement', 'Steel', 'Aggregates', 'Masonry', 'Formwork', 'Electrical', 'Plumbing', 'Tiles', 'Paint', 'Safety', 'Chemicals', 'Fuel', 'Other']

// Units that may be recorded with decimals (e.g. 2.5 tonnes of steel)
export const DECIMAL_UNITS = ['Tonnes', 'Cu.m', 'Kg', 'Litres']

export const MATERIAL_CATALOG = [
  { sku: 'MAT-CEM-53', name: 'Cement OPC 53 Grade', category: 'Cement', unit: 'Bags', rate: 410, supplier: 'Cement Traders' },
  { sku: 'MAT-STL-08', name: 'TMT Steel 8mm', category: 'Steel', unit: 'Tonnes', rate: 63000, supplier: 'Steel Supply Co.' },
  { sku: 'MAT-STL-12', name: 'TMT Steel 12mm', category: 'Steel', unit: 'Tonnes', rate: 62000, supplier: 'Steel Supply Co.' },
  { sku: 'MAT-STL-16', name: 'TMT Steel 16mm', category: 'Steel', unit: 'Tonnes', rate: 61500, supplier: 'Steel Supply Co.' },
  { sku: 'MAT-BWR', name: 'Binding Wire', category: 'Steel', unit: 'Kg', rate: 85, supplier: 'Steel Supply Co.' },
  { sku: 'MAT-SND-M', name: 'M-Sand', category: 'Aggregates', unit: 'Cu.m', rate: 1450, supplier: 'Stone & Aggregates' },
  { sku: 'MAT-AGG-20', name: 'Aggregate 20mm', category: 'Aggregates', unit: 'Cu.m', rate: 1650, supplier: 'Stone & Aggregates' },
  { sku: 'MAT-BRK-RED', name: 'Red Clay Bricks', category: 'Masonry', unit: 'Nos', rate: 9, supplier: 'Shree Bricks' },
  { sku: 'MAT-PLY-12', name: 'Shuttering Plywood 12mm', category: 'Formwork', unit: 'Sheets', rate: 1450, supplier: 'Formwork Depot' },
  { sku: 'MAT-ELC-25', name: 'Electrical Cable 2.5 sq mm (90 m coil)', category: 'Electrical', unit: 'Coils', rate: 2350, supplier: 'Volt Electricals' },
  { sku: 'MAT-PLB-110', name: 'PVC Pipe 110 mm (6 m length)', category: 'Plumbing', unit: 'Lengths', rate: 780, supplier: 'AquaFlow Plumbing' },
  { sku: 'MAT-TIL-600', name: 'Vitrified Tiles 600×600', category: 'Tiles', unit: 'Boxes', rate: 1150, supplier: 'Tile World' },
  { sku: 'MAT-PNT-EXT', name: 'Exterior Emulsion Paint (20 L)', category: 'Paint', unit: 'Buckets', rate: 5400, supplier: 'ColorCoat Paints' },
  { sku: 'MAT-SAF-HLM', name: 'Safety Helmets', category: 'Safety', unit: 'Nos', rate: 180, supplier: 'SafeSite Gear' },
  { sku: 'MAT-ATT', name: 'Anti-termite Chemical', category: 'Chemicals', unit: 'Litres', rate: 420, supplier: 'Chem Protect' },
  { sku: 'MAT-DSL', name: 'Diesel (machinery)', category: 'Fuel', unit: 'Litres', rate: 92, supplier: 'Local Fuel Station' },
]

// Stores. A site store belongs to one project; the central warehouse serves all projects.
export const STORES = [
  { id: 'CW', name: 'Central Warehouse', projectId: null, place: 'Wakad yard', keeper: PEOPLE.warehouseKeeper },
  { id: 'SHA', name: 'Sunrise Heights: Tower A store', projectId: 'P-101', site: 'Sunrise Heights: Tower A', keeper: PEOPLE.storeKeeper },
  { id: 'SHB', name: 'Sunrise Heights: Tower B store', projectId: 'P-101', site: 'Sunrise Heights: Tower B', keeper: PEOPLE.storeKeeper },
  { id: 'PGV', name: 'Palm Grove Villas: maintenance store', projectId: 'P-102', site: 'Palm Grove Villas: Owners help desk', keeper: PEOPLE.warehouseKeeper },
]

// Construction sites that request materials (match data/mockData.js `sites`)
export const SITES = [
  { id: 'S-01', name: 'Sunrise Heights: Tower A', projectId: 'P-101', engineer: PEOPLE.engineerA, supervisor: PEOPLE.supervisorA, storeId: 'SHA' },
  { id: 'S-02', name: 'Sunrise Heights: Tower B', projectId: 'P-101', engineer: PEOPLE.engineerB, supervisor: PEOPLE.supervisorB, storeId: 'SHB' },
  { id: 'S-03', name: 'Palm Grove Villas: Owners help desk', projectId: 'P-102', engineer: PEOPLE.engineerVillas, supervisor: PEOPLE.engineerVillas, storeId: 'PGV' },
]

/**
 * Store stock lines (material × store): opening balance brought forward 30 days ago,
 * reorder level and storage location. Current balance = opening + confirmed movements.
 */
const OPENING_AT = at(30, '08:00')
export const STOCK_LINES = [
  // Central warehouse
  { sku: 'MAT-CEM-53', storeId: 'CW', opening: 10, reorder: 150, location: 'Cement shed, Bay 1' },
  { sku: 'MAT-STL-12', storeId: 'CW', opening: 10, reorder: 10, location: 'Steel yard, Row 2' },
  { sku: 'MAT-BWR', storeId: 'CW', opening: 0, reorder: 300, location: 'Steel yard, Rack 4' },
  { sku: 'MAT-ELC-25', storeId: 'CW', opening: 30, reorder: 20, location: 'Electrical cage, Shelf A' },
  { sku: 'MAT-PLB-110', storeId: 'CW', opening: 80, reorder: 60, location: 'Pipe rack, Bay 3' },
  { sku: 'MAT-PNT-EXT', storeId: 'CW', opening: 6, reorder: 10, location: 'Finishes room' },
  { sku: 'MAT-SAF-HLM', storeId: 'CW', opening: 150, reorder: 50, location: 'PPE store' },
  // Tower A site store
  { sku: 'MAT-CEM-53', storeId: 'SHA', opening: 300, reorder: 150, location: 'Cement shed A' },
  { sku: 'MAT-STL-08', storeId: 'SHA', opening: 4, reorder: 2, location: 'Steel yard A' },
  { sku: 'MAT-STL-12', storeId: 'SHA', opening: 9, reorder: 8, location: 'Steel yard A' },
  { sku: 'MAT-STL-16', storeId: 'SHA', opening: 12, reorder: 6, location: 'Steel yard A' },
  { sku: 'MAT-SND-M', storeId: 'SHA', opening: 75, reorder: 50, location: 'Open yard A, Bin 1' },
  { sku: 'MAT-AGG-20', storeId: 'SHA', opening: 70, reorder: 60, location: 'Open yard A, Bin 2' },
  { sku: 'MAT-BRK-RED', storeId: 'SHA', opening: 0, reorder: 8000, location: 'Brick stack, North gate' },
  { sku: 'MAT-PLY-12', storeId: 'SHA', opening: 120, reorder: 80, location: 'Formwork shed' },
  { sku: 'MAT-SAF-HLM', storeId: 'SHA', opening: 40, reorder: 30, location: 'Site office' },
  { sku: 'MAT-DSL', storeId: 'SHA', opening: 320, reorder: 250, location: 'Fuel bay A' },
  // Tower B site store
  { sku: 'MAT-CEM-53', storeId: 'SHB', opening: 120, reorder: 100, location: 'Cement shed B' },
  { sku: 'MAT-SND-M', storeId: 'SHB', opening: 42, reorder: 30, location: 'Open yard B' },
  { sku: 'MAT-AGG-20', storeId: 'SHB', opening: 30, reorder: 25, location: 'Open yard B' },
  { sku: 'MAT-ATT', storeId: 'SHB', opening: 55, reorder: 40, location: 'Chemical store B' },
  { sku: 'MAT-SAF-HLM', storeId: 'SHB', opening: 25, reorder: 20, location: 'Site office B' },
  { sku: 'MAT-DSL', storeId: 'SHB', opening: 460, reorder: 250, location: 'Fuel bay B' },
  // Palm Grove Villas maintenance store (defect repairs)
  { sku: 'MAT-CEM-53', storeId: 'PGV', opening: 4, reorder: 5, location: 'Clubhouse store room, rack 1' },
  { sku: 'MAT-TIL-600', storeId: 'PGV', opening: 40, reorder: 15, location: 'Clubhouse store room' },
  { sku: 'MAT-PNT-EXT', storeId: 'PGV', opening: 8, reorder: 4, location: 'Clubhouse store room' },
  { sku: 'MAT-PLB-110', storeId: 'PGV', opening: 12, reorder: 10, location: 'Clubhouse store room' },
  { sku: 'MAT-ELC-25', storeId: 'PGV', opening: 4, reorder: 3, location: 'Clubhouse store room' },
].map((l) => ({ ...l, openingAt: OPENING_AT }))

/**
 * Goods receipts (GRN). Stock increases by the ACCEPTED quantity only, and only once
 * inspection is complete (status 'Accepted'). Rejected / damaged quantity never
 * enters usable stock. `discrepancy`: Open → Reported → Resolved.
 */
export const RECEIPTS = [
  {
    id: 'GRN-7001', po: 'PO-2312', sku: 'MAT-PLY-12', storeId: 'SHA', supplier: 'Formwork Depot',
    deliveryDate: addDays(T, -13), ordered: 300, delivered: 300, accepted: 296, rejected: 4,
    deliveryNote: 'FD/DN/1182', invoiceRef: 'FD/INV/2291', location: 'Formwork shed',
    receivedBy: PEOPLE.storeKeeper, inspectedBy: PEOPLE.storeKeeper, status: 'Accepted',
    rejectionReason: '4 sheets warped (water damage in transit). Returned to supplier.',
    discrepancy: 'Resolved', discrepancyNote: 'Supplier to credit 4 sheets. Reviewed by Purchase Manager.',
    docs: ['Delivery note FD/DN/1182', 'Photo of damaged sheets'], notes: '', at: at(13, '11:20'), confirmedAt: at(13, '15:10'),
  },
  {
    id: 'GRN-7002', po: 'PO-2310', sku: 'MAT-CEM-53', storeId: 'CW', supplier: 'Cement Traders',
    deliveryDate: addDays(T, -6), ordered: 500, delivered: 500, accepted: 490, rejected: 10,
    deliveryNote: 'CT/DN/5531', invoiceRef: 'CT/INV/8840', location: 'Cement shed, Bay 1',
    receivedBy: PEOPLE.warehouseKeeper, inspectedBy: PEOPLE.warehouseKeeper, status: 'Accepted',
    rejectionReason: '10 bags torn / set hard. Kept aside for supplier pickup.',
    discrepancy: 'Reported', discrepancyNote: 'Reported to Purchase Manager for supplier credit note.',
    docs: ['Delivery note CT/DN/5531', 'Weighbridge slip WB-2209'], notes: 'Unloaded by supplier labour.', at: at(6, '09:30'), confirmedAt: at(6, '12:45'),
  },
  {
    id: 'GRN-7003', po: 'PO-2313', sku: 'MAT-AGG-20', storeId: 'SHA', supplier: 'Stone & Aggregates',
    deliveryDate: addDays(T, -3), ordered: 200, delivered: 90, accepted: 90, rejected: 0,
    deliveryNote: 'SA/DN/0907', invoiceRef: '', location: 'Open yard A, Bin 2',
    receivedBy: PEOPLE.storeKeeper, inspectedBy: PEOPLE.storeKeeper, status: 'Accepted',
    discrepancy: 'Resolved', discrepancyNote: 'Part delivery agreed. Balance 110 cu.m expected by PO date (Purchase Manager).',
    docs: ['Delivery note SA/DN/0907'], notes: '6 truck loads measured at gate.', at: at(3, '16:05'), confirmedAt: at(3, '17:30'),
  },
  {
    id: 'GRN-7004', po: 'PO-2314', sku: 'MAT-CEM-53', storeId: 'SHA', supplier: 'Cement Traders',
    deliveryDate: T, ordered: 1500, delivered: 600, accepted: 600, rejected: 0,
    deliveryNote: 'CT/DN/5604', invoiceRef: '', location: 'Cement shed A',
    receivedBy: PEOPLE.storeKeeper, inspectedBy: PEOPLE.storeKeeper, status: 'Accepted',
    discrepancy: 'Open', discrepancyNote: '',
    docs: ['Delivery note CT/DN/5604'], notes: 'Lot 1 of 3 as per supplier.', at: at(0, '08:40'), confirmedAt: at(0, '09:40'),
  },
  {
    id: 'GRN-7005', po: 'PO-2309', sku: 'MAT-BRK-RED', storeId: 'SHA', supplier: 'Shree Bricks',
    deliveryDate: T, ordered: 20000, delivered: 20000, accepted: null, rejected: null,
    deliveryNote: 'SB/DN/311', invoiceRef: 'SB/INV/311', location: 'Brick stack, North gate',
    receivedBy: PEOPLE.storeKeeper, inspectedBy: null, status: 'Pending Inspection',
    discrepancy: null, discrepancyNote: '',
    docs: ['Delivery note SB/DN/311'], notes: 'Count and breakage check pending.', at: at(0, '11:15'), confirmedAt: null,
  },
]

/**
 * Material requests from Site Engineers / Supervisors (statuses: MR in services/inventory.js).
 * Draft → Submitted → (Store Keeper stock check) → Pending Project Manager Review → Approved /
 * Returned / Rejected → Partially Issued / Issued, or Closed. Approved, not-yet-issued quantity is
 * RESERVED and cannot be issued to anyone else. A shortage on an approved request is forwarded as a
 * linked purchase requisition (requestRef); the request stays Approved.
 */
const PM_SUNRISE = 'Rahul Mehta'
const h = (daysAgo, time, by, role, action, note = '', from, to) => ({ at: at(daysAgo, time), by, role, action, note, ...(from && { from, to }) })
export const REQUESTS = [
  { id: 'MR-5001', siteId: 'S-01', storeId: 'SHA', sku: 'MAT-CEM-53', requested: 120, approved: 120, requestedBy: PEOPLE.engineerA, approvedBy: PM_SUNRISE, requiredBy: addDays(T, -18), priority: 'Normal', status: 'Issued', purpose: 'Footing PCC, grid A1–A4', at: at(19, '09:00') },
  { id: 'MR-5002', siteId: 'S-01', storeId: 'SHA', sku: 'MAT-STL-12', requested: 3, approved: 3, requestedBy: PEOPLE.engineerA, approvedBy: PM_SUNRISE, requiredBy: addDays(T, -15), priority: 'Normal', status: 'Issued', purpose: 'Footing reinforcement', at: at(16, '09:30') },
  { id: 'MR-5003', siteId: 'S-02', storeId: 'SHB', sku: 'MAT-DSL', requested: 150, approved: 150, requestedBy: PEOPLE.engineerB, approvedBy: PM_SUNRISE, requiredBy: addDays(T, -12), priority: 'High', status: 'Issued', purpose: 'Excavator and tippers', at: at(12, '07:30') },
  { id: 'MR-5004', siteId: 'S-01', storeId: 'SHA', sku: 'MAT-STL-16', requested: 4, approved: 4, requestedBy: PEOPLE.engineerA, approvedBy: PM_SUNRISE, requiredBy: addDays(T, -8), priority: 'Normal', status: 'Issued', purpose: 'Column starters', at: at(9, '10:00') },
  { id: 'MR-5005', siteId: 'S-01', storeId: 'SHA', sku: 'MAT-PLY-12', requested: 60, approved: 60, requestedBy: PEOPLE.supervisorA, approvedBy: PM_SUNRISE, requiredBy: addDays(T, -5), priority: 'Normal', status: 'Issued', purpose: 'Footing shuttering', at: at(6, '09:00') },
  { id: 'MR-5006', siteId: 'S-02', storeId: 'SHB', sku: 'MAT-CEM-53', requested: 60, approved: 60, requestedBy: PEOPLE.engineerB, approvedBy: PM_SUNRISE, requiredBy: addDays(T, -2), priority: 'Normal', status: 'Issued', purpose: 'Retaining wall PCC', at: at(3, '08:30') },
  { id: 'MR-5008', siteId: 'S-01', storeId: 'SHA', sku: 'MAT-SND-M', requested: 15, approved: 15, requestedBy: PEOPLE.engineerA, approvedBy: PM_SUNRISE, requiredBy: T, priority: 'Normal', status: 'Issued', purpose: 'Footing concrete', at: at(1, '17:00') },
  { id: 'MR-5009', siteId: 'S-01', storeId: 'SHA', sku: 'MAT-CEM-53', requested: 100, approved: 100, requestedBy: PEOPLE.engineerA, approvedBy: PM_SUNRISE, requiredBy: T, priority: 'High', status: 'Issued', purpose: 'Footing concrete, grid A5–A8', at: at(1, '17:10') },
  { id: 'MR-5010', siteId: 'S-02', storeId: 'CW', sku: 'MAT-CEM-53', requested: 100, approved: 100, requestedBy: PEOPLE.engineerB, approvedBy: PM_SUNRISE, requiredBy: due(2), priority: 'Normal', status: 'Approved', purpose: 'Raft PCC (collect from warehouse)', at: at(1, '11:00'), checkedBy: PEOPLE.warehouseKeeper, checkNote: 'Stock at Central Warehouse covers the approved quantity' },
  { id: 'MR-5011', siteId: 'S-01', storeId: 'CW', sku: 'MAT-CEM-53', requested: 100, approved: null, requestedBy: PEOPLE.engineerA, approvedBy: null, requiredBy: due(1), priority: 'High', status: 'Submitted', purpose: 'Grade slab, Tower A', workArea: 'Tower A, ground floor grade slab', at: at(0, '08:15'),
    history: [h(0, '08:15', PEOPLE.engineerA, 'Site Engineer', 'Request submitted', '100 Bags for Sunrise Heights: Tower A; next: Store Keeper stock check', 'New', 'Submitted')] },
  { id: 'MR-5012', siteId: 'S-01', storeId: 'SHA', sku: 'MAT-STL-12', requested: 12, approved: 12, requestedBy: PEOPLE.engineerA, approvedBy: PM_SUNRISE, approvedAt: at(0, '11:30'), requiredBy: due(3), priority: 'High', status: 'Approved', purpose: 'Footing reinforcement F8–F12', workArea: 'Tower A, footings F8–F12', taskId: 'TSK-103', at: at(0, '09:05'),
    checkedBy: PEOPLE.storeKeeper, checkNote: 'Stock checked: only part of the 12 T is free at Tower A store',
    history: [
      h(0, '09:05', PEOPLE.engineerA, 'Site Engineer', 'Request submitted', '12 Tonnes for Sunrise Heights: Tower A', 'New', 'Submitted'),
      h(0, '10:10', PEOPLE.storeKeeper, 'Store Keeper', 'Stock checked; sent to the Project Manager for review', 'Only part of the 12 T is free at Tower A store', 'Submitted', 'Pending Project Manager Review'),
      h(0, '11:30', PM_SUNRISE, 'Project Manager', 'Approved by Project Manager', 'Approved 12 of 12. Urgent: rebar gang idle. Store Keeper to forward the shortage', 'Pending Project Manager Review', 'Approved'),
    ] },
  { id: 'MR-5013', siteId: 'S-01', storeId: 'CW', sku: 'MAT-BWR', requested: 200, approved: 200, requestedBy: PEOPLE.supervisorA, approvedBy: PM_SUNRISE, approvedAt: at(2, '12:00'), requiredBy: due(2), priority: 'Normal', status: 'Approved', purpose: 'Plinth beam binding', workArea: 'Tower A, plinth beams', at: at(2, '09:20'), requisitionIds: ['PR-3105'],
    checkedBy: PEOPLE.warehouseKeeper, checkNote: '0 Kg free at Central Warehouse: short by 200 of 200 requested',
    history: [
      h(2, '09:20', PEOPLE.supervisorA, 'Site Supervisor', 'Request submitted', '200 Kg for Sunrise Heights: Tower A', 'New', 'Submitted'),
      h(2, '10:30', PEOPLE.warehouseKeeper, 'Store Keeper', 'Stock checked; sent to the Project Manager for review', '0 Kg free at Central Warehouse: short by 200 of 200 requested', 'Submitted', 'Pending Project Manager Review'),
      h(2, '12:00', PM_SUNRISE, 'Project Manager', 'Approved by Project Manager', 'Approved 200 of 200', 'Pending Project Manager Review', 'Approved'),
      h(1, '10:20', PEOPLE.warehouseKeeper, 'Store Keeper', 'Shortage forwarded to the Purchase Manager as PR-3105', '200 Kg; no purchase order or payment created'),
    ] },
  { id: 'MR-5014', siteId: 'S-02', storeId: 'SHB', sku: 'MAT-AGG-20', requested: 20, approved: null, requestedBy: PEOPLE.engineerB, approvedBy: null, requiredBy: due(1), priority: 'Normal', status: 'Pending Project Manager Review', purpose: 'Raft PCC', at: at(1, '15:40'), checkedBy: PEOPLE.storeKeeper, checkNote: 'Stock at Tower B store covers the 20 requested' },
  { id: 'MR-5015', siteId: 'S-01', storeId: 'SHA', sku: 'MAT-PLY-12', requested: 80, approved: 80, requestedBy: PEOPLE.supervisorA, approvedBy: PM_SUNRISE, requiredBy: due(1), priority: 'Normal', status: 'Partially Issued', purpose: 'Plinth beam shuttering', at: at(2, '10:00'), checkedBy: PEOPLE.storeKeeper },
  { id: 'MR-5016', siteId: 'S-03', storeId: 'PGV', sku: 'MAT-TIL-600', requested: 6, approved: null, requestedBy: PEOPLE.engineerVillas, approvedBy: null, requiredBy: addDays(T, -1), priority: 'Normal', status: 'Cancelled', purpose: 'V-19 bathroom tile replacement', reason: 'Cancelled by requester: owner postponed repair', at: at(4, '12:00') },
  { id: 'MR-5017', siteId: 'S-02', storeId: 'SHB', sku: 'MAT-DSL', requested: 400, approved: null, requestedBy: PEOPLE.supervisorB, approvedBy: PM_SUNRISE, requiredBy: addDays(T, -1), priority: 'Normal', status: 'Rejected', purpose: 'Machinery fuel', reason: 'Exceeds weekly fuel plan. Raise a fresh request for 3 days.', at: at(3, '18:00') },
  // The worked example: 10 bags of cement for the raft, waiting for the Project Manager
  { id: 'MR-5018', siteId: 'S-01', storeId: 'SHA', sku: 'MAT-CEM-53', requested: 10, approved: null, requestedBy: PEOPLE.engineerA, approvedBy: null, requiredBy: due(1), priority: 'High', status: 'Submitted', purpose: 'Raft foundation work', workArea: 'Tower A, raft grid A5–A8', taskId: 'TSK-105', remarks: 'For cover blocks and chair supports before raft reinforcement', at: at(0, '07:45'),
    history: [h(0, '07:45', PEOPLE.engineerA, 'Site Engineer', 'Request submitted', '10 Bags for Sunrise Heights: Tower A; next: Store Keeper stock check', 'New', 'Submitted')] },
  { id: 'MR-5019', siteId: 'S-01', storeId: 'SHA', sku: 'MAT-ATT', requested: 120, approved: null, requestedBy: PEOPLE.engineerA, approvedBy: null, reviewedBy: PM_SUNRISE, requiredBy: due(3), priority: 'Normal', status: 'Returned', purpose: 'Anti-termite treatment to foundation', workArea: 'Tower A, around footings', taskId: 'TSK-108', reason: '120 L looks high for 1,350 sq.m. Confirm the dosage per the specification and resubmit.', at: at(1, '16:10'),
    checkedBy: PEOPLE.storeKeeper, checkNote: 'Not stocked at Tower A store: short by 120',
    history: [
      h(1, '16:10', PEOPLE.engineerA, 'Site Engineer', 'Request submitted', '120 Litres for Sunrise Heights: Tower A', 'New', 'Submitted'),
      h(1, '17:00', PEOPLE.storeKeeper, 'Store Keeper', 'Stock checked; sent to the Project Manager for review', 'Not stocked at Tower A store: short by 120', 'Submitted', 'Pending Project Manager Review'),
      h(0, '10:15', PM_SUNRISE, 'Project Manager', 'Returned to Karan Joshi for clarification', '120 L looks high for 1,350 sq.m. Confirm the dosage per the specification and resubmit.', 'Pending Project Manager Review', 'Returned'),
    ] },
  { id: 'MR-5020', siteId: 'S-01', storeId: 'SHA', sku: 'MAT-SND-M', requested: 20, approved: null, requestedBy: PEOPLE.engineerA, approvedBy: null, requiredBy: due(5), priority: 'Normal', status: 'Draft', purpose: 'Raft concrete, grid A5–A8', workArea: 'Tower A, raft grid A5–A8', taskId: 'TSK-106', at: at(0, '09:40'),
    history: [h(0, '09:40', PEOPLE.engineerA, 'Site Engineer', 'Draft saved')] },
]

/** Confirmed material issues. Stock decreases only here, never when a request is created. */
export const ISSUES = [
  { id: 'MI-8001', requestId: 'MR-5001', qty: 120, issuedBy: PEOPLE.storeKeeper, receivedBy: PEOPLE.supervisorA, notes: '', at: at(18, '08:30') },
  { id: 'MI-8002', requestId: 'MR-5002', qty: 3, issuedBy: PEOPLE.storeKeeper, receivedBy: PEOPLE.supervisorA, notes: 'Cut lengths as per BBS', at: at(15, '09:00') },
  { id: 'MI-8003', requestId: 'MR-5003', qty: 150, issuedBy: PEOPLE.storeKeeper, receivedBy: PEOPLE.supervisorB, notes: 'Fuel log FL-112', at: at(12, '07:45') },
  { id: 'MI-8004', requestId: 'MR-5004', qty: 4, issuedBy: PEOPLE.storeKeeper, receivedBy: PEOPLE.supervisorA, notes: '', at: at(8, '10:30') },
  { id: 'MI-8005', requestId: 'MR-5005', qty: 60, issuedBy: PEOPLE.storeKeeper, receivedBy: PEOPLE.supervisorA, notes: '', at: at(5, '08:15') },
  { id: 'MI-8006', requestId: 'MR-5006', qty: 60, issuedBy: PEOPLE.storeKeeper, receivedBy: PEOPLE.supervisorB, notes: '', at: at(2, '09:10') },
  { id: 'MI-8009', requestId: 'MR-5015', qty: 50, issuedBy: PEOPLE.storeKeeper, receivedBy: PEOPLE.supervisorA, notes: 'Balance 30 sheets on next pour', at: at(1, '16:20') },
  { id: 'MI-8007', requestId: 'MR-5008', qty: 15, issuedBy: PEOPLE.storeKeeper, receivedBy: PEOPLE.supervisorA, notes: '', at: at(0, '08:05') },
  { id: 'MI-8008', requestId: 'MR-5009', qty: 100, issuedBy: PEOPLE.storeKeeper, receivedBy: PEOPLE.supervisorA, notes: 'Received at batching point', at: at(0, '10:30') },
]

/**
 * Unused material returned from a site. Usable stock increases by the ACCEPTED
 * quantity only after inspection; damaged quantity goes to the damaged register.
 */
export const RETURNS = [
  { id: 'RET-9001', issueId: 'MI-8005', siteId: 'S-01', storeId: 'SHA', sku: 'MAT-PLY-12', qty: 10, accepted: 8, damaged: 2, returnedBy: PEOPLE.supervisorA, receivedBy: PEOPLE.storeKeeper, inspectedBy: PEOPLE.storeKeeper, status: 'Accepted', reason: 'Footing shuttering complete', notes: '2 sheets split at edges', at: at(4, '17:00'), confirmedAt: at(4, '17:40') },
  { id: 'RET-9002', issueId: 'MI-8006', siteId: 'S-02', storeId: 'SHB', sku: 'MAT-CEM-53', qty: 12, accepted: null, damaged: null, returnedBy: PEOPLE.supervisorB, receivedBy: PEOPLE.storeKeeper, inspectedBy: null, status: 'Pending Inspection', reason: 'Pour finished early', notes: 'Check for moisture / lumps', at: at(0, '12:10'), confirmedAt: null },
]

/** Store-to-store transfers: one record, two movements (out of source, into destination). */
export const TRANSFERS = [
  { id: 'TRF-9501', sku: 'MAT-STL-12', fromStoreId: 'CW', toStoreId: 'SHA', qty: 2, recordedBy: PEOPLE.warehouseKeeper, receivedBy: PEOPLE.storeKeeper, reason: 'Urgent footing steel', at: at(10, '14:00') },
  { id: 'TRF-9502', sku: 'MAT-SAF-HLM', fromStoreId: 'CW', toStoreId: 'SHB', qty: 20, recordedBy: PEOPLE.warehouseKeeper, receivedBy: PEOPLE.storeKeeper, reason: 'New labour batch', at: at(7, '11:00') },
]

/**
 * Stock corrections and damage write-offs. Never applied silently: each needs a reason
 * and is applied to stock only after review by someone other than the person who raised it.
 * A pending reduction is held back from issue until reviewed.
 */
export const ADJUSTMENTS = [
  { id: 'ADJ-9601', sku: 'MAT-AGG-20', storeId: 'SHB', qty: -2, kind: 'Count correction', reason: 'Physical count lower than book stock (rain wash-off)', raisedBy: PEOPLE.storeKeeper, reviewedBy: PEOPLE.admin, status: 'Approved', reviewNote: 'Accepted. Cover the bins.', at: at(7, '18:00'), reviewedAt: at(6, '10:00') },
  { id: 'ADJ-9602', sku: 'MAT-SAF-HLM', storeId: 'SHA', qty: -3, kind: 'Damaged', reason: '3 helmets cracked, unfit for use', raisedBy: PEOPLE.storeKeeper, reviewedBy: null, status: 'Pending Review', at: at(1, '17:30') },
  { id: 'ADJ-9603', sku: 'MAT-PNT-EXT', storeId: 'CW', qty: 1, kind: 'Count correction', reason: 'Monthly count found 1 bucket not recorded on receipt', raisedBy: PEOPLE.warehouseKeeper, reviewedBy: null, status: 'Pending Review', at: at(0, '09:50') },
]

/**
 * Material requisitions / purchase requests forwarded to the Purchase Manager.
 * Creating one never places a supplier order or creates a payment: the Purchase Manager
 * handles quotations, supplier selection and purchase orders.
 */
export const PURCHASE_REQUESTS = [
  { id: 'PR-3101', sku: 'MAT-PNT-EXT', storeId: 'CW', qty: 14, reason: 'Below reorder level', requestRef: null, raisedBy: PEOPLE.warehouseKeeper, status: 'Sent to Purchase Manager', note: 'Quotations requested from 2 suppliers', at: at(2, '12:00'), history: [{ at: at(2, '12:00'), by: PEOPLE.warehouseKeeper, role: 'Store Keeper', action: 'Requisition raised' }] },
  { id: 'PR-3105', sku: 'MAT-BWR', storeId: 'CW', qty: 200, reason: 'Shortage against MR-5013 (Sunrise Heights: Tower A)', requestRef: 'MR-5013', origin: 'Site request shortage', projectId: 'P-101', raisedBy: PEOPLE.warehouseKeeper, status: 'Sent to Purchase Manager', estimate: 17000, priority: 'Normal', requiredBy: due(2), note: 'With the Purchase Manager for quotations', at: at(1, '10:20'), history: [{ at: at(1, '10:20'), by: PEOPLE.warehouseKeeper, role: 'Store Keeper', action: 'Requisition raised', note: '200 Kg, estimated ₹17,000' }] },
  { id: 'PR-3102', sku: 'MAT-STL-12', storeId: 'SHA', qty: 40, reason: 'Raft reinforcement, Tower A (bar bending schedule rev 2)', requestRef: null, raisedBy: PEOPLE.storeKeeper, status: 'Awaiting Admin Review', note: 'Estimated value above the requisition review limit', at: at(1, '15:00'), history: [{ at: at(1, '15:00'), by: PEOPLE.storeKeeper, role: 'Store Keeper', action: 'Requisition raised' }] },
]
