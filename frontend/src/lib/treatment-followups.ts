import { request } from './api';

export const treatmentOutcomes = {
  EFFECTIVE: 'Eficaz',
  PARTIAL: 'Parcialmente eficaz',
  INEFFECTIVE: 'Sin efecto observado',
} as const;

export type TreatmentOutcome = keyof typeof treatmentOutcomes;
export type TreatmentStatus = 'AUTHORIZED' | 'EXECUTED' | 'VERIFIED';

export interface TreatmentFollowup {
  id: number;
  inspectionId: number;
  status: TreatmentStatus;
  description: string;
  product?: string | null;
  inventoryProductId?: number | null;
  authorizedByUserId: number;
  authorizedByName: string;
  authorizedAt: string;
  treatmentId?: number | null;
  executedByUserId?: number | null;
  executedByName?: string | null;
  executedAt?: string | null;
  productLot?: string | null;
  appliedProduct?: string | null;
  quantity?: number | null;
  unit?: string | null;
  inventoryLotId?: number | null;
  inventoryMovementId?: number | null;
  verifiedByUserId?: number | null;
  verifiedByName?: string | null;
  verifiedAt?: string | null;
  outcome?: TreatmentOutcome | null;
  verificationNotes?: string | null;
  version: number;
}

type Authorization = Pick<TreatmentFollowup, 'description' | 'product' | 'inventoryProductId'> & { requestId: string };
interface Execution { version: number; occurredAt: string; inventoryLotId?: number; quantity?: number; operationId: string }
interface Verification { version: number; verifiedAt: string; outcome: TreatmentOutcome; notes: string }

const path = (inspectionId: number) => `/inspections/${inspectionId}/treatment-followups`;

export const treatmentFollowupApi = {
  list: (inspectionId: number) => request<TreatmentFollowup[]>(path(inspectionId)),
  authorize: (inspectionId: number, payload: Authorization) =>
    request<TreatmentFollowup>(path(inspectionId), 'POST', payload),
  execute: (inspectionId: number, id: number, payload: Execution) =>
    request<TreatmentFollowup>(`${path(inspectionId)}/${id}/execute`, 'POST', payload),
  verify: (inspectionId: number, id: number, payload: Verification) =>
    request<TreatmentFollowup>(`${path(inspectionId)}/${id}/verify`, 'POST', payload),
};
