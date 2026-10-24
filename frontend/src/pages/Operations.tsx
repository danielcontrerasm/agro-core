import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { Plus, Download, Droplets, Sprout, Bug, Wheat, ClipboardList, ArrowUpRight, CalendarDays, MapPin, Trash2, Image, ExternalLink, Check, FileText, Leaf, FlaskConical, Sparkles, ArrowRight, Search, Eye } from 'lucide-react';
import { useApp } from '../context';
import { api } from '../lib/api';
import { csvCell, eventLabels, number, statusLabels } from '../lib/domain';
import { readDemo, saveDemo } from '../lib/demo';
import type { FieldEvent, Page } from '../lib/types';
import { Badge, Empty, Modal, Notice, Panel } from '../components/ui';
import { EventForm } from '../components/Forms';
import { EventIcon } from './Dashboard';
import Inspections from './Inspections';
import PhotoGallery from '../components/PhotoGallery';
import Fertilization from './Fertilization';
import Irrigation from './Irrigation';
import PreventiveMeasures from './PreventiveMeasures';

const modules = {
  irrigation: { title: 'Riego', subtitle: 'El agua correcta, en el lugar correcto.', eyebrow: 'CUIDA CADA GOTA', type: 'IRRIGATION_EVENT', icon: Droplets, color: 'blue', activity: 'irrigation' },
  fertilization: { title: 'Fertilización', subtitle: 'Nutrir el suelo es invertir en lo que viene.', eyebrow: 'LA BASE DE UN CULTIVO FUERTE', type: 'FERTILIZER_APPLICATION', icon: Sprout, color: 'green', activity: 'fertilization' },
  disease: { title: 'Plagas y enfermedades', subtitle: 'Observa a tiempo. Acompaña cada cambio de tu cultivo.', eyebrow: 'LA PREVENCIÓN EMPIEZA EN EL CAMPO', type: 'SCOUTING_OBSERVATION', icon: Bug, color: 'orange', activity: 'scouting' },
  harvest: { title: 'Cosecha', subtitle: 'El resultado del cuidado de cada día.', eyebrow: 'EL FRUTO DE TU TRABAJO', type: 'HARVEST_EVENT', icon: Wheat, color: 'gold', activity: 'harvest' },
};

export default function Operations({ page }: { page: Page }) {
  return page === 'disease' ? <HealthWorkspace /> : page === 'fertilization' ? <FertilizationWorkspace /> : page === 'irrigation' ? <IrrigationWorkspace /> : <OperationsHistory page={page} />;
}

function IrrigationWorkspace() {
  const [legacy, setLegacy] = useState(false);
  return <><div className="tabs toolbar" aria-label="Secciones de riego"><button className={!legacy ? 'active' : ''} onClick={() => setLegacy(false)}>Proceso de riego</button><button className={legacy ? 'active' : ''} onClick={() => setLegacy(true)}>Historial anterior</button></div>{legacy ? <OperationsHistory page="irrigation" /> : <Irrigation />}</>;
}

function FertilizationWorkspace() {
  const [legacy, setLegacy] = useState(false);
  return <><div className="tabs toolbar" aria-label="Secciones de fertilización"><button className={!legacy ? 'active' : ''} onClick={() => setLegacy(false)}>Proceso de fertilización</button><button className={legacy ? 'active' : ''} onClick={() => setLegacy(true)}>Historial anterior</button></div>{legacy ? <OperationsHistory page="fertilization" /> : <Fertilization />}</>;
}

function HealthWorkspace() {
  const [tab, setTab] = useState('inspections');
  return <><div className="tabs toolbar" aria-label="Secciones fitosanitarias"><button className={tab === 'inspections' ? 'active' : ''} onClick={() => setTab('inspections')}>Inspecciones</button><button className={tab === 'prevention' ? 'active' : ''} onClick={() => setTab('prevention')}>Prevención</button><button className={tab === 'history' ? 'active' : ''} onClick={() => setTab('history')}>Historial anterior y tratamientos</button></div>{tab === 'inspections' ? <Inspections /> : tab === 'prevention' ? <PreventiveMeasures /> : <OperationsHistory page="disease" />}</>;
}

function OperationsHistory({ page }: { page: Page }) {
  const { data, mode, role, search, tasks, navigate, notify } = useApp();
  const [form, setForm] = useState(false);
  const [selected, setSelected] = useState<FieldEvent | null>(null);
  const [type, setType] = useState('all');
  const [block, setBlock] = useState('all');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [tab, setTab] = useState('history');
  const module = modules[page as keyof typeof modules];
  const filtered = data.events.filter(event => (!module || (page === 'disease' ? ['SCOUTING_OBSERVATION', 'TREATMENT_APPLICATION'].includes(event.eventType) : event.eventType === module.type)) &&
    (type === 'all' || event.eventType === type) && (block === 'all' || (event.block?.id ?? event.row?.block.id) === Number(block)) &&
    (!from || event.occurredAt >= new Date(`${from}T00:00:00`).toISOString()) && (!to || event.occurredAt <= new Date(`${to}T23:59:59.999`).toISOString()) &&
    `${eventLabels[event.eventType]} ${event.notes ?? ''} ${event.block?.code ?? event.row?.block.code ?? ''}`.toLocaleLowerCase('es').includes(search.toLocaleLowerCase('es')))
    .sort((first, second) => second.occurredAt.localeCompare(first.occurredAt));

  function exportCsv() {
    const records = [['Actividad', 'Fecha', 'Bloque', 'Surco', 'Autor ID', 'Notas'], ...filtered.map(event => [eventLabels[event.eventType], new Date(event.occurredAt).toLocaleString('es-CO'), event.block?.code ?? event.row?.block.code, event.row?.rowCode, event.createdByUserId, event.notes])];
    const content = '\uFEFF' + records.map(record => record.map(csvCell).join(',')).join('\r\n');
    const url = URL.createObjectURL(new Blob([content], { type: 'text/csv;charset=utf-8;' }));
    const anchor = document.createElement('a'); anchor.href = url; anchor.download = `agrovision-${mode === 'demo' ? 'demo-' : ''}${page}.csv`; document.body.appendChild(anchor); anchor.click(); anchor.remove(); window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    notify(`Exportados ${filtered.length} registros${mode === 'demo' ? ' de demostración' : ''}.`);
  }


  if (page === 'insights') return <><div className="page-heading"><div><span className="eyebrow">CONOCIMIENTO QUE HACE CRECER</span><h1>Centro agronómico</h1><p>Tu información, organizada para conversar mejor con tu equipo agronómico.</p></div><Badge tone="green"><Leaf size={13} />En crecimiento</Badge></div><div className="agronomic-hero"><div><span className="eyebrow">OBSERVAR · REGISTRAR · APRENDER</span><h2>Las buenas decisiones<br />empiezan con buenos datos.</h2><p>Reúne la historia de tu cultivo y compártela con quien te acompaña en el campo.</p><button className="button" onClick={() => navigate('reports')}>Explorar mis registros<ArrowRight size={17} /></button></div><Sprout size={160} strokeWidth={.8} /></div><Notice>Este centro no tiene un servicio de inteligencia artificial conectado. El contenido es orientación de uso de la aplicación; las dosis, tratamientos y decisiones deben ser aprobados por el profesional responsable.</Notice><div className="insights-grid">{[
    { icon: Bug, title: 'Dale contexto a tus observaciones', text: 'Registra el bloque, el momento y los síntomas. Un historial claro facilita la revisión del equipo.', target: 'disease' as Page, label: 'Ver observaciones', color: 'orange' },
    { icon: Droplets, title: 'Construye el historial de riego', text: 'Documenta cada jornada y sus novedades. Los sensores y la programación automática llegarán en una siguiente fase.', target: 'irrigation' as Page, label: 'Ver registros de riego', color: 'blue' },
    { icon: Sprout, title: 'Mantén la trazabilidad de tus labores', text: 'Registra las aplicaciones realizadas según el plan aprobado. Aún no hay cálculo automático de dosis.', target: 'fertilization' as Page, label: 'Ver fertilización', color: 'green' },
    { icon: Wheat, title: 'Acompaña el cierre del ciclo', text: 'Conserva el registro de las jornadas de cosecha. La captura estructurada de rendimiento está pendiente.', target: 'harvest' as Page, label: 'Ver cosechas', color: 'gold' },
  ].filter(item => `${item.title} ${item.text}`.toLocaleLowerCase('es').includes(search.toLocaleLowerCase('es'))).map(item => <Panel key={item.title}><span className={`stat-icon ${item.color}`}><item.icon size={26} /></span><h3 className="insight-title">{item.title}</h3><p className="insight-description">{item.text}</p><button className="text-button" onClick={() => navigate(item.target)}>{item.label}<ArrowUpRight size={15} /></button></Panel>)}</div><Panel title="Lo que estamos preparando"><div className="roadmap-row">{['Planes agronómicos aprobados', 'Ciclos y épocas de siembra', 'Seguimiento de muestras de suelo', 'Alertas y recomendaciones revisables'].map((label, index) => <div key={label}><span>0{index + 1}</span><strong>{label}</strong><Badge tone="neutral">Próximamente</Badge></div>)}</div></Panel></>;

  return <>
    <div className="page-heading"><div><span className="eyebrow">{module?.eyebrow ?? 'LA HISTORIA DE TU FINCA'}</span><h1>{module?.title ?? 'Reportes y actividad'}</h1><p>{module?.subtitle ?? 'Todo lo que sucede en tu campo, en un solo lugar.'}</p></div><div className="heading-buttons"><button className="button secondary" onClick={exportCsv} disabled={!filtered.length}><Download size={16} />Exportar CSV</button><button className="button" disabled={!data.blocks.length} onClick={() => setForm(true)}><Plus size={17} />{page === 'disease' ? 'Nueva observación' : 'Registrar actividad'}</button></div></div>
    {module && <div className={`operation-banner operation-${page}`}><span className={`stat-icon ${module.color}`}><module.icon size={31} /></span><div><span>HISTORIAL DE {module.title.toLocaleUpperCase('es')}</span><strong>{filtered.length} {filtered.length === 1 ? 'actividad registrada' : 'actividades registradas'}</strong><p>Conoce lo que se ha hecho y conserva cada detalle.</p></div><button className="button secondary small" onClick={() => navigate('maps')}>Explorar mapas<ArrowUpRight size={15} /></button></div>}
    <div className="toolbar"><div className="tabs"><button className={tab === 'history' ? 'active' : ''} onClick={() => setTab('history')}><ClipboardList size={16} />Historial<span>{filtered.length}</span></button>{module && <button className={tab === 'plans' ? 'active' : ''} onClick={() => setTab('plans')}><CalendarDays size={16} />Trabajo programado{mode === 'demo' && <Badge tone="neutral">Demo</Badge>}</button>}</div></div>
    {tab === 'plans' && module ? mode === 'demo' ? <><Notice>Planificación de demostración local. Los planes agronómicos y las tareas aún no están disponibles en el backend.</Notice><div className="planned-work">{tasks.filter(task => task.activity === module.activity && data.blocks.some(item => item.id === task.blockId)).map(task => <Panel key={task.id}><div className="planned-work-top"><span className={`icon-tile ${module.color}`}><module.icon size={22} /></span><Badge tone={task.status === 'blocked' ? 'red' : 'neutral'}>{statusLabels[task.status]}</Badge></div><h3>{task.title}</h3><p>{task.assignee} · {data.blocks.find(item => item.id === task.blockId)?.code}</p><span className="detail-date"><CalendarDays size={14} />{task.date} · {task.time}</span><button className="text-button" onClick={() => navigate('tasks')}>Abrir trabajo del día<ArrowRight size={15} /></button></Panel>)}</div></> : <Panel><Empty title="El siguiente paso: planificar" description="Los planes y las tareas por trabajador se integrarán en la siguiente etapa. Mientras tanto, puedes registrar lo que ya se realizó." /></Panel> : <>
    <div className="record-filters">{!module && <label>Actividad<select value={type} onChange={event => setType(event.target.value)}><option value="all">Todas las actividades</option>{Object.entries(eventLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>}<label>Bloque<select value={block} onChange={event => setBlock(event.target.value)}><option value="all">Todos los bloques</option>{data.blocks.map(item => <option key={item.id} value={item.id}>{item.code}</option>)}</select></label><label>Desde<input type="date" value={from} onChange={event => setFrom(event.target.value)} max={to || undefined} /></label><label>Hasta<input type="date" value={to} onChange={event => setTo(event.target.value)} min={from || undefined} /></label>{(type !== 'all' || block !== 'all' || from || to) && <button className="text-button" onClick={() => { setType('all'); setBlock('all'); setFrom(''); setTo(''); }}>Limpiar</button>}</div>
    <Panel><div className="table-wrap"><table><thead><tr><th>Actividad</th><th>Ubicación</th><th>Fecha y hora</th><th>Notas</th><th>Detalle</th></tr></thead><tbody>{filtered.map(event => <tr key={event.id}><td><span className="table-title"><EventIcon event={event} />{eventLabels[event.eventType]}</span></td><td>{event.block?.code ?? event.row?.block.code ?? 'Sin bloque'}<small className="table-subtitle">{event.row?.rowCode ?? 'Todo el bloque'}</small></td><td className="nowrap">{new Date(event.occurredAt).toLocaleDateString('es-CO')}<small className="table-subtitle">{new Date(event.occurredAt).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}</small></td><td className="notes-cell">{event.notes || 'Sin notas'}</td><td><button className="icon-button" aria-label={`Ver actividad ${event.id}`} onClick={() => setSelected(event)}><Eye size={18} /></button></td></tr>)}</tbody></table>{!filtered.length && <Empty title="Cada registro es una semilla" description="No hay actividades con estos filtros. Registra la primera o cambia la búsqueda." />}</div><div className="table-pagination"><span>{filtered.length} registros{mode === 'demo' ? ' de demostración' : ''}</span><span>Fechas en la zona horaria de tu dispositivo</span></div></Panel>
    {module && <p className="page-note">{page === 'fertilization' ? 'El registro actual almacena la actividad y sus notas. Productos, dosis y planes estructurados están pendientes.' : page === 'irrigation' ? 'Los sensores y las mediciones automáticas de humedad no están conectados. Este historial contiene eventos registrados por el equipo.' : page === 'disease' ? 'Las observaciones requieren revisión profesional y no constituyen diagnósticos confirmados. Los detalles de síntomas se guardan al crear el evento; el API aún no los devuelve para su consulta.' : 'El registro actual conserva la jornada y sus notas. Rendimiento, calidad y cantidades estructuradas están pendientes.'}</p>}
    </>}
    {form && <EventForm key={page} initialType={module?.type} onClose={() => setForm(false)} />}
    {selected && <EventDetail event={selected} onClose={() => setSelected(null)} />}
  </>;
}

function EventDetail({ event, onClose }: { event: FieldEvent; onClose: () => void }) {
  const { mode, role, remove, notify } = useApp();
  const [media, setMedia] = useState<{ id: number; kind: string; s3Key: string; contentType?: string }[]>([]);
  const [error, setError] = useState('');
  const [adding, setAdding] = useState(false);
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(false);
  useEffect(() => {
    if (mode === 'demo') { setMedia(readDemo(`media.${event.id}`, [])); return; }
    let active = true;
    api.media(event.id).then(result => { if (active) setMedia(result); }).catch(failure => { if (active) setError(failure.message); });
    return () => { active = false; };
  }, [event.id, mode]);

  async function registerMedia(submit: FormEvent<HTMLFormElement>) {
    submit.preventDefault(); const form = new FormData(submit.currentTarget); setError(''); setBusy(true);
    const payload = { eventId: event.id, kind: String(form.get('kind')), s3Key: String(form.get('s3Key')).trim(), contentType: String(form.get('contentType')).trim() };
    try {
      if (mode === 'demo') { const next = [...media, { id: Date.now(), ...payload }]; if (!saveDemo(`media.${event.id}`, next)) throw new Error('No se pudo guardar en el navegador.'); setMedia(next); }
      else { await api.create('media', payload); setMedia(await api.media(event.id)); }
      setAdding(false); notify('Referencia de archivo registrada.');
    } catch (failure) { setError(failure instanceof Error ? failure.message : 'No se pudo guardar.'); } finally { setBusy(false); }
  }

  async function deleteEvent() {
    setBusy(true);
    try { await remove('events', event.id); notify('Actividad eliminada.'); onClose(); }
    catch (failure) { setError(failure instanceof Error ? failure.message : 'No se pudo eliminar.'); } finally { setBusy(false); }
  }

  return <Modal title="Detalle de actividad" onClose={() => !busy && onClose()}><div className="event-detail"><EventIcon event={event} /><h2>{eventLabels[event.eventType]}</h2><div className="detail-meta"><span><MapPin size={15} />{event.block?.code ?? event.row?.block.code}</span><span><CalendarDays size={15} />{new Date(event.occurredAt).toLocaleString('es-CO')}</span></div><dl className="detail-list"><div><dt>Autor</dt><dd>Usuario #{event.createdByUserId}</dd></div><div><dt>Surco</dt><dd>{event.row?.rowCode ?? 'Todo el bloque'}</dd></div>{event.plantIndexStart != null && <div><dt>Rango de plantas</dt><dd>{event.plantIndexStart}–{event.plantIndexEnd}</dd></div>}</dl><div className="instructions"><h4>Notas de la actividad</h4><p>{event.notes || 'No se registraron notas.'}</p></div><PhotoGallery target={{ eventId: event.id }} onBusyChange={setBusy} /><div className="panel-heading"><h3>Referencias de archivos</h3><button className="text-button" onClick={() => setAdding(value => !value)}><Plus size={14} />Registrar referencia</button></div><p className="muted small-text">Aquí se conservan las referencias externas de archivos registradas previamente.</p>{media.map(item => <div className="media-record" key={item.id}><FileText size={19} /><div><strong>{item.s3Key}</strong><small>{item.kind} · {item.contentType || 'Sin tipo'}</small></div></div>)}{!media.length && <p className="muted">Sin referencias de archivos.</p>}{adding && <form onSubmit={registerMedia} className="form-stack inline-form"><label>Tipo<select name="kind"><option value="IMAGE">Imagen</option><option value="DOCUMENT">Documento</option><option value="VIDEO">Video</option></select></label><label>Clave del objeto S3<input name="s3Key" required placeholder="eventos/archivo.jpg" /></label><label>Tipo de contenido<input name="contentType" placeholder="image/jpeg" /></label><button disabled={busy} className="button small"><Check size={15} />Guardar referencia</button></form>}{error && <p role="alert" className="form-error">{error}</p>}{role !== 'WORKER' && <div className="delete-event">{confirm ? <><p>¿Eliminar esta actividad y sus referencias asociadas? No se puede deshacer.</p><button className="button danger small" disabled={busy} onClick={() => void deleteEvent()}>Confirmar eliminación</button><button className="text-button" onClick={() => setConfirm(false)}>Cancelar</button></> : <button className="text-button text-red" onClick={() => setConfirm(true)}><Trash2 size={14} />Eliminar actividad</button>}</div>}</div></Modal>;
}
