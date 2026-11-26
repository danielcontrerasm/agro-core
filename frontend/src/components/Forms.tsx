import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { LoaderCircle, Plus, Check, AlertCircle } from 'lucide-react';
import { Modal, Notice } from './ui';
import { useApp } from '../context';
import { activityLabels, eventLabels, localDate } from '../lib/domain';
import type { Member } from '../lib/types';
import { api } from '../lib/api';
import { readCatalogForFarm, type CropCatalog } from '../lib/catalog';

export function ResourceForm({ resource, onClose }: { resource: 'farms' | 'fields' | 'blocks' | 'rows'; onClose: () => void }) {
  const { data, farmId, create, mode, notify } = useApp();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [catalog, setCatalog] = useState<CropCatalog[]>([]);
  const [selectedCropId, setSelectedCropId] = useState('');
  const [selectedVarietyId, setSelectedVarietyId] = useState('');
  const [catalogLoading, setCatalogLoading] = useState(resource === 'blocks' && mode === 'live');
  const labels = { farms: 'Nueva finca', fields: 'Nuevo campo', blocks: 'Nuevo bloque', rows: 'Nuevo surco' };
  const selectedCrop = catalog.find(crop => String(crop.id) === selectedCropId);
  const availableVarieties = selectedCrop?.varieties ?? [];
  const selectedVariety = availableVarieties.find(variety => String(variety.id) === selectedVarietyId);

  useEffect(() => {
    if (resource !== 'blocks') return;
    let active = true;
    setCatalogLoading(mode === 'live');
    const loadingCatalog = mode === 'live' ? api.cropCatalog(farmId) : Promise.resolve(readCatalogForFarm(farmId));
    loadingCatalog.then(value => { if (active) setCatalog(value); })
      .catch(failure => { if (active) setError(failure instanceof Error ? failure.message : 'No se pudo cargar el catálogo agrícola.'); })
      .finally(() => { if (active) setCatalogLoading(false); });
    return () => { active = false; };
  }, [resource, mode, farmId]);

  useEffect(() => {
    if (resource !== 'blocks') return;
    const firstCrop = catalog[0];
    setSelectedCropId(previous => catalog.some(crop => String(crop.id) === previous) ? previous : firstCrop ? String(firstCrop.id) : '');
  }, [catalog, resource]);

  useEffect(() => {
    if (resource !== 'blocks') return;
    setSelectedVarietyId(previous => availableVarieties.some(variety => String(variety.id) === previous) ? previous : availableVarieties[0] ? String(availableVarieties[0].id) : '');
  }, [availableVarieties, resource]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError('');
    const form = new FormData(event.currentTarget);
    const value = (name: string) => String(form.get(name) ?? '').trim();
    const payload: Record<string, unknown> = {};
    try {
      if (resource === 'farms') Object.assign(payload, { name: value('name'), country: value('country'), region: value('region') });
      if (resource === 'fields') Object.assign(payload, { name: value('name'), farmId, areaHa: Number(value('areaHa')) });
      if (resource === 'blocks') {
        if (!selectedCrop) throw new Error('Selecciona un cultivo del catálogo agrícola.');
        Object.assign(payload, { code: value('name'), fieldId: Number(value('fieldId')), areaHa: Number(value('areaHa')), cropId: Number(selectedCropId), varietyId: selectedVarietyId ? Number(selectedVarietyId) : null, crop: selectedCrop.name, variety: selectedVariety?.name ?? '' });
      }
      if (resource === 'rows') Object.assign(payload, { rowCode: value('name'), blockId: Number(value('blockId')), lengthM: Number(value('lengthM')), plantSpacingM: Number(value('plantSpacingM')), plantsEstimated: Number(value('plantsEstimated')) });
      if (resource !== 'farms') {
        const coordinates = JSON.parse(value('coordinates'));
        if (!Array.isArray(coordinates) || coordinates.length < (resource === 'rows' ? 2 : 1)) throw new Error('Ingresa una lista de coordenadas válida.');
        if (resource === 'rows') {
          if (!coordinates.every(point => Array.isArray(point) && point.length >= 2 && point.every(Number.isFinite))) throw new Error('Cada punto debe contener longitud y latitud numéricas.');
          payload.line = { coordinates };
        } else {
          if (!Array.isArray(coordinates[0]) || coordinates[0].length < 3 || !coordinates[0].every((point: number[]) => Array.isArray(point) && point.length >= 2 && point.every(Number.isFinite))) throw new Error('El anillo exterior debe contener al menos tres puntos [longitud, latitud].');
          payload.polygon = { coordinates };
        }
      }
      setBusy(true); await create(resource, payload); notify(mode === 'demo' ? 'Registro creado en la demostración.' : 'Registro guardado en tu finca.'); onClose();
    } catch (failure) { setError(failure instanceof Error ? failure.message : 'No se pudo guardar.'); }
    finally { setBusy(false); }
  }
  return <Modal title={labels[resource]} onClose={onClose}><form onSubmit={submit} className="form-stack">
    {mode === 'demo' && <Notice>Se guardará únicamente en la demostración de este navegador.</Notice>}
    <label>{resource === 'blocks' || resource === 'rows' ? 'Código' : 'Nombre'}<input name="name" required maxLength={150} placeholder={resource === 'farms' ? 'Ej. Finca Las Palmas' : resource === 'fields' ? 'Ej. Campo Norte' : resource === 'blocks' ? 'Ej. Bloque F' : 'Ej. R-329'} /></label>
    {resource === 'farms' && <div className="form-grid"><label>País<input name="country" defaultValue="Colombia" /></label><label>Región<input name="region" placeholder="Departamento o municipio" /></label></div>}
    {resource === 'blocks' && <><label>Campo<select name="fieldId" required><option value="">Seleccionar campo</option>{data.fields.map(field => <option key={field.id} value={field.id}>{field.name}</option>)}</select></label><div className="form-grid"><label>Cultivo<select name="cropId" required value={selectedCropId} disabled={catalogLoading} onChange={event => setSelectedCropId(event.target.value)}><option value="">{catalogLoading ? 'Cargando catálogo…' : 'Seleccionar cultivo'}</option>{catalog.map(crop => <option key={crop.id} value={crop.id}>{crop.name}</option>)}</select></label><label>Variedad<select name="varietyId" value={selectedVarietyId} disabled={catalogLoading || !availableVarieties.length} onChange={event => setSelectedVarietyId(event.target.value)}><option value="">{availableVarieties.length ? 'Seleccionar variedad' : 'Sin variedad registrada'}</option>{availableVarieties.map(variety => <option key={variety.id} value={variety.id}>{variety.name}</option>)}</select></label></div></>}
    {resource === 'rows' ? <><label>Bloque<select name="blockId" required><option value="">Seleccionar bloque</option>{data.blocks.map(block => <option key={block.id} value={block.id}>{block.code}</option>)}</select></label><div className="form-grid"><label>Longitud (m)<input name="lengthM" type="number" min="0.01" step="any" required /></label><label>Distancia entre plantas (m)<input name="plantSpacingM" type="number" min="0.01" step="any" defaultValue="2" required /></label></div><label>Plantas estimadas<input name="plantsEstimated" type="number" min="0" step="1" required /></label></> : resource !== 'farms' && <label>Área (ha)<input name="areaHa" type="number" min="0.01" step="any" required /></label>}
    {resource !== 'farms' && <label>Coordenadas {resource === 'rows' ? 'de la línea' : 'del polígono'}<textarea name="coordinates" rows={3} required placeholder={resource === 'rows' ? '[[-74.1,10.5],[-74.11,10.51]]' : '[[[-74.1,10.5],[-74.11,10.5],[-74.11,10.51]]]'} /><small>Formato JSON en orden [longitud, latitud]. {resource !== 'rows' && 'El servidor cierra el anillo exterior.'}</small></label>}
    {error && <p className="form-error" role="alert"><AlertCircle size={16} />{error}</p>}
    <div className="form-actions"><button type="button" className="button secondary" disabled={busy} onClick={onClose}>Cancelar</button><button className="button" disabled={busy || (resource === 'blocks' && (catalogLoading || !selectedCrop))}>{busy ? <LoaderCircle className="spin" size={16} /> : <Plus size={16} />}Guardar</button></div>
  </form></Modal>;
}

export function EventForm({ onClose, initialType = 'SCOUTING_OBSERVATION' }: { onClose: () => void; initialType?: string }) {
  const { data, create, mode, notify } = useApp();
  const [type, setType] = useState(initialType);
  const [blockId, setBlockId] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = new FormData(event.currentTarget); setError('');
    const payload: Record<string, unknown> = { eventType: type, blockId: Number(blockId), occurredAt: new Date(String(form.get('occurredAt'))).toISOString(), notes: String(form.get('notes') || '') };
    if (form.get('rowId')) payload.rowId = Number(form.get('rowId'));
    const start = String(form.get('plantStart') || ''); const end = String(form.get('plantEnd') || '');
    if (Boolean(start) !== Boolean(end) || (start && Number(end) < Number(start))) { setError('Indica un rango completo y ordenado de plantas.'); return; }
    if (start) Object.assign(payload, { plantIndexStart: Number(start), plantIndexEnd: Number(end) });
    if (type === 'SCOUTING_OBSERVATION') payload.observation = { severity: Number(form.get('severity')), symptoms: String(form.get('symptoms') || '') };
    try { setBusy(true); await create('events', payload); notify(mode === 'demo' ? 'Evento registrado en la demostración.' : 'Evento registrado correctamente.'); onClose(); }
    catch (failure) { setError(failure instanceof Error ? failure.message : 'No se pudo guardar.'); } finally { setBusy(false); }
  }
  const now = new Date(); const localTime = `${localDate(now)}T${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  return <Modal title="Registrar actividad" onClose={() => !busy && onClose()} wide><form className="form-stack" onSubmit={submit}>
    <p className="muted">Después de guardar, abre el detalle de la actividad para adjuntar fotos desde archivos o cámara.</p>
    {mode === 'demo' && <Notice>Este registro es de demostración y no se enviará al servidor.</Notice>}
    <fieldset className="record-form-section form-grid"><legend>Actividad y ubicación</legend>
    <label>Tipo de actividad<select value={type} onChange={event => setType(event.target.value)}>{Object.entries(eventLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
    <label>Bloque<select required value={blockId} onChange={event => setBlockId(event.target.value)}><option value="">Seleccionar bloque</option>{data.blocks.map(block => <option key={block.id} value={block.id}>{block.code}</option>)}</select></label><label>Fecha y hora<input required name="occurredAt" type="datetime-local" defaultValue={localTime} /></label>
    <label>Surco (opcional)<select name="rowId" key={blockId}><option value="">Todo el bloque</option>{data.rows.filter(row => row.block.id === Number(blockId)).map(row => <option key={row.id} value={row.id}>{row.rowCode}</option>)}</select></label>
    <label>Desde planta (opcional)<input type="number" min="1" step="1" name="plantStart" /></label><label>Hasta planta (opcional)<input type="number" min="1" step="1" name="plantEnd" /></label>
    </fieldset>
    <fieldset className="record-form-section form-grid"><legend>Resultados y notas</legend>
    {type === 'SCOUTING_OBSERVATION' && <><label>Severidad de observación<select name="severity"><option value="1">1 · Leve</option><option value="2">2 · Moderada</option><option value="3">3 · Alta</option><option value="4">4 · Muy alta</option><option value="5">5 · Crítica</option></select><small>Escala de captura del frontend; no constituye un diagnóstico.</small></label><label className="full-span">Síntomas observados<textarea name="symptoms" rows={2} required placeholder="Describe lo que observaste…" /></label></>}
    <label className="full-span">Notas<textarea name="notes" rows={3} placeholder="Qué se realizó, novedades e información para el equipo…" /></label>
    </fieldset>
    {error && <p className="form-error" role="alert">{error}</p>}<div className="form-actions"><button className="button secondary" type="button" disabled={busy} onClick={onClose}>Cancelar</button><button className="button" disabled={busy}>{busy ? <LoaderCircle className="spin" size={16} /> : <Check size={16} />}Registrar actividad</button></div>
  </form></Modal>;
}

export function TaskForm({ onClose }: { onClose: () => void }) {
  const { data, farmId, createTask, notify, date, mode } = useApp();
  const [members, setMembers] = useState<Member[]>([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [loadingMembers, setLoadingMembers] = useState(mode === 'live');
  useEffect(() => {
    if (mode !== 'live') return;
    let active = true;
    api.members(farmId).then(result => { if (active) setMembers(result); })
      .catch(failure => { if (active) setError(failure.message); })
      .finally(() => { if (active) setLoadingMembers(false); });
    return () => { active = false; };
  }, [mode, farmId]);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = new FormData(event.currentTarget);
    const [target, targetId] = String(form.get('location')).split(':');
    const payload: Record<string, unknown> = { farmId, title: String(form.get('title')).trim(), activity: String(form.get('activity')), [target === 'field' ? 'fieldId' : 'blockId']: Number(targetId), date: String(form.get('date')), time: String(form.get('time')), priority: String(form.get('priority')), instructions: String(form.get('instructions')).trim() };
    if (mode === 'live') payload.assigneeId = Number(form.get('assignee')); else payload.assignee = String(form.get('assignee'));
    setError(''); setBusy(true);
    try { await createTask(payload); notify(mode === 'live' ? 'Tarea guardada en tu finca.' : 'Tarea creada en la demostración local.'); onClose(); }
    catch (failure) { setError(failure instanceof Error ? failure.message : 'No se pudo crear la tarea.'); }
    finally { setBusy(false); }
  }
  return <Modal title="Nueva tarea" onClose={onClose}><form className="form-stack" onSubmit={submit}>
    <Notice>{mode === 'live' ? 'La tarea se guardará en tu finca y estará disponible para su responsable.' : 'Prototipo de planificación. Las tareas se guardan en este navegador, sin sincronización con el API.'}</Notice>
    <label>Nombre de la tarea<input name="title" required maxLength={150} placeholder="Ej. Inspección del Bloque A" /></label>
    <div className="form-grid"><label>Actividad<select name="activity">{Object.entries(activityLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><label>Campo o bloque<select name="location" required>{mode === 'live' && <optgroup label="Campos">{data.fields.map(field => <option key={field.id} value={`field:${field.id}`}>{field.name}</option>)}</optgroup>}<optgroup label="Bloques">{data.blocks.map(block => <option key={block.id} value={`block:${block.id}`}>{block.field.name} · {block.code}</option>)}</optgroup></select></label></div>
    <div className="form-grid"><label>Fecha<input name="date" type="date" required defaultValue={date} /></label><label>Hora<input name="time" type="time" required defaultValue="07:00" /></label></div>
    <div className="form-grid"><label>Responsable<select name="assignee" required disabled={loadingMembers}>{mode === 'live' ? <><option value="">{loadingMembers ? 'Cargando equipo…' : 'Seleccionar responsable'}</option>{members.map(member => <option key={member.userId} value={member.userId}>{member.name} · {member.email}</option>)}</> : <><option>Daniel Contreras</option><option>María Rodríguez</option><option>Carlos Mendoza</option></>}</select></label><label>Prioridad<select name="priority"><option>Media</option><option>Alta</option><option>Baja</option></select></label></div>
    <label>Instrucciones<textarea name="instructions" required maxLength={4000} rows={3} placeholder="Ubicación, alcance y plan aprobado que debe seguir el trabajador…" /></label>
    {error && <p className="form-error" role="alert">{error}</p>}
    <div className="form-actions"><button type="button" className="button secondary" onClick={onClose} disabled={busy}>Cancelar</button><button className="button" disabled={busy || loadingMembers || (mode === 'live' && !members.length)}>{busy ? <LoaderCircle className="spin" size={16} /> : <Plus size={16} />}Crear tarea</button></div>
  </form></Modal>;
}
