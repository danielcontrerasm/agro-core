import { useState } from 'react';
import { number } from '../lib/domain';
import { coverageUnit, quantityUnit } from '../lib/fertilization';
import type { FertilizationApplication, FertilizationPlan } from '../lib/fertilization';
import type { Block, Field } from '../lib/types';
import FarmMap from './FarmMap';
import type { BlockPresentation } from './FarmMap';
import { Badge, Panel } from './ui';
import './fertilization-plan-coverage.css';

interface CoverageMapProps {
  applications: FertilizationApplication[];
  blocks: Block[];
  fields: Field[];
  demo: boolean;
}

const coverageStyles = {
  covered: { label: 'Cubierto', color: '#218753', tone: 'green' },
  partial: { label: 'Parcial', color: '#db9b28', tone: 'gold' },
  pending: { label: 'Pendiente', color: '#c95748', tone: 'red' },
  outside: { label: 'Sin plan', color: '#8c9b93', tone: 'neutral' },
  canceled: { label: 'Anulado', color: '#8c9b93', tone: 'neutral' },
};
type CoverageStatus = keyof typeof coverageStyles;

const realAmount = (value: number) => Number(value.toFixed(6));
const balance = (planned: number, recorded: number) => Math.max(0, realAmount(planned - recorded));
const amount = (value: number, unit: string) => number(value, 6) + ' ' + unit;

function summarize(plan: FertilizationPlan, applications: FertilizationApplication[]) {
  const planApplications = applications.filter(application => application.planId === plan.id);
  const tasks = plan.recurrence && plan.recurrence !== 'NONE' ? plan.tasks ?? [] : [];
  const quantityPerOccurrence = realAmount(plan.totalQuantity / (tasks.length || 1));
  const occurrences = tasks.map(task => {
    const records = planApplications.filter(application => application.taskId === task.taskId);
    const covered = realAmount(records.reduce((sum, application) => sum + application.coverage, 0));
    const applied = realAmount(records.reduce((sum, application) => sum + application.quantity, 0));
    return {
      ...task,
      passes: records.length,
      coverage: plan.coverage,
      covered,
      coveragePending: balance(plan.coverage, covered),
      quantity: quantityPerOccurrence,
      applied,
      quantityPending: balance(quantityPerOccurrence, applied),
    };
  });
  const coverage = realAmount(plan.coverage * (occurrences.length || 1));
  const covered = realAmount(planApplications.reduce((sum, application) => sum + application.coverage, 0));
  const coveragePending = occurrences.length
    ? realAmount(occurrences.reduce((sum, occurrence) => sum + occurrence.coveragePending, 0))
    : balance(coverage, covered);
  return {
    occurrences,
    total: {
      passes: planApplications.length,
      coverage,
      covered,
      coveragePending,
      quantity: plan.totalQuantity,
      applied: plan.appliedQuantity,
      quantityPending: balance(plan.totalQuantity, plan.appliedQuantity),
    },
  };
}

function coverageStatus(covered: number, pending: number): CoverageStatus {
  if (covered === 0) return 'pending';
  return pending > 0 ? 'partial' : 'covered';
}

function CoverageLegend({ outside, canceled = false }: { outside: string; canceled?: boolean }) {
  return <ul className="fertilization-coverage-legend" aria-label="Leyenda de cobertura">
    {(['covered', 'partial', 'pending'] as const).map(status => <li key={status}>
      <i style={{ backgroundColor: coverageStyles[status].color }} aria-hidden="true" />{coverageStyles[status].label}
    </li>)}
    <li><i style={{ backgroundColor: coverageStyles.outside.color }} aria-hidden="true" />{outside}</li>
    {canceled && <li><i style={{ backgroundColor: coverageStyles.canceled.color }} aria-hidden="true" />Anulado</li>}
  </ul>;
}

export default function FertilizationPlanCoverage({ plan, applications, blocks, fields, demo }: CoverageMapProps & {
  plan: FertilizationPlan;
}) {
  const [taskId, setTaskId] = useState('');
  const { total, occurrences } = summarize(plan, applications);
  const summary = occurrences.find(occurrence => String(occurrence.taskId) === taskId) ?? total;
  const status = plan.status === 'CANCELED' ? 'canceled' : coverageStatus(summary.covered, summary.coveragePending);
  const areaUnit = coverageUnit(plan.doseUnit);
  const productUnit = quantityUnit(plan.doseUnit);
  const block = blocks.find(item => item.id === plan.blockId);
  const presentation = new Map<number, BlockPresentation>(blocks.map(item => {
    const isTarget = item.id === plan.blockId;
    return [item.id, {
      label: item.code,
      color: coverageStyles[isTarget ? status : 'outside'].color,
      detail: isTarget
        ? `${coverageStyles[status].label} · ${amount(summary.covered, areaUnit)} registrados`
        : 'Fuera de este plan',
    }];
  }));

  return <Panel title="Mapa de ejecución del plan" className="fertilization-plan-coverage">
    <div className="fertilization-coverage-toolbar">
      <div>
        <strong>{block ? `${block.field.name} · ${block.code}` : `Bloque #${plan.blockId}`}</strong>
        <Badge tone={coverageStyles[status].tone}>{coverageStyles[status].label}</Badge>
      </div>
      {occurrences.length > 0 && <label>Ocurrencia de cobertura
        <select value={taskId} onChange={event => setTaskId(event.target.value)}>
          <option value="">Todas las ocurrencias</option>
          {occurrences.map(occurrence => <option key={occurrence.taskId} value={occurrence.taskId}>
            {occurrence.occurrenceOn} · Tarea #{occurrence.taskId}
          </option>)}
        </select>
      </label>}
    </div>
    <dl className="fertilization-coverage-values" aria-label="Cobertura y producto del plan">
      <div><dt>Cobertura programada</dt><dd>{amount(summary.coverage, areaUnit)}</dd></div>
      <div><dt>Cobertura registrada</dt><dd>{amount(summary.covered, areaUnit)}</dd></div>
      <div><dt>Cobertura pendiente</dt><dd>{amount(summary.coveragePending, areaUnit)}</dd></div>
      <div><dt>Producto programado</dt><dd>{amount(summary.quantity, productUnit)}</dd></div>
      <div><dt>Producto aplicado</dt><dd>{amount(summary.applied, productUnit)}</dd></div>
      <div><dt>Producto pendiente</dt><dd>{amount(summary.quantityPending, productUnit)}</dd></div>
    </dl>
    <FarmMap blocks={blocks} fields={fields} demo={demo} blockPresentation={presentation} fitWholeGeometry />
    <CoverageLegend outside="Fuera de este plan" canceled={status === 'canceled'} />
    <p className="fertilization-coverage-caption">
      El color resume la cobertura registrada para el plan en el bloque. Las aplicaciones se ubican por bloque.
      {summary.passes > 1 && ' La cobertura suma las pasadas declaradas. Si se superponen, una misma zona puede contarse más de una vez.'}
      {!demo && !block?.geom?.coordinates[0]?.length && ' Agrega el perímetro del bloque para mostrarlo en el mapa.'}
    </p>
  </Panel>;
}

export function FertilizationFarmCoverage({ plans, applications, blocks, fields, demo, onPlan }: CoverageMapProps & {
  plans: FertilizationPlan[];
  onPlan?: (plan: FertilizationPlan) => void;
}) {
  const [selectedId, setSelectedId] = useState(0);
  const byBlock = new Map<number, { plan: FertilizationPlan; total: ReturnType<typeof summarize>['total'] }[]>();
  for (const plan of plans) {
    if (plan.status === 'CANCELED') continue;
    const entries = byBlock.get(plan.blockId) ?? [];
    entries.push({ plan, total: summarize(plan, applications).total });
    byBlock.set(plan.blockId, entries);
  }
  const coverageByField = new Map<number, Record<'covered' | 'partial' | 'pending' | 'outside', number>>();
  const presentation = new Map<number, BlockPresentation>();
  for (const block of blocks) {
    const entries = byBlock.get(block.id) ?? [];
    const status = !entries.length ? 'outside'
      : entries.every(({ total }) => total.covered === 0) ? 'pending'
      : entries.every(({ total }) => coverageStatus(total.covered, total.coveragePending) === 'covered') ? 'covered'
      : 'partial';
    const counts = coverageByField.get(block.field.id) ?? { covered: 0, partial: 0, pending: 0, outside: 0 };
    counts[status]++;
    coverageByField.set(block.field.id, counts);
    presentation.set(block.id, {
      label: block.code,
      color: coverageStyles[status].color,
      detail: status === 'outside' ? 'Sin plan' : `${coverageStyles[status].label} · ${entries.length} ${entries.length === 1 ? 'plan' : 'planes'}`,
    });
  }
  const selected = blocks.find(block => block.id === selectedId);
  const entries = byBlock.get(selectedId) ?? [];

  return <Panel title="Mapa de ejecución de la finca" className="fertilization-plan-coverage">
    <div className="fertilization-coverage-toolbar">
      <label>Bloque en el mapa
        <select value={selected?.id ?? ''} onChange={event => setSelectedId(Number(event.target.value))}>
          <option value="">Seleccionar bloque</option>
          {blocks.map(block => <option key={block.id} value={block.id}>{block.field.name} · {block.code}</option>)}
        </select>
      </label>
    </div>
    <FarmMap blocks={blocks} fields={fields} demo={demo} selected={selected?.id} onSelect={setSelectedId} blockPresentation={presentation} fitWholeGeometry />
    <CoverageLegend outside="Sin plan" />
    <p className="fertilization-coverage-caption">
      El color resume los objetivos de los planes vigentes del bloque. Selecciona un bloque para consultar los saldos de cada plan.
    </p>
    {fields.length > 0 && <ul className="fertilization-coverage-plans" aria-label="Cobertura por campo">
      {fields.map(field => {
        const counts = coverageByField.get(field.id);
        return <li key={field.id}>
          <strong>{field.name}</strong>
          {counts ? <div className="fertilization-field-statuses">
            <Badge tone="green">{counts.covered} cubiertos</Badge>
            <Badge tone="gold">{counts.partial} parciales</Badge>
            <Badge tone="red">{counts.pending} pendientes</Badge>
            <Badge tone="neutral">{counts.outside} sin plan</Badge>
          </div> : <span>Sin bloques registrados</span>}
        </li>;
      })}
    </ul>}
    {selected && (entries.length ? <ul className="fertilization-coverage-plans" aria-label={`Planes de ${selected.code}`}>
      {entries.map(({ plan, total }) => {
        const unit = coverageUnit(plan.doseUnit);
        const style = coverageStyles[coverageStatus(total.covered, total.coveragePending)];
        return <li key={plan.id}>
          <strong>{plan.product}</strong><Badge tone={style.tone}>{style.label}</Badge>
          <span>{amount(total.covered, unit)} registrados · {amount(total.coveragePending, unit)} pendientes</span>
          {onPlan && <button type="button" className="text-button" onClick={() => onPlan(plan)}>Ver plan #{plan.id}</button>}
        </li>;
      })}
    </ul> : <p className="fertilization-coverage-caption">{selected.code} · Sin planes vigentes.</p>)}
  </Panel>;
}
