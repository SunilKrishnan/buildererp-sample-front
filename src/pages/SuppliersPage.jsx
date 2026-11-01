import { DemoTag } from '../components/StateViews.jsx'
import { PageHead } from '../components/UI.jsx'
import { useInventory } from '../features/store-keeper/InventoryContext.jsx'
import Suppliers from '../features/purchase-manager/Suppliers.jsx'
import { usePurchasePerms } from '../features/purchase-manager/shared.jsx'

// Supplier records for everyone who needs them. Purchase Manager / Admin edit; Accounts view only.
export default function SuppliersPage({ search, notify }) {
  const inv = useInventory()
  const perms = usePurchasePerms()
  return (
    <>
      <PageHead title="Suppliers" sub="Contact details, payment terms, materials and delivery performance">
        <DemoTag />
      </PageHead>
      <Suppliers inv={inv} perms={perms} notify={notify} search={search} />
    </>
  )
}
