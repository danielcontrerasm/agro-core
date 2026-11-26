import { request } from './api';

export const laboratoryOutcomes = {
  CONFIRMED: 'Confirmado por laboratorio',
  NOT_DETECTED: 'No detectado',
  INCONCLUSIVE: 'No concluyente',
} as const;

export type LaboratoryOutcome = keyof typeof laboratoryOutcomes;

export interface LaboratoryResultInput {
  sampleReference: string;
  laboratory: string;
  sampledOn: string;
  resultOn: string;
  outcome: LaboratoryOutcome;
  notes?: string | null;
  reportReference?: string | null;
}

export interface LaboratoryResult extends LaboratoryResultInput {
  id: number;
  inspectionId: number;
  createdByUserId: number;
  createdByName: string;
  createdAt: string;
}

export const laboratoryResultsApi = {
  list: (inspectionId: number) =>
    request<LaboratoryResult[]>(`/inspections/${inspectionId}/laboratory-results`),
  record: (inspectionId: number, result: LaboratoryResultInput & { requestId: string }) =>
    request<LaboratoryResult>(`/inspections/${inspectionId}/laboratory-results`, 'POST', result),
};
