import { useEffect, useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
import { ArrowRight, BellRing, CheckCircle2, Clock3, Droplets, Gauge, ThermometerSun, CalendarDays, Download, TriangleAlert } from 'lucide-react';
import { useApp } from '../context';
import { api } from '../lib/api';
import { saveDemo } from '../lib/demo';
import { csvCell, localDate, number } from '../lib/domain';
import { emptyIrrigation, readIrrigationDemo, refreshIrrigation, moistureLabels, moistureUnits, irrigationKey, executionAmounts } from '../lib/irrigation';
import type { IrrigationData, IrrigationSector, IrrigationPlan, IrrigationExecution, IrrigationMeasurement, IrrigationWaterSource, IrrigationWaterQuality, IrrigationInfrastructure, IrrigationWaterBalance, IrrigationMaintenance, IrrigationSensorCheck, IrrigationRecurringSchedule, MoistureUnit, RecurrenceUnit } from '../lib/irrigation';
import type { Member, Task } from '../lib/types';
import { Badge, Modal, Notice, Panel } from '../components/ui';
import IrrigationDetails from '../components/IrrigationDetails';
import IrrigationOverview from '../components/IrrigationOverview';
import IrrigationExecutions from '../components/IrrigationExecutions';
import '../fertilization.css';

type ManagementRecord = IrrigationWaterSource | IrrigationWaterQuality | IrrigationInfrastructure | IrrigationWaterBalance | IrrigationMaintenance | IrrigationSensorCheck;
type ManagementEditor = { kind: 'waterSource'; record?: IrrigationWaterSource } | { kind: 'quality'; record?: IrrigationWaterQuality } | { kind: 'infrastructure'; record?: IrrigationInfrastructure } | { kind: 'balance'; record?: IrrigationWaterBalance } | { kind: 'maintenance'; record?: IrrigationMaintenance } | { kind: 'sensorCheck'; record?: IrrigationSensorCheck };
type RecurringAction = 'PAUSED' | 'ACTIVE' | 'CANCELED';
type RecurringEditor = { kind: 'recurringSchedule'; record?: IrrigationRecurringSchedule } | { kind: 'recurringAction'; record: IrrigationRecurringSchedule; action: RecurringAction };
type Editor = { kind: 'sector' } | { kind: 'measurement' } | { kind: 'plan' } | ManagementEditor | RecurringEditor | { kind: 'thresholds'; sector: IrrigationSector } | { kind: 'execution' | 'cancel'; plan: IrrigationPlan };
type ManagementAction = 'waterSource' | 'quality' | 'infrastructure' | 'balance' | 'maintenance' | 'sensorCheck';
type Device = { id: number; name: string; active: boolean; block?: { id: number } };
const asLocalTime = (date = new Date()) => `${localDate(date)}T${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
const sourceTypeLabels: Record<string, string> = { RESERVOIR: 'Reservorio', WELL: 'Pozo', CANAL: 'Canal', RIVER: 'Río', RAINWATER: 'Agua lluvia', OTHER: 'Otra fuente' };
const assetTypeLabels: Record<string, string> = { FILTER: 'Filtro', PUMP: 'Bomba', VALVE: 'Válvula', PIPE: 'Tubería', METER: 'Medidor', DRAIN: 'Drenaje', CANAL: 'Canal', RESERVOIR: 'Reservorio', OTHER: 'Otro activo' };
const assetStatusLabels: Record<string, string> = { ACTIVE: 'Activo', MAINTENANCE: 'En mantenimiento', INACTIVE: 'Inactivo' };
const maintenanceTypeLabels: Record<string, string> = { FILTER_WASH: 'Lavado de filtro', PUMP_CHECK: 'Revisión de bomba', VALVE_CHECK: 'Revisión de válvula', LEAK_REPAIR: 'Reparación de fuga', METER_CALIBRATION: 'Calibración de medidor', DRAIN_CLEANING: 'Limpieza de drenaje', OTHER: 'Otro mantenimiento' };
const maintenanceStatusLabels: Record<string, string> = { PLANNED: 'Programado', IN_PROGRESS: 'En progreso', COMPLETED: 'Completado', BLOCKED: 'Bloqueado' };
const calibrationStatusLabels: Record<string, string> = { VALID: 'Vigente', DUE: 'Por verificar', FAILED: 'Fallida' };
const recurrenceUnitLabels: Record<RecurrenceUnit, string> = { DAILY: 'Días', WEEKLY: 'Semanas' };
const recurringStatusLabels: Record<string, string> = { ACTIVE: 'Activa', PAUSED: 'Pausada', CANCELED: 'Anulada' };
const readable = (value: string, labels: Record<string, string>) => labels[value] ?? value.replaceAll('_', ' ').toLowerCase();
function recurringDates(schedule: Pick<IrrigationRecurringSchedule, 'startDate' | 'endDate' | 'recurrenceUnit' | 'recurrenceInterval'>, from = localDate(), until = localDate(new Date(Date.now() + 30 * 86400000))) {
  const dates: string[] = []; const lower = new Date(`${from}T00:00:00`); const upper = new Date(`${until}T00:00:00`); const end = new Date(`${schedule.endDate}T00:00:00`); let cursor = new Date(`${schedule.startDate}T00:00:00`); const step = schedule.recurrenceInterval * (schedule.recurrenceUnit === 'WEEKLY' ? 7 : 1);
  while (cursor < lower && cursor <= end) cursor.setDate(cursor.getDate() + step);
  while (cursor <= upper && cursor <= end) { if (cursor >= lower) dates.push(localDate(cursor)); cursor.setDate(cursor.getDate() + step); }
  return dates;
}
function demoScheduleSummary(schedule: IrrigationRecurringSchedule, plans: IrrigationPlan[]): IrrigationRecurringSchedule {
  const related = plans.filter(plan => plan.recurringScheduleId === schedule.id); const upcoming = recurringDates(schedule).map(date => { const plan = related.find(item => item.occurrenceOn === date); return { date, generated: Boolean(plan), planId: plan?.id ?? null, taskId: plan?.taskId ?? null, status: plan?.status ?? null }; });
  return { ...schedule, upcoming, nextOccurrence: upcoming.find(item => !item.generated)?.date ?? null, generatedCount: related.length, taskCount: related.filter(item => item.taskId != null).length, historyCount: schedule.historyCount ?? 1 };
}
function demoRecurringGeneration(schedule: IrrigationRecurringSchedule, sector: IrrigationSector, existingPlans: IrrigationPlan[], farmId: number, members: Member[]) {
  const missing = recurringDates(schedule).filter(date => !existingPlans.some(plan => plan.recurringScheduleId === schedule.id && plan.occurrenceOn === date)); const seed = Date.now();
  const plans: IrrigationPlan[] = missing.map((date, index) => { const id = seed + index; const taskId = seed + 1000 + index; return { id, sectorId: sector.id, scheduledOn: date, scheduledTime: schedule.scheduledTime, durationMinutes: schedule.durationMinutes, volumeM3: schedule.volumeM3, assigneeId: schedule.assigneeId, justification: schedule.justification, instructions: schedule.instructions, sectorSnapshot: sector, status: 'SCHEDULED', taskId, taskStatus: 'pending', recurringScheduleId: schedule.id, occurrenceOn: date, version: 1, actualVolumeM3: 0, actualDurationMinutes: 0, createdBy: schedule.createdBy, createdAt: new Date().toISOString() }; });
  const tasks: Task[] = plans.map(plan => ({ id: String(plan.taskId), farmId, blockId: sector.blockId, assigneeId: plan.assigneeId, assignee: members.find(member => member.userId === plan.assigneeId)?.name ?? 'Responsable', title: `Riego recurrente #${schedule.id} · ${sector.name}`, activity: 'irrigation', date: plan.scheduledOn, time: plan.scheduledTime, priority: 'Media', status: 'pending', version: 0, instructions: `${plan.durationMinutes} min · ${plan.volumeM3} m³. ${plan.instructions}. ${plan.justification}` }));
  return { plans, tasks };
}

const irrigationTabs = [
  { id: 'summary', label: 'Resumen' },
  { id: 'measurements', label: 'Sectores' },
  { id: 'plans', label: 'Programación' },
  { id: 'executions', label: 'Ejecuciones' },
  { id: 'sensors', label: 'Sensores' },
  { id: 'management', label: 'Infraestructura' },
] as const;
type IrrigationTab = typeof irrigationTabs[number]['id'];

export default function Irrigation({ onHistory }: { onHistory: () => void }) {
  const app = useApp(); const { mode, role, farmId, data, date, profile, notify } = app;
  const demo = mode === 'demo'; const manager = role !== 'WORKER';
  const [records, setRecords] = useState<IrrigationData>(emptyIrrigation);
  const [members, setMembers] = useState<Member[]>([]);
  const [devices, setDevices] = useState<Device[]>([]);
  const [tab, setTab] = useState<IrrigationTab>('summary');
  const [filter, setFilter] = useState('');
  const [editor, setEditor] = useState<Editor>();
  const [detail, setDetail] = useState<IrrigationExecution | IrrigationPlan | IrrigationSector>();
  const [chosenSector, setChosenSector] = useState(0);
  const [volumeMode, setVolumeMode] = useState<'METER' | 'FLOW'>('METER');
  const [error, setError] = useState(''); const [busy, setBusy] = useState(false); const [photoBusy, setPhotoBusy] = useState(false); const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  useEffect(() => {
    let active = true; setLoading(true); setRecords(emptyIrrigation()); setError(''); setLoadError(''); setEditor(undefined); setDetail(undefined);
    const people = demo ? Promise.resolve([{ userId: 1, name: profile.user.name, email: profile.user.email, role: 'ADMIN' as const }, { userId: 2, name: 'María Rodríguez', email: 'maria@demo.local', role: 'WORKER' as const }]) : manager ? api.members(farmId) : Promise.resolve([]);
    Promise.all([demo ? Promise.resolve(readIrrigationDemo()) : api.irrigation(farmId), people, demo ? Promise.resolve([]) : api.sensorDevices(farmId)]).then(([result, users, sensorDevices]) => {
      if (active) { setRecords(result); setMembers(users); setDevices(sensorDevices as Device[]); }
    }).catch(failure => { if (active) setLoadError(failure instanceof Error ? failure.message : 'No se pudo cargar el riego.'); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [demo, farmId, manager, profile.user.id, profile.user.name, profile.user.email]);
  useEffect(() => {
    if (!demo) return;
    const timer = setInterval(() => setRecords(previous => refreshIrrigation(previous)), 60000);
    return () => clearInterval(timer);
  }, [demo]);
  const sectors = records.sectors.filter(sector => data.blocks.some(block => block.id === sector.blockId));
  const plans = records.plans.filter(plan => sectors.some(sector => sector.id === plan.sectorId));
  const executions = records.executions.filter(execution => plans.some(plan => plan.id === execution.planId));
  const measurements = records.measurements.filter(reading => sectors.some(sector => sector.id === reading.sectorId));
  const sectorName = (id: number) => sectors.find(sector => sector.id === id)?.name ?? `Sector #${id}`;
  const blockName = (id: number) => data.blocks.find(block => block.id === id)?.code ?? `Bloque #${id}`;
  const memberName = (id: number) => members.find(member => member.userId === id)?.name ?? (profile.user.id === id ? profile.user.name : `Usuario #${id}`);
  const matches = (id: number) => !filter || id === Number(filter);
  function persist(next: IrrigationData) { const updated = refreshIrrigation(next); if (!saveDemo(irrigationKey, updated)) throw new Error('No se pudo guardar la demostración. Revisa el almacenamiento del navegador.'); setRecords(updated); }
  async function run(operation: () => Promise<void>) {
    setBusy(true); setError('');
    try { await operation(); setEditor(undefined); if (!demo) { try { setRecords(await api.irrigation(farmId)); } catch { throw new Error('El registro se guardó, pero no se pudo actualizar la vista. Recarga; no repitas la creación.'); } } notify('Registro de riego guardado.'); }
    catch (failure) { setError(failure instanceof Error ? failure.message : 'No se pudo guardar.'); } finally { setBusy(false); }
  }
  function open(next: Editor) {
    const record = 'record' in next ? next.record : undefined;
    const recordSector = record && 'sectorId' in record && record.sectorId != null ? Number(record.sectorId) : 0;
    setDetail(undefined); setError(''); setChosenSector(Number(filter) || recordSector || sectors[0]?.id || 0); setVolumeMode('METER'); setEditor(next);
  }
  function openManagement(kind: ManagementAction, record?: ManagementRecord) { open({ kind, record } as ManagementEditor); }
  async function generateTask(plan: IrrigationPlan) {
    await run(async () => {
      if (!demo) { await api.irrigationAction(`plans/${plan.id}/task`); await app.refresh(true); return; }
      if (plan.taskId) return;
      const sector = sectors.find(item => item.id === plan.sectorId)!; const taskId = Date.now();
      persist({ ...records, plans: records.plans.map(item => item.id === plan.id ? { ...item, taskId, taskStatus: 'pending', version: item.version + 1 } : item) });
      app.setTasks(previous => [...previous, { id: String(taskId), farmId, blockId: sector.blockId, assigneeId: plan.assigneeId, assignee: members.find(member => member.userId === plan.assigneeId)?.name ?? 'Responsable', title: `Riego #${plan.id} · ${sector.name}`, activity: 'irrigation', date: plan.scheduledOn, time: plan.scheduledTime, priority: 'Media', status: 'pending', version: 0, instructions: `${plan.durationMinutes} min · ${plan.volumeM3} m³. ${plan.instructions}. ${plan.justification}` }]);
    });
  }
  async function generateRecurring(schedule: IrrigationRecurringSchedule) {
    await run(async () => {
      if (!demo) { await api.irrigationAction(`recurring-schedules/${schedule.id}/generate`); return; }
      const sector=sectors.find(item => item.id === schedule.sectorId); if (!sector) throw new Error('El sector de la recurrencia ya no está disponible.');
      const generated=demoRecurringGeneration(schedule,sector,records.plans,farmId,members); const plans=[...generated.plans,...records.plans];
      persist({ ...records, plans, recurringSchedules: (records.recurringSchedules ?? []).map(item => item.id === schedule.id ? demoScheduleSummary(item,plans) : item) }); app.setTasks(previous => [...generated.tasks,...previous]);
    });
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!editor) return;
    const form = new FormData(event.currentTarget); const text = (key: string) => String(form.get(key) ?? '').trim(); const numeric = (key: string) => Number(text(key)); const optional = (key: string) => text(key) === '' ? null : numeric(key);
    await run(async () => {
      if (editor.kind === 'sector' || editor.kind === 'thresholds') {
        const unit = editor.kind === 'thresholds' ? editor.sector.unit : text('unit') as MoistureUnit;
        const lowerBound = optional('lowerBound'); const upperBound = optional('upperBound');
        if ((lowerBound == null) !== (upperBound == null) || (lowerBound != null && upperBound != null && (lowerBound >= upperBound || (unit !== 'KPA' && upperBound > 100)))) throw new Error('Define ambos límites en orden creciente y en la unidad del sector.');
        const thresholds = { lowerBound, upperBound, maxAgeHours: numeric('maxAgeHours'), technicalBasis: text('technicalBasis') };
        if (editor.kind === 'thresholds') {
          if (demo) persist({ ...records, sectors: records.sectors.map(sector => sector.id === editor.sector.id ? { ...sector, ...thresholds, version: sector.version + 1 } as IrrigationSector : sector) });
          else await api.irrigationAction(`sectors/${editor.sector.id}/thresholds`, { ...thresholds, version: editor.sector.version });
        } else {
          const payload = { blockId: numeric('blockId'), name: text('name'), areaHa: numeric('areaHa'), system: text('system'), waterSource: text('waterSource'), flowM3h: optional('flowM3h'), unit, depthCm: numeric('depthCm'), sensorDeviceId: optional('sensorDeviceId'), ...thresholds };
          if (payload.areaHa > (data.blocks.find(block => block.id === payload.blockId)?.areaHa ?? Infinity)) throw new Error('El área del sector supera el bloque.');
          if (demo) persist({ ...records, sectors: [...records.sectors, { ...payload, id: Date.now(), version: 0, createdBy: profile.user.id, createdAt: new Date().toISOString(), condition: 'NO_DATA' } as IrrigationSector] });
          else await api.irrigationAction('sectors', payload);
        }
      } else if (editor.kind === 'measurement') {
        const sector = sectors.find(item => item.id === numeric('sectorId'))!;
        const payload = { sectorId: sector.id, recordedAt: new Date(text('recordedAt')).toISOString(), value: numeric('value'), unit: sector.unit, depthCm: sector.depthCm, instrument: text('instrument'), rainMm: optional('rainMm'), drainage: text('drainage'), notes: text('notes') };
        if (Date.parse(payload.recordedAt) > Date.now() || (sector.unit !== 'KPA' && payload.value > 100)) throw new Error('Revisa la fecha y el porcentaje de humedad.');
        if (demo) persist({ ...records, measurements: [{ ...payload, id: Date.now(), source: 'MANUAL', createdBy: profile.user.id } as IrrigationMeasurement, ...records.measurements] });
        else await api.irrigationAction('measurements', payload);
      } else if (editor.kind === 'plan') {
        const sector = sectors.find(item => item.id === numeric('sectorId'))!;
        const payload = { sectorId: sector.id, scheduledOn: text('scheduledOn'), scheduledTime: text('scheduledTime'), durationMinutes: numeric('durationMinutes'), volumeM3: numeric('volumeM3'), assigneeId: numeric('assigneeId'), justification: text('justification'), instructions: text('instructions') };
        if (demo) persist({ ...records, plans: [{ ...payload, sectorSnapshot: sector, id: Date.now(), status: 'SCHEDULED', version: 0, actualDurationMinutes: 0, actualVolumeM3: 0, createdBy: profile.user.id, createdAt: new Date().toISOString() }, ...records.plans] });
        else await api.irrigationAction('plans', payload);
      } else if (editor.kind === 'recurringSchedule') {
        const sector = sectors.find(item => item.id === numeric('sectorId'))!;
        const payload = { sectorId: sector.id, startDate: text('startDate'), endDate: text('endDate'), scheduledTime: text('scheduledTime'), recurrenceUnit: text('recurrenceUnit') as RecurrenceUnit, recurrenceInterval: numeric('recurrenceInterval'), durationMinutes: numeric('durationMinutes'), volumeM3: numeric('volumeM3'), assigneeId: numeric('assigneeId'), justification: text('justification'), instructions: text('instructions') };
        if (editor.record) {
          if (demo) {
            const schedule={ ...editor.record, ...payload, version: editor.record.version + 1 }; const schedules=(records.recurringSchedules ?? []).map(item => item.id === editor.record!.id ? schedule : item); persist({ ...records, recurringSchedules: schedules.map(item => item.id === schedule.id ? demoScheduleSummary(item,records.plans) : item) });
          } else await api.irrigationUpdate(`recurring-schedules/${editor.record.id}`, { ...payload, version: editor.record.version });
        } else if (demo) {
          const schedule={ ...payload, id: Date.now(), status: 'ACTIVE' as const, version: 0, createdBy: profile.user.id, createdAt: new Date().toISOString() }; const generated=demoRecurringGeneration(schedule,sector,records.plans,farmId,members); const plans=[...generated.plans,...records.plans];
          persist({ ...records, plans, recurringSchedules: [demoScheduleSummary(schedule,plans), ...(records.recurringSchedules ?? [])] }); app.setTasks(previous => [...generated.tasks,...previous]);
        } else await api.irrigationAction('recurring-schedules', payload);
      } else if (editor.kind === 'recurringAction') {
        const path = editor.action === 'PAUSED' ? 'pause' : editor.action === 'ACTIVE' ? 'resume' : 'cancel'; const reason = text('reason');
        if (editor.action === 'CANCELED' && !reason) throw new Error('Documenta el motivo de anulación.');
        if (demo) persist({ ...records, recurringSchedules: (records.recurringSchedules ?? []).map(item => item.id === editor.record.id ? { ...item, status: editor.action, cancelReason: editor.action === 'CANCELED' ? reason : item.cancelReason, version: (item.version ?? 0) + 1, historyCount: (item.historyCount ?? 1) + 1 } : item) });
        else await api.irrigationAction(`recurring-schedules/${editor.record.id}/${path}`, { version: editor.record.version, reason: reason || undefined });
      } else if (editor.kind === 'waterSource') {
        const payload = { name: text('name'), sourceType: text('sourceType'), latitude: optional('latitude'), longitude: optional('longitude'), capacityM3: optional('capacityM3'), active: text('active') === 'true', notes: text('notes') };
        const record = editor.record;
        if (record) {
          if (demo) persist({ ...records, waterSources: (records.waterSources ?? []).map(item => item.id === record.id ? { ...item, ...payload, version: (item.version ?? 0) + 1 } : item) });
          else await api.irrigationUpdate(`water-sources/${record.id}`, { ...payload, version: record.version ?? 0 });
        } else if (demo) persist({ ...records, waterSources: [{ ...payload, id: Date.now(), farmId, active: true }, ...(records.waterSources ?? [])] });
        else await api.irrigationAction('water-sources', { farmId, name: payload.name, sourceType: payload.sourceType, latitude: payload.latitude, longitude: payload.longitude, capacityM3: payload.capacityM3, notes: payload.notes });
      } else if (editor.kind === 'quality') {
        const fields = { sampledOn: text('sampledOn'), ph: optional('ph'), conductivityDsM: optional('conductivityDsM'), salinityPpm: optional('salinityPpm'), suspendedSolidsMgL: optional('suspendedSolidsMgL'), laboratoryReference: text('laboratoryReference'), notes: text('notes') };
        const sourceId = numeric('sourceId'); if (!sourceId) throw new Error('Selecciona una fuente de agua antes de registrar el análisis.');
        const record = editor.record;
        if (record) {
          if (demo) persist({ ...records, waterQuality: (records.waterQuality ?? []).map(item => item.id === record.id ? { ...item, ...fields, sourceId, version: (item.version ?? 0) + 1 } : item) });
          else await api.irrigationUpdate(`water-quality/${record.id}`, { ...fields, sourceId, version: record.version ?? 0 });
        } else if (demo) persist({ ...records, waterQuality: [{ ...fields, id: Date.now(), sourceId }, ...(records.waterQuality ?? [])] });
        else await api.irrigationAction(`water-sources/${sourceId}/quality`, fields);
      } else if (editor.kind === 'infrastructure') {
        const payload = { blockId: optional('blockId'), sourceId: optional('sourceId'), assetType: text('assetType'), code: text('code'), latitude: optional('latitude'), longitude: optional('longitude'), status: text('status'), notes: text('notes') };
        const record = editor.record;
        if (record) {
          if (demo) persist({ ...records, infrastructure: (records.infrastructure ?? []).map(item => item.id === record.id ? { ...item, ...payload, version: (item.version ?? 0) + 1 } : item) });
          else await api.irrigationUpdate(`infrastructure/${record.id}`, { ...payload, version: record.version ?? 0 });
        } else if (demo) persist({ ...records, infrastructure: [{ ...payload, id: Date.now(), farmId }, ...(records.infrastructure ?? [])] });
        else await api.irrigationAction('infrastructure', { farmId, ...payload });
      } else if (editor.kind === 'balance') {
        const payload = { sectorId: numeric('sectorId'), balanceDate: text('balanceDate'), rainfallMm: numeric('rainfallMm'), et0Mm: optional('et0Mm'), cropCoefficient: optional('cropCoefficient'), rootDepthCm: optional('rootDepthCm'), availableWaterMm: optional('availableWaterMm'), requiredVolumeM3: optional('requiredVolumeM3'), appliedVolumeM3: optional('appliedVolumeM3'), deficitMm: optional('deficitMm'), notes: text('notes') };
        const record = editor.record;
        if (record) {
          if (demo) persist({ ...records, waterBalances: (records.waterBalances ?? []).map(item => item.id === record.id ? { ...item, ...payload, version: (item.version ?? 0) + 1 } : item) });
          else await api.irrigationUpdate(`water-balances/${record.id}`, { ...payload, version: record.version ?? 0 });
        } else if (demo) persist({ ...records, waterBalances: [{ ...payload, id: Date.now(), sectorId: payload.sectorId, balanceDate: payload.balanceDate, rainfallMm: payload.rainfallMm }, ...(records.waterBalances ?? [])] });
        else await api.irrigationAction('water-balances', payload);
      } else if (editor.kind === 'maintenance') {
        const sectorId = optional('sectorId'); const infrastructureId = optional('infrastructureId'); if ((sectorId == null) === (infrastructureId == null)) throw new Error('Asocia el mantenimiento a un sector o a un activo hidráulico, pero no a ambos.');
        const payload = { maintenanceType: text('maintenanceType'), scheduledOn: text('scheduledOn'), sectorId, infrastructureId, status: text('status'), completedOn: text('completedOn') || null, pressureKpa: optional('pressureKpa'), flowM3h: optional('flowM3h'), notes: text('notes') };
        const record = editor.record;
        if (record) {
          if (demo) persist({ ...records, maintenance: (records.maintenance ?? []).map(item => item.id === record.id ? { ...item, ...payload, version: (item.version ?? 0) + 1 } : item) });
          else await api.irrigationUpdate(`maintenance/${record.id}`, { ...payload, version: record.version ?? 0 });
        } else if (demo) persist({ ...records, maintenance: [{ ...payload, id: Date.now() }, ...(records.maintenance ?? [])] });
        else await api.irrigationAction('maintenance', payload);
      } else if (editor.kind === 'sensorCheck') {
        const payload = { sectorId: numeric('sectorId'), sensorDeviceId: numeric('sensorDeviceId'), checkedOn: text('checkedOn'), calibrationStatus: text('calibrationStatus'), referenceValue: optional('referenceValue'), observedValue: optional('observedValue'), technician: text('technician'), notes: text('notes') }; if (!payload.sensorDeviceId) throw new Error('Selecciona o indica un sensor válido.');
        const record = editor.record;
        if (record) {
          if (demo) persist({ ...records, sensorChecks: (records.sensorChecks ?? []).map(item => item.id === record.id ? { ...item, ...payload, version: (item.version ?? 0) + 1 } : item) });
          else await api.irrigationUpdate(`sensor-checks/${record.id}`, { ...payload, version: record.version ?? 0 });
        } else if (demo) persist({ ...records, sensorChecks: [{ ...payload, id: Date.now(), sectorId: payload.sectorId, sensorDeviceId: payload.sensorDeviceId, checkedOn: payload.checkedOn, calibrationStatus: payload.calibrationStatus }, ...(records.sensorChecks ?? [])] });
        else await api.irrigationAction('sensor-checks', payload);
      } else if (editor.kind === 'cancel') {
        if (demo) persist({ ...records, plans: records.plans.map(plan => plan.id === editor.plan.id ? { ...plan, status: 'CANCELED', canceledBy: profile.user.id, cancelReason: text('reason'), version: plan.version + 1 } : plan) });
        else await api.irrigationAction(`plans/${editor.plan.id}/cancel`, { version: editor.plan.version, reason: text('reason') });
      } else if (editor.kind === 'execution') {
        const plan = editor.plan;
        const payload = { startedAt: new Date(text('startedAt')).toISOString(), endedAt: new Date(text('endedAt')).toISOString(), interruptionMinutes: numeric('interruptionMinutes'), volumeMode, meterUnit: volumeMode === 'METER' ? text('meterUnit') as 'L' | 'M3' : undefined, meterStart: volumeMode === 'METER' ? numeric('meterStart') : undefined, meterEnd: volumeMode === 'METER' ? numeric('meterEnd') : undefined, flowM3h: volumeMode === 'FLOW' ? numeric('flowM3h') : undefined, varianceReason: text('varianceReason'), notes: text('notes') };
        const amounts = executionAmounts(payload);
        if (Date.parse(payload.endedAt) > Date.now() || Date.parse(payload.startedAt) > Date.now()) throw new Error('Las fechas reales no pueden estar en el futuro.');
        if ((plan.actualVolumeM3 + amounts.volumeM3 > plan.volumeM3 || plan.actualDurationMinutes + amounts.durationMinutes > plan.durationMinutes) && !payload.varianceReason) throw new Error('Documenta la razón de superar el volumen o duración programados.');
        let execution: IrrigationExecution;
        if (demo) {
          const task = app.tasks.find(item => item.id === String(plan.taskId));
          if (!task || !['pending', 'progress'].includes(task.status)) throw new Error('La tarea debe estar pendiente o en progreso.');
          if (executions.some(item => plans.find(candidate => candidate.id === item.planId)?.sectorId === plan.sectorId && item.startedAt < payload.endedAt && item.endedAt > payload.startedAt)) throw new Error('Ya existe una ejecución en ese intervalo para el sector.');
          const sector = sectors.find(item => item.id === plan.sectorId)!;
          const eventId = await app.create('events', { eventType: 'IRRIGATION_EVENT', blockId: sector.blockId, occurredAt: payload.startedAt, notes: `Riego #${plan.id} · ${amounts.volumeM3} m³ · ${volumeMode === 'METER' ? 'Medido' : 'Estimado'} · ${payload.notes}` });
          execution = { ...payload, ...amounts, id: Date.now(), planId: plan.id, eventId, createdBy: profile.user.id, createdAt: new Date().toISOString() };
          persist({ ...records, executions: [execution, ...records.executions], plans: records.plans.map(item => item.id === plan.id ? { ...item, actualVolumeM3: item.actualVolumeM3 + amounts.volumeM3, actualDurationMinutes: item.actualDurationMinutes + amounts.durationMinutes, taskStatus: 'progress' } : item) });
          app.setTasks(previous => previous.map(item => item.id === String(plan.taskId) && item.status === 'pending' ? { ...item, status: 'progress', version: (item.version ?? 0) + 1 } : item));
        } else { execution = await api.irrigationAction<IrrigationExecution>(`plans/${plan.id}/executions`, payload); await app.refresh(true); }
        setTab('executions'); setDetail(execution);
      }
    });
  }
  function exportCsv() {
    const rows = [['Plan', 'Sector', 'Inicio', 'Fin', 'Minutos efectivos', 'Volumen m3', 'Origen volumen', 'Operador', 'Desviación', 'Notas'], ...executions.filter(execution => matches(plans.find(plan => plan.id === execution.planId)!.sectorId)).map(execution => [execution.planId, sectorName(plans.find(plan => plan.id === execution.planId)!.sectorId), execution.startedAt, execution.endedAt, execution.durationMinutes, execution.volumeM3, execution.volumeMode === 'METER' ? 'Medido por contador' : 'Estimado por caudal', execution.createdBy, execution.varianceReason, execution.notes])];
    const url = URL.createObjectURL(new Blob(['\uFEFF' + rows.map(row => row.map(csvCell).join(',')).join('\r\n')], { type: 'text/csv;charset=utf-8' })); const anchor = document.createElement('a'); anchor.href = url; anchor.download = 'riego-ejecuciones.csv'; anchor.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  const input = (label: string, name: string, options: { type?: string; value?: string | number; min?: number; max?: number; required?: boolean; step?: string } = {}) => <label>{label}<input aria-label={label} name={name} type={options.type ?? 'text'} defaultValue={options.value} min={options.min} max={options.max} required={options.required ?? true} step={options.step} maxLength={150} /></label>;
  const sectorSelect = <label>Sector<select aria-label="Sector" name="sectorId" required value={chosenSector} onChange={event => setChosenSector(Number(event.target.value))}>{sectors.map(sector => <option value={sector.id} key={sector.id}>{sector.name} · {blockName(sector.blockId)}</option>)}</select></label>;
  const sectorConfig = sectors.find(sector => sector.id === chosenSector);
  const activeDevices = devices.filter(device => device.active);
  const thresholdsForm = (sector?: IrrigationSector) => <IrrigationFormSection title="Umbrales de humedad">
    {input('Límite inferior (opcional)', 'lowerBound', { type: 'number', min: 0, step: 'any', required: false, value: sector?.lowerBound })}
    {input('Límite superior (opcional)', 'upperBound', { type: 'number', min: 0, step: 'any', required: false, value: sector?.upperBound })}
    {input('Vigencia máxima de una lectura (horas)', 'maxAgeHours', { type: 'number', min: 1, max: 720, value: sector?.maxAgeHours ?? 24 })}
    <label className="irrigation-field-wide">Fundamento técnico / motivo de configuración<textarea name="technicalBasis" required maxLength={2000} defaultValue={sector?.technicalBasis} /></label>
    <Notice>La clasificación de humedad usa los límites y la unidad del sector. Configura ambos límites para activarla.</Notice>
  </IrrigationFormSection>;
  return <>
    <section className="irrigation-dashboard" aria-label="Proceso de riego">
      <header className="module-heading">
        <div><h1>Riego</h1><p>Gestiona sectores, consulta la humedad del suelo y programa ejecuciones de riego.</p></div>
        <div className="module-heading-actions">
          <button className="button secondary" disabled={loading || !!loadError} onClick={exportCsv}><Download size={16} />Exportar CSV</button>
          {tab === 'summary' && manager && <button className="button" disabled={!sectors.length} onClick={() => open({ kind: 'plan' })}><CalendarDays size={16} />Programar riego</button>}
        </div>
      </header>
      <div className="module-tabs" aria-label="Secciones de riego">
        {irrigationTabs.map(item => <button type="button" key={item.id} aria-pressed={tab === item.id} className={tab === item.id ? 'active' : ''} onClick={() => { setTab(item.id); setFilter(''); }}>{item.label}</button>)}
        <button type="button" onClick={onHistory}>Historial</button>
      </div>
      {error && !editor && !detail && <p className="form-error" role="alert">{error}</p>}
      {loadError ? <p className="form-error" role="alert">{loadError}</p> : tab === 'summary' ? (
        loading ? <p role="status">Cargando riego…</p> : <IrrigationOverview key={farmId} data={data} demo={demo} date={date}
          sectors={sectors} plans={plans} executions={executions} infrastructure={records.infrastructure} maintenance={records.maintenance ?? []}
          alerts={<IrrigationAlerts sectors={sectors} plans={plans} records={records} onReview={setTab} onViewAll={() => setTab('measurements')} />}
          onView={sector => { setError(''); setDetail(sector); }}
          onCreate={manager ? () => open({ kind: 'sector' }) : undefined} canCreate={data.blocks.length > 0} />
      ) : <div className="irrigation-legacy-workspace">
    {tab !== 'executions' && <Notice>El responsable técnico configura los umbrales. Las mediciones y las ejecuciones registradas se pueden consultar por sector. {demo && 'Los datos iniciales son ficticios.'}</Notice>}
    <div className="toolbar irrigation-sector-filter">
      <label>Filtrar sector<select aria-label="Filtrar sector" value={filter} onChange={event => setFilter(event.target.value)}><option value="">Todos</option>{sectors.map(sector => <option value={sector.id} key={sector.id}>{sector.name}</option>)}</select></label>
    </div>
    {loading ? <p role="status">Cargando riego…</p> : <div className={tab === 'management' ? 'irrigation-tab-management' : 'irrigation-tab-standard'}>
      {tab === 'measurements' && <IrrigationAlerts sectors={sectors} plans={plans} records={records} onReview={nextTab => setTab(nextTab)} />}
      <div className={tab === 'management' ? 'water-management-view' : 'water-management-view hidden'}><WaterManagement records={records} manager={manager} onOpen={openManagement} sectors={sectors} blockName={blockName} filter={filter} devices={devices} /></div>
      {tab === 'measurements' || tab === 'sensors' ? <>
        {tab === 'measurements' && <Panel title="Sectores y configuración técnica"
          action={manager ? <button className="button small" onClick={() => open({ kind: 'sector' })} disabled={!data.blocks.length}>Nuevo sector</button> : undefined}>
          <div className="table-wrap"><table className="irrigation-history-table" role="table">
            <thead><tr><th>Sector / bloque</th><th>Sistema / fuente</th><th>Última lectura</th><th>Estado</th><th>Configuración</th></tr></thead>
            <tbody role="rowgroup">{sectors.filter(sector => matches(sector.id)).map(sector => <tr key={sector.id} role="row">
              <td role="cell"><strong>{sector.name}</strong><small>{blockName(sector.blockId)} · {sector.areaHa} ha</small></td>
              <td role="cell" data-label="Sistema y fuente">{sector.system}<small>{sector.waterSource}{sector.flowM3h != null && ` · ${number(sector.flowM3h, 3)} m³/h`}</small></td>
              <td role="cell" data-label="Última lectura">
                {sector.latest ? `${sector.latest.value} ${moistureUnits[sector.unit]} · ${sector.depthCm} cm` : 'Sin medición'}
                {sector.latest && <small>{new Date(sector.latest.recordedAt).toLocaleString('es-CO')}</small>}
              </td>
              <td role="cell" data-label="Estado"><Badge tone={sector.condition === 'IN_RANGE' ? 'green' : 'neutral'}>{moistureLabels[sector.condition]}</Badge></td>
              <td role="cell"><div className="irrigation-row-actions">
                <button className="outline-action" aria-label={`Ver sector ${sector.name}`} onClick={() => { setError(''); setDetail(sector); }}>Ver sector</button>
                {manager && <button className="text-button" aria-label={`Configurar límites de ${sector.name}`} onClick={() => open({ kind: 'thresholds', sector })}>Configurar límites</button>}
              </div></td>
            </tr>)}</tbody>
          </table></div>
        </Panel>}
        <Panel title={tab === 'sensors' ? 'Lecturas de sensores' : 'Historial de mediciones'}
          action={<button className="button small" disabled={!sectors.length} onClick={() => open({ kind: 'measurement' })}>Nueva medición</button>}>
          <div className="table-wrap"><table className="irrigation-history-table" role="table">
            <thead><tr><th>Sector / fecha</th><th>Humedad / profundidad</th><th>Origen / instrumento</th><th>Lluvia registrada</th><th>Drenaje / notas</th></tr></thead>
            <tbody role="rowgroup">
              {measurements.filter(reading => matches(reading.sectorId) && (tab !== 'sensors' || reading.source === 'SENSOR'))
                .sort((first, second) => Date.parse(second.recordedAt) - Date.parse(first.recordedAt))
                .map(reading => <tr key={`${reading.sectorId}-${reading.id}`} role="row">
                  <td role="cell"><strong>{sectorName(reading.sectorId)}</strong><small>{new Date(reading.recordedAt).toLocaleString('es-CO')}</small></td>
                  <td role="cell" data-label="Humedad y profundidad">{reading.value} {moistureUnits[reading.unit]} · {reading.depthCm} cm</td>
                  <td role="cell" data-label="Origen e instrumento">{reading.source === 'MANUAL'
                    ? reading.createdBy == null ? 'Manual' : `Manual · ${memberName(reading.createdBy)}`
                    : 'Sensor'}<small>{reading.instrument}</small></td>
                  <td role="cell" data-label="Lluvia registrada">{reading.rainMm != null ? `${reading.rainMm} mm` : 'Sin registro'}</td>
                  <td role="cell" data-label="Drenaje y notas" className="irrigation-history-note">{reading.drainage || 'Sin observación'}{reading.notes && <small>{reading.notes}</small>}</td>
                </tr>)}
            </tbody>
          </table></div>
          {!measurements.some(reading => matches(reading.sectorId) && (tab !== 'sensors' || reading.source === 'SENSOR')) &&
            <p className="module-empty-note">{tab === 'sensors' ? 'Sin lecturas de sensores para la selección actual.' : 'Sin mediciones para la selección actual.'}</p>}
        </Panel>
      </> : tab === 'plans' ? <>
        <Panel title="Programación y tareas"
          action={manager && <button className="button small" disabled={!sectors.length} onClick={() => open({ kind: 'plan' })}>Programar riego</button>}>
          <div className="table-wrap"><table className="irrigation-history-table" role="table">
            <thead><tr><th>Sector / fecha</th><th>Minutos previstos / reales</th><th>m³ previstos / reales</th><th>Estado</th><th>Acciones</th></tr></thead>
            <tbody role="rowgroup">{plans.filter(plan => matches(plan.sectorId)).map(plan => <tr key={plan.id} role="row">
              <td role="cell"><strong>{sectorName(plan.sectorId)}</strong><small>{plan.scheduledOn} · {plan.scheduledTime.slice(0, 5)}</small>
                {plan.recurringScheduleId && <small>Recurrencia #{plan.recurringScheduleId}</small>}
              </td>
              <td role="cell" data-label="Minutos previstos / reales">{plan.durationMinutes} / {plan.actualDurationMinutes}</td>
              <td role="cell" data-label="m³ previstos / reales">{plan.volumeM3} / {plan.actualVolumeM3}</td>
              <td role="cell" data-label="Estado"><Badge tone={plan.status === 'CANCELED' ? 'red' : plan.taskId ? 'green' : 'neutral'}>
                {plan.status === 'CANCELED' ? 'Anulado' : plan.taskId ? 'Con tarea' : 'Sin tarea'}
              </Badge>{plan.taskId && <small>Tarea #{plan.taskId}</small>}</td>
              <td role="cell"><div className="irrigation-row-actions">
                <button className="outline-action" aria-label={`Ver programación ${plan.id}`} onClick={() => { setError(''); setDetail(plan); }}>Ver programación</button>
                {manager && !plan.taskId && plan.status === 'SCHEDULED' && <>
                  <button className="text-button" disabled={busy} onClick={() => void generateTask(plan)}>Generar tarea</button>
                  <button className="text-button" onClick={() => open({ kind: 'cancel', plan })}>Anular</button>
                </>}
                {plan.status === 'SCHEDULED' && plan.taskId && (manager || plan.assigneeId === profile.user.id) &&
                  <button className="text-button" onClick={() => open({ kind: 'execution', plan })}>Registrar ejecución</button>}
              </div></td>
            </tr>)}</tbody>
          </table></div>
          {!plans.some(plan => matches(plan.sectorId)) && <p className="module-empty-note">Sin programaciones para la selección actual.</p>}
        </Panel>
        <RecurringSchedulePanel schedules={(records.recurringSchedules ?? []).filter(schedule => matches(schedule.sectorId))}
          sectors={sectors} members={members} manager={manager} busy={busy}
          onCreate={() => open({ kind: 'recurringSchedule' })} onEdit={schedule => open({ kind: 'recurringSchedule', record: schedule })}
          onGenerate={schedule => void generateRecurring(schedule)} onAction={(schedule, action) => open({ kind: 'recurringAction', record: schedule, action })} />
      </> : <IrrigationExecutions executions={executions} plans={plans.filter(plan => matches(plan.sectorId))}
        sectorName={sectorName} onView={execution => { setError(''); setDetail(execution); }} onPlans={() => setTab('plans')} />}
    </div>}
    </div>}
    </section>
    {editor && <Modal className="farm-work-modal water-modal irrigation-editor" title={editor.kind === 'sector' ? 'Nuevo sector de riego' : editor.kind === 'measurement' ? 'Nueva medición de humedad' : editor.kind === 'plan' ? 'Programar riego' : editor.kind === 'recurringSchedule' ? editor.record ? 'Editar recurrencia' : 'Nueva recurrencia' : editor.kind === 'recurringAction' ? editor.action === 'PAUSED' ? 'Pausar recurrencia' : editor.action === 'ACTIVE' ? 'Reanudar recurrencia' : 'Anular recurrencia' : editor.kind === 'waterSource' ? editor.record ? 'Editar fuente de agua' : 'Registrar fuente de agua' : editor.kind === 'quality' ? editor.record ? 'Editar calidad del agua' : 'Registrar calidad del agua' : editor.kind === 'infrastructure' ? editor.record ? 'Editar infraestructura hidráulica' : 'Registrar infraestructura hidráulica' : editor.kind === 'balance' ? editor.record ? 'Editar balance hídrico' : 'Registrar balance hídrico' : editor.kind === 'maintenance' ? editor.record ? 'Editar mantenimiento' : 'Programar mantenimiento' : editor.kind === 'sensorCheck' ? editor.record ? 'Editar verificación del sensor' : 'Verificar calibración del sensor' : editor.kind === 'execution' ? 'Registrar ejecución de riego' : editor.kind === 'thresholds' ? 'Configurar límites del sector' : 'Anular programación'} onClose={() => { if (!busy) setEditor(undefined); }} wide><form className="irrigation-form" onSubmit={submit}><fieldset className="irrigation-form-fields" disabled={busy}>{error && <p className="form-error" role="alert">{error}</p>}
      {editor.kind === 'sector' && <>
        <IrrigationFormSection title="Identificación del sector">
          <label>Bloque<select name="blockId" aria-label="Bloque" required>
            {data.blocks.map(block => <option value={block.id} key={block.id}>{block.code} · {block.areaHa ?? '—'} ha</option>)}
          </select></label>
          {input('Nombre del sector', 'name')}
          {input('Área del sector (ha)', 'areaHa', { type: 'number', min: 0.000001, step: 'any' })}
        </IrrigationFormSection>
        <IrrigationFormSection title="Sistema de riego">
          {input('Sistema de riego', 'system')}
          {input('Fuente de agua', 'waterSource')}
          {input('Caudal de referencia (m³/h, opcional)', 'flowM3h', { type: 'number', min: 0.000001, max: 1000000, step: 'any', required: false })}
        </IrrigationFormSection>
        <IrrigationFormSection title="Medición de humedad">
          <label>Tipo de humedad<select name="unit" aria-label="Tipo de humedad">
            {Object.entries(moistureUnits).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
          </select></label>
          {input('Profundidad de medición (cm)', 'depthCm', { type: 'number', min: 1, max: 300, value: 20 })}
          <label>Sensor asociado (opcional)<select name="sensorDeviceId" aria-label="Sensor asociado">
            <option value="">Lecturas manuales</option>
            {activeDevices.filter(device => device.block && !sectors.some(sector => sector.sensorDeviceId === device.id))
              .map(device => <option key={device.id} value={device.id}>{device.name} · {blockName(device.block!.id)}</option>)}
          </select></label>
          <Notice>Al asociar un sensor, confirma su calibración, unidad y profundidad. Se utilizan lecturas posteriores a la creación del sector.</Notice>
        </IrrigationFormSection>
        {thresholdsForm()}
      </>}
      {editor.kind === 'thresholds' && <>
        <Notice>{editor.sector.name} · {moistureUnits[editor.sector.unit]} · {editor.sector.depthCm} cm</Notice>
        {thresholdsForm(editor.sector)}
      </>}
      {editor.kind === 'measurement' && <>
        <IrrigationFormSection title="Lectura de humedad">
          {sectorSelect}
          {input('Fecha y hora de medición', 'recordedAt', { type: 'datetime-local', value: asLocalTime() })}
          {sectorConfig && <p className="irrigation-field-wide irrigation-form-caption">{moistureUnits[sectorConfig.unit]} · {sectorConfig.depthCm} cm de profundidad</p>}
          {input('Valor de humedad', 'value', { type: 'number', min: 0, max: sectorConfig?.unit === 'KPA' ? 1000000 : 100, step: 'any' })}
          {input('Instrumento o método', 'instrument')}
        </IrrigationFormSection>
        <IrrigationFormSection title="Lluvia y drenaje">
          {input('Lluvia registrada (mm, opcional)', 'rainMm', { type: 'number', min: 0, max: 10000, step: 'any', required: false })}
          <label className="irrigation-field-wide">Observación de drenaje<textarea name="drainage" maxLength={1000} /></label>
          <label className="irrigation-field-wide">Notas<textarea name="notes" maxLength={2000} /></label>
        </IrrigationFormSection>
      </>}
      {editor.kind === 'waterSource' && <>{input('Nombre de la fuente', 'name', { value: editor.record?.name })}<label>Tipo de fuente<select name="sourceType" defaultValue={editor.record?.sourceType ?? 'RESERVOIR'}><option value="RESERVOIR">Reservorio</option><option value="WELL">Pozo</option><option value="CANAL">Canal</option><option value="RIVER">Río</option><option value="RAINWATER">Agua lluvia</option><option value="OTHER">Otra fuente</option></select></label>{input('Capacidad (m³, opcional)', 'capacityM3', { type: 'number', min: 0, step: 'any', required: false, value: editor.record?.capacityM3 ?? undefined })}{input('Latitud (opcional)', 'latitude', { type: 'number', min: -90, max: 90, step: 'any', required: false, value: editor.record?.latitude ?? undefined })}{input('Longitud (opcional)', 'longitude', { type: 'number', min: -180, max: 180, step: 'any', required: false, value: editor.record?.longitude ?? undefined })}{editor.record && <label>Estado<select name="active" defaultValue={editor.record.active ? 'true' : 'false'}><option value="true">Activa</option><option value="false">Inactiva</option></select></label>}<label>Notas<textarea name="notes" defaultValue={editor.record?.notes ?? ''} /></label></>}
      {editor.kind === 'quality' && <>{(records.waterSources ?? []).length ? <label>Fuente<select name="sourceId" required defaultValue={editor.record?.sourceId ?? records.waterSources?.[0]?.id}>{(records.waterSources ?? []).map(source => <option value={source.id} key={source.id}>{source.name}</option>)}</select></label> : <Notice>Primero registra una fuente de agua para poder asociar este análisis.</Notice>}{input('Fecha de muestra', 'sampledOn', { type: 'date', value: editor.record?.sampledOn ?? localDate() })}{input('pH', 'ph', { type: 'number', min: 0, max: 14, step: 'any', required: false, value: editor.record?.ph ?? undefined })}{input('Conductividad (dS/m)', 'conductivityDsM', { type: 'number', min: 0, step: 'any', required: false, value: editor.record?.conductivityDsM ?? undefined })}{input('Salinidad (ppm)', 'salinityPpm', { type: 'number', min: 0, step: 'any', required: false, value: editor.record?.salinityPpm ?? undefined })}{input('Sólidos suspendidos (mg/L)', 'suspendedSolidsMgL', { type: 'number', min: 0, step: 'any', required: false, value: editor.record?.suspendedSolidsMgL ?? undefined })}{input('Referencia de laboratorio', 'laboratoryReference', { required: false, value: editor.record?.laboratoryReference ?? undefined })}<label>Notas<textarea name="notes" defaultValue={editor.record?.notes ?? ''} /></label></>}
      {editor.kind === 'infrastructure' && <>{input('Código del activo', 'code', { value: editor.record?.code })}<label>Tipo de activo<select name="assetType" defaultValue={editor.record?.assetType ?? 'FILTER'}><option value="FILTER">Filtro</option><option value="PUMP">Bomba</option><option value="VALVE">Válvula</option><option value="PIPE">Tubería</option><option value="METER">Medidor</option><option value="DRAIN">Drenaje</option><option value="CANAL">Canal</option><option value="RESERVOIR">Reservorio</option><option value="OTHER">Otro activo</option></select></label><label>Bloque asociado (opcional)<select name="blockId" defaultValue={editor.record?.blockId ?? ''}><option value="">Finca / general</option>{data.blocks.map(block => <option value={block.id} key={block.id}>{block.code}</option>)}</select></label><label>Fuente asociada (opcional)<select name="sourceId" defaultValue={editor.record?.sourceId ?? ''}><option value="">Sin fuente</option>{(records.waterSources ?? []).map(source => <option value={source.id} key={source.id}>{source.name}</option>)}</select></label><label>Estado<select name="status" defaultValue={editor.record?.status ?? 'ACTIVE'}><option value="ACTIVE">Activo</option><option value="MAINTENANCE">En mantenimiento</option><option value="INACTIVE">Inactivo</option></select></label>{input('Latitud (opcional)', 'latitude', { type: 'number', min: -90, max: 90, step: 'any', required: false, value: editor.record?.latitude ?? undefined })}{input('Longitud (opcional)', 'longitude', { type: 'number', min: -180, max: 180, step: 'any', required: false, value: editor.record?.longitude ?? undefined })}<label>Notas<textarea name="notes" defaultValue={editor.record?.notes ?? ''} /></label></>}
      {editor.kind === 'balance' && <>{sectorSelect}{input('Fecha', 'balanceDate', { type: 'date', value: editor.record?.balanceDate ?? localDate() })}{input('Lluvia (mm)', 'rainfallMm', { type: 'number', min: 0, step: 'any', value: editor.record?.rainfallMm })}{input('ET0 (mm, opcional)', 'et0Mm', { type: 'number', min: 0, step: 'any', required: false, value: editor.record?.et0Mm ?? undefined })}{input('Coeficiente de cultivo', 'cropCoefficient', { type: 'number', min: 0, step: 'any', required: false, value: editor.record?.cropCoefficient ?? undefined })}{input('Profundidad radicular (cm, opcional)', 'rootDepthCm', { type: 'number', min: 0, step: 'any', required: false, value: editor.record?.rootDepthCm ?? undefined })}{input('Agua disponible (mm, opcional)', 'availableWaterMm', { type: 'number', min: 0, step: 'any', required: false, value: editor.record?.availableWaterMm ?? undefined })}{input('Volumen requerido (m³, opcional)', 'requiredVolumeM3', { type: 'number', min: 0, step: 'any', required: false, value: editor.record?.requiredVolumeM3 ?? undefined })}{input('Volumen aplicado (m³, opcional)', 'appliedVolumeM3', { type: 'number', min: 0, step: 'any', required: false, value: editor.record?.appliedVolumeM3 ?? undefined })}{input('Déficit (mm, opcional)', 'deficitMm', { type: 'number', min: 0, step: 'any', required: false, value: editor.record?.deficitMm ?? undefined })}<label>Notas<textarea name="notes" defaultValue={editor.record?.notes ?? ''} /></label></>}
      {editor.kind === 'maintenance' && <><label>Sector asociado (opcional)<select name="sectorId" defaultValue={editor.record?.sectorId ?? ''}><option value="">General</option>{sectors.map(sector => <option value={sector.id} key={sector.id}>{sector.name} · {blockName(sector.blockId)}</option>)}</select></label><label>Infraestructura asociada (opcional)<select name="infrastructureId" defaultValue={editor.record?.infrastructureId ?? ''}><option value="">Sin activo específico</option>{(records.infrastructure ?? []).map(asset => <option value={asset.id} key={asset.id}>{asset.code} · {readable(asset.assetType, assetTypeLabels)}</option>)}</select></label><label>Tipo de mantenimiento<select name="maintenanceType" defaultValue={editor.record?.maintenanceType ?? 'FILTER_WASH'}><option value="FILTER_WASH">Lavado de filtro</option><option value="PUMP_CHECK">Revisión de bomba</option><option value="VALVE_CHECK">Revisión de válvula</option><option value="LEAK_REPAIR">Reparación de fuga</option><option value="METER_CALIBRATION">Calibración de medidor</option><option value="DRAIN_CLEANING">Limpieza de drenaje</option><option value="OTHER">Otro mantenimiento</option></select></label>{input('Fecha programada', 'scheduledOn', { type: 'date', value: editor.record?.scheduledOn ?? localDate() })}{input('Fecha de finalización (opcional)', 'completedOn', { type: 'date', required: false, value: editor.record?.completedOn ?? undefined })}<label>Estado<select name="status" defaultValue={editor.record?.status ?? 'PLANNED'}><option value="PLANNED">Programado</option><option value="IN_PROGRESS">En progreso</option><option value="COMPLETED">Completado</option><option value="BLOCKED">Bloqueado</option></select></label>{input('Presión (kPa, opcional)', 'pressureKpa', { type: 'number', min: 0, step: 'any', required: false, value: editor.record?.pressureKpa ?? undefined })}{input('Caudal (m³/h, opcional)', 'flowM3h', { type: 'number', min: 0, step: 'any', required: false, value: editor.record?.flowM3h ?? undefined })}<label>Notas<textarea name="notes" defaultValue={editor.record?.notes ?? ''} /></label></>}
      {editor.kind === 'sensorCheck' && <>{sectorSelect}{activeDevices.length ? <label>Sensor asociado<select name="sensorDeviceId" required defaultValue={editor.record?.sensorDeviceId ?? activeDevices[0]?.id}>{activeDevices.map(device => <option value={device.id} key={device.id}>{device.name}</option>)}</select></label> : input('ID del sensor', 'sensorDeviceId', { type: 'number', min: 1, value: editor.record?.sensorDeviceId })}{input('Fecha', 'checkedOn', { type: 'date', value: editor.record?.checkedOn ?? localDate() })}<label>Estado de calibración<select name="calibrationStatus" defaultValue={editor.record?.calibrationStatus ?? 'VALID'}><option value="VALID">Vigente</option><option value="DUE">Por verificar</option><option value="FAILED">Fallida</option></select></label>{input('Valor de referencia', 'referenceValue', { type: 'number', min: 0, step: 'any', required: false, value: editor.record?.referenceValue ?? undefined })}{input('Valor observado', 'observedValue', { type: 'number', min: 0, step: 'any', required: false, value: editor.record?.observedValue ?? undefined })}{input('Técnico', 'technician', { required: false, value: editor.record?.technician ?? undefined })}<label>Notas<textarea name="notes" defaultValue={editor.record?.notes ?? ''} /></label></>}
      {editor.kind === 'plan' && <>
        <IrrigationFormSection title="Sector y responsable">
          {sectorSelect}
          <label>Responsable<select name="assigneeId" aria-label="Responsable" required>
            {members.map(member => <option key={member.userId} value={member.userId}>{member.name}</option>)}
          </select></label>
          <Notice>{sectorConfig ? `${moistureLabels[sectorConfig.condition]}. ${sectorConfig.latest ? `${sectorConfig.latest.value} ${moistureUnits[sectorConfig.unit]}` : 'Sin lectura'}. Considera vigencia, lluvia y drenaje al justificar la programación.` : 'Selecciona un sector.'}</Notice>
        </IrrigationFormSection>
        <IrrigationFormSection title="Fecha, duración y volumen">
          {input('Fecha programada', 'scheduledOn', { type: 'date', value: localDate() })}
          {input('Hora programada', 'scheduledTime', { type: 'time', value: '08:00' })}
          {input('Duración prevista (min)', 'durationMinutes', { type: 'number', min: 0.000001, max: 43200, step: 'any' })}
          {input('Volumen previsto (m³)', 'volumeM3', { type: 'number', min: 0.000001, max: 1000000000, step: 'any' })}
        </IrrigationFormSection>
        <IrrigationFormSection title="Instrucciones">
          <label>Justificación técnica<textarea name="justification" required maxLength={2000} /></label>
          <label>Instrucciones de ejecución<textarea name="instructions" required maxLength={1000} /></label>
        </IrrigationFormSection>
      </>}
      {editor.kind === 'recurringSchedule' && <>{sectorSelect}{input('Fecha de inicio', 'startDate', { type: 'date', value: editor.record?.startDate ?? localDate() })}{input('Fecha final', 'endDate', { type: 'date', value: editor.record?.endDate ?? localDate(new Date(Date.now() + 30 * 86400000)) })}{input('Hora programada', 'scheduledTime', { type: 'time', value: editor.record?.scheduledTime ?? '08:00' })}<label>Frecuencia<select name="recurrenceUnit" aria-label="Frecuencia" defaultValue={editor.record?.recurrenceUnit ?? 'DAILY'}><option value="DAILY">Diaria</option><option value="WEEKLY">Semanal</option></select></label>{input('Cada cuántos días o semanas', 'recurrenceInterval', { type: 'number', min: 1, max: 365, value: editor.record?.recurrenceInterval ?? 1 })}{input('Duración por ocurrencia (min)', 'durationMinutes', { type: 'number', min: 0.000001, max: 43200, step: 'any', value: editor.record?.durationMinutes ?? 60 })}{input('Volumen por ocurrencia (m³)', 'volumeM3', { type: 'number', min: 0.000001, max: 1000000000, step: 'any', value: editor.record?.volumeM3 ?? 12 })}<label>Responsable<select name="assigneeId" aria-label="Responsable" required defaultValue={editor.record?.assigneeId ?? members[0]?.userId}>{members.map(member => <option key={member.userId} value={member.userId}>{member.name}</option>)}</select></label><label>Justificación técnica<textarea name="justification" required maxLength={2000} defaultValue={editor.record?.justification ?? ''} /></label><label>Instrucciones de ejecución<textarea name="instructions" required maxLength={1000} defaultValue={editor.record?.instructions ?? ''} /></label><Notice>Se generan ocurrencias y tareas por adelantado hasta 30 días. Editar la recurrencia aplica a las fechas futuras aún no generadas.</Notice></>}
      {editor.kind === 'recurringAction' && <>{editor.action === 'CANCELED' ? <label>Motivo de anulación<textarea name="reason" required maxLength={2000} /></label> : <Notice>{editor.action === 'PAUSED' ? 'No se crearán nuevas ocurrencias mientras la recurrencia esté pausada.' : 'La generación automática continuará para las fechas futuras.'}</Notice>}</>}
      {editor.kind === 'cancel' && <label>Motivo de anulación<textarea name="reason" required maxLength={2000} /></label>}
      {editor.kind === 'execution' && <>
        <div className="farm-work-context">
          <span className="farm-work-context-icon"><Droplets size={24} /></span>
          <div><strong>{sectorName(editor.plan.sectorId)}</strong><small>Programación del {editor.plan.scheduledOn} · {editor.plan.scheduledTime.slice(0, 5)}</small></div>
          <div className="farm-work-context-amount"><small>Volumen y tiempo previstos</small><strong>{number(editor.plan.volumeM3, 2)} m³ · {number(editor.plan.durationMinutes, 2)} min</strong></div>
        </div>
        <IrrigationFormSection title="Tiempo de riego">
          {input('Inicio real', 'startedAt', { type: 'datetime-local', value: asLocalTime(new Date(Date.now() - 3600000)) })}
          {input('Fin real', 'endedAt', { type: 'datetime-local', value: asLocalTime() })}
          {input('Interrupciones (min)', 'interruptionMinutes', { type: 'number', min: 0, max: 43200, step: 'any', value: 0 })}
        </IrrigationFormSection>
        <IrrigationFormSection title="Volumen aplicado">
          <label>Origen del volumen
            <select aria-label="Origen del volumen" value={volumeMode} onChange={event => setVolumeMode(event.target.value as 'METER' | 'FLOW')}>
              <option value="METER">Medido por contador</option>
              <option value="FLOW">Estimado por caudal × tiempo efectivo</option>
            </select>
          </label>
          {volumeMode === 'METER' ? <>
            <label>Unidad del contador<select name="meterUnit" aria-label="Unidad del contador"><option value="M3">m³</option><option value="L">Litros</option></select></label>
            {input('Lectura inicial del contador', 'meterStart', { type: 'number', min: 0, max: 1e12, step: 'any' })}
            {input('Lectura final del contador', 'meterEnd', { type: 'number', min: 0, max: 1e12, step: 'any' })}
          </> : input('Caudal utilizado para estimación (m³/h)', 'flowM3h', { type: 'number', min: 0.000001, max: 1000000, step: 'any', value: sectors.find(sector => sector.id === editor.plan.sectorId)?.flowM3h })}
        </IrrigationFormSection>
        <IrrigationFormSection title="Observaciones">
          <label>Justificación de desviación (obligatoria si supera lo previsto)<textarea name="varianceReason" maxLength={2000} /></label>
          <label>Novedades y revisión de drenaje<textarea name="notes" maxLength={2000} /></label>
        </IrrigationFormSection>
        <Notice>Las ejecuciones parciales se acumulan. Puedes adjuntar fotos después de guardar y completar la tarea desde Mi trabajo de hoy.</Notice>
      </>}
      <div className="form-actions"><button className="button secondary" type="button" onClick={() => setEditor(undefined)}>Cancelar</button><button className="button" type="submit">{busy ? 'Guardando…' : 'Guardar'}</button></div></fieldset></form></Modal>}
    {detail && !editor && <Modal
      className="farm-work-modal water-modal irrigation-detail"
      title={'eventId' in detail ? `Ejecución #${detail.id}` : 'scheduledOn' in detail ? `Programación #${detail.id}` : detail.name}
      onClose={() => { if (!photoBusy && !busy) setDetail(undefined); }}
      wide
    >
      {error && <p className="form-error" role="alert">{error}</p>}
      <IrrigationDetails detail={detail} plans={plans} measurements={measurements}
        sectorName={sectorName} blockName={blockName} memberName={memberName} onPhotoBusy={setPhotoBusy} />
    </Modal>}
  </>;
}

function IrrigationFormSection({ title, children }: { title: string; children: ReactNode }) {
  return <fieldset className="irrigation-form-section"><legend>{title}</legend>{children}</fieldset>;
}

function IrrigationAlerts({ sectors, plans, records, onReview, onViewAll }: { sectors: IrrigationSector[]; plans: IrrigationPlan[]; records: IrrigationData; onReview: (tab: 'measurements' | 'plans' | 'management') => void; onViewAll?: () => void }) {
  type AlertItem = { id: string; severity: 'critical' | 'warning' | 'info'; title: string; detail: string; meta: string; icon: 'moisture' | 'sensor' | 'schedule' | 'maintenance' };
  const alerts: AlertItem[] = [];
  sectors.forEach(sector => {
    if (sector.condition === 'BELOW_RANGE') alerts.push({ id: `dry-${sector.id}`, severity: 'critical', title: `${sector.name} requiere revisión`, detail: 'La última lectura está por debajo del rango técnico configurado.', meta: sector.latest ? `${sector.latest.value} · límite inferior ${sector.lowerBound}` : 'Sin lectura', icon: 'moisture' });
    if (sector.condition === 'ABOVE_RANGE') alerts.push({ id: `wet-${sector.id}`, severity: 'warning', title: `${sector.name} supera el rango configurado`, detail: sector.unit === 'KPA' ? 'La tensión del suelo supera el límite configurado. Revisa la lectura y la programación.' : 'Revisa el drenaje, la lluvia reciente y la programación vigente.' , meta: sector.latest ? `${sector.latest.value} · límite superior ${sector.upperBound}` : 'Sin lectura', icon: 'moisture' });
    if (sector.condition === 'STALE' || sector.condition === 'NO_DATA') alerts.push({ id: `sensor-${sector.id}`, severity: 'warning', title: `${sector.name} sin lectura confiable`, detail: sector.sensorDeviceId ? 'El sensor no tiene una lectura vigente; revisa comunicación y calibración.' : 'Registra una medición antes de tomar una decisión de riego.', meta: sector.sensorDeviceId ? `Sensor #${sector.sensorDeviceId}` : 'Medición manual pendiente', icon: 'sensor' });
  });
  plans.forEach(plan => {
    const overdue = plan.status === 'SCHEDULED' && `${plan.scheduledOn}T${plan.scheduledTime}` < asLocalTime() && !plan.taskStatus;
    const exceeded = plan.actualVolumeM3 > plan.volumeM3 || plan.actualDurationMinutes > plan.durationMinutes;
    if (overdue) alerts.push({ id: `late-${plan.id}`, severity: 'warning', title: `Programación #${plan.id} pendiente`, detail: 'La programación pasó su hora prevista y aún no tiene revisión de ejecución.', meta: `${plan.scheduledOn} · ${plan.scheduledTime}`, icon: 'schedule' });
    if (exceeded) alerts.push({ id: `variance-${plan.id}`, severity: 'warning', title: `Desviación en programación #${plan.id}`, detail: 'El consumo o la duración real superan lo planificado.', meta: `${plan.actualVolumeM3} / ${plan.volumeM3} m³`, icon: 'schedule' });
  });
  (records.maintenance ?? []).filter(item => item.status === 'BLOCKED').forEach(item => alerts.push({ id: `maintenance-${item.id}`, severity: 'critical', title: `Mantenimiento bloqueado: ${item.maintenanceType}`, detail: item.notes || 'Requiere una revisión del responsable.', meta: `Programado ${item.scheduledOn}`, icon: 'maintenance' }));
  const ordered = alerts.sort((first, second) => ({ critical: 0, warning: 1, info: 2 }[first.severity] - ({ critical: 0, warning: 1, info: 2 }[second.severity])));
  const icon = (kind: AlertItem['icon']) => kind === 'moisture' ? <Droplets size={18} /> : kind === 'sensor' ? <Gauge size={18} /> : kind === 'schedule' ? <Clock3 size={18} /> : <ThermometerSun size={18} />;
  if (onViewAll) return <section className="irrigation-alert-card">
    <div className="irrigation-section-heading">
      <h3>Alertas de riego</h3>
      <button className="text-button" onClick={onViewAll}>Ver todas <ArrowRight size={15} /></button>
    </div>
    {ordered.slice(0, 4).map(alert => <div className="irrigation-dashboard-alert" key={alert.id}>
      <span className={`irrigation-alert-symbol ${alert.severity}`}>{alert.severity === 'critical' ? <TriangleAlert size={19} /> : icon(alert.icon)}</span>
      <div>
        <div className="irrigation-alert-title"><strong>{alert.title}</strong><span className={`irrigation-alert-priority ${alert.severity}`}>{alert.severity === 'critical' ? 'Crítica' : alert.severity === 'warning' ? 'Advertencia' : 'Información'}</span></div>
        <small>{alert.detail}</small><em>{alert.meta}</em>
      </div>
      <button className="outline-action" onClick={() => onReview(alert.icon === 'maintenance' ? 'management' : alert.icon === 'schedule' ? 'plans' : 'measurements')}>Revisar</button>
    </div>)}
    {!ordered.length && <div className="irrigation-alerts-empty"><CheckCircle2 size={24} /><strong>Sin alertas pendientes</strong><p>Las lecturas fuera de rango y las incidencias de programación aparecen aquí.</p></div>}
  </section>;
  return <section className="irrigation-alert-center"><div className="alert-center-heading"><div><span className="eyebrow">CONTROL OPERATIVO</span><h2>Alertas de riego</h2><p>Prioriza humedad, sensores, programación y mantenimiento antes de intervenir.</p></div><div className="alert-counts"><strong>{ordered.filter(item => item.severity === 'critical').length}<small>Críticas</small></strong><strong>{ordered.filter(item => item.severity === 'warning').length}<small>Advertencias</small></strong><strong>{ordered.length === 0 ? <CheckCircle2 size={20} /> : ordered.length}<small>{ordered.length === 0 ? 'Todo controlado' : 'Pendientes'}</small></strong></div></div>{ordered.length === 0 ? <div className="alert-empty"><CheckCircle2 size={21} /><span>No hay alertas activas para los sectores visibles.</span></div> : <div className="alert-list">{ordered.map(item => <article className={`irrigation-alert alert-${item.severity}`} key={item.id}><span className="alert-icon">{icon(item.icon)}</span><div className="alert-copy"><div><strong>{item.title}</strong><span className="alert-severity">{item.severity === 'critical' ? 'CRÍTICA' : item.severity === 'warning' ? 'ADVERTENCIA' : 'INFO'}</span></div><p>{item.detail}</p><small>{item.meta}</small></div><button className="alert-action" onClick={() => onReview(item.icon === 'schedule' ? 'plans' : item.icon === 'maintenance' ? 'management' : 'measurements')}><BellRing size={14} /> Revisar</button></article>)}</div>}</section>;
}

function RecurringSchedulePanel({ schedules, sectors, members, manager, busy, onCreate, onEdit, onGenerate, onAction }: { schedules: IrrigationRecurringSchedule[]; sectors: IrrigationSector[]; members: Member[]; manager: boolean; busy: boolean; onCreate: () => void; onEdit: (schedule: IrrigationRecurringSchedule) => void; onGenerate: (schedule: IrrigationRecurringSchedule) => void; onAction: (schedule: IrrigationRecurringSchedule, action: RecurringAction) => void }) {
  const sectorName=(id: number) => sectors.find(sector => sector.id === id)?.name ?? `Sector #${id}`;
  const memberName=(id: number) => members.find(member => member.userId === id)?.name ?? `Usuario #${id}`;
  const cadence=(schedule: IrrigationRecurringSchedule) => `Cada ${schedule.recurrenceInterval} ${recurrenceUnitLabels[schedule.recurrenceUnit].toLowerCase()}`;
  return <Panel title="Programaciones recurrentes" action={manager && <button className="button small" disabled={!sectors.length} onClick={onCreate}>Nueva recurrencia</button>}><div className="table-wrap"><table><thead><tr><th>Sector / frecuencia</th><th>Vigencia / hora</th><th>Responsable</th><th>Próximas ocurrencias</th><th>Estado</th><th>Historial</th><th>Acciones</th></tr></thead><tbody>{schedules.map(schedule => <tr key={schedule.id}><td><strong>{sectorName(schedule.sectorId)}</strong><br /><small>{cadence(schedule)} · {schedule.durationMinutes} min · {schedule.volumeM3} m³</small></td><td>{schedule.startDate} — {schedule.endDate}<br />{schedule.scheduledTime}</td><td>{memberName(schedule.assigneeId)}</td><td>{(schedule.upcoming ?? []).slice(0, 3).map(item => `${item.date}${item.generated ? ' ✓' : ''}`).join(', ') || 'Sin fechas próximas'}<br /><small>{schedule.generatedCount ?? 0} planes · {schedule.taskCount ?? 0} tareas</small></td><td><Badge tone={schedule.status === 'ACTIVE' ? 'green' : schedule.status === 'PAUSED' ? 'gold' : 'neutral'}>{recurringStatusLabels[schedule.status]}</Badge></td><td>{schedule.historyCount ?? 0} eventos</td><td>{manager && schedule.status !== 'CANCELED' && <><button className="text-button" onClick={() => onEdit(schedule)}>Editar</button>{schedule.status === 'ACTIVE' ? <button className="text-button" disabled={busy} onClick={() => onAction(schedule,'PAUSED')}>Pausar</button> : <button className="text-button" onClick={() => onAction(schedule,'ACTIVE')}>Reanudar</button>}{schedule.status === 'ACTIVE' && <button className="text-button" disabled={busy} onClick={() => void onGenerate(schedule)}>Generar próximas</button>}<button className="text-button" onClick={() => onAction(schedule,'CANCELED')}>Anular</button></>}</td></tr>)}</tbody></table></div>{!schedules.length && <p className="muted">No hay recurrencias. Crea una para generar tareas de riego sin duplicar fechas.</p>}</Panel>;
}

function WaterManagement({ records, manager, onOpen, sectors, blockName, filter, devices }: { records: IrrigationData; manager: boolean; onOpen: (kind: ManagementAction, record?: ManagementRecord) => void; sectors: IrrigationSector[]; blockName: (id: number) => string; filter: string; devices: Device[] }) {
  const selectedSector = filter ? sectors.find(sector => sector.id === Number(filter)) : undefined;
  const sourceNames = new Map((records.waterSources ?? []).map(source => [source.id, source.name]));
  const assetNames = new Map((records.infrastructure ?? []).map(asset => [asset.id, asset.code]));
  const sensorNames = new Map(devices.map(device => [device.id, device.name]));
  const balances = (records.waterBalances ?? []).filter(balance => !selectedSector || balance.sectorId === selectedSector.id);
  const maintenance = (records.maintenance ?? []).filter(item => !selectedSector || item.sectorId == null || item.sectorId === selectedSector.id);
  const checks = (records.sensorChecks ?? []).filter(check => !selectedSector || check.sectorId === selectedSector.id);
  const infrastructure = (records.infrastructure ?? []).filter(asset => !selectedSector || asset.blockId == null || asset.blockId === selectedSector.blockId);
  const pendingMaintenance = maintenance.filter(item => item.status !== 'COMPLETED').length;
  const pendingChecks = checks.filter(check => check.calibrationStatus !== 'VALID').length;
  const edit = (kind: ManagementAction, record: ManagementRecord) => manager ? <button className="text-button" onClick={() => onOpen(kind, record)}>Editar</button> : null;
  return <div className="water-management-content">
    <div className="water-management-heading"><div><h2>Agua, infraestructura y mantenimiento</h2><p>Consulta fuentes, activos, calidad del agua y mantenimiento.</p></div>{manager && <div className="water-management-actions"><button className="button small" onClick={() => onOpen('waterSource')}>Nueva fuente</button><button className="button small" onClick={() => onOpen('infrastructure')}>Nuevo activo</button><button className="button small secondary" onClick={() => onOpen('quality')}>Registrar calidad</button><button className="button small secondary" onClick={() => onOpen('balance')}>Nuevo balance</button><button className="button small secondary" onClick={() => onOpen('maintenance')}>Programar mantenimiento</button><button className="button small secondary" onClick={() => onOpen('sensorCheck')}>Verificar sensor</button></div>}</div>
    <div className="water-management-summary"><div><strong>{(records.waterSources ?? []).filter(source => source.active).length}</strong><span>Fuentes activas</span></div><div><strong>{infrastructure.length}</strong><span>Activos visibles</span></div><div><strong>{records.waterQuality?.length ?? 0}</strong><span>Análisis de calidad</span></div><div><strong>{pendingMaintenance}</strong><span>Mantenimientos abiertos</span></div><div><strong>{balances.length}</strong><span>Balances visibles</span></div><div><strong>{pendingChecks}</strong><span>Sensores por verificar</span></div></div>
    <div className="water-management-grid">
      <Panel title="Fuentes de agua"><div className="table-wrap"><table><thead><tr><th>Fuente</th><th>Tipo</th><th>Capacidad</th><th>Estado</th><th>Acciones</th></tr></thead><tbody>{(records.waterSources ?? []).map(source => <tr key={source.id}><td><strong>{source.name}</strong><br /><small>{source.notes || 'Sin notas'}</small></td><td>{readable(source.sourceType, sourceTypeLabels)}</td><td>{source.capacityM3 != null ? `${source.capacityM3} m³` : 'Sin capacidad'}</td><td><Badge tone={source.active ? 'green' : 'neutral'}>{source.active ? 'Activa' : 'Inactiva'}</Badge></td><td>{edit('waterSource', source)}</td></tr>)}</tbody></table></div>{!(records.waterSources ?? []).length && <p className="muted">No hay fuentes registradas. Crea una para asociar calidad e infraestructura.</p>}</Panel>
      <Panel title="Calidad del agua"><div className="table-wrap"><table><thead><tr><th>Fuente</th><th>Fecha</th><th>pH</th><th>Conductividad</th><th>Salinidad</th><th>Sólidos</th><th>Referencia</th><th>Acciones</th></tr></thead><tbody>{(records.waterQuality ?? []).map(sample => <tr key={sample.id}><td>{sourceNames.get(sample.sourceId) ?? `Fuente #${sample.sourceId}`}</td><td>{sample.sampledOn}</td><td>{sample.ph ?? '—'}</td><td>{sample.conductivityDsM != null ? `${sample.conductivityDsM} dS/m` : '—'}</td><td>{sample.salinityPpm != null ? `${sample.salinityPpm} ppm` : '—'}</td><td>{sample.suspendedSolidsMgL != null ? `${sample.suspendedSolidsMgL} mg/L` : '—'}</td><td>{sample.laboratoryReference || 'Sin referencia'}</td><td>{edit('quality', sample)}</td></tr>)}</tbody></table></div>{!(records.waterQuality ?? []).length && <p className="muted">Registra el análisis de laboratorio de cada fuente para conservar el control de calidad.</p>}</Panel>
      <Panel title="Infraestructura hidráulica"><div className="table-wrap"><table><thead><tr><th>Activo</th><th>Tipo</th><th>Ubicación</th><th>Fuente</th><th>Estado</th><th>Acciones</th></tr></thead><tbody>{infrastructure.map(asset => <tr key={asset.id}><td><strong>{asset.code}</strong><br /><small>{asset.notes || 'Sin notas'}</small></td><td>{readable(asset.assetType, assetTypeLabels)}</td><td>{asset.blockId != null ? blockName(asset.blockId) : 'Finca / general'}</td><td>{asset.sourceId != null ? sourceNames.get(asset.sourceId) ?? `Fuente #${asset.sourceId}` : 'Sin fuente'}</td><td><Badge tone={asset.status === 'ACTIVE' ? 'green' : asset.status === 'MAINTENANCE' ? 'gold' : 'neutral'}>{readable(asset.status, assetStatusLabels)}</Badge></td><td>{edit('infrastructure', asset)}</td></tr>)}</tbody></table></div>{!infrastructure.length && <p className="muted">No hay activos hidráulicos para el filtro seleccionado.</p>}</Panel>
      <Panel title="Balances hídricos"><div className="table-wrap"><table><thead><tr><th>Sector</th><th>Fecha</th><th>Lluvia</th><th>Aplicado / requerido</th><th>Déficit</th><th>Acciones</th></tr></thead><tbody>{balances.map(balance => <tr key={balance.id}><td>{sectors.find(sector => sector.id === balance.sectorId)?.name ?? `Sector #${balance.sectorId}`}</td><td>{balance.balanceDate}</td><td>{balance.rainfallMm} mm</td><td>{balance.appliedVolumeM3 ?? '—'} / {balance.requiredVolumeM3 ?? '—'} m³</td><td>{balance.deficitMm != null ? `${balance.deficitMm} mm` : 'No calculado'}</td><td>{edit('balance', balance)}</td></tr>)}</tbody></table></div>{!balances.length && <p className="muted">No hay balances para el sector seleccionado.</p>}</Panel>
      <Panel title="Mantenimiento"><div className="table-wrap"><table><thead><tr><th>Actividad</th><th>Fecha</th><th>Activo / sector</th><th>Estado</th><th>Acciones</th></tr></thead><tbody>{maintenance.map(item => <tr key={item.id}><td><strong>{readable(item.maintenanceType, maintenanceTypeLabels)}</strong><br /><small>{item.notes || 'Sin notas'}</small></td><td>{item.scheduledOn}{item.completedOn && <><br /><small>Completado: {item.completedOn}</small></>}</td><td>{item.infrastructureId != null ? assetNames.get(item.infrastructureId) ?? `Activo #${item.infrastructureId}` : item.sectorId != null ? sectors.find(sector => sector.id === item.sectorId)?.name ?? `Sector #${item.sectorId}` : 'General'}</td><td><Badge tone={item.status === 'COMPLETED' ? 'green' : item.status === 'BLOCKED' ? 'red' : 'gold'}>{readable(item.status, maintenanceStatusLabels)}</Badge></td><td>{edit('maintenance', item)}</td></tr>)}</tbody></table></div>{!maintenance.length && <p className="muted">No hay mantenimientos para el sector seleccionado.</p>}</Panel>
      <Panel title="Calibración de sensores"><div className="table-wrap"><table><thead><tr><th>Sector</th><th>Sensor</th><th>Fecha</th><th>Estado</th><th>Referencia / observado</th><th>Acciones</th></tr></thead><tbody>{checks.map(check => <tr key={check.id}><td>{sectors.find(sector => sector.id === check.sectorId)?.name ?? `Sector #${check.sectorId}`}</td><td>{sensorNames.get(check.sensorDeviceId) ?? `Sensor #${check.sensorDeviceId}`}</td><td>{check.checkedOn}</td><td><Badge tone={check.calibrationStatus === 'VALID' ? 'green' : 'red'}>{readable(check.calibrationStatus, calibrationStatusLabels)}</Badge></td><td>{check.referenceValue ?? '—'} / {check.observedValue ?? '—'}</td><td>{edit('sensorCheck', check)}</td></tr>)}</tbody></table></div>{!checks.length && <p className="muted">No hay verificaciones para el sector seleccionado.</p>}</Panel>
    </div>
  </div>;
}
