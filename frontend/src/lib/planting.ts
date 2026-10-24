import { localDate } from './domain';

export type PlantingData = {
  cycles: Cycle[]; materialLots: MaterialLot[]; plans: PlantingPlan[]; executions: PlantingExecution[];
};
export type Cycle = { id: number; blockId: number; rowId?: number; cropId?: number; varietyId?: number; code: string; crop: string; variety?: string; status: string; currentStage: string; plannedPlantingFrom: string; plannedPlantingTo: string; plantedOn?: string; expectedHarvestOn?: string; notes?: string; version: number; siteAssessment?: SiteAssessment | null; stageHistory?: StageHistory[]; establishmentChecks?: EstablishmentCheck[] };
export type SiteAssessment = { id: number; status: string; version: number; previous_use?: string; neighboring_uses?: string; soil_analysis_id?: number; slope?: string; drainage?: string; flooding_risk?: string; wind_risk?: string; contamination_risk?: string; phytosanitary_risk?: string; environmental_restrictions?: string; evidence_notes?: string; decision_reason?: string };
export type StageHistory = { id: number; stage: string; observedOn?: string; observed_on?: string; notes?: string };
export type MaterialLot = { id: number; farmId: number; cycleId?: number; cropId?: number; varietyId?: number; materialType: string; crop: string; variety: string; supplier: string; sourceReference?: string; certificationReference?: string; quantityReceived: number; quantityAccepted?: number; quantityRejected?: number; status: string; version: number; healthInspection: string; decisionReason?: string };
export type PlantingPlan = { id: number; cycleId: number; materialLotId: number; plannedAreaHa: number; plantingSystem: string; rowSpacingM?: number; plantSpacingM?: number; targetDensityHa: number; targetPlants: number; windowFrom: string; windowTo: string; responsibleId: number; technicalBasis?: string; status: string; taskId?: number | string; version: number };
export type PlantingExecution = { id: number; planId: number; eventId: number; executedOn: string; areaHa: number; plantsPlanted: number; plantsRejected: number; locationDetails?: string; operatorNotes?: string };
export type EstablishmentCheck = { id: number; checkedOn: string; plantsChecked: number; survivingPlants: number; deadPlants: number; replacedPlants: number; uniformity?: string; causes?: string; notes?: string };

export const plantingKey = 'planting-v2';
export const demoPlanting = (): PlantingData => ({
  cycles: [
    { id: 2, blockId: 1, code: 'CICLO-2026-2', crop: 'Banano', variety: 'Cavendish', status: 'DRAFT', currentStage: 'PLANNED', plannedPlantingFrom: localDate(), plannedPlantingTo: localDate(), expectedHarvestOn: '2027-01-15', version: 1 },
    { id: 1, blockId: 1, code: 'CICLO-2026-01', crop: 'Banano', variety: 'Cavendish', status: 'ESTABLISHING', currentStage: 'ESTABLISHMENT', plannedPlantingFrom: localDate(), plannedPlantingTo: localDate(), plantedOn: localDate(), expectedHarvestOn: '2027-01-15', version: 2, siteAssessment: { id: 1, status: 'APPROVED', version: 1, previous_use: 'Banano renovado', drainage: 'Canales funcionales', flooding_risk: 'Bajo' }, establishmentChecks: [{ id: 1, checkedOn: localDate(), plantsChecked: 1200, survivingPlants: 1168, deadPlants: 32, replacedPlants: 24, uniformity: 'Uniforme' }] },
  ],
  materialLots: [
    { id: 1, farmId: 1, cycleId: 1, materialType: 'IN_VITRO', crop: 'Banano', variety: 'Cavendish', supplier: 'Vivero certificado', sourceReference: 'REM-2026-001', certificationReference: 'ICA-SEM-001', quantityReceived: 1250, quantityAccepted: 1220, quantityRejected: 30, status: 'ACCEPTED', version: 1, healthInspection: 'Sin síntomas visibles; documentación revisada.', decisionReason: 'Lote conforme para establecimiento.' },
    { id: 2, farmId: 1, cycleId: 1, materialType: 'IN_VITRO', crop: 'Banano', variety: 'Cavendish', supplier: 'Vivero certificado', sourceReference: 'REM-2026-002', certificationReference: 'ICA-SEM-002', quantityReceived: 900, quantityAccepted: 900, quantityRejected: 0, status: 'ACCEPTED', version: 1, healthInspection: 'Material recibido en condiciones adecuadas.', decisionReason: 'Lote conforme para establecimiento.' },
    { id: 3, farmId: 1, cycleId: 1, materialType: 'COLINO', crop: 'Banano', variety: 'Cavendish', supplier: 'Vivero regional', sourceReference: 'REM-2026-003', certificationReference: 'ICA-SEM-003', quantityReceived: 450, quantityAccepted: 450, quantityRejected: 0, status: 'ACCEPTED', version: 1, healthInspection: 'Inspección visual sin novedades.', decisionReason: 'Lote conforme para establecimiento.' },
  ],
  plans: [
    { id: 1, cycleId: 1, materialLotId: 1, plannedAreaHa: 2.4, plantingSystem: 'Rectangular configurable', rowSpacingM: 3, plantSpacingM: 0.8, targetDensityHa: 500, targetPlants: 1200, windowFrom: localDate(), windowTo: localDate(), responsibleId: 1, technicalBasis: 'Densidad definida por protocolo del cultivo y área del bloque.', status: 'APPROVED', taskId: 'task-planting-demo', version: 2 },
    { id: 2, cycleId: 1, materialLotId: 2, plannedAreaHa: 28, plantingSystem: 'Rectangular configurable', rowSpacingM: 3, plantSpacingM: 0.8, targetDensityHa: 500, targetPlants: 14000, windowFrom: localDate(), windowTo: localDate(), responsibleId: 1, technicalBasis: 'Plan complementario para completar el área disponible del bloque.', status: 'DRAFT', version: 1 },
  ],
  executions: [{ id: 1, planId: 1, eventId: 10, executedOn: localDate(), areaHa: 2.4, plantsPlanted: 1200, plantsRejected: 30, locationDetails: 'Bloque A · sectores 1–4', operatorNotes: 'Establecimiento ejecutado sin novedades.' }],
});

export function readPlantingDemo(): PlantingData {
  try { const saved = localStorage.getItem(`agrovision.${plantingKey}.v1`); return saved ? JSON.parse(saved) : demoPlanting(); } catch { return demoPlanting(); }
}
