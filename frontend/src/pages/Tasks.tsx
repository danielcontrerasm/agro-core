import { useEffect, useState } from 'react';
import { Plus, Clock3, CheckCircle2, Play, ArrowRight, MapPin, UserRound, CalendarDays, AlertTriangle, ClipboardCheck, LayoutGrid, List, Leaf, Droplets, Sprout, Wheat, Bug } from 'lucide-react';
import { useApp } from '../context';
import { todayTasks, statusLabels, activityLabels, localDate } from '../lib/domain';
import type { Task } from '../lib/types';
import { Badge, Empty, Modal, Notice, Panel } from '../components/ui';
import { TaskForm } from '../components/Forms';

const activityIcons = { fertilization: Sprout, irrigation: Droplets, scouting: Bug, planting: Leaf, harvest: Wheat };

export default function Tasks() {
  const { mode, data, farmId, tasks, updateTask, date, setDate, role, profile, search, notify } = useApp();
  const [filter, setFilter] = useState('all');
  const [assignee, setAssignee] = useState('all');
  const [view, setView] = useState<'grid' | 'list'>('grid');
  const [newTask, setNewTask] = useState(false);
  const [selected, setSelected] = useState<Task | null>(null);
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const demo = mode === 'demo';
  useEffect(() => { setSelected(null); setNewTask(false); setAssignee('all'); setError(''); }, [farmId, mode]);
  const scoped = tasks.filter(task => demo ? data.blocks.some(block => block.id === task.blockId) : task.farmId === farmId);
  const dayTasks = todayTasks(scoped, date, demo && role === 'WORKER' ? profile.user.name : undefined);
  const location = (task: Task) => {
    const block = data.blocks.find(item => item.id === task.blockId);
    return block ? `${block.field.name} · ${block.code}` : data.fields.find(field => field.id === task.fieldId)?.name ?? 'Ubicación no disponible';
  };
  const responsibleKey = (task: Task) => demo ? task.assignee : String(task.assigneeId);
  const filtered = dayTasks.filter(task => (filter === 'all' || task.status === filter) && (assignee === 'all' || responsibleKey(task) === assignee) && `${task.title} ${task.assignee} ${location(task)}`.toLocaleLowerCase('es').includes(search.toLocaleLowerCase('es')));
  const completed = dayTasks.filter(task => task.status === 'completed').length;
  const responsibleOptions = [...new Map(scoped.map(task => [responsibleKey(task), task.assignee])).entries()];

  async function update(status: Task['status']) {
    if (!selected || busy) return;
    setBusy(true); setError('');
    try {
      const next = await updateTask(selected, status, notes);
      setSelected(next);
      notify(`Tarea ${statusLabels[status].toLocaleLowerCase('es')}. ${demo ? 'Cambio guardado localmente.' : 'Cambio guardado en tu finca.'}`);
    } catch (failure) { setError(failure instanceof Error ? failure.message : 'No se pudo actualizar.'); }
    finally { setBusy(false); }
  }
  const open = (task: Task) => { setSelected(task); setNotes(task.notes ?? ''); setError(''); };

  return <>
    <div className="page-heading"><div><span className="eyebrow">TU JORNADA, ORGANIZADA</span><h1>Mi trabajo de hoy<span className="greeting-dot">.</span></h1><p>Un buen día en el campo empieza con un plan claro.</p></div>{role !== 'WORKER' && <button className="button" onClick={() => setNewTask(true)} disabled={demo ? !data.blocks.length : !data.fields.length && !data.blocks.length}><Plus size={17} />Nueva tarea</button>}</div>
    <Notice>{demo ? 'Prototipo interactivo · Tareas locales de demostración. Los cambios no se envían al backend.' : 'Tareas de tu finca · Los cambios se guardan en el servidor. Los trabajadores ven sus asignaciones y los supervisores revisan el trabajo.'}</Notice>
    <div className="task-summary"><div><span className="icon-tile green"><ClipboardCheck size={24} /></span><span><strong>{completed} de {dayTasks.length} tareas completadas</strong><small>Paso a paso, tu finca sigue creciendo.</small></span></div><div className="task-progress"><span style={{ width: `${dayTasks.length ? completed / dayTasks.length * 100 : 0}%` }} /></div><strong>{dayTasks.length ? Math.round(completed / dayTasks.length * 100) : 0}%</strong></div>
    <div className="toolbar"><div className="tabs scroll-tabs">{[['all', 'Todas'], ['pending', 'Pendientes'], ['progress', 'En curso'], ['review', 'Por revisar'], ['blocked', 'Bloqueadas'], ['completed', 'Completadas']].map(([value, label]) => <button className={filter === value ? 'active' : ''} onClick={() => setFilter(value)} key={value}>{label}<span>{value === 'all' ? dayTasks.length : dayTasks.filter(task => task.status === value).length}</span></button>)}</div><div className="toolbar-controls">{role !== 'WORKER' && <label className="filter-select"><UserRound size={15} /><select aria-label="Filtrar por responsable" value={assignee} onChange={event => setAssignee(event.target.value)}><option value="all">Todo el equipo</option>{responsibleOptions.map(([key, name]) => <option key={key} value={key}>{name}</option>)}</select></label>}<button className={`icon-button ${view === 'grid' ? 'selected' : ''}`} aria-label="Vista de tarjetas" onClick={() => setView('grid')}><LayoutGrid size={17} /></button><button className={`icon-button ${view === 'list' ? 'selected' : ''}`} aria-label="Vista de lista" onClick={() => setView('list')}><List size={18} /></button></div></div>
    <div className="date-context"><CalendarDays size={16} /><strong>{new Date(`${date}T12:00:00`).toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long' })}</strong>{date !== localDate() && <button className="text-button" onClick={() => setDate(localDate())}>Volver a hoy</button>}<span>Incluye pendientes de días anteriores</span></div>
    {filtered.length ? <div className={`task-grid ${view === 'list' ? 'task-list-view' : ''}`}>{filtered.map(task => {
      const Icon = activityIcons[task.activity];
      return <button className={`task-card status-${task.status}`} key={task.id} onClick={() => open(task)}>
        <div className="task-card-top"><span className={`icon-tile ${task.activity === 'irrigation' ? 'blue' : task.activity === 'scouting' ? 'orange' : 'green'}`}><Icon size={22} /></span><Badge tone={task.priority === 'Alta' ? 'red' : task.priority === 'Media' ? 'gold' : 'neutral'}>Prioridad {task.priority.toLowerCase()}</Badge></div>
        <span className="task-category">{activityLabels[task.activity]}</span><h3>{task.title}</h3><div className="task-location"><MapPin size={14} />{location(task)}</div><p className="task-description">{task.instructions}</p>
        <div className="task-person"><span className="avatar small-avatar">{task.assignee.split(' ').map(part => part[0]).slice(0, 2).join('')}</span><span>{task.assignee}</span><span className={task.date < date ? 'overdue' : ''}><Clock3 size={13} />{task.date < date ? 'Atrasada' : task.time.slice(0, 5)}</span></div>
        <div className="task-card-bottom"><Badge tone={task.status === 'blocked' ? 'red' : task.status === 'completed' ? 'green' : task.status === 'progress' ? 'blue' : task.status === 'review' ? 'purple' : 'neutral'}>{statusLabels[task.status]}</Badge><span>Ver tarea<ArrowRight size={15} /></span></div>
      </button>;
    })}</div> : <Panel><Empty title="Todo despejado por aquí" description="No hay tareas con estos filtros. Prueba otra fecha, estado o responsable." action={<button className="button secondary" onClick={() => { setFilter('all'); setAssignee('all'); }}>Limpiar filtros</button>} /></Panel>}
    {newTask && <TaskForm key={farmId} onClose={() => setNewTask(false)} />}
    {selected && <Modal title="Detalle de la tarea" onClose={() => { if (!busy) setSelected(null); }}><div className="task-detail">
      <div className="task-detail-type"><Badge>{activityLabels[selected.activity]}</Badge><Badge tone="neutral">{statusLabels[selected.status]}</Badge></div><h2>{selected.title}</h2>
      <div className="detail-meta"><span><MapPin size={16} />{location(selected)}</span><span><UserRound size={16} />{selected.assignee}</span><span><CalendarDays size={16} />{selected.date} · {selected.time.slice(0, 5)}</span></div>
      <div className="instructions"><h4>Instrucciones de trabajo</h4><p>{selected.instructions}</p></div>
      <label className="form-label">Notas y novedades<textarea value={notes} onChange={event => setNotes(event.target.value)} maxLength={4000} disabled={busy || selected.status === 'completed' || (selected.status === 'review' && role === 'WORKER')} rows={3} placeholder="Describe qué realizaste o por qué no pudiste continuar…" /></label>
      {error && <p className="form-error" role="alert">{error}</p>}
      <div className="task-detail-actions">
        {['pending', 'blocked'].includes(selected.status) && <button className="button" disabled={busy} onClick={() => update('progress')}><Play size={16} />{selected.status === 'blocked' ? 'Retomar tarea' : 'Iniciar tarea'}</button>}
        {selected.status === 'progress' && <button className="button" disabled={busy} onClick={() => update('review')}><CheckCircle2 size={17} />Enviar a revisión</button>}
        {['pending', 'progress'].includes(selected.status) && <button className="button secondary" disabled={busy} onClick={() => update('blocked')}><AlertTriangle size={16} />Reportar bloqueo</button>}
        {selected.status === 'review' && role !== 'WORKER' && <><button className="button" disabled={busy} onClick={() => update('completed')}><CheckCircle2 size={17} />Aprobar trabajo</button><button className="button secondary" disabled={busy} onClick={() => update('progress')}>Devolver a ejecución</button></>}
        {selected.status === 'completed' && <p className="form-success"><CheckCircle2 size={17} />Trabajo completado y revisado.</p>}
      </div>
      <small className="muted">{demo ? 'Este flujo es una demostración local. No genera eventos reales ni sincroniza evidencias.' : 'Los estados y las notas se guardan en la finca. Completar una tarea no crea un registro de actividad agrícola.'}</small>
    </div></Modal>}
  </>;
}
