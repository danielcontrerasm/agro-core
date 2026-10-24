import { useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { Check, ClipboardCheck, Download, Eye, FileText, Play, Plus, ShieldCheck } from 'lucide-react';
import { useApp } from '../context';
import { api } from '../lib/api';
import { localDate } from '../lib/domain';
import { demoPreventiveData, preventiveCategoryLabels, preventiveCsv, preventiveDemoKey, preventiveStatusLabels } from '../lib/preventive';
import type { PreventiveAssignment, PreventiveAssignmentStatus, PreventiveCategory, PreventiveData, PreventiveEvidenceKind, PreventiveMeasureTemplate } from '../lib/preventive';
import { readDemo, saveDemo } from '../lib/demo';
import { Badge, Empty, Modal, Notice, Panel } from '../components/ui';

export default function PreventiveMeasures() {
  const { data, mode, farmId, profile, role, search, notify } = useApp();
  const [templates, setTemplates] = useState<PreventiveMeasureTemplate[]>([]);
  const [assignments, setAssignments] = useState<PreventiveAssignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [templateForm, setTemplateForm] = useState(false);
  const [assignmentForm, setAssignmentForm] = useState(false);
  const [selected, setSelected] = useState<PreventiveAssignment | null>(null);
  const [statusFilter, setStatusFilter] = useState<'ALL' | PreventiveAssignmentStatus>('ALL');

  useEffect(() => {
    let active = true;
    setLoading(true); setError(''); setSelected(null);
    const load = mode === 'demo'
      ? Promise.resolve(readDemo<PreventiveData>(preventiveDemoKey, demoPreventiveData()))
      : Promise.all([api.preventiveMeasures(farmId), api.preventiveAssignments(farmId)]).then(([loadedTemplates, loadedAssignments]) => ({ templates: loadedTemplates, assignments: loadedAssignments }));
    load.then(value => { if (active) { setTemplates(value.templates.filter(template => template.farmId === farmId)); setAssignments(value.assignments.filter(assignment => assignment.farmId === farmId)); } })
      .catch(failure => { if (active) setError(failure instanceof Error ? failure.message : 'No se pudo cargar la prevención.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [farmId, mode]);

  function persist(nextTemplates = templates, nextAssignments = assignments) {
    if (mode === 'demo' && !saveDemo(preventiveDemoKey, { templates: nextTemplates, assignments: nextAssignments })) {
      throw new Error('No se pudo guardar la prevención en el navegador.');
    }
    setTemplates(nextTemplates); setAssignments(nextAssignments);
  }

  async function createTemplate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const fields = new FormData(event.currentTarget); setError('');
    const payload = { farmId, code: String(fields.get('code')).trim().toLowerCase(), name: String(fields.get('name')).trim(), category: String(fields.get('category')) as PreventiveCategory, instructions: String(fields.get('instructions')).trim() };
    try {
      const saved = mode === 'live' ? await api.createPreventiveMeasure(payload) : {
        ...payload, id: Math.max(0, ...templates.map(template => template.id)) + 1, active: true,
        createdByUserId: profile.user.id, creatorName: profile.user.name, createdAt: new Date().toISOString(),
      };
      persist([saved, ...templates]); setTemplateForm(false); notify('Medida preventiva creada.');
    } catch (failure) { setError(failure instanceof Error ? failure.message : 'No se pudo crear la medida.'); }
  }

  async function createAssignment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const fields = new FormData(event.currentTarget); setError('');
    const templateId = Number(fields.get('templateId')); const blockId = Number(fields.get('blockId'));
    const template = templates.find(item => item.id === templateId); const block = data.blocks.find(item => item.id === blockId);
    if (!template || !block) { setError('Selecciona una medida y un bloque válidos.'); return; }
    const payload = { templateId, blockId, scheduledFor: String(fields.get('scheduledFor')), assignedToUserId: profile.user.id };
    try {
      const now = new Date().toISOString();
      const saved = mode === 'live' ? await api.createPreventiveAssignment(payload) : {
        id: Math.max(0, ...assignments.map(assignment => assignment.id)) + 1, farmId, templateId,
        templateCode: template.code, templateName: template.name, category: template.category, instructions: template.instructions,
        blockId, blockCode: block.code, scheduledFor: payload.scheduledFor, assignedToUserId: profile.user.id,
        assignedToName: profile.user.name, status: 'PLANNED' as const, completionNotes: null, completedAt: null,
        completedByUserId: null, completedByName: null, createdByUserId: profile.user.id, creatorName: profile.user.name,
        createdAt: now, updatedAt: now, version: 0, evidence: [],
      };
      persist(templates, [saved, ...assignments]); setAssignmentForm(false); notify('Medida asignada al bloque.');
    } catch (failure) { setError(failure instanceof Error ? failure.message : 'No se pudo asignar la medida.'); }
  }

  async function updateAssignment(id: number, status: PreventiveAssignmentStatus, completionNotes: string) {
    const current = assignments.find(assignment => assignment.id === id);
    if (!current) return;
    const notes = completionNotes.trim();
    if (status === 'COMPLETED' && !notes) throw new Error('Describe el resultado antes de marcar la medida como completada.');
    const payload = { status, completionNotes: notes || null, version: current.version };
    const saved = mode === 'live' ? await api.updatePreventiveAssignment(id, payload) : {
      ...current, status, completionNotes: notes || null,
      completedAt: status === 'COMPLETED' ? (current.completedAt ?? new Date().toISOString()) : null,
      completedByUserId: status === 'COMPLETED' ? (current.completedByUserId ?? profile.user.id) : null,
      completedByName: status === 'COMPLETED' ? (current.completedByName ?? profile.user.name) : null,
      updatedAt: new Date().toISOString(), version: current.version + 1,
    };
    const next = assignments.map(assignment => assignment.id === id ? { ...saved, evidence: current.evidence } : assignment);
    persist(templates, next); setSelected(next.find(assignment => assignment.id === id) ?? null); notify(status === 'COMPLETED' ? 'Medida marcada como completada.' : 'Estado de la medida actualizado.');
  }

  async function addEvidence(id: number, event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const fields = new FormData(event.currentTarget); setError('');
    const payload = { kind: String(fields.get('kind')) as PreventiveEvidenceKind, s3Key: String(fields.get('s3Key')).trim(), contentType: String(fields.get('contentType')).trim() || null };
    try {
      const current = assignments.find(assignment => assignment.id === id); if (!current) return;
      const saved = mode === 'live' ? await api.addPreventiveEvidence(id, payload) : {
        ...payload, id: Math.max(0, ...(current.evidence ?? []).map(item => item.id)) + 1, assignmentId: id,
        createdByUserId: profile.user.id, authorName: profile.user.name, createdAt: new Date().toISOString(),
      };
      const next = assignments.map(assignment => assignment.id === id ? { ...assignment, evidence: [saved, ...(assignment.evidence ?? [])] } : assignment);
      persist(templates, next); setSelected(next.find(assignment => assignment.id === id) ?? null); notify('Evidencia adjuntada.');
    } catch (failure) { setError(failure instanceof Error ? failure.message : 'No se pudo adjuntar la evidencia.'); }
  }

  async function openAssignment(assignment: PreventiveAssignment) {
    setError(''); setSelected(assignment);
    if (mode === 'live') {
      try { const evidence = await api.preventiveEvidence(assignment.id); setSelected({ ...assignment, evidence }); }
      catch (failure) { setError(failure instanceof Error ? failure.message : 'No se pudo cargar la evidencia.'); }
    }
  }

  function exportCsv() {
    const content = preventiveCsv(filtered);
    const url = URL.createObjectURL(new Blob([content], { type: 'text/csv;charset=utf-8;' }));
    const anchor = document.createElement('a'); anchor.href = url; anchor.download = `prevencion-${mode === 'demo' ? 'demo-' : ''}${localDate()}.csv`;
    document.body.appendChild(anchor); anchor.click(); anchor.remove(); window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    notify(`Exportadas ${filtered.length} asignaciones preventivas.`);
  }

  const filtered = useMemo(() => assignments.filter(assignment => assignment.farmId === farmId
    && (statusFilter === 'ALL' || assignment.status === statusFilter)
    && `${assignment.templateName} ${assignment.blockCode} ${assignment.assignedToName ?? ''} ${assignment.completionNotes ?? ''}`.toLocaleLowerCase('es').includes(search.toLocaleLowerCase('es')))
    .sort((first, second) => Number(first.status === 'COMPLETED') - Number(second.status === 'COMPLETED') || first.scheduledFor.localeCompare(second.scheduledFor) || second.id - first.id), [assignments, farmId, search, statusFilter]);
  const activeTemplates = templates.filter(template => template.active);
  const pendingCount = assignments.filter(assignment => assignment.status !== 'COMPLETED').length;
  const completedCount = assignments.filter(assignment => assignment.status === 'COMPLETED').length;

  return <>
    <div className="page-heading"><div><span className="eyebrow">PREVENCIÓN FITOSANITARIA</span><h1>Medidas preventivas</h1><p>Convierte las buenas prácticas en trabajo programado y trazable.</p></div><div className="heading-buttons"><button className="button secondary" disabled={!filtered.length} onClick={exportCsv}><Download size={16} />Exportar CSV</button><button className="button" disabled={!activeTemplates.length || !data.blocks.length} onClick={() => { setError(''); setAssignmentForm(true); }}><Plus size={16} />Asignar medida</button></div></div>
    <Notice>{mode === 'demo' ? 'Datos de demostración guardados en este navegador. ' : ''}Programa una medida para un bloque, registra el resultado y conserva la referencia de la evidencia. Las medidas no sustituyen la revisión profesional.</Notice>
    {error && !selected && <p className="form-error" role="alert">{error}</p>}
    <div className="stats-grid"><Panel><span className="stat-icon orange"><ShieldCheck size={23} /></span><strong>{activeTemplates.length}</strong><small>Medidas activas</small></Panel><Panel><span className="stat-icon gold"><ClipboardCheck size={23} /></span><strong>{pendingCount}</strong><small>Asignaciones pendientes</small></Panel><Panel><span className="stat-icon green"><Check size={23} /></span><strong>{completedCount}</strong><small>Completadas</small></Panel></div>
    <Panel title="Biblioteca de medidas" action={role !== 'WORKER' && <button className="button small" onClick={() => { setError(''); setTemplateForm(true); }}><Plus size={15} />Nueva medida</button>}>
      {loading ? <p role="status">Cargando medidas…</p> : <div className="stack-list">{activeTemplates.length ? activeTemplates.map(template => <div className="list-card" key={template.id}><span className="icon-tile orange"><ShieldCheck size={20} /></span><span><strong>{template.name}</strong><small>{template.code} · {preventiveCategoryLabels[template.category]}</small></span><Badge tone="green">Activa</Badge><p>{template.instructions}</p></div>) : <Empty title="Aún no hay medidas" description="Crea una medida reutilizable para empezar a prevenir riesgos en tus bloques." />}</div>}
    </Panel>
    <div className="record-filters"><label>Estado<select value={statusFilter} onChange={event => setStatusFilter(event.target.value as typeof statusFilter)}><option value="ALL">Todos</option>{Object.entries(preventiveStatusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label></div>
    <Panel title="Trabajo preventivo asignado"><div className="table-wrap"><table><thead><tr><th>Medida</th><th>Bloque</th><th>Fecha programada</th><th>Responsable</th><th>Estado</th><th>Detalle</th></tr></thead><tbody>{filtered.map(assignment => <tr key={assignment.id}><td><span className="table-title"><ShieldCheck size={17} />{assignment.templateName}</span><small className="table-subtitle">{preventiveCategoryLabels[assignment.category]}</small></td><td>{assignment.blockCode}</td><td>{assignment.scheduledFor}</td><td>{assignment.assignedToName ?? 'Sin asignar'}</td><td><Badge tone={assignment.status === 'COMPLETED' ? 'green' : assignment.status === 'IN_PROGRESS' ? 'blue' : 'gold'}>{preventiveStatusLabels[assignment.status]}</Badge></td><td><button className="icon-button" aria-label={`Ver medida ${assignment.id}`} onClick={() => void openAssignment(assignment)}><Eye size={18} /></button></td></tr>)}</tbody></table>{!loading && !filtered.length && <Empty title="Sin asignaciones" description="Asigna una medida a un bloque o cambia el filtro." />}</div></Panel>
    {templateForm && <Modal title="Nueva medida preventiva" onClose={() => setTemplateForm(false)}><form className="form-stack" onSubmit={createTemplate}><Notice>La medida quedará disponible para toda la finca y podrá asignarse a cualquier bloque.</Notice><label>Código interno<input name="code" required maxLength={100} placeholder="Ej. monitoreo-semanal" /></label><label>Nombre visible<input name="name" required maxLength={180} placeholder="Ej. Monitoreo semanal de hojas" /></label><label>Categoría<select name="category" defaultValue="MONITORING">{Object.entries(preventiveCategoryLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><label>Instrucciones<textarea name="instructions" required maxLength={4000} placeholder="Describe qué debe revisar o ejecutar el equipo." /></label>{error && <p role="alert" className="form-error">{error}</p>}<div className="form-actions"><button type="button" className="button secondary" onClick={() => setTemplateForm(false)}>Cancelar</button><button className="button"><Check size={16} />Guardar medida</button></div></form></Modal>}
    {assignmentForm && <Modal title="Asignar medida preventiva" onClose={() => setAssignmentForm(false)}><form className="form-stack" onSubmit={createAssignment}><Notice>La asignación quedará a tu nombre como responsable inicial. El equipo podrá consultar su avance.</Notice><label>Medida<select name="templateId" required>{activeTemplates.map(template => <option key={template.id} value={template.id}>{template.name}</option>)}</select></label><label>Bloque<select name="blockId" required defaultValue=""> <option value="" disabled>Selecciona un bloque</option>{data.blocks.map(block => <option key={block.id} value={block.id}>{block.code}</option>)}</select></label><label>Fecha programada<input name="scheduledFor" type="date" required defaultValue={localDate()} /></label>{error && <p role="alert" className="form-error">{error}</p>}<div className="form-actions"><button type="button" className="button secondary" onClick={() => setAssignmentForm(false)}>Cancelar</button><button className="button"><Check size={16} />Asignar medida</button></div></form></Modal>}
    {selected && <AssignmentDetail assignment={selected} onClose={() => { setError(''); setSelected(null); }} onUpdate={updateAssignment} onEvidence={addEvidence} error={error} setError={setError} />}
  </>;
}

function AssignmentDetail({ assignment, onClose, onUpdate, onEvidence, error, setError }: { assignment: PreventiveAssignment; onClose: () => void; onUpdate: (id: number, status: PreventiveAssignmentStatus, notes: string) => Promise<void>; onEvidence: (id: number, event: FormEvent<HTMLFormElement>) => Promise<void>; error: string; setError: (message: string) => void }) {
  const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const fields = new FormData(event.currentTarget); setBusy(true); setError('');
    try { await onUpdate(assignment.id, String(fields.get('status')) as PreventiveAssignmentStatus, String(fields.get('completionNotes') ?? '')); }
    catch (failure) { setError(failure instanceof Error ? failure.message : 'No se pudo actualizar la medida.'); }
    finally { setBusy(false); }
  }
  async function evidence(event: FormEvent<HTMLFormElement>) {
    setBusy(true); setError('');
    try { await onEvidence(assignment.id, event); event.currentTarget.reset(); }
    catch (failure) { setError(failure instanceof Error ? failure.message : 'No se pudo adjuntar la evidencia.'); }
    finally { setBusy(false); }
  }
  return <Modal title="Detalle de medida preventiva" onClose={() => !busy && onClose()} wide><div className="event-detail"><span className="icon-tile orange"><ShieldCheck size={24} /></span><h2>{assignment.templateName}</h2><div className="detail-meta"><span>{assignment.blockCode}</span><span>{assignment.scheduledFor}</span><Badge tone={assignment.status === 'COMPLETED' ? 'green' : assignment.status === 'IN_PROGRESS' ? 'blue' : 'gold'}>{preventiveStatusLabels[assignment.status]}</Badge></div><div className="instructions"><h4>Instrucciones</h4><p>{assignment.instructions}</p></div><dl className="detail-list"><div><dt>Responsable</dt><dd>{assignment.assignedToName ?? 'Sin asignar'}</dd></div><div><dt>Asignó</dt><dd>{assignment.creatorName}</dd></div>{assignment.completedAt && <div><dt>Completó</dt><dd>{assignment.completedByName ?? `Usuario #${assignment.completedByUserId}`} · {new Date(assignment.completedAt).toLocaleString('es-CO')}</dd></div>}</dl><form className="form-stack inline-form" onSubmit={submit}><label>Estado<select name="status" defaultValue={assignment.status} disabled={assignment.status === 'COMPLETED' || busy}>{Object.entries(preventiveStatusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><label>Resultado o notas de cierre<textarea name="completionNotes" required={assignment.status === 'COMPLETED'} maxLength={4000} defaultValue={assignment.completionNotes ?? ''} placeholder="Describe lo observado o ejecutado." disabled={busy} /></label><button className="button" disabled={busy}>{assignment.status === 'COMPLETED' ? 'Guardar notas' : <><Play size={15} />Actualizar estado</>}</button></form><div className="panel-heading"><h3>Evidencia</h3></div><p className="muted small-text">Conserva la referencia al archivo o informe que demuestra la ejecución.</p>{(assignment.evidence ?? []).map(item => <div className="media-record" key={item.id}><FileText size={19} /><div><strong>{item.s3Key}</strong><small>{item.kind} · {item.contentType || 'Sin tipo'} · {item.authorName}</small></div></div>)}{!(assignment.evidence ?? []).length && <p className="muted">Sin evidencia adjunta.</p>}<form className="form-stack inline-form" onSubmit={evidence}><label>Tipo<select name="kind" disabled={busy}><option value="IMAGE">Imagen</option><option value="DOCUMENT">Documento</option><option value="VIDEO">Video</option></select></label><label>Referencia del archivo<input name="s3Key" required maxLength={1024} placeholder="prevencion/bloque-a.jpg" disabled={busy} /></label><label>Tipo de contenido<input name="contentType" maxLength={150} placeholder="image/jpeg" disabled={busy} /></label><button className="button secondary" disabled={busy}><FileText size={15} />Adjuntar evidencia</button></form>{error && <p role="alert" className="form-error">{error}</p>}</div></Modal>;
}
