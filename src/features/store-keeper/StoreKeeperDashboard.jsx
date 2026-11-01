import { useSearchParams } from 'react-router-dom'
import Tabs from '../../components/Tabs.jsx'
import { DemoTag } from '../../components/StateViews.jsx'
import { PageHead } from '../../components/UI.jsx'
import { useInventory } from './InventoryContext.jsx'
import Overview from './Overview.jsx'
import StockOverview from './StockOverview.jsx'
import Receipts from './Receipts.jsx'
import Requests from './Requests.jsx'
import Issues from './Issues.jsx'
import Reorder from './Reorder.jsx'
import Movements from './Movements.jsx'
import ReturnsTransfers from './ReturnsTransfers.jsx'
import Reports from './Reports.jsx'
import { useStorePerms } from './shared.jsx'

const TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'stock', label: 'Stock' },
  { id: 'receipts', label: 'Receipts' },
  { id: 'requests', label: 'Material Requests' },
  { id: 'issues', label: 'Issues to Site' },
  { id: 'reorder', label: 'Low Stock & Reorder' },
  { id: 'movements', label: 'Stock Movements' },
  { id: 'returns', label: 'Returns, Transfers & Adjustments' },
  { id: 'reports', label: 'Reports' },
]

/**
 * Store Keeper Dashboard: materials received, stored, issued and remaining.
 * The tab lives in the URL (?tab=receipts) so views are linkable.
 */
export default function StoreKeeperDashboard({ search, notify }) {
  const [params, setParams] = useSearchParams()
  const inv = useInventory()
  const perms = useStorePerms()
  const tab = TABS.some((t) => t.id === params.get('tab')) ? params.get('tab') : 'overview'
  const go = (id, extra = {}) => setParams({ ...(id === 'overview' ? {} : { tab: id }), ...extra })

  const s = inv.summary
  const counts = {
    receipts: s.pendingReceipts.length,
    // New requests to check, plus approved requests that can be issued now
    requests: inv.requests.filter((r) => r.status === 'Submitted' || (['Approved', 'Partially Issued'].includes(r.status) && r.need - r.shortage > 0)).length,
    reorder: s.low.length,
    returns: s.pendingReturns.length + s.pendingAdj.length,
  }
  const props = { inv, perms, notify, search, go, params, setParams }

  return (
    <>
      <PageHead title="Store Keeper Dashboard" sub="Materials received from suppliers, stored, issued to sites and remaining in stock">
        <DemoTag />
      </PageHead>

      <Tabs label="Store Keeper sections" value={tab} onChange={(id) => go(id)} tabs={TABS.map((t) => ({ ...t, count: counts[t.id] || 0 }))} />

      {tab === 'overview' && <Overview {...props} />}
      {tab === 'stock' && <StockOverview {...props} />}
      {tab === 'receipts' && <Receipts {...props} />}
      {tab === 'requests' && <Requests {...props} />}
      {tab === 'issues' && <Issues {...props} />}
      {tab === 'reorder' && <Reorder {...props} />}
      {tab === 'movements' && <Movements {...props} />}
      {tab === 'returns' && <ReturnsTransfers {...props} />}
      {tab === 'reports' && <Reports {...props} />}
    </>
  )
}
