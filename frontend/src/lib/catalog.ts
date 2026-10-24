import { readDemo, saveDemo } from './demo';

export type CropVariety = { id: number; cropId: number; code: string; name: string; active: boolean };
export type CropCatalog = { id: number; farmId: number; code: string; name: string; active: boolean; varieties: CropVariety[] };

export const catalogKey = 'catalog';

export const demoCatalog = (): CropCatalog[] => [{
  id: 1,
  farmId: 1,
  code: 'banana',
  name: 'Banano',
  active: true,
  varieties: [{ id: 1, cropId: 1, code: 'cavendish', name: 'Cavendish', active: true }],
}];

export function readCatalogDemo(): CropCatalog[] { return readDemo(catalogKey, demoCatalog()); }
export function readCatalogForFarm(farmId: number): CropCatalog[] { return readCatalogDemo().filter(crop => crop.farmId === farmId); }
export function saveCatalogDemo(value: CropCatalog[]) { return saveDemo(catalogKey, value); }
