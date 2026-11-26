import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { UserRound, Users, Building2, Plus, Mail, ShieldCheck, RotateCcw, Save, ArrowUpRight, Check, Leaf, Eye, Sprout, CalendarDays, Bug, Pencil, Power } from 'lucide-react';
import { useApp } from '../context';
import { api } from '../lib/api';
import { readCatalogDemo, readCatalogForFarm, saveCatalogDemo, type CropCatalog } from '../lib/catalog';
import { roleLabels } from '../lib/domain';
import { readDemo, saveDemo } from '../lib/demo';
import { loadSanitaryProblemsDemo, saveSanitaryProblemsDemo, type SanitaryProblem } from '../lib/inspections';
import type { Member, Role } from '../lib/types';
import { Badge, Modal, Notice, Panel } from '../components/ui';
import { ResourceForm } from '../components/Forms';
import RegionalCalendar from '../components/RegionalCalendar';

const initialMembers: Member[] = [
  { userId: 1, name: 'Daniel Contreras', email: 'daniel@agrovision.demo', role: 'ADMIN' },
  { userId: 2, name: 'María Rodríguez', email: 'maria@agrovision.demo', role: 'WORKER' },
  { userId: 3, name: 'Carlos Mendoza', email: 'carlos@agrovision.demo', role: 'WORKER' },
];

export default function SettingsPage({ initialTab = 'profile' }: { initialTab?: 'profile' | 'calendar' }) {
  const { mode, profile, role, data, farmId, setDemoRole, resetDemo, notify, connect, search } = useApp();
  const [tab, setTab] = useState<string>(initialTab);
  const [members, setMembers] = useState<Member[]>([]);
  const [membersLoading, setMembersLoading] = useState(false);
  const [membersError, setMembersError] = useState('');
  const [error, setError] = useState('');
  const [assign, setAssign] = useState(false);
  const [newFarm, setNewFarm] = useState(false);
  const [reset, setReset] = useState(false);
  const [busy, setBusy] = useState(false);
  const [email, setEmail] = useState('');
  const [memberRole, setMemberRole] = useState<Role>('WORKER');
  const [catalog, setCatalog] = useState<CropCatalog[]>([]);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [catalogError, setCatalogError] = useState('');
  const [catalogModal, setCatalogModal] = useState<'crop' | { cropId: number } | null>(null);
  const [sanitaryCatalog, setSanitaryCatalog] = useState<SanitaryProblem[]>([]);
  const [sanitaryLoading, setSanitaryLoading] = useState(false);
  const [sanitaryError, setSanitaryError] = useState('');
  const [problemModal, setProblemModal] = useState<'new' | SanitaryProblem | null>(null);
  const teamVisible = role === 'ADMIN' || role === 'SUPERVISOR';
  useEffect(() => {
    if (tab !== 'team' || !teamVisible) return;
    setMembersError('');
    if (mode === 'demo') { setMembers(readDemo(`members.${farmId}`, farmId === 1 ? initialMembers : [{ ...initialMembers[0], role: 'ADMIN' }])); return; }
    let active = true;
    setMembersLoading(true);
    api.members(farmId).then(result => { if (active) setMembers(result); })
      .catch(failure => { if (active) setMembersError(failure instanceof Error ? failure.message : 'No se pudo consultar el equipo de la finca.'); })
      .finally(() => { if (active) setMembersLoading(false); });
    return () => { active = false; };
  }, [tab, farmId, mode, teamVisible]);

  useEffect(() => {
    if (tab !== 'catalog') return;
    let active = true;
    setCatalogLoading(true); setCatalogError('');
    const loadingCatalog = mode === 'live' ? api.cropCatalog(farmId) : Promise.resolve(readCatalogForFarm(farmId));
    loadingCatalog.then(value => { if (active) setCatalog(value); })
      .catch(failure => { if (active) setCatalogError(failure instanceof Error ? failure.message : 'No se pudo cargar el catálogo agrícola.'); })
      .finally(() => { if (active) setCatalogLoading(false); });
    return () => { active = false; };
  }, [tab, farmId, mode]);

  useEffect(() => {
    if (tab !== 'sanitary-catalog') return;
    let active = true;
    setSanitaryLoading(true); setSanitaryError('');
    const includeInactive = role !== 'WORKER';
    const loadingCatalog = mode === 'live' ? api.sanitaryProblems(farmId, includeInactive) : Promise.resolve(loadSanitaryProblemsDemo().filter(problem => includeInactive || problem.active));
    loadingCatalog.then(value => { if (active) setSanitaryCatalog(value); })
      .catch(failure => { if (active) setSanitaryError(failure instanceof Error ? failure.message : 'No se pudo cargar el catálogo fitosanitario.'); })
      .finally(() => { if (active) setSanitaryLoading(false); });
    return () => { active = false; };
  }, [tab, farmId, mode, role]);

  async function submitCatalog(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!catalogModal) return;
    const form = new FormData(event.currentTarget);
    const code = String(form.get('code') || '').trim().toLowerCase();
    const name = String(form.get('name') || '').trim();
    setBusy(true); setError('');
    try {
      if (!code || !name) throw new Error('Completa el código y el nombre.');
      if (mode === 'live') {
        if (catalogModal === 'crop') await api.createCrop({ farmId, code, name });
        else await api.createVariety(catalogModal.cropId, { code, name });
        setCatalog(await api.cropCatalog(farmId));
        setCatalogError('');
      } else {
        const stored = readCatalogDemo();
        const next = stored.map(crop => ({ ...crop, varieties: [...crop.varieties] }));
        if (catalogModal === 'crop') {
          if (next.some(crop => crop.farmId === farmId && crop.code.toLowerCase() === code)) throw new Error('Ya existe un cultivo con ese código.');
          const id = Math.max(0, ...next.map(crop => crop.id)) + 1;
          next.push({ id, farmId, code, name, active: true, varieties: [] });
        } else {
          const crop = next.find(item => item.id === catalogModal.cropId && item.farmId === farmId);
          if (!crop) throw new Error('No se encontró el cultivo seleccionado.');
          if (crop.varieties.some(variety => variety.code.toLowerCase() === code)) throw new Error('Ya existe una variedad con ese código.');
          const id = Math.max(0, ...next.flatMap(item => item.varieties.map(variety => variety.id))) + 1;
          crop.varieties.push({ id, cropId: crop.id, code, name, active: true });
        }
        if (!saveCatalogDemo(next)) throw new Error('No se pudo guardar el catálogo en el navegador.');
        setCatalog(next.filter(crop => crop.farmId === farmId));
      }
      setCatalogModal(null); notify(mode === 'demo' ? 'Catálogo actualizado en la demostración.' : 'Catálogo actualizado en tu finca.');
    } catch (failure) { setError(failure instanceof Error ? failure.message : 'No se pudo guardar el catálogo.'); }
    finally { setBusy(false); }
  }

  async function submitSanitaryProblem(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!problemModal) return;
    const form = new FormData(event.currentTarget);
    const code = String(form.get('code') || '').trim().toUpperCase();
    const name = String(form.get('name') || '').trim();
    const category = String(form.get('category') || '') as SanitaryProblem['category'];
    setBusy(true); setError('');
    try {
      if (!name || !category || (problemModal === 'new' && !code)) throw new Error('Completa todos los campos obligatorios.');
      if (mode === 'live') {
        if (problemModal === 'new') await api.createSanitaryProblem({ farmId, code, name, category });
        else await api.updateSanitaryProblem(problemModal.code, { farmId, name, category, active: problemModal.active });
        setSanitaryCatalog(await api.sanitaryProblems(farmId, true));
        setSanitaryError('');
      } else {
        const current = loadSanitaryProblemsDemo();
        if (problemModal === 'new') {
          if (current.some(problem => problem.code === code)) throw new Error('Ya existe una plaga o enfermedad con ese código.');
          current.push({ code, name, category, active: true });
        } else {
          const index = current.findIndex(problem => problem.code === problemModal.code);
          if (index < 0) throw new Error('No se encontró el problema sanitario.');
          current[index] = { ...current[index], name, category };
        }
        if (!saveSanitaryProblemsDemo(current)) throw new Error('No se pudo guardar el catálogo en el navegador.');
        setSanitaryCatalog(current);
      }
      setProblemModal(null); notify(mode === 'demo' ? 'Catálogo fitosanitario actualizado en la demostración.' : 'Catálogo fitosanitario actualizado.');
    } catch (failure) { setError(failure instanceof Error ? failure.message : 'No se pudo guardar el catálogo fitosanitario.'); }
    finally { setBusy(false); }
  }

  async function toggleSanitaryProblem(problem: SanitaryProblem) {
    setBusy(true); setError('');
    try {
      const active = !problem.active;
      if (mode === 'live') {
        await api.updateSanitaryProblem(problem.code, { farmId, name: problem.name, category: problem.category, active });
        setSanitaryCatalog(await api.sanitaryProblems(farmId, true));
      } else {
        const next = loadSanitaryProblemsDemo().map(item => item.code === problem.code ? { ...item, active } : item);
        if (!saveSanitaryProblemsDemo(next)) throw new Error('No se pudo guardar el catálogo en el navegador.');
        setSanitaryCatalog(next);
      }
      notify(active ? 'Problema sanitario activado.' : 'Problema sanitario desactivado.');
    } catch (failure) { setError(failure instanceof Error ? failure.message : 'No se pudo actualizar el estado.'); }
    finally { setBusy(false); }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError('');
    try {
      if (mode === 'demo') {
        const normalized = email.trim().toLowerCase();
        if (normalized === profile.user.email && memberRole !== 'ADMIN') throw new Error('No puedes quitarte tu propio rol de administrador.');
        const existing = members.find(member => member.email === normalized);
        const member = { userId: existing?.userId ?? Date.now(), name: existing?.name ?? normalized.split('@')[0], email: normalized, role: memberRole };
        const next = [...members.filter(item => item.userId !== member.userId), member];
        if (!saveDemo(`members.${farmId}`, next)) throw new Error('No se pudo guardar en el navegador.');
        setMembers(next);
      } else {
        await api.assign(farmId, email.trim(), memberRole);
        setMembers(await api.members(farmId));
        setMembersError('');
      }
      setAssign(false); notify(mode === 'demo' ? 'Miembro actualizado en la demostración.' : 'Permisos de la finca actualizados.');
    } catch (failure) { setError(failure instanceof Error ? failure.message : 'No se pudo asignar.'); } finally { setBusy(false); }
  }

  return <>
    <div className="page-heading"><div><span className="eyebrow">UN ESPACIO A TU MEDIDA</span><h1>Configuración</h1><p>Tu perfil, tu finca y las personas que la hacen crecer.</p></div><Badge tone={mode === 'demo' ? 'gold' : 'green'}>{mode === 'demo' ? 'Modo demostración' : 'Conectado al API'}</Badge></div>
    <div className="tabs settings-tabs"><button className={tab === 'profile' ? 'active' : ''} onClick={() => setTab('profile')}><UserRound size={16} />Mi perfil</button><button className={tab === 'farm' ? 'active' : ''} onClick={() => setTab('farm')}><Building2 size={16} />Mi finca</button><button className={tab === 'catalog' ? 'active' : ''} onClick={() => setTab('catalog')}><Sprout size={16} />Catálogo agrícola</button><button className={tab === 'sanitary-catalog' ? 'active' : ''} onClick={() => setTab('sanitary-catalog')}><Bug size={16} />Catálogo fitosanitario</button><button className={tab === 'calendar' ? 'active' : ''} onClick={() => setTab('calendar')}><CalendarDays size={16} />Calendario regional</button>{teamVisible && <button className={tab === 'team' ? 'active' : ''} onClick={() => setTab('team')}><Users size={16} />Equipo y permisos</button>}</div>
    {error && !assign && !catalogModal && !problemModal && <div className="error-banner" role="alert">{error}</div>}
    {tab === 'profile' && <div className="settings-grid"><Panel title="Información de tu cuenta"><div className="profile-summary"><span className="avatar large-avatar">{profile.user.name.split(' ').map(part => part[0]).slice(0, 2).join('')}</span><div><h3>{profile.user.name}</h3><span>{profile.user.email}</span><Badge>{roleLabels[role]}</Badge></div></div><dl className="detail-list"><div><dt>Nombre</dt><dd>{profile.user.name}</dd></div><div><dt>Correo</dt><dd>{profile.user.email}</dd></div><div><dt>Acceso a la finca actual</dt><dd>{roleLabels[role]}</dd></div><div><dt>Zona horaria del dispositivo</dt><dd>{Intl.DateTimeFormat().resolvedOptions().timeZone}</dd></div></dl><p className="page-note">La edición del perfil y la recuperación de contraseña aún no están disponibles en el API.</p></Panel><div><Panel title="Tu sesión, protegida"><span className="stat-icon green"><ShieldCheck size={27} /></span><h3 className="insight-title">El cuidado también está en tus datos.</h3><p className="insight-description">Las sesiones reales usan cookies HTTP-only y protección CSRF. La sesión termina después de ocho horas de inactividad.</p>{mode === 'demo' && <button className="button" onClick={connect}>Conectar mi cuenta<ArrowUpRight size={16} /></button>}</Panel>{mode === 'demo' && <Panel title="Explora otros roles" className="demo-role-panel"><p className="muted">Simula la experiencia visual de cada rol. No modifica permisos del servidor.</p><div className="role-switch">{(['ADMIN', 'SUPERVISOR', 'WORKER'] as Role[]).map(value => <button className={role === value ? 'active' : ''} key={value} onClick={() => { setDemoRole(value); setTab('profile'); }}>{roleLabels[value]}</button>)}</div></Panel>}</div></div>}
    {tab === 'farm' && <div className="settings-grid"><Panel title="Información de la finca" action={<Badge>{mode === 'demo' ? 'Ejemplo' : 'Registrada'}</Badge>}>{mode === 'demo' && <div className="settings-farm-image" aria-hidden="true" />}<h2 className="settings-farm-title">{data.farms[0]?.name}</h2><dl className="detail-list"><div><dt>País</dt><dd>{data.farms[0]?.country || 'Sin registrar'}</dd></div><div><dt>Región</dt><dd>{data.farms[0]?.region || 'Sin registrar'}</dd></div><div><dt>Campos</dt><dd>{data.fields.length}</dd></div><div><dt>Bloques</dt><dd>{data.blocks.length}</dd></div><div><dt>Surcos</dt><dd>{data.rows.length}</dd></div></dl><p className="page-note">El API aún no permite editar los datos de una finca existente.</p></Panel><Panel title="Sigue creciendo"><span className="stat-icon green"><Leaf size={28} /></span><h3 className="insight-title">Cada finca, su propio espacio.</h3><p className="insight-description">Crea otra finca y administra sus campos y su equipo de forma independiente.</p><button className="button" onClick={() => setNewFarm(true)}><Plus size={16} />Crear otra finca</button></Panel></div>}
    {tab === 'catalog' && <Panel title="Cultivos y variedades" action={role !== 'WORKER' && <button className="button small" disabled={catalogLoading} onClick={() => { setCatalogModal('crop'); setError(''); }}><Plus size={16} />Nuevo cultivo</button>}><Notice>{role === 'WORKER' ? 'Consulta las opciones aprobadas para registrar bloques y ciclos.' : 'Define una vez los cultivos y variedades de esta finca para reutilizarlos en bloques, ciclos y material vegetal.'}</Notice>{catalogLoading ? <p className="muted">Cargando catálogo…</p> : catalogError ? <p className="form-error" role="alert">{catalogError}</p> : <div className="stack-list">{catalog.length === 0 ? <p className="muted">Aún no hay cultivos registrados.</p> : catalog.map(crop => <div className="list-card" key={crop.id}><span className="icon-tile green"><Sprout size={20} /></span><span><strong>{crop.name}</strong><small>{crop.code} · {crop.varieties.length} {crop.varieties.length === 1 ? 'variedad' : 'variedades'}</small></span><span className="list-card-actions">{role !== 'WORKER' && <button className="button secondary small" onClick={() => { setCatalogModal({ cropId: crop.id }); setError(''); }}><Plus size={14} />Variedad</button>}</span><div className="catalog-varieties">{crop.varieties.map(variety => <Badge key={variety.id} tone="blue">{variety.name}</Badge>)}</div></div>)}</div>}<p className="page-note">Los códigos internos se guardan en minúsculas y deben ser únicos dentro de la finca.</p></Panel>}
    {tab === 'sanitary-catalog' && <Panel title="Plagas y enfermedades" action={role !== 'WORKER' && <button className="button small" disabled={sanitaryLoading} onClick={() => { setProblemModal('new'); setError(''); }}><Plus size={16} />Nuevo problema</button>}><Notice>{role === 'WORKER' ? 'Consulta las plagas y enfermedades activas para registrar inspecciones.' : 'Administra los problemas sanitarios disponibles para las inspecciones. Desactivar conserva el historial y evita nuevos registros.'}</Notice>{sanitaryLoading ? <p className="muted">Cargando catálogo…</p> : sanitaryError ? <p className="form-error" role="alert">{sanitaryError}</p> : <div className="stack-list">{sanitaryCatalog.length === 0 ? <p className="muted">Aún no hay problemas sanitarios registrados.</p> : sanitaryCatalog.map(problem => <div className="list-card" key={problem.code}><span className={`icon-tile ${problem.category === 'PEST' ? 'orange' : 'red'}`}><Bug size={20} /></span><span><strong>{problem.name}</strong><small>{problem.code} · {problem.category === 'PEST' ? 'Plaga' : 'Enfermedad'}</small></span><span className="list-card-actions"><Badge tone={problem.active ? 'green' : 'neutral'}>{problem.active ? 'Activo' : 'Inactivo'}</Badge>{role !== 'WORKER' && <><button className="button secondary small" disabled={busy} onClick={() => { setProblemModal(problem); setError(''); }}><Pencil size={14} />Editar</button><button className="button secondary small" disabled={busy} onClick={() => void toggleSanitaryProblem(problem)}><Power size={14} />{problem.active ? 'Desactivar' : 'Activar'}</button></>}</span></div>)}</div>}<p className="page-note">Los códigos no se cambian después de crear un problema porque identifican las inspecciones históricas.</p></Panel>}
    {tab === 'calendar' && <RegionalCalendar />}
    {tab === 'team' && teamVisible && <Panel title="Las personas de tu finca" action={role === 'ADMIN' && <button className="button small" disabled={membersLoading} onClick={() => { setEmail(''); setMemberRole('WORKER'); setAssign(true); setError(''); }}><Plus size={16} />Asignar miembro</button>}>{membersLoading ? <p className="muted">Cargando equipo…</p> : membersError ? <p className="form-error" role="alert">{membersError}</p> : <div className="table-wrap"><table><thead><tr><th>Persona</th><th>Correo electrónico</th><th>Rol en esta finca</th><th>Acciones</th></tr></thead><tbody>{members.filter(member => `${member.name} ${member.email}`.toLocaleLowerCase('es').includes(search.toLocaleLowerCase('es'))).map(member => <tr key={member.userId}><td><span className="table-title"><span className="avatar small-avatar">{member.name.split(' ').map(part => part[0]).slice(0, 2).join('')}</span>{member.name}</span></td><td>{member.email}</td><td><Badge tone={member.role === 'ADMIN' ? 'green' : member.role === 'SUPERVISOR' ? 'blue' : member.role === 'AGRONOMIST' ? 'purple' : 'neutral'}>{roleLabels[member.role]}</Badge></td><td>{role === 'ADMIN' && <button className="text-button" onClick={() => { setEmail(member.email); setMemberRole(member.role); setAssign(true); setError(''); }}>Cambiar rol</button>}</td></tr>)}</tbody></table></div>}<p className="page-note">{mode === 'demo' ? 'Equipo ilustrativo guardado localmente.' : 'La persona debe registrar su cuenta antes de recibir acceso.'} La eliminación de membresías aún no está implementada.</p></Panel>}
    {mode === 'demo' && <div className="reset-demo"><div><strong>¿Empezamos de nuevo?</strong><p>Restablece los campos, eventos y tareas de ejemplo.</p></div><button className="button secondary small" onClick={() => setReset(true)}><RotateCcw size={15} />Restablecer demostración</button></div>}
    {newFarm && <ResourceForm resource="farms" onClose={() => setNewFarm(false)} />}
    {catalogModal && <Modal title={catalogModal === 'crop' ? 'Nuevo cultivo' : 'Nueva variedad'} onClose={() => !busy && setCatalogModal(null)}><form className="form-stack" onSubmit={submitCatalog}><Notice>{catalogModal === 'crop' ? 'El cultivo quedará disponible para toda la finca.' : `La variedad se agregará a ${catalog.find(crop => crop.id === catalogModal.cropId)?.name ?? 'el cultivo seleccionado'}.`}</Notice><label>Código interno<input name="code" required maxLength={100} placeholder={catalogModal === 'crop' ? 'Ej. cacao' : 'Ej. CCN-51'} /></label><label>Nombre visible<input name="name" required maxLength={150} placeholder={catalogModal === 'crop' ? 'Ej. Cacao' : 'Ej. CCN-51'}/></label>{error && <p className="form-error" role="alert">{error}</p>}<div className="form-actions"><button type="button" className="button secondary" disabled={busy} onClick={() => setCatalogModal(null)}>Cancelar</button><button className="button" disabled={busy}>{busy ? 'Guardando…' : 'Guardar'}</button></div></form></Modal>}
    {problemModal && <Modal title={problemModal === 'new' ? 'Nuevo problema sanitario' : 'Editar problema sanitario'} onClose={() => !busy && setProblemModal(null)}><form className="form-stack" onSubmit={submitSanitaryProblem}><Notice>{problemModal === 'new' ? 'El problema quedará disponible para las nuevas inspecciones.' : 'El código se conserva para no romper las referencias históricas.'}</Notice>{problemModal === 'new' ? <label>Código interno<input name="code" required maxLength={40} pattern="[A-Za-z0-9_-]+" placeholder="Ej. TRIPS" /></label> : <label>Código interno<input name="code" value={problemModal.code} disabled /></label>}<label>Nombre visible<input name="name" required maxLength={120} defaultValue={problemModal === 'new' ? '' : problemModal.name} placeholder="Ej. Trips" /></label><label>Tipo<select name="category" defaultValue={problemModal === 'new' ? 'PEST' : problemModal.category}><option value="PEST">Plaga</option><option value="DISEASE">Enfermedad</option></select></label>{error && <p className="form-error" role="alert">{error}</p>}<div className="form-actions"><button type="button" className="button secondary" disabled={busy} onClick={() => setProblemModal(null)}>Cancelar</button><button className="button" disabled={busy}>{busy ? 'Guardando…' : 'Guardar'}</button></div></form></Modal>}
    {assign && <Modal title="Asignar acceso a la finca" onClose={() => !busy && setAssign(false)}><form className="form-stack" onSubmit={submit}><Notice>{mode === 'demo' ? 'Este cambio es una simulación local del equipo de trabajo.' : 'Agrega una cuenta ya registrada. El rol se aplica solo a esta finca.'}</Notice><label>Correo electrónico<input type="email" required value={email} onChange={event => setEmail(event.target.value)} placeholder="persona@correo.com" /></label><label>Rol<select value={memberRole} onChange={event => setMemberRole(event.target.value as Role)}>{Object.entries(roleLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><p className="muted">Trabajador: consulta y registros. Agrónomo: configuración y aprobación técnica. Supervisor: manejo del cultivo. Administrador: equipo, permisos y finca.</p>{error && <p className="form-error" role="alert">{error}</p>}<div className="form-actions"><button type="button" className="button secondary" disabled={busy} onClick={() => setAssign(false)}>Cancelar</button><button className="button" disabled={busy}><Check size={16} />{busy ? 'Guardando…' : 'Guardar acceso'}</button></div></form></Modal>}
    {reset && <Modal title="Restablecer demostración" onClose={() => setReset(false)}><div className="form-stack"><p>Se reemplazarán los campos, bloques, surcos, eventos y tareas locales por los datos iniciales. Los datos reales del servidor no se modifican.</p><div className="form-actions"><button className="button secondary" onClick={() => setReset(false)}>Cancelar</button><button className="button" onClick={() => { resetDemo(); setReset(false); }}>Restablecer</button></div></div></Modal>}
  </>;
}
