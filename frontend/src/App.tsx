import { useCallback, useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { LayoutDashboard, Map, Sprout, Droplets, FlaskConical, Bug, Wheat, FileChartColumn, Sparkles, Settings, ListTodo, Leaf, Search, Bell, ChevronDown, LogOut, Menu, X, ArrowRight, CalendarDays, RefreshCw, CheckCircle2, AlertCircle, LoaderCircle, ArrowUpRight, CloudSun } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { AppContext } from './context';
import { api } from './lib/api';
import { demoData, demoProfile, demoTasks, readDemo, saveDemo } from './lib/demo';
import { localDate, roleLabels, scopeFarm, transitionTask } from './lib/domain';
import type { FarmData, Mode, Page, Profile, Role, Task } from './lib/types';
import { Empty, Logo, Loading, Panel } from './components/ui';
import Dashboard from './pages/Dashboard';
import Maps from './pages/Maps';
import Tasks from './pages/Tasks';
import Records from './pages/Records';
import Operations from './pages/Operations';
import Planting from './pages/Planting';
import SettingsPage from './pages/Settings';
import { ResourceForm } from './components/Forms';
import { demoInspections, inspectionDemoKey, saveSanitaryProblemsDemo, sanitaryProblems } from './lib/inspections';
import { demoFertilization, fertilizationKey, readFertilizationDemo } from './lib/fertilization';
import { demoIrrigation, irrigationKey, readIrrigationDemo } from './lib/irrigation';
import { plantingKey, demoPlanting } from './lib/planting';
import { productionKey, demoProduction } from './lib/production';
import { catalogKey, demoCatalog, readCatalogDemo, saveCatalogDemo } from './lib/catalog';
import { calendarKey, demoCalendars, readCalendarsDemo, saveCalendarsDemo } from './lib/calendar';
import { clearDemoPhotos, deleteDemoEventPhotos } from './lib/photos';

const navigation: { id: Page; label: string; icon: LucideIcon; group?: string }[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, group: 'MI FINCA' },
  { id: 'tasks', label: 'Mi trabajo de hoy', icon: ListTodo },
  { id: 'fields', label: 'Campos', icon: Leaf },
  { id: 'maps', label: 'Mapas', icon: Map },
  { id: 'plants', label: 'Plantas', icon: Sprout },
  { id: 'planting', label: 'Siembra', icon: Sprout, group: 'ESTABLECIMIENTO' },
  { id: 'irrigation', label: 'Riego', icon: Droplets, group: 'MANEJO DEL CULTIVO' },
  { id: 'fertilization', label: 'Fertilización', icon: FlaskConical },
  { id: 'disease', label: 'Plagas y Enfermedades', icon: Bug },
  { id: 'harvest', label: 'Cosecha', icon: Wheat },
  { id: 'reports', label: 'Reportes', icon: FileChartColumn, group: 'HERRAMIENTAS' },
  { id: 'insights', label: 'IA y Recomendaciones', icon: Sparkles },
  { id: 'settings', label: 'Configuración', icon: Settings },
];
const cropManagementPages: Page[] = ['plants', 'planting', 'irrigation', 'fertilization', 'disease', 'harvest', 'reports', 'insights', 'settings'];
const empty: FarmData = { farms: [], fields: [], blocks: [], rows: [], events: [] };
const pageFromHash = () => { const page = window.location.hash.slice(1) as Page; return navigation.some(item => item.id === page) ? page : 'dashboard'; };
const formatTopbarDate = (value: string) => { const [year, month, day] = value.split('-'); const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']; return `${Number(day)} ${monthNames[Number(month) - 1] ?? ''} ${year}`; };

export default function App() {
  const [mode, setMode] = useState<Mode>('demo');
  const [profile, setProfile] = useState<Profile>(demoProfile);
  const [allData, setAllData] = useState<FarmData>(() => readDemo('data', demoData));
  const [tasks, setTasks] = useState<Task[]>(() => readDemo('tasks', demoTasks));
  const [liveTasks, setLiveTasks] = useState<Task[]>([]);
  const [farmId, setFarmId] = useState(1);
  const [fieldContextId, setFieldContextId] = useState(0);
  const [mapFieldId, setMapFieldId] = useState(0);
  const [mapBlockId, setMapBlockId] = useState(0);
  const [page, setPage] = useState<Page>(pageFromHash);
  const [date, setDate] = useState(localDate());
  const [search, setSearch] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const [newFarm, setNewFarm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [toast, setToast] = useState<{ message: string; error: boolean } | null>(null);
  const [notifications, setNotifications] = useState(false);
  const [demoRole, setDemoRole] = useState<Role>('ADMIN');

  const notify = useCallback((message: string, isError = false) => setToast({ message, error: isError }), []);
  const navigate = useCallback((next: Page) => { window.location.hash = next; setPage(next); setMenuOpen(false); setSearch(''); }, []);
  const data = useMemo(() => scopeFarm(allData, farmId), [allData, farmId]);
  const role = mode === 'demo' ? demoRole : profile.memberships.find(membership => membership.farmId === farmId)?.role ?? 'WORKER';

  const loadLive = useCallback(async (nextProfile?: Profile, quiet = false) => {
    if (!quiet) setLoading(true); setError('');
    try {
      const current = nextProfile ?? await api.me();
      setProfile(current);
      const [farms, fields, blocks, rows, events, savedTasks] = await Promise.all([api.farms(), api.fields(), api.blocks(), api.rows(), api.events(), api.tasks()]);
      setLiveTasks(savedTasks);
      setProfile(current); setAllData({ farms, fields, blocks, rows, events });
      setFarmId(previous => farms.some(farm => farm.id === previous) ? previous : farms[0]?.id ?? 0);
      return current;
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'No se pudo cargar la finca.');
      throw failure;
    } finally { if (!quiet) setLoading(false); }
  }, []);

  useEffect(() => { const listener = () => setPage(pageFromHash()); window.addEventListener('hashchange', listener); return () => window.removeEventListener('hashchange', listener); }, []);
  useEffect(() => { if (toast) { const timeout = window.setTimeout(() => setToast(null), 5000); return () => clearTimeout(timeout); } }, [toast]);
  useEffect(() => { if (mode === 'demo' && !saveDemo('data', allData)) notify('El navegador no permite guardar la demostración.', true); }, [allData, mode, notify]);
  useEffect(() => { if (!saveDemo('tasks', tasks)) notify('No se pudieron guardar las tareas locales.', true); }, [tasks, notify]);
  useEffect(() => {
    if (page !== 'maps') return;
    setMapFieldId(previous => data.fields.some(field => field.id === previous) ? previous : data.fields[0]?.id ?? 0);
    setMapBlockId(previous => data.blocks.some(block => block.id === previous) ? previous : data.blocks[1]?.id ?? data.blocks[0]?.id ?? 0);
  }, [page, data.fields, data.blocks]);
  useEffect(() => {
    if (page !== 'fields' || (fieldContextId && data.fields.some(field => field.id === fieldContextId))) return;
    setFieldContextId(0);
  }, [page, fieldContextId, data.fields]);
  useEffect(() => {
    if (sessionStorage.getItem('agrovision.live') === 'true') {
      setMode('live'); setAllData(empty);
      void loadLive().catch(() => { setAuthOpen(true); });
    }
  }, [loadLive]);

  async function create(resource: string, payload: Record<string, unknown>) {
    if (mode === 'live') {
      const saved = await api.create<{ id: number }>(resource, payload);
      try { await loadLive(); }
      catch { throw new Error('El registro se guardó, pero no se pudo actualizar la vista. Cierra este formulario y pulsa Actualizar; no repitas la creación.'); }
      return saved.id;
    }
    const collection = resource as keyof FarmData;
    const id = Math.max(0, ...allData[collection].map(item => item.id)) + 1;
    let record: Record<string, unknown> = { ...payload, id };
    if (resource === 'fields') record.farm = allData.farms.find(farm => farm.id === Number(payload.farmId));
    if (resource === 'blocks') record.field = allData.fields.find(field => field.id === Number(payload.fieldId));
    if (resource === 'rows') record.block = allData.blocks.find(block => block.id === Number(payload.blockId));
    if (resource === 'events') record = { ...record, block: allData.blocks.find(block => block.id === Number(payload.blockId)), row: allData.rows.find(row => row.id === Number(payload.rowId)), createdByUserId: profile.user.id };
    setAllData(previous => ({ ...previous, [collection]: [...previous[collection], record] }));
    if (resource === 'farms') {
      setProfile(previous => ({ ...previous, memberships: [...previous.memberships, { farmId: id, farmName: String(payload.name), role: 'ADMIN' }] }));
      setFarmId(id);
      const template = demoCatalog()[0];
      const storedCatalog = readCatalogDemo();
      const cropId = Math.max(0, ...storedCatalog.map(crop => crop.id)) + 1;
      const varietyId = Math.max(0, ...storedCatalog.flatMap(crop => crop.varieties.map(variety => variety.id))) + 1;
      saveCatalogDemo([...storedCatalog, { ...template, id: cropId, farmId: id, varieties: template.varieties.map(variety => ({ ...variety, id: varietyId, cropId })) }]);
      const storedCalendars = readCalendarsDemo();
      const calendarTemplate = demoCalendars()[0];
      saveCalendarsDemo([...storedCalendars, { ...calendarTemplate, id: Math.max(0, ...storedCalendars.map(rule => rule.id)) + 1, farmId: id, region: String(payload.region || calendarTemplate.region), cropId, varietyId, crop: template.name, variety: template.varieties[0].name }]);
    }
    return id;
  }

  async function remove(resource: string, id: number) {
    if (mode === 'demo' && resource === 'events' && readIrrigationDemo().executions.some(execution => execution.eventId === id)) {
      throw new Error('Esta ejecución está vinculada a una programación de riego y no se puede eliminar desde el historial.');
    }
    if (mode === 'demo' && resource === 'events' && readFertilizationDemo().applications.some(application => application.eventId === id)) {
      throw new Error('La aplicación pertenece a un plan aprobado y conserva su trazabilidad; no se puede eliminar desde el historial.');
    }
    if (mode === 'live') {
      await api.remove(resource, id);
      try { await loadLive(); }
      catch { throw new Error('El registro se eliminó, pero no se pudo actualizar la vista. Pulsa Actualizar para consultar el estado actual.'); }
      return;
    }
    const deletedEventIds = allData.events.filter(event => {
      const block = event.block ?? event.row?.block;
      return resource === 'events' ? event.id === id : resource === 'rows' ? event.row?.id === id
        : resource === 'blocks' ? block?.id === id : resource === 'fields' ? block?.field.id === id
          : resource === 'farms' && block?.field.farm.id === id;
    }).map(event => event.id);
    await deleteDemoEventPhotos(deletedEventIds);
    setAllData(previous => {
      const fieldIds = previous.fields.filter(field => resource === 'farms' ? field.farm.id === id : resource === 'fields' && field.id === id).map(field => field.id);
      const blockIds = previous.blocks.filter(block => fieldIds.includes(block.field.id) || (resource === 'blocks' && block.id === id)).map(block => block.id);
      const rowIds = previous.rows.filter(row => blockIds.includes(row.block.id) || (resource === 'rows' && row.id === id)).map(row => row.id);
      return {
        farms: previous.farms.filter(farm => resource !== 'farms' || farm.id !== id),
        fields: previous.fields.filter(field => !fieldIds.includes(field.id)),
        blocks: previous.blocks.filter(block => !blockIds.includes(block.id)),
        rows: previous.rows.filter(row => !rowIds.includes(row.id)),
        events: previous.events.filter(event => !(resource === 'events' && event.id === id) && !blockIds.includes(event.block?.id ?? event.row?.block.id ?? -1) && !rowIds.includes(event.row?.id ?? -1)),
      };
    });
  }

  async function resetDemo() {
    try { await clearDemoPhotos(); } catch (failure) { notify(failure instanceof Error ? failure.message : 'No se pudieron restablecer las fotos.', true); return; }
    if (!saveDemo(inspectionDemoKey, demoInspections())) { notify('No se pudieron restablecer las inspecciones.', true); return; }
    if (!saveSanitaryProblemsDemo(sanitaryProblems)) { notify('No se pudo restablecer el catálogo fitosanitario.', true); return; }
    if (!saveDemo(fertilizationKey, demoFertilization())) { notify('No se pudo restablecer la fertilización.', true); return; }
    if (!saveDemo(irrigationKey, demoIrrigation())) { notify('No se pudo restablecer el riego.', true); return; }
    if (!saveDemo(plantingKey, demoPlanting())) { notify('No se pudo restablecer siembra y ciclos.', true); return; }
    if (!saveDemo(productionKey, demoProduction())) { notify('No se pudieron restablecer los registros de producción.', true); return; }
    if (!saveDemo(catalogKey, demoCatalog())) { notify('No se pudo restablecer el catálogo agrícola.', true); return; }
    if (!saveDemo(calendarKey, demoCalendars())) { notify('No se pudo restablecer el calendario regional.', true); return; }
    setAllData(demoData); setTasks(demoTasks); setProfile(demoProfile); setFarmId(1); setDemoRole('ADMIN'); notify('Demostración restablecida.');
  }

  async function authenticated(nextProfile: Profile) {
    setMode('live'); setProfile(nextProfile); setAllData(empty); setAuthOpen(false); sessionStorage.setItem('agrovision.live', 'true');
    try { await loadLive(nextProfile); notify(`Bienvenido, ${nextProfile.user.name.split(' ')[0]}.`); } catch {}
  }

  async function logout() {
    if (mode === 'live') {
      try { await api.logout(); } catch (failure) { notify(failure instanceof Error ? failure.message : 'No se pudo cerrar sesión.', true); return; }
    }
    sessionStorage.removeItem('agrovision.live'); setMode('demo'); setProfile(demoProfile); setAllData(readDemo('data', demoData)); setFarmId(1); setAuthOpen(true);
  }

  async function createTask(payload: Record<string, unknown>) {
    if (mode === 'live') {
      const saved = await api.create<Task>('tasks', payload);
      setLiveTasks(previous => [...previous, saved]);
    } else {
      setTasks(previous => [...previous, { ...payload, id: crypto.randomUUID(), status: 'pending' } as unknown as Task]);
    }
  }

  async function updateTask(task: Task, status: Task['status'], notes: string) {
    const saved = mode === 'live' ? await api.updateTask(task, status, notes) : transitionTask(task, status, notes);
    const update = (previous: Task[]) => previous.map(item => item.id === saved.id ? saved : item);
    if (mode === 'live') setLiveTasks(update); else setTasks(update);
    return saved;
  }

  const visibleTasks = mode === 'live' ? liveTasks.filter(task => task.farmId === farmId) : tasks;
  const context = { mode, profile, data, allData, farmId, role, tasks: visibleTasks, date, search, loading, fieldContextId, setDate, setFarmId, setFieldContextId, navigate, notify, setTasks, createTask, updateTask, create, remove, refresh: async (quiet = false) => { if (mode === 'live') await loadLive(undefined, quiet); }, connect: () => setAuthOpen(true), setDemoRole, resetDemo };
  const currentFarm = allData.farms.find(farm => farm.id === farmId);
  const pageLabel = navigation.find(item => item.id === page)?.label;
  const initials = profile.user.name.split(' ').map(part => part[0]).slice(0, 2).join('');

  return <AppContext.Provider value={context}>
    {authOpen ? <AuthScreen onAuthenticated={authenticated} onDemo={() => { sessionStorage.removeItem('agrovision.live'); setMode('demo'); setProfile(demoProfile); setAllData(readDemo('data', demoData)); setFarmId(1); setAuthOpen(false); setError(''); }} /> : <div className={`app-shell ${page === 'dashboard' ? 'dashboard-app-shell' : ''} ${page === 'maps' ? 'maps-app-shell' : ''} ${page === 'fields' ? 'fields-app-shell' : ''} ${cropManagementPages.includes(page) ? 'crop-app-shell' : ''}`}>
      {menuOpen && <div className="sidebar-scrim" onClick={() => setMenuOpen(false)} />}
      <aside className={`sidebar ${menuOpen ? 'sidebar-open' : ''}`}><div className="sidebar-top"><Logo /><button className="icon-button mobile-only" aria-label="Cerrar menú" onClick={() => setMenuOpen(false)}><X size={20} /></button></div>
        <nav aria-label="Navegación principal">{navigation.map(item => <div key={item.id}>{item.group && <span className="nav-group">{item.group}</span>}<button className={`nav-item ${page === item.id ? 'active' : ''}`} onClick={() => navigate(item.id)} aria-current={page === item.id ? 'page' : undefined}><item.icon size={19} strokeWidth={1.7} /><span>{item.label}</span>{item.id === 'tasks' && mode === 'demo' && <span className="nav-count">{tasks.filter(task => !['completed', 'review'].includes(task.status)).length}</span>}</button></div>)}</nav>
        <div className="sidebar-bottom"><div className="sidebar-message"><Sprout size={29} /><p>El campo también<br /><strong>innova.</strong></p><span>Decisiones que hacen crecer.</span></div><div className="sidebar-user"><span className="avatar">{initials}</span><div><strong>{profile.user.name}</strong><small>{roleLabels[role]}</small></div></div><button className="logout" onClick={() => void logout()}><LogOut size={17} />{mode === 'demo' ? 'Salir de demostración' : 'Cerrar sesión'}</button></div>
      </aside>
      <div className="workspace"><header className="topbar"><button className="icon-button mobile-only" aria-label="Abrir menú" onClick={() => setMenuOpen(true)}><Menu /></button><div className="global-search"><Search size={18} /><input aria-label="Buscar en la vista actual" placeholder={page === 'maps' || page === 'fields' ? 'Buscar campo, bloque, fila o planta…' : 'Buscar campo, bloque, planta o tarea…'} value={search} onChange={event => setSearch(event.target.value)} /><kbd>⌕</kbd></div><div className="topbar-filters"><div className="farm-picker"><Leaf size={16} /><select aria-label="Seleccionar finca" value={farmId} onChange={event => setFarmId(Number(event.target.value))}>{!allData.farms.length && <option value="0">Sin finca asignada</option>}{allData.farms.map(farm => <option key={farm.id} value={farm.id}>{farm.name}</option>)}</select><ChevronDown size={14} /></div>{page === 'maps' && <><div className="map-context-picker"><select aria-label="Seleccionar campo" value={mapFieldId} onChange={event => setMapFieldId(Number(event.target.value))}>{data.fields.map((field, index) => <option key={field.id} value={field.id}>{demoRole && mode === 'demo' ? `Campo ${String.fromCharCode(65 + index)}` : field.name}</option>)}</select><ChevronDown size={14} /></div><div className="map-context-picker map-block-picker"><select aria-label="Seleccionar bloque" value={mapBlockId} onChange={event => setMapBlockId(Number(event.target.value))}>{data.blocks.map(block => <option key={block.id} value={block.id}>{block.code}</option>)}</select><ChevronDown size={14} /></div></>}{page === 'fields' && <div className="map-context-picker fields-context-picker"><select aria-label="Filtrar campos" value={fieldContextId} onChange={event => setFieldContextId(Number(event.target.value))}><option value={0}>Todos los campos</option>{data.fields.map((field, index) => <option key={field.id} value={field.id}>{demoRole && mode === 'demo' ? `Campo ${String.fromCharCode(65 + index)}` : field.name}</option>)}</select><ChevronDown size={14} /></div>}<label className="date-picker"><CalendarDays size={16} /><span className="date-picker-value">{formatTopbarDate(date)}</span><ChevronDown size={14} /><input type="date" aria-label="Fecha de trabajo" value={date} onChange={event => { if (event.target.value) setDate(event.target.value); }} /></label></div><div className="topbar-end">{mode === 'demo' && <div className="topbar-weather"><CloudSun size={31} strokeWidth={1.7} /><div><strong>24°C</strong><small>Parcialmente nublado</small></div></div>}<button className="notification-button icon-button" aria-label="Ver notificaciones" aria-expanded={notifications} onClick={() => setNotifications(value => !value)}><Bell size={21} />{mode === 'demo' && <i>7</i>}</button><button className="avatar profile-button" onClick={() => navigate('settings')} aria-label="Abrir configuración de perfil">{initials}</button></div></header>
      {notifications && <div className="notification-popover"><div><strong>Notificaciones</strong><button className="icon-button" aria-label="Cerrar notificaciones" onClick={() => setNotifications(false)}><X size={16} /></button></div><p>{mode === 'demo' ? 'Tienes una tarea bloqueada pendiente de seguimiento.' : 'Las notificaciones automáticas estarán disponibles en una próxima versión.'}</p>{mode === 'demo' && <button className="text-button" onClick={() => { navigate('tasks'); setNotifications(false); }}>Ver mi trabajo <ArrowRight size={14} /></button>}</div>}
      <div className={`environment-bar ${mode === 'live' ? 'live' : ''} ${page === 'dashboard' ? 'dashboard-environment' : ''} ${page === 'maps' ? 'maps-environment' : ''}`}><span><i />{mode === 'demo' ? 'Espacio de demostración' : 'Conectado a tu finca'}<span className="environment-description">{mode === 'demo' ? 'Explora AgroVision con datos de ejemplo. Los cambios son locales.' : 'Los registros agrícolas se guardan en el servidor.'}</span></span>{mode === 'demo' ? <button onClick={() => setAuthOpen(true)}>Conectar mi finca<ArrowUpRight size={13} /></button> : <button onClick={() => void loadLive().catch(() => {})} disabled={loading}><RefreshCw size={13} />Actualizar</button>}</div>
      <main id="main-content" className={page === 'dashboard' ? 'dashboard-main' : page === 'maps' ? 'maps-main' : ''}><div className="mobile-context"><label><Leaf size={14} /><select aria-label="Finca en móvil" value={farmId} onChange={event => setFarmId(Number(event.target.value))}>{!allData.farms.length && <option value="0">Sin finca</option>}{allData.farms.map(farm => <option key={farm.id} value={farm.id}>{farm.name}</option>)}</select></label><label><CalendarDays size={14} /><input type="date" aria-label="Fecha de trabajo en móvil" value={date} onChange={event => { if (event.target.value) setDate(event.target.value); }} /></label></div><div className="breadcrumbs"><span>{currentFarm?.name ?? 'AgroVision'}</span><span>/</span><strong>{pageLabel}</strong></div>
        {error && <div className="error-banner" role="alert"><AlertCircle size={19} /><div><strong>No se pudieron cargar todos los datos</strong><p>{error}</p></div><button className="button secondary" onClick={() => void loadLive().catch(() => {})}>Reintentar</button></div>}
        {loading ? <Loading /> : mode === 'live' && error ? <Panel><Empty title="Reconectemos con tu finca" description="No podemos confirmar tus datos en este momento. Reintenta la carga o inicia sesión de nuevo para continuar." action={<button className="button secondary" onClick={() => setAuthOpen(true)}>Iniciar sesión de nuevo<ArrowRight size={16} /></button>} /></Panel> : mode === 'live' && !allData.farms.length ? <div className="onboarding panel"><Sprout size={44} /><span className="eyebrow">BIENVENIDO A AGROVISION</span><h1>Tu próxima cosecha empieza aquí.</h1><p>Crea tu primera finca o pide a su administrador que te asigne acceso con tu correo: <strong>{profile.user.email}</strong>.</p><button className="button" onClick={() => setNewFarm(true)}>Crear mi primera finca<ArrowRight size={17} /></button></div> : <>{page === 'dashboard' && <Dashboard />}{page === 'maps' && <Maps />}{page === 'tasks' && <Tasks />}{(page === 'fields' || page === 'plants') && <Records page={page} />}{page === 'planting' && <Planting />}{['irrigation', 'fertilization', 'disease', 'harvest', 'reports', 'insights'].includes(page) && <Operations page={page} />}{page === 'settings' && <SettingsPage />}</>}
        <footer className="footer"><span><Sprout size={13} />AgroVision <span>·</span> Cultivos con futuro</span><span>{mode === 'demo' ? 'Datos ilustrativos, decisiones con propósito.' : 'Tu finca, conectada.'}</span></footer>
      </main></div>
    </div>}
    {newFarm && <ResourceForm resource="farms" onClose={() => setNewFarm(false)} />}
    {toast && <div className={`toast ${toast.error ? 'toast-error' : ''}`} role="status">{toast.error ? <AlertCircle size={20} /> : <CheckCircle2 size={20} />}<span>{toast.message}</span><button aria-label="Cerrar aviso" onClick={() => setToast(null)}><X size={16} /></button></div>}
  </AppContext.Provider>;
}

function AuthScreen({ onAuthenticated, onDemo }: { onAuthenticated: (profile: Profile) => Promise<void>; onDemo: () => void }) {
  const [register, setRegister] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = new FormData(event.currentTarget); setBusy(true); setError(''); setSuccess('');
    try {
      if (register) { await api.register(String(form.get('name')).trim(), String(form.get('email')).trim(), String(form.get('password'))); setRegister(false); setSuccess('Cuenta creada. Ya puedes iniciar sesión con tus credenciales.'); }
      else { const profile = await api.login(String(form.get('email')).trim(), String(form.get('password'))); await onAuthenticated(profile); }
    } catch (failure) { setError(failure instanceof Error ? failure.message : 'No se pudo conectar.'); }
    finally { setBusy(false); }
  }
  return <div className="auth-layout"><div className="auth-visual"><Logo /><div><span className="auth-kicker">CULTIVAR ES MIRAR HACIA ADELANTE</span><h1>Más cerca de tu campo.<br /><em>Más lejos, juntos.</em></h1><p>Conoce tu finca, acompaña a tu equipo y dale a cada cultivo el cuidado que merece.</p><span className="auth-caption"><Leaf size={17} />Tecnología que crece contigo</span></div><small>Imagen ilustrativa de una finca tropical.</small></div><div className="auth-form-wrap"><div className="auth-form"><Logo /><span className="eyebrow">BIENVENIDO A TU FINCA DIGITAL</span><h2>{register ? 'Cultivemos algo nuevo.' : 'Qué bueno verte de nuevo.'}</h2><p>{register ? 'Crea tu cuenta y empieza a organizar tu finca.' : 'Ingresa a tu cuenta para continuar.'}</p><form className="form-stack" onSubmit={submit}>{register && <label>Tu nombre<input name="name" autoComplete="name" required maxLength={150} /></label>}<label>Correo electrónico<input name="email" type="email" autoComplete="email" required maxLength={254} placeholder="tu@correo.com" /></label><label>Contraseña<input name="password" type="password" required minLength={register ? 12 : 1} maxLength={64} autoComplete={register ? 'new-password' : 'current-password'} placeholder={register ? 'Mínimo 12 caracteres' : 'Tu contraseña'} />{register && <small>Entre 12 y 64 caracteres, máximo 72 bytes UTF-8.</small>}</label>{error && <p role="alert" className="form-error">{error}</p>}{success && <p role="status" className="form-success">{success}</p>}<button disabled={busy} className="button auth-submit">{busy ? <LoaderCircle size={17} className="spin" /> : register ? 'Crear mi cuenta' : 'Iniciar sesión'}{!busy && <ArrowRight size={18} />}</button></form><p className="auth-switch">{register ? '¿Ya tienes una cuenta?' : '¿Primera vez por aquí?'} <button onClick={() => { setRegister(value => !value); setError(''); setSuccess(''); }}>{register ? 'Inicia sesión' : 'Crea tu cuenta'}</button></p><div className="auth-divider"><span>o conoce AgroVision</span></div><button className="button secondary full-width" onClick={onDemo}>Explorar demostración<ArrowUpRight size={17} /></button><small className="auth-footnote">Tu información está protegida con una sesión segura.<br />La recuperación de contraseña aún no está disponible.</small></div></div></div>;
}
