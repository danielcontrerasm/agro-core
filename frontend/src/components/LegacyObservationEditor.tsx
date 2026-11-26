import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { Pencil } from 'lucide-react';
import { useApp } from '../context';
import { api, ApiError } from '../lib/api';
import { loadSanitaryProblemsDemo } from '../lib/inspections';
import type { SanitaryProblem } from '../lib/inspections';
import { demoLegacyObservation, legacyObservationApi } from '../lib/legacy-observation';
import type { LegacyObservation, LegacyObservationValues } from '../lib/legacy-observation';
import type { FieldEvent } from '../lib/types';

const labels = { notes: 'Notas', symptoms: 'Síntomas', severity: 'Severidad', problemCode: 'Problema' } as const;
const fields = Object.keys(labels) as (keyof LegacyObservationValues)[];

function snapshot(observation: LegacyObservation): LegacyObservationValues {
  const { notes, symptoms, severity, problemCode } = observation;
  return { notes, symptoms, severity, problemCode };
}

export default function LegacyObservationEditor({ event, disabled, onBusy, onSaved, onAuditStatus }: {
  event: FieldEvent;
  disabled: boolean;
  onBusy: (busy: boolean) => void;
  onSaved: (event: FieldEvent) => void;
  onAuditStatus: (revised: boolean) => void;
}) {
  const { mode, role, farmId, profile, notify } = useApp();
  const canEdit = role !== 'WORKER';
  const [record, setRecord] = useState<LegacyObservation>();
  const [problems, setProblems] = useState<SanitaryProblem[]>([]);
  const [error, setError] = useState('');
  const [loadError, setLoadError] = useState('');
  const [reload, setReload] = useState(0);
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    let active = true;
    setRecord(undefined);
    setLoadError('');
    const observation = mode === 'demo' ? Promise.resolve(demoLegacyObservation(event)) : legacyObservationApi.read(event.id);
    observation.then(result => {
      if (active) {
        setRecord(result);
        onAuditStatus(result.history.length > 0);
      }
    }).catch(failure => {
      if (active) setLoadError(failure instanceof Error ? failure.message : 'No se pudo cargar la observación.');
    });
    if (mode === 'demo') setProblems(loadSanitaryProblemsDemo());
    else {
      setProblems([]);
      api.sanitaryProblems(farmId, true).then(items => { if (active) setProblems(items); }).catch(() => {});
    }
    return () => { active = false; };
    // Saving updates the record directly. Load only when the selected observation changes or the user retries.
  }, [event.id, farmId, mode, onAuditStatus, reload]);

  function display(field: keyof LegacyObservationValues, value: string | number | null) {
    if (value == null || value === '') return 'Sin dato';
    return field === 'problemCode' ? problems.find(problem => problem.code === value)?.name ?? value : value;
  }

  async function save(submit: FormEvent<HTMLFormElement>) {
    submit.preventDefault();
    if (!record || disabled || !canEdit) return;
    const data = new FormData(submit.currentTarget);
    const field = (name: string) => String(data.get(name) ?? '').trim();
    const editedText = (name: 'notes' | 'symptoms') => {
      const value = String(data.get(name) ?? '');
      return value === (record[name] ?? '') ? record[name] : value.trim() || null;
    };
    const severity = field('severity');
    const after = { notes: editedText('notes'), symptoms: editedText('symptoms'),
      severity: severity ? Number(severity) : null, problemCode: field('problemCode') || null };
    const reason = field('reason');
    const before = snapshot(record);
    setError('');
    if (!reason) { setError('Explica el motivo del cambio.'); return; }
    if (fields.every(name => (before[name] ?? null) === after[name])) {
      setError('Cambia algún dato de la observación antes de guardar.'); return;
    }
    onBusy(true);
    try {
      const version = record.version + 1;
      const result = mode === 'live' ? await legacyObservationApi.edit(event.id, { ...after, reason, version: record.version }) : {
        ...record, ...after, version,
        history: [{ version, editedAt: new Date().toISOString(), editedByUserId: profile.user.id,
          editorName: profile.user.name, reason, before, after }, ...record.history],
      };
      setRecord(result);
      onAuditStatus(true);
      onSaved({ ...event, notes: result.notes ?? undefined, legacyObservation: result });
      setEditing(false);
      notify('Corrección guardada en el historial de la observación.');
    } catch (failure) {
      if (failure instanceof ApiError && failure.status === 409) {
        setEditing(false);
        setReload(value => value + 1);
      }
      setError(failure instanceof Error ? failure.message : 'No se pudo guardar la corrección.');
    } finally {
      onBusy(false);
    }
  }

  return <section className="activity-detail-section" aria-label="Observación histórica">
    <div className="panel-heading">
      <h3>Observación histórica</h3>
      {canEdit && record && <button type="button" className="text-button" disabled={disabled} aria-expanded={editing} onClick={() => {
        setError(''); setEditing(value => !value);
      }}><Pencil size={15} />{editing ? 'Cerrar edición' : 'Editar observación histórica'}</button>}
    </div>
    {loadError && <p className="form-error" role="alert">{loadError}{' '}
      <button type="button" className="text-button" onClick={() => setReload(value => value + 1)}>Reintentar</button>
    </p>}
    {!loadError && !record && <p role="status">Cargando observación histórica…</p>}
    {record && <>
      <dl className="detail-list">
        {fields.map(name => <div key={name}><dt>{labels[name]}</dt><dd>{display(name, record[name])}</dd></div>)}
        {record.suspectedCatalogId != null && <div><dt>Referencia anterior</dt><dd>#{record.suspectedCatalogId}</dd></div>}
      </dl>
      {editing && <form aria-label="Corregir observación histórica" className="form-grid inline-form" onSubmit={save}>
        <label>Problema fitosanitario<select name="problemCode" defaultValue={record.problemCode ?? ''} disabled={disabled}>
          <option value="">Sin problema seleccionado</option>
          {record.problemCode && !problems.some(problem => problem.active && problem.code === record.problemCode) &&
            <option value={record.problemCode}>{display('problemCode', record.problemCode)} · Selección histórica</option>}
          {problems.filter(problem => problem.active).map(problem => <option key={problem.code} value={problem.code}>{problem.name}</option>)}
        </select></label>
        <label>Severidad observada<select name="severity" defaultValue={record.severity ?? ''} disabled={disabled}>
          <option value="">Sin dato</option>
          {record.severity != null && (record.severity < 1 || record.severity > 5) && <option value={record.severity}>{record.severity} · Valor histórico</option>}
          {[1, 2, 3, 4, 5].map(value => <option key={value} value={value}>{value}</option>)}
        </select></label>
        <label className="full-span">Síntomas observados<textarea name="symptoms" defaultValue={record.symptoms ?? ''} maxLength={4000} disabled={disabled} /></label>
        <label className="full-span">Notas de la observación<textarea name="notes" defaultValue={record.notes ?? ''} maxLength={4000} disabled={disabled} /></label>
        <label className="full-span">Motivo del cambio<textarea name="reason" required maxLength={4000} disabled={disabled} /></label>
        <div className="form-actions full-span">
          <button type="button" className="button secondary" disabled={disabled} onClick={() => { setEditing(false); setError(''); }}>Cancelar</button>
          <button className="button" disabled={disabled}>Guardar corrección</button>
        </div>
      </form>}
      {error && <p role="alert" className="form-error">{error}</p>}
      <section aria-label="Historial de cambios">
        <h4>Historial de cambios</h4>
        {!record.history.length && <p className="muted">Sin cambios registrados.</p>}
        {record.history.map(item => <article className="activity-detail-section" key={item.version}>
          <p><strong>Versión {item.version}</strong> · {item.editorName || `Usuario #${item.editedByUserId}`} · <time dateTime={item.editedAt}>{new Date(item.editedAt).toLocaleString('es-CO')}</time></p>
          <p>{item.reason}</p>
          <dl className="detail-list">{fields.filter(name => item.before[name] !== item.after[name]).map(name => <div key={name}>
            <dt>{labels[name]}</dt><dd>Antes: {display(name, item.before[name])}</dd><dd>Después: {display(name, item.after[name])}</dd>
          </div>)}</dl>
        </article>)}
      </section>
    </>}
  </section>;
}
