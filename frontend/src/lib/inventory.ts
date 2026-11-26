import { request } from './api';

export type InventoryDirection = 'IN' | 'OUT';
export type InventoryLotStatus = 'AVAILABLE' | 'EXPIRING' | 'EXPIRED' | 'EMPTY';

export interface InventoryProduct {
  id: number;
  code: string;
  name: string;
  category: string;
  unit: string;
  minimum: number;
  available: number;
  balance: number;
  lowStock: boolean;
}

export interface InventoryLot {
  id: number;
  productId: number;
  code: string;
  expiresOn: string | null;
  balance: number;
  status: InventoryLotStatus;
  hasUnitCost: boolean;
  unitCostCop?: number | null;
  stockValueCop?: number | null;
}

export interface InventoryMovement {
  id: number;
  lotId: number;
  direction: InventoryDirection;
  quantity: number;
  balanceAfter: number;
  reference: string | null;
  notes: string | null;
  createdAt: string;
  createdByUserId: number;
  createdBy: string;
  appliedOn?: string | null;
  unitCostCop?: number | null;
  costCop?: number | null;
}

export interface InventoryMovementPage {
  entries: InventoryMovement[];
  nextBeforeId: number | null;
}

export interface InventoryOverview {
  products: InventoryProduct[];
  lots: InventoryLot[];
  movements: InventoryMovementPage;
}

type NewProduct = Pick<InventoryProduct, 'code' | 'name' | 'category' | 'unit'> & { farmId: number; minimum: string };
type NewLot = Pick<InventoryLot, 'productId' | 'code' | 'expiresOn'> & { farmId: number; unitCostCop?: string | null };
type NewMovement = Pick<InventoryMovement, 'direction' | 'lotId' | 'reference' | 'notes'> & {
  farmId: number;
  quantity: string;
  requestId: string;
};

export const inventoryApi = {
  overview: (farmId: number) => request<InventoryOverview>(`/inventory?farmId=${farmId}`),
  movements: (farmId: number, beforeId: number) => request<InventoryMovementPage>(`/inventory/movements?farmId=${farmId}&beforeId=${beforeId}`),
  createProduct: (payload: NewProduct) => request<InventoryProduct>('/inventory/products', 'POST', payload),
  createLot: (payload: NewLot) => request<InventoryLot>('/inventory/lots', 'POST', payload),
  updateLotCost: (lotId: number, payload: { farmId: number; unitCostCop: string | null }) => request<InventoryLot>(`/inventory/lots/${lotId}/cost`, 'PATCH', payload),
  createMovement: (payload: NewMovement) => request<InventoryMovement>('/inventory/movements', 'POST', payload),
};

export const inventoryProductKey = (value: string) => value.trim().replace(/\s+/gu, ' ').toLowerCase();

export function inventoryUnitKey(value: string) {
  const key = inventoryProductKey(value);
  if (['kg', 'kgs', 'kilogramo', 'kilogramos'].includes(key)) return 'kg';
  if (['l', 'lt', 'lts', 'litro', 'litros'].includes(key)) return 'l';
  return key;
}
