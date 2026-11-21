import type { Block } from './types';
import type { IrrigationData } from './irrigation';

export interface WaterUsageSummary {
  plannedVolumeM3: number;
  actualVolumeM3: number;
  measuredVolumeM3: number;
  estimatedVolumeM3: number;
  rainfallMm: number;
  requiredVolumeM3: number;
  balanceAppliedVolumeM3: number;
  deficitMm: number;
  plannedPlanCount: number;
  executedPlanCount: number;
  meteredExecutionCount: number;
  estimatedExecutionCount: number;
  moistureReadingCount: number;
  varianceM3: number;
  coveragePercent: number | null;
  balanceCoveragePercent: number | null;
  sectorCount: number;
}

export interface WaterUsageSector {
  sectorId: number;
  sectorName: string;
  blockId: number;
  blockCode: string;
  areaHa?: number | null;
  moistureUnit?: string | null;
  plannedVolumeM3: number;
  actualVolumeM3: number;
  measuredVolumeM3: number;
  estimatedVolumeM3: number;
  rainfallMm: number;
  requiredVolumeM3: number;
  balanceAppliedVolumeM3: number;
  deficitMm: number;
  plannedPlanCount: number;
  executedPlanCount: number;
  meteredExecutionCount: number;
  estimatedExecutionCount: number;
  moistureAverage: number | null;
  moistureReadingCount: number;
  varianceM3: number;
  coveragePercent: number | null;
  balanceCoveragePercent: number | null;
}

export interface WaterUsageReport {
  farmId: number;
  from: string;
  until: string;
  summary: WaterUsageSummary;
  sectors: WaterUsageSector[];
}

const amountKeys = ['plannedVolumeM3', 'actualVolumeM3', 'measuredVolumeM3', 'estimatedVolumeM3', 'rainfallMm', 'requiredVolumeM3', 'balanceAppliedVolumeM3', 'deficitMm'] as const;
const countKeys = ['plannedPlanCount', 'executedPlanCount', 'meteredExecutionCount', 'estimatedExecutionCount', 'moistureReadingCount'] as const;
const inRange = (value: string, from: string, until: string) => value.slice(0, 10) >= from && value.slice(0, 10) <= until;
const percent = (numerator: number, denominator: number) => denominator === 0 ? null : Math.round(numerator * 10000 / denominator) / 100;

export function summarizeWaterUsage(sectors: WaterUsageSector[]): WaterUsageSummary {
  const summary = Object.fromEntries(amountKeys.map(key => [key, 0])) as Record<typeof amountKeys[number], number>;
  const counts = Object.fromEntries(countKeys.map(key => [key, 0])) as Record<typeof countKeys[number], number>;
  sectors.forEach(sector => {
    amountKeys.forEach(key => { summary[key] += sector[key]; });
    countKeys.forEach(key => { counts[key] += sector[key]; });
  });
  const varianceM3 = summary.actualVolumeM3 - summary.plannedVolumeM3;
  return { ...summary, ...counts, varianceM3, coveragePercent: percent(summary.actualVolumeM3, summary.plannedVolumeM3), balanceCoveragePercent: percent(summary.balanceAppliedVolumeM3, summary.requiredVolumeM3), sectorCount: sectors.length };
}

export function demoWaterUsageReport(data: IrrigationData, blocks: Block[], from: string, until: string): WaterUsageReport {
  const sectors = data.sectors.map(sector => {
    const block = blocks.find(item => item.id === sector.blockId);
    const value: WaterUsageSector = {
      sectorId: sector.id, sectorName: sector.name, blockId: sector.blockId, blockCode: block?.code ?? `Bloque ${sector.blockId}`, areaHa: block?.areaHa ?? sector.areaHa,
      moistureUnit: sector.unit, plannedVolumeM3: 0, actualVolumeM3: 0, measuredVolumeM3: 0, estimatedVolumeM3: 0, rainfallMm: 0, requiredVolumeM3: 0,
      balanceAppliedVolumeM3: 0, deficitMm: 0, plannedPlanCount: 0, executedPlanCount: 0, meteredExecutionCount: 0, estimatedExecutionCount: 0,
      moistureAverage: null, moistureReadingCount: 0, varianceM3: 0, coveragePercent: null, balanceCoveragePercent: null,
    };
    const plans = data.plans.filter(plan => plan.sectorId === sector.id && plan.status === 'SCHEDULED' && inRange(plan.scheduledOn, from, until));
    plans.forEach(plan => { value.plannedVolumeM3 += plan.volumeM3; value.plannedPlanCount += 1; });
    const planIds = new Set(plans.map(plan => plan.id));
    data.executions.filter(execution => planIds.has(execution.planId) && inRange(execution.startedAt, from, until)).forEach(execution => {
      value.actualVolumeM3 += execution.volumeM3;
      if (execution.volumeMode === 'METER') { value.measuredVolumeM3 += execution.volumeM3; value.meteredExecutionCount += 1; }
      else { value.estimatedVolumeM3 += execution.volumeM3; value.estimatedExecutionCount += 1; }
      value.executedPlanCount = new Set(data.executions.filter(item => planIds.has(item.planId) && inRange(item.startedAt, from, until)).map(item => item.planId)).size;
    });
    data.waterBalances?.filter(balance => balance.sectorId === sector.id && inRange(balance.balanceDate, from, until)).forEach(balance => {
      value.rainfallMm += balance.rainfallMm ?? 0; value.requiredVolumeM3 += balance.requiredVolumeM3 ?? 0; value.balanceAppliedVolumeM3 += balance.appliedVolumeM3 ?? 0; value.deficitMm += balance.deficitMm ?? 0;
    });
    const readings = data.measurements.filter(reading => reading.sectorId === sector.id && inRange(reading.recordedAt, from, until));
    if (readings.length) { value.moistureAverage = readings.reduce((sum, reading) => sum + reading.value, 0) / readings.length; value.moistureReadingCount = readings.length; }
    value.varianceM3 = value.actualVolumeM3 - value.plannedVolumeM3; value.coveragePercent = percent(value.actualVolumeM3, value.plannedVolumeM3); value.balanceCoveragePercent = percent(value.balanceAppliedVolumeM3, value.requiredVolumeM3);
    return value;
  });
  return { farmId: 1, from, until, summary: summarizeWaterUsage(sectors), sectors };
}
