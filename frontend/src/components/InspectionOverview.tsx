import { useState } from 'react';
import { ArrowRight, Bug, CalendarCheck, CalendarClock, ClipboardCheck, MapPin, Maximize2, ShieldCheck } from 'lucide-react';
import { useApp } from '../context';
import { localDate, number } from '../lib/domain';
import { assessmentLabels, inspectionHealth } from '../lib/inspections';
import type { HealthStatus, Inspection, SanitaryProblem } from '../lib/inspections';
import FarmMap from './FarmMap';
import type { BlockPresentation } from './FarmMap';
import { Badge, Panel } from './ui';

const statuses: Record<HealthStatus, { title: string; color: string; indicator?: BlockPresentation['indicator'] }> = {
  ACTIVE_FINDINGS: { title: 'Hallazgos activos', color: '#e34239', indicator: 'alert' },
  NO_ACTIVE_FINDINGS: { title: 'Sin hallazgos activos', color: '#1b9d55', indicator: 'check' },
  NO_RECENT_INSPECTION: { title: 'Sin inspección vigente', color: '#899aaf' },
};

function openFinding(record: Inspection) {
  return !record.canceledAt && !record.resolved && record.assessmentStatus !== 'DISCARDED' && record.affectedPlants > 0;
}

export default function InspectionOverview({ records, problems, onOpen, onShowRegister }: {
  records: Inspection[];
  problems: SanitaryProblem[];
  onOpen: (record: Inspection) => void;
  onShowRegister: () => void;
}) {
  const { data, mode } = useApp();
  const [problem, setProblem] = useState('');
  const [selectedBlockId, setSelectedBlockId] = useState(0);
  const [expandSignal, setExpandSignal] = useState(0);
  const today = localDate();
  const recent = records.filter(record => !record.canceledAt).sort((a, b) => b.inspectedAt.localeCompare(a.inspectedAt) || b.id - a.id);
  const latestByTarget = new Map<string, Inspection>();
  for (const record of recent) {
    const key = `${record.blockId}:${record.rowId ?? ''}:${record.problemCode}`;
    if (!latestByTarget.has(key)) latestByTarget.set(key, record);
  }
  const findings = [...latestByTarget.values()].filter(openFinding);
  const mapRecords = recent.filter(record => !problem || record.problemCode === problem);
  const mapStatuses = data.blocks.map(block => ({ block, status: inspectionHealth(mapRecords, block.id) }));
  const presentation = new Map<number, BlockPresentation>(mapStatuses.map(({ block, status }) => [block.id, {
    color: statuses[status].color, detail: statuses[status].title, indicator: statuses[status].indicator,
  }]));
  const farmStatuses = problem ? data.blocks.map(block => inspectionHealth(recent, block.id)) : mapStatuses.map(item => item.status);
  const metrics = [
    { label: 'Bloques evaluados', value: farmStatuses.filter(status => status !== 'NO_RECENT_INSPECTION').length, detail: `de ${data.blocks.length} bloques`, icon: ClipboardCheck, tone: 'green' },
    { label: 'Hallazgos abiertos', value: findings.length, detail: 'Última inspección por ubicación y problema', icon: Bug, tone: 'red' },
    { label: 'Bloques con hallazgos', value: farmStatuses.filter(status => status === 'ACTIVE_FINDINGS').length, detail: 'Con inspección vigente', icon: MapPin, tone: 'gold' },
    { label: 'Casos confirmados', value: findings.filter(record => record.assessmentStatus === 'CONFIRMED').length, detail: 'Pendientes de resolución', icon: ShieldCheck, tone: 'violet' },
    { label: 'Inspecciones registradas', value: recent.length, detail: 'Registros vigentes en el historial', icon: CalendarCheck, tone: 'green' },
    { label: 'Visitas vencidas', value: findings.filter(record => record.nextVisit < today).length, detail: 'Hallazgos abiertos por revisar', icon: CalendarClock, tone: 'gold' },
  ];
  const selectedBlock = data.blocks.find(block => block.id === selectedBlockId);
  const selectedInspection = selectedBlock && mapRecords.find(record => record.blockId === selectedBlock.id);
  const alerts = findings.length ? findings.slice(0, 3) : recent.slice(0, 3);
  const chart = Array.from({ length: 4 }, (_, index) => {
    const start = new Date(`${today}T00:00:00`);
    start.setDate(start.getDate() - (3 - index) * 7 - 6);
    const end = new Date(start);
    end.setDate(end.getDate() + 7);
    return { label: start.toLocaleDateString('es-CO', { day: 'numeric', month: 'short' }),
      count: recent.filter(record => localDate(new Date(record.inspectedAt)) >= localDate(start) && localDate(new Date(record.inspectedAt)) < localDate(end)).length };
  });
  const peak = Math.max(1, ...chart.map(item => item.count));
  const legend = Object.values(statuses).map(status => <span key={status.title}><i style={{ background: status.color }} />{status.title}</span>);

  return <>
    <div className="inspection-kpis">
      {metrics.map(metric => <article className="panel inspection-kpi" key={metric.label}>
        <span className={`inspection-icon ${metric.tone}`}><metric.icon size={22} /></span>
        <div><span>{metric.label}</span><strong>{number(metric.value)}</strong><small>{metric.detail}</small></div>
      </article>)}
    </div>
    <div className="inspection-overview">
      <Panel className="inspection-map-panel">
        <div className="inspection-section-heading">
          <div><h2>Mapa de enfermedades y plagas</h2><p>Hallazgos por bloque según las inspecciones vigentes.</p></div>
          <div className="inspection-map-controls">
            <select aria-label="Problema en el mapa" value={problem} onChange={event => setProblem(event.target.value)}>
              <option value="">Todas las plagas y enfermedades</option>
              {problems.map(item => <option key={item.code} value={item.code}>{item.name}</option>)}
            </select>
            <button className="icon-button" aria-label="Expandir mapa fitosanitario" onClick={() => setExpandSignal(value => value + 1)}><Maximize2 size={17} /></button>
          </div>
        </div>
        <div className="inspection-map">
          <FarmMap farm={data.farms[0]} fields={data.fields} blocks={data.blocks} demo={mode === 'demo'}
            blockPresentation={presentation} selected={selectedBlockId} onSelect={setSelectedBlockId} expandSignal={expandSignal}
            legend={<div className="inspection-map-legend"><strong>Estado del bloque</strong>{legend}</div>} />
        </div>
        <div className="inspection-inline-legend" aria-label="Leyenda del mapa">{legend}</div>
        {selectedBlock && <div className="inspection-map-selection">
          <strong>{selectedBlock.code}</strong>
          <span>{presentation.get(selectedBlock.id)?.detail}</span>
          {selectedInspection && <button className="text-button" onClick={() => onOpen(selectedInspection)}>Consultar última inspección <ArrowRight size={15} /></button>}
        </div>}
      </Panel>
      <Panel className="inspection-case-panel" title="Alertas y casos recientes">
        {alerts.length ? <ul className="inspection-cases">{alerts.map(record => <li key={record.id}>
          <span className={`inspection-icon ${openFinding(record) ? 'red' : 'green'}`}><Bug size={21} /></span>
          <div>
            <div className="inspection-case-heading"><h3>{record.problemName}</h3><Badge tone={record.resolved || record.assessmentStatus === 'DISCARDED' ? 'neutral' : 'gold'}>{record.resolved ? 'Resuelta' : assessmentLabels[record.assessmentStatus]}</Badge></div>
            <p>{data.blocks.find(block => block.id === record.blockId)?.code ?? `Bloque #${record.blockId}`} · {number(record.affectedPlants)} de {number(record.inspectedPlants)} plantas afectadas</p>
            <button className="button secondary" aria-label={`Consultar caso ${record.id}`} onClick={() => onOpen(record)}>Ver caso <ArrowRight size={14} /></button>
          </div>
        </li>)}</ul> : <p className="inspection-empty-copy">Los hallazgos aparecerán aquí después de registrar una inspección.</p>}
        <button className="text-button" onClick={onShowRegister}>Ver historial <ArrowRight size={15} /></button>
      </Panel>
    </div>
    <div className="inspection-overview-lower">
      <Panel title="Evolución de las inspecciones" className="inspection-chart-panel">
        <p>Registros por semana durante los últimos 28 días.</p>
        <ol className="inspection-trend">{chart.map(item => <li key={item.label}><span>{item.label}</span><div aria-hidden="true"><i style={{ width: `${item.count / peak * 100}%` }} /></div><strong>{number(item.count)}</strong></li>)}</ol>
      </Panel>
      <Panel title="Próximas visitas" className="inspection-visits-panel">
        {findings.length ? <ul className="inspection-visits">{[...findings].sort((first, second) => first.nextVisit.localeCompare(second.nextVisit)).slice(0, 3).map(record => <li key={record.id}>
          <CalendarClock size={19} /><div><strong>{record.problemName}</strong><time dateTime={record.nextVisit}>{new Date(`${record.nextVisit}T00:00:00`).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' })}</time></div>
          {record.nextVisit < today && <Badge tone="red">Vencida</Badge>}
          <button className="icon-button" aria-label={`Consultar visita ${record.id}`} onClick={() => onOpen(record)}><ArrowRight size={16} /></button>
        </li>)}</ul> : <p className="inspection-empty-copy">Aún no hay visitas pendientes por hallazgos abiertos.</p>}
      </Panel>
    </div>
  </>;
}
