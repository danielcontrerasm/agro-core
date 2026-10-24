import { localDate } from './domain.ts';
import type { AnalyticsLayer, Block, DashboardAnalytics, FarmData, Profile, Task } from './types';

export const demoProfile: Profile = {
  user: { id: 1, name: 'Daniel Contreras', email: 'daniel@agrovision.demo' },
  memberships: [{ farmId: 1, farmName: 'Finca El Paraíso', role: 'ADMIN' }],
};

const farm = { id: 1, name: 'Finca El Paraíso', country: 'Colombia', region: 'Zona Bananera, Magdalena' };
const fields = [
  { id: 1, name: 'Campo Norte', farm, areaHa: 53 },
  { id: 2, name: 'Campo Central', farm, areaHa: 50 },
  { id: 3, name: 'Campo del Río', farm, areaHa: 18 },
];
const blocks: Block[] = [
  { id: 1, code: 'Bloque A', field: fields[0], crop: 'banana', variety: 'Cavendish', areaHa: 28 },
  { id: 2, code: 'Bloque B', field: fields[0], crop: 'banana', variety: 'Cavendish', areaHa: 25 },
  { id: 3, code: 'Bloque C', field: fields[1], crop: 'banana', variety: 'Cavendish', areaHa: 32 },
  { id: 4, code: 'Bloque D', field: fields[1], crop: 'banana', variety: 'Cavendish', areaHa: 18 },
  { id: 5, code: 'Bloque E', field: fields[2], crop: 'banana', variety: 'Cavendish', areaHa: 18 },
];
const rows = blocks.flatMap((block, blockIndex) => Array.from({ length: [76, 68, 86, 49, 49][blockIndex] }, (_, index) => ({
  id: blockIndex * 100 + index + 1, rowCode: `R-${String(blockIndex * 100 + index + 1).padStart(3, '0')}`,
  block, lengthM: 294, plantSpacingM: 2, plantsEstimated: blockIndex === 4 && index === 48 ? 161 : 147,
})));

export const demoData: FarmData = {
  farms: [farm], fields, blocks, rows,
  events: [
    { id: 1, eventType: 'SCOUTING_OBSERVATION', occurredAt: new Date(Date.now() - 7200000).toISOString(), notes: 'Seguimiento de síntomas foliares en el sector norte.', block: blocks[1], row: rows[88], createdByUserId: 1 },
    { id: 2, eventType: 'IRRIGATION_EVENT', occurredAt: new Date(Date.now() - 18000000).toISOString(), notes: 'Riego del sector 1 finalizado. Sin novedades.', block: blocks[0], createdByUserId: 2 },
    { id: 3, eventType: 'FERTILIZER_APPLICATION', occurredAt: new Date(Date.now() - 86400000).toISOString(), notes: 'Aplicación realizada según el plan aprobado.', block: blocks[2], createdByUserId: 3 },
    { id: 4, eventType: 'SOIL_SAMPLE', occurredAt: new Date(Date.now() - 100000000).toISOString(), notes: 'Muestra S-045 enviada a laboratorio.', block: blocks[3], createdByUserId: 1 },
    { id: 5, eventType: 'HARVEST_EVENT', occurredAt: new Date(Date.now() - 172800000).toISOString(), notes: 'Jornada de cosecha completada en el sector sur.', block: blocks[4], createdByUserId: 2 },
  ],
};

export const demoAnalytics: AnalyticsLayer = {
  type: 'FeatureCollection',
  features: blocks.map((block, index) => ({
    type: 'Feature', geometry: { type: 'Polygon', coordinates: [] },
    properties: {
      blockId: block.id, blockCode: block.code, crop: block.crop, areaHa: block.areaHa,
      soilMoisture: [28, 18, 25, 12, 23][index], airHumidity: [78, 71, 82, 66, 75][index],
      airTemperature: [24, 25, 23, 27, 24][index], soilTemperature: [22, 23, 21, 25, 22][index],
      nitrogen: [32, 21, 38, 14, 29][index], phosphorus: [18, 12, 24, 9, 16][index], potassium: [210, 165, 240, 120, 198][index], ph: [6.4, 5.8, 6.8, 5.2, 6.1][index],
      growthStage: ['Vegetativo', 'Floración', 'Llenado', 'Estrés hídrico', 'Cosecha'][index],
      estimatedYield: [1240, 1080, 1420, 760, 1180][index], harvestedQuantity: [980, 820, 1050, 430, 910][index],
      maxHealthSeverity: [1, 3, 0, 5, 2][index], conditionStatus: ['OPTIMAL', 'DRY', 'OPTIMAL', 'DRY', 'OPTIMAL'][index] as 'DRY' | 'OPTIMAL' | 'WET' | 'NO_DATA',
      pestRisk: ['LOW', 'MEDIUM', 'LOW', 'HIGH', 'MEDIUM'][index] as 'LOW' | 'MEDIUM' | 'HIGH',
    },
  })),
};

export const demoDashboardAnalytics: DashboardAnalytics = {
  blocks: blocks.length, fertilizer_quantity: 1840, water_volume: 12650,
  harvested_quantity: 4190, health_observations: 12, openAlerts: 3, connectedDevices: 8,
};

const yesterday = new Date(); yesterday.setDate(yesterday.getDate() - 1);
export const demoTasks: Task[] = [
  { id: 'task-1', title: 'Inspección de síntomas foliares', activity: 'scouting', blockId: 2, date: localDate(), time: '07:00', assignee: 'Daniel Contreras', priority: 'Alta', status: 'pending', instructions: 'Recorre los surcos R-101 a R-112. Registra los síntomas observados y solicita revisión del agrónomo. No aplicar tratamientos sin aprobación.' },
  { id: 'task-2', title: 'Aplicación del plan de fertilización', activity: 'fertilization', blockId: 3, date: localDate(), time: '08:30', assignee: 'María Rodríguez', priority: 'Media', status: 'progress', instructions: 'Confirma con el supervisor el producto, las cantidades y las medidas de protección del plan aprobado antes de iniciar.' },
  { id: 'task-3', title: 'Revisión del sistema de riego', activity: 'irrigation', blockId: 1, date: localDate(), time: '09:00', assignee: 'Daniel Contreras', priority: 'Media', status: 'pending', instructions: 'Revisa conexiones, presión y posibles fugas del sector 1. Reporta cualquier novedad antes de abrir las válvulas.' },
  { id: 'task-4', title: 'Preparación de área para resiembra', activity: 'planting', blockId: 4, date: localDate(), time: '10:00', assignee: 'Carlos Mendoza', priority: 'Baja', status: 'pending', instructions: 'Identifica los puntos de resiembra definidos por el supervisor y verifica la disponibilidad del material vegetal.' },
  { id: 'task-5', title: 'Cosecha del sector del río', activity: 'harvest', blockId: 5, date: localDate(), time: '06:00', assignee: 'María Rodríguez', priority: 'Alta', status: 'review', instructions: 'Recolecta únicamente los racimos señalados por el supervisor. Registra cantidad y novedades de calidad.', notes: 'Jornada terminada. Pendiente de validación.' },
  { id: 'task-6', title: 'Revisar válvula del sector 2', activity: 'irrigation', blockId: 4, date: localDate(yesterday), time: '14:00', assignee: 'Daniel Contreras', priority: 'Alta', status: 'blocked', instructions: 'Inspecciona la válvula del sector 2 y reporta si requiere repuesto.', notes: 'Pendiente de recibir el repuesto.' },
  { id: 'task-7', title: 'Monitoreo rutinario del cultivo', activity: 'scouting', blockId: 1, date: localDate(), time: '06:30', assignee: 'Carlos Mendoza', priority: 'Media', status: 'completed', instructions: 'Completar recorrido de observación.', notes: 'Recorrido completado sin novedades.' },
];

export const blockHealth = [86, 62, 91, 38, 78];
export const blockMoisture = [28, 18, 25, 12, 23];
export const blockNutrients = [0.9, 0.6, 1.8, 0.7, 1.2];

export function readDemo<T>(key: string, fallback: T): T {
  try { const saved = localStorage.getItem(`agrovision.${key}.v1`); return saved ? JSON.parse(saved) : fallback; }
  catch { return fallback; }
}

export function saveDemo(key: string, value: unknown) {
  try { localStorage.setItem(`agrovision.${key}.v1`, JSON.stringify(value)); return true; }
  catch { return false; }
}
