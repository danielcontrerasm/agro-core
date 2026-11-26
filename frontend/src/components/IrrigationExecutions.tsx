import { ArrowRight, Clock3, Droplets, Gauge, Layers3 } from 'lucide-react';
import { number } from '../lib/domain';
import type { IrrigationExecution, IrrigationPlan } from '../lib/irrigation';
import { Badge, Panel } from './ui';

type Props = {
  executions: IrrigationExecution[];
  plans: IrrigationPlan[];
  sectorName: (id: number) => string;
  onView: (execution: IrrigationExecution) => void;
  onPlans: () => void;
};

export default function IrrigationExecutions({ executions, plans, sectorName, onView, onPlans }: Props) {
  const plansById = new Map(plans.map(plan => [plan.id, plan]));
  const rows = executions.flatMap(execution => {
    const plan = plansById.get(execution.planId);
    return plan ? [{ execution, plan }] : [];
  }).sort((first, second) => Date.parse(second.execution.endedAt) - Date.parse(first.execution.endedAt));
  const metered = rows.filter(({ execution }) => execution.volumeMode === 'METER').length;
  const estimated = rows.length - metered;
  const metrics = [
    { icon: Droplets, tone: 'blue', label: 'Volumen registrado', value: `${number(rows.reduce((total, { execution }) => total + execution.volumeM3, 0), 2)} m³`, note: 'Medido o estimado' },
    { icon: Clock3, tone: 'teal', label: 'Tiempo efectivo', value: `${number(rows.reduce((total, { execution }) => total + execution.durationMinutes, 0), 2)} min`, note: 'Descontando interrupciones' },
    { icon: Layers3, tone: 'green', label: 'Sectores regados', value: new Set(rows.map(({ plan }) => plan.sectorId)).size, note: 'Con ejecución registrada' },
    { icon: Gauge, tone: 'gold', label: 'Ejecuciones registradas', value: rows.length, note: 'Incluye ejecuciones parciales' },
  ];

  return <div className="irrigation-executions">
    <div className="irrigation-execution-metrics">
      {metrics.map(metric => <article className="module-kpi" key={metric.label}>
        <span className={`module-kpi-icon ${metric.tone}`}><metric.icon size={22} /></span>
        <div><small>{metric.label}</small><strong>{metric.value}</strong><span>{metric.note}</span></div>
      </article>)}
    </div>
    <div className="irrigation-execution-body">
      <Panel title="Ejecuciones y evidencia" className="irrigation-execution-records">
        {rows.length > 0 ? <div className="table-wrap"><table className="farm-record-table" role="table">
          <thead role="rowgroup"><tr role="row"><th>Sector / programación</th><th>Inicio / fin</th><th>Tiempo efectivo</th><th>Volumen / origen</th><th>Evidencia</th></tr></thead>
          <tbody role="rowgroup">{rows.map(({ execution, plan }) => <tr role="row" key={execution.id}>
            <td role="cell"><strong>{sectorName(plan.sectorId)}</strong><small>Programación #{plan.id}</small></td>
            <td role="cell" data-label="Inicio / fin">
              <time dateTime={execution.startedAt}>{new Date(execution.startedAt).toLocaleString('es-CO')}</time>
              <small><time dateTime={execution.endedAt}>{new Date(execution.endedAt).toLocaleString('es-CO')}</time></small>
            </td>
            <td role="cell" data-label="Tiempo efectivo"><strong>{number(execution.durationMinutes, 2)} min</strong><small>{number(execution.interruptionMinutes, 2)} min de interrupción</small></td>
            <td role="cell" data-label="Volumen / origen"><strong>{number(execution.volumeM3, 2)} m³</strong><small>{execution.volumeMode === 'METER' ? 'Medido por contador' : 'Estimado por caudal'}</small></td>
            <td role="cell"><button className="outline-action" aria-label={`Ver ejecución ${execution.id}`} onClick={() => onView(execution)}>Ver ejecución</button></td>
          </tr>)}</tbody>
        </table></div> : <div className="farm-record-empty irrigation-empty">
          <span className="module-kpi-icon blue"><Droplets size={26} /></span>
          <div><h4>Aún no hay ejecuciones en esta selección</h4><p>Abre una programación con tarea para registrar el tiempo efectivo y el agua utilizada.</p></div>
          <button className="button secondary" onClick={onPlans}>Ver programación <ArrowRight size={16} /></button>
        </div>}
      </Panel>
      <Panel title="Cómo se registró el volumen" className="irrigation-execution-methods">
        <ul>
          <li><span className="module-kpi-icon blue"><Gauge size={17} /></span><div><strong>Lectura del contador</strong><small>Diferencia entre las lecturas inicial y final</small></div><Badge tone="blue">{metered}</Badge></li>
          <li><span className="module-kpi-icon teal"><Droplets size={17} /></span><div><strong>Estimación por caudal</strong><small>Caudal utilizado y tiempo efectivo</small></div><Badge>{estimated}</Badge></li>
        </ul>
      </Panel>
    </div>
  </div>;
}
