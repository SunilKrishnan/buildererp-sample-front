import { useEffect, useRef, useState } from 'react'
import Icon from '../../components/Icon.jsx'
import { MATERIAL_CATEGORIES, STORES } from '../../data/demo/inventoryDemo.js'
import {
  findStock, MATERIAL_UNITS, materialUsage, normalizeCode, round2, storeProjectLabel, validateMaterial, validateStockLine,
} from '../../services/inventory.js'
import { fmtQty, qtyStep } from './shared.jsx'

const blankLine = (storeId = '') => ({ storeId, location: '', reorder: '', opening: '' })
const Err = ({ msg }) => (msg ? <span className="field-error">{msg}</span> : null)
const hasErrors = (...maps) => maps.some((m) => Object.keys(m).length)

function StockLineFields({ line, setLine, unit, errors, storeChoices, withOpening = true }) {
  const set = (k) => (e) => setLine({ ...line, [k]: e.target.value })
  return (
    <>
      <div className="form-row">
        <label>Project / store
          <select value={line.storeId} onChange={set('storeId')} aria-invalid={!!errors.storeId}>
            <option value="">Select…</option>
            {storeChoices.map((s) => <option key={s.id} value={s.id}>{s.name} ({storeProjectLabel(s)})</option>)}
          </select>
          <Err msg={errors.storeId} />
        </label>
        <label>Storage location
          <input value={line.location} onChange={set('location')} placeholder="e.g. Finishes room, Rack 2" aria-invalid={!!errors.location} />
          <Err msg={errors.location} />
        </label>
      </div>
      <div className="form-row">
        <label>Reorder level{unit ? ` (${unit})` : ''}
          <input type="number" min="0" step={qtyStep(unit)} value={line.reorder} onChange={set('reorder')} placeholder="0" aria-invalid={!!errors.reorder} />
          <Err msg={errors.reorder} />
        </label>
        {withOpening && (
          <label>Opening stock (optional)
            <input type="number" min="0" step={qtyStep(unit)} value={line.opening} onChange={set('opening')} placeholder="0" aria-invalid={!!errors.opening} />
            <Err msg={errors.opening} />
          </label>
        )}
      </div>
      {withOpening && Number(line.opening) > 0 && (
        <div className="info-note warn sk-modal-note">
          <Icon name="alert" size={14} />
          <div>Recorded as <b>opening stock</b> (an "Opening balance" entry in stock history, source: material setup, by you). It is not a goods receipt and is not linked to any purchase order.</div>
        </div>
      )}
    </>
  )
}

/**
 * Add a material (master details + its first stock record) or edit an existing one.
 * Master details never carry quantities; stock lives in per-store stock records.
 */
export default function MaterialFormModal({ sku, inv, perms, notify, onClose, defaultStoreId = '' }) {
  const editing = !!sku
  const original = editing ? inv.state.materials.find((m) => m.sku === sku) : null
  const usage = editing ? materialUsage(inv.state, sku) : { locked: false, transactions: 0, opening: 0 }
  const [f, setF] = useState(original
    ? { name: original.name, sku: original.sku, category: original.category, unit: original.unit, supplier: original.supplier, rate: String(original.rate) }
    : { name: '', sku: '', category: '', unit: '', supplier: '', rate: '' })
  const [line, setLine] = useState(blankLine(defaultStoreId))
  const [lines, setLines] = useState(() => (editing ? inv.state.lines.filter((l) => l.sku === sku).map((l) => ({ ...l, location: inv.state.locations[`${l.sku}@${l.storeId}`] ?? l.location, reorder: String(l.reorder) })) : []))
  const [adding, setAdding] = useState(false)
  const [tried, setTried] = useState(false)
  const cardRef = useRef(null)

  useEffect(() => {
    cardRef.current?.querySelector('input:not([disabled])')?.focus()
    const onKey = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const set = (k) => (e) => setF({ ...f, [k]: k === 'sku' ? e.target.value.toUpperCase() : e.target.value })
  const unit = f.unit
  const suppliers = [...new Set(inv.state.materials.map((m) => m.supplier))].sort()
  const usedStores = new Set(lines.map((l) => l.storeId))
  const freeStores = STORES.filter((s) => !usedStores.has(s.id))
  const unitChoices = MATERIAL_UNITS.includes(f.unit) || !f.unit ? MATERIAL_UNITS : [f.unit, ...MATERIAL_UNITS]

  const masterErrors = validateMaterial(f, inv.state.materials, sku)
  const newLineErrors = !editing || adding ? validateStockLine(line, unit) : {}
  const lineErrors = lines.map((l) => validateStockLine(l, unit, { withOpening: false }))
  const show = (e) => (tried ? e : {})

  const save = (e) => {
    e.preventDefault()
    setTried(true)
    if (hasErrors(masterErrors, newLineErrors, ...lineErrors)) return
    const code = normalizeCode(f.sku)
    if (!editing) {
      inv.actions.addMaterial(f, line, perms.user)
      const opening = Number(line.opening) || 0
      notify(`Demo: ${f.name.trim()} (${code}) added${opening ? ` with ${opening} ${unit} opening stock` : ' with no stock'}. Temporary: resets on reload`)
    } else {
      inv.actions.updateMaterial(sku, f, perms.user)
      const finalSku = usage.locked ? sku : code
      lines.forEach((l) => {
        const before = inv.state.lines.find((x) => x.sku === sku && x.storeId === l.storeId)
        const beforeLoc = inv.state.locations[`${sku}@${l.storeId}`] ?? before.location
        if (round2(l.reorder) !== before.reorder || l.location.trim() !== beforeLoc) inv.actions.updateStockLine(finalSku, l.storeId, l)
      })
      if (adding) inv.actions.addStockLine(finalSku, line, perms.user)
      notify(`Demo: ${f.name.trim()} updated${adding ? ` and stocked at ${STORES.find((s) => s.id === line.storeId).name}` : ''}. Temporary: resets on reload`)
    }
    onClose()
  }

  const me = show(masterErrors)
  return (
    <div className="modal sk-material-modal" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div ref={cardRef} className="modal-card" role="dialog" aria-modal="true" aria-labelledby="mat-title">
        <div className="modal-head">
          <h3 id="mat-title">{editing ? `Edit material · ${sku}` : 'Add Material'}</h3>
          <button className="icon-btn" onClick={onClose} aria-label="Close"><Icon name="x" /></button>
        </div>
        <form className="form" onSubmit={save} noValidate>
          <div className="sk-form-section">Material details</div>
          <label>Material name
            <input value={f.name} onChange={set('name')} placeholder="e.g. Vitrified Tiles 300×300" aria-invalid={!!me.name} />
            <Err msg={me.name} />
          </label>
          <div className="form-row">
            <label>Unique material code
              <input value={f.sku} onChange={set('sku')} placeholder="e.g. MAT-TIL-300" disabled={usage.locked} aria-invalid={!!me.sku} />
              <Err msg={me.sku} />
            </label>
            <label>Category
              <select value={f.category} onChange={set('category')} aria-invalid={!!me.category}>
                <option value="">Select…</option>
                {MATERIAL_CATEGORIES.map((c) => <option key={c}>{c}</option>)}
              </select>
              <Err msg={me.category} />
            </label>
          </div>
          <div className="form-row">
            <label>Unit of measurement
              <select value={f.unit} onChange={set('unit')} disabled={usage.locked} aria-invalid={!!me.unit}>
                <option value="">Select…</option>
                {unitChoices.map((u) => <option key={u}>{u}</option>)}
              </select>
              <Err msg={me.unit} />
            </label>
            <label>Default rate per unit (₹)
              <input type="number" min="0" step="0.01" value={f.rate} onChange={set('rate')} placeholder="e.g. 950" aria-invalid={!!me.rate} />
              <Err msg={me.rate} />
            </label>
          </div>
          <label>Default supplier
            <input value={f.supplier} onChange={set('supplier')} list="sk-suppliers" placeholder="Choose or type a supplier" aria-invalid={!!me.supplier} />
            <datalist id="sk-suppliers">{suppliers.map((s) => <option key={s} value={s} />)}</datalist>
            <Err msg={me.supplier} />
          </label>
          {usage.locked && (
            <p className="cell-sub sk-modal-hint">
              <Icon name="lock" size={12} /> Code and unit are locked: this material already has {usage.transactions ? `${usage.transactions} transaction${usage.transactions > 1 ? 's' : ''}` : ''}{usage.transactions && usage.opening ? ' and ' : ''}{usage.opening ? 'opening stock' : ''} recorded against them.
              {' '}Stock value uses the current rate, so changing the rate revalues this material&apos;s stock.
            </p>
          )}

          {!editing && <>
            <div className="sk-form-section">First stock record</div>
            <StockLineFields line={line} setLine={setLine} unit={unit} errors={show(newLineErrors)} storeChoices={STORES} />
          </>}

          {editing && <>
            <div className="sk-form-section">Stock records ({lines.length} {lines.length === 1 ? 'store' : 'stores'})</div>
            {lines.map((l, i) => {
              const row = findStock(inv.stock, sku, l.storeId)
              const le = show(lineErrors[i])
              return (
                <div key={l.storeId} className="sk-line-edit">
                  <div className="sk-line-head">
                    <b>{STORES.find((s) => s.id === l.storeId).name}</b>
                    <span className="cell-sub">On hand {fmtQty(row?.onHand ?? 0, unit)} · opening {fmtQty(l.opening || 0)} (fixed; correct stock with an adjustment)</span>
                  </div>
                  <div className="form-row">
                    <label>Reorder level
                      <input type="number" min="0" step={qtyStep(unit)} value={l.reorder} onChange={(e) => setLines(lines.map((x, j) => (j === i ? { ...x, reorder: e.target.value } : x)))} aria-invalid={!!le.reorder} />
                      <Err msg={le.reorder} />
                    </label>
                    <label>Storage location
                      <input value={l.location} onChange={(e) => setLines(lines.map((x, j) => (j === i ? { ...x, location: e.target.value } : x)))} aria-invalid={!!le.location} />
                      <Err msg={le.location} />
                    </label>
                  </div>
                </div>
              )
            })}
            {freeStores.length > 0 && (adding ? <>
              <div className="sk-form-section">Stock at another store</div>
              <StockLineFields line={line} setLine={setLine} unit={unit} errors={show(newLineErrors)} storeChoices={freeStores} />
              <button type="button" className="link-btn" onClick={() => { setAdding(false); setLine(blankLine()) }}>Don&apos;t add another store</button>
            </> : <button type="button" className="btn btn-sm" style={{ alignSelf: 'flex-start' }} onClick={() => setAdding(true)}><Icon name="plus" size={14} />Add to another store</button>)}
          </>}

          <p className="cell-sub sk-modal-hint">Demo: this change is temporary and resets when the page is reloaded. Nothing is saved to a database.</p>
          {tried && hasErrors(masterErrors, newLineErrors, ...lineErrors) && <div className="form-error" role="alert"><Icon name="alert" size={14} />Please fix the highlighted fields.</div>}
          <div className="modal-foot">
            <button type="button" className="btn" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary">{editing ? 'Save changes' : 'Add material'}</button>
          </div>
        </form>
      </div>
    </div>
  )
}
