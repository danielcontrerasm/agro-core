import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { Bell, CalendarDays, Plus } from 'lucide-react';
import { useApp } from '../context';
import { number } from '../lib/domain';
import type { SanitaryProblem } from '../lib/inspections';
import {
  monitoringApi, monitoringDate, readDemoMonitoringPlans, saveDemoMonitoringPlans, summarizeDemoPlan,
} from '../lib/inspection-monitoring';
import type {
  DemoMonitoredInspection, MonitoringAlert, MonitoringPlan, MonitoringPlanSettings, MonitoringSchedule,
} from '../lib/inspection-monitoring';
import { Badge, Empty, Loading, Modal, Panel } from './ui';
import './inspection-monitoring.css';

type MonitoringEditor = { plan?: MonitoringPlanSettings } | { alert: MonitoringAlert };

function displayDate(value: string) {
  return new Date(`${value}T00:00:00Z`).toLocaleDateString('es-CO', { timeZone: 'UTC', day: 'numeric', month: 'short', year: 'numeric' });
}

export default function InspectionMonitoring({
  problems, records, onRegister, onOpenInspection, onReviewDemo,
}: {
  problems: SanitaryProblem[];
  records: DemoMonitoredInspection[];
  onRegister: (plan: MonitoringPlan) => void;
  onOpenInspection: (id: number) => void;
  onReviewDemo: (alert: MonitoringAlert) => void;
}) {
  const { data, farmId, mode, role, notify, profile } = useApp();
  const [demoPlans, setDemoPlans] = useState<MonitoringPlanSettings[]>([]);
  const [livePlans, setLivePlans] = useState<MonitoringPlan[]>([]);
  const [liveAlerts, setLiveAlerts] = useState<MonitoringAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [editor, setEditor] = useState<MonitoringEditor | null>(null);
  const [retry, setRetry] = useState(0);
  const [alertFilter, setAlertFilter] = useState('ALL');
  const canManage = role !== 'WORKER';
  const activeProblems = problems.filter(problem => problem.active);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setLoadError('');
    if (mode === 'demo') {
      setDemoPlans(readDemoMonitoringPlans(farmId));
      setLoading(false);
      return;
    }
    Promise.all([monitoringApi.plans(farmId), monitoringApi.alerts(farmId)]).then(([plans, alerts]) => {
      if (active) {
        setLivePlans(plans);
        setLiveAlerts(alerts);
      }
    }).catch(failure => {
      if (active) setLoadError(failure instanceof Error ? failure.message : 'No se pudo cargar el monitoreo.');
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, [farmId, mode, records, retry]);

  const plans = mode === 'demo' ? demoPlans.map(plan => summarizeDemoPlan(plan, records)) : livePlans;
  const alerts = mode === 'demo' ? records.flatMap(record => record.farmId === farmId && record.demoMonitoringAlert
    ? [{ ...record.demoMonitoringAlert, inspectionCanceledAt: record.canceledAt }] : []) : liveAlerts;
  const visibleAlerts = alerts.filter(alert => alertFilter === 'ALL' || alert.status === alertFilter)
    .sort((first, second) => second.createdAt.localeCompare(first.createdAt) || second.id - first.id);
  const visiblePlans = [...plans].sort((first, second) =>
    Number(second.active) - Number(first.active) || (first.nextDueDate ?? '').localeCompare(second.nextDueDate ?? '') || first.id - second.id);
  const blockName = (id: number) => data.blocks.find(block => block.id === id)?.code ?? `Bloque #${id}`;
  const problemName = (code: string) => problems.find(problem => problem.code === code)?.name
    ?? records.find(record => record.problemCode === code)?.problemName ?? code;
  const canOpenInspection = (id: number) => records.some(record => record.id === id);
  const planTarget = (plan: MonitoringPlanSettings) => `${blockName(plan.blockId)} · ${problemName(plan.problemCode)}`;

  function showEditor(value: MonitoringEditor) {
    setError('');
    setEditor(value);
  }

  function storeDemoPlan(plan: MonitoringPlanSettings) {
    const next = [plan, ...demoPlans.filter(item => item.id !== plan.id)];
    saveDemoMonitoringPlans(farmId, next);
    setDemoPlans(next);
  }

  function updateLivePlan(saved: MonitoringPlan) {
    setLivePlans(current => [saved, ...current.filter(plan => plan.id !== saved.id)]);
  }

  async function runAction(action: () => Promise<void>) {
    if (busy) return;
    setError('');
    setBusy(true);
    try { await action(); }
    catch (failure) { setError(failure instanceof Error ? failure.message : 'No se pudo guardar el cambio.'); }
    finally { setBusy(false); }
  }

  function savePlan(event: FormEvent<HTMLFormElement>, plan?: MonitoringPlanSettings) {
    event.preventDefault();
    const fields = new FormData(event.currentTarget);
    const threshold = String(fields.get('incidenceThresholdPercent') ?? '');
    const schedule: MonitoringSchedule = {
      startDate: String(fields.get('startDate')),
      intervalDays: Number(fields.get('intervalDays')),
      incidenceThresholdPercent: threshold === '' ? null : Number(threshold),
    };
    const blockId = plan?.blockId ?? Number(fields.get('blockId'));
    const problemCode = plan?.problemCode ?? String(fields.get('problemCode'));
    void runAction(async () => {
      if (mode === 'live') {
        const saved = plan ? await monitoringApi.edit(plan.id, { ...schedule, version: plan.version })
          : await monitoringApi.create({ ...schedule, farmId, blockId, problemCode });
        updateLivePlan(saved);
      } else if (plan) {
        storeDemoPlan({ ...plan, ...schedule, version: plan.version + 1 });
      } else {
        if (demoPlans.some(item => item.blockId === blockId && item.problemCode === problemCode)) {
          throw new Error('Ya existe un plan para este bloque y problema. Puedes editarlo o reanudarlo.');
        }
        storeDemoPlan({ ...schedule, id: Math.max(0, ...demoPlans.map(item => item.id)) + 1, farmId, blockId, problemCode, active: true, version: 0 });
      }
      setEditor(null);
      notify(plan ? 'Plan de monitoreo actualizado.' : 'Plan de monitoreo creado.');
    });
  }

  function togglePlan(plan: MonitoringPlanSettings) {
    void runAction(async () => {
      const active = !plan.active;
      if (mode === 'live') updateLivePlan(await monitoringApi.toggle(plan.id, plan.version, active));
      else storeDemoPlan({ ...plan, active, version: plan.version + 1 });
      notify(active ? 'Plan de monitoreo reanudado.' : 'Plan de monitoreo pausado.');
    });
  }

  function reviewAlert(event: FormEvent<HTMLFormElement>, alert: MonitoringAlert) {
    event.preventDefault();
    const reviewNotes = String(new FormData(event.currentTarget).get('reviewNotes')).trim();
    void runAction(async () => {
      if (!reviewNotes) throw new Error('Escribe la decisión tomada para revisar la alerta.');
      if (mode === 'live') {
        const saved = await monitoringApi.review(alert.id, alert.version, reviewNotes);
        setLiveAlerts(current => current.map(item => item.id === alert.id ? saved : item));
      } else {
        onReviewDemo({ ...alert, reviewNotes, status: 'REVIEWED', reviewedByUserId: profile.user.id, reviewedAt: new Date().toISOString(), version: alert.version + 1 });
      }
      setEditor(null);
      notify('Revisión de alerta guardada.');
    });
  }

  if (loading) return <Loading />;
  if (loadError) return <Panel title="Monitoreo fitosanitario" action={<button className="button secondary" onClick={() => setRetry(value => value + 1)}>Reintentar</button>}>
    <p className="form-error" role="alert">{loadError}</p>
  </Panel>;

  return <>
    {error && !editor && <p className="form-error" role="alert">{error}</p>}
    <Panel className="inspection-monitoring" title="Planes de monitoreo" action={canManage && <button className="button" disabled={!data.blocks.length || !activeProblems.length} onClick={() => showEditor({})}><Plus size={16} />Nuevo plan de monitoreo</button>}>
      {visiblePlans.length ? <ul className="monitoring-list" aria-label="Planes de monitoreo periódico">
        {visiblePlans.map(plan => {
          const target = planTarget(plan);
          const nextVisit = plan.nextDueDate;
          const problemActive = activeProblems.some(problem => problem.code === plan.problemCode);
          return <li className="monitoring-item" key={plan.id}>
            <div className="monitoring-item-copy">
              <div className="monitoring-item-title"><strong>{target}</strong><Badge tone={plan.overdue ? 'gold' : plan.active ? 'green' : 'neutral'}>{plan.overdue ? 'Visita vencida' : plan.active ? 'Activo' : 'Pausado'}</Badge></div>
              <p>Visita {plan.intervalDays === 1 ? 'diaria' : `cada ${plan.intervalDays} días`} desde {displayDate(plan.startDate)}. {plan.incidenceThresholdPercent == null ? 'Sin alerta por umbral.' : `Alerta a partir de ${number(plan.incidenceThresholdPercent, 4)} % de incidencia.`}</p>
              <p><CalendarDays size={15} aria-hidden="true" />{nextVisit ? <>Próxima visita: <time dateTime={nextVisit}>{displayDate(nextVisit)}</time></> : 'Agenda pausada'}</p>
              <p>{plan.lastInspectionDate ? <>Última inspección: <time dateTime={plan.lastInspectionDate}>{displayDate(plan.lastInspectionDate)}</time></> : 'Sin inspección registrada desde el inicio del plan.'}</p>
              {!problemActive && <p>El problema ya no está disponible en el catálogo activo.</p>}
            </div>
            <div className="monitoring-actions">
              {plan.active && plan.startDate <= monitoringDate() && data.blocks.some(block => block.id === plan.blockId) && problemActive && <button className="button secondary" disabled={busy} onClick={() => onRegister(plan)}>Registrar visita</button>}
              {canManage && <>
                <button className="button secondary" disabled={busy} onClick={() => showEditor({ plan })}>Editar plan</button>
                <button className="button secondary" disabled={busy || (!plan.active && !problemActive)} onClick={() => togglePlan(plan)}>{plan.active ? 'Pausar plan' : 'Reanudar plan'}</button>
              </>}
            </div>
          </li>;
        })}
      </ul> : <Empty title="Sin planes de monitoreo" description={canManage ? 'Programa visitas para un bloque y un problema fitosanitario del catálogo.' : 'Los planes de la finca aparecerán aquí.'} />}
    </Panel>
    <Panel className="inspection-monitoring" title="Alertas por umbral" action={<div className="monitoring-alert-filter">
      <label>Estado de alerta<select value={alertFilter} onChange={event => setAlertFilter(event.target.value)}><option value="ALL">Todas</option><option value="OPEN">Pendientes de revisión</option><option value="REVIEWED">Revisadas</option></select></label>
    </div>}>
      {visibleAlerts.length ? <ul className="monitoring-list" aria-label="Alertas de incidencia">
        {visibleAlerts.map(alert => <li className="monitoring-item" key={alert.id}>
          <div className="monitoring-item-copy">
            <div className="monitoring-item-title"><Bell size={16} aria-hidden="true" /><strong>{blockName(alert.blockId)} · {problemName(alert.problemCode)}</strong><Badge tone={alert.status === 'OPEN' ? 'gold' : 'green'}>{alert.status === 'OPEN' ? 'Pendiente de revisión' : 'Revisada'}</Badge></div>
            <p>Incidencia de {number(alert.incidencePercent, 4)} % · Umbral de {number(alert.thresholdPercent, 4)} % · {displayDate(monitoringDate(new Date(alert.createdAt)))}</p>
            {alert.inspectionCanceledAt && <p>Inspección de origen anulada.</p>}
            {alert.reviewNotes && <p>Decisión: {alert.reviewNotes}</p>}
            {alert.reviewedAt && <p>
              Revisión: <time dateTime={alert.reviewedAt}>{displayDate(monitoringDate(new Date(alert.reviewedAt)))}</time>
              {alert.reviewedByUserId && <> · {alert.reviewedByUserId === profile.user.id ? profile.user.name : `Usuario #${alert.reviewedByUserId}`}</>}
            </p>}
          </div>
          <div className="monitoring-actions">
            {canOpenInspection(alert.inspectionId) && <button className="button secondary" disabled={busy} onClick={() => onOpenInspection(alert.inspectionId)}>Ver inspección de origen</button>}
            {canManage && alert.status === 'OPEN' && <button className="button secondary" disabled={busy} onClick={() => showEditor({ alert })}>Revisar alerta</button>}
          </div>
        </li>)}
      </ul> : <Empty title={alerts.length ? 'Sin alertas con este estado' : 'Sin alertas por umbral'} description={alerts.length ? 'Cambia el filtro para ver las demás alertas.' : 'Aquí aparecerán las inspecciones que alcancen el umbral de un plan activo.'} />}
    </Panel>
    {editor && <Modal title={'alert' in editor ? 'Revisar alerta' : editor.plan ? 'Editar plan de monitoreo' : 'Nuevo plan de monitoreo'} onClose={() => !busy && setEditor(null)}>
      {'alert' in editor ? <form className="form-stack" onSubmit={event => reviewAlert(event, editor.alert)}>
        <label>Decisión técnica<textarea name="reviewNotes" required maxLength={4000} /></label>
        {error && <p className="form-error" role="alert">{error}</p>}
        <div className="form-actions"><button type="button" className="button secondary" disabled={busy} onClick={() => setEditor(null)}>Cancelar</button><button className="button" disabled={busy}>Guardar decisión</button></div>
      </form> : <form className="form-stack" onSubmit={event => savePlan(event, editor.plan)}>
        {editor.plan ? <p>{planTarget(editor.plan)}</p> : <>
          <label>Bloque<select name="blockId" required defaultValue=""><option value="">Seleccionar bloque</option>{data.blocks.map(block => <option key={block.id} value={block.id}>{block.code}</option>)}</select></label>
          <label>Problema fitosanitario<select name="problemCode" required defaultValue=""><option value="">Seleccionar problema</option>{activeProblems.map(problem => <option key={problem.code} value={problem.code}>{problem.name}</option>)}</select></label>
        </>}
        <label>Fecha de inicio<input name="startDate" type="date" min="0001-01-01" max="9999-12-31" required defaultValue={editor.plan?.startDate ?? monitoringDate()} /></label>
        <label>Frecuencia (días)<input name="intervalDays" type="number" min={1} max={365} step={1} required defaultValue={editor.plan?.intervalDays ?? 7} /></label>
        <label>Umbral de incidencia (%)<input name="incidenceThresholdPercent" type="number" min={0} max={100} step="any" defaultValue={editor.plan?.incidenceThresholdPercent ?? ''} /></label>
        <p className="inspection-form-hint">El umbral es opcional. La revisión de una alerta registra la decisión técnica.</p>
        {error && <p className="form-error" role="alert">{error}</p>}
        <div className="form-actions"><button type="button" className="button secondary" disabled={busy} onClick={() => setEditor(null)}>Cancelar</button><button className="button" disabled={busy}>Guardar plan</button></div>
      </form>}
    </Modal>}
  </>;
}
