import { request } from './api';
import type { FieldEvent } from './types';

export interface LegacyObservationValues {
  notes: string | null;
  symptoms: string | null;
  severity: number | null;
  problemCode: string | null;
}

export interface LegacyObservationRevision {
  version: number;
  editedAt: string;
  editedByUserId: number;
  editorName: string;
  reason: string;
  before: LegacyObservationValues;
  after: LegacyObservationValues;
}

export interface LegacyObservation extends LegacyObservationValues {
  id: number;
  version: number;
  suspectedCatalogId: number | null;
  history: LegacyObservationRevision[];
}

type Edit = LegacyObservationValues & { version: number; reason: string };
const path = (id: number) => `/events/${id}/legacy-observation`;

export const legacyObservationApi = {
  read: (id: number) => request<LegacyObservation>(path(id)),
  edit: (id: number, edit: Edit) => request<LegacyObservation>(path(id), 'PATCH', edit),
};

export function demoLegacyObservation(event: FieldEvent): LegacyObservation {
  return event.legacyObservation ?? {
    id: event.id, version: 0, notes: event.notes ?? null, history: [], problemCode: null,
    symptoms: event.observation?.symptoms || null, severity: event.observation?.severity ?? null,
    suspectedCatalogId: event.observation?.suspectedCatalogId ?? null,
  };
}
