import { useEffect, useMemo, useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import {
  Activity,
  ArrowRight,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronRight,
  ClipboardCheck,
  ClipboardList,
  Download,
  FileText,
  Home,
  ListChecks,
  MapPin,
  MoreHorizontal,
  PackageCheck,
  Play,
  Plus,
  RefreshCw,
  Ruler,
  Sprout,
  Users,
} from 'lucide-react';
import { useApp } from '../context';
import { api } from '../lib/api';
import { readCatalogForFarm, type CropCatalog } from '../lib/catalog';
import { demoSuggestions, readCalendarsForFarm, type CalendarSuggestion } from '../lib/calendar';
import {
  demoPlanting,
  plantingKey,
  readPlantingDemo,
  type Cycle,
  type MaterialLot,
  type PlantingData,
  type PlantingExecution,
  type PlantingPlan,
} from '../lib/planting';
import { csvCell, localDate } from '../lib/domain';
import type { Member } from '../lib/types';
import FarmMap from '../components/FarmMap';
import { Badge, Empty, Loading, Modal, Notice } from '../components/ui';
import '../planting.css';

const statusLabels: Record<string, string> = {
  DRAFT: 'Planeación',
  PLANNED: 'Planeación',
  ESTABLISHING: 'Establecimiento',
  ACTIVE: 'Activo',
  CLOSED: 'Cerrado',
  CANCELED: 'Cancelado',
  APPROVED: 'Aprobado',
  RECEIVED: 'Recibido',
  ACCEPTED: 'Aceptado',
  REJECTED: 'Rechazado',
};

const stageLabels: Record<string, string> = {
  PLANNED: 'Planificación',
  ESTABLISHMENT: 'Establecimiento',
  VEGETATIVE: 'Vegetativo',
  FLOWERING: 'Floración',
  FILLING: 'Llenado',
  HARVEST: 'Cosecha',
  RENEWAL: 'Renovación',
  CLOSED: 'Cerrado',
};

const materialTypeLabels: Record<string, string> = {
  IN_VITRO: 'In vitro',
  CORM: 'Cormo',
  COLINO: 'Colino',
  OTHER: 'Otro',
};

const statusTone = (status: string) => {
  if (['REJECTED', 'CANCELED', 'CLOSED'].includes(status)) return 'red';
  if (status === 'RECEIVED') return 'neutral';
  if (status === 'ESTABLISHING') return 'blue';
  if (['DRAFT', 'PLANNED', 'APPROVED'].includes(status)) return 'green';
  return 'green';
};

const dateLabel = (value?: string | null) => {
  if (!value) return 'Sin fecha';
  const date = new Date(value + (value.length === 10 ? 'T12:00:00' : ''));
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' });
};

const numberLabel = (value: number | undefined, digits = 0) => new Intl.NumberFormat('es-CO', { maximumFractionDigits: digits }).format(Number(value ?? 0));

type ModalName = 'cycle' | 'assessment' | 'material' | 'materialDecision' | 'plan' | 'planDecision' | 'execution' | 'establishment' | 'stage' | null;
type DetailTab = 'summary' | 'material' | 'plan' | 'execution' | 'followup' | 'files';
type DemoUpdate = (current: PlantingData) => PlantingData;

const tabs: { id: DetailTab; label: string; icon: LucideIcon }[] = [
  { id: 'summary', label: 'Resumen', icon: Activity },
  { id: 'material', label: 'Material vegetal', icon: PackageCheck },
  { id: 'plan', label: 'Plan de siembra', icon: ClipboardList },
  { id: 'execution', label: 'Ejecución', icon: Play },
  { id: 'followup', label: 'Seguimiento', icon: ListChecks },
  { id: 'files', label: 'Archivos', icon: FileText },
];

export default function Planting() {
  const app = useApp();
  const { mode, farmId, data, profile, role, notify } = app;
  const canManage = role !== 'WORKER';
  const [planting, setPlanting] = useState<PlantingData>(() => readPlantingDemo());
  const [catalog, setCatalog] = useState<CropCatalog[]>(() => readCatalogForFarm(farmId));
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(mode === 'live');
  const [busy, setBusy] = useState(false);
  const [actionMenu, setActionMenu] = useState(false);
  const [modal, setModal] = useState<ModalName>(null);
  const [activePlan, setActivePlan] = useState<PlantingPlan | null>(null);
  const [activeMaterial, setActiveMaterial] = useState<MaterialLot | null>(null);
  const [selectedCycleId, setSelectedCycleId] = useState<number | undefined>();
  const [detailTab, setDetailTab] = useState<DetailTab>('summary');
  const [cycleFilter, setCycleFilter] = useState('all');
  const [cycleCropId, setCycleCropId] = useState('');
  const [cycleVarietyId, setCycleVarietyId] = useState('');
  const [calendarSuggestion, setCalendarSuggestion] = useState<CalendarSuggestion | null>(null);
  const [cycleFrom, setCycleFrom] = useState(localDate());
  const [cycleTo, setCycleTo] = useState(localDate());

  const cycleCrop = catalog.find(crop => String(crop.id) === cycleCropId);
  const cycleVarieties = useMemo(() => cycleCrop?.varieties ?? [], [cycleCrop]);
  const cycleVariety = cycleVarieties.find(variety => String(variety.id) === cycleVarietyId);
  const blocks = data.blocks.filter(block => block.field.farm.id === farmId);
  const visibleCycles = planting.cycles.filter(cycle => cycleFilter === 'all' || String(cycle.blockId) === cycleFilter);
  const selectedCycle = planting.cycles.find(cycle => cycle.id === selectedCycleId) ?? visibleCycles[0] ?? planting.cycles[0];
  const selectedBlock = blocks.find(block => block.id === selectedCycle?.blockId);
  const selectedField = selectedBlock?.field;
  const selectedPlans = planting.plans.filter(plan => Number(plan.cycleId) === selectedCycle?.id);
  const cycleMaterials = planting.materialLots.filter(material => Number(material.cycleId) === selectedCycle?.id);
  const acceptedMaterials = cycleMaterials.filter(material => material.status === 'ACCEPTED');
  const selectedExecutions = planting.executions.filter(execution => selectedPlans.some(plan => plan.id === Number(execution.planId)));
  const completion = selectedCycle?.establishmentChecks?.[0];
  const approvedPlan = selectedPlans.find(plan => plan.status === 'APPROVED') ?? selectedPlans[0];
  const plannedPlants = selectedPlans.reduce((total, plan) => total + Number(plan.targetPlants || 0), 0);
  const plantedPlants = selectedExecutions.reduce((total, execution) => total + Number(execution.plantsPlanted || 0), 0);
  const plannedArea = planting.plans.reduce((total, plan) => total + Number(plan.plannedAreaHa || 0), 0);
  const totalArea = blocks.reduce((total, block) => total + Number(block.areaHa || 0), 0);
  const progressFlags = [
    selectedCycle?.siteAssessment?.status === 'APPROVED',
    acceptedMaterials.length > 0,
    Boolean(approvedPlan && approvedPlan.status === 'APPROVED'),
    selectedExecutions.length > 0,
    Boolean(completion),
  ];
  const progress = Math.round(progressFlags.filter(Boolean).length / progressFlags.length * 100);
  const nextStep = !selectedCycle?.siteAssessment
    ? 'Evaluar el lote'
    : selectedCycle.siteAssessment.status !== 'APPROVED'
      ? 'Aprobar la evaluación'
      : !acceptedMaterials.length
        ? 'Aceptar material vegetal'
        : !selectedPlans.length
          ? 'Crear el plan de siembra'
          : !selectedExecutions.length
            ? 'Generar tarea y ejecutar'
            : !completion
              ? 'Registrar seguimiento'
              : 'Mantener el seguimiento';

  async function reload() {
    setLoading(true);
    try {
      if (mode === 'live') {
        const people = canManage
          ? api.members(farmId)
          : Promise.resolve([{ userId: profile.user.id, name: profile.user.name, email: profile.user.email, role }]);
        const [savedPlanting, savedCatalog, savedMembers] = await Promise.all([api.planting(farmId), api.cropCatalog(farmId), people]);
        setPlanting(savedPlanting);
        setCatalog(savedCatalog);
        setMembers(savedMembers);
        setSelectedCycleId(current => savedPlanting.cycles.some(cycle => cycle.id === current) ? current : savedPlanting.cycles[0]?.id);
      } else {
        const saved = readPlantingDemo();
        setPlanting(saved);
        setCatalog(readCatalogForFarm(farmId));
        setMembers([
          { userId: profile.user.id, name: profile.user.name, email: profile.user.email, role },
          { userId: 2, name: 'María González', email: 'maria@agrovision.demo', role: 'WORKER' },
        ]);
        setSelectedCycleId(current => saved.cycles.some(cycle => cycle.id === current) ? current : saved.cycles[0]?.id);
      }
    } catch (failure) {
      notify(failure instanceof Error ? failure.message : 'No se pudo cargar siembra y ciclos.', true);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void reload();
  }, [farmId, mode, canManage, profile.user.email, profile.user.id, profile.user.name, role]);

  useEffect(() => {
    if (mode !== 'demo') return;
    try {
      localStorage.setItem('agrovision.' + plantingKey + '.v1', JSON.stringify(planting));
    } catch {
      notify('No se pudo guardar el cambio local de siembra.', true);
    }
  }, [mode, planting, notify]);

  useEffect(() => {
    if (!catalog.length) {
      setCycleCropId('');
      setCycleVarietyId('');
      return;
    }
    setCycleCropId(current => catalog.some(crop => String(crop.id) === current) ? current : String(catalog[0].id));
  }, [catalog]);

  useEffect(() => {
    setCycleVarietyId(current => cycleVarieties.some(variety => String(variety.id) === current) ? current : cycleVarieties[0] ? String(cycleVarieties[0].id) : '');
  }, [cycleVarieties]);

  useEffect(() => {
    if (!cycleCropId) return;
    const cropId = Number(cycleCropId);
    const varietyId = cycleVarietyId ? Number(cycleVarietyId) : undefined;
    const suggestions = mode === 'live'
      ? api.plantingCalendarSuggestions(farmId, cropId, varietyId)
      : Promise.resolve(demoSuggestions(readCalendarsForFarm(farmId), cropId, varietyId));
    let active = true;
    void suggestions.then(result => {
      if (!active) return;
      const suggestion = result[0] ?? null;
      setCalendarSuggestion(suggestion);
      if (suggestion?.windowFrom) setCycleFrom(suggestion.windowFrom);
      if (suggestion?.windowTo) setCycleTo(suggestion.windowTo);
    }).catch(() => {
      if (active) setCalendarSuggestion(null);
    });
    return () => { active = false; };
  }, [farmId, mode, cycleCropId, cycleVarietyId]);

  function applyDemo(update: DemoUpdate) {
    setPlanting(current => update(current));
  }

  async function post(path: string, payload: unknown, demoUpdate: DemoUpdate | undefined, message: string, close = true) {
    setBusy(true);
    try {
      if (mode === 'live') {
        await api.plantingAction(path, payload);
        await reload();
      } else if (demoUpdate) {
        applyDemo(demoUpdate);
      }
      if (close) setModal(null);
      notify(message);
    } catch (failure) {
      notify(failure instanceof Error ? failure.message : 'No se pudo guardar el registro.', true);
    } finally {
      setBusy(false);
    }
  }

  function formText(form: FormData, key: string) {
    return String(form.get(key) ?? '').trim();
  }

  function nextId(values: { id: number }[]) {
    return Math.max(0, ...values.map(value => value.id)) + 1;
  }

  function openNewCycle() {
    setCycleFrom(localDate());
    setCycleTo(localDate());
    setCalendarSuggestion(null);
    setModal('cycle');
  }

  async function createCycle(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const blockId = Number(formText(form, 'blockId'));
    const crop = cycleCrop?.name || selectedBlock?.crop || 'Cultivo';
    const variety = cycleVariety?.name || selectedBlock?.variety || 'Variedad por definir';
    const payload = {
      blockId,
      rowId: null,
      cropId: cycleCrop ? Number(cycleCrop.id) : null,
      varietyId: cycleVariety ? Number(cycleVariety.id) : null,
      code: formText(form, 'code'),
      crop,
      variety,
      plannedPlantingFrom: formText(form, 'plannedPlantingFrom'),
      plannedPlantingTo: formText(form, 'plannedPlantingTo'),
      expectedHarvestOn: formText(form, 'expectedHarvestOn') || null,
      notes: formText(form, 'notes') || null,
    };
    if (!payload.code || !payload.plannedPlantingFrom || !payload.plannedPlantingTo) {
      notify('Completa el código y la ventana de siembra.', true);
      return;
    }
    if (payload.plannedPlantingTo < payload.plannedPlantingFrom) {
      notify('La fecha final debe ser posterior a la fecha inicial.', true);
      return;
    }
    if (mode === 'demo') {
      const id = nextId(planting.cycles);
      const cycle: Cycle = {
        id,
        blockId,
        cropId: payload.cropId ?? undefined,
        varietyId: payload.varietyId ?? undefined,
        code: payload.code,
        crop,
        variety,
        status: 'DRAFT',
        currentStage: 'PLANNED',
        plannedPlantingFrom: payload.plannedPlantingFrom,
        plannedPlantingTo: payload.plannedPlantingTo,
        expectedHarvestOn: payload.expectedHarvestOn ?? undefined,
        notes: payload.notes ?? undefined,
        version: 0,
        siteAssessment: null,
        stageHistory: [],
        establishmentChecks: [],
      };
      applyDemo(current => ({ ...current, cycles: [cycle, ...current.cycles] }));
      setSelectedCycleId(id);
      setDetailTab('summary');
      setModal(null);
      notify('Ciclo creado en la demostración.');
      return;
    }
    await post('cycles', payload, undefined, 'Ciclo creado.');
  }

  async function createAssessment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedCycle) return;
    const form = new FormData(event.currentTarget);
    const payload = {
      previousUse: formText(form, 'previousUse'),
      neighboringUses: formText(form, 'neighboringUses') || null,
      slope: formText(form, 'slope') || null,
      drainage: formText(form, 'drainage'),
      floodingRisk: formText(form, 'floodingRisk'),
      windRisk: formText(form, 'windRisk') || null,
      contaminationRisk: formText(form, 'contaminationRisk') || null,
      phytosanitaryRisk: formText(form, 'phytosanitaryRisk') || null,
      environmentalRestrictions: formText(form, 'environmentalRestrictions') || null,
      evidenceNotes: formText(form, 'evidenceNotes') || null,
    };
    await post(
      'cycles/' + selectedCycle.id + '/site-assessment',
      payload,
      current => ({
        ...current,
        cycles: current.cycles.map(cycle => cycle.id === selectedCycle.id
          ? {
              ...cycle,
              siteAssessment: {
                id: nextId(current.cycles.flatMap(item => item.siteAssessment ? [item.siteAssessment] : [])),
                status: 'DRAFT',
                version: 0,
                previous_use: payload.previousUse,
                neighboring_uses: payload.neighboringUses ?? undefined,
                slope: payload.slope ?? undefined,
                drainage: payload.drainage,
                flooding_risk: payload.floodingRisk,
                wind_risk: payload.windRisk ?? undefined,
                contamination_risk: payload.contaminationRisk ?? undefined,
                phytosanitary_risk: payload.phytosanitaryRisk ?? undefined,
                environmental_restrictions: payload.environmentalRestrictions ?? undefined,
                evidence_notes: payload.evidenceNotes ?? undefined,
              },
            }
          : cycle),
      }),
      'Evaluación de lote registrada.',
    );
  }

  async function decideAssessment(approve: boolean) {
    if (!selectedCycle?.siteAssessment) return;
    const reason = approve ? 'Evaluación revisada y aprobada para continuar con la planeación.' : 'Evaluación requiere ajustes antes de continuar.';
    const path = 'cycles/' + selectedCycle.id + '/site-assessment/' + (approve ? 'approve' : 'reject');
    await post(
      path,
      { version: selectedCycle.siteAssessment.version, reason },
      current => ({
        ...current,
        cycles: current.cycles.map(cycle => cycle.id === selectedCycle.id
          ? { ...cycle, siteAssessment: cycle.siteAssessment ? { ...cycle.siteAssessment, status: approve ? 'APPROVED' : 'REJECTED', version: cycle.siteAssessment.version + 1, decision_reason: reason } : cycle.siteAssessment }
          : cycle),
      }),
      approve ? 'Evaluación aprobada.' : 'Evaluación rechazada.',
      false,
    );
  }

  async function createMaterial(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedCycle) return;
    const form = new FormData(event.currentTarget);
    const payload = {
      farmId,
      cycleId: selectedCycle.id,
      cropId: selectedCycle.cropId ?? null,
      varietyId: selectedCycle.varietyId ?? null,
      materialType: formText(form, 'materialType'),
      crop: selectedCycle.crop,
      variety: selectedCycle.variety || 'Variedad por definir',
      supplier: formText(form, 'supplier'),
      sourceReference: formText(form, 'sourceReference'),
      certificationReference: formText(form, 'certificationReference') || null,
      quantityReceived: Number(formText(form, 'quantityReceived')),
      healthInspection: formText(form, 'healthInspection'),
    };
    if (!payload.quantityReceived || payload.quantityReceived < 0) {
      notify('Registra una cantidad recibida válida.', true);
      return;
    }
    const materialId = nextId(planting.materialLots);
    await post(
      'material-lots',
      payload,
      current => ({
        ...current,
        materialLots: [{
          id: materialId,
          ...payload,
          cropId: payload.cropId ?? undefined,
          varietyId: payload.varietyId ?? undefined,
          materialType: payload.materialType,
          crop: payload.crop,
          variety: payload.variety,
          quantityReceived: payload.quantityReceived,
          quantityAccepted: 0,
          quantityRejected: 0,
          status: 'RECEIVED',
          version: 0,
          healthInspection: payload.healthInspection,
          sourceReference: payload.sourceReference,
          certificationReference: payload.certificationReference ?? undefined,
        }, ...current.materialLots],
      }),
      'Material vegetal recibido.',
    );
  }

  function openMaterialDecision(material: MaterialLot) {
    setActiveMaterial(material);
    setModal('materialDecision');
  }

  async function decideMaterial(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!activeMaterial) return;
    const form = new FormData(event.currentTarget);
    const status = formText(form, 'status');
    const accepted = Number(formText(form, 'quantityAccepted') || 0);
    const rejectedInput = Number(formText(form, 'quantityRejected') || 0);
    const rejected = status === 'REJECTED' ? Math.max(rejectedInput, activeMaterial.quantityReceived) : rejectedInput;
    const reason = formText(form, 'reason');
    if (status === 'ACCEPTED' && accepted <= 0) {
      notify('Un lote aceptado debe tener cantidad aceptada.', true);
      return;
    }
    if (accepted + rejected > activeMaterial.quantityReceived) {
      notify('La cantidad aceptada y rechazada no puede superar la recibida.', true);
      return;
    }
    await post(
      'material-lots/' + activeMaterial.id + '/decision',
      { version: activeMaterial.version, status, quantityAccepted: accepted, quantityRejected: rejected, reason },
      current => ({
        ...current,
        materialLots: current.materialLots.map(material => material.id === activeMaterial.id
          ? { ...material, status, quantityAccepted: accepted, quantityRejected: rejected, version: material.version + 1, decisionReason: reason }
          : material),
      }),
      status === 'ACCEPTED' ? 'Material vegetal aceptado.' : 'Material vegetal rechazado.',
    );
  }

  async function createPlan(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedCycle) return;
    const form = new FormData(event.currentTarget);
    const payload = {
      cycleId: selectedCycle.id,
      materialLotId: Number(formText(form, 'materialLotId')),
      plannedAreaHa: Number(formText(form, 'plannedAreaHa')),
      plantingSystem: formText(form, 'plantingSystem'),
      rowSpacingM: Number(formText(form, 'rowSpacingM')),
      plantSpacingM: Number(formText(form, 'plantSpacingM')),
      targetDensityHa: Number(formText(form, 'targetDensityHa')),
      targetPlants: Number(formText(form, 'targetPlants')),
      windowFrom: formText(form, 'windowFrom'),
      windowTo: formText(form, 'windowTo'),
      responsibleId: Number(formText(form, 'responsibleId')),
      technicalBasis: formText(form, 'technicalBasis'),
    };
    if (!payload.plannedAreaHa || !payload.targetDensityHa || !payload.targetPlants || !payload.windowFrom || !payload.windowTo) {
      notify('Completa el área, densidad, plantas y ventana del plan.', true);
      return;
    }
    const planId = nextId(planting.plans);
    await post(
      'plans',
      payload,
      current => ({
        ...current,
        plans: [{
          id: planId,
          ...payload,
          status: 'DRAFT',
          taskId: undefined,
          version: 0,
        }, ...current.plans],
      }),
      'Plan de siembra creado.',
    );
  }

  function openPlanDecision(plan: PlantingPlan) {
    setActivePlan(plan);
    setModal('planDecision');
  }

  async function decidePlan(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!activePlan) return;
    const form = new FormData(event.currentTarget);
    const status = formText(form, 'status');
    const reason = formText(form, 'reason');
    const approve = status === 'APPROVED';
    await post(
      'plans/' + activePlan.id + '/' + (approve ? 'approve' : 'cancel'),
      { version: activePlan.version, reason },
      current => ({
        ...current,
        plans: current.plans.map(plan => plan.id === activePlan.id ? { ...plan, status, version: plan.version + 1 } : plan),
        cycles: approve ? current.cycles.map(cycle => cycle.id === activePlan.cycleId && cycle.status === 'DRAFT' ? { ...cycle, status: 'PLANNED', version: cycle.version + 1 } : cycle) : current.cycles,
      }),
      approve ? 'Plan aprobado.' : 'Plan cancelado.',
    );
  }

  async function generateTask(plan: PlantingPlan) {
    if (!canManage || plan.taskId) return;
    if (mode === 'live') {
      await post('plans/' + plan.id + '/task', undefined, undefined, 'Tarea generada para Mi trabajo de hoy.');
      return;
    }
    const taskId = 'task-planting-' + Date.now();
    applyDemo(current => ({ ...current, plans: current.plans.map(item => item.id === plan.id ? { ...item, taskId, version: item.version + 1 } : item) }));
    const block = blocks.find(item => item.id === selectedCycle?.blockId);
    const responsible = members.find(member => member.userId === plan.responsibleId);
    app.setTasks(previous => [...previous, {
      id: taskId,
      farmId,
      blockId: block?.id,
      assigneeId: plan.responsibleId,
      title: 'Siembra · ' + (selectedCycle?.code ?? 'ciclo'),
      activity: 'planting',
      date: plan.windowFrom,
      time: '07:00',
      assignee: responsible?.name ?? 'Responsable',
      priority: 'Media',
      status: 'pending',
      version: 0,
      instructions: 'Ejecuta el plan de siembra aprobado. Registra ubicación, conteos y novedades del material vegetal.',
    }]);
    notify('Tarea generada para Mi trabajo de hoy.');
  }

  function openExecution(plan: PlantingPlan) {
    setActivePlan(plan);
    setModal('execution');
  }

  async function createExecution(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedCycle || !activePlan) return;
    const form = new FormData(event.currentTarget);
    const payload = {
      executedOn: formText(form, 'executedOn'),
      areaHa: Number(formText(form, 'areaHa')),
      plantsPlanted: Number(formText(form, 'plantsPlanted')),
      plantsRejected: Number(formText(form, 'plantsRejected') || 0),
      locationDetails: formText(form, 'locationDetails') || null,
      operatorNotes: formText(form, 'operatorNotes') || null,
    };
    if (!payload.executedOn || payload.areaHa <= 0 || payload.plantsPlanted <= 0) {
      notify('Completa la fecha, el área y el conteo de plantas.', true);
      return;
    }
    setBusy(true);
    try {
      if (mode === 'live') {
        await api.plantingAction('plans/' + activePlan.id + '/executions', payload);
        await reload();
      } else {
        const eventId = await app.create('events', {
          eventType: 'HANDLING_EVENT',
          blockId: selectedCycle.blockId,
          occurredAt: payload.executedOn + 'T07:00:00',
          notes: 'Siembra · plan #' + activePlan.id + ' · ' + payload.plantsPlanted + ' plantas',
        });
        const execution: PlantingExecution = { id: nextId(planting.executions), planId: activePlan.id, eventId, ...payload, locationDetails: payload.locationDetails ?? undefined, operatorNotes: payload.operatorNotes ?? undefined };
        applyDemo(current => ({
          ...current,
          executions: [execution, ...current.executions],
          cycles: current.cycles.map(cycle => cycle.id === selectedCycle.id ? { ...cycle, status: 'ESTABLISHING', currentStage: 'ESTABLISHMENT', plantedOn: cycle.plantedOn ?? payload.executedOn, version: cycle.version + 1 } : cycle),
        }));
        app.setTasks(previous => previous.map(task => task.id === String(activePlan.taskId) && task.status === 'pending' ? { ...task, status: 'progress', version: (task.version ?? 0) + 1 } : task));
      }
      setModal(null);
      notify('Ejecución de siembra registrada.');
    } catch (failure) {
      notify(failure instanceof Error ? failure.message : 'No se pudo registrar la ejecución.', true);
    } finally {
      setBusy(false);
    }
  }

  async function createEstablishment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedCycle) return;
    const form = new FormData(event.currentTarget);
    const payload = {
      checkedOn: formText(form, 'checkedOn'),
      plantsChecked: Number(formText(form, 'plantsChecked')),
      survivingPlants: Number(formText(form, 'survivingPlants')),
      deadPlants: Number(formText(form, 'deadPlants')),
      replacedPlants: Number(formText(form, 'replacedPlants') || 0),
      uniformity: formText(form, 'uniformity') || null,
      causes: formText(form, 'causes') || null,
      notes: formText(form, 'notes') || null,
    };
    await post(
      'cycles/' + selectedCycle.id + '/establishment-checks',
      payload,
      current => ({
        ...current,
        cycles: current.cycles.map(cycle => cycle.id === selectedCycle.id
          ? { ...cycle, establishmentChecks: [{ id: nextId(cycle.establishmentChecks ?? []), ...payload, uniformity: payload.uniformity ?? undefined, causes: payload.causes ?? undefined, notes: payload.notes ?? undefined }, ...(cycle.establishmentChecks ?? [])] }
          : cycle),
      }),
      'Seguimiento de establecimiento registrado.',
    );
  }

  async function observeStage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedCycle) return;
    const form = new FormData(event.currentTarget);
    const payload = { stage: formText(form, 'stage'), observedOn: formText(form, 'observedOn'), notes: formText(form, 'notes') || null };
    await post(
      'cycles/' + selectedCycle.id + '/stages',
      payload,
      current => ({
        ...current,
        cycles: current.cycles.map(cycle => cycle.id === selectedCycle.id
          ? {
              ...cycle,
              currentStage: payload.stage,
              status: payload.stage === 'CLOSED' ? 'CLOSED' : payload.stage === 'PLANNED' ? 'PLANNED' : 'ACTIVE',
              version: cycle.version + 1,
              stageHistory: [{ id: nextId(cycle.stageHistory ?? []), stage: payload.stage, observedOn: payload.observedOn, notes: payload.notes ?? undefined }, ...(cycle.stageHistory ?? [])],
            }
          : cycle),
      }),
      'Estado fenológico actualizado.',
    );
  }

  function exportCycles() {
    const rows = [
      ['Código', 'Cultivo', 'Variedad', 'Estado', 'Lote', 'Inicio', 'Fin', 'Área del lote (ha)'],
      ...planting.cycles.map(cycle => {
        const block = blocks.find(item => item.id === cycle.blockId);
        return [cycle.code, cycle.crop, cycle.variety, statusLabels[cycle.status] ?? cycle.status, block?.code ?? cycle.blockId, cycle.plannedPlantingFrom, cycle.plannedPlantingTo, block?.areaHa ?? ''];
      }),
    ];
    const csv = rows.map(row => row.map(csvCell).join(',')).join('\\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = 'agrovision-ciclos.csv';
    link.click();
    URL.revokeObjectURL(url);
    notify('Exportación de ciclos preparada.');
  }

  if (loading) return <div className="page-stack planting-screen"><Loading /></div>;

  return <div className="page-stack planting-screen planting-reference-screen">
    <div className="planting-breadcrumb"><span><Home size={15} />Inicio</span><ChevronRight size={13} /><strong>Siembra y ciclos</strong></div>
    <div className="planting-reference-overview">
    <header className="planting-reference-heading">
      <div><h1>Siembra y ciclos</h1><p>Gestiona los ciclos productivos, materiales vegetales, planes de siembra y el estado de ejecución en cada campo y bloque.</p></div>
      <div className="heading-actions">
        <button className="button secondary" onClick={() => app.navigate('settings', 'calendar')}><CalendarDays size={15} />Ver calendario</button>
        <button className="button secondary" onClick={exportCycles}><Download size={15} />Exportar</button>
        <button className="button" onClick={openNewCycle}><Plus size={16} />Nuevo ciclo</button>
      </div>
    </header>

    <div className="planting-kpi-grid planting-reference-kpis">
      <KpiCard icon={Sprout} tone="green" label="Ciclos activos" value={planting.cycles.filter(cycle => !['CLOSED', 'CANCELED'].includes(cycle.status)).length} note="en desarrollo" />
      <KpiCard icon={PackageCheck} tone="blue" label="Material vegetal" value={planting.materialLots.filter(material => material.status === 'ACCEPTED').length} note="lotes aceptados" />
      <KpiCard icon={ClipboardList} tone="gold" label="Planes" value={planting.plans.length} note="con planificación" />
      <KpiCard icon={CheckCircle2} tone="purple" label="Ejecuciones" value={planting.executions.length} note="en campo" />
      <KpiCard icon={Ruler} tone="teal" label="Área planificada" value={numberLabel(plannedArea, 1) + ' ha'} note={'de ' + numberLabel(totalArea, 0) + ' ha'} />
    </div>
    </div>

    <div className="planting-reference-workspace">
      <section className="panel planting-cycle-list-panel">
        <div className="planting-reference-panel-heading">
          <div><h3>Ciclos por lote</h3><p>Selecciona un ciclo para ver y gestionar su información.</p></div>
          <select value={cycleFilter} onChange={event => setCycleFilter(event.target.value)} aria-label="Filtrar ciclos por lote">
            <option value="all">Todos los lotes</option>
            {blocks.map(block => <option key={block.id} value={block.id}>{block.code}</option>)}
          </select>
        </div>
        <div className="planting-reference-cycle-list">
          {visibleCycles.length ? visibleCycles.map(cycle => {
            const block = blocks.find(item => item.id === cycle.blockId);
            return <button type="button" key={cycle.id} className={'planting-reference-cycle-card ' + (cycle.id === selectedCycle?.id ? 'selected' : '')} onClick={() => { setSelectedCycleId(cycle.id); setDetailTab('summary'); }}>
              <span className="planting-cycle-thumb">{mode === 'demo' ? <img src="/images/farm-aerial.png" alt="" /> : <Sprout size={25} aria-hidden="true" />}</span>
              <span className="planting-cycle-card-copy"><strong>{cycle.code}</strong><span>{cycle.crop} · {cycle.variety || 'Variedad por definir'}</span><small>{block?.code ?? 'Lote sin asignar'} · {dateLabel(cycle.plannedPlantingFrom)}</small></span>
              <Badge tone={statusTone(cycle.status)}>{statusLabels[cycle.status] ?? cycle.status}</Badge>
            </button>;
          }) : <Empty title="Sin ciclos para este lote" description="Crea un nuevo ciclo o cambia el filtro de campo." action={<button className="button small" onClick={openNewCycle}><Plus size={14} />Nuevo ciclo</button>} />}
        </div>
      </section>

      {selectedCycle ? <section className="planting-reference-detail">
        <div className="planting-reference-detail-header">
          <div className="planting-detail-title"><span className="planting-detail-code">{selectedCycle.code}</span><Badge tone={statusTone(selectedCycle.status)}>{statusLabels[selectedCycle.status] ?? selectedCycle.status}</Badge></div>
          <div className="planting-detail-header-actions"><div className="planting-action-menu-wrap"><button className="icon-button" aria-label="Más opciones del ciclo" aria-expanded={actionMenu} onClick={() => setActionMenu(value => !value)}><MoreHorizontal size={19} /></button>{actionMenu && <div className="planting-action-menu">
            {!selectedCycle.siteAssessment && <button onClick={() => { setModal('assessment'); setActionMenu(false); }}><ClipboardCheck size={14} />Evaluar lote</button>}
            {selectedCycle.siteAssessment?.status === 'DRAFT' && canManage && <><button onClick={() => { void decideAssessment(true); setActionMenu(false); }} disabled={busy}><Check size={14} />Aprobar evaluación</button><button onClick={() => { void decideAssessment(false); setActionMenu(false); }} disabled={busy}>Rechazar evaluación</button></>}
            <button onClick={() => { setModal('material'); setActionMenu(false); }}><PackageCheck size={14} />Registrar material</button>
            {selectedCycle.siteAssessment?.status === 'APPROVED' && acceptedMaterials.length > 0 && <button onClick={() => { setModal('plan'); setActionMenu(false); }}><ClipboardList size={14} />Nuevo plan</button>}
            {selectedPlans.some(plan => plan.status === 'APPROVED' && !plan.taskId) && canManage && <button onClick={() => { void generateTask(selectedPlans.find(plan => plan.status === 'APPROVED' && !plan.taskId)!); setActionMenu(false); }} disabled={busy}><ListChecks size={14} />Generar tarea</button>}
            {approvedPlan?.taskId && <button onClick={() => { openExecution(approvedPlan); setActionMenu(false); }}><Play size={14} />Registrar ejecución</button>}
            {selectedExecutions.length > 0 && <button onClick={() => { setModal('establishment'); setActionMenu(false); }}><RefreshCw size={14} />Seguimiento</button>}
            <button onClick={() => { setModal('stage'); setActionMenu(false); }}><Activity size={14} />Actualizar etapa</button>
          </div>}</div></div>
        </div>

        <section className="planting-reference-info-card"><div className="planting-info-card-heading"><h3>Información general</h3></div><div className="planting-reference-info-grid">
          <InfoCell icon={Sprout} label="Cultivo" value={selectedCycle.crop} />
          <InfoCell icon={MapPin} label="Campo" value={selectedField?.name ?? 'Sin campo'} />
          <InfoCell icon={CalendarDays} label="Fecha de inicio" value={dateLabel(selectedCycle.plannedPlantingFrom)} />
          <InfoCell icon={Sprout} label="Variedad" value={selectedCycle.variety || 'Por definir'} />
          <InfoCell icon={ClipboardList} label="Bloque" value={selectedBlock?.code ?? 'Sin bloque'} />
          <InfoCell icon={CalendarDays} label="Fecha de fin" value={dateLabel(selectedCycle.plannedPlantingTo)} />
        </div></section>

        <div className="planting-reference-tabs" role="tablist" aria-label="Detalle del ciclo">
          {tabs.map(tab => <button type="button" role="tab" aria-selected={detailTab === tab.id} key={tab.id} className={detailTab === tab.id ? 'active' : ''} onClick={() => setDetailTab(tab.id)}><tab.icon size={14} />{tab.label}</button>)}
        </div>

        {detailTab === 'summary' && <div className="planting-summary-content">
          <div className="planting-summary-grid">
            <section className="panel planting-summary-map-card">
              <div className="planting-summary-card-heading"><div><h3>Área del ciclo</h3></div><Badge tone="neutral">{selectedBlock?.areaHa ?? '—'} ha</Badge></div>
              <div className="planting-summary-map"><FarmMap farm={data.farms[0]} blocks={selectedBlock ? [selectedBlock] : blocks} fields={selectedField ? [selectedField] : data.fields} rows={data.rows} layer="satellite" demo={mode === 'demo'} selected={selectedBlock?.id} baseLayer="satellite" /></div>
            </section>
            <section className="panel planting-cycle-status-card">
              <div className="planting-summary-card-heading"><div><h3>Estado del ciclo</h3></div></div>
              <div className="planting-stage-timeline">
                {[
                  ['Planeación', progressFlags[0]],
                  ['Material vegetal', progressFlags[1]],
                  ['Siembra', progressFlags[2]],
                  ['Ejecución', progressFlags[3]],
                  ['Cierre', progressFlags[4]],
                ].map(([label, done], index) => <div key={String(label)} className={done ? 'done' : index === progressFlags.findIndex(value => !value) ? 'current' : ''}><span>{done ? <Check size={12} /> : index + 1}</span><small>{label}</small></div>)}
              </div>
              <div className="planting-progress-heading"><strong>Progreso</strong><strong>{progress}%</strong></div>
              <div className="planting-progress-track" role="progressbar" aria-label="Progreso del ciclo" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100}><i style={{ width: progress + '%' }} /></div>
              <div className="planting-status-metrics">
                <Metric label="Área planificada" value={numberLabel(selectedPlans.reduce((total, plan) => total + Number(plan.plannedAreaHa || 0), 0), 1) + ' ha'} />
                <Metric label="Plantas objetivo" value={numberLabel(plannedPlants)} />
                <Metric label="Plantas establecidas" value={numberLabel(plantedPlants)} />
                <Metric label="Supervivencia" value={completion && completion.plantsChecked > 0 ? Math.round(completion.survivingPlants / completion.plantsChecked * 100) + '%' : 'Pendiente'} />
              </div>
            </section>
          </div>
          <div className="planting-summary-meta-grid">
            <section className="panel planting-summary-meta-card planting-key-dates-card">
              <div className="planting-meta-card-heading"><h3>Fechas clave</h3></div>
              <div className="planting-key-dates">
                <DateMeta label="Inicio planificado" value={dateLabel(selectedCycle.plannedPlantingFrom)} />
                <DateMeta label="Fin planificado" value={dateLabel(selectedCycle.plannedPlantingTo)} />
                <DateMeta label="Inicio real" value={dateLabel(selectedCycle.plantedOn)} />
                <DateMeta label="Cosecha estimada" value={dateLabel(selectedCycle.expectedHarvestOn)} />
              </div>
            </section>
            <section className="panel planting-summary-meta-card planting-responsible-card"><div className="planting-meta-card-heading"><h3>Responsables</h3></div><div className="planting-responsible-copy"><span className="planting-meta-icon"><Users size={17} /></span><div><strong>{members.find(member => member.userId === approvedPlan?.responsibleId)?.name ?? 'Sin asignar'}</strong><span>{selectedCycle.notes || 'Asigna un responsable para este ciclo.'}</span></div></div>{!approvedPlan && acceptedMaterials.length > 0 && <button className="button secondary small" onClick={() => setModal('plan')}>Asignar</button>}</section>
          </div>
          <div className="planting-next-step"><span className="planting-next-step-dot" /><div><small>SIGUIENTE PASO</small><strong>{nextStep}</strong></div><button className="text-button" onClick={() => setDetailTab(nextStep.includes('material') ? 'material' : nextStep.includes('plan') ? 'plan' : nextStep.includes('ejecutar') ? 'execution' : 'followup')}>Abrir detalle<ArrowRight size={13} /></button></div>
        </div>}

        {detailTab === 'material' && <CycleMaterials materials={cycleMaterials} canManage={canManage} onDecide={openMaterialDecision} />}
        {detailTab === 'plan' && <CyclePlans plans={selectedPlans} members={members} canManage={canManage} onDecide={openPlanDecision} onGenerateTask={generateTask} onExecute={openExecution} />}
        {detailTab === 'execution' && <CycleExecutions executions={selectedExecutions} />}
        {detailTab === 'followup' && <CycleChecks cycle={selectedCycle} />}
        {detailTab === 'files' && <section className="panel planting-files-panel"><span className="planting-empty-icon"><FileText size={22} /></span><h3>Archivos del ciclo</h3><p>Las fotos de ubicación, material y ejecución se asocian a los eventos de campo. Este espacio queda listo para consultar evidencia vinculada al ciclo.</p><span className="planting-files-note">No hay archivos adicionales registrados.</span></section>}
      </section> : <section className="panel planting-empty-detail"><Empty title="Crea tu primer ciclo" description="Define el cultivo, lote y ventana de siembra para comenzar la trazabilidad." action={<button className="button" onClick={openNewCycle}><Plus size={15} />Nuevo ciclo</button>} /></section>}
    </div>

    {modal === 'cycle' && <Modal title="Nuevo ciclo de cultivo" onClose={() => { if (!busy) setModal(null); }} wide><form className="form-grid planting-form" onSubmit={createCycle}><Notice>{calendarSuggestion ? 'Calendario regional: ' + calendarSuggestion.seasonName + (calendarSuggestion.notes ? ' · ' + calendarSuggestion.notes : '') : 'Selecciona cultivo y variedad para consultar la ventana regional disponible.'}</Notice><label className="full-span">Lote<select name="blockId" defaultValue={selectedBlock?.id ?? blocks[0]?.id} required>{blocks.map(block => <option key={block.id} value={block.id}>{block.code} · {block.field.name} · {block.areaHa ?? '—'} ha</option>)}</select></label><label>Código del ciclo<input name="code" required defaultValue={'CICLO-' + new Date().getFullYear() + '-' + String(planting.cycles.length + 1).padStart(2, '0')} /></label><label>Cultivo<select name="cropId" value={cycleCropId} onChange={event => setCycleCropId(event.target.value)} required>{catalog.map(crop => <option key={crop.id} value={crop.id}>{crop.name}</option>)}</select></label><label>Variedad<select name="varietyId" value={cycleVarietyId} onChange={event => setCycleVarietyId(event.target.value)}>{cycleVarieties.map(variety => <option key={variety.id} value={variety.id}>{variety.name}</option>)}</select></label><label>Inicio de siembra<input name="plannedPlantingFrom" type="date" value={cycleFrom} onChange={event => setCycleFrom(event.target.value)} required /></label><label>Fin de siembra<input name="plannedPlantingTo" type="date" value={cycleTo} onChange={event => setCycleTo(event.target.value)} required /></label><label>Fecha estimada de cosecha<input name="expectedHarvestOn" type="date" min={cycleFrom} /></label><label className="full-span">Notas del ciclo<textarea name="notes" maxLength={4000} placeholder="Propósito de la renovación, observaciones iniciales o contexto del lote." /></label><FormActions busy={busy} onCancel={() => setModal(null)} label="Crear ciclo" /></form></Modal>}

    {modal === 'assessment' && selectedCycle && <Modal title="Evaluación del lote" onClose={() => { if (!busy) setModal(null); }} wide><form className="form-grid planting-form" onSubmit={createAssessment}><Notice>Registra el historial, el suelo, el drenaje y los riesgos antes de aprobar el plan de siembra.</Notice><label>Uso anterior<input name="previousUse" required maxLength={2000} placeholder="Banano renovado, potrero, descanso…" /></label><label>Usos vecinos<input name="neighboringUses" maxLength={2000} placeholder="Cultivos, viviendas, cuerpos de agua…" /></label><label>Pendiente<select name="slope"><option value="PLANA">Plana</option><option value="LEVE">Leve</option><option value="MODERADA">Moderada</option><option value="ALTA">Alta</option></select></label><label>Drenaje<input name="drainage" required maxLength={2000} placeholder="Canales y evacuación de agua" /></label><label>Riesgo de inundación<select name="floodingRisk"><option value="BAJO">Bajo</option><option value="MEDIO">Medio</option><option value="ALTO">Alto</option></select></label><label>Riesgo de viento<select name="windRisk"><option value="BAJO">Bajo</option><option value="MEDIO">Medio</option><option value="ALTO">Alto</option></select></label><label className="full-span">Riesgo de contaminación<textarea name="contaminationRisk" maxLength={2000} placeholder="Fuentes, deriva, residuos o restricciones." /></label><label className="full-span">Riesgo fitosanitario<textarea name="phytosanitaryRisk" maxLength={2000} placeholder="Historial de plagas y enfermedades del lote." /></label><label className="full-span">Restricciones ambientales<textarea name="environmentalRestrictions" maxLength={2000} /></label><label className="full-span">Evidencia y notas<textarea name="evidenceNotes" maxLength={4000} /></label><FormActions busy={busy} onCancel={() => setModal(null)} label="Guardar evaluación" /></form></Modal>}

    {modal === 'material' && selectedCycle && <Modal title="Registrar material vegetal" onClose={() => { if (!busy) setModal(null); }} wide><form className="form-grid planting-form" onSubmit={createMaterial}><Notice>El lote queda recibido hasta que un agrónomo o supervisor acepte o rechace sus cantidades.</Notice><label>Tipo de material<select name="materialType" defaultValue="IN_VITRO" required><option value="IN_VITRO">In vitro</option><option value="CORM">Cormo</option><option value="COLINO">Colino</option><option value="OTHER">Otro</option></select></label><label>Proveedor<input name="supplier" required maxLength={200} /></label><label>Cultivo<input value={selectedCycle.crop} readOnly /></label><label>Variedad<input value={selectedCycle.variety || 'Variedad por definir'} readOnly /></label><label>Referencia de origen<input name="sourceReference" required maxLength={2000} placeholder="Remisión, lote o factura" /></label><label>Certificación<input name="certificationReference" maxLength={500} /></label><label>Cantidad recibida<input name="quantityReceived" type="number" min="0.001" step="0.001" required /></label><label className="full-span">Inspección sanitaria<textarea name="healthInspection" required maxLength={4000} placeholder="Estado visual, documentación y novedades del recibo." /></label><FormActions busy={busy} onCancel={() => setModal(null)} label="Registrar lote" /></form></Modal>}

    {modal === 'materialDecision' && activeMaterial && <Modal title="Aceptar o rechazar material" onClose={() => { if (!busy) setModal(null); }}><form className="form-stack planting-form" onSubmit={decideMaterial}><Notice>{activeMaterial.crop} · {activeMaterial.variety} · Recibido: {numberLabel(activeMaterial.quantityReceived)}</Notice><label>Decisión<select name="status" defaultValue="ACCEPTED"><option value="ACCEPTED">Aceptar lote</option><option value="REJECTED">Rechazar lote</option></select></label><label>Cantidad aceptada<input name="quantityAccepted" type="number" min="0" max={activeMaterial.quantityReceived} step="0.001" defaultValue={activeMaterial.quantityReceived} /></label><label>Cantidad rechazada<input name="quantityRejected" type="number" min="0" max={activeMaterial.quantityReceived} step="0.001" defaultValue={activeMaterial.quantityRejected ?? 0} /></label><label>Motivo y decisión técnica<textarea name="reason" required maxLength={4000} placeholder="Deja trazabilidad de la aceptación o rechazo." /></label><FormActions busy={busy} onCancel={() => setModal(null)} label="Guardar decisión" /></form></Modal>}

    {modal === 'plan' && selectedCycle && <Modal title="Crear plan de siembra" onClose={() => { if (!busy) setModal(null); }} wide><form className="form-grid planting-form" onSubmit={createPlan}><Notice>{selectedCycle.siteAssessment?.status === 'APPROVED' ? 'La evaluación técnica está aprobada. El plan quedará en borrador hasta su aprobación.' : 'Aprueba primero la evaluación del lote para poder guardar el plan.'}</Notice><label>Material aceptado<select name="materialLotId" required>{acceptedMaterials.map(material => <option key={material.id} value={material.id}>{material.materialType ? materialTypeLabels[material.materialType] : 'Material'} · {material.supplier} · {numberLabel(material.quantityAccepted ?? 0)} unidades</option>)}</select></label><label>Responsable<select name="responsibleId" required>{members.map(member => <option key={member.userId} value={member.userId}>{member.name} · {member.role === 'AGRONOMIST' ? 'Agrónomo' : member.role === 'SUPERVISOR' ? 'Supervisor' : member.role === 'WORKER' ? 'Trabajador' : 'Administrador'}</option>)}</select></label><label>Área planificada (ha)<input name="plannedAreaHa" type="number" min="0.001" step="0.001" defaultValue={selectedBlock?.areaHa ?? 1} required /></label><label>Sistema de siembra<input name="plantingSystem" required defaultValue="Rectangular configurable" /></label><label>Distancia entre surcos (m)<input name="rowSpacingM" type="number" min="0.001" step="0.001" defaultValue="3" required /></label><label>Distancia entre plantas (m)<input name="plantSpacingM" type="number" min="0.001" step="0.001" defaultValue="0.8" required /></label><label>Densidad objetivo (plantas/ha)<input name="targetDensityHa" type="number" min="0.001" step="0.001" defaultValue="500" required /></label><label>Plantas objetivo<input name="targetPlants" type="number" min="1" step="1" defaultValue={Math.round((selectedBlock?.areaHa ?? 1) * 500)} required /></label><label>Ventana desde<input name="windowFrom" type="date" defaultValue={selectedCycle.plannedPlantingFrom} required /></label><label>Ventana hasta<input name="windowTo" type="date" defaultValue={selectedCycle.plannedPlantingTo} required /></label><label className="full-span">Fundamento técnico<textarea name="technicalBasis" required maxLength={4000} defaultValue="Densidad definida por protocolo del cultivo, material aceptado y área disponible del bloque." /></label><FormActions busy={busy} onCancel={() => setModal(null)} label="Crear plan" /></form></Modal>}

    {modal === 'planDecision' && activePlan && <Modal title="Aprobar plan de siembra" onClose={() => { if (!busy) setModal(null); }}><form className="form-stack planting-form" onSubmit={decidePlan}><Notice>El plan debe tener evaluación aprobada, material aceptado y un responsable de la finca.</Notice><label>Decisión<select name="status" defaultValue="APPROVED"><option value="APPROVED">Aprobar plan</option><option value="CANCELED">Cancelar plan</option></select></label><label>Motivo y observaciones<textarea name="reason" required maxLength={4000} placeholder="Fundamento de aprobación, ajustes o motivo de cancelación." /></label><FormActions busy={busy} onCancel={() => setModal(null)} label="Guardar decisión" /></form></Modal>}

    {modal === 'execution' && activePlan && selectedCycle && <Modal title="Registrar ejecución de siembra" onClose={() => { if (!busy) setModal(null); }} wide><form className="form-grid planting-form" onSubmit={createExecution}><Notice>Registra el área ejecutada, los conteos, la ubicación y las novedades del equipo de campo.</Notice><label>Fecha de ejecución<input name="executedOn" type="date" max={localDate()} defaultValue={localDate()} required /></label><label>Área ejecutada (ha)<input name="areaHa" type="number" min="0.001" step="0.001" defaultValue={activePlan.plannedAreaHa} required /></label><label>Plantas establecidas<input name="plantsPlanted" type="number" min="1" step="1" defaultValue={activePlan.targetPlants} required /></label><label>Plantas rechazadas<input name="plantsRejected" type="number" min="0" step="1" defaultValue="0" /></label><label className="full-span">Ubicación, sectores o conteos<textarea name="locationDetails" maxLength={2000} placeholder="Sectores, surcos, puntos de ubicación o referencia de campo." /></label><label className="full-span">Novedades del operador<textarea name="operatorNotes" maxLength={4000} /></label><FormActions busy={busy} onCancel={() => setModal(null)} label="Guardar ejecución" /></form></Modal>}

    {modal === 'establishment' && selectedCycle && <Modal title="Seguimiento de establecimiento" onClose={() => { if (!busy) setModal(null); }} wide><form className="form-grid planting-form" onSubmit={createEstablishment}><Notice>Compara plantas revisadas, supervivencia, muertes y reposición para mantener el estado del ciclo actualizado.</Notice><label>Fecha de seguimiento<input name="checkedOn" type="date" max={localDate()} defaultValue={localDate()} required /></label><label>Plantas revisadas<input name="plantsChecked" type="number" min="1" step="1" required /></label><label>Plantas sobrevivientes<input name="survivingPlants" type="number" min="0" step="1" required /></label><label>Plantas muertas<input name="deadPlants" type="number" min="0" step="1" required /></label><label>Plantas de reposición<input name="replacedPlants" type="number" min="0" step="1" defaultValue="0" /></label><label>Uniformidad<select name="uniformity"><option value="Uniforme">Uniforme</option><option value="Aceptable">Aceptable</option><option value="Irregular">Irregular</option></select></label><label className="full-span">Causas de pérdida o variabilidad<textarea name="causes" maxLength={2000} /></label><label className="full-span">Notas y acciones de reposición<textarea name="notes" maxLength={4000} /></label><FormActions busy={busy} onCancel={() => setModal(null)} label="Guardar seguimiento" /></form></Modal>}

    {modal === 'stage' && selectedCycle && <Modal title="Actualizar estado fenológico" onClose={() => { if (!busy) setModal(null); }}><form className="form-stack planting-form" onSubmit={observeStage}><Notice>El cambio conserva una historia de etapas con fecha y notas del responsable.</Notice><label>Nueva etapa<select name="stage" defaultValue={selectedCycle.currentStage}>{Object.entries(stageLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><label>Fecha de observación<input name="observedOn" type="date" max={localDate()} defaultValue={localDate()} required /></label><label>Notas de campo<textarea name="notes" maxLength={4000} /></label><FormActions busy={busy} onCancel={() => setModal(null)} label="Actualizar etapa" /></form></Modal>}
  </div>;
}

function KpiCard({ icon: Icon, tone, label, value, note }: { icon: LucideIcon; tone: string; label: string; value: ReactNode; note: string }) {
  return <section className="panel planting-kpi-card"><span className={'planting-kpi-icon ' + tone}><Icon size={20} /></span><div><span>{label}</span><strong>{value}</strong><small>{note}</small></div></section>;
}

function InfoCell({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: ReactNode }) {
  return <div><span className="planting-info-cell-icon"><Icon size={16} /></span><span className="planting-info-cell-copy"><span>{label}</span><strong>{value}</strong></span></div>;
}

function DateMeta({ label, value }: { label: string; value: string }) {
  return <div className="planting-date-meta"><span className="planting-date-meta-icon"><CalendarDays size={14} /></span><div><strong>{value}</strong><small>{label}</small></div></div>;
}

function Metric({ label, value }: { label: string; value: ReactNode }) {
  return <div><span>{label}</span><strong>{value}</strong></div>;
}

function FormActions({ busy, onCancel, label }: { busy: boolean; onCancel: () => void; label: string }) {
  return <div className="form-actions full-span"><button className="button secondary" type="button" onClick={onCancel} disabled={busy}>Cancelar</button><button className="button" type="submit" disabled={busy}>{busy ? 'Guardando…' : label}</button></div>;
}

function CycleMaterials({ materials, canManage, onDecide }: { materials: MaterialLot[]; canManage: boolean; onDecide: (material: MaterialLot) => void }) {
  return <section className="panel planting-tab-section"><div className="planting-tab-section-heading"><div><span className="planting-section-eyebrow">TRAZABILIDAD</span><h3>Material vegetal</h3><p>Registra el origen, inspección y decisión de cada lote recibido.</p></div><Badge tone="neutral">{materials.length} lotes</Badge></div>{materials.length ? <div className="planting-record-list">{materials.map(material => <article className="planting-record-item" key={material.id}><div className="planting-record-item-top"><strong>{materialTypeLabels[material.materialType] ?? material.materialType} · {material.supplier}</strong><Badge tone={statusTone(material.status)}>{statusLabels[material.status] ?? material.status}</Badge></div><p>{material.crop} · {material.variety} · Recibido: {numberLabel(material.quantityReceived)} · Aceptado: {numberLabel(material.quantityAccepted)}</p><small>Origen: {material.sourceReference || 'Sin referencia'} · Certificación: {material.certificationReference || 'Sin referencia'}</small>{material.healthInspection && <small>Inspección: {material.healthInspection}</small>}{material.decisionReason && <small>Decisión: {material.decisionReason}</small>}{canManage && material.status === 'RECEIVED' && <button className="text-button" onClick={() => onDecide(material)}><ClipboardCheck size={13} />Aceptar o rechazar lote<ArrowRight size={13} /></button>}</article>)}</div> : <Empty title="Sin material vegetal" description="Registra el lote recibido para habilitar el plan de siembra." />}</section>;
}

function CyclePlans({ plans, members, canManage, onDecide, onGenerateTask, onExecute }: { plans: PlantingPlan[]; members: Member[]; canManage: boolean; onDecide: (plan: PlantingPlan) => void; onGenerateTask: (plan: PlantingPlan) => void; onExecute: (plan: PlantingPlan) => void }) {
  return <section className="panel planting-tab-section"><div className="planting-tab-section-heading"><div><span className="planting-section-eyebrow">CONTROL TÉCNICO</span><h3>Planes de siembra</h3><p>Área, densidad, responsable y aprobación antes de ejecutar.</p></div><Badge tone="neutral">{plans.length} planes</Badge></div>{plans.length ? <div className="planting-record-list">{plans.map(plan => <article className="planting-record-item" key={plan.id}><div className="planting-record-item-top"><strong>Plan #{plan.id} · {numberLabel(plan.plannedAreaHa, 2)} ha</strong><Badge tone={statusTone(plan.status)}>{statusLabels[plan.status] ?? plan.status}</Badge></div><p>{plan.plantingSystem} · {numberLabel(plan.targetDensityHa)} plantas/ha · Objetivo: {numberLabel(plan.targetPlants)} plantas</p><small>{dateLabel(plan.windowFrom)} — {dateLabel(plan.windowTo)} · Responsable: {members.find(member => member.userId === plan.responsibleId)?.name ?? 'Sin asignar'}</small><small>Material aceptado: lote #{plan.materialLotId} · Base: {plan.technicalBasis || 'Sin fundamento registrado'}</small><div className="planting-record-actions">{canManage && plan.status === 'DRAFT' && <button className="text-button" onClick={() => onDecide(plan)}><ClipboardCheck size={13} />Aprobar o cancelar</button>}{canManage && plan.status === 'APPROVED' && !plan.taskId && <button className="text-button" onClick={() => void onGenerateTask(plan)}><ListChecks size={13} />Generar tarea</button>}{plan.status === 'APPROVED' && plan.taskId && <button className="text-button" onClick={() => onExecute(plan)}><Play size={13} />Registrar ejecución</button>}</div></article>)}</div> : <Empty title="Sin plan de siembra" description="Acepta el material vegetal y crea el plan técnico del ciclo." />}</section>;
}

function CycleExecutions({ executions }: { executions: PlantingExecution[] }) {
  return <section className="panel planting-tab-section"><div className="planting-tab-section-heading"><div><span className="planting-section-eyebrow">EJECUCIÓN DE CAMPO</span><h3>Ejecuciones registradas</h3><p>Conteos, ubicación y novedades de cada jornada.</p></div><Badge tone="neutral">{executions.length} registros</Badge></div>{executions.length ? <div className="planting-record-list">{executions.map(execution => <article className="planting-record-item" key={execution.id}><div className="planting-record-item-top"><strong>Jornada del {dateLabel(execution.executedOn)}</strong><Badge tone="green">Registrada</Badge></div><p>{numberLabel(execution.areaHa, 2)} ha · {numberLabel(execution.plantsPlanted)} plantas establecidas · {numberLabel(execution.plantsRejected)} rechazadas</p><small><MapPin size={12} /> {execution.locationDetails || 'Ubicación no detallada'}</small>{execution.operatorNotes && <small>{execution.operatorNotes}</small>}</article>)}</div> : <Empty title="Sin ejecuciones" description="Genera la tarea del plan aprobado y registra el trabajo realizado en campo." />}</section>;
}

function CycleChecks({ cycle }: { cycle: Cycle }) {
  const checks = cycle.establishmentChecks ?? [];
  const history = cycle.stageHistory ?? [];
  return <div className="planting-followup-grid"><section className="panel planting-tab-section"><div className="planting-tab-section-heading"><div><span className="planting-section-eyebrow">SUPERVIVENCIA Y REPOSICIÓN</span><h3>Seguimientos</h3><p>Conteos de establecimiento y acciones correctivas.</p></div><Badge tone="neutral">{checks.length} controles</Badge></div>{checks.length ? <div className="planting-record-list">{checks.map(check => <article className="planting-record-item" key={check.id}><div className="planting-record-item-top"><strong>Control del {dateLabel(check.checkedOn)}</strong><Badge tone="green">{check.uniformity || 'Registrado'}</Badge></div><p>Revisadas: {numberLabel(check.plantsChecked)} · Vivas: {numberLabel(check.survivingPlants)} · Muertas: {numberLabel(check.deadPlants)} · Reposición: {numberLabel(check.replacedPlants)}</p><small>{check.causes || 'Sin causas registradas.'}</small>{check.notes && <small>{check.notes}</small>}</article>)}</div> : <Empty title="Sin seguimiento" description="Registra el primer control después de la ejecución de campo." />}</section><section className="panel planting-tab-section"><div className="planting-tab-section-heading"><div><span className="planting-section-eyebrow">HISTORIA FENOLÓGICA</span><h3>Etapas del ciclo</h3><p>Registro de observaciones y cambios de estado.</p></div><Badge tone="neutral">{history.length} eventos</Badge></div>{history.length ? <div className="planting-record-list">{history.map(item => <article className="planting-record-item" key={item.id}><div className="planting-record-item-top"><strong>{stageLabels[item.stage] ?? item.stage}</strong><Badge tone={item.stage === 'CLOSED' ? 'red' : 'blue'}>{dateLabel(item.observedOn || item.observed_on)}</Badge></div>{item.notes && <p>{item.notes}</p>}</article>)}</div> : <Empty title="Sin etapas observadas" description="Actualiza el estado fenológico para construir la historia del ciclo." />}</section></div>;
}
