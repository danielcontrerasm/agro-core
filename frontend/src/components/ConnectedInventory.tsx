import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { AlertTriangle, ArrowDownUp, Box, Clock3, Download, List, Plus, RefreshCw } from 'lucide-react';
import { useApp } from '../context';
import { ApiError } from '../lib/api';
import { number } from '../lib/domain';
import { inventoryApi } from '../lib/inventory';
import type { InventoryDirection, InventoryLot, InventoryLotStatus, InventoryOverview, InventoryProduct } from '../lib/inventory';
import { AdminHeading, AdminTable, AdminTabs, downloadCsv, Metrics } from './AdministrationUI';
import { Badge, Empty, Loading, Modal, Panel } from './ui';

const tabs = [
  { label: 'Existencias', icon: Box },
  { label: 'Movimientos', icon: ArrowDownUp },
  { label: 'Lotes', icon: List },
  { label: 'Alertas', icon: AlertTriangle },
];

const lotStatuses: Record<InventoryLotStatus, { label: string; tone: string }> = {
  AVAILABLE: { label: 'Disponible', tone: 'green' },
  EXPIRING: { label: 'Por vencer', tone: 'gold' },
  EXPIRED: { label: 'Vencido', tone: 'red' },
  EMPTY: { label: 'Sin saldo', tone: 'neutral' },
};

const formTitles = { product: 'Nuevo producto', lot: 'Nuevo lote', movement: 'Registrar movimiento' };
type InventoryEditor = { kind: 'product' } | { kind: 'lot'; productId?: number } | { kind: 'movement'; lotId?: number; requestId: string };

const dateOnly = (value: string) => new Date(`${value}T12:00:00`).toLocaleDateString('es-CO');
const quantityLabel = (value: number, unit: string) => `${number(value, 3)} ${unit}`;

export default function ConnectedInventory() {
  const { farmId, role, search, notify } = useApp();
  const manage = role === 'ADMIN' || role === 'SUPERVISOR';
  const [inventory, setInventory] = useState<InventoryOverview>();
  const [tab, setTab] = useState('Existencias');
  const [category, setCategory] = useState('');
  const [editor, setEditor] = useState<InventoryEditor>();
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [version, setVersion] = useState(0);
  const [error, setError] = useState('');
  const [historyError, setHistoryError] = useState('');
  const [formError, setFormError] = useState('');

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    setHistoryError('');
    inventoryApi.overview(farmId).then(value => { if (active) setInventory(value); })
      .catch(() => { if (active) setError('No se pudo cargar el inventario de la finca.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [farmId, version]);

  const products = inventory?.products ?? [];
  const lots = inventory?.lots ?? [];
  const productById = new Map(products.map(product => [product.id, product]));
  const lotById = new Map(lots.map(lot => [lot.id, lot]));
  const categories = [...new Set(products.map(product => product.category))].sort((first, second) => first.localeCompare(second, 'es'));
  const query = search.trim().toLocaleLowerCase('es');
  const visibleProducts = products.filter(product => (!category || product.category === category) &&
    `${product.name} ${product.code} ${product.category}`.toLocaleLowerCase('es').includes(query));
  const visibleProductIds = new Set(visibleProducts.map(product => product.id));
  const visibleLots = lots.filter(lot => visibleProductIds.has(lot.productId));
  const visibleLotIds = new Set(visibleLots.map(lot => lot.id));
  const visibleMovements = (inventory?.movements.entries ?? []).filter(move => visibleLotIds.has(move.lotId));
  const lowStock = visibleProducts.filter(product => product.lowStock);
  const expiring = visibleLots.filter(lot => lot.status === 'EXPIRING');
  const expired = visibleLots.filter(lot => lot.status === 'EXPIRED');

  function open(next: InventoryEditor) {
    setFormError('');
    setEditor(next);
  }

  async function loadMore() {
    const beforeId = inventory?.movements.nextBeforeId;
    if (beforeId == null || loading || loadingMore) return;
    setHistoryError('');
    setLoadingMore(true);
    try {
      const next = await inventoryApi.movements(farmId, beforeId);
      setInventory(current => current?.movements.nextBeforeId === beforeId ? {
        ...current,
        movements: { entries: [...current.movements.entries, ...next.entries], nextBeforeId: next.nextBeforeId },
      } : current);
    } catch { setHistoryError('No se pudieron cargar los movimientos anteriores.'); }
    finally { setLoadingMore(false); }
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editor || busy) return;
    const formData = new FormData(event.currentTarget);
    const value = (field: string) => String(formData.get(field) ?? '').trim();
    setBusy(true);
    setFormError('');
    try {
      if (editor.kind === 'product') {
        await inventoryApi.createProduct({ farmId, code: value('code'), name: value('name'), category: value('category'), unit: value('unit'), minimum: value('minimum') });
        setTab('Existencias');
        notify('Producto registrado.');
      } else if (editor.kind === 'lot') {
        await inventoryApi.createLot({ farmId, productId: Number(value('productId')), code: value('code'), expiresOn: value('expiresOn') || null });
        setTab('Lotes');
        notify('Lote registrado. Registra una entrada para agregar existencias.');
      } else {
        await inventoryApi.createMovement({ farmId, lotId: Number(value('lotId')), requestId: editor.requestId,
          direction: value('direction') as InventoryDirection, quantity: value('quantity'), reference: value('reference') || null, notes: value('notes') || null });
        setTab('Movimientos');
        notify('Movimiento registrado.');
      }
      setCategory('');
      setEditor(undefined);
      setLoading(true);
      setVersion(previous => previous + 1);
    } catch (failure) {
      if (failure instanceof ApiError && failure.status === 0) {
        setFormError(editor.kind === 'movement'
          ? 'Se perdió la conexión. Reintenta el mismo movimiento para confirmar si quedó registrado.'
          : 'Se perdió la conexión. Verifica el inventario antes de volver a registrar la operación.');
      } else setFormError(failure instanceof Error ? failure.message : 'No se pudo guardar el registro.');
    } finally { setBusy(false); }
  }

  const actionUnavailable = loading || loadingMore || Boolean(error);
  const openMovement = (lotId?: number) => open({ kind: 'movement', lotId, requestId: crypto.randomUUID() });

  return <>
    <AdminHeading title="Inventario de insumos" description="Consulta existencias, lotes, vencimientos y movimientos de productos de campo."
      action={<div className="admin-filters">
        {manage && <>
          <button className="button" disabled={actionUnavailable} onClick={() => open({ kind: 'product' })}><Plus size={17} />Nuevo producto</button>
          <button className="button secondary" disabled={actionUnavailable || !products.length} onClick={() => open({ kind: 'lot' })}><Plus size={16} />Nuevo lote</button>
          <button className="button secondary" disabled={actionUnavailable || !lots.length} onClick={() => openMovement()}><ArrowDownUp size={16} />Registrar movimiento</button>
        </>}
        <button className="button secondary" disabled={loading || loadingMore} onClick={() => setVersion(previous => previous + 1)}><RefreshCw size={16} />Actualizar</button>
      </div>} />
    {error && <p className="form-error" role="alert">{error} {inventory && 'Se muestran los últimos datos consultados.'}</p>}
    {loading && <Loading />}
    {inventory && <>
      <Metrics items={[
        { label: 'Productos registrados', value: visibleProducts.length, note: 'En la selección', icon: Box },
        { label: 'Lotes registrados', value: visibleLots.length, note: 'En la selección', icon: List, tone: 'blue' },
        { label: 'Stock bajo', value: lowStock.length, note: 'Productos por debajo del mínimo', icon: AlertTriangle, tone: 'gold' },
        { label: 'Por vencer', value: expiring.length, note: 'Lotes en los próximos 30 días', icon: Clock3, tone: 'gold' },
        { label: 'Vencidos', value: expired.length, note: 'Lotes con saldo físico', icon: AlertTriangle, tone: 'red' },
      ]} />
      <AdminTabs tabs={tabs} value={tab} onSelect={setTab}><div className="admin-filters">
        <select aria-label="Filtrar por categoría" value={category} onChange={event => setCategory(event.target.value)}>
          <option value="">Todas las categorías</option>{categories.map(name => <option key={name}>{name}</option>)}
        </select>
      </div></AdminTabs>

      {tab === 'Existencias' && <Panel title="Existencias por producto" action={visibleProducts.length > 0 && <button className="text-button" onClick={() => downloadCsv('agrovision-inventario.csv', [
        ['Producto', 'Código', 'Categoría', 'Disponible', 'Saldo físico', 'Unidad', 'Mínimo'],
        ...visibleProducts.map(product => [product.name, product.code, product.category, product.available, product.balance, product.unit, product.minimum]),
      ])}><Download size={16} />Exportar existencias</button>}>
        {visibleProducts.length ? <>
          <p className="admin-panel-note">La cantidad disponible excluye los lotes vencidos.</p>
          <AdminTable headers={['Producto', 'Categoría', 'Disponible', 'Saldo físico', 'Mínimo', 'Estado', ...(manage ? ['Acciones'] : [])]}
            rows={visibleProducts.map(product => ({ key: product.id, cells: [
              <>{product.name}<small>{product.code}</small></>, product.category, quantityLabel(product.available, product.unit),
              quantityLabel(product.balance, product.unit), quantityLabel(product.minimum, product.unit),
              product.lowStock ? <Badge tone="gold">Stock bajo</Badge> : product.available > 0 ? <Badge>Disponible</Badge> : <Badge tone="neutral">Sin existencias</Badge>,
              ...(manage ? [<button className="text-button" disabled={actionUnavailable} onClick={() => open({ kind: 'lot', productId: product.id })}>Agregar lote</button>] : []),
            ] }))} />
        </> : <Empty title="Sin productos en la selección" description={products.length ? 'Ajusta la búsqueda o la categoría.' : manage ? 'Registra un producto para administrar sus lotes y existencias.' : 'La finca todavía no tiene productos registrados.'} />}
      </Panel>}

      {tab === 'Lotes' && <Panel title="Lotes registrados">
        {visibleLots.length ? <AdminTable headers={['Lote', 'Producto', 'Vencimiento', 'Saldo físico', 'Estado', ...(manage ? ['Acciones'] : [])]}
          rows={visibleLots.map(lot => {
            const product = productById.get(lot.productId);
            return { key: lot.id, cells: [lot.code, product?.name, lot.expiresOn ? dateOnly(lot.expiresOn) : 'Sin registrar',
              quantityLabel(lot.balance, product?.unit ?? ''), <Badge tone={lotStatuses[lot.status].tone}>{lotStatuses[lot.status].label}</Badge>,
              ...(manage ? [<button className="text-button" aria-label={`Registrar movimiento del lote ${lot.code}`} disabled={actionUnavailable} onClick={() => openMovement(lot.id)}>Registrar en lote</button>] : []),
            ] };
          })} /> : <Empty title="Sin lotes en la selección" description="Aquí aparecen los lotes registrados para los productos seleccionados." />}
      </Panel>}

      {tab === 'Movimientos' && <Panel title="Historial de movimientos">
        {visibleMovements.length ? <AdminTable headers={['Producto / lote', 'Movimiento', 'Cantidad', 'Saldo del lote', 'Registrado', 'Referencia']}
          rows={visibleMovements.map(move => {
            const lot = lotById.get(move.lotId);
            const product = lot && productById.get(lot.productId);
            return { key: move.id, cells: [
              <>{product?.name}<small>{lot?.code}</small></>, <Badge tone={move.direction === 'IN' ? 'green' : 'gold'}>{move.direction === 'IN' ? 'Entrada' : 'Salida'}</Badge>,
              quantityLabel(move.quantity, product?.unit ?? ''), quantityLabel(move.balanceAfter, product?.unit ?? ''),
              <>{new Date(move.createdAt).toLocaleString('es-CO', { dateStyle: 'medium', timeStyle: 'short' })}<small>{move.createdBy}</small></>,
              <>{move.reference || '—'}{move.notes && <small>{move.notes}</small>}</>,
            ] };
          })} /> : <p className="admin-empty-copy">{inventory.movements.nextBeforeId ? 'Sin movimientos para la selección en las páginas cargadas.' : 'Sin movimientos en la selección.'}</p>}
        {historyError && <p className="form-error" role="alert">{historyError}</p>}
        {inventory.movements.nextBeforeId != null && <button className="button secondary small" disabled={loading || loadingMore} onClick={() => void loadMore()}>{loadingMore ? 'Cargando…' : 'Cargar movimientos anteriores'}</button>}
      </Panel>}

      {tab === 'Alertas' && <Panel title="Alertas de inventario">
        {lowStock.length + expiring.length + expired.length > 0 ? <ul className="admin-activity">
          {lowStock.map(product => <li key={`product-${product.id}`}>
            <span className="admin-list-icon gold"><AlertTriangle size={18} /></span><div><strong>{product.name}</strong><small>{quantityLabel(product.available, product.unit)} disponibles · mínimo {quantityLabel(product.minimum, product.unit)}</small></div><Badge tone="gold">Stock bajo</Badge>
          </li>)}
          {[...expired, ...expiring].map(lot => <li key={`lot-${lot.id}`}>
            <span className={`admin-list-icon ${lotStatuses[lot.status].tone}`}><Clock3 size={18} /></span><div><strong>{productById.get(lot.productId)?.name}</strong><small>Lote {lot.code}{lot.expiresOn && ` · ${dateOnly(lot.expiresOn)}`}</small></div><Badge tone={lotStatuses[lot.status].tone}>{lotStatuses[lot.status].label}</Badge>
          </li>)}
        </ul> : <p className="admin-empty-copy">Sin alertas de inventario en la selección.</p>}
      </Panel>}
    </>}

    {editor && <Modal title={formTitles[editor.kind]} onClose={() => { if (!busy) setEditor(undefined); }}>
      <form className="form-stack" onSubmit={save}>
        <InventoryFields editor={editor} products={products} lots={lots} />
        {formError && <p className="form-error" role="alert">{formError}</p>}
        <div className="form-actions"><button type="button" className="button secondary" disabled={busy} onClick={() => setEditor(undefined)}>Cancelar</button><button className="button" disabled={busy}>{busy ? 'Guardando…' : 'Guardar'}</button></div>
      </form>
    </Modal>}
  </>;
}

function InventoryFields({ editor, products, lots }: { editor: InventoryEditor; products: InventoryProduct[]; lots: InventoryLot[] }) {
  if (editor.kind === 'product') return <>
    <label>Código<input name="code" required maxLength={60} /></label>
    <label>Nombre<input name="name" required maxLength={150} /></label>
    <label>Categoría<input name="category" required maxLength={80} /></label>
    <label>Unidad<input name="unit" required maxLength={30} placeholder="kg, L, unidades" /></label>
    <label>Existencia mínima<input name="minimum" required type="number" min="0" step="0.001" defaultValue="0" /></label>
  </>;
  if (editor.kind === 'lot') return <>
    <label>Producto<select name="productId" required defaultValue={editor.productId ?? ''}>
      <option value="" disabled>Selecciona un producto</option>{products.map(product => <option key={product.id} value={product.id}>{product.name} · {product.code}</option>)}
    </select></label>
    <label>Código de lote<input name="code" required maxLength={80} /></label>
    <label>Vencimiento<input name="expiresOn" type="date" /></label>
  </>;
  return <>
    <label>Lote<select name="lotId" required defaultValue={editor.lotId ?? ''}>
      <option value="" disabled>Selecciona un lote</option>{lots.map(lot => {
        const product = products.find(item => item.id === lot.productId);
        return <option key={lot.id} value={lot.id}>{product?.name} · {lot.code} · {quantityLabel(lot.balance, product?.unit ?? '')}{lot.status === 'EXPIRED' && ' · Vencido'}</option>;
      })}
    </select></label>
    <label>Tipo de movimiento<select name="direction"><option value="IN">Entrada</option><option value="OUT">Salida</option></select></label>
    <label>Cantidad<input name="quantity" required type="number" min="0.001" step="0.001" /></label>
    <label>Origen o destino<input name="reference" maxLength={180} /></label>
    <label>Notas<textarea name="notes" maxLength={1000} rows={3} /></label>
  </>;
}
