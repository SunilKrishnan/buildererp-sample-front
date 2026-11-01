import { useSearchParams } from 'react-router-dom'
import Tabs from '../../components/Tabs.jsx'
import { DemoTag } from '../../components/StateViews.jsx'
import { PageHead } from '../../components/UI.jsx'
import { useInventory } from '../store-keeper/InventoryContext.jsx'
import { awaitingComparison } from '../../services/procurement.js'
import Overview from './Overview.jsx'
import Requisitions from './Requisitions.jsx'
import Suppliers from './Suppliers.jsx'
import Quotations from './Quotations.jsx'
import Orders from './Orders.jsx'
import Deliveries from './Deliveries.jsx'
import Bills from './Bills.jsx'
import Reports from './Reports.jsx'
import SettingsAudit from './SettingsAudit.jsx'
import { usePurchasePerms } from './shared.jsx'

const TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'requisitions', label: 'Purchase Requisitions' },
  { id: 'suppliers', label: 'Suppliers' },
  { id: 'quotations', label: 'Quotations & Comparison' },
  { id: 'orders', label: 'Purchase Orders' },
  { id: 'deliveries', label: 'Delivery Tracking' },
  { id: 'bills', label: 'Supplier Bills & Advances' },
  { id: 'reports', label: 'Reports' },
  { id: 'settings', label: 'Settings & Audit' },
]

/**
 * Purchase Manager Dashboard: requisitions from the stores → quotations → supplier selection →
 * purchase orders (Admin approval above the limit) → delivery follow-up. Receiving and stock
 * belong to the Store Keeper; bill verification and payments to Accounts.
 * The tab lives in the URL (?tab=orders) so views are linkable.
 */
export default function PurchaseManagerDashboard({ search, notify }) {
  const [params, setParams] = useSearchParams()
  const inv = useInventory()
  const perms = usePurchasePerms()
  const tab = TABS.some((t) => t.id === params.get('tab')) ? params.get('tab') : 'overview'
  const go = (id, extra = {}) => setParams({ ...(id === 'overview' ? {} : { tab: id }), ...extra })

  const prs = inv.state.purchaseRequests
  const counts = {
    requisitions: prs.filter((p) => p.status === 'Sent to Purchase Manager' || (perms.reviewRequisition && p.status === 'Awaiting Admin Review')).length,
    quotations: prs.filter((p) => awaitingComparison(p) || p.status === 'Supplier Selected').length,
    orders: inv.poViews.filter((p) => p.status === 'Draft' || (perms.approvePO && p.status === 'Pending Approval') || p.status === 'Approved').length,
    deliveries: inv.poViews.filter((p) => p.delayed).length,
  }
  const props = { inv, perms, notify, search, go, params, setParams }

  return (
    <>
      <PageHead title="Purchase Manager Dashboard" sub="Requisitions, suppliers, quotations, purchase orders and delivery follow-up">
        <DemoTag />
      </PageHead>

      <Tabs label="Purchase Manager sections" value={tab} onChange={(id) => go(id)} tabs={TABS.map((t) => ({ ...t, count: counts[t.id] || 0 }))} />

      {tab === 'overview' && <Overview {...props} />}
      {tab === 'requisitions' && <Requisitions {...props} />}
      {tab === 'suppliers' && <Suppliers {...props} />}
      {tab === 'quotations' && <Quotations {...props} />}
      {tab === 'orders' && <Orders {...props} />}
      {tab === 'deliveries' && <Deliveries {...props} />}
      {tab === 'bills' && <Bills {...props} />}
      {tab === 'reports' && <Reports {...props} />}
      {tab === 'settings' && <SettingsAudit {...props} />}
    </>
  )
}
