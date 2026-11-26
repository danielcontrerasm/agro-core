import type { AnalyticsLayer } from './types.ts';
import { csvCell } from './domain.ts';
import type { TreatmentFollowup } from './treatment-followups.ts';

export interface SanitaryProblem { code: string; name: string; category: 'DISEASE' | 'PEST'; active: boolean }
export type AssessmentStatus = 'SUSPECTED' | 'CONFIRMED' | 'DISCARDED';
export type HealthStatus = 'NO_RECENT_INSPECTION' | 'ACTIVE_FINDINGS' | 'NO_ACTIVE_FINDINGS';
export interface Inspection {
  id: number; farmId: number; blockId: number; rowId?: number | null;
  problemCode: string; problemName: string; inspectedAt: string;
  inspectedPlants: number; affectedPlants: number; affectedAreaHa?: number | null; incidencePercent: number;
  symptoms: string; severityPercent: number; severityMethod: string;
  assessmentStatus: AssessmentStatus; resolved: boolean; nextVisit: string;
  createdByUserId: number; inspectorName: string; reviewedByUserId?: number | null;
  reviewNotes?: string | null; reviewedAt?: string | null; version: number;
  canceledAt?: string | null; canceledByUserId?: number | null; cancellationReason?: string | null;
  parentInspectionId?: number | null;
  treatments?: InspectionTreatment[]; evidence?: InspectionEvidence[]; treatmentFollowups?: TreatmentFollowup[];
}
export interface InspectionTreatment { id: number; inspectionId: number; occurredAt: string; description: string; product?: string | null; quantity?: number | null; unit?: string | null; createdByUserId: number; authorName: string }
export interface InspectionEvidence { id: number; inspectionId: number; treatmentId?: number | null; kind: 'IMAGE' | 'DOCUMENT' | 'VIDEO'; s3Key: string; contentType?: string | null; createdByUserId: number; authorName: string; createdAt: string }
export type NewTreatment = Pick<InspectionTreatment, 'occurredAt' | 'description' | 'product' | 'quantity' | 'unit'>;
export type NewEvidence = Pick<InspectionEvidence, 'treatmentId' | 'kind' | 's3Key' | 'contentType'>;
export type NewInspection = Pick<Inspection, 'blockId' | 'rowId' | 'problemCode' | 'inspectedAt' | 'inspectedPlants' | 'affectedPlants' | 'affectedAreaHa' | 'symptoms' | 'severityPercent' | 'severityMethod' | 'nextVisit' | 'parentInspectionId'>;
export type InspectionReview = Pick<Inspection, 'assessmentStatus' | 'resolved' | 'reviewNotes' | 'version'>;
export const sanitaryProblems: SanitaryProblem[] = [
  { code: 'SIGATOKA', name: 'Sigatoka negra', category: 'DISEASE', active: true },
  { code: 'MOKO', name: 'Moko', category: 'DISEASE', active: true },
  { code: 'FUSARIUM', name: 'Marchitez por Fusarium', category: 'DISEASE', active: true },
  { code: 'BACTERIOSIS', name: 'Bacteriosis del pseudotallo', category: 'DISEASE', active: true },
  { code: 'WEEVILS', name: 'Picudos', category: 'PEST', active: true },
  { code: 'NEMATODES', name: 'Nematodos', category: 'PEST', active: true },
];
export const sanitaryProblemsKey = 'sanitary-problems';
export function readSanitaryProblemsDemo(): SanitaryProblem[] { return (JSON.parse(JSON.stringify(sanitaryProblems)) as SanitaryProblem[]); }
export function saveSanitaryProblemsDemo(value: SanitaryProblem[]) {
  try { localStorage.setItem(`agrovision.${sanitaryProblemsKey}.v1`, JSON.stringify(value)); return true; }
  catch { return false; }
}
export function loadSanitaryProblemsDemo(): SanitaryProblem[] {
  try {
    const saved = localStorage.getItem(`agrovision.${sanitaryProblemsKey}.v1`);
    return saved ? JSON.parse(saved) as SanitaryProblem[] : readSanitaryProblemsDemo();
  } catch { return readSanitaryProblemsDemo(); }
}
export const assessmentLabels: Record<AssessmentStatus, string> = { SUSPECTED: 'Sospechosa', CONFIRMED: 'Confirmada', DISCARDED: 'Descartada' };
export const healthLabels: Record<HealthStatus, string> = { NO_RECENT_INSPECTION: 'Sin evaluación reciente', ACTIVE_FINDINGS: 'Hallazgos activos', NO_ACTIVE_FINDINGS: 'Sin hallazgos activos recientes' };
export function incidence(inspected: number, affected: number) {
  if (!Number.isInteger(inspected) || inspected < 1 || !Number.isInteger(affected) || affected < 0 || affected > inspected) throw new Error('Las plantas afectadas deben estar entre cero y el total inspeccionado.');
  return affected / inspected * 100;
}
export function inspectionHealth(records: Inspection[], blockId: number, today = new Date().toISOString().slice(0, 10)): HealthStatus {
  const latest = new Map<string, Inspection>();
  records.filter(record => record.blockId === blockId && !record.canceledAt).sort((first, second) => second.inspectedAt.localeCompare(first.inspectedAt) || second.id - first.id).forEach(record => {
    const key = `${record.problemCode}:${record.rowId ?? ''}`;
    if (!latest.has(key)) latest.set(key, record);
  });
  const cutoff = Date.parse(`${today}T00:00:00Z`) - 30 * 86400000;
  const recent = [...latest.values()].filter(record => Date.parse(record.inspectedAt) >= cutoff && record.nextVisit >= today);
  if (!recent.length) return 'NO_RECENT_INSPECTION';
  if (recent.some(record => !record.resolved && record.assessmentStatus !== 'DISCARDED' && record.affectedPlants > 0)) return 'ACTIVE_FINDINGS';
  if ([...latest.values()].some(record => !record.resolved && record.assessmentStatus !== 'DISCARDED' && record.affectedPlants > 0 && !recent.includes(record))) return 'NO_RECENT_INSPECTION';
  return 'NO_ACTIVE_FINDINGS';
}
export function withInspectionHealth(layer: AnalyticsLayer, records: Inspection[]): AnalyticsLayer {
  return { ...layer, features: layer.features.map(feature => ({ ...feature, properties: { ...feature.properties, healthStatus: inspectionHealth(records, feature.properties.blockId) } })) };
}
export const inspectionDemoKey = 'inspections';

export function inspectionCsv(records: Inspection[], blockName: (id: number) => string, rowName: (id: number) => string) {
  const rows = [['ID', 'Fecha UTC', 'Bloque', 'Surco', 'Problema', 'Inspeccionadas', 'Afectadas', 'Área afectada (ha)', 'Incidencia (%)', 'Severidad (%)', 'Método', 'Síntomas', 'Responsable', 'Evaluación', 'Resuelta', 'Próxima visita', 'Inspección origen', 'Anulada UTC', 'Motivo de anulación'],
    ...records.map(record => [record.id, record.inspectedAt, blockName(record.blockId), record.rowId ? rowName(record.rowId) : '', record.problemName, record.inspectedPlants, record.affectedPlants, record.affectedAreaHa ?? '', record.incidencePercent, record.severityPercent, record.severityMethod, record.symptoms, record.inspectorName, assessmentLabels[record.assessmentStatus], record.resolved ? 'Sí' : 'No', record.nextVisit, record.parentInspectionId, record.canceledAt, record.cancellationReason])];
  return '\uFEFF' + rows.map(row => row.map(csvCell).join(',')).join('\r\n');
}
export function demoInspections(): Inspection[] {
  const now = new Date();
  return [1, 2, 3, 4].map((blockId, index) => ({
    id: blockId, farmId: 1, blockId, problemCode: sanitaryProblems[index].code, problemName: sanitaryProblems[index].name,
    inspectedAt: new Date(now.getTime() - (index === 2 ? 45 : 1) * 86400000).toISOString(),
    inspectedPlants: 20, affectedPlants: [4, 2, 1, 0][index], affectedAreaHa: [2.4, 1.1, .6, 0][index], incidencePercent: [20, 10, 5, 0][index],
    symptoms: ['Manchas foliares observadas', 'Marchitez pendiente de revisión', 'Observación antigua', 'Sin síntomas en la muestra'][index],
    severityPercent: [15, 10, 5, 0][index], severityMethod: 'Estimación visual del porcentaje de tejido afectado',
    assessmentStatus: index === 1 ? 'DISCARDED' : 'SUSPECTED', resolved: index === 1,
    nextVisit: new Date(now.getTime() + 7 * 86400000).toISOString().slice(0, 10),
    createdByUserId: 1, inspectorName: 'Daniel Contreras', version: 0,
    reviewNotes: index === 1 ? 'Sospecha descartada en la revisión de demostración.' : null,
  }));
}
