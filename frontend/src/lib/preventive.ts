import { csvCell, localDate } from './domain.ts';

export type PreventiveCategory = 'MONITORING' | 'SANITATION' | 'CULTURAL' | 'BIOLOGICAL' | 'OTHER';
export type PreventiveAssignmentStatus = 'PLANNED' | 'IN_PROGRESS' | 'COMPLETED';
export type PreventiveEvidenceKind = 'IMAGE' | 'DOCUMENT' | 'VIDEO';

export interface PreventiveMeasureTemplate {
  id: number; farmId: number; code: string; name: string; category: PreventiveCategory;
  instructions: string; active: boolean; createdByUserId: number; creatorName: string; createdAt: string;
}

export interface PreventiveAssignment {
  id: number; farmId: number; templateId: number; templateCode: string; templateName: string;
  category: PreventiveCategory; instructions: string; blockId: number; blockCode: string;
  scheduledFor: string; assignedToUserId?: number | null; assignedToName?: string | null;
  status: PreventiveAssignmentStatus; completionNotes?: string | null; completedAt?: string | null;
  completedByUserId?: number | null; completedByName?: string | null; createdByUserId: number;
  creatorName: string; createdAt: string; updatedAt: string; version: number; evidence?: PreventiveEvidence[];
}

export interface PreventiveEvidence {
  id: number; assignmentId: number; kind: PreventiveEvidenceKind; s3Key: string;
  contentType?: string | null; createdByUserId: number; authorName: string; createdAt: string;
}

export interface PreventiveData { templates: PreventiveMeasureTemplate[]; assignments: PreventiveAssignment[] }

export const preventiveCategoryLabels: Record<PreventiveCategory, string> = {
  MONITORING: 'Monitoreo', SANITATION: 'Sanidad', CULTURAL: 'Cultural', BIOLOGICAL: 'Biológico', OTHER: 'Otro',
};
export const preventiveStatusLabels: Record<PreventiveAssignmentStatus, string> = {
  PLANNED: 'Programada', IN_PROGRESS: 'En curso', COMPLETED: 'Completada',
};

export const preventiveDemoKey = 'preventive';

export function preventiveCsv(assignments: PreventiveAssignment[]) {
  const rows = [['ID', 'Medida', 'Categoría', 'Bloque', 'Fecha programada', 'Responsable', 'Estado', 'Notas de cierre', 'Evidencia'],
    ...assignments.map(assignment => [assignment.id, assignment.templateName, preventiveCategoryLabels[assignment.category], assignment.blockCode,
      assignment.scheduledFor, assignment.assignedToName ?? '', preventiveStatusLabels[assignment.status], assignment.completionNotes ?? '',
      (assignment.evidence ?? []).map(item => item.s3Key).join('; ')])];
  return '\uFEFF' + rows.map(row => row.map(csvCell).join(',')).join('\r\n');
}

export function demoPreventiveData(): PreventiveData {
  const today = new Date();
  const yesterday = new Date(today.getTime() - 86400000);
  return {
    templates: [
      { id: 1, farmId: 1, code: 'monitoreo-semanal', name: 'Monitoreo semanal de hojas', category: 'MONITORING', instructions: 'Revisa diez plantas por surco y registra cualquier síntoma, plaga o cambio de vigor.', active: true, createdByUserId: 1, creatorName: 'Daniel Contreras', createdAt: yesterday.toISOString() },
      { id: 2, farmId: 1, code: 'saneamiento', name: 'Retiro de material afectado', category: 'SANITATION', instructions: 'Retira el material afectado, limpia las herramientas y registra el área intervenida.', active: true, createdByUserId: 1, creatorName: 'Daniel Contreras', createdAt: yesterday.toISOString() },
    ],
    assignments: [
      { id: 1, farmId: 1, templateId: 1, templateCode: 'monitoreo-semanal', templateName: 'Monitoreo semanal de hojas', category: 'MONITORING', instructions: 'Revisa diez plantas por surco y registra cualquier síntoma, plaga o cambio de vigor.', blockId: 2, blockCode: 'Bloque B', scheduledFor: localDate(today), assignedToUserId: 1, assignedToName: 'Daniel Contreras', status: 'PLANNED', completionNotes: null, completedAt: null, completedByUserId: null, completedByName: null, createdByUserId: 1, creatorName: 'Daniel Contreras', createdAt: yesterday.toISOString(), updatedAt: yesterday.toISOString(), version: 0, evidence: [] },
      { id: 2, farmId: 1, templateId: 2, templateCode: 'saneamiento', templateName: 'Retiro de material afectado', category: 'SANITATION', instructions: 'Retira el material afectado, limpia las herramientas y registra el área intervenida.', blockId: 4, blockCode: 'Bloque D', scheduledFor: localDate(yesterday), assignedToUserId: 2, assignedToName: 'María Rodríguez', status: 'COMPLETED', completionNotes: 'Material retirado y herramientas desinfectadas.', completedAt: yesterday.toISOString(), completedByUserId: 2, completedByName: 'María Rodríguez', createdByUserId: 1, creatorName: 'Daniel Contreras', createdAt: yesterday.toISOString(), updatedAt: yesterday.toISOString(), version: 1, evidence: [{ id: 1, assignmentId: 2, kind: 'IMAGE', s3Key: 'preventive/saneamiento-bloque-d.jpg', contentType: 'image/jpeg', createdByUserId: 2, authorName: 'María Rodríguez', createdAt: yesterday.toISOString() }] },
    ],
  };
}
