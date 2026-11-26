import type { MoistureCondition, MoistureUnit } from './irrigation';
import type { AnalyticsLayer } from './types';
import { nutrientNames } from './fertilization';
import type { Nutrient, SoilResult } from './fertilization';
import { healthLabels, type HealthStatus } from './inspections';

export const mapNutrientCodes = Object.fromEntries(Object.entries(nutrientNames).map(([code, label]) => [label, code])) as Record<string, Nutrient>;

export const healthMapColors: Record<HealthStatus, string> = {
  ACTIVE_FINDINGS: '#e95e51',
  NO_ACTIVE_FINDINGS: '#62b66b',
  NO_RECENT_INSPECTION: '#9eaea0',
};

export const healthMapBands = (Object.keys(healthMapColors) as HealthStatus[]).map(status => ({ label: healthLabels[status], color: healthMapColors[status] }));

export const moistureMapBands: { status: MoistureCondition; label: string; color: string }[] = [
  { status: 'BELOW_RANGE', label: 'Por debajo del rango', color: '#ef8135' },
  { status: 'IN_RANGE', label: 'Dentro del rango', color: '#53b564' },
  { status: 'ABOVE_RANGE', label: 'Por encima del rango', color: '#2b87e6' },
  { status: 'STALE', label: 'Medición antigua', color: '#a892ba' },
  { status: 'UNCONFIGURED', label: 'Sin límites técnicos', color: '#9a9e8d' },
  { status: 'NO_DATA', label: 'Sin medición', color: '#a9b5ae' },
];

export const moistureMapUnits: Record<MoistureUnit, string> = { VWC_PERCENT: '%', GRAV_PERCENT: '%', KPA: 'kPa' };

export function mapMoistureReading(properties?: AnalyticsLayer['features'][number]['properties']) {
  const sectors = properties?.irrigationSectors ?? [];
  const sector = sectors.length === 1 ? sectors[0] : undefined;
  return { value: sector?.latest?.value, unit: sector?.latest?.unit, condition: sector?.condition, sectorCount: sectors.length };
}

export const moistureMapColor = (condition?: string) => moistureMapBands.find(band => band.status === condition)?.color ?? '#a9b5ae';
export const nutrientMapColors = ['#ed5e41', '#efa72b', '#58bb5d', '#2eb7dc', '#296ce2'];

export function summarizeNutrientMap(results: (SoilResult | undefined)[]) {
  const counts = new Map<SoilResult['unit'], number>();
  for (const result of results) {
    if (result && Number.isFinite(result.value)) counts.set(result.unit, (counts.get(result.unit) ?? 0) + 1);
  }
  const unit = [...counts].sort(([, first], [, second]) => second - first)[0]?.[0];
  const values = results.flatMap(result => result && result.unit === unit && Number.isFinite(result.value) ? [result.value] : []);
  const min = values.length ? Math.min(...values) : 0;
  const max = values.length ? Math.max(...values) : 0;
  return { unit, values, min, max };
}

export function nutrientMapBand(value: number, min: number, max: number) {
  return min === max ? 2 : Math.min(4, Math.max(0, Math.floor((value - min) / (max - min) * 5)));
}
