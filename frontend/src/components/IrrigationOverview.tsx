import { useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { CalendarDays, Clock3, Droplet, Droplets, Gauge, Layers2, Leaf, Maximize2, Plus, Search } from 'lucide-react';
import { localDate, number } from '../lib/domain';
import { moistureUnits } from '../lib/irrigation';
import type { IrrigationExecution, IrrigationPlan, IrrigationSector, IrrigationInfrastructure, IrrigationMaintenance, MoistureCondition } from '../lib/irrigation';
import type { FarmData } from '../lib/types';
import FarmMap from './FarmMap';
import type { BlockPresentation } from './FarmMap';

const statuses: Record<MoistureCondition | 'SCHEDULED', { label: string; color: string; tone: string }> = {
  BELOW_RANGE: { label: 'Por debajo del rango', color: '#e64d42', tone: 'critical' },
  ABOVE_RANGE: { label: 'Por encima del rango', color: '#2583df', tone: 'blue' },
  SCHEDULED: { label: 'Programado', color: '#efbb2d', tone: 'gold' },
  IN_RANGE: { label: 'Dentro del rango', color: '#2ea65e', tone: 'green' },
  STALE: { label: 'Medición antigua', color: '#9778aa', tone: 'neutral' },
  NO_DATA: { label: 'Sin medición', color: '#819187', tone: 'neutral' },
  UNCONFIGURED: { label: 'Sin límites técnicos', color: '#a3a59a', tone: 'neutral' },
};

const scheduleDate = (plan: IrrigationPlan) => `${plan.scheduledOn}T${plan.scheduledTime}`;
const showDate = (value: string) => new Date(value).toLocaleString('es-CO', {
  day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
});

type Props = {
  data: FarmData;
  demo: boolean;
  date: string;
  sectors: IrrigationSector[];
  plans: IrrigationPlan[];
  executions: IrrigationExecution[];
  infrastructure?: IrrigationInfrastructure[];
  maintenance: IrrigationMaintenance[];
  alerts: ReactNode;
  onView: (sector: IrrigationSector) => void;
  onCreate?: () => void;
  canCreate: boolean;
};

export default function IrrigationOverview({ data, demo, date, sectors, plans, executions, infrastructure, maintenance, alerts, onView, onCreate, canCreate }: Props) {
  const [fieldId, setFieldId] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [query, setQuery] = useState('');
  const [selectedBlock, setSelectedBlock] = useState(0);
  const [expandSignal, setExpandSignal] = useState(0);
  const [showInfrastructure, setShowInfrastructure] = useState(true);
  const blocksById = new Map(data.blocks.map(block => [block.id, block]));
  const sectorsById = new Map(sectors.map(sector => [sector.id, sector]));
  const now = new Date();
  const scheduled = plans.filter(plan => plan.status === 'SCHEDULED' && !['completed', 'review', 'canceled'].includes(plan.taskStatus ?? '')
    && plan.actualDurationMinutes < plan.durationMinutes && plan.actualVolumeM3 < plan.volumeM3)
    .sort((first, second) => scheduleDate(first).localeCompare(scheduleDate(second)));
  const upcoming = scheduled.filter(plan => new Date(scheduleDate(plan)) >= now);
  const nextBySector = new Map<number, IrrigationPlan>();
  for (const plan of upcoming) {
    if (!nextBySector.has(plan.sectorId)) nextBySector.set(plan.sectorId, plan);
  }
  const planSectors = new Map(plans.map(plan => [plan.id, plan.sectorId]));
  const latestBySector = new Map<number, IrrigationExecution>();
  for (const execution of executions) {
    const sectorId = planSectors.get(execution.planId);
    if (sectorId == null) continue;
    const previous = latestBySector.get(sectorId);
    if (!previous || Date.parse(previous.endedAt) < Date.parse(execution.endedAt)) latestBySector.set(sectorId, execution);
  }

  const dayExecutions = executions.filter(execution => localDate(new Date(execution.endedAt)) === date);
  const dayPlans = scheduled.filter(plan => plan.scheduledOn === date);
  const daySectorIds = [...new Set(dayPlans.map(plan => plan.sectorId))];
  const pressure = maintenance.filter(item => item.completedOn === date && item.pressureKpa != null);
  const next = upcoming[0];
  const kpis = [
    { icon: Droplet, tone: 'blue', label: 'Consumo registrado', value: `${number(dayExecutions.reduce((total, item) => total + item.volumeM3, 0), 1)} m³`, note: `${dayExecutions.length} ${dayExecutions.length === 1 ? 'ejecución' : 'ejecuciones'} en la fecha` },
    { icon: CalendarDays, tone: 'green', label: 'Sectores programados', value: `${daySectorIds.length} / ${sectors.length}`, note: 'En la fecha seleccionada' },
    { icon: Droplets, tone: 'teal', label: 'Volumen pendiente', value: `${number(dayPlans.reduce((total, item) => total + item.volumeM3 - item.actualVolumeM3, 0), 1)} m³`, note: 'Según la programación' },
    { icon: Gauge, tone: 'blue', label: 'Presión registrada', value: pressure.length ? `${number(pressure.reduce((total, item) => total + (item.pressureKpa ?? 0), 0) / pressure.length, 1)} kPa` : '—', note: pressure.length ? 'Promedio de mantenimiento' : 'Sin mediciones en la fecha' },
    { icon: Clock3, tone: 'gold', label: 'Próximo riego', value: next?.scheduledTime.slice(0, 5) ?? '—', note: next ? `${sectorsById.get(next.sectorId)?.name ?? ''} · ${next.scheduledOn}` : 'Sin programación futura' },
    { icon: Leaf, tone: 'green', label: 'Área programada', value: `${number(daySectorIds.reduce((total, id) => total + (sectorsById.get(id)?.areaHa ?? 0), 0), 1)} ha`, note: 'En la fecha seleccionada' },
  ];
  const statusFor = (sector: IrrigationSector) => {
    if (sector.condition === 'BELOW_RANGE' || sector.condition === 'ABOVE_RANGE') return sector.condition;
    return nextBySector.has(sector.id) ? 'SCHEDULED' : sector.condition;
  };
  const activeFieldId = data.fields.some(field => String(field.id) === fieldId) ? fieldId : '';
  const infrastructurePoints = useMemo(() => (infrastructure ?? []).flatMap(asset => {
    const { latitude, longitude } = asset;
    if (latitude == null || longitude == null || !Number.isFinite(latitude) || !Number.isFinite(longitude)
      || Math.abs(latitude) > 90 || Math.abs(longitude) > 180) return [];
    if (activeFieldId && !data.blocks.some(block => block.id === asset.blockId && block.field.id === Number(activeFieldId))) return [];
    return [{ latitude, longitude, label: asset.code }];
  }), [activeFieldId, data.blocks, infrastructure]);
  const term = query.trim().toLocaleLowerCase('es');
  const visible = sectors.filter(sector => {
    const block = blocksById.get(sector.blockId);
    return (!activeFieldId || block?.field.id === Number(activeFieldId))
      && (!statusFilter || statusFor(sector) === statusFilter)
      && `${sector.name} ${block?.code ?? ''} ${block?.field.name ?? ''}`.toLocaleLowerCase('es').includes(term);
  });
  const sectorsByBlock = new Map<number, IrrigationSector[]>();
  for (const sector of visible) {
    const members = sectorsByBlock.get(sector.blockId) ?? [];
    members.push(sector);
    sectorsByBlock.set(sector.blockId, members);
  }
  const visibleStatuses = new Set(visible.map(statusFor));
  const presentation = new Map<number, BlockPresentation>();
  for (const [blockId, members] of sectorsByBlock) {
    const highest = Object.keys(statuses).find(key => members.some(sector => statusFor(sector) === key)) as keyof typeof statuses;
    const status = statuses[highest];
    presentation.set(blockId, {
      color: status.color,
      label: members.length === 1 ? members[0].name : blocksById.get(blockId)?.code,
      detail: members.length === 1 ? `${number(members[0].areaHa, 1)} ha · ${status.label}` : `${members.length} sectores · ${status.label}`,
    });
  }
  const network = demo && showInfrastructure && blocksById.size > 0;
  const points = !demo && showInfrastructure ? infrastructurePoints : undefined;
  const legendItems = <>
    {Object.entries(statuses).filter(([key]) => visibleStatuses.has(key as keyof typeof statuses)).map(([key, status]) => (
      <span key={key}><i style={{ backgroundColor: status.color }} />{status.label}</span>
    ))}
    {network && <span className="irrigation-network-key"><i />Red ilustrativa</span>}
    {Boolean(points?.length) && <span className="irrigation-point-key"><i />Activo georreferenciado</span>}
  </>;
  const hasLegend = visibleStatuses.size > 0 || network || Boolean(points?.length);

  return <>
    <div className="irrigation-kpi-grid">
      {kpis.map(metric => <article className="module-kpi" key={metric.label}>
        <span className={`module-kpi-icon ${metric.tone}`}><metric.icon size={22} /></span>
        <div><small>{metric.label}</small><strong>{metric.value}</strong><span>{metric.note}</span></div>
      </article>)}
    </div>
    <div className="irrigation-dashboard-main">
      <section className="irrigation-map-card">
        <div className="irrigation-section-heading">
          <div><h3>Mapa de sectores de riego</h3><p>Humedad, programación e infraestructura por bloque.</p></div>
          <div className="irrigation-map-actions">
            <select className="compact-select" aria-label="Filtrar mapa por estado de riego" value={statusFilter} onChange={event => { setStatusFilter(event.target.value); setSelectedBlock(0); }}>
              <option value="">Estado de riego</option>
              {Object.entries(statuses).map(([key, status]) => <option value={key} key={key}>{status.label}</option>)}
            </select>
            <select className="compact-select" aria-label="Filtrar mapa por campo" value={activeFieldId} onChange={event => { setFieldId(event.target.value); setSelectedBlock(0); }}>
              <option value="">Todos los campos</option>
              {data.fields.map(field => <option value={field.id} key={field.id}>{field.name}</option>)}
            </select>
            {(demo || infrastructurePoints.length > 0) && <button type="button" className="irrigation-map-tool" aria-label={demo ? 'Red de riego ilustrativa' : 'Infraestructura en el mapa'} aria-pressed={showInfrastructure} title={demo ? 'Red de riego ilustrativa' : 'Infraestructura en el mapa'} onClick={() => setShowInfrastructure(value => !value)}><Layers2 size={16} /></button>}
            <button type="button" className="irrigation-map-tool" aria-label="Expandir mapa de riego" onClick={() => setExpandSignal(value => value + 1)}><Maximize2 size={16} /></button>
          </div>
        </div>
        <div className="irrigation-map">
          <FarmMap farm={data.farms[0]} fields={data.fields} blocks={data.blocks} demo={demo}
            baseLayer="satellite" selected={selectedBlock} onSelect={setSelectedBlock} expandSignal={expandSignal}
            blockPresentation={presentation} irrigationNetwork={network} infrastructurePoints={points}
            legend={hasLegend && <div className="irrigation-map-legend"><strong>Leyenda</strong>{legendItems}</div>} />
        </div>
        {hasLegend && <div className="irrigation-map-legend-mobile" aria-label="Leyenda del mapa">{legendItems}</div>}
        {selectedBlock !== 0 && <div className="irrigation-map-selection">
          <strong>{blocksById.get(selectedBlock)?.code}</strong>
          {(sectorsByBlock.get(selectedBlock) ?? []).map(sector => <button className="text-button" key={sector.id} onClick={() => onView(sector)}>{sector.name}</button>)}
          {!sectorsByBlock.has(selectedBlock) && <span>Sin sectores visibles para este bloque.</span>}
          <button className="text-button" onClick={() => setSelectedBlock(0)}>Quitar selección</button>
        </div>}
      </section>
      {alerts}
    </div>
    <section className="irrigation-sector-card">
      <div className="irrigation-section-heading">
        <div><h3>Sectores de riego</h3><p>Estado, última medición y programación por sector.</p></div>
        <div className="irrigation-table-actions">
          <label><Search size={16} /><input aria-label="Buscar sector" placeholder="Buscar sector…" value={query} onChange={event => setQuery(event.target.value)} /></label>
          <select className="compact-select" aria-label="Filtrar sectores por campo" value={activeFieldId} onChange={event => setFieldId(event.target.value)}>
            <option value="">Todos los campos</option>
            {data.fields.map(field => <option value={field.id} key={field.id}>{field.name}</option>)}
          </select>
          <select className="compact-select" aria-label="Filtrar sectores por estado" value={statusFilter} onChange={event => setStatusFilter(event.target.value)}>
            <option value="">Todos los estados</option>
            {Object.entries(statuses).map(([key, status]) => <option value={key} key={key}>{status.label}</option>)}
          </select>
          {onCreate && <button className="button small" disabled={!canCreate} onClick={onCreate}><Plus size={16} />Nuevo sector</button>}
        </div>
      </div>
      <div className="table-wrap">
        <table className="irrigation-dashboard-table farm-record-table" role="table">
          <thead role="rowgroup"><tr role="row"><th>Sector</th><th>Campo / bloque</th><th>Área</th><th>Última humedad</th><th>Estado</th><th>Última ejecución</th><th>Próxima ejecución</th><th>Acciones</th></tr></thead>
          <tbody role="rowgroup">{visible.map(sector => {
            const block = blocksById.get(sector.blockId);
            const status = statuses[statusFor(sector)];
            const previous = latestBySector.get(sector.id);
            const nextPlan = nextBySector.get(sector.id);
            return <tr role="row" key={sector.id}>
              <td role="cell"><strong>{sector.name}</strong></td>
              <td role="cell" data-label="Campo / bloque">{block ? `${block.field.name} / ${block.code}` : '—'}</td>
              <td role="cell" data-label="Área">{number(sector.areaHa, 1)} ha</td>
              <td role="cell" data-label="Última humedad">{sector.latest ? `${number(sector.latest.value, 1)} ${moistureUnits[sector.latest.unit]}` : '—'}</td>
              <td role="cell" data-label="Estado"><span className={`irrigation-status-pill ${status.tone}`}><i style={{ backgroundColor: status.color }} />{status.label}</span></td>
              <td role="cell" data-label="Última ejecución">{previous ? showDate(previous.endedAt) : '—'}</td>
              <td role="cell" data-label="Próxima ejecución">{nextPlan ? showDate(scheduleDate(nextPlan)) : '—'}</td>
              <td role="cell"><button className="outline-action" aria-label={`Ver ${sector.name}`} onClick={() => onView(sector)}>Ver</button></td>
            </tr>;
          })}</tbody>
        </table>
      </div>
      {!visible.length && <p className="module-empty-note">{sectors.length ? 'Ningún sector coincide con los filtros.' : 'Todavía no hay sectores registrados.'}</p>}
    </section>
  </>;
}
