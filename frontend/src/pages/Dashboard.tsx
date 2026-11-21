import { useEffect, useState } from 'react';
import { ArrowRight, ArrowUpRight, CalendarCheck2, ChartNoAxesCombined, ChevronDown, ChevronRight, Droplets, FlaskConical, HeartPulse, Leaf, Maximize2, Plus, Sprout, TriangleAlert, Wheat, Bug } from 'lucide-react';
import { useApp } from '../context';
import { api } from '../lib/api';
import { farmMetrics, number, eventLabels, statusLabels } from '../lib/domain';
import { blockHealth, demoAnalytics, demoDashboardAnalytics, readDemo } from '../lib/demo';
import { demoInspections, inspectionDemoKey, withInspectionHealth } from '../lib/inspections';
import { Badge, Donut, Empty, LineChart, LinkButton, Panel } from '../components/ui';
import FarmMap, { type MapLayer } from '../components/FarmMap';
import { EventForm } from '../components/Forms';
import type { AnalyticsLayer, DashboardAnalytics, DiseaseLayer, FieldEvent, Page, Task } from '../lib/types';

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

export default function Dashboard() {
  const { mode, profile, data, tasks, date, navigate, role, farmId, notify } = useApp();
  const [eventOpen, setEventOpen] = useState(false);
  const [disease, setDisease] = useState<DiseaseLayer>();
  const [analytics, setAnalytics] = useState<DashboardAnalytics>();
  const [analyticsMap, setAnalyticsMap] = useState<AnalyticsLayer>();
  const [mapTab, setMapTab] = useState<DashboardMapTab>(mode === 'demo' ? 'health' : 'satellite');

  useEffect(() => {
    setDisease(undefined); setAnalytics(undefined); setAnalyticsMap(undefined);
    if (mode !== 'live' || !farmId) return;
    let active = true;
    Promise.all([api.disease(farmId), api.dashboardAnalytics(farmId), api.analyticsMap(farmId)]).then(([diseaseResult, analyticsResult, mapResult]) => { if (active) { setDisease(diseaseResult); setAnalytics(analyticsResult); setAnalyticsMap(mapResult); } })
      .catch(failure => { if (active) notify(`No se pudo cargar la capa de observaciones: ${failure.message}`, true); });
    return () => { active = false; };
  }, [mode, farmId, notify]);

  useEffect(() => { setMapTab(mode === 'demo' ? 'health' : 'satellite'); }, [mode, farmId]);

  const metrics = farmMetrics(data);
  const pending = tasks.filter(task => (mode === 'live' || data.blocks.some(block => block.id === task.blockId)) && task.date <= date && !['completed', 'review'].includes(task.status) && (role !== 'WORKER' || (mode === 'live' ? task.assigneeId === profile.user.id : task.assignee === profile.user.name)));
  const demo = mode === 'demo';
  const visibleAnalytics = demo ? demoDashboardAnalytics : analytics;
  const visibleMapAnalytics = demo ? withInspectionHealth(demoAnalytics, readDemo(inspectionDemoKey, demoInspections())) : analyticsMap;
  const mapLayer: MapLayer = mapTab === 'disease' || mapTab === 'production' ? mapTab === 'disease' ? 'health' : 'satellite' : mapTab;
  const today = new Date();
  const greeting = demo ? 'Buenos días' : today.getHours() < 12 ? 'Buenos días' : today.getHours() < 18 ? 'Buenas tardes' : 'Buenas noches';
  const firstName = profile.user.name.split(' ')[0];
  const stats = [
    { icon: HeartPulse, color: 'green', label: 'Salud de la finca', value: demo ? '84%' : number(metrics.observations), note: demo ? '↑ 6% vs. semana anterior' : 'Observaciones registradas' },
    { icon: ChartNoAxesCombined, color: 'green', label: 'Producción (mes)', value: demo ? '126,4 t' : number(metrics.events), note: demo ? '↑ 12% vs. mes anterior' : 'Registros de producción' },
    { icon: Droplets, color: 'blue', label: 'Agua hoy', value: demo ? '186 m³' : '—', note: demo ? '↓ 18% vs. ayer' : 'Consulta el módulo de riego' },
    { icon: TriangleAlert, color: 'red', label: 'Alertas críticas', value: demo ? '7' : number(visibleAnalytics?.openAlerts ?? 0), note: demo ? '↓ 3 vs. semana anterior' : 'Requieren seguimiento' },
    { icon: CalendarCheck2, color: 'green', label: 'Trabajos pendientes', value: demo ? '12' : number(pending.length), note: demo ? 'de 24 programados' : 'Para el equipo de hoy' },
    { icon: Sprout, color: 'green', label: 'Área con problemas', value: demo ? '3,2 ha' : `${number(metrics.area, 1)} ha`, note: demo ? '↓ 40% del total (121 ha)' : `${data.fields.length} campos · ${data.blocks.length} bloques` },
  ];

  return <div className="dashboard-screen">
    <section className="dashboard-hero"><div className="dashboard-hero-copy"><h1>{greeting}, {firstName}<span className="greeting-dot">.</span></h1><p>Aquí tienes el estado actual de tu finca. Todo en tiempo real para tomar mejores decisiones.</p></div><div className="dashboard-hero-art"><strong>{demo ? '121' : number(metrics.area, 0)} <small>hectáreas</small></strong><span>cultivando un mejor mañana</span></div></section>
    <div className="dashboard-kpi-grid">{stats.map(stat => <article className="dashboard-kpi" key={stat.label}><span className={`dashboard-kpi-icon ${stat.color}`}><stat.icon size={21} strokeWidth={1.8} /></span><div><span>{stat.label}</span><strong>{stat.value}</strong><small className={stat.color === 'red' ? 'text-red' : ''}>{stat.note}</small></div></article>)}</div>
    <div className="dashboard-main-grid">
      <Panel title="Situación de la finca hoy" className="dashboard-map-card" action={<div className="dashboard-map-header-actions"><button className="dashboard-map-view-button" onClick={() => navigate('maps')}>Vista satelital <ChevronDown size={14} /></button><button className="dashboard-map-expand-button" aria-label="Abrir mapa completo" onClick={() => navigate('maps')}><Maximize2 size={16} /></button></div>}><p className="dashboard-subtitle">Visualiza las principales variables y alertas en tu terreno.</p><div className="dashboard-map-tabs">{[{ value: 'health', label: 'Salud general', icon: HeartPulse }, { value: 'moisture', label: 'Humedad', icon: Droplets }, { value: 'nutrients', label: 'Nutrientes', icon: FlaskConical }, { value: 'disease', label: 'Enfermedades', icon: Bug }, { value: 'production', label: 'Producción', icon: ChartNoAxesCombined }].map(({ value, label, icon: Icon }) => <button key={value} className={mapTab === value ? 'active' : ''} onClick={() => setMapTab(value as DashboardMapTab)}><Icon size={14} strokeWidth={1.8} />{label}</button>)}</div><div className="dashboard-map-stage"><FarmMap farm={data.farms[0]} fields={data.fields} blocks={data.blocks} rows={data.rows} demo={demo} layer={mapLayer} disease={disease} analytics={visibleMapAnalytics} baseLayer="satellite" /></div><div className="dashboard-map-legend"><span><i className="map-legend-dot optimal" />Condiciones óptimas</span><span><i className="map-legend-dot attention" />Requiere seguimiento</span><span><i className="map-legend-dot critical" />Atención prioritaria</span><strong>{demo ? '121 ha' : `${number(metrics.area, 1)} ha`} en total</strong></div></Panel>
      <DashboardAlerts demo={demo} openAlerts={visibleAnalytics?.openAlerts ?? 0} navigate={navigate} />
    </div>
    <div className="dashboard-lower-grid"><DashboardWork tasks={pending} data={data} demo={demo} navigate={navigate} /><ProductionCard data={data} demo={demo} /><CostsCard demo={demo} /><AiCard demo={demo} navigate={navigate} /></div>
    <div className="dashboard-history-grid"><Panel title="Actividad reciente" action={<LinkButton onClick={() => navigate('reports')}>Ver todo</LinkButton>}><EventList limit={3} /></Panel><Panel title={demo ? 'Evolución de la salud del cultivo' : 'Historial de la finca'} action={demo && <Badge tone="neutral">Últimos 6 meses · Ejemplo</Badge>}>{demo ? <LineChart /> : <div className="dashboard-empty-summary"><strong>{number(data.events.length)}</strong><span>actividades registradas</span><p>Los próximos registros construirán la historia de tu cultivo.</p></div>}</Panel><Panel title="Centro agronómico" action={<LinkButton onClick={() => navigate('insights')}>Explorar</LinkButton>}><div className="dashboard-guidance"><span className="icon-tile green"><Leaf size={21} /></span><div><Badge tone="green">BUENAS PRÁCTICAS</Badge><h4>Observar es el primer paso.</h4><p>Un recorrido de inspección ayuda a identificar qué áreas necesitan revisión.</p><button className="text-button" onClick={() => navigate('disease')}>Registrar observación<ArrowUpRight size={14} /></button></div></div></Panel></div>
    {eventOpen && <EventForm onClose={() => setEventOpen(false)} />}
    <button className="dashboard-quick-action" onClick={() => setEventOpen(true)} disabled={!data.blocks.length}><Plus size={16} />Registrar actividad</button>
  </div>;
}

function DashboardWork({ tasks, data, demo, navigate }: { tasks: Task[]; data: { blocks: { id: number; code: string; field: { name: string } }[] }; demo: boolean; navigate: (page: Page) => void }) {
  const completed = demo ? 18 : tasks.filter(task => task.status === 'completed').length;
  const inProgress = demo ? 4 : tasks.filter(task => task.status === 'progress').length;
  const toDo = demo ? 2 : tasks.filter(task => ['pending', 'review'].includes(task.status)).length;
  const overdue = demo ? 0 : tasks.filter(task => task.status === 'blocked').length;
  return <Panel title="Trabajos de hoy" className="dashboard-work" action={<LinkButton onClick={() => navigate('tasks')}>Ver todos</LinkButton>}><div className="dashboard-work-summary"><Donut value={demo ? '24' : `${completed + inProgress + toDo + overdue}`} label="Tareas" segments={[completed || 1, inProgress || 1, toDo || 1, overdue || 1]} colors={['#50a96c', '#3f8eea', '#f0bd48', '#ef6253']} /><div className="dashboard-status-list"><div><i className="status-complete" /><span>Completadas</span><strong>{completed}</strong></div><div><i className="status-progress" /><span>En proceso</span><strong>{inProgress}</strong></div><div><i className="status-pending" /><span>Pendientes</span><strong>{toDo}</strong></div><div><i className="status-overdue" /><span>Atrasadas</span><strong>{overdue}</strong></div></div></div><div className="dashboard-task-table">{tasks.slice(0, demo ? 5 : 3).map(task => <button key={task.id} onClick={() => navigate('tasks')}><span className={`task-status-dot ${task.status}`} /><span><strong>{task.title}</strong><small>{data.blocks.find(block => block.id === task.blockId)?.code ?? 'Finca'} · {task.time}</small></span><Badge tone={task.status === 'blocked' ? 'red' : task.status === 'progress' ? 'blue' : 'neutral'}>{statusLabels[task.status]}</Badge></button>)}</div></Panel>;
}

function ProductionCard({ data, demo }: { data: { blocks: { code: string; areaHa?: number }[] }; demo: boolean }) {
  const values = demo ? [{ label: 'A1', value: 42.1 }, { label: 'A2', value: 38.5 }, { label: 'B1', value: 35.2 }, { label: 'B2', value: 28.4 }, { label: 'C1', value: 31.7 }, { label: 'D1', value: 27.8 }] : data.blocks.slice(0, 6).map((block, index) => ({ label: block.code, value: block.areaHa ?? index + 1 }));
  const maximum = Math.max(...values.map(item => item.value), 1);
  const summary = [{ icon: Wheat, tone: 'yellow', value: demo ? '126,4 t' : '—', label: 'Producción total' }, { icon: ChartNoAxesCombined, tone: 'green', value: demo ? '32,8 t/ha' : '—', label: 'Promedio' }, { icon: Sprout, tone: 'green', value: demo ? '8.420' : number(data.blocks.length), label: 'Racimos' }] as const;
  return <Panel title="Producción" className="dashboard-production-card"><div className="dashboard-mini-stat-grid">{summary.map(item => <div className="dashboard-mini-stat" key={item.label}><span className={`dashboard-mini-stat-icon ${item.tone}`}><item.icon size={18} strokeWidth={1.8} /></span><span><strong>{item.value}</strong><small>{item.label}</small></span></div>)}</div><div className="dashboard-bars">{values.map(item => <div className="dashboard-bar" key={item.label}><span>{item.label}</span><div><i style={{ height: `${item.value / maximum * 100}%` }} /></div><strong>{demo ? `${item.value}` : `${item.value} ha`}</strong></div>)}</div></Panel>;
}

function CostsCard({ demo }: { demo: boolean }) {
  const rows = demo ? [['Fertilizantes', '34%', '$ 6,3 M'], ['Fitosanitarios', '18%', '$ 3,3 M'], ['Riego (energía + agua)', '12%', '$ 2,2 M'], ['Mano de obra', '26%', '$ 4,8 M'], ['Otros', '10%', '$ 1,8 M']] : [['Sin resumen', '—', '—']];
  return <Panel title="Costos (este mes)" className="dashboard-costs-card"><div className="dashboard-cost-total"><span>Total estimado</span><strong>{demo ? '$ 18,4 M COP' : '—'}</strong><small>{demo ? '↑ 5% vs. mes anterior' : 'Agrega registros para calcularlo'}</small></div><div className="dashboard-cost-list">{rows.map(([label, percentage, value], index) => <div key={label}><i className={`dashboard-cost-dot cost-${index}`} /><span>{label}</span><em>{percentage}</em><strong>{value}</strong></div>)}</div></Panel>;
}

function AiCard({ demo, navigate }: { demo: boolean; navigate: (page: Page) => void }) {
  const recommendations = demo ? [['1', 'Riesgo emergente en B2', 'Condiciones de humedad favorecen la propagación. Se recomienda aplicar tratamiento en los próximos 3 días.'], ['2', 'Déficit hídrico en D1', 'Se estiman 32 m³ necesarios. Programar riego entre 05:00 – 06:00.'], ['3', 'Producción inferior en A3', '11% por debajo de bloques comparables. Coincide con niveles bajos de potasio.']] : [['1', 'Siguiente paso', 'Registra datos de tu finca para recibir recomendaciones.']];
  return <Panel title="AgroVision IA" className="dashboard-ai-card"><div className="dashboard-ai-intro"><span className="ai-spark">IA</span><div><strong>Resumen de hoy</strong><p>Hemos analizado los datos de tu finca y detectamos 3 acciones prioritarias.</p></div></div><div className="dashboard-ai-list">{recommendations.map(([label, title, text]) => <button key={title} onClick={() => navigate('insights')}><span className="ai-priority">{label}</span><span><strong>{title}</strong><small>{text}</small></span><ArrowUpRight size={14} /></button>)}</div><button className="button dashboard-ai-button" onClick={() => navigate('insights')}>Ver análisis completo<ArrowRight size={15} /></button></Panel>;
}

function DashboardAlerts({ demo, openAlerts, navigate }: { demo: boolean; openAlerts: number; navigate: (page: Page) => void }) {
  type DashboardAlert = { icon: typeof Droplets; tone: 'red' | 'orange' | 'gold' | 'green'; title: string; location: string; detail: string; severity: string; action: string; target: Page; secondary?: string; secondaryTarget?: Page };
  const alerts: DashboardAlert[] = demo ? [
    { icon: Bug, tone: 'red', title: 'Sigatoka en aumento', location: 'Bloque B2', detail: '14 → 37 plantas afectadas en 7 días.', severity: 'Crítico', action: 'Ver brote', target: 'disease', secondary: 'Crear tratamiento', secondaryTarget: 'disease' },
    { icon: Droplets, tone: 'orange', title: 'Humedad del suelo baja', location: 'Bloque D1', detail: '6 ha con humedad < 15%.', severity: 'Alta', action: 'Ver zona', target: 'maps', secondary: 'Programar riego', secondaryTarget: 'irrigation' },
    { icon: FlaskConical, tone: 'gold', title: 'Bajo potasio (K)', location: 'Bloque A3', detail: 'Niveles por debajo del rango óptimo.', severity: 'Media', action: 'Ver análisis', target: 'maps', secondary: 'Crear fertilización', secondaryTarget: 'fertilization' },
    { icon: CalendarCheck2, tone: 'orange', title: 'Fumigación pendiente', location: 'Bloque C1', detail: 'Debía completarse ayer. Responsable: Carlos M.', severity: 'Alta', action: 'Ver trabajo', target: 'tasks' },
  ] : [{ icon: TriangleAlert, tone: openAlerts ? 'red' : 'green', title: openAlerts ? 'Alertas abiertas' : 'Sin alertas abiertas', location: 'Registros de tu finca', detail: openAlerts ? `${openAlerts} alertas requieren revisión del equipo.` : 'No hay alertas activas reportadas por los sensores.', severity: openAlerts ? 'Atención' : 'Todo en orden', action: 'Ver reportes', target: 'reports' }];
  return <Panel title="Alertas que necesitan tu atención" className="dashboard-attention" action={<button className="text-button" onClick={() => navigate('reports')}>Ver todas <ArrowRight size={14} /></button>}><div className="dashboard-alert-list">{alerts.map(item => <article className="dashboard-alert" key={item.title}><span className={`dashboard-alert-icon ${item.tone}`}><item.icon size={19} strokeWidth={1.8} /></span><div className="dashboard-alert-copy"><div className="dashboard-alert-title"><strong>{item.title}</strong><Badge tone={item.tone === 'red' ? 'red' : item.tone === 'gold' ? 'gold' : item.tone === 'orange' ? 'orange' : 'green'}>{item.severity}</Badge></div><span>{item.location}</span><p>{item.detail}</p><div className="dashboard-alert-actions"><button className="button secondary small" onClick={() => navigate(item.target)}>{item.action}</button>{item.secondary && item.secondaryTarget && <button className="button secondary small" onClick={() => navigate(item.secondaryTarget!)}>{item.secondary}</button>}</div></div></article>)}</div></Panel>;
}
