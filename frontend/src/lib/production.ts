import { localDate } from './domain';

export const productionUnits = [
  { value: 'kg', label: 'Kilogramos (kg)' },
  { value: 't', label: 'Toneladas (t)' },
  { value: 'g', label: 'Gramos (g)' },
  { value: 'lb', label: 'Libras (lb)' },
  { value: 'cajas', label: 'Cajas' },
  { value: 'racimos', label: 'Racimos' },
  { value: 'unidades', label: 'Unidades' },
] as const;

export const qualityGrades = [
  { value: 'PREMIUM', label: 'Premium' },
  { value: 'A', label: 'Grado A' },
  { value: 'B', label: 'Grado B' },
  { value: 'C', label: 'Grado C' },
  { value: 'REJECTED', label: 'Rechazado' },
] as const;

export type ProductionUnit = typeof productionUnits[number]['value'];
export type QualityGrade = typeof qualityGrades[number]['value'];

export type ProductionRecord = {
  id: number;
  recordType: 'HARVEST';
  fieldId?: number;
  blockId?: number;
  rowId?: number;
  field?: { id: number; name?: string };
  block?: { id: number; code?: string; field?: { id: number } };
  row?: { id: number; rowCode?: string; block?: { id: number; field?: { id: number } } };
  cropCycleId?: number;
  recordedAt: string;
  crop?: string;
  variety?: string;
  growthStage?: string;
  expectedHarvestDate?: string;
  actualHarvestDate?: string;
  harvestedAreaHa?: number;
  estimatedYield?: number;
  harvestedQuantity: number;
  yieldUnit: ProductionUnit;
  qualityGrade: QualityGrade;
  rejectedQuantity?: number;
  rejectedReason?: string;
  notes?: string;
};

export const productionKey = 'production-v1';

export const demoProduction = (): ProductionRecord[] => [{
  id: 1,
  recordType: 'HARVEST',
  fieldId: 1,
  blockId: 1,
  cropCycleId: 1,
  recordedAt: `${localDate()}T06:00:00Z`,
  crop: 'Banano',
  variety: 'Cavendish',
  growthStage: 'HARVEST',
  expectedHarvestDate: '2027-01-15',
  actualHarvestDate: localDate(),
  harvestedAreaHa: 2.4,
  estimatedYield: 1240,
  harvestedQuantity: 1180,
  yieldUnit: 'kg',
  qualityGrade: 'A',
  rejectedQuantity: 60,
  rejectedReason: 'Fruta fuera de especificación comercial',
  notes: 'Registro estructurado de demostración.',
}];

export function readProductionDemo(): ProductionRecord[] {
  try {
    const saved = localStorage.getItem(`agrovision.${productionKey}.v1`);
    return saved ? JSON.parse(saved) : demoProduction();
  } catch {
    return demoProduction();
  }
}

export function saveProductionDemo(records: ProductionRecord[]) {
  try { localStorage.setItem(`agrovision.${productionKey}.v1`, JSON.stringify(records)); return true; }
  catch { return false; }
}
