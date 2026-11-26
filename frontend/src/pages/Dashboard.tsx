import { useEffect, useState } from 'react';
import { ArrowRight, ArrowUpRight, CalendarCheck2, ChartNoAxesCombined, ChevronDown, ChevronRight, Droplets, FlaskConical, HeartPulse, Leaf, Maximize2, Plus, Sprout, TriangleAlert, Wheat, Bug, CloudSun, MapPin, Wind } from 'lucide-react';
import { useApp } from '../context';
import { api } from '../lib/api';
import { farmMetrics, number, eventLabels, statusLabels, todayTasks } from '../lib/domain';
import { demoAnalytics, readDemo } from '../lib/demo';
import { demoInspections, inspectionDemoKey, withInspectionHealth } from '../lib/inspections';
import { Badge, Donut, Empty, LineChart, LinkButton, Panel } from '../components/ui';
import FarmMap, { type BlockPresentation, type MapLayer } from '../components/FarmMap';
import { EventForm } from '../components/Forms';
import { healthMapBands, moistureMapBands } from '../lib/map-analytics';
import { financeApi, financeCategoryLabels, formatCop, type FinanceMonth } from '../lib/costs';
import type { WaterUsageSummary } from '../lib/analytics';
import type { ProductionRecord } from '../lib/production';
import type { AnalyticsLayer, Block, DashboardAnalytics, DiseaseLayer, FarmData, FieldEvent, Page, Task } from '../lib/types';

export function EventIcon({ event }: { event: FieldEvent }) {
  const mapping = { SCOUTING_OBSERVATION: [Bug, 'red'], TREATMENT_APPLICATION: [HeartPulse, 'purple'], FERTILIZER_APPLICATION: [Sprout, 'green'], IRRIGATION_EVENT: [Droplets, 'blue'], HANDLING_EVENT: [Leaf, 'green'], SOIL_SAMPLE: [FlaskConical, 'orange'], HARVEST_EVENT: [Wheat, 'gold'] } as const;
  const [Icon, color] = mapping[event.eventType];
  return <span className={`icon-tile ${color}`}><Icon size={20} strokeWidth={1.8} /></span>;
}

export function EventList({ limit = 4 }: { limit?: number }) {
  const { data, navigate, search } = useApp();
  const events = [...data.events].filter(event => `${eventLabels[event.eventType]} ${event.notes} ${event.block?.code ?? event.row?.block.code}`.toLocaleLowerCase('es').includes(search.toLocaleLowerCase('es'))).sort((first, second) => second.occurredAt.localeCompare(first.occurredAt)).slice(0, limit);
  return events.length ? <div className="activity-list">{events.map(event => <button className="activity-row" key={event.id} onClick={() => navigate('reports')}><EventIcon event={event} /><span><strong>{eventLabels[event.eventType]}</strong><small>{new Date(event.occurredAt).toLocaleDateString('es-CO', { day: 'numeric', month: 'short' })} · {event.block?.code ?? event.row?.block.code ?? 'Sin bloque'}</small></span><ChevronRight size={15} /></button>)}</div> : <Empty title="Un nuevo comienzo" description="Las actividades de tu finca aparecerán aquí cuando las registres." />;
}

type DashboardMapTab = MapLayer | 'disease' | 'production';

function productionRecordDate(record: ProductionRecord) {
  return record.actualHarvestDate ?? record.recordedAt.slice(0, 10);
}

function productionQuantities(records: ProductionRecord[]) {
  const quantities = new Map<string, number>();
  for (const { yieldUnit, harvestedQuantity } of records) {
    if (yieldUnit && harvestedQuantity != null) quantities.set(yieldUnit, (quantities.get(yieldUnit) ?? 0) + harvestedQuantity);
  }
  return quantities;
}

function formatQuantities(quantities: Map<string, number>) {
  return [...quantities].map(([unit, quantity]) => `${number(quantity, 2)} ${unit}`).join(' · ');
}

type DashboardSources = {
  farmId: number;
  disease?: DiseaseLayer;
  analytics?: DashboardAnalytics;
  analyticsMap?: AnalyticsLayer;
  production?: ProductionRecord[];
};

export default function Dashboard() {
  const { mode, profile, data, tasks, date, navigate, role, farmId, notify } = useApp();
  const [eventOpen, setEventOpen] = useState(false);
  const [view, setView] = useState<'general' | 'operations'>();
  const general = (view ?? (role === 'ADMIN' ? 'operations' : 'general')) === 'general';
  const [sources, setSources] = useState<DashboardSources>();
  const [waterUsage, setWaterUsage] = useState<{ farmId: number; date: string; summary: WaterUsageSummary }>();
  const [mapTab, setMapTab] = useState<DashboardMapTab>(mode === 'demo' ? 'health' : 'satellite');

  useEffect(() => {
    if (mode !== 'live' || !farmId) return;
    let active = true;
    setSources({ farmId });
    function load<Key extends Exclude<keyof DashboardSources, 'farmId'>>(key: Key, request: Promise<DashboardSources[Key]>, label: string) {
      void request.then(value => {
        if (active) setSources(current => ({ ...current, farmId, [key]: value }));
      }).catch(failure => {
        if (active) notify(`No se pudo cargar ${label}: ${failure.message}`, true);
      });
    }
    load('disease', api.disease(farmId), 'la capa de observaciones');
    load('analytics', api.dashboardAnalytics(farmId), 'el resumen de alertas');
    load('analyticsMap', api.analyticsMap(farmId), 'las capas del mapa');
    load('production', api.productionRecords(farmId), 'los registros de cosecha');
    return () => { active = false; };
  }, [mode, farmId, notify]);

  useEffect(() => {
    if (mode !== 'live' || !farmId || general) return;
    let active = true;
    setWaterUsage(undefined);
    void api.waterUsageAnalytics(farmId, date, date).then(report => {
      if (active) setWaterUsage({ farmId, date, summary: report.summary });
    }).catch(failure => {
      if (active) notify(`No se pudo cargar el agua aplicada: ${failure.message}`, true);
    });
    return () => { active = false; };
  }, [mode, farmId, date, general, notify]);

  useEffect(() => { setMapTab(mode === 'demo' ? 'health' : 'satellite'); }, [mode, farmId]);

  const metrics = farmMetrics(data);
  const demo = mode === 'demo';
  const hasArea = data.fields.some(field => field.areaHa != null) || data.blocks.some(block => block.areaHa != null);
  const hasPlantEstimates = data.rows.some(row => row.plantsEstimated != null);
  const work = todayTasks(tasks.filter(task => (!demo || data.blocks.some(block => block.id === task.blockId)) && (role !== 'WORKER' || (demo ? task.assignee === profile.user.name : task.assigneeId === profile.user.id))), date);
  const pending = work.filter(task => !['completed', 'review'].includes(task.status));
  const currentSources = sources?.farmId === farmId ? sources : undefined;
  const alertCount = currentSources?.analytics?.openAlerts;
  const water = waterUsage?.farmId === farmId && waterUsage.date === date ? waterUsage.summary : undefined;
  const harvestToDate = currentSources?.production?.filter(record => productionRecordDate(record) <= date);
  const monthlyHarvest = harvestToDate?.filter(record => productionRecordDate(record).startsWith(date.slice(0, 7)));
  const monthlyQuantities = monthlyHarvest && productionQuantities(monthlyHarvest);
  const harvestByBlock = new Map<number, ProductionRecord[]>();
  for (const record of monthlyHarvest ?? []) {
    const blockId = record.blockId ?? record.block?.id ?? record.row?.block?.id ?? data.rows.find(row => row.id === record.rowId)?.block.id;
    if (blockId == null) continue;
    const blockRecords = harvestByBlock.get(blockId) ?? [];
    blockRecords.push(record);
    harvestByBlock.set(blockId, blockRecords);
  }
  const productionMap = new Map<number, BlockPresentation>();
  if (!demo && mapTab === 'production') {
    for (const block of data.blocks) {
      const detail = formatQuantities(productionQuantities(harvestByBlock.get(block.id) ?? []));
      productionMap.set(block.id, { color: detail ? '#579359' : '#a9b5ae', detail: detail || (monthlyHarvest ? 'Sin cosecha registrada en el mes' : 'Datos de cosecha no disponibles') });
    }
  }
  const visibleMapAnalytics = demo ? withInspectionHealth(demoAnalytics, readDemo(inspectionDemoKey, demoInspections())) : currentSources?.analyticsMap;
  const affectedBlocks = currentSources?.analyticsMap?.features?.filter(feature => feature.properties.healthStatus === 'ACTIVE_FINDINGS').length;
  const mapLayer: MapLayer = mapTab === 'disease' || mapTab === 'production' ? mapTab === 'disease' ? 'health' : 'satellite' : mapTab;
  const mapLegend = mapLayer === 'health' ? healthMapBands : mapLayer === 'moisture' ? moistureMapBands
    : mapTab === 'production' ? [{ label: 'Con registros de cosecha', color: '#579359' }, { label: 'Sin datos de cosecha', color: '#a9b5ae' }] : [];
  const today = new Date();
  const greeting = demo ? 'Buenos días' : today.getHours() < 12 ? 'Buenos días' : today.getHours() < 18 ? 'Buenas tardes' : 'Buenas noches';
  const firstName = profile.user.name.split(' ')[0];
  const stats = general ? [
    { icon: MapPin, color: 'green', label: 'Área total', value: hasArea ? `${number(metrics.area, 1)} ha` : '—', note: `${data.fields.length} campos` },
    { icon: Sprout, color: 'green', label: 'Plantas estimadas', value: hasPlantEstimates ? number(metrics.plants) : '—', note: `${data.rows.length} surcos` },
    { icon: HeartPulse, color: 'green', label: demo ? 'Salud del cultivo' : 'Observaciones sanitarias', value: demo ? '72%' : number(metrics.observations), note: demo ? 'Saludable' : 'Registros de la finca' },
    { icon: ChartNoAxesCombined, color: 'blue', label: demo ? 'Producción estimada' : 'Registros de cosecha', value: demo ? '38,5 t/ha' : harvestToDate ? number(harvestToDate.length) : '—', note: demo ? 'Promedio de la finca' : 'Hasta la fecha seleccionada' },
    { icon: TriangleAlert, color: 'red', label: demo ? 'Zonas en alerta' : 'Alertas abiertas', value: demo ? '18 ha' : alertCount == null ? '—' : number(alertCount), note: 'Requieren atención' },
  ] : [
    { icon: HeartPulse, color: 'green', label: demo ? 'Salud de la finca' : 'Observaciones sanitarias', value: demo ? '84%' : number(metrics.observations), note: demo ? '↑ 6% vs. semana anterior' : 'Observaciones históricas registradas' },
    { icon: ChartNoAxesCombined, color: 'green', label: 'Producción (mes)', value: demo ? '126,4 t' : (monthlyQuantities && formatQuantities(monthlyQuantities)) || '—', note: demo ? '↑ 12% vs. mes anterior' : monthlyHarvest ? `${number(monthlyHarvest.length)} registros de cosecha` : 'Datos de cosecha no disponibles' },
    { icon: Droplets, color: 'blue', label: demo ? 'Agua hoy' : 'Agua aplicada', value: demo ? '186 m³' : water ? `${number(water.actualVolumeM3, 2)} m³` : '—', note: demo ? '↓ 18% vs. ayer' : water ? `${number(water.measuredVolumeM3, 2)} m³ medidos · ${number(water.estimatedVolumeM3, 2)} m³ estimados` : 'Fecha seleccionada' },
    { icon: TriangleAlert, color: 'red', label: demo ? 'Alertas críticas' : 'Alertas abiertas', value: demo ? '7' : alertCount == null ? '—' : number(alertCount), note: demo ? '↓ 3 vs. semana anterior' : 'Requieren seguimiento' },
    { icon: CalendarCheck2, color: 'green', label: 'Trabajos pendientes', value: demo ? '12' : number(pending.length), note: demo ? 'de 24 programados' : 'Para el equipo de hoy' },
    { icon: Sprout, color: 'green', label: demo ? 'Área con problemas' : 'Bloques con hallazgos', value: demo ? '3,2 ha' : affectedBlocks == null ? '—' : number(affectedBlocks), note: demo ? '↓ 40% del total (121 ha)' : 'Según evaluaciones recientes' },
  ];

  return <div className={`dashboard-screen ${general ? 'dashboard-general' : ''}`}>
    <section className="dashboard-hero"><div className="dashboard-hero-copy"><h1>{greeting}, {firstName}<span className="greeting-dot">.</span></h1><p>Aquí está el estado de tu finca para la fecha seleccionada.</p></div><div className={`dashboard-hero-art${demo ? ' dashboard-hero-art-demo' : ''}`}><strong>{demo || hasArea ? <>{demo ? '121' : number(metrics.area, 1)} <small>hectáreas</small></> : <small>Área sin registrar</small>}</strong>{demo && <span>cultivando un mejor mañana</span>}</div></section>
    <div className="dashboard-view-options" role="group" aria-label="Vista del tablero">
      <button className="text-button" aria-pressed={general} onClick={() => setView('general')}>Vista general</button>
      <button className="text-button" aria-pressed={!general} onClick={() => setView('operations')}>Vista operativa</button>
    </div>
    <div className="dashboard-kpi-grid">{stats.map(stat => <article className="dashboard-kpi" key={stat.label}><span className={`dashboard-kpi-icon ${stat.color}`}><stat.icon size={21} strokeWidth={1.8} /></span><div><span>{stat.label}</span><strong>{stat.value}</strong><small className={stat.color === 'red' ? 'text-red' : ''}>{stat.note}</small></div></article>)}</div>
    <div className="dashboard-main-grid">
      <Panel title={general ? 'Mapa de la finca' : 'Situación de la finca hoy'} className="dashboard-map-card" action={<div className="dashboard-map-header-actions"><button className="dashboard-map-view-button" onClick={() => navigate('maps')}>Vista satelital <ChevronDown size={14} /></button><button className="dashboard-map-expand-button" aria-label="Abrir mapa completo" onClick={() => navigate('maps')}><Maximize2 size={16} /></button></div>}>
        <p className="dashboard-subtitle">Visualiza las principales variables y alertas en tu terreno.</p>
        <div className="dashboard-map-tabs">{[{ value: 'health', label: 'Salud general', icon: HeartPulse }, { value: 'moisture', label: 'Humedad', icon: Droplets }, { value: 'nutrients', label: 'Nutrientes', icon: FlaskConical }, { value: 'disease', label: 'Enfermedades', icon: Bug }, { value: 'production', label: 'Producción', icon: ChartNoAxesCombined }].map(({ value, label, icon: Icon }) => <button key={value} className={mapTab === value ? 'active' : ''} onClick={() => setMapTab(value as DashboardMapTab)}><Icon size={14} strokeWidth={1.8} />{label}</button>)}</div>
        <div className="dashboard-map-stage"><FarmMap farm={data.farms[0]} fields={data.fields} blocks={data.blocks} rows={data.rows} demo={demo} layer={mapLayer} disease={mapTab === 'disease' ? currentSources?.disease : undefined} analytics={visibleMapAnalytics} blockPresentation={productionMap.size ? productionMap : undefined} baseLayer="satellite" /></div>
        <div className="dashboard-map-legend">
          {demo ? <><span><i className="map-legend-dot optimal" />Condiciones óptimas</span><span><i className="map-legend-dot attention" />Requiere seguimiento</span><span><i className="map-legend-dot critical" />Atención prioritaria</span></> : mapLegend.map(band => <span key={band.label}><i className="map-legend-dot" style={{ background: band.color }} />{band.label}</span>)}
          <strong>{demo ? '121 ha en total' : hasArea ? `${number(metrics.area, 1)} ha en total` : 'Área sin registrar'}</strong>
        </div>
      </Panel>
      {general ? <div className="record-side-panels">
        {demo && <Panel title="Estado del cultivo"><div className="record-ring-summary">
          <Donut value="72%" label="Saludable" />
          <ul className="record-summary-list">{[['#65b55a', 'Saludable', '72%'], ['#f5cb47', 'Estrés leve', '18%'], ['#fa9648', 'En riesgo', '8%'], ['#ef615b', 'Con enfermedad', '2%']].map(([color, label, value]) => <li key={label}><i style={{ backgroundColor: color }} /><span>{label}</span><strong>{value}</strong></li>)}</ul>
        </div></Panel>}
        {demo && <Panel title="Clima actual"><div className="dashboard-weather-current"><CloudSun size={37} /><div><strong>24 °C</strong><p>Parcialmente nublado</p></div></div><div className="dashboard-weather-details"><span><Droplets size={17} />78% humedad</span><span><Wind size={17} />12 km/h</span></div></Panel>}
        <DashboardWork tasks={work} data={data} demo={false} navigate={navigate} />
      </div> : <DashboardAlerts demo={demo} openAlerts={alertCount} navigate={navigate} />}
    </div>
    {!general && <div className="dashboard-lower-grid"><DashboardWork tasks={demo ? pending : work} data={data} demo={demo} navigate={navigate} /><ProductionCard blocks={data.blocks} demo={demo} quantities={monthlyQuantities} harvestByBlock={harvestByBlock} navigate={navigate} />{demo ? <DemoCostsCard /> : role === 'ADMIN' && <CostsCard />}<AiCard demo={demo} navigate={navigate} /></div>}
    <div className="dashboard-history-grid"><Panel title="Actividad reciente" action={<LinkButton onClick={() => navigate('reports')}>Ver todo</LinkButton>}><EventList limit={3} /></Panel><Panel title={demo ? 'Evolución de la salud del cultivo' : 'Historial de la finca'} action={demo && <Badge tone="neutral">Últimos 6 meses · Ejemplo</Badge>}>{demo ? <LineChart /> : <div className="dashboard-empty-summary"><strong>{number(data.events.length)}</strong><span>actividades registradas</span><p>Los próximos registros construirán la historia de tu cultivo.</p></div>}</Panel>{general ? <AiCard demo={demo} navigate={navigate} /> : <Panel title="Centro agronómico" action={<LinkButton onClick={() => navigate('insights')}>Explorar</LinkButton>}><div className="dashboard-guidance"><span className="icon-tile green"><Leaf size={21} /></span><div><Badge tone="green">BUENAS PRÁCTICAS</Badge><h4>Observar es el primer paso.</h4><p>Un recorrido de inspección ayuda a identificar qué áreas necesitan revisión.</p><button className="text-button" onClick={() => navigate('disease')}>Registrar observación<ArrowUpRight size={14} /></button></div></div></Panel>}</div>
    {eventOpen && <EventForm onClose={() => setEventOpen(false)} />}
    <button className="dashboard-quick-action" onClick={() => setEventOpen(true)} disabled={!data.blocks.length}><Plus size={16} />Registrar actividad</button>
  </div>;
}

function DashboardWork({ tasks, data, demo, navigate }: { tasks: Task[]; data: FarmData; demo: boolean; navigate: (page: Page) => void }) {
  const completed = demo ? 18 : tasks.filter(task => task.status === 'completed').length;
  const inProgress = demo ? 4 : tasks.filter(task => task.status === 'progress').length;
  const toDo = demo ? 2 : tasks.filter(task => ['pending', 'review'].includes(task.status)).length;
  const blocked = demo ? 0 : tasks.filter(task => task.status === 'blocked').length;
  const total = completed + inProgress + toDo + blocked;
  return <Panel title={demo ? 'Trabajos de hoy' : 'Trabajos de la jornada'} className="dashboard-work" action={<LinkButton onClick={() => navigate('tasks')}>Ver todos</LinkButton>}><div className="dashboard-work-summary"><Donut value={number(total)} label="Tareas" segments={total ? [completed, inProgress, toDo, blocked] : [1]} colors={total ? ['#50a96c', '#3f8eea', '#f0bd48', '#ef6253'] : ['#e5eae6']} /><div className="dashboard-status-list"><div><i className="status-complete" /><span>Completadas</span><strong>{completed}</strong></div><div><i className="status-progress" /><span>En proceso</span><strong>{inProgress}</strong></div><div><i className="status-pending" /><span>Pendientes y por revisar</span><strong>{toDo}</strong></div><div><i className="status-overdue" /><span>Bloqueadas</span><strong>{blocked}</strong></div></div></div><div className="dashboard-task-table">{tasks.slice(0, demo ? 5 : 3).map(task => <button key={task.id} onClick={() => navigate('tasks')}><span className={`task-status-dot ${task.status}`} /><span><strong>{task.title}</strong><small>{data.blocks.find(block => block.id === task.blockId)?.code ?? 'Finca'} · {task.time}</small></span><Badge tone={task.status === 'blocked' ? 'red' : task.status === 'progress' ? 'blue' : 'neutral'}>{statusLabels[task.status]}</Badge></button>)}</div></Panel>;
}

function ProductionCard({ blocks, demo, quantities, harvestByBlock, navigate }: { blocks: Block[]; demo: boolean; quantities?: Map<string, number>; harvestByBlock: Map<number, ProductionRecord[]>; navigate: (page: Page) => void }) {
  if (!demo) {
    const blockTotals = blocks.flatMap(block => {
      const total = formatQuantities(productionQuantities(harvestByBlock.get(block.id) ?? []));
      return total ? [{ id: block.id, code: block.code, total }] : [];
    }).slice(0, 6);
    return <Panel title="Producción del mes" className="dashboard-production-card" action={<LinkButton onClick={() => navigate('harvest')}>Ver cosechas</LinkButton>}>
      {quantities?.size ? <>
        <div className="dashboard-mini-stat-grid">{[...quantities].map(([unit, quantity]) => <div className="dashboard-mini-stat" key={unit}><span className="dashboard-mini-stat-icon yellow"><Wheat size={18} strokeWidth={1.8} /></span><span><strong>{number(quantity, 2)} {unit}</strong><small>Total cosechado</small></span></div>)}</div>
        <dl className="detail-list">{blockTotals.map(block => <div key={block.id}><dt>{block.code}</dt><dd>{block.total}</dd></div>)}</dl>
      </> : <Empty title={quantities ? 'Sin cantidades registradas' : 'Datos de cosecha no disponibles'} description="Consulta los registros de la finca en el módulo de cosecha." />}
    </Panel>;
  }
  const values = [{ label: 'A1', value: 42.1 }, { label: 'A2', value: 38.5 }, { label: 'B1', value: 35.2 }, { label: 'B2', value: 28.4 }, { label: 'C1', value: 31.7 }, { label: 'D1', value: 27.8 }];
  const maximum = Math.max(...values.map(item => item.value), 1);
  const summary = [{ icon: Wheat, tone: 'yellow', value: '126,4 t', label: 'Producción total' }, { icon: ChartNoAxesCombined, tone: 'green', value: '32,8 t/ha', label: 'Promedio' }, { icon: Sprout, tone: 'green', value: '8.420', label: 'Racimos' }] as const;
  return <Panel title="Producción" className="dashboard-production-card"><div className="dashboard-mini-stat-grid">{summary.map(item => <div className="dashboard-mini-stat" key={item.label}><span className={`dashboard-mini-stat-icon ${item.tone}`}><item.icon size={18} strokeWidth={1.8} /></span><span><strong>{item.value}</strong><small>{item.label}</small></span></div>)}</div><div className="dashboard-bars">{values.map(item => <div className="dashboard-bar" key={item.label}><span>{item.label}</span><div><i style={{ height: `${item.value / maximum * 100}%` }} /></div><strong>{item.value}</strong></div>)}</div></Panel>;
}

function CostsCard() {
  const { farmId, date, navigate } = useApp();
  const month = date.slice(0, 7);
  const [result, setResult] = useState<{ month: string; data: FinanceMonth | null }>();

  useEffect(() => {
    let active = true;
    void financeApi.month(farmId, month).then(data => { if (active) setResult({ month, data }); })
      .catch(() => { if (active) setResult({ month, data: null }); });
    return () => { active = false; };
  }, [farmId, month]);

  const finance = result?.month === month ? result.data : undefined;
  return <Panel title="Costos del mes seleccionado" className="dashboard-costs-card" action={<LinkButton onClick={() => navigate('costs')}>Ver costos</LinkButton>}>
    {finance === undefined ? <p role="status">Consultando costos…</p>
      : finance === null ? <p className="form-error" role="alert">No se pudieron consultar los costos.</p>
        : finance.totals.expenses > 0 ? <>
          <div className="dashboard-cost-total"><span>Gastos registrados</span><strong>{formatCop(finance.totals.expenses)}</strong></div>
          <dl className="detail-list">{finance.expensesByCategory.map(item => <div key={item.category}><dt>{financeCategoryLabels[item.category]}</dt><dd>{formatCop(item.amount)}</dd></div>)}</dl>
        </> : <p className="muted">Sin gastos registrados en el mes.</p>}
  </Panel>;
}

function DemoCostsCard() {
  const rows = [['Fertilizantes', '34%', '$ 6,3 M'], ['Fitosanitarios', '18%', '$ 3,3 M'], ['Riego (energía + agua)', '12%', '$ 2,2 M'], ['Mano de obra', '26%', '$ 4,8 M'], ['Otros', '10%', '$ 1,8 M']];
  return <Panel title="Costos (este mes)" className="dashboard-costs-card"><div className="dashboard-cost-total"><span>Total estimado</span><strong>$ 18,4 M COP</strong><small>↑ 5% vs. mes anterior</small></div><div className="dashboard-cost-list">{rows.map(([label, percentage, value], index) => <div key={label}><i className={`dashboard-cost-dot cost-${index}`} /><span>{label}</span><em>{percentage}</em><strong>{value}</strong></div>)}</div></Panel>;
}

function AiCard({ demo, navigate }: { demo: boolean; navigate: (page: Page) => void }) {
  if (!demo) return <Panel title="Análisis de la finca" className="dashboard-ai-card" action={<LinkButton onClick={() => navigate('insights')}>Explorar</LinkButton>}><Empty title="Sin análisis automático disponible" description="Consulta el centro agronómico para revisar los indicadores registrados." /></Panel>;
  const recommendations = [['1', 'Riesgo emergente en B2', 'Condiciones de humedad favorecen la propagación. Se recomienda aplicar tratamiento en los próximos 3 días.'], ['2', 'Déficit hídrico en D1', 'Se estiman 32 m³ necesarios. Programar riego entre 05:00 – 06:00.'], ['3', 'Producción inferior en A3', '11% por debajo de bloques comparables. Coincide con niveles bajos de potasio.']];
  return <Panel title="AgroVision IA" className="dashboard-ai-card"><div className="dashboard-ai-intro"><span className="ai-spark">IA</span><div><strong>Resumen de hoy</strong><p>Hemos analizado los datos de tu finca y detectamos 3 acciones prioritarias.</p></div></div><div className="dashboard-ai-list">{recommendations.map(([label, title, text]) => <button key={title} onClick={() => navigate('insights')}><span className="ai-priority">{label}</span><span><strong>{title}</strong><small>{text}</small></span><ArrowUpRight size={14} /></button>)}</div><button className="button dashboard-ai-button" onClick={() => navigate('insights')}>Ver análisis completo<ArrowRight size={15} /></button></Panel>;
}

function DashboardAlerts({ demo, openAlerts, navigate }: { demo: boolean; openAlerts?: number; navigate: (page: Page) => void }) {
  if (!demo && openAlerts == null) return <Panel title="Alertas que necesitan tu atención" className="dashboard-attention"><Empty title="Resumen de alertas no disponible" description="Consulta el estado de las alertas en el módulo de reportes." /></Panel>;
  type DashboardAlert = { icon: typeof Droplets; tone: 'red' | 'orange' | 'gold' | 'green'; title: string; location: string; detail: string; severity: string; action: string; target: Page; secondary?: string; secondaryTarget?: Page };
  const alerts: DashboardAlert[] = demo ? [
    { icon: Bug, tone: 'red', title: 'Sigatoka en aumento', location: 'Bloque B2', detail: '14 → 37 plantas afectadas en 7 días.', severity: 'Crítico', action: 'Ver brote', target: 'disease', secondary: 'Crear tratamiento', secondaryTarget: 'disease' },
    { icon: Droplets, tone: 'orange', title: 'Humedad del suelo baja', location: 'Bloque D1', detail: '6 ha con humedad < 15%.', severity: 'Alta', action: 'Ver zona', target: 'maps', secondary: 'Programar riego', secondaryTarget: 'irrigation' },
    { icon: FlaskConical, tone: 'gold', title: 'Bajo potasio (K)', location: 'Bloque A3', detail: 'Niveles por debajo del rango óptimo.', severity: 'Media', action: 'Ver análisis', target: 'maps', secondary: 'Crear fertilización', secondaryTarget: 'fertilization' },
    { icon: CalendarCheck2, tone: 'orange', title: 'Fumigación pendiente', location: 'Bloque C1', detail: 'Debía completarse ayer. Responsable: Carlos M.', severity: 'Alta', action: 'Ver trabajo', target: 'tasks' },
  ] : [{ icon: TriangleAlert, tone: openAlerts ? 'red' : 'green', title: openAlerts ? 'Alertas abiertas' : 'Sin alertas abiertas', location: 'Registros de tu finca', detail: openAlerts ? `${openAlerts} alertas requieren revisión del equipo.` : 'No hay alertas activas reportadas por los sensores.', severity: openAlerts ? 'Atención' : 'Todo en orden', action: 'Ver reportes', target: 'reports' }];
  return <Panel title="Alertas que necesitan tu atención" className="dashboard-attention" action={<button className="text-button" onClick={() => navigate('reports')}>Ver todas <ArrowRight size={14} /></button>}><div className="dashboard-alert-list">{alerts.map(item => <article className="dashboard-alert" key={item.title}><span className={`dashboard-alert-icon ${item.tone}`}><item.icon size={19} strokeWidth={1.8} /></span><div className="dashboard-alert-copy"><div className="dashboard-alert-title"><strong>{item.title}</strong><Badge tone={item.tone === 'red' ? 'red' : item.tone === 'gold' ? 'gold' : item.tone === 'orange' ? 'orange' : 'green'}>{item.severity}</Badge></div><span>{item.location}</span><p>{item.detail}</p><div className="dashboard-alert-actions"><button className="button secondary small" onClick={() => navigate(item.target)}>{item.action}</button>{item.secondary && item.secondaryTarget && <button className="button secondary small" onClick={() => navigate(item.secondaryTarget!)}>{item.secondary}</button>}</div></div></article>)}</div></Panel>;
}
