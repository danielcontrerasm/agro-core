import { readDemo } from './demo.ts';
import type { AnalyticsLayer } from './types';

export const fertilizationKey = 'fertilization';
export const nutrientNames = { N: 'Nitrógeno (N)', P: 'Fósforo (P)', K: 'Potasio (K)', PH: 'pH', OM: 'Materia orgánica', CA: 'Calcio (Ca)', MG: 'Magnesio (Mg)', S: 'Azufre (S)', B: 'Boro (B)', ZN: 'Zinc (Zn)' };
export type Nutrient = keyof typeof nutrientNames;
export const units = { PERCENT: '%', MG_KG: 'mg/kg', CMOL_KG: 'cmol(+)/kg', PH: 'pH' };
export const doseUnits = { KG_HA: 'kg/ha', G_PLANT: 'g/planta', L_HA: 'L/ha', ML_PLANT: 'mL/planta' };
export const recurrenceLabels = { NONE: 'Una sola aplicación', WEEKLY: 'Semanal', BIWEEKLY: 'Cada dos semanas', MONTHLY: 'Mensual' } as const;
export type FertilizerRecurrence = keyof typeof recurrenceLabels;
export interface SoilResult { nutrient: Nutrient; value: number; unit: keyof typeof units; method: string }
export interface NutrientReview { decision: 'CONFIRMED' | 'REQUIRES_FOLLOWUP' | 'REJECTED'; notes: string; reviewedBy: number; reviewedAt: string }
export interface Analysis { id: number; blockId: number; sampleType: 'SOIL' | 'FOLIAR'; sampledOn: string; laboratory: string; reference: string; depthCm: number; latitude?: number; longitude?: number; results: SoilResult[]; notes?: string; createdBy: number; hasReport?: boolean; reportData?: string; interpretations?: NutrientInterpretation[]; review?: NutrientReview }
export type NutrientStatus = 'LOW' | 'ADEQUATE' | 'HIGH' | 'UNKNOWN';
export interface NutrientRange { nutrient: Nutrient; unit: keyof typeof units; lower: number; upper: number }
export interface NutrientReferenceProfile { id: number | string; farmId?: number; name: string; crop?: string; variety?: string; cropAliases?: readonly string[]; version: string; sampleType: Analysis['sampleType']; source: string; ranges: readonly NutrientRange[]; active?: boolean }
export interface NutrientInterpretation { nutrient: Nutrient; value: number; unit: keyof typeof units; status: NutrientStatus; label: string; reason: string; profileId?: string | number; profileName?: string; profileVersion?: string; source?: string; requiresTechnicalReview: true }
export interface InterpretationSummary { interpretations: NutrientInterpretation[]; low: number; adequate: number; high: number; unknown: number; attention: number }
export interface Followup { id: number; analysisId?: number; observations: string; reviewedBy: number; reviewedAt: string }
export interface FertilizerProduct { id: number; farmId: number; code: string; name: string; composition: string; defaultDoseUnit: keyof typeof doseUnits; notes?: string; active: boolean; createdBy: number; createdAt: string }
export interface FertilizationTask { taskId: number; occurrenceOn: string }
export interface FertilizationPlan { id: number; blockId: number; analysisId: number; inspectionId?: number; growthStage: string; diagnosis: string; objective: string; product: string; composition: string; dose: number; doseUnit: keyof typeof doseUnits; coverage: number; method: string; scheduledOn: string; scheduledTime: string; assigneeId: number; followUpOn: string; totalQuantity: number; appliedQuantity: number; status: 'DRAFT' | 'APPROVED' | 'CANCELED'; version: number; taskId?: number; productId?: number; recurrence?: FertilizerRecurrence; recurrenceUntil?: string; tasks?: FertilizationTask[]; createdBy: number; approvedBy?: number; approvedAt?: string; decisionReason?: string; followups: Followup[] }
export interface FertilizationApplication { id: number; planId: number; eventId: number; taskId?: number; occurredAt: string; quantity: number; coverage: number; method: string; lot: string; notes?: string; createdBy: number; operationId?: string; inventoryLotId?: number; inventoryMovementId?: number; financialEntryId?: number; costCop?: number }
export interface FertilizationData { analyses: Analysis[]; plans: FertilizationPlan[]; applications: FertilizationApplication[] }
export const quantityUnit = (unit: keyof typeof doseUnits) => unit === 'L_HA' || unit === 'ML_PLANT' ? 'L' : 'kg';
export const coverageUnit = (unit: keyof typeof doseUnits) => unit === 'G_PLANT' || unit === 'ML_PLANT' ? 'plantas' : 'ha';
export const totalQuantity = (dose: number, coverage: number, unit: keyof typeof doseUnits) => Math.round(dose * coverage / (unit === 'G_PLANT' || unit === 'ML_PLANT' ? 1000 : 1) * 1e6) / 1e6;
export const planLabels = { DRAFT: 'Pendiente de aprobación', APPROVED: 'Aprobado', CANCELED: 'Anulado' };
export const nutrientStatusLabels: Record<NutrientStatus, string> = { LOW: 'Bajo', ADEQUATE: 'En rango', HIGH: 'Alto', UNKNOWN: 'Sin interpretar' };
export const nutrientStatusTones: Record<NutrientStatus, string> = { LOW: 'red', ADEQUATE: 'green', HIGH: 'gold', UNKNOWN: 'neutral' };

const provisionalBananaSoilProfile: NutrientReferenceProfile = {
  id: 'banana-soil-baseline', name: 'Banano · suelo · perfil base', version: 'v1 provisional', sampleType: 'SOIL',
  cropAliases: ['banana', 'banano', 'platano', 'plátano'],
  source: 'Perfil base de AgroVision; requiere validación por un agrónomo con el laboratorio y el contexto local.',
  ranges: [
    { nutrient: 'N', unit: 'PERCENT', lower: 0.15, upper: 0.3 },
    { nutrient: 'P', unit: 'MG_KG', lower: 15, upper: 30 },
    { nutrient: 'K', unit: 'CMOL_KG', lower: 0.3, upper: 0.6 },
    { nutrient: 'PH', unit: 'PH', lower: 5.5, upper: 6.5 },
    { nutrient: 'OM', unit: 'PERCENT', lower: 2, upper: 4 },
    { nutrient: 'CA', unit: 'CMOL_KG', lower: 4, upper: 8 },
    { nutrient: 'MG', unit: 'CMOL_KG', lower: 1, upper: 2 },
    { nutrient: 'S', unit: 'MG_KG', lower: 10, upper: 20 },
    { nutrient: 'B', unit: 'MG_KG', lower: 0.3, upper: 0.8 },
    { nutrient: 'ZN', unit: 'MG_KG', lower: 1.5, upper: 3 },
  ],
};

export const nutrientReferenceProfiles: readonly NutrientReferenceProfile[] = [provisionalBananaSoilProfile];

const normalized = (value: string) => value.toLocaleLowerCase('es').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
const profileFor = (crop: string | undefined, sampleType: Analysis['sampleType']) => {
  if (!crop) return undefined;
  const cropName = normalized(crop);
  return nutrientReferenceProfiles.find(profile => profile.sampleType === sampleType && profile.cropAliases?.some(alias => normalized(alias) === cropName));
};

const interpretationLabel = (nutrient: Nutrient, status: NutrientStatus) => {
  if (status === 'UNKNOWN') return nutrientStatusLabels.UNKNOWN;
  if (nutrient === 'PH') return status === 'LOW' ? 'pH ácido' : status === 'HIGH' ? 'pH alcalino' : 'pH en rango';
  return nutrientStatusLabels[status];
};

export function interpretNutrient(result: SoilResult, crop?: string, sampleType: Analysis['sampleType'] = 'SOIL'): NutrientInterpretation {
  const profile = profileFor(crop, sampleType);
  const base = { nutrient: result.nutrient, value: result.value, unit: result.unit, requiresTechnicalReview: true as const };
  if (!result.method.trim()) return { ...base, status: 'UNKNOWN', label: nutrientStatusLabels.UNKNOWN, reason: 'Falta el método de laboratorio.', };
  if (!profile) return { ...base, status: 'UNKNOWN', label: nutrientStatusLabels.UNKNOWN, reason: 'No hay un perfil de referencia compatible con este cultivo y tipo de muestra.' };
  const range = profile.ranges.find(candidate => candidate.nutrient === result.nutrient && candidate.unit === result.unit);
  if (!range) return { ...base, status: 'UNKNOWN', label: nutrientStatusLabels.UNKNOWN, reason: `No hay un rango compatible para ${nutrientNames[result.nutrient]} en ${units[result.unit]}.`, profileId: profile.id, profileName: profile.name, profileVersion: profile.version, source: profile.source };
  const status: NutrientStatus = result.value < range.lower ? 'LOW' : result.value > range.upper ? 'HIGH' : 'ADEQUATE';
  return { ...base, status, label: interpretationLabel(result.nutrient, status), reason: `Rango de referencia: ${range.lower}–${range.upper} ${units[range.unit]}. El resultado debe ser revisado con el método y el contexto del cultivo.`, profileId: profile.id, profileName: profile.name, profileVersion: profile.version, source: profile.source };
}

export function interpretAnalysis(analysis: Analysis, crop?: string, demo = false): InterpretationSummary {
  const recorded = new Map(analysis.interpretations?.map(item => [item.nutrient, item]));
  const interpretations = analysis.results.map((result): NutrientInterpretation => {
    const interpretation = recorded.get(result.nutrient);
    if (interpretation) return interpretation;
    if (demo) return interpretNutrient(result, crop, analysis.sampleType);
    return {
      nutrient: result.nutrient, value: result.value, unit: result.unit,
      status: 'UNKNOWN', label: nutrientStatusLabels.UNKNOWN,
      reason: 'La muestra no tiene una interpretación disponible para este resultado.', requiresTechnicalReview: true,
    };
  });
  return {
    interpretations,
    low: interpretations.filter(item => item.status === 'LOW').length,
    adequate: interpretations.filter(item => item.status === 'ADEQUATE').length,
    high: interpretations.filter(item => item.status === 'HIGH').length,
    unknown: interpretations.filter(item => item.status === 'UNKNOWN').length,
    attention: interpretations.filter(item => item.status === 'LOW' || item.status === 'HIGH').length,
  };
}

export function demoFertilization(): FertilizationData {
  const date = new Date(Date.now() - 86400000 * 7).toISOString().slice(0, 10);
  const analyses: Analysis[] = [1, 2, 3, 4, 5].map((blockId, index) => ({ id: blockId, blockId, sampleType: 'SOIL', sampledOn: date, laboratory: 'Laboratorio de demostración', reference: `DEMO-${blockId}`, depthCm: 20, createdBy: 1, notes: 'Datos ficticios: no usar para dosificación.', results: [
    { nutrient: 'N', value: [0.12, 0.18, 0.09, 0.22, 0.15][index], unit: 'PERCENT', method: 'N total — ejemplo' },
    { nutrient: 'P', value: [12, 24, 8, 36, 18][index], unit: 'MG_KG', method: 'Bray II — ejemplo' },
    { nutrient: 'K', value: [0.18, 0.42, 0.25, 0.61, 0.33][index], unit: 'CMOL_KG', method: 'Acetato de amonio — ejemplo' },
    { nutrient: 'PH', value: [5.2, 5.8, 6.1, 5.5, 6.4][index], unit: 'PH', method: 'Agua 1:1 — ejemplo' },
    { nutrient: 'OM', value: [2.4, 3.8, 1.9, 4.2, 3.1][index], unit: 'PERCENT', method: 'Walkley-Black — ejemplo' },
    { nutrient: 'CA', value: [3.1, 5.2, 4.3, 6.8, 2.9][index], unit: 'CMOL_KG', method: 'Acetato de amonio — ejemplo' },
    { nutrient: 'MG', value: [0.8, 1.2, 0.9, 1.8, 1.4][index], unit: 'CMOL_KG', method: 'Acetato de amonio — ejemplo' },
    { nutrient: 'S', value: [8, 12, 6, 17, 10][index], unit: 'MG_KG', method: 'Ejemplo de laboratorio' },
    { nutrient: 'B', value: [0.2, 0.5, 0.3, 0.8, 0.4][index], unit: 'MG_KG', method: 'Agua caliente — ejemplo' },
    { nutrient: 'ZN', value: [1.1, 2.4, 0.8, 3.2, 1.9][index], unit: 'MG_KG', method: 'DTPA — ejemplo' },
  ] }));
  return { analyses, plans: [], applications: [] };
}
export function latestSoilAnalyses(analyses: Analysis[]) {
  const latest = new Map<number, Analysis>();
  for (const analysis of analyses) {
    if (analysis.sampleType !== 'SOIL') continue;
    const previous = latest.get(analysis.blockId);
    if (!previous || analysis.sampledOn > previous.sampledOn
      || (analysis.sampledOn === previous.sampledOn && analysis.id > previous.id)) {
      latest.set(analysis.blockId, analysis);
    }
  }
  return latest;
}

export function withSoilAnalyses(layer: AnalyticsLayer, analyses: Analysis[]): AnalyticsLayer {
  const latest = latestSoilAnalyses(analyses);
  return { ...layer, features: layer.features.map(feature => {
    const sample = latest.get(feature.properties.blockId);
    return { ...feature, properties: { ...feature.properties, soilAnalysis: sample, nitrogen: undefined, phosphorus: undefined, potassium: undefined, ph: undefined } };
  }) };
}
export const readFertilizationDemo = () => readDemo<FertilizationData>(fertilizationKey, demoFertilization());
