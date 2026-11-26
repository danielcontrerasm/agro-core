import { request } from './api';
import { readDemo, saveDemo } from './demo';
import type { Inspection } from './inspections';

export interface MonitoringSchedule {
  startDate: string;
  intervalDays: number;
  incidenceThresholdPercent: number | null;
}

export interface MonitoringPlanSettings extends MonitoringSchedule {
  id: number;
  farmId: number;
  blockId: number;
  problemCode: string;
  active: boolean;
  version: number;
}

export interface MonitoringPlan extends MonitoringPlanSettings {
  nextDueDate: string | null;
  lastInspectionId: number | null;
  lastInspectionDate: string | null;
  overdue: boolean;
}

export interface MonitoringAlert {
  id: number;
  planId: number;
  inspectionId: number;
  farmId: number;
  blockId: number;
  problemCode: string;
  incidencePercent: number;
  thresholdPercent: number;
  createdAt: string;
  status: 'OPEN' | 'REVIEWED';
  reviewNotes: string | null;
  reviewedByUserId: number | null;
  reviewedAt: string | null;
  inspectionCanceledAt?: string | null;
  version: number;
}

export type NewMonitoringPlan = MonitoringSchedule & Pick<MonitoringPlanSettings, 'farmId' | 'blockId' | 'problemCode'>;
export type DemoMonitoredInspection = Inspection & { demoMonitoringAlert?: MonitoringAlert };

const path = '/inspection-monitoring';
export const monitoringApi = {
  plans: (farmId: number) => request<MonitoringPlan[]>(`${path}/plans?farmId=${farmId}`),
  alerts: (farmId: number) => request<MonitoringAlert[]>(`${path}/alerts?farmId=${farmId}`),
  create: (payload: NewMonitoringPlan) => request<MonitoringPlan>(`${path}/plans`, 'POST', payload),
  edit: (id: number, payload: MonitoringSchedule & { version: number }) =>
    request<MonitoringPlan>(`${path}/plans/${id}`, 'PUT', payload),
  toggle: (id: number, version: number, active: boolean) =>
    request<MonitoringPlan>(`${path}/plans/${id}`, 'PATCH', { version, active }),
  review: (id: number, version: number, reviewNotes: string) =>
    request<MonitoringAlert>(`${path}/alerts/${id}/review`, 'POST', { version, reviewNotes }),
};

const dayMs = 86_400_000;

export function monitoringDate(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

export function monitoringWindowStart(plan: MonitoringSchedule, date: string) {
  const start = Date.parse(plan.startDate);
  const elapsed = Math.max(0, Math.floor((Date.parse(date) - start) / dayMs));
  return monitoringDate(new Date(start + (elapsed - elapsed % plan.intervalDays) * dayMs));
}

export function followingMonitoringWindow(plan: MonitoringSchedule, date: string) {
  return monitoringDate(new Date(Date.parse(monitoringWindowStart(plan, date)) + plan.intervalDays * dayMs));
}

export const monitoringPlansDemoKey = 'inspection-monitoring-plans';

export function readDemoMonitoringPlans(farmId: number) {
  return readDemo<MonitoringPlanSettings[]>(monitoringPlansDemoKey, []).filter(plan => plan.farmId === farmId);
}

export function saveDemoMonitoringPlans(farmId: number, plans: MonitoringPlanSettings[]) {
  const otherFarms = readDemo<MonitoringPlanSettings[]>(monitoringPlansDemoKey, []).filter(plan => plan.farmId !== farmId);
  if (!saveDemo(monitoringPlansDemoKey, [...otherFarms, ...plans])) throw new Error('No se pudo guardar el plan en este navegador.');
}

function matches(plan: MonitoringPlanSettings, inspection: Inspection) {
  return plan.farmId === inspection.farmId && plan.blockId === inspection.blockId
    && plan.problemCode === inspection.problemCode && monitoringDate(new Date(inspection.inspectedAt)) >= plan.startDate;
}

export function summarizeDemoPlan(plan: MonitoringPlanSettings, records: Inspection[], today = monitoringDate()): MonitoringPlan {
  const latest = records.filter(record => !record.canceledAt && matches(plan, record))
    .sort((first, second) => Date.parse(second.inspectedAt) - Date.parse(first.inspectedAt) || second.id - first.id)[0];
  const lastInspectionDate = latest ? monitoringDate(new Date(latest.inspectedAt)) : null;
  const nextDueDate = !plan.active ? null
    : lastInspectionDate ? followingMonitoringWindow(plan, lastInspectionDate) : plan.startDate;
  return { ...plan, lastInspectionId: latest?.id ?? null, lastInspectionDate, nextDueDate, overdue: nextDueDate != null && nextDueDate < today };
}

export function addDemoMonitoringAlert(inspection: Inspection): DemoMonitoredInspection {
  const plan = readDemoMonitoringPlans(inspection.farmId).find(item => item.active && matches(item, inspection));
  if (plan?.incidenceThresholdPercent == null || inspection.incidencePercent < plan.incidenceThresholdPercent) {
    return inspection;
  }
  return {
    ...inspection,
    demoMonitoringAlert: {
      id: inspection.id,
      planId: plan.id,
      inspectionId: inspection.id,
      farmId: plan.farmId,
      blockId: plan.blockId,
      problemCode: plan.problemCode,
      incidencePercent: inspection.incidencePercent,
      thresholdPercent: plan.incidenceThresholdPercent,
      createdAt: new Date().toISOString(),
      status: 'OPEN',
      reviewNotes: null,
      reviewedByUserId: null,
      reviewedAt: null,
      version: 0,
    },
  };
}
