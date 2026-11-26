import { useState } from 'react';
import { ArrowRight, ClipboardCheck, FlaskConical, Leaf, Maximize2, PackageCheck, Sprout, Wallet, X } from 'lucide-react';
import { number } from '../lib/domain';
import { coverageUnit, interpretAnalysis, latestSoilAnalyses, nutrientNames, units } from '../lib/fertilization';
import type { Analysis, FertilizationApplication, FertilizationPlan, Nutrient, NutrientInterpretation } from '../lib/fertilization';
import type { FarmData } from '../lib/types';
import FarmMap from './FarmMap';
import type { BlockPresentation } from './FarmMap';
import { Donut, Modal, Panel } from './ui';

const nutrientLayers = ['N', 'P', 'K', 'MG', 'CA', 'B', 'PH'] as const;
const symbol = (nutrient: Nutrient) => nutrient === 'PH' ? 'pH' : nutrient === 'OM' ? 'MO' : nutrient[0] + nutrient.slice(1).toLowerCase();
const dateLabel = (date: string) => new Date(date).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' });
const states = {
  adequate: { label: 'En rango', color: '#19a65b' },
  high: { label: 'Por encima del rango', color: '#edb92c' },
  low: { label: 'Por debajo del rango', color: '#f18a28' },
  multiple: { label: 'Varios valores bajos', color: '#ed443c' },
  unknown: { label: 'Sin interpretación', color: '#7e8b83' },
};

type Props = {
  data: FarmData;
  demo: boolean;
  blockFilter: string;
  analyses: Analysis[];
  approvedPlans: FertilizationPlan[];
  applications: { application: FertilizationApplication; plan: FertilizationPlan }[];
  amount: string;
  onTab: (tab: 'analyses' | 'plans' | 'applications') => void;
  onAnalysis: (analysis: Analysis) => void;
  onApplication: (application: FertilizationApplication) => void;
  onPlan?: (analysis: Analysis) => void;
};

export default function FertilizationOverview({ data, demo, blockFilter, analyses, approvedPlans, applications, amount, onTab, onAnalysis, onApplication, onPlan }: Props) {
  const [nutrient, setNutrient] = useState<Nutrient | 'all'>('all');
  const [baseLayer, setBaseLayer] = useState<'satellite' | 'map'>('satellite');
  const [selectedBlock, setSelectedBlock] = useState(0);
  const [expandSignal, setExpandSignal] = useState(0);
  const [showAllAlerts, setShowAllAlerts] = useState(false);

  const samples = latestSoilAnalyses(analyses);
  const presentation = new Map<number, BlockPresentation>();
  const measured = new Map<Nutrient, { comparable: number; adequate: number }>();
  const deficient = new Set<Nutrient>();
  const alerts: { block: FarmData['blocks'][number]; sample: Analysis; issue: NutrientInterpretation; count: number }[] = [];

  for (const block of data.blocks) {
    if (blockFilter && blockFilter !== String(block.id)) continue;
    const sample = samples.get(block.id);
    const interpretations = sample && sample.review?.decision !== 'REJECTED' ? interpretAnalysis(sample, block.crop).interpretations : [];
    const issues = interpretations.filter(result => result.status === 'LOW' || result.status === 'HIGH');
    const reading = interpretations.find(result => result.nutrient === nutrient);
    const activeIssues = nutrient === 'all' ? issues : issues.filter(result => result.nutrient === nutrient);
    const primary = activeIssues.find(result => result.status === 'LOW') ?? activeIssues[0];
    const lowCount = activeIssues.filter(result => result.status === 'LOW').length;

    if (sample && primary) alerts.push({ block, sample, issue: primary, count: activeIssues.length });
    for (const result of interpretations) {
      if (result.status === 'UNKNOWN') continue;
      const count = measured.get(result.nutrient) ?? { comparable: 0, adequate: 0 };
      count.comparable++;
      if (result.status === 'ADEQUATE') count.adequate++;
      measured.set(result.nutrient, count);
      if (result.status === 'LOW' && result.nutrient !== 'PH' && result.nutrient !== 'OM') deficient.add(result.nutrient);
    }

    const state = lowCount > 1 ? states.multiple
      : primary?.status === 'LOW' ? states.low
        : primary?.status === 'HIGH' ? states.high
          : (nutrient === 'all' ? interpretations.some(result => result.status === 'ADEQUATE') : reading?.status === 'ADEQUATE') ? states.adequate : states.unknown;
    const area = block.areaHa != null ? `${number(block.areaHa, 1)} ha` : '';
    const statusLabel = lowCount > 1 ? `${lowCount} valores bajos` : primary?.label ?? state.label;
    presentation.set(block.id, {
      color: state.color,
      label: block.code,
      detail: reading ? `${number(reading.value, 4)} ${units[reading.unit]} · ${reading.label}` : [statusLabel, area].filter(Boolean).join(' · '),
      indicator: primary ? 'alert' : state === states.adequate ? 'check' : undefined,
    });
  }

  alerts.sort((first, second) => second.count - first.count || Number(second.issue.status === 'LOW') - Number(first.issue.status === 'LOW') || first.block.code.localeCompare(second.block.code, 'es'));
  const selectedSample = samples.get(selectedBlock);
  const spotlight = alerts[0];
  const approvedWithTarget = approvedPlans.filter(plan => plan.totalQuantity > 0);
  const completed = approvedWithTarget.filter(plan => plan.appliedQuantity >= plan.totalQuantity).length;
  const pending = approvedWithTarget.filter(plan => plan.appliedQuantity <= 0).length;
  const inProgress = approvedWithTarget.length - completed - pending;
  const progress = approvedWithTarget.length ? Math.round(100 * completed / approvedWithTarget.length) : null;
  const pendingBlocks = new Set(approvedWithTarget.filter(plan => plan.appliedQuantity < plan.totalQuantity).map(plan => plan.blockId));
  const knownAreas = data.blocks.filter(block => pendingBlocks.has(block.id) && block.areaHa != null).map(block => block.areaHa ?? 0);
  const area = knownAreas.length || pendingBlocks.size === 0 ? `${number(knownAreas.reduce((sum, item) => sum + item, 0), 1)} ha` : '—';
  const nutrientSymbols = [...deficient].map(symbol).join(', ');
  const metrics = [
    { icon: Leaf, tone: 'green strong-green', label: 'Cumplimiento del plan', value: progress != null ? `${progress} %` : '—', detail: approvedWithTarget.length ? `${completed} de ${approvedWithTarget.length} planes completados` : 'Sin planes aprobados' },
    { icon: PackageCheck, tone: 'blue', label: 'Fertilizante aplicado', value: amount || '—', detail: `${applications.length} ${applications.length === 1 ? 'aplicación registrada' : 'aplicaciones registradas'}` },
    { icon: Wallet, tone: 'mint', label: 'Costo de fertilización', value: '—', detail: 'Sin costos registrados' },
    { icon: Sprout, tone: 'mint', label: 'Áreas por fertilizar', value: area, detail: knownAreas.length < pendingBlocks.size ? 'Área registrada parcialmente' : 'Bloques con saldo pendiente' },
    { icon: FlaskConical, tone: 'gold', label: 'Deficiencias detectadas', value: `${deficient.size} ${deficient.size === 1 ? 'nutriente' : 'nutrientes'}`, detail: nutrientSymbols || 'Según el rango de referencia' },
  ];
  const legend = <>
    {Object.values(states).filter(state => nutrient === 'all' || state !== states.multiple).map(state => <span key={state.label}><i style={{ background: state.color }} />{state.label}</span>)}
  </>;
  const alertList = (items: typeof alerts) => <ul className="fertilization-alert-list">{items.map(({ block, sample, issue, count }) => <li key={block.id}>
    <span className={`fertilization-alert-icon ${issue.status === 'LOW' ? 'low' : 'high'}`}><FlaskConical size={19} /></span>
    <div className="fertilization-alert-copy">
      <strong>{nutrientNames[issue.nutrient]}</strong>
      <span>{block.code}{block.areaHa != null && ` · ${number(block.areaHa, 1)} ha`}</span>
      <p>{number(issue.value, 4)} {units[issue.unit]} · {count > 1 ? `${count} resultados fuera del rango` : 'Fuera del rango de referencia'}</p>
      <div className="fertilization-alert-actions">
        <button className="outline-action" onClick={() => { setShowAllAlerts(false); onAnalysis(sample); }}>Ver análisis</button>
        {onPlan ? <button className="outline-action" onClick={() => { setShowAllAlerts(false); onPlan(sample); }}>Crear plan</button>
          : <button className="outline-action" onClick={() => { setShowAllAlerts(false); setSelectedBlock(block.id); }}>Ver zona</button>}
      </div>
    </div>
    <span className={`fertilization-alert-status ${issue.status === 'LOW' ? 'low' : 'high'}`}>{issue.label}</span>
  </li>)}</ul>;

  return <div className="fertilization-overview">
    <div className="fertilization-overview-metrics">
      {metrics.map(metric => <article className="module-kpi" key={metric.label}>
        <span className={`module-kpi-icon ${metric.tone}`}><metric.icon size={22} /></span>
        <div><small>{metric.label}</small><strong>{metric.value}</strong><span>{metric.detail}</span></div>
      </article>)}
    </div>

    <div className="fertilization-map-grid">
      <section className="fertilization-map-card panel">
        <div className="fertilization-map-heading">
          <div><h2>Estado nutricional del cultivo</h2><p>Consulta la última muestra de suelo y su interpretación por bloque.</p></div>
          <div className="fertilization-map-actions">
            <select className="compact-select" aria-label="Mapa base" value={baseLayer} onChange={event => setBaseLayer(event.target.value === 'map' ? 'map' : 'satellite')}>
              <option value="satellite">Vista satelital</option><option value="map">Vista de plano</option>
            </select>
            <button className="icon-button" aria-label="Expandir mapa nutricional" onClick={() => setExpandSignal(value => value + 1)}><Maximize2 size={17} /></button>
          </div>
        </div>
        <div className="fertilization-map-nutrients" role="group" aria-label="Nutrientes del mapa">
          <button type="button" aria-pressed={nutrient === 'all'} onClick={() => setNutrient('all')}>Estado general</button>
          {nutrientLayers.map(code => <button type="button" key={code} aria-pressed={nutrient === code} onClick={() => setNutrient(code)}>{nutrientNames[code]}</button>)}
        </div>
        <div className="fertilization-overview-map">
          <FarmMap farm={data.farms[0]} fields={data.fields} blocks={data.blocks} demo={demo} baseLayer={baseLayer}
            selected={selectedBlock} onSelect={setSelectedBlock} expandSignal={expandSignal} blockPresentation={presentation}
            legend={<div className="fertilization-map-legend"><strong>Estado nutricional</strong>{legend}</div>} />
        </div>
        <div className="fertilization-mobile-legend" aria-label="Leyenda del mapa">{legend}</div>
        {selectedBlock !== 0 && <div className="fertilization-map-selection">
          <strong>{data.blocks.find(block => block.id === selectedBlock)?.code}</strong>
          {selectedSample ? <button className="text-button" onClick={() => onAnalysis(selectedSample)}>Ver análisis del bloque <ArrowRight size={15} /></button> : <span>Sin muestra de suelo en esta selección</span>}
          <button className="icon-button" aria-label="Quitar selección de bloque" onClick={() => setSelectedBlock(0)}><X size={16} /></button>
        </div>}
      </section>

      <Panel className="fertilization-alerts" title="Alertas de nutrición" action={alerts.length > 0 && <button className="text-button" onClick={() => setShowAllAlerts(true)}>Ver todas <ArrowRight size={14} /></button>}>
        {alerts.length ? alertList(alerts.slice(0, 3)) : <div className="fertilization-overview-empty"><ClipboardCheck size={21} /><p>{samples.size ? 'Sin alertas para el nutriente y los bloques seleccionados.' : 'Las alertas aparecen al interpretar los resultados de suelo.'}</p></div>}
      </Panel>
      {showAllAlerts && <Modal className="farm-work-modal nutrient-modal" title="Alertas de nutrición" onClose={() => setShowAllAlerts(false)}>
        <div className="fertilization-alert-dialog">{alertList(alerts)}</div>
      </Modal>}
    </div>

    <div className="fertilization-overview-lower">
      <Panel title="Avance del plan de fertilización" action={<button className="text-button" onClick={() => onTab('plans')}>Ver planes <ArrowRight size={14} /></button>}>
        <div className="fertilization-overview-progress">
          <Donut value={progress != null ? `${progress} %` : '—'} label="Cumplimiento" segments={approvedWithTarget.length ? [completed, inProgress, pending] : [0, 0, 1]} colors={['#09874a', '#f7c32b', '#dfe7e3']} />
          <ul>
            <li><i className="complete" /><strong>{completed}</strong> Completados</li>
            <li><i className="progressing" /><strong>{inProgress}</strong> En proceso</li>
            <li><i className="pending" /><strong>{pending}</strong> Pendientes</li>
          </ul>
        </div>
        <p className="fertilization-card-note">Planes aprobados: {approvedWithTarget.length}</p>
      </Panel>
      <Panel title="Estado de nutrientes">
        <p className="fertilization-card-note">Muestras comparables en rango</p>
        <div className="fertilization-nutrient-chart">
          <div className="fertilization-chart-axis" aria-hidden="true"><span>100 %</span><span>75 %</span><span>50 %</span><span>25 %</span><span>0 %</span></div>
          <ul>{nutrientLayers.filter(code => code !== 'PH').map(code => {
            const count = measured.get(code);
            const ratio = count ? Math.round(100 * count.adequate / count.comparable) : null;
            return <li key={code} className={(ratio ?? 0) >= 50 ? 'in-range' : 'needs-review'}
              aria-label={`${nutrientNames[code]} · ${count ? `${count.adequate} de ${count.comparable} muestras en rango` : 'Sin muestras comparables'}`}>
              <div className="fertilization-nutrient-bar" style={{ height: `${ratio ?? 0}%` }}><strong>{ratio != null ? `${ratio}%` : '—'}</strong></div>
              <span>{symbol(code)}</span>
            </li>;
          })}</ul>
        </div>
      </Panel>
      <Panel title="Últimas aplicaciones" action={<button className="text-button" onClick={() => onTab('applications')}>Ver historial <ArrowRight size={14} /></button>}>
        {applications.length ? <ul className="fertilization-recent-applications">{applications.slice(0, 3).map(({ application, plan }) => <li key={application.id}>
          <button onClick={() => onApplication(application)}>
            <span className="fertilization-recent-icon"><PackageCheck size={18} /></span>
            <span><strong>{plan.product}</strong><small>{data.blocks.find(block => block.id === plan.blockId)?.code} · {number(application.coverage, 2)} {coverageUnit(plan.doseUnit)}</small></span>
            <time dateTime={application.occurredAt}>{dateLabel(application.occurredAt)}</time>
          </button>
        </li>)}</ul> : <div className="fertilization-overview-empty"><PackageCheck size={21} /><p>Aún no hay aplicaciones registradas en esta selección.</p></div>}
      </Panel>
      <section className="panel fertilization-review-card" aria-label="Revisión técnica">
        <div className="fertilization-review-heading"><span><ClipboardCheck size={22} /></span><div><h3>Revisión técnica</h3><p>Seguimiento de nutrición</p></div></div>
        <p>{spotlight ? 'Consulta el resultado, el método y el rango de referencia antes de ajustar el plan.' : 'Las muestras de suelo permiten revisar los valores y dar seguimiento al plan.'}</p>
        {spotlight && <div className="fertilization-review-highlight"><Sprout size={21} /><strong>{spotlight.block.code} · {nutrientNames[spotlight.issue.nutrient]} · {spotlight.issue.label}</strong></div>}
        <button className="button" onClick={() => spotlight ? onAnalysis(spotlight.sample) : onTab('analyses')}>{spotlight ? 'Revisar análisis' : 'Consultar análisis'}<ArrowRight size={15} /></button>
      </section>
    </div>
  </div>;
}
