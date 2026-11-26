import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { Plus } from 'lucide-react';
import { useApp } from '../context';
import type { Inspection } from '../lib/inspections';
import { laboratoryOutcomes, laboratoryResultsApi } from '../lib/laboratory-results';
import type { LaboratoryOutcome, LaboratoryResult, LaboratoryResultInput } from '../lib/laboratory-results';
import { Badge } from './ui';

const formatDay = (date: string) => new Date(`${date}T00:00:00`).toLocaleDateString('es-CO', {
  day: 'numeric', month: 'short', year: 'numeric',
});

export default function InspectionLaboratoryResults({ inspection, disabled, onSaved, onBusyChange }: {
  inspection: Inspection;
  disabled: boolean;
  onSaved: (inspection: Inspection) => void;
  onBusyChange: (busy: boolean) => void;
}) {
  const { mode, role, profile } = useApp();
  const live = mode === 'live';
  const [records, setRecords] = useState<LaboratoryResult[]>(inspection.laboratoryResults ?? []);
  const [loading, setLoading] = useState(live);
  const [loadError, setLoadError] = useState(false);
  const [reload, setReload] = useState(0);
  const [requestId, setRequestId] = useState<string>();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const firstField = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!live) return;
    let active = true;
    setLoading(true);
    setLoadError(false);
    laboratoryResultsApi.list(inspection.id)
      .then(items => { if (active) setRecords(items); })
      .catch(() => { if (active) setLoadError(true); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [live, inspection.id, reload]);

  useEffect(() => {
    if (requestId) firstField.current?.focus();
  }, [requestId]);

  const writable = !inspection.canceledAt && !!role && role !== 'WORKER' && !loading && !loadError;
  const today = new Date().toISOString().slice(0, 10);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!requestId || disabled || saving || !writable) return;
    const fields = new FormData(event.currentTarget);
    const text = (name: string) => String(fields.get(name) ?? '').trim();
    const payload: LaboratoryResultInput = {
      sampleReference: text('sampleReference'),
      laboratory: text('laboratory'),
      sampledOn: text('sampledOn'),
      resultOn: text('resultOn'),
      outcome: text('outcome') as LaboratoryOutcome,
      notes: text('notes') || undefined,
      reportReference: text('reportReference') || undefined,
    };
    if (!payload.sampleReference || !payload.laboratory) {
      setError('Indica la referencia de la muestra y el laboratorio.');
      return;
    }
    if (!payload.sampledOn || !payload.resultOn || payload.resultOn < payload.sampledOn || payload.resultOn > today) {
      setError('La fecha del resultado debe estar entre la toma de la muestra y hoy.');
      return;
    }
    setError('');
    setSaving(true);
    onBusyChange(true);
    try {
      const saved = live ? await laboratoryResultsApi.record(inspection.id, { ...payload, requestId }) : {
        ...payload, id: Date.now(), inspectionId: inspection.id, createdByUserId: profile.user.id,
        createdByName: profile.user.name, createdAt: new Date().toISOString(),
      };
      const next = [saved, ...records.filter(record => record.id !== saved.id)]
        .sort((first, second) => second.resultOn.localeCompare(first.resultOn) || second.id - first.id);
      if (!live) onSaved({ ...inspection, laboratoryResults: next });
      setRecords(next);
      setRequestId(undefined);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'No se pudo guardar el resultado.');
    } finally {
      setSaving(false);
      onBusyChange(false);
    }
  }

  return <section className="inspection-detail-section" aria-label="Resultados de laboratorio">
    <div className="inspection-section-heading">
      <h3>Resultados de laboratorio</h3>
      {writable && !requestId && <button type="button" className="button secondary" disabled={disabled}
        onClick={() => { setError(''); setRequestId(crypto.randomUUID()); }}><Plus size={16} />Registrar resultado de laboratorio</button>}
    </div>
    {writable && requestId && <form className="inspection-form-grid inspection-action-form" aria-label="Registrar resultado de laboratorio" onSubmit={submit}>
      <label>Referencia de la muestra<input ref={firstField} name="sampleReference" maxLength={120} required /></label>
      <label>Laboratorio<input name="laboratory" maxLength={200} required /></label>
      <label>Fecha de toma de muestra<input name="sampledOn" type="date" max={today} defaultValue={inspection.inspectedAt.slice(0, 10)} required /></label>
      <label>Fecha del resultado<input name="resultOn" type="date" max={today} defaultValue={today} required /></label>
      <label>Resultado informado<select name="outcome" defaultValue="" required>
        <option value="" disabled>Selecciona un resultado</option>
        {Object.entries(laboratoryOutcomes).map(([outcome, label]) => <option key={outcome} value={outcome}>{label}</option>)}
      </select></label>
      <label>Referencia del informe (opcional)<input name="reportReference" maxLength={1024} /></label>
      <label className="inspection-full-row">Notas del resultado (opcional)<textarea name="notes" maxLength={4000} /></label>
      {error && <p className="form-error inspection-full-row" role="alert">{error}</p>}
      <div className="form-actions inspection-full-row">
        <button type="button" className="button secondary" disabled={disabled || saving}
          onClick={() => { setError(''); setRequestId(undefined); }}>Cancelar</button>
        <button type="submit" className="button" disabled={disabled || saving}>{saving ? 'Guardando…' : 'Guardar resultado'}</button>
      </div>
    </form>}
    {loading && <p role="status">Cargando resultados de laboratorio…</p>}
    {loadError && <p role="alert" className="form-error">No se pudieron cargar los resultados.{' '}
      <button type="button" className="text-button" onClick={() => setReload(value => value + 1)}>Reintentar</button>
    </p>}
    {!loading && !loadError && !records.length && <p className="inspection-empty-copy">Sin resultados de laboratorio registrados.</p>}
    {records.map(result => <article className="inspection-treatment" key={result.id}>
      <div>
        <strong>{result.sampleReference}</strong>
        <Badge tone={result.outcome === 'CONFIRMED' ? 'red' : result.outcome === 'INCONCLUSIVE' ? 'gold' : 'neutral'}>
          {laboratoryOutcomes[result.outcome]}
        </Badge>
      </div>
      <dl className="inspection-detail-copy">
        <div><dt>Laboratorio</dt><dd>{result.laboratory}</dd></div>
        <div><dt>Toma de muestra</dt><dd><time dateTime={result.sampledOn}>{formatDay(result.sampledOn)}</time></dd></div>
        <div><dt>Fecha del resultado</dt><dd><time dateTime={result.resultOn}>{formatDay(result.resultOn)}</time></dd></div>
        {result.reportReference && <div><dt>Informe</dt><dd>{result.reportReference}</dd></div>}
        {result.notes && <div><dt>Notas</dt><dd>{result.notes}</dd></div>}
      </dl>
      <small>Registrado por {result.createdByName} · <time dateTime={result.createdAt}>{new Date(result.createdAt).toLocaleString('es-CO')}</time></small>
    </article>)}
  </section>;
}
