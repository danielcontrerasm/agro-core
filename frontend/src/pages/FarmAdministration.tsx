import { useCallback, useEffect, useRef, useState } from 'react';
import {
  AlertTriangle, ArrowDownUp, ArrowRight, BarChart3, Box, CalendarDays, CheckCircle2, Clock3,
  Download, Droplets, FileText, FlaskConical, LayoutGrid, List, Map as MapIcon, Receipt, UsersRound, Wallet,
} from 'lucide-react';
import { useApp } from '../context';
import { Badge, Panel } from '../components/ui';
import { AdminHeading, AdminTable, AdminTabs, Breakdown, ChartBars, colors, downloadCsv, Metrics } from '../components/AdministrationUI';
import ConnectedCosts from '../components/ConnectedCosts';
import ConnectedInventory from '../components/ConnectedInventory';
import ConnectedWorkers from '../components/ConnectedWorkers';
import { api } from '../lib/api';
import { activityLabels, number, roleLabels, statusLabels } from '../lib/domain';
import { workforceApi, type WorkforceData } from '../lib/workforce';
import type { Member, Task } from '../lib/types';
import '../farm-administration.css';

const demoMembers = [
  { userId: 1, name: 'Daniel Contreras', email: 'daniel@agrovision.demo', role: 'ADMIN', crew: 'Cuadrilla 1', hours: 7.5 },
  { userId: 2, name: 'María Rodríguez', email: 'maria@agrovision.demo', role: 'WORKER', crew: 'Cuadrilla 1', hours: 7 },
  { userId: 3, name: 'Carlos Mendoza', email: 'carlos@agrovision.demo', role: 'SUPERVISOR', crew: 'Cuadrilla 2', hours: 6 },
  { userId: 4, name: 'José Rodríguez', email: 'jose@agrovision.demo', role: 'WORKER', crew: 'Cuadrilla 2', hours: 5.5 },
  { userId: 5, name: 'Ana Martínez', email: 'ana@agrovision.demo', role: 'WORKER', crew: 'Cuadrilla 3', hours: 5 },
  { userId: 6, name: 'Luis Torres', email: 'luis@agrovision.demo', role: 'AGRONOMIST', crew: 'Cuadrilla 3', hours: 0 },
] satisfies (Member & { crew: string; hours: number })[];
const workerTabs = [
  { label: 'Personal', icon: UsersRound }, { label: 'Cuadrillas', icon: LayoutGrid }, { label: 'Asistencia', icon: CalendarDays },
  { label: 'Asignaciones', icon: List }, { label: 'Desempeño', icon: BarChart3 },
];
const taskTones = { pending: 'neutral', progress: 'blue', completed: 'green', review: 'purple', blocked: 'red' };
const initials = (name: string) => name.trim().split(/\s+/).slice(0, 2).map(part => part[0]).join('').toUpperCase();

function Workers() {
  const { mode, farmId, role, data, tasks, date, profile, navigate, refresh } = useApp();
  const demo = mode === 'demo';
  const canList = role === 'ADMIN' || role === 'SUPERVISOR';
  const [tab, setTab] = useState('Personal');
  const [crewFilter, setCrewFilter] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [members, setMembers] = useState<Member[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(!demo && canList);
  const [workforceState, setWorkforceState] = useState<{ date: string; data?: WorkforceData; error?: string }>();
  const workforceRequest = useRef(0);
  const activeWorkDate = useRef(date);
  activeWorkDate.current = date;

  const reloadWorkforce = useCallback(async () => {
    if (activeWorkDate.current !== date) return;
    const requestId = ++workforceRequest.current;
    try {
      const data = await workforceApi.get(farmId, date);
      if (requestId === workforceRequest.current) setWorkforceState({ date, data });
    } catch (failure) {
      if (requestId === workforceRequest.current) {
        setWorkforceState({ date, error: failure instanceof Error ? failure.message : 'No se pudieron consultar las cuadrillas y la asistencia.' });
      }
      throw failure;
    }
  }, [farmId, date]);

  useEffect(() => {
    if (demo) return;
    void reloadWorkforce().catch(() => {});
    return () => { workforceRequest.current++; };
  }, [demo, reloadWorkforce]);

  useEffect(() => {
    if (demo || !canList) return;
    let active = true;
    setMembers([]);
    setError('');
    setLoading(true);
    api.members(farmId).then(result => { if (active) setMembers(result); })
      .catch(() => { if (active) setError('No se pudo consultar el personal de la finca.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [demo, farmId, canList]);

  const people = demo ? demoMembers : canList ? members : [{ userId: profile.user.id, ...profile.user, role }];
  const currentWorkforce = workforceState?.date === date ? workforceState : undefined;
  const workforce = currentWorkforce?.data;
  const demoCrews = [...new Set(demoMembers.map(member => member.crew))];
  const crewByPerson = new Map(workforce?.crews.flatMap(crew => crew.memberIds.map(id => [id, crew] as const)));
  const attendanceByPerson = new Map(workforce?.attendance.map(record => [record.userId, record] as const));
  const crewOf = (id: number) => demo ? demoMembers.find(member => member.userId === id)?.crew : crewByPerson.get(id)?.name;
  const hoursOf = (id: number) => demo ? demoMembers.find(member => member.userId === id)?.hours
    : attendanceByPerson.get(id)?.hours;
  const crewOptions = demo ? demoCrews.map(name => ({ value: name, name })) : workforce?.crews.map(crew => ({ value: String(crew.id), name: crew.name })) ?? [];
  const activeCrewFilter = crewOptions.some(crew => crew.value === crewFilter) ? crewFilter : '';
  const crewCount = demo ? demoCrews.length : workforce?.crews.length;
  const attendanceCount = demo ? demoMembers.length : workforce?.attendance.length;
  const hours = demo ? demoMembers.reduce((total, member) => total + member.hours, 0)
    : workforce?.attendance.reduce((total, record) => total + record.hours, 0);
  const visiblePeople = people.filter(person => (!roleFilter || person.role === roleFilter) && (!activeCrewFilter ||
    (demo ? crewOf(person.userId) : String(crewByPerson.get(person.userId)?.id)) === activeCrewFilter));
  const dayTasks = tasks.filter(task => task.date === date && (demo ? data.blocks.some(block => block.id === task.blockId) : task.farmId === farmId));
  const assignment = (person: Member) => dayTasks.filter(task => task.assigneeId != null ? task.assigneeId === person.userId : task.assignee === person.name);
  const location = (task: Task) => data.blocks.find(block => block.id === task.blockId)?.code ?? data.fields.find(field => field.id === task.fieldId)?.name ?? '—';
  const completed = dayTasks.filter(task => task.status === 'completed');
  const blocked = dayTasks.filter(task => task.status === 'blocked');
  const showSummary = tab === 'Personal';
  const workforceTab = tab === 'Asistencia' || tab === 'Cuadrillas' ? tab : undefined;

  return <>
    <AdminHeading title="Trabajadores y cuadrillas" description="Consulta el personal y las asignaciones de la finca para la fecha seleccionada."
      action={<button className="button secondary" onClick={() => navigate('tasks')}><CalendarDays size={17} />Ver tareas</button>} />
    {demo && <div className="admin-data-note"><Badge tone="blue">Demostración</Badge>Asistencia y cuadrillas de ejemplo.</div>}
    <Metrics items={[
      { label: canList || demo ? 'Trabajadores' : 'Mi perfil', value: loading || error ? '—' : people.length, note: 'Personas visibles', icon: UsersRound },
      { label: 'Con tareas asignadas', value: new Set(dayTasks.map(task => task.assigneeId ?? task.assignee)).size, note: 'En la fecha seleccionada', icon: CalendarDays, tone: 'blue' },
      { label: 'Cuadrillas', value: crewCount ?? '—', note: canList || demo ? 'Equipos de la finca' : 'Cuadrilla propia', icon: UsersRound, tone: 'blue' },
      { label: 'Tareas completadas', value: `${completed.length} / ${dayTasks.length}`, note: 'En la fecha seleccionada', icon: CheckCircle2 },
      { label: 'Horas trabajadas', value: hours != null && attendanceCount ? `${number(hours, 2)} h` : '—', note: canList || demo ? 'Asistencia de la fecha seleccionada' : 'Asistencia propia', icon: Clock3, tone: 'purple' },
      { label: 'Tareas bloqueadas', value: blocked.length, note: 'Requieren revisión', icon: AlertTriangle, tone: 'gold' },
    ]} />
    <AdminTabs tabs={workerTabs} value={tab} onSelect={setTab}>
      {showSummary && <div className="admin-filters">
        {crewOptions.length > 0 && <select aria-label="Filtrar por cuadrilla" value={activeCrewFilter} onChange={event => setCrewFilter(event.target.value)}><option value="">Todas las cuadrillas</option>{crewOptions.map(crew => <option value={crew.value} key={crew.value}>{crew.name}</option>)}</select>}
        <select aria-label="Filtrar por rol" value={roleFilter} onChange={event => setRoleFilter(event.target.value)}><option value="">Todos los roles</option>{Object.entries(roleLabels).map(([id, label]) => <option value={id} key={id}>{label}</option>)}</select>
      </div>}
    </AdminTabs>
    {currentWorkforce?.error && <div className="error-banner" role="alert"><p>{currentWorkforce.error}</p><button className="button secondary small" onClick={() => void reloadWorkforce().catch(() => {})}>Reintentar</button></div>}
    {!demo && workforceTab && !currentWorkforce?.error && (
      error ? <div className="error-banner" role="alert"><p>{error}</p><button className="button secondary small" onClick={() => { void refresh().catch(() => {}); }}>Reintentar</button></div>
        : !workforce || loading ? <p role="status">Cargando cuadrillas y asistencia…</p>
          : <ConnectedWorkers key={`${date}-${workforceTab}`} tab={workforceTab} data={workforce} members={people} onReload={reloadWorkforce} />
    )}
    <div className="admin-main-grid admin-main-workers" data-summary={showSummary}>
      {(showSummary || (demo && tab === 'Asistencia')) && <Panel title={tab === 'Asistencia' ? 'Asistencia de ejemplo' : 'Personal de la finca'}>
        {error ? <p className="form-error" role="alert">{error}</p> : loading ? <p role="status">Cargando el personal…</p> : visiblePeople.length ? <AdminTable
          headers={demo ? ['Trabajador', 'Rol', 'Cuadrilla', 'Zona asignada', 'Horas', 'Asistencia'] : ['Trabajador', 'Rol', 'Cuadrilla', 'Zona asignada', 'Horas', 'Tareas']}
          rows={visiblePeople.map(person => {
            const assigned = assignment(person);
            const workAreas = [...new Set(assigned.map(location))].join(' · ') || '—';
            const name = <div className="admin-person"><span aria-hidden="true">{initials(person.name)}</span><strong>{person.name}</strong></div>;
            const hours = hoursOf(person.userId);
            return { key: person.userId, cells: demo
              ? [name, roleLabels[person.role], crewOf(person.userId), workAreas, `${number(hours ?? 0, 1)} h`, <Badge tone={hours ? 'green' : 'gold'}>{hours ? 'Registrada' : 'Por confirmar'}</Badge>]
              : [name, roleLabels[person.role], crewOf(person.userId) ?? (workforce ? 'Sin asignar' : '—'), workAreas, hours == null ? '—' : `${number(hours, 2)} h`, assigned.length] };
          })} /> : <p className="admin-empty-copy">No hay personas con los filtros seleccionados.</p>}
      </Panel>}
      {(showSummary || tab === 'Cuadrillas') && demo && <Panel title="Cuadrillas y asignaciones">
        <div className="admin-crew-grid">{demoCrews.map(crew => {
          const team = demoMembers.filter(member => member.crew === crew);
          const assigned = team.flatMap(assignment);
          const done = assigned.filter(task => task.status === 'completed').length;
          const percent = assigned.length ? Math.round(done * 100 / assigned.length) : 0;
          return <article key={crew}><div><UsersRound size={22} /><strong>{crew}</strong></div>
            <p>{team.length} personas · {assigned.length} tareas</p><progress max={100} value={percent} aria-label={`Tareas completadas por ${crew}`} /><small>{done} de {assigned.length} completadas</small>
          </article>;
        })}</div>
      </Panel>}
      {(tab === 'Asignaciones' || (!demo && showSummary)) && <Panel title="Asignaciones del día">
        {dayTasks.length ? <AdminTable headers={['Labor', 'Responsable', 'Zona', 'Estado']}
          rows={dayTasks.map(task => ({ key: task.id, cells: [task.title, task.assignee, location(task), <Badge tone={taskTones[task.status]}>{statusLabels[task.status]}</Badge>] }))} />
          : <p className="admin-empty-copy">No hay tareas en la fecha seleccionada.</p>}
      </Panel>}
    </div>
    {(showSummary || tab === 'Desempeño') && <div className="admin-lower-grid">
      {demo && <Panel title="Horas por cuadrilla"><ChartBars title="Horas por cuadrilla"
        labels={[{ name: 'Horas registradas', color: colors[0] }]}
        groups={demoCrews.map((crew, index) => ({ name: `C${index + 1}`, values: [demoMembers.filter(member => member.crew === crew).reduce((sum, member) => sum + member.hours, 0)] }))} /></Panel>}
      <Panel title="Distribución de labores"><Breakdown value={String(dayTasks.length)} label="Tareas"
        entries={Object.entries(activityLabels).map(([activity, name]) => ({ name, value: dayTasks.filter(task => task.activity === activity).length }))} /></Panel>
      <Panel title="Incidencias y actividad" action={<button className="text-button" onClick={() => navigate('tasks')}>Ver tareas <ArrowRight size={15} /></button>}>
        {blocked.length || completed.length ? <ul className="admin-activity">{[...blocked, ...completed].slice(0, 5).map(task =>
          <li key={task.id}><span className={`admin-list-icon ${taskTones[task.status]}`}>{task.status === 'blocked' ? <AlertTriangle size={17} /> : <CheckCircle2 size={17} />}</span>
            <div><strong>{task.title}</strong><small>{task.assignee} · {location(task)}</small></div><Badge tone={taskTones[task.status]}>{statusLabels[task.status]}</Badge></li>
        )}</ul> : <p className="admin-empty-copy">Sin tareas completadas o bloqueadas en esta fecha.</p>}
      </Panel>
    </div>}
  </>;
}

const inventoryTabs = [
  { label: 'Existencias', icon: Box }, { label: 'Movimientos', icon: ArrowDownUp }, { label: 'Lotes', icon: List }, { label: 'Alertas', icon: AlertTriangle },
];
const inventory = [
  { name: 'NPK 15-15-15', code: 'FER-001', category: 'Fertilizantes', stock: 1240, unit: 'kg', minimum: 400, lot: 'NF-026', expiry: '15 mar 2027', state: 'Disponible', value: 7200000 },
  { name: 'Sulfato de magnesio', code: 'FER-004', category: 'Fertilizantes', stock: 185, unit: 'kg', minimum: 250, lot: 'SM-010', expiry: '10 feb 2027', state: 'Stock bajo', value: 3500000 },
  { name: 'Urea 46% N', code: 'FER-002', category: 'Fertilizantes', stock: 860, unit: 'kg', minimum: 300, lot: 'UR-024', expiry: '18 abr 2027', state: 'Disponible', value: 2940000 },
  { name: 'Fungicida registrado', code: 'FIT-008', category: 'Fitosanitarios', stock: 28, unit: 'L', minimum: 40, lot: 'F-089', expiry: '20 nov 2026', state: 'Por vencer', value: 6944000 },
  { name: 'Trampas de monitoreo', code: 'MON-012', category: 'Otros', stock: 65, unit: 'un.', minimum: 20, lot: 'TR-012', expiry: '—', state: 'Disponible', value: 2916000 },
  { name: 'Guantes de protección', code: 'EPP-003', category: 'Otros', stock: 12, unit: 'pares', minimum: 25, lot: 'GP-003', expiry: '—', state: 'Stock bajo', value: 1300000 },
] as const;
const movements = [
  { date: '24 oct', kind: 'Salida', code: 'FER-001', quantity: '−240 kg', target: 'Bloque A2' },
  { date: '23 oct', kind: 'Entrada', code: 'FER-002', quantity: '+500 kg', target: 'Proveedor' },
  { date: '22 oct', kind: 'Salida', code: 'FER-004', quantity: '−85 kg', target: 'Bloque B2' },
  { date: '21 oct', kind: 'Ajuste', code: 'EPP-003', quantity: '−2 pares', target: 'Almacén 01' },
];
const stockTones = { Disponible: 'green', 'Stock bajo': 'gold', 'Por vencer': 'red' };
const months = ['May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct'];
const cop = (amount: number) => `$${number(amount, 2)}`;
const million = (amount: number) => `${cop(amount / 1000000)} M`;

function DemoInventory() {
  const [tab, setTab] = useState('Existencias');
  const [category, setCategory] = useState('');
  const categories = [...new Set(inventory.map(product => product.category))];
  const visible = inventory.filter(product => !category || product.category === category);
  const alerts = visible.filter(product => product.state !== 'Disponible');
  const stockBelowMinimum = visible.filter(product => product.stock < product.minimum).length;
  const stockValue = visible.reduce((sum, product) => sum + product.value, 0);
  const visibleMovements = movements.filter(move => visible.some(product => product.code === move.code));
  const summary = tab === 'Existencias';

  return <>
    <AdminHeading title="Inventario de insumos" description="Consulta existencias, lotes, vencimientos y movimientos de productos de campo."
      action={<button className="button" onClick={() => downloadCsv('agrovision-demo-inventario.csv', [
        ['Producto', 'Código', 'Categoría', 'Disponible', 'Unidad', 'Mínimo', 'Lote', 'Vencimiento', 'Estado'],
        ...visible.map(item => [item.name, item.code, item.category, item.stock, item.unit, item.minimum, item.lot, item.expiry, item.state]),
      ])}><Download size={17} />Exportar existencias</button>} />
    <div className="admin-data-note"><Badge tone="blue">Demostración</Badge>Datos de inventario de octubre de 2026.</div>
    <Metrics items={[
      { label: 'Productos registrados', value: visible.length, note: 'Almacén 01', icon: Box },
      { label: 'Valor de inventario', value: million(stockValue), note: 'COP · stock disponible', icon: Wallet },
      { label: 'Stock bajo', value: stockBelowMinimum, note: 'Por debajo del mínimo', icon: AlertTriangle, tone: 'gold' },
      { label: 'Por vencer', value: visible.filter(product => product.state === 'Por vencer').length, note: 'Próximos 30 días', icon: Clock3, tone: 'red' },
      { label: 'Entradas del mes', value: visibleMovements.filter(move => move.kind === 'Entrada').length, note: 'Movimientos de ejemplo', icon: ArrowDownUp, tone: 'blue' },
      { label: 'Salidas del mes', value: visibleMovements.filter(move => move.kind === 'Salida').length, note: 'Movimientos de ejemplo', icon: ArrowDownUp, tone: 'purple' },
    ]} />
    <AdminTabs tabs={inventoryTabs} value={tab} onSelect={setTab}><div className="admin-filters">
      <select aria-label="Filtrar por categoría" value={category} onChange={event => setCategory(event.target.value)}>
        <option value="">Todas las categorías</option>{categories.map(item => <option key={item}>{item}</option>)}
      </select>
    </div></AdminTabs>
    <div className="admin-main-grid" data-summary={summary}>
      {(summary || tab === 'Lotes') && <Panel title={summary ? 'Existencias por producto' : 'Lotes del almacén'}>
        <AdminTable headers={['Producto / código', 'Categoría', 'Disponible', summary ? 'Mínimo' : 'Lote', 'Vencimiento', 'Estado']}
          rows={visible.map(product => ({ key: product.code, cells: [
            <><strong>{product.name}</strong><small>{product.code} · Almacén 01</small></>, product.category,
            `${number(product.stock)} ${product.unit}`, summary ? `${number(product.minimum)} ${product.unit}` : product.lot, product.expiry,
            <Badge tone={stockTones[product.state]}>{product.state}</Badge>,
          ] }))} />
      </Panel>}
      {(summary || tab === 'Alertas') && <Panel title="Alertas de inventario">
        {alerts.length ? <ul className="admin-activity">{alerts.map(product => <li key={product.code}>
          <span className={`admin-list-icon ${stockTones[product.state]}`}>{product.state === 'Por vencer' ? <Clock3 size={18} /> : <AlertTriangle size={18} />}</span>
          <div><strong>{product.name}</strong><small>{product.state === 'Por vencer' ? `Lote ${product.lot} · ${product.expiry}` : `${product.stock} ${product.unit} disponibles · mínimo ${product.minimum} ${product.unit}`}</small></div>
          <Badge tone={stockTones[product.state]}>{product.state}</Badge>
        </li>)}</ul> : <p className="admin-empty-copy">No hay alertas en esta categoría.</p>}
      </Panel>}
    </div>
    {(summary || tab === 'Movimientos') && <div className={summary ? 'admin-lower-grid admin-inventory-lower' : undefined}>
      <Panel title={summary ? 'Últimos movimientos' : 'Historial de movimientos'}>
        {visibleMovements.length ? <AdminTable headers={['Fecha', 'Movimiento', 'Producto', 'Cantidad', 'Destino / origen']}
          rows={visibleMovements.map(move => ({ key: move.code, cells: [
            move.date, <Badge tone={move.kind === 'Entrada' ? 'green' : move.kind === 'Salida' ? 'gold' : 'blue'}>{move.kind}</Badge>,
            inventory.find(product => product.code === move.code)?.name, move.quantity, move.target,
          ] }))} /> : <p className="admin-empty-copy">No hay movimientos en esta categoría.</p>}
      </Panel>
      {summary && <>
        <Panel title="Valor por categoría"><Breakdown value={million(stockValue)} label="COP" suffix="%"
          entries={categories.map(name => ({ name, value: Math.round(100 * visible.filter(item => item.category === name).reduce((sum, item) => sum + item.value, 0) / stockValue) }))} /></Panel>
        <Panel title="Consumo de fertilizantes"><ChartBars title="Consumo de fertilizantes por mes" labels={[{ name: 'Fertilizantes (kg)', color: colors[0] }]}
          groups={months.map((name, index) => ({ name, values: [[1660, 2060, 1770, 2350, 2780, 2480][index]] }))} /></Panel>
      </>}
    </div>}
  </>;
}

const costTabs = [
  { label: 'Resumen', icon: LayoutGrid }, { label: 'Gastos', icon: Wallet }, { label: 'Ingresos', icon: Receipt },
  { label: 'Rentabilidad', icon: BarChart3 }, { label: 'Presupuesto', icon: FileText },
];
const costBlocks = [
  { name: 'A1', production: 28.4, cost: 11.2, income: 18.5 }, { name: 'A2', production: 31.6, cost: 12.9, income: 20.5 },
  { name: 'B1', production: 21.8, cost: 9.3, income: 14.2 }, { name: 'B2', production: 17.3, cost: 8.7, income: 11.2 },
  { name: 'C1 / D1', production: 27.3, cost: 13.3, income: 17.8 },
];
const expenses = [
  { title: 'Fertilización A2', date: '24 oct', category: 'Insumos', value: 1240000, icon: FlaskConical, tone: 'green' },
  { title: 'Jornal de cuadrilla 1', date: '24 oct', category: 'Mano de obra', value: 420000, icon: UsersRound, tone: 'blue' },
  { title: 'Energía de bombeo', date: '23 oct', category: 'Riego', value: 286000, icon: Droplets, tone: 'purple' },
  { title: 'Control fitosanitario B2', date: '22 oct', category: 'Insumos', value: 790000, icon: FlaskConical, tone: 'gold' },
];
function DemoCosts() {
  const [tab, setTab] = useState('Resumen');
  const summary = tab === 'Resumen';
  const budget = 53;
  const { cost, income, production } = costBlocks.reduce((sum, block) => ({
    cost: sum.cost + block.cost, income: sum.income + block.income, production: sum.production + block.production,
  }), { cost: 0, income: 0, production: 0 });
  const spend = 100 * cost / budget;
  const distribution = [
    { name: 'Fertilizantes', value: 34 }, { name: 'Mano de obra', value: 26 }, { name: 'Fitosanitarios', value: 18 },
    { name: 'Riego y energía', value: 12 }, { name: 'Otros', value: 10 },
  ];
  return <>
    <AdminHeading title="Costos y rentabilidad" description="Consulta cuánto cuesta producir, cómo avanza el presupuesto y el margen por bloque."
      action={<button className="button" onClick={() => downloadCsv('agrovision-demo-costos.csv', [
        ['Bloque', 'Producción (t)', 'Costo (M COP)', 'Ingresos (M COP)'],
        ...costBlocks.map(item => [item.name, item.production, item.cost, item.income]),
      ])}><Download size={17} />Exportar costos</button>} />
    <div className="admin-data-note"><Badge tone="blue">Demostración</Badge>Datos financieros de octubre de 2026.</div>
    <Metrics items={[
      { label: 'Costo del mes', value: million(cost * 1000000), note: 'COP · costos operativos', icon: Wallet },
      { label: 'Ingresos', value: million(income * 1000000), note: 'COP · ventas del mes', icon: Receipt },
      { label: 'Margen bruto', value: million((income - cost) * 1000000), note: `${number(100 * (income - cost) / income, 1)}% de los ingresos`, icon: BarChart3 },
      { label: 'Costo por kg', value: cop(cost * 1000 / production), note: 'COP / kg producido', icon: Box },
      { label: 'Costo por ha', value: `${cop(cost * 1000 / 121)} mil`, note: 'COP / ha · 121 ha', icon: MapIcon },
      { label: 'Desviación presupuestal', value: `+${number(spend - 100, 1)}%`, note: 'Frente al plan del mes', icon: AlertTriangle, tone: 'gold' },
    ]} />
    <AdminTabs tabs={costTabs} value={tab} onSelect={setTab} />
    <div className="admin-lower-grid admin-costs-grid" data-summary={summary}>
      {(summary || tab === 'Ingresos') && <Panel title="Ingresos y costos por mes">
        <p className="admin-panel-note">Millones de COP</p>
        <ChartBars title="Ingresos y costos por mes, en millones de pesos"
          labels={[{ name: 'Ingresos', color: colors[0] }, { name: 'Costos', color: '#9ebfb3' }]}
          groups={months.map((name, index) => ({ name, values: [[57, 63, 69, 76, 74, income][index], [42, 45, 49, 52, 51, cost][index]] }))} />
      </Panel>}
      {(summary || tab === 'Gastos') && <Panel title="Distribución de costos"><Breakdown value={million(cost * 1000000)} label="COP" entries={distribution} suffix="%" /></Panel>}
      {(summary || tab === 'Presupuesto') && <Panel title="Control presupuestal">
        <p className="admin-panel-note">Presupuesto mensual frente a ejecución</p>
        <div className="admin-budget">
          <div><strong>{number(spend, 1)}%</strong> <Badge tone="gold">+{number(spend - 100, 1)}%</Badge></div>
          <progress value={Math.min(spend, 100)} max={100} aria-label="Ejecución del presupuesto hasta el total planeado" />
          <dl><div><dt>Presupuestado</dt><dd>{million(budget * 1000000)} COP</dd></div>
            <div><dt>Ejecutado</dt><dd>{million(cost * 1000000)} COP</dd></div>
            <div><dt>Desviación</dt><dd>+{million((cost - budget) * 1000000)} COP</dd></div></dl>
        </div>
      </Panel>}
    </div>
    <div className="admin-main-grid" data-summary={summary}>
      {(summary || tab === 'Rentabilidad') && <Panel title="Rentabilidad por bloque">
        <AdminTable headers={['Bloque', 'Producción (t)', 'Costo (M COP)', 'Costo por kg', 'Ingresos (M COP)', 'Margen bruto']}
          rows={costBlocks.map(block => {
            const margin = 100 * (block.income - block.cost) / block.income;
            return { key: block.name, cells: [block.name, number(block.production, 1), cop(block.cost),
              cop(block.cost * 1000 / block.production), cop(block.income), <Badge tone={margin >= 30 ? 'green' : 'gold'}>{number(margin, 1)}%</Badge>] };
          })} />
      </Panel>}
      {(summary || tab === 'Gastos') && <Panel title="Últimos gastos registrados"><ul className="admin-activity">{expenses.map(item => <li key={item.title}>
        <span className={`admin-list-icon ${item.tone}`}><item.icon size={18} /></span><div><strong>{item.title}</strong><small>{item.date} · {item.category}</small></div><strong>{cop(item.value)}</strong>
      </li>)}</ul></Panel>}
    </div>
  </>;
}

export default function FarmAdministration({ page }: { page: 'workers' | 'inventory' | 'costs' }) {
  const { mode, farmId, role } = useApp();
  return <section className="farm-administration">
    {page === 'workers' && <Workers key={`${mode}-${farmId}-${role}`} />}
    {page === 'inventory' && (mode === 'demo' ? <DemoInventory /> : <ConnectedInventory />)}
    {page === 'costs' && (mode === 'demo' ? <DemoCosts /> : <ConnectedCosts />)}
  </section>;
}
