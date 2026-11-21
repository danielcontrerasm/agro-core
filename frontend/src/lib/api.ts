import type { Profile, Farm, Field, Block, Row, FieldEvent, Member, DiseaseLayer, AnalyticsLayer, DashboardAnalytics, Task } from './types';
import type { Inspection, NewInspection, InspectionReview, SanitaryProblem, InspectionTreatment, InspectionEvidence, NewTreatment, NewEvidence } from './inspections';
import { photoQuery } from './photos';
import type { Photo, PhotoTarget } from './photos';
import type { CropCatalog, CropVariety } from './catalog';
import type { CalendarRule, CalendarSuggestion, CalendarRequest } from './calendar';
import type { PreventiveMeasureTemplate, PreventiveAssignment, PreventiveEvidence, PreventiveAssignmentStatus } from './preventive';
import type { ProductionRecord } from './production';
import type { WaterUsageReport } from './analytics';

export class ApiError extends Error {
  constructor(message: string, public status: number) { super(message); }
}

let csrf: { token: string; headerName: string } | undefined;

async function token() {
  const response = await fetch('/api/v1/auth/csrf', { credentials: 'include' });
  if (!response.ok) throw new ApiError('No se pudo preparar una sesión segura. Revisa la conexión al servidor.', response.status);
  csrf = await response.json();
  return csrf!;
}

async function request<T>(path: string, method = 'GET', payload?: unknown, retry = true): Promise<T> {
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (payload !== undefined && !(payload instanceof FormData)) headers['Content-Type'] = 'application/json';
  if (method !== 'GET') { const protection = csrf ?? await token(); headers[protection.headerName] = protection.token; }
  let response: Response;
  try {
    response = await fetch(`/api/v1${path}`, { method, credentials: 'include', headers, body: payload === undefined ? undefined : payload instanceof FormData ? payload : JSON.stringify(payload) });
  } catch { throw new ApiError('No hay conexión con el servidor. Tus cambios no se han guardado.', 0); }
  if (response.status === 403 && method !== 'GET' && retry) {
    await token();
    return request<T>(path, method, payload, false);
  }
  if (!response.ok) {
    const detail = await response.json().catch(() => ({}));
    const fallback: Record<number, string> = {
      400: 'Revisa los datos del formulario.', 401: 'La sesión expiró o las credenciales no son correctas.',
      403: 'No tienes permisos para realizar esta acción.', 404: 'No se encontró el recurso solicitado.',
      409: 'Ya existe un registro con estos datos.',
    };
    throw new ApiError(detail.detail || detail.message || fallback[response.status] || 'El servidor no pudo completar la solicitud.', response.status);
  }
  if (response.status === 204 || response.headers.get('content-length') === '0') return undefined as T;
  const text = await response.text();
  return text ? JSON.parse(text) as T : undefined as T;
}

export const api = {
  irrigation: (farmId: number) => request<import('./irrigation').IrrigationData>(`/irrigation?farmId=${farmId}`),
  irrigationAction: <T,>(path: string, payload?: unknown) => request<T>(`/irrigation/${path}`, 'POST', payload),
  irrigationUpdate: <T,>(path: string, payload: unknown) => request<T>(`/irrigation/${path}`, 'PATCH', payload),
  fertilization: (farmId: number) => request<import('./fertilization').FertilizationData>(`/fertilization?farmId=${farmId}`),
  fertilizerAction: <T,>(path: string, payload?: unknown) => request<T>(`/fertilization/${path}`, 'POST', payload),
  nutrientProfiles: (farmId: number) => request<import('./fertilization').NutrientReferenceProfile[]>(`/fertilization/profiles?farmId=${farmId}`),
  fertilizerProducts: (farmId: number) => request<import('./fertilization').FertilizerProduct[]>(`/fertilization/products?farmId=${farmId}`),
  planting: (farmId: number) => request<import('./planting').PlantingData>(`/planting?farmId=${farmId}`),
  productionRecords: (farmId: number, params = '') => request<ProductionRecord[]>(`/monitoring-records?farmId=${farmId}&recordType=HARVEST${params}`),
  createProductionRecord: (payload: unknown) => request<ProductionRecord>('/monitoring-records', 'POST', payload),
  updateProductionRecord: (id: number, payload: unknown) => request<ProductionRecord>(`/monitoring-records/${id}`, 'PATCH', payload),
  plantingAction: <T,>(path: string, payload?: unknown) => request<T>(`/planting/${path}`, 'POST', payload),
  photos: (target: PhotoTarget) => request<Photo[]>(`/photos?${photoQuery(target)}`),
  uploadPhoto: (target: PhotoTarget, blob: Blob, name: string) => {
    const form = new FormData(); form.append('file', blob, name);
    return request<Photo>(`/photos?${photoQuery(target)}`, 'POST', form);
  },
  sanitaryProblems: (farmId: number, includeInactive = false) => request<SanitaryProblem[]>(`/phytosanitary-problems?farmId=${farmId}${includeInactive ? '&includeInactive=true' : ''}`),
  createSanitaryProblem: (payload: unknown) => request<SanitaryProblem>('/phytosanitary-problems', 'POST', payload),
  updateSanitaryProblem: (code: string, payload: unknown) => request<SanitaryProblem>(`/phytosanitary-problems/${encodeURIComponent(code)}`, 'PATCH', payload),
  inspections: (farmId: number) => request<Inspection[]>(`/inspections?farmId=${farmId}`),
  createInspection: (payload: NewInspection) => request<Inspection>('/inspections', 'POST', payload),
  reviewInspection: (id: number, payload: InspectionReview) => request<Inspection>(`/inspections/${id}`, 'PATCH', payload),
  cancelInspection: (id: number, reason: string, version: number) => request<Inspection>(`/inspections/${id}/cancel`, 'POST', { reason, version }),
  inspectionTreatments: (id: number) => request<InspectionTreatment[]>(`/inspections/${id}/treatments`),
  addInspectionTreatment: (id: number, payload: NewTreatment) => request<InspectionTreatment>(`/inspections/${id}/treatments`, 'POST', payload),
  inspectionEvidence: (id: number) => request<InspectionEvidence[]>(`/inspections/${id}/evidence`),
  addInspectionEvidence: (id: number, payload: NewEvidence) => request<InspectionEvidence>(`/inspections/${id}/evidence`, 'POST', payload),
  preventiveMeasures: (farmId: number) => request<PreventiveMeasureTemplate[]>(`/preventive-measures?farmId=${farmId}`),
  createPreventiveMeasure: (payload: unknown) => request<PreventiveMeasureTemplate>('/preventive-measures', 'POST', payload),
  preventiveAssignments: (farmId: number, status?: PreventiveAssignmentStatus) => request<PreventiveAssignment[]>(`/preventive-assignments?farmId=${farmId}${status ? `&status=${status}` : ''}`),
  createPreventiveAssignment: (payload: unknown) => request<PreventiveAssignment>('/preventive-assignments', 'POST', payload),
  updatePreventiveAssignment: (id: number, payload: unknown) => request<PreventiveAssignment>(`/preventive-assignments/${id}`, 'PATCH', payload),
  preventiveEvidence: (id: number) => request<PreventiveEvidence[]>(`/preventive-assignments/${id}/evidence`),
  addPreventiveEvidence: (id: number, payload: unknown) => request<PreventiveEvidence>(`/preventive-assignments/${id}/evidence`, 'POST', payload),
  me: () => request<Profile>('/auth/me'),
  login: async (email: string, password: string) => { const profile = await request<Profile>('/auth/login', 'POST', { email, password }); csrf = undefined; return profile; },
  register: (name: string, email: string, password: string) => request('/auth/register', 'POST', { name, email, password }),
  logout: async () => { await request('/auth/logout', 'POST'); csrf = undefined; },
  farms: () => request<Farm[]>('/farms'), fields: () => request<Field[]>('/fields'),
  blocks: () => request<Block[]>('/blocks'), rows: () => request<Row[]>('/rows'),
  cropCatalog: (farmId: number) => request<CropCatalog[]>(`/catalog/crops?farmId=${farmId}`),
  createCrop: (payload: unknown) => request<CropCatalog>('/catalog/crops', 'POST', payload),
  createVariety: (cropId: number, payload: unknown) => request<CropVariety>(`/catalog/crops/${cropId}/varieties`, 'POST', payload),
  plantingCalendars: (farmId: number) => request<CalendarRule[]>(`/planting-calendars?farmId=${farmId}`),
  plantingCalendarSuggestions: (farmId: number, cropId: number, varietyId?: number) => request<CalendarSuggestion[]>(`/planting-calendars/suggestions?farmId=${farmId}&cropId=${cropId}${varietyId ? `&varietyId=${varietyId}` : ''}`),
  createPlantingCalendar: (payload: CalendarRequest) => request<CalendarRule>('/planting-calendars', 'POST', payload),
  updatePlantingCalendar: (id: number, payload: CalendarRequest) => request<CalendarRule>(`/planting-calendars/${id}`, 'PUT', payload),
  deactivatePlantingCalendar: (id: number) => request<void>(`/planting-calendars/${id}`, 'DELETE'),
  events: () => request<FieldEvent[]>('/events'),
  tasks: () => request<Task[]>('/tasks'),
  updateTask: (task: Task, status: Task['status'], notes: string) => request<Task>(`/tasks/${task.id}`, 'PATCH', { status, notes, version: task.version }),
  create: <T,>(resource: string, payload: unknown) => request<T>(`/${resource}`, 'POST', payload),
  remove: (resource: string, id: number) => request(`/${resource}/${id}`, 'DELETE'),
  members: (farmId: number) => request<Member[]>(`/farms/${farmId}/members`),
  assign: (farmId: number, email: string, role: string) => request<Member>(`/farms/${farmId}/members`, 'PUT', { email, role }),
  disease: (farmId: number) => request<DiseaseLayer>(`/map/rows/disease?farmId=${farmId}`),
  analyticsMap: (farmId: number, layer = 'conditions') => request<AnalyticsLayer>(`/analytics/map?farmId=${farmId}&layer=${layer}`),
  dashboardAnalytics: (farmId: number) => request<DashboardAnalytics>(`/analytics/dashboard?farmId=${farmId}`),
  waterUsageAnalytics: (farmId: number, from: string, until: string) => request<WaterUsageReport>(`/analytics/water-usage?farmId=${farmId}&from=${encodeURIComponent(from)}&until=${encodeURIComponent(until)}`),
  sensorDevices: (farmId: number) => request('/sensors?farmId=' + farmId),
  alerts: (farmId: number, status = 'OPEN') => request('/alerts?farmId=' + farmId + '&status=' + status),
  media: (eventId: number) => request<{ id: number; kind: string; s3Key: string; contentType?: string }[]>(`/media?eventId=${eventId}`),
};
