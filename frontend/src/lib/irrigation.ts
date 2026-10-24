import { readDemo } from './demo';
import { localDate } from './domain';
import type { AnalyticsLayer } from './types';

export const irrigationKey = 'irrigation';
export const moistureUnits = { VWC_PERCENT: '% volumétrico', GRAV_PERCENT: '% gravimétrico', KPA: 'kPa (tensión)' };
export type MoistureUnit = keyof typeof moistureUnits;
export type MoistureCondition = 'NO_DATA' | 'STALE' | 'UNCONFIGURED' | 'BELOW_RANGE' | 'IN_RANGE' | 'ABOVE_RANGE';
export const moistureLabels: Record<MoistureCondition, string> = { NO_DATA: 'Sin medición', STALE: 'Medición antigua', UNCONFIGURED: 'Sin límites técnicos', BELOW_RANGE: 'Por debajo del rango', IN_RANGE: 'Dentro del rango configurado', ABOVE_RANGE: 'Por encima del rango' };
export interface IrrigationMeasurement { id: number | string; sectorId: number; recordedAt: string; value: number; unit: MoistureUnit; depthCm: number; source: 'MANUAL' | 'SENSOR'; instrument: string; rainMm?: number; drainage?: string; notes?: string; createdBy?: number }
export interface IrrigationSector { id: number; blockId: number; name: string; areaHa: number; system: string; waterSource: string; flowM3h?: number; unit: MoistureUnit; depthCm: number; sensorDeviceId?: number; lowerBound?: number; upperBound?: number; maxAgeHours: number; technicalBasis: string; version: number; createdBy: number; createdAt: string; latest?: IrrigationMeasurement | null; condition: MoistureCondition; sensorCondition?: MoistureCondition }
export interface IrrigationPlan { id: number; sectorId: number; scheduledOn: string; scheduledTime: string; durationMinutes: number; volumeM3: number; assigneeId: number; justification: string; instructions: string; sectorSnapshot: IrrigationSector; status: 'SCHEDULED' | 'CANCELED'; taskId?: number; taskStatus?: string; version: number; actualVolumeM3: number; actualDurationMinutes: number; createdBy: number; createdAt: string; cancelReason?: string; canceledBy?: number }
export interface IrrigationExecution { id: number; planId: number; eventId: number; startedAt: string; endedAt: string; interruptionMinutes: number; volumeMode: 'METER' | 'FLOW'; meterUnit?: 'L' | 'M3'; meterStart?: number; meterEnd?: number; flowM3h?: number; varianceReason?: string; notes?: string; durationMinutes: number; volumeM3: number; createdBy: number; createdAt: string }
export interface IrrigationWaterSource { id: number; farmId: number; name: string; sourceType: string; latitude?: number | null; longitude?: number | null; capacityM3?: number | null; active: boolean; notes?: string | null; version?: number }
export interface IrrigationWaterQuality { id: number; sourceId: number; sampledOn: string; ph?: number | null; conductivityDsM?: number | null; salinityPpm?: number | null; suspendedSolidsMgL?: number | null; laboratoryReference?: string | null; notes?: string | null; version?: number }
export interface IrrigationInfrastructure { id: number; farmId: number; blockId?: number | null; sourceId?: number | null; assetType: string; code: string; status: string; latitude?: number | null; longitude?: number | null; notes?: string | null; version?: number }
export interface IrrigationWaterBalance { id: number; sectorId: number; balanceDate: string; rainfallMm: number; et0Mm?: number | null; cropCoefficient?: number | null; rootDepthCm?: number | null; availableWaterMm?: number | null; requiredVolumeM3?: number | null; appliedVolumeM3?: number | null; deficitMm?: number | null; notes?: string | null; version?: number }
export interface IrrigationMaintenance { id: number; sectorId?: number | null; infrastructureId?: number | null; maintenanceType: string; scheduledOn: string; completedOn?: string | null; status: string; pressureKpa?: number | null; flowM3h?: number | null; notes?: string | null; taskId?: number | null; version?: number }
export interface IrrigationSensorCheck { id: number; sectorId: number; sensorDeviceId: number; checkedOn: string; calibrationStatus: string; referenceValue?: number | null; observedValue?: number | null; technician?: string | null; notes?: string | null; version?: number }
export interface IrrigationData { sectors: IrrigationSector[]; measurements: IrrigationMeasurement[]; plans: IrrigationPlan[]; executions: IrrigationExecution[]; waterSources?: IrrigationWaterSource[]; waterQuality?: IrrigationWaterQuality[]; infrastructure?: IrrigationInfrastructure[]; waterBalances?: IrrigationWaterBalance[]; maintenance?: IrrigationMaintenance[]; sensorChecks?: IrrigationSensorCheck[] }
export const emptyIrrigation = (): IrrigationData => ({ sectors: [], measurements: [], plans: [], executions: [], waterSources: [], waterQuality: [], infrastructure: [], waterBalances: [], maintenance: [], sensorChecks: [] });
export function moistureCondition(sector: Pick<IrrigationSector, 'maxAgeHours' | 'lowerBound' | 'upperBound'>, latest?: IrrigationMeasurement | null, now = Date.now()): MoistureCondition {
  if (!latest) return 'NO_DATA';
  if (Date.parse(latest.recordedAt) + sector.maxAgeHours * 3600000 < now) return 'STALE';
  if (sector.lowerBound == null || sector.upperBound == null) return 'UNCONFIGURED';
  return latest.value < sector.lowerBound ? 'BELOW_RANGE' : latest.value > sector.upperBound ? 'ABOVE_RANGE' : 'IN_RANGE';
}
export function refreshIrrigation(data: IrrigationData, now = Date.now()): IrrigationData {
  return { ...data, sectors: data.sectors.map(sector => {
    const latest = data.measurements.filter(reading => reading.sectorId === sector.id && Date.parse(reading.recordedAt) <= now).sort((first, second) => Date.parse(second.recordedAt) - Date.parse(first.recordedAt) || String(second.id).localeCompare(String(first.id)))[0];
    const sensorLatest = data.measurements.filter(reading => reading.sectorId === sector.id && reading.source === 'SENSOR' && Date.parse(reading.recordedAt) <= now).sort((first, second) => Date.parse(second.recordedAt) - Date.parse(first.recordedAt))[0];
    return { ...sector, latest, condition: moistureCondition(sector, latest, now), sensorCondition: sector.sensorDeviceId ? moistureCondition(sector, sensorLatest, now) : undefined };
  }) };
}
export function irrigationTotals(executions: IrrigationExecution[]) {
  return { measured: executions.filter(item => item.volumeMode === 'METER').reduce((sum, item) => sum + item.volumeM3, 0), estimated: executions.filter(item => item.volumeMode === 'FLOW').reduce((sum, item) => sum + item.volumeM3, 0) };
}
export function executionAmounts(input: Pick<IrrigationExecution, 'startedAt' | 'endedAt' | 'interruptionMinutes' | 'volumeMode' | 'meterStart' | 'meterEnd' | 'meterUnit' | 'flowM3h'>) {
  const durationMinutes = (Date.parse(input.endedAt) - Date.parse(input.startedAt)) / 60000 - input.interruptionMinutes;
  if (!Number.isFinite(durationMinutes) || durationMinutes <= 0 || input.interruptionMinutes < 0) throw new Error('Revisa inicio, fin e interrupciones.');
  let volumeM3: number;
  if (input.volumeMode === 'METER') {
    if (input.meterStart == null || input.meterEnd == null || !input.meterUnit || input.meterStart < 0 || input.meterEnd < input.meterStart || input.flowM3h != null) throw new Error('El contador requiere unidad y lecturas crecientes, sin caudal estimado.');
    volumeM3 = (input.meterEnd - input.meterStart) / (input.meterUnit === 'L' ? 1000 : 1);
  } else {
    if (input.flowM3h == null || input.flowM3h <= 0 || input.meterStart != null || input.meterEnd != null || input.meterUnit != null) throw new Error('La estimación requiere caudal, sin lecturas de contador.');
    volumeM3 = input.flowM3h * durationMinutes / 60;
  }
  if (!Number.isFinite(volumeM3) || volumeM3 > 1e9) throw new Error('Volumen fuera de rango.');
  return { durationMinutes: Math.round(durationMinutes * 1e6) / 1e6, volumeM3: Math.round(volumeM3 * 1e6) / 1e6 };
}
export function demoIrrigation(): IrrigationData {
  const createdAt = new Date(Date.now() - 86400000 * 10).toISOString();
  const sectors: IrrigationSector[] = [1, 2, 3, 4, 5].map((id, index) => ({ id, blockId: id, name: `Sector demo ${id}`, areaHa: [28, 25, 32, 18, 18][index], system: 'Microaspersión — ejemplo', waterSource: 'Reservorio de demostración', flowM3h: 12 + index * 2, unit: id === 3 ? 'KPA' : 'VWC_PERCENT', depthCm: 20, lowerBound: id === 5 ? undefined : id === 3 ? 10 : 25, upperBound: id === 5 ? undefined : id === 3 ? 20 : 35, maxAgeHours: 24, technicalBasis: 'Configuración ficticia para probar el módulo; no es una recomendación agronómica.', version: 0, createdBy: 1, createdAt, condition: 'NO_DATA' }));
  const measurements: IrrigationMeasurement[] = sectors.map((sector, index) => ({ id: sector.id, sectorId: sector.id, recordedAt: new Date(Date.now() - (sector.id === 4 ? 48 : 2) * 3600000).toISOString(), value: [18, 29, 26, 31, 34][index], unit: sector.unit, depthCm: sector.depthCm, source: 'MANUAL', instrument: 'Instrumento de demostración', rainMm: [0, 4, 12, 0, 7][index], drainage: sector.id === 3 ? 'Revisar canales — observación ficticia' : 'Recorrido sin novedades — ejemplo', createdBy: 1 }));
  const scheduledOn = localDate();
  const plans: IrrigationPlan[] = [{ id: 1, sectorId: 1, scheduledOn, scheduledTime: '08:00', durationMinutes: 60, volumeM3: 12, assigneeId: 1, justification: 'Ejemplo de programación revisable; no constituye recomendación.', instructions: 'Verificar equipo y registrar contador o estimación.', sectorSnapshot: sectors[0], status: 'SCHEDULED', version: 0, actualVolumeM3: 0, actualDurationMinutes: 0, createdBy: 1, createdAt }];
  return refreshIrrigation({ sectors, measurements, plans, executions: [], waterSources: [{ id: 1, farmId: 1, name: 'Reservorio principal', sourceType: 'RESERVOIR', capacityM3: 1800, active: true, notes: 'Dato demostrativo.' }], waterQuality: [{ id: 1, sourceId: 1, sampledOn: localDate(), ph: 6.8, conductivityDsM: 0.42, salinityPpm: 180, suspendedSolidsMgL: 24, laboratoryReference: 'LAB-DEMO-001' }], infrastructure: [{ id: 1, farmId: 1, blockId: 1, sourceId: 1, assetType: 'FILTER', code: 'FIL-N-01', status: 'ACTIVE', notes: 'Mantenimiento demostrativo.' }, { id: 2, farmId: 1, blockId: 1, sourceId: 1, assetType: 'PUMP', code: 'BOM-N-01', status: 'MAINTENANCE' }], waterBalances: [{ id: 1, sectorId: 1, balanceDate: localDate(), rainfallMm: 4, et0Mm: 5.2, cropCoefficient: 0.9, rootDepthCm: 40, availableWaterMm: 18, requiredVolumeM3: 14, appliedVolumeM3: 12, deficitMm: 2.1 }], maintenance: [{ id: 1, infrastructureId: 1, maintenanceType: 'FILTER_WASH', scheduledOn: localDate(), status: 'PLANNED', notes: 'Ejemplo ficticio.' }], sensorChecks: [{ id: 1, sectorId: 1, sensorDeviceId: 1, checkedOn: localDate(), calibrationStatus: 'VALID', referenceValue: 30, observedValue: 29.6, technician: 'Demo' }] });
}
export const readIrrigationDemo = () => refreshIrrigation(readDemo<IrrigationData>(irrigationKey, demoIrrigation()));
export function withIrrigation(layer: AnalyticsLayer, sectors: IrrigationSector[]): AnalyticsLayer {
  return { ...layer, features: layer.features.map(feature => {
    const matches = sectors.filter(sector => sector.blockId === feature.properties.blockId);
    return { ...feature, properties: { ...feature.properties, irrigationSectors: matches, soilMoisture: matches.length === 1 ? matches[0].latest?.value : undefined, conditionStatus: matches.length === 1 ? matches[0].condition : matches.length ? 'MULTIPLE_SECTORS' : 'NO_DATA' } };
  }) };
}
