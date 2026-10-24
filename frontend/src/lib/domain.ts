import type { FarmData, Task } from './types.ts';

export const localDate = (date = new Date()) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
export const number = (value: number, digits = 0) => new Intl.NumberFormat('es-CO', { maximumFractionDigits: digits }).format(value);
export const eventLabels = {
  SCOUTING_OBSERVATION: 'Inspección del cultivo', TREATMENT_APPLICATION: 'Aplicación de tratamiento',
  FERTILIZER_APPLICATION: 'Fertilización', IRRIGATION_EVENT: 'Riego', HANDLING_EVENT: 'Labores del cultivo',
  SOIL_SAMPLE: 'Muestra de suelo', HARVEST_EVENT: 'Cosecha',
};
export const statusLabels = { pending: 'Pendiente', progress: 'En curso', review: 'Por revisar', completed: 'Completada', blocked: 'Bloqueada' };
export const activityLabels = { fertilization: 'Fertilización', irrigation: 'Riego', scouting: 'Inspección', planting: 'Siembra', harvest: 'Cosecha' };
export const roleLabels = { ADMIN: 'Administrador', SUPERVISOR: 'Supervisor', AGRONOMIST: 'Agrónomo', WORKER: 'Trabajador' };

export function scopeFarm(data: FarmData, farmId: number): FarmData {
  return {
    farms: data.farms.filter(farm => farm.id === farmId),
    fields: data.fields.filter(field => field.farm.id === farmId),
    blocks: data.blocks.filter(block => block.field.farm.id === farmId),
    rows: data.rows.filter(row => row.block.field.farm.id === farmId),
    events: data.events.filter(event => (event.block ?? event.row?.block)?.field.farm.id === farmId),
  };
}

export function farmMetrics(data: FarmData) {
  const fieldArea = data.fields.reduce((total, field) => total + (field.areaHa ?? 0), 0);
  const blockArea = data.blocks.reduce((total, block) => total + (block.areaHa ?? 0), 0);
  return {
    area: fieldArea || blockArea,
    plants: data.rows.reduce((total, row) => total + (row.plantsEstimated ?? 0), 0),
    observations: data.events.filter(event => event.eventType === 'SCOUTING_OBSERVATION').length,
    events: data.events.length,
  };
}

export function todayTasks(tasks: Task[], date: string, assignee?: string) {
  return tasks.filter(task => (!assignee || task.assignee === assignee) &&
    (task.date === date || (task.date < date && !['completed', 'review'].includes(task.status))))
    .sort((first, second) => `${first.date}T${first.time}`.localeCompare(`${second.date}T${second.time}`));
}

export function csvCell(value: unknown) {
  const content = String(value ?? '');
  return `"${(/^[\s]*[=+@-]|^[\t\r]/.test(content) ? "'" : '') + content.replaceAll('"', '""')}"`;
}

export function transitionTask(task: Task, status: Task['status'], notes?: string): Task {
  const allowed: Record<Task['status'], Task['status'][]> = {
    pending: ['progress', 'blocked'], progress: ['review', 'blocked'], blocked: ['progress'],
    review: ['completed', 'progress'], completed: [],
  };
  if (!allowed[task.status].includes(status)) throw new Error('Cambio de estado no permitido.');
  if (status === 'blocked' && !notes?.trim()) throw new Error('Describe el motivo del bloqueo.');
  return { ...task, status, notes: notes?.trim() || task.notes };
}
