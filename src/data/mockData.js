// DEMO DATA: one apartment project at its starting stage (excavation & foundation)
// and one completed, fully sold villa project that has been handed over.
// Illustrative only. Replace with API calls in the backend phase.
import { addDays, todayISO } from '../utils/date.js'

const T = todayISO()
const START = addDays(T, -72) // project started ~10 weeks ago
const ago = (n) => addDays(T, -n)
const ahead = (n) => addDays(T, n)

// Completed villa project timeline
export const VILLA = {
  start: addDays(T, -1000),
  completedOn: addDays(T, -120), // completion / occupancy certificate
  handoverBy: addDays(T, -75), // last villa handed over (except buyers with dues pending)
}

export const projects = [
  {
    id: 'P-101',
    short: 'Sunrise Heights',
    name: 'Sunrise Heights Apartments',
    location: 'Wakad, Pune',
    type: 'Residential',
    stage: 'Excavation & foundation',
    startDate: START,
    deadline: addDays(START, 365 * 3),
    budget: 48.0,          // ₹ Cr
    spent: 2.6,            // ₹ Cr
    progress: 6,           // %
    status: 'On Track',
    units: 120,            // 2 towers × 12 floors × 5 flats
    unitsSold: 8,
    unitsBooked: 22,
    manager: 'Rahul Mehta',
  },
  {
    id: 'P-102',
    short: 'Palm Grove Villas',
    name: 'Palm Grove Villas',
    location: 'Baner, Pune',
    type: 'Villas',
    stage: 'Completed · handed over · defect liability period',
    startDate: VILLA.start,
    deadline: addDays(VILLA.start, 900), // planned completion
    completedOn: VILLA.completedOn,
    handoverBy: VILLA.handoverBy,
    budget: 36.0,          // ₹ Cr
    spent: 35.4,           // ₹ Cr, final cost
    progress: 100,
    status: 'Completed',
    units: 24,             // independent villas
    unitsSold: 24,
    unitsBooked: 0,
    manager: 'Nikhil Deshpande',
  },
]

export const sites = [
  { id: 'S-01', name: 'Sunrise Heights: Tower A', project: 'Sunrise Heights Apartments', engineer: 'Karan Joshi', workers: 58, stage: 'Footing reinforcement', weather: 'Clear', safety: 'Good', lastReport: '1 hour ago' },
  { id: 'S-03', name: 'Palm Grove Villas: Owners help desk', project: 'Palm Grove Villas', engineer: 'Amol Patil', workers: 4, stage: 'Completed · defect repairs (V-12, V-19)', weather: 'Clear', safety: 'Good', lastReport: 'Yesterday' },
  { id: 'S-02', name: 'Sunrise Heights: Tower B', project: 'Sunrise Heights Apartments', engineer: 'Meera Pillai', workers: 41, stage: 'Excavation (−3.2 m of −4.5 m)', weather: 'Clear', safety: 'Warning', lastReport: '30 min ago' },
]

// Material catalogue, store stock and stock movements live in data/demo/inventoryDemo.js
// (shared by the Store Keeper Dashboard, Materials and Purchase Orders pages).

// Purchase orders live in data/demo/procurementDemo.js (one register for every dashboard)

// Named worker register: one record per worker, used by every dashboard (no copies elsewhere).
// `present` / `hours` are the starting demo values; today's attendance comes from the Site Supervisor's muster.
export const labour = [
  { id: 'L-01', name: 'Ramesh Kumar', trade: 'Mason', site: 'Sunrise Heights: Tower A', contractor: 'Shree Labour Co.', wage: 900, present: true, hours: 9 },
  { id: 'L-02', name: 'Sunil Yadav', trade: 'Bar Bender', site: 'Sunrise Heights: Tower A', contractor: 'Shree Labour Co.', wage: 850, present: true, hours: 8 },
  { id: 'L-03', name: 'Mohammed Arif', trade: 'Carpenter', site: 'Sunrise Heights: Tower A', contractor: 'Prime Shuttering Works', wage: 950, present: false, hours: 0 },
  { id: 'L-04', name: 'Lakshmi Devi', trade: 'Helper', site: 'Sunrise Heights: Tower B', contractor: 'BuildForce Contractors', wage: 600, present: true, hours: 8 },
  { id: 'L-05', name: 'Prakash Gowda', trade: 'Machine Operator', site: 'Sunrise Heights: Tower B', contractor: 'Direct', wage: 1200, present: true, hours: 10 },
  { id: 'L-06', name: 'Ajay Singh', trade: 'Welder', site: 'Sunrise Heights: Tower A', contractor: 'Direct', wage: 1000, present: true, hours: 9 },
  { id: 'L-07', name: 'Babu Rao', trade: 'Helper', site: 'Sunrise Heights: Tower B', contractor: 'BuildForce Contractors', wage: 600, present: false, hours: 0 },
  { id: 'L-08', name: 'Kavita Sharma', trade: 'Helper', site: 'Sunrise Heights: Tower A', contractor: 'BuildForce Contractors', wage: 600, present: true, hours: 8 },
  { id: 'L-09', name: 'Raju Pawar', trade: 'Bar Bender', team: 'Rebar gang A', site: 'Sunrise Heights: Tower A', contractor: 'Shree Labour Co.', wage: 850, present: true, hours: 8 },
  { id: 'L-10', name: 'Deepak Jadhav', trade: 'Bar Bender', team: 'Rebar gang A', site: 'Sunrise Heights: Tower A', contractor: 'Shree Labour Co.', wage: 850, present: true, hours: 8 },
  { id: 'L-11', name: 'Santosh Gaikwad', trade: 'Bar Bender', team: 'Rebar gang A', site: 'Sunrise Heights: Tower A', contractor: 'Shree Labour Co.', wage: 850, present: true, hours: 8 },
  { id: 'L-12', name: 'Imtiyaz Khan', trade: 'Bar Bender', team: 'Rebar gang A', site: 'Sunrise Heights: Tower A', contractor: 'Shree Labour Co.', wage: 850, present: true, hours: 8 },
  { id: 'L-13', name: 'Vinod Mane', trade: 'Bar Bender', team: 'Rebar gang A', site: 'Sunrise Heights: Tower A', contractor: 'Shree Labour Co.', wage: 850, present: true, hours: 8 },
  { id: 'L-14', name: 'Ganesh Kale', trade: 'Bar Bender', team: 'Rebar gang A', site: 'Sunrise Heights: Tower A', contractor: 'Shree Labour Co.', wage: 850, present: true, hours: 8 },
  { id: 'L-15', name: 'Manoj Thakur', trade: 'Bar Bender', team: 'Rebar gang A', site: 'Sunrise Heights: Tower A', contractor: 'Shree Labour Co.', wage: 850, present: true, hours: 8 },
  { id: 'L-16', name: 'Suresh Patil', trade: 'Mason', team: 'Masonry gang A', site: 'Sunrise Heights: Tower A', contractor: 'Shree Labour Co.', wage: 900, present: true, hours: 8 },
  { id: 'L-17', name: 'Anil Bhosale', trade: 'Mason', team: 'Masonry gang A', site: 'Sunrise Heights: Tower A', contractor: 'Shree Labour Co.', wage: 900, present: true, hours: 8 },
  { id: 'L-18', name: 'Ramesh Shinde', trade: 'Mason', team: 'Masonry gang A', site: 'Sunrise Heights: Tower A', contractor: 'Shree Labour Co.', wage: 900, present: true, hours: 8 },
  { id: 'L-19', name: 'Dilip Waghmare', trade: 'Mason', team: 'Masonry gang A', site: 'Sunrise Heights: Tower A', contractor: 'Shree Labour Co.', wage: 900, present: true, hours: 8 },
  { id: 'L-20', name: 'Prakash Lokhande', trade: 'Mason', team: 'Masonry gang A', site: 'Sunrise Heights: Tower A', contractor: 'Shree Labour Co.', wage: 900, present: true, hours: 8 },
  { id: 'L-21', name: 'Salim Shaikh', trade: 'Carpenter', team: 'Shuttering gang A', site: 'Sunrise Heights: Tower A', contractor: 'Prime Shuttering Works', wage: 950, present: true, hours: 8 },
  { id: 'L-22', name: 'Nitin More', trade: 'Carpenter', team: 'Shuttering gang A', site: 'Sunrise Heights: Tower A', contractor: 'Prime Shuttering Works', wage: 950, present: true, hours: 8 },
  { id: 'L-23', name: 'Harish Chavan', trade: 'Carpenter', team: 'Shuttering gang A', site: 'Sunrise Heights: Tower A', contractor: 'Prime Shuttering Works', wage: 950, present: true, hours: 8 },
  { id: 'L-24', name: 'Sunita Kamble', trade: 'Helper', team: 'General helpers A', site: 'Sunrise Heights: Tower A', contractor: 'BuildForce Contractors', wage: 600, present: true, hours: 8 },
  { id: 'L-25', name: 'Rekha Salve', trade: 'Helper', team: 'General helpers A', site: 'Sunrise Heights: Tower A', contractor: 'BuildForce Contractors', wage: 600, present: true, hours: 8 },
  { id: 'L-26', name: 'Balu Kadam', trade: 'Helper', team: 'General helpers A', site: 'Sunrise Heights: Tower A', contractor: 'BuildForce Contractors', wage: 600, present: true, hours: 8 },
  { id: 'L-27', name: 'Sachin Gore', trade: 'Helper', team: 'General helpers A', site: 'Sunrise Heights: Tower A', contractor: 'BuildForce Contractors', wage: 600, present: true, hours: 8 },
  { id: 'L-28', name: 'Vikas Raut', trade: 'Machine Operator', team: 'Plant & machinery A', site: 'Sunrise Heights: Tower A', contractor: 'Direct', wage: 1200, present: true, hours: 8 },
].map((w) => ({
  ...w,
  siteId: w.site === 'Sunrise Heights: Tower A' ? 'S-01' : w.site === 'Sunrise Heights: Tower B' ? 'S-02' : null,
  team: w.team || { Mason: 'Masonry gang', 'Bar Bender': 'Rebar gang', Carpenter: 'Shuttering gang', Helper: 'General helpers', Welder: 'Fabrication', 'Machine Operator': 'Plant & machinery' }[w.trade] + (w.site === 'Sunrise Heights: Tower A' ? ' A' : ' B'),
}))

// Customer demand letters (booking, agreement and possession instalments)
export const invoices = [
  { no: 'DL-V024', client: 'Sanjay Kulkarni (V-07)', project: 'Palm Grove Villas', amount: 3600000, due: addDays(VILLA.completedOn, 20), status: 'Overdue' },
  { no: 'DL-V023', client: 'Meenal Joshi (V-15)', project: 'Palm Grove Villas', amount: 3150000, due: addDays(VILLA.completedOn, 35), status: 'Overdue' },
  { no: 'DL-0031', client: 'Priya Desai (A-704)', project: 'Sunrise Heights Apartments', amount: 780000, due: ahead(8), status: 'Unpaid' },
  { no: 'DL-0030', client: 'Rohit Malhotra (B-1102)', project: 'Sunrise Heights Apartments', amount: 920000, due: ago(6), status: 'Overdue' },
  { no: 'DL-0029', client: 'Fatima Sheikh (A-302)', project: 'Sunrise Heights Apartments', amount: 650000, due: ago(14), status: 'Paid' },
  { no: 'DL-0028', client: 'Arvind Menon (B-503)', project: 'Sunrise Heights Apartments', amount: 710000, due: ago(25), status: 'Paid' },
]

export const clients = [
  { name: 'Sanjay Kulkarni', phone: '+91 98XXX XX107', interest: 'Palm Grove Villas: V-07 (possession dues pending)', source: 'Referral', budget: '₹2.4 Cr', stage: 'Booked', owner: 'Vikram Shah' },
  { name: 'Meenal Joshi', phone: '+91 98XXX XX115', interest: 'Palm Grove Villas: V-15 (possession dues pending)', source: 'Website', budget: '₹2.1 Cr', stage: 'Booked', owner: 'Anita Rao' },
  { name: 'Priya Desai', phone: '+91 98200 11223', interest: 'Sunrise Heights: 3BHK, Tower A', source: 'Website', budget: '₹1.3 Cr', stage: 'Booked', owner: 'Anita Rao' },
  { name: 'Rohit Malhotra', phone: '+91 99000 44556', interest: 'Sunrise Heights: 3BHK, Tower B', source: 'Walk-in', budget: '₹1.4 Cr', stage: 'Booked', owner: 'Vikram Shah' },
  { name: 'Neha Kapoor', phone: '+91 98111 99887', interest: 'Sunrise Heights: 2BHK', source: 'Property Portal', budget: '₹85 L', stage: 'Negotiation', owner: 'Anita Rao' },
  { name: 'Global Tech Pvt Ltd', phone: '+91 20 4000 1234', interest: '6 × 2BHK (employee housing)', source: 'Broker', budget: '₹5.2 Cr', stage: 'Site Visit', owner: 'Vikram Shah' },
  { name: 'Arjun Kulkarni', phone: '+91 97400 33221', interest: 'Sunrise Heights: 2BHK', source: 'Social Ads', budget: '₹80 L', stage: 'Contacted', owner: 'Anita Rao' },
  { name: 'Sanjay Rao', phone: '+91 98450 77889', interest: 'Sunrise Heights: 3BHK', source: 'Referral', budget: '₹1.2 Cr', stage: 'New Lead', owner: 'Vikram Shah' },
]

// Monthly figures since launch, in ₹ Cr
export const cashflow = [
  { m: 'Aug', inflow: 1.9, outflow: 0.8 },
  { m: 'Sep', inflow: 2.4, outflow: 1.1 },
  { m: 'Oct', inflow: 1.2, outflow: 0.7 },
]

export { formatINR, formatCr } from '../utils/format.js'
