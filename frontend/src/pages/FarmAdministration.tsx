import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import {
  AlertTriangle, ArrowDownUp, ArrowRight, BarChart3, Box, CalendarDays, CheckCircle2, Clock3,
  Download, Droplets, FileText, FlaskConical, LayoutGrid, List, Map, Receipt, UsersRound, Wallet,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useApp } from '../context';
import { Badge, Donut, Empty, Panel } from '../components/ui';
import { api } from '../lib/api';
import { activityLabels, csvCell, number, roleLabels, statusLabels } from '../lib/domain';
import type { Member, Task } from '../lib/types';
import '../farm-administration.css';

const colors = ['#138c4e', '#4380e4', '#efa924', '#9770d1', '#9fb0bc'];
type Metric = { label: string; value: ReactNode; note: string; icon: LucideIcon; tone?: string };

function AdminHeading({ title, description, action }: { title: string; description: string; action?: ReactNode }) {
  return <header className="admin-heading"><div><h1>{title}</h1><p>{description}</p></div>{action}</header>;
}

function Metrics({ items }: { items: Metric[] }) {
  return <div className="admin-metrics">{items.map(({ label, value, note, icon: Icon, tone = 'green' }) =>
    <article className="module-kpi" key={label}>
      <span className={`module-kpi-icon ${tone}`}><Icon size={23} /></span>
      <div><small>{label}</small><strong>{value}</strong><span>{note}</span></div>
    </article>
  )}</div>;
}

function AdminTabs({ tabs, value, onSelect, children }: {
  tabs: { label: string; icon: LucideIcon }[]; value: string; onSelect: (value: string) => void; children?: ReactNode;
}) {
  return <div className="admin-toolbar"><div className="admin-tabs" role="group" aria-label="Secciones">
    {tabs.map(({ label, icon: Icon }) => <button type="button" key={label} aria-pressed={label === value} onClick={() => onSelect(label)}><Icon size={16} />{label}</button>)}
  </div>{children}</div>;
}

function AdminTable({ headers, rows }: { headers: string[]; rows: { key: string | number; cells: ReactNode[] }[] }) {
  return <div className="table-wrap"><table className="admin-table" role="table"><thead role="rowgroup"><tr role="row">
    {headers.map(header => <th key={header} scope="col">{header}</th>)}
  </tr></thead><tbody role="rowgroup">
    {rows.map(row => <tr role="row" key={row.key}>{row.cells.map((cell, index) => index === 0
      ? <th scope="row" key={headers[index]}>{cell}</th>
      : <td role="cell" data-label={headers[index]} key={headers[index]}>{cell}</td>)}</tr>)}
  </tbody></table></div>;
}

function downloadCsv(fileName: string, rows: unknown[][]) {
  const url = URL.createObjectURL(new Blob(['\uFEFF' + rows.map(row => row.map(csvCell).join(',')).join('\r\n')], { type: 'text/csv;charset=utf-8' }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function ChartBars({ title, groups, labels }: { title: string; groups: { name: string; values: number[] }[]; labels: { name: string; color: string }[] }) {
  const max = Math.max(1, ...groups.flatMap(group => group.values));
  return <div className="admin-chart" role="img" aria-label={`${title}. ${groups.map(group =>
    `${group.name}, ${group.values.map((value, index) => `${labels[index].name} ${number(value, 2)}`).join(', ')}`).join('. ')}`}>
    <div className="admin-chart-key" aria-hidden="true">{labels.map(label => <span key={label.name}><i style={{ background: label.color }} />{label.name}</span>)}</div>
    <div className="admin-bar-chart" aria-hidden="true">{groups.map(group =>
      <div className="admin-bar-group" key={group.name}>
        <div>{group.values.map((value, index) => <span key={labels[index].name}
          style={{ height: `${value / max * 91}%`, background: labels[index].color }}
          title={`${labels[index].name} · ${group.name} · ${number(value, 2)}`} />)}</div>
        <small>{group.name}</small>
      </div>
    )}</div>
  </div>;
}

function Breakdown({ value, label, entries, suffix = '' }: {
  value: string; label: string; entries: { name: string; value: number }[]; suffix?: string;
}) {
  const values = entries.map(entry => entry.value);
  const total = values.reduce((sum, item) => sum + item, 0);
  return <div className="admin-breakdown">
    <Donut value={value} label={label} segments={total ? values : [1]} colors={total ? colors : ['#e0e8e4']} />
    <ul>{entries.map((entry, index) => <li key={entry.name}><i style={{ background: colors[index] }} />{entry.name}<strong>{number(entry.value)}{suffix}</strong></li>)}</ul>
  </div>;
}

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
  const { mode, farmId, role, data, tasks, date, profile, navigate } = useApp();
  const demo = mode === 'demo';
  const canList = role === 'ADMIN' || role === 'SUPERVISOR';
  const [tab, setTab] = useState('Personal');
  const [crewFilter, setCrewFilter] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [members, setMembers] = useState<Member[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

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
  const crewOf = (id: number) => demo ? demoMembers.find(member => member.userId === id)?.crew : undefined;
  const hoursOf = (id: number) => demo ? demoMembers.find(member => member.userId === id)?.hours : undefined;
  const crews = [...new Set(demoMembers.map(member => member.crew))];
  const visiblePeople = people.filter(person => (!roleFilter || person.role === roleFilter) && (!demo || !crewFilter || crewOf(person.userId) === crewFilter));
  const dayTasks = tasks.filter(task => task.date === date && (demo ? data.blocks.some(block => block.id === task.blockId) : task.farmId === farmId));
  const assignment = (person: Member) => dayTasks.filter(task => task.assigneeId != null ? task.assigneeId === person.userId : task.assignee === person.name);
  const location = (task: Task) => data.blocks.find(block => block.id === task.blockId)?.code ?? data.fields.find(field => field.id === task.fieldId)?.name ?? '—';
  const completed = dayTasks.filter(task => task.status === 'completed');
  const blocked = dayTasks.filter(task => task.status === 'blocked');
  const showSummary = tab === 'Personal';
  const visibleTabs = demo ? workerTabs : workerTabs.filter(item => ['Personal', 'Asignaciones', 'Desempeño'].includes(item.label));

  return <>
    <AdminHeading title="Trabajadores y cuadrillas" description="Consulta el personal y las asignaciones de la finca para la fecha seleccionada."
      action={<button className="button secondary" onClick={() => navigate('tasks')}><CalendarDays size={17} />Ver tareas</button>} />
    {demo && <div className="admin-data-note"><Badge tone="blue">Demostración</Badge>Asistencia y cuadrillas de ejemplo.</div>}
    <Metrics items={[
      { label: canList || demo ? 'Trabajadores' : 'Mi perfil', value: loading || error ? '—' : people.length, note: 'Personas visibles', icon: UsersRound },
      { label: 'Con tareas asignadas', value: new Set(dayTasks.map(task => task.assigneeId ?? task.assignee)).size, note: 'En la fecha seleccionada', icon: CalendarDays, tone: 'blue' },
      { label: 'Cuadrillas', value: demo ? crews.length : '—', note: demo ? 'Equipos de ejemplo' : 'Sin registro integrado', icon: UsersRound, tone: 'blue' },
      { label: 'Tareas completadas', value: `${completed.length} / ${dayTasks.length}`, note: 'En la fecha seleccionada', icon: CheckCircle2 },
      { label: 'Horas trabajadas', value: demo ? `${number(demoMembers.reduce((sum, member) => sum + member.hours, 0), 1)} h` : '—', note: demo ? 'Asistencia de ejemplo' : 'Sin registro integrado', icon: Clock3, tone: 'purple' },
      { label: 'Tareas bloqueadas', value: blocked.length, note: 'Requieren revisión', icon: AlertTriangle, tone: 'gold' },
    ]} />
    <AdminTabs tabs={visibleTabs} value={tab} onSelect={setTab}>
      {showSummary && <div className="admin-filters">
        {demo && <select aria-label="Filtrar por cuadrilla" value={crewFilter} onChange={event => setCrewFilter(event.target.value)}><option value="">Todas las cuadrillas</option>{crews.map(crew => <option key={crew}>{crew}</option>)}</select>}
        <select aria-label="Filtrar por rol" value={roleFilter} onChange={event => setRoleFilter(event.target.value)}><option value="">Todos los roles</option>{Object.entries(roleLabels).map(([id, label]) => <option value={id} key={id}>{label}</option>)}</select>
      </div>}
    </AdminTabs>
    <div className="admin-main-grid admin-main-workers" data-summary={showSummary}>
      {(showSummary || tab === 'Asistencia') && <Panel title={tab === 'Asistencia' ? 'Asistencia de ejemplo' : 'Personal de la finca'}>
        {error ? <p className="form-error" role="alert">{error}</p> : loading ? <p role="status">Cargando el personal…</p> : visiblePeople.length ? <AdminTable
          headers={demo ? ['Trabajador', 'Rol', 'Cuadrilla', 'Zona asignada', 'Horas', 'Asistencia'] : ['Trabajador', 'Rol', 'Zona asignada', 'Tareas']}
          rows={visiblePeople.map(person => {
            const assigned = assignment(person);
            const workAreas = [...new Set(assigned.map(location))].join(' · ') || '—';
            const name = <div className="admin-person"><span aria-hidden="true">{initials(person.name)}</span><strong>{person.name}</strong></div>;
            const hours = hoursOf(person.userId);
            return { key: person.userId, cells: demo
              ? [name, roleLabels[person.role], crewOf(person.userId), workAreas, `${number(hours ?? 0, 1)} h`, <Badge tone={hours ? 'green' : 'gold'}>{hours ? 'Registrada' : 'Por confirmar'}</Badge>]
              : [name, roleLabels[person.role], workAreas, assigned.length] };
          })} /> : <p className="admin-empty-copy">No hay personas con los filtros seleccionados.</p>}
      </Panel>}
      {(showSummary || tab === 'Cuadrillas') && demo && <Panel title="Cuadrillas y asignaciones">
        <div className="admin-crew-grid">{crews.map(crew => {
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
        groups={crews.map((crew, index) => ({ name: `C${index + 1}`, values: [demoMembers.filter(member => member.crew === crew).reduce((sum, member) => sum + member.hours, 0)] }))} /></Panel>}
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

function Inventory() {
  const { mode } = useApp();
  const [tab, setTab] = useState('Existencias');
  const [category, setCategory] = useState('');
  const demo = mode === 'demo';
  const categories = [...new Set(inventory.map(product => product.category))];
  const visible = inventory.filter(product => !category || product.category === category);
  const alerts = visible.filter(product => product.state !== 'Disponible');
  const stockBelowMinimum = visible.filter(product => product.stock < product.minimum).length;
  const stockValue = visible.reduce((sum, product) => sum + product.value, 0);
  const visibleMovements = movements.filter(move => visible.some(product => product.code === move.code));
  const summary = tab === 'Existencias';

  return <>
    <AdminHeading title="Inventario de insumos" description="Consulta existencias, lotes, vencimientos y movimientos de productos de campo."
      action={demo && <button className="button" onClick={() => downloadCsv('agrovision-demo-inventario.csv', [
        ['Producto', 'Código', 'Categoría', 'Disponible', 'Unidad', 'Mínimo', 'Lote', 'Vencimiento', 'Estado'],
        ...visible.map(item => [item.name, item.code, item.category, item.stock, item.unit, item.minimum, item.lot, item.expiry, item.state]),
      ])}><Download size={17} />Exportar existencias</button>} />
    {demo ? <>
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
    </> : <Panel><Empty title="Inventario sin datos disponibles" description="La finca conectada aún no tiene un registro de existencias, lotes o movimientos disponible en AgroVision." /></Panel>}
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
function Costs() {
  const { mode } = useApp();
  const [tab, setTab] = useState('Resumen');
  const demo = mode === 'demo';
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
      action={demo && <button className="button" onClick={() => downloadCsv('agrovision-demo-costos.csv', [
        ['Bloque', 'Producción (t)', 'Costo (M COP)', 'Ingresos (M COP)'],
        ...costBlocks.map(item => [item.name, item.production, item.cost, item.income]),
      ])}><Download size={17} />Exportar costos</button>} />
    {demo ? <>
      <div className="admin-data-note"><Badge tone="blue">Demostración</Badge>Datos financieros de octubre de 2026.</div>
      <Metrics items={[
        { label: 'Costo del mes', value: million(cost * 1000000), note: 'COP · costos operativos', icon: Wallet },
        { label: 'Ingresos', value: million(income * 1000000), note: 'COP · ventas del mes', icon: Receipt },
        { label: 'Margen bruto', value: million((income - cost) * 1000000), note: `${number(100 * (income - cost) / income, 1)}% de los ingresos`, icon: BarChart3 },
        { label: 'Costo por kg', value: cop(cost * 1000 / production), note: 'COP / kg producido', icon: Box },
        { label: 'Costo por ha', value: `${cop(cost * 1000 / 121)} mil`, note: 'COP / ha · 121 ha', icon: Map },
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
    </> : <Panel><Empty title="Costos sin datos disponibles" description="La finca conectada aún no tiene un registro financiero disponible en AgroVision." /></Panel>}
  </>;
}

export default function FarmAdministration({ page }: { page: 'workers' | 'inventory' | 'costs' }) {
  const { mode, farmId, role } = useApp();
  return <section className="farm-administration">
    {page === 'workers' ? <Workers key={`${mode}-${farmId}-${role}`} /> : page === 'inventory' ? <Inventory /> : <Costs />}
  </section>;
}
