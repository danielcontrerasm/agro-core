import { useEffect, useState } from 'react';
import { number } from '../lib/domain';
import { inventoryApi, inventoryProductKey, inventoryUnitKey, type InventoryOverview } from '../lib/inventory';

export type ApplicationLot = {
  id: number;
  productName: string;
  productCode: string;
  lotCode: string;
  unit: string;
  balance: number;
  expiresOn: string | null;
};

export function useApplicationLots(farmId: number | undefined, { productName, unit, appliedOn }: {
  productName?: string;
  unit?: string;
  appliedOn?: string;
} = {}) {
  const [result, setResult] = useState<{ farmId: number; inventory?: InventoryOverview; error?: string }>();

  useEffect(() => {
    setResult(undefined);
    if (farmId == null) return;
    let active = true;
    void inventoryApi.overview(farmId)
      .then(inventory => {
        if (!Array.isArray(inventory?.products) || !Array.isArray(inventory.lots)) throw new Error('Respuesta de inventario incompleta.');
        if (active) setResult({ farmId, inventory });
      })
      .catch(() => { if (active) setResult({ farmId, error: 'No se pudieron consultar los lotes del inventario.' }); });
    return () => { active = false; };
  }, [farmId]);

  const current = result?.farmId === farmId ? result : undefined;
  const inventory = current?.inventory;
  const products = new Map(inventory?.products.map(product => [product.id, product]));
  const lots: ApplicationLot[] = [];
  const expectedName = productName == null ? undefined : inventoryProductKey(productName);
  for (const lot of inventory?.lots ?? []) {
    const product = products.get(lot.productId);
    if (!product || !lot.hasUnitCost || lot.balance <= 0) continue;
    if (expectedName && inventoryProductKey(product.name) !== expectedName) continue;
    if (unit && inventoryUnitKey(unit) !== inventoryUnitKey(product.unit)) continue;
    if (appliedOn && lot.expiresOn && lot.expiresOn < appliedOn) continue;
    lots.push({ id: lot.id, productName: product.name, productCode: product.code, lotCode: lot.code,
      unit: product.unit, balance: lot.balance, expiresOn: lot.expiresOn });
  }
  return { lots, loading: farmId != null && !current, error: current?.error };
}

export default function ApplicationLotSelect({ lots, loading, error, value, onChange, name = 'inventoryLotId', label = 'Lote de inventario', required = true }: {
  lots: ApplicationLot[];
  loading: boolean;
  error?: string;
  value: number | undefined;
  onChange: (lot: ApplicationLot | undefined) => void;
  name?: string;
  label?: string;
  required?: boolean;
}) {
  const unavailable = loading || Boolean(error) || !lots.length;
  return <div>
    <label>{label}<select name={name} required={required} disabled={unavailable}
      value={lots.some(lot => lot.id === value) ? value : ''}
      onChange={event => onChange(lots.find(lot => lot.id === Number(event.target.value)))}>
      <option value="">{loading ? 'Cargando lotes…' : 'Selecciona un lote'}</option>
      {lots.map(lot => <option value={lot.id} key={lot.id}>{lot.productName} ({lot.productCode}) · {lot.lotCode} · {number(lot.balance, 6)} {lot.unit}{lot.expiresOn ? ` · vence ${lot.expiresOn}` : ''}</option>)}
    </select></label>
    {error ? <p className="form-error" role="alert">{error}</p> : !loading && !lots.length && <small className="muted">Se necesita un lote compatible con existencias y costo unitario registrado.</small>}
  </div>;
}
