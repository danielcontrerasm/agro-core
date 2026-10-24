import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { UserRound, Users, Building2, Plus, Mail, ShieldCheck, RotateCcw, Save, ArrowUpRight, Check, Leaf, Eye, Sprout, CalendarDays } from 'lucide-react';
import { useApp } from '../context';
import { api } from '../lib/api';
import { readCatalogDemo, readCatalogForFarm, saveCatalogDemo, type CropCatalog } from '../lib/catalog';
import { roleLabels } from '../lib/domain';
import { readDemo, saveDemo } from '../lib/demo';
import type { Member, Role } from '../lib/types';
import { Badge, Modal, Notice, Panel } from '../components/ui';
import { ResourceForm } from '../components/Forms';
import RegionalCalendar from '../components/RegionalCalendar';

const initialMembers: Member[] = [
  { userId: 1, name: 'Daniel Contreras', email: 'daniel@agrovision.demo', role: 'ADMIN' },
  { userId: 2, name: 'María Rodríguez', email: 'maria@agrovision.demo', role: 'WORKER' },
  { userId: 3, name: 'Carlos Mendoza', email: 'carlos@agrovision.demo', role: 'WORKER' },
];

export default function SettingsPage() {
  const { mode, profile, role, data, farmId, setDemoRole, resetDemo, notify, connect, search } = useApp();
  const [tab, setTab] = useState('profile');
  const [members, setMembers] = useState<Member[]>([]);
  const [error, setError] = useState('');
  const [assign, setAssign] = useState(false);
  const [newFarm, setNewFarm] = useState(false);
  const [reset, setReset] = useState(false);
  const [busy, setBusy] = useState(false);
  const [email, setEmail] = useState('');
  const [memberRole, setMemberRole] = useState<Role>('WORKER');
  const [catalog, setCatalog] = useState<CropCatalog[]>([]);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [catalogModal, setCatalogModal] = useState<'crop' | { cropId: number } | null>(null);
  const teamVisible = role === 'ADMIN' || role === 'SUPERVISOR';
  useEffect(() => {
    setError('');
    if (mode === 'demo') { setMembers(readDemo(`members.${farmId}`, farmId === 1 ? initialMembers : [{ ...initialMembers[0], role: 'ADMIN' }])); return; }
    if (!teamVisible) { setMembers([]); return; }
    let active = true;
    api.members(farmId).then(result => { if (active) setMembers(result); }).catch(failure => { if (active) setError(failure.message); });
    return () => { active = false; };
  }, [farmId, mode, role, teamVisible]);

  useEffect(() => {
    if (tab !== 'catalog') return;
    let active = true;
    setCatalogLoading(true); setError('');
    const loadingCatalog = mode === 'live' ? api.cropCatalog(farmId) : Promise.resolve(readCatalogForFarm(farmId));
    loadingCatalog.then(value => { if (active) setCatalog(value); })
      .catch(failure => { if (active) setError(failure instanceof Error ? failure.message : 'No se pudo cargar el catálogo agrícola.'); })
      .finally(() => { if (active) setCatalogLoading(false); });
    return () => { active = false; };
  }, [tab, farmId, mode]);

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
      } else { await api.assign(farmId, email.trim(), memberRole); setMembers(await api.members(farmId)); }
      setAssign(false); notify(mode === 'demo' ? 'Miembro actualizado en la demostración.' : 'Permisos de la finca actualizados.');
    } catch (failure) { setError(failure instanceof Error ? failure.message : 'No se pudo asignar.'); } finally { setBusy(false); }
  }

  return <>
    <div className="page-heading"><div><span className="eyebrow">UN ESPACIO A TU MEDIDA</span><h1>Configuración</h1><p>Tu perfil, tu finca y las personas que la hacen crecer.</p></div><Badge tone={mode === 'demo' ? 'gold' : 'green'}>{mode === 'demo' ? 'Modo demostración' : 'Conectado al API'}</Badge></div>
    <div className="tabs settings-tabs"><button className={tab === 'profile' ? 'active' : ''} onClick={() => setTab('profile')}><UserRound size={16} />Mi perfil</button><button className={tab === 'farm' ? 'active' : ''} onClick={() => setTab('farm')}><Building2 size={16} />Mi finca</button><button className={tab === 'catalog' ? 'active' : ''} onClick={() => setTab('catalog')}><Sprout size={16} />Catálogo agrícola</button><button className={tab === 'calendar' ? 'active' : ''} onClick={() => setTab('calendar')}><CalendarDays size={16} />Calendario regional</button>{teamVisible && <button className={tab === 'team' ? 'active' : ''} onClick={() => setTab('team')}><Users size={16} />Equipo y permisos</button>}</div>
    {error && !assign && <div className="error-banner" role="alert">{error}</div>}
    {tab === 'profile' && <div className="settings-grid"><Panel title="Información de tu cuenta"><div className="profile-summary"><span className="avatar large-avatar">{profile.user.name.split(' ').map(part => part[0]).slice(0, 2).join('')}</span><div><h3>{profile.user.name}</h3><span>{profile.user.email}</span><Badge>{roleLabels[role]}</Badge></div></div><dl className="detail-list"><div><dt>Nombre</dt><dd>{profile.user.name}</dd></div><div><dt>Correo</dt><dd>{profile.user.email}</dd></div><div><dt>Acceso a la finca actual</dt><dd>{roleLabels[role]}</dd></div><div><dt>Zona horaria del dispositivo</dt><dd>{Intl.DateTimeFormat().resolvedOptions().timeZone}</dd></div></dl><p className="page-note">La edición del perfil y la recuperación de contraseña aún no están disponibles en el API.</p></Panel><div><Panel title="Tu sesión, protegida"><span className="stat-icon green"><ShieldCheck size={27} /></span><h3 className="insight-title">El cuidado también está en tus datos.</h3><p className="insight-description">Las sesiones reales usan cookies HTTP-only y protección CSRF. La sesión termina después de ocho horas de inactividad.</p>{mode === 'demo' && <button className="button" onClick={connect}>Conectar mi cuenta<ArrowUpRight size={16} /></button>}</Panel>{mode === 'demo' && <Panel title="Explora otros roles" className="demo-role-panel"><p className="muted">Simula la experiencia visual de cada rol. No modifica permisos del servidor.</p><div className="role-switch">{(['ADMIN', 'SUPERVISOR', 'WORKER'] as Role[]).map(value => <button className={role === value ? 'active' : ''} key={value} onClick={() => { setDemoRole(value); setTab('profile'); }}>{roleLabels[value]}</button>)}</div></Panel>}</div></div>}
    {tab === 'farm' && <div className="settings-grid"><Panel title="Información de la finca" action={<Badge>{mode === 'demo' ? 'Ejemplo' : 'Registrada'}</Badge>}><div className="settings-farm-image" /><h2 className="settings-farm-title">{data.farms[0]?.name}</h2><dl className="detail-list"><div><dt>País</dt><dd>{data.farms[0]?.country || 'Sin registrar'}</dd></div><div><dt>Región</dt><dd>{data.farms[0]?.region || 'Sin registrar'}</dd></div><div><dt>Campos</dt><dd>{data.fields.length}</dd></div><div><dt>Bloques</dt><dd>{data.blocks.length}</dd></div><div><dt>Surcos</dt><dd>{data.rows.length}</dd></div></dl><p className="page-note">El API aún no permite editar los datos de una finca existente.</p></Panel><Panel title="Sigue creciendo"><span className="stat-icon green"><Leaf size={28} /></span><h3 className="insight-title">Cada finca, su propio espacio.</h3><p className="insight-description">Crea otra finca y administra sus campos y su equipo de forma independiente.</p><button className="button" onClick={() => setNewFarm(true)}><Plus size={16} />Crear otra finca</button></Panel></div>}
    {tab === 'catalog' && <Panel title="Cultivos y variedades" action={role !== 'WORKER' && <button className="button small" onClick={() => { setCatalogModal('crop'); setError(''); }}><Plus size={16} />Nuevo cultivo</button>}><Notice>{role === 'WORKER' ? 'Consulta las opciones aprobadas para registrar bloques y ciclos.' : 'Define una vez los cultivos y variedades de esta finca para reutilizarlos en bloques, ciclos y material vegetal.'}</Notice>{catalogLoading ? <p className="muted">Cargando catálogo…</p> : <div className="stack-list">{catalog.length === 0 ? <p className="muted">Aún no hay cultivos registrados.</p> : catalog.map(crop => <div className="list-card" key={crop.id}><span className="icon-tile green"><Sprout size={20} /></span><span><strong>{crop.name}</strong><small>{crop.code} · {crop.varieties.length} {crop.varieties.length === 1 ? 'variedad' : 'variedades'}</small></span><span className="list-card-actions">{role !== 'WORKER' && <button className="button secondary small" onClick={() => { setCatalogModal({ cropId: crop.id }); setError(''); }}><Plus size={14} />Variedad</button>}</span><div className="catalog-varieties">{crop.varieties.map(variety => <Badge key={variety.id} tone="blue">{variety.name}</Badge>)}</div></div>)}</div>}<p className="page-note">Los códigos internos se guardan en minúsculas y deben ser únicos dentro de la finca.</p></Panel>}
    {tab === 'calendar' && <RegionalCalendar />}
    {tab === 'team' && teamVisible && <Panel title="Las personas de tu finca" action={role === 'ADMIN' && <button className="button small" onClick={() => { setEmail(''); setMemberRole('WORKER'); setAssign(true); setError(''); }}><Plus size={16} />Asignar miembro</button>}><div className="table-wrap"><table><thead><tr><th>Persona</th><th>Correo electrónico</th><th>Rol en esta finca</th><th>Acciones</th></tr></thead><tbody>{members.filter(member => `${member.name} ${member.email}`.toLocaleLowerCase('es').includes(search.toLocaleLowerCase('es'))).map(member => <tr key={member.userId}><td><span className="table-title"><span className="avatar small-avatar">{member.name.split(' ').map(part => part[0]).slice(0, 2).join('')}</span>{member.name}</span></td><td>{member.email}</td><td><Badge tone={member.role === 'ADMIN' ? 'green' : member.role === 'SUPERVISOR' ? 'blue' : member.role === 'AGRONOMIST' ? 'purple' : 'neutral'}>{roleLabels[member.role]}</Badge></td><td>{role === 'ADMIN' && <button className="text-button" onClick={() => { setEmail(member.email); setMemberRole(member.role); setAssign(true); setError(''); }}>Cambiar rol</button>}</td></tr>)}</tbody></table></div><p className="page-note">{mode === 'demo' ? 'Equipo ilustrativo guardado localmente.' : 'La persona debe registrar su cuenta antes de recibir acceso.'} La eliminación de membresías aún no está implementada.</p></Panel>}
    {mode === 'demo' && <div className="reset-demo"><div><strong>¿Empezamos de nuevo?</strong><p>Restablece los campos, eventos y tareas de ejemplo.</p></div><button className="button secondary small" onClick={() => setReset(true)}><RotateCcw size={15} />Restablecer demostración</button></div>}
    {newFarm && <ResourceForm resource="farms" onClose={() => setNewFarm(false)} />}
    {catalogModal && <Modal title={catalogModal === 'crop' ? 'Nuevo cultivo' : 'Nueva variedad'} onClose={() => !busy && setCatalogModal(null)}><form className="form-stack" onSubmit={submitCatalog}><Notice>{catalogModal === 'crop' ? 'El cultivo quedará disponible para toda la finca.' : `La variedad se agregará a ${catalog.find(crop => crop.id === catalogModal.cropId)?.name ?? 'el cultivo seleccionado'}.`}</Notice><label>Código interno<input name="code" required maxLength={100} placeholder={catalogModal === 'crop' ? 'Ej. cacao' : 'Ej. CCN-51'} /></label><label>Nombre visible<input name="name" required maxLength={150} placeholder={catalogModal === 'crop' ? 'Ej. Cacao' : 'Ej. CCN-51'}/></label>{error && <p className="form-error" role="alert">{error}</p>}<div className="form-actions"><button type="button" className="button secondary" disabled={busy} onClick={() => setCatalogModal(null)}>Cancelar</button><button className="button" disabled={busy}>{busy ? 'Guardando…' : 'Guardar'}</button></div></form></Modal>}
    {assign && <Modal title="Asignar acceso a la finca" onClose={() => !busy && setAssign(false)}><form className="form-stack" onSubmit={submit}><Notice>{mode === 'demo' ? 'Este cambio es una simulación local del equipo de trabajo.' : 'Agrega una cuenta ya registrada. El rol se aplica solo a esta finca.'}</Notice><label>Correo electrónico<input type="email" required value={email} onChange={event => setEmail(event.target.value)} placeholder="persona@correo.com" /></label><label>Rol<select value={memberRole} onChange={event => setMemberRole(event.target.value as Role)}>{Object.entries(roleLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><p className="muted">Trabajador: consulta y registros. Agrónomo: configuración y aprobación técnica. Supervisor: manejo del cultivo. Administrador: equipo, permisos y finca.</p>{error && <p className="form-error" role="alert">{error}</p>}<div className="form-actions"><button type="button" className="button secondary" disabled={busy} onClick={() => setAssign(false)}>Cancelar</button><button className="button" disabled={busy}><Check size={16} />{busy ? 'Guardando…' : 'Guardar acceso'}</button></div></form></Modal>}
    {reset && <Modal title="Restablecer demostración" onClose={() => setReset(false)}><div className="form-stack"><p>Se reemplazarán los campos, bloques, surcos, eventos y tareas locales por los datos iniciales. Los datos reales del servidor no se modifican.</p><div className="form-actions"><button className="button secondary" onClick={() => setReset(false)}>Cancelar</button><button className="button" onClick={() => { resetDemo(); setReset(false); }}>Restablecer</button></div></div></Modal>}
  </>;
}
