import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { Plus } from 'lucide-react';
import { useApp } from '../context';
import { ApiError } from '../lib/api';
import { number } from '../lib/domain';
import { farmBusinessTimeZone, farmDateTimeInput, farmInputInstant } from '../lib/farm-business-date';
import type { Inspection } from '../lib/inspections';
import { treatmentFollowupApi, treatmentOutcomes } from '../lib/treatment-followups';
import type { TreatmentFollowup, TreatmentOutcome } from '../lib/treatment-followups';
import ApplicationLotSelect, { ApplicationProductSelect, useApplicationLots } from './ApplicationLotSelect';
import { Badge } from './ui';

type Action =
  | { kind: 'authorize'; requestId: string }
  | { kind: 'execute'; followup: TreatmentFollowup; operationId: string }
  | { kind: 'verify'; followup: TreatmentFollowup };

const labels = {
  authorize: 'Autorizar tratamiento',
  execute: 'Registrar ejecución',
  verify: 'Registrar verificación',
};

export default function TreatmentFollowups({ inspection, disabled, onBusyChange, onSaved }: {
  inspection: Inspection;
  disabled: boolean;
  onBusyChange: (busy: boolean) => void;
  onSaved: (records: TreatmentFollowup[], executed?: TreatmentFollowup) => void;
}) {
  const { mode, role, profile } = useApp();
  const live = mode === 'live';
  const dateAndAuthor = (instant: string, name?: string | null) =>
    [new Date(instant).toLocaleString('es-CO', { timeZone: live ? farmBusinessTimeZone : undefined }), name].filter(Boolean).join(' · ');
  const canReview = !!role && role !== 'WORKER';
  const [records, setRecords] = useState<TreatmentFollowup[]>(inspection.treatmentFollowups ?? []);
  const [action, setAction] = useState<Action | null>(null);
  const [loading, setLoading] = useState(live);
  const [loadError, setLoadError] = useState(false);
  const [saving, setSaving] = useState(false);
  const [reload, setReload] = useState(0);
  const [error, setError] = useState('');
  const [selectedLotId, setSelectedLotId] = useState<number>();
  const [recordedAt, setRecordedAt] = useState('');
  const executionInstant = useRef<string | undefined>(undefined);
  const expectedProduct = action?.kind === 'execute' ? action.followup.product : undefined;
  const expectedProductId = action?.kind === 'execute' ? action.followup.inventoryProductId : undefined;
  const appliedOn = recordedAt || farmDateTimeInput(executionInstant.current ? new Date(executionInstant.current) : undefined);
  const lots = useApplicationLots(live && (action?.kind === 'authorize' || expectedProduct) ? inspection.farmId : undefined, {
    productId: expectedProductId,
    productName: expectedProduct ?? undefined,
    appliedOn: appliedOn.slice(0, 10),
  });
  const selectedLot = lots.lots.find(lot => lot.id === selectedLotId);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (action) formRef.current?.querySelector<HTMLElement>('input, select, textarea')?.focus();
  }, [action]);

  useEffect(() => {
    if (!live) return;
    let active = true;
    setLoading(true);
    setLoadError(false);
    treatmentFollowupApi.list(inspection.id)
      .then(items => { if (active) setRecords(items); })
      .catch(() => { if (active) setLoadError(true); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [live, inspection.id, reload]);

  const writable = !inspection.canceledAt && !loading && !loadError;
  const start = (next: Action | null) => {
    setError(''); setAction(next); setSelectedLotId(undefined); setRecordedAt(''); executionInstant.current = undefined;
  };

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!action || disabled || saving) return;
    const fields = new FormData(event.currentTarget);
    const now = new Date().toISOString();
    const text = (name: string) => String(fields.get(name) ?? '').trim();
    const user = profile.user;
    const id = inspection.id;

    setError('');
    setSaving(true);
    onBusyChange(true);
    try {
      const instant = recordedAt ? (live ? farmInputInstant(recordedAt) : new Date(recordedAt).toISOString())
        : action.kind === 'execute' ? (executionInstant.current ??= now) : now;
      let saved: TreatmentFollowup;
      if (action.kind === 'authorize') {
        const description = text('description');
        if (!description) throw new Error('Describe el tratamiento que se autoriza.');
        const payload = { description, product: text('product') || null, requestId: action.requestId,
          inventoryProductId: text('inventoryProductId') ? Number(text('inventoryProductId')) : undefined };
        saved = live ? await treatmentFollowupApi.authorize(id, payload) : {
          id: Date.now(), inspectionId: id, description, product: payload.product, status: 'AUTHORIZED',
          authorizedByUserId: user.id, authorizedByName: user.name, authorizedAt: now, version: 0,
        };
      } else {
        const previous = action.followup;
        const earliest = action.kind === 'execute' ? previous.authorizedAt : previous.executedAt!;
        if (instant > now || Math.floor(Date.parse(instant) / 60_000) < Math.floor(Date.parse(earliest) / 60_000)) {
          throw new Error(action.kind === 'execute'
            ? 'La ejecución debe ocurrir entre la autorización y el momento actual.'
            : 'La verificación debe ocurrir entre la ejecución y el momento actual.');
        }
        if (action.kind === 'execute') {
          const productLot = text('productLot');
          const quantity = text('quantity') ? Number(text('quantity')) : null;
          const unit = text('unit');
          if (live) {
            if (previous.product && (!selectedLot || quantity == null)) throw new Error('Indica el lote de inventario y la cantidad aplicada.');
            saved = await treatmentFollowupApi.execute(id, previous.id, {
              version: previous.version, occurredAt: instant, inventoryLotId: selectedLot?.id,
              quantity: quantity ?? undefined, operationId: action.operationId,
            });
          } else {
            if (previous.product && !productLot) throw new Error('Indica el lote del producto aplicado.');
            if ((quantity === null) !== !unit) throw new Error('Indica cantidad y unidad juntas.');
            saved = {
              ...previous, status: 'EXECUTED', treatmentId: Date.now(), executedByUserId: user.id,
              executedByName: user.name, executedAt: instant, productLot: productLot || null,
              quantity, unit: unit || null, version: previous.version + 1,
            };
          }
        } else {
          const notes = text('notes');
          if (!notes) throw new Error('Registra las observaciones de la verificación.');
          const outcome = text('outcome') as TreatmentOutcome;
          const payload = { version: previous.version, verifiedAt: instant, outcome, notes };
          saved = live ? await treatmentFollowupApi.verify(id, previous.id, payload) : {
            ...previous, status: 'VERIFIED', verifiedByUserId: user.id, verifiedByName: user.name,
            verifiedAt: instant, outcome, verificationNotes: notes, version: previous.version + 1,
          };
        }
      }
      const next = action.kind === 'authorize'
        ? [saved, ...records.filter(record => record.id !== saved.id)]
        : records.map(record => record.id === saved.id ? saved : record);
      onSaved(next, action.kind === 'execute' ? saved : undefined);
      setRecords(next);
      start(null);
    } catch (failure) {
      if (failure instanceof ApiError && failure.status === 409 && action.kind === 'verify') {
        setAction(null);
        setReload(value => value + 1);
        setError('El tratamiento cambió. Revisa su estado actualizado antes de continuar.');
      } else {
        setError(failure instanceof Error ? failure.message : 'No se pudo guardar el seguimiento.');
      }
    } finally {
      setSaving(false);
      onBusyChange(false);
    }
  }

  return <section className="inspection-detail-section" aria-label="Seguimiento de tratamientos">
    <div className="inspection-section-heading">
      <h3>Seguimiento de tratamientos</h3>
      {writable && canReview && <button type="button" className="button secondary" disabled={disabled}
        onClick={() => start({ kind: 'authorize', requestId: crypto.randomUUID() })}>
        <Plus size={16} />Autorizar tratamiento
      </button>}
    </div>
    {loading && <p role="status">Cargando seguimiento de tratamientos…</p>}
    {loadError && <p role="alert" className="form-error">No se pudo cargar el seguimiento.{' '}
      <button type="button" className="text-button" onClick={() => setReload(value => value + 1)}>Reintentar</button>
    </p>}
    {writable && action && <form ref={formRef} aria-label={labels[action.kind]} className="inspection-form-grid inspection-action-form" onSubmit={submit}>
      {action.kind === 'authorize' ? <>
        {live ? <ApplicationProductSelect {...lots} label="Producto autorizado (opcional)" emptyLabel="Intervención sin producto" />
          : <label>Producto autorizado (opcional)<input name="product" maxLength={250} /></label>}
        <label className="inspection-full-row">Descripción de la autorización<textarea name="description" required maxLength={4000} /></label>
      </> : <>
        <p className="inspection-full-row">{action.followup.description}</p>
        <label>{action.kind === 'execute' ? 'Fecha de ejecución' : 'Fecha de verificación'} (opcional)
          <input type="datetime-local" name="recordedAt" aria-describedby="treatment-recorded-at-help" value={recordedAt}
            onChange={event => setRecordedAt(event.target.value)} />
        </label>
        <small id="treatment-recorded-at-help">{live && 'Hora de Colombia (UTC−05:00). '}Si se deja vacía se registra la hora actual.</small>
        {action.kind === 'execute' ? live ? action.followup.product && <>
          <ApplicationLotSelect {...lots} value={selectedLotId} onChange={lot => setSelectedLotId(lot?.id)} label="Lote del producto" />
          <label>Cantidad ejecutada{selectedLot ? ` (${selectedLot.unit})` : ''}<input name="quantity" type="number" min="0.000001" step="0.000001" max={selectedLot?.balance} required /></label>
        </> : <>
          {action.followup.product && <label>Lote del producto<input name="productLot" maxLength={80} required /></label>}
          <label>Cantidad ejecutada (opcional)<input name="quantity" type="number" min="0.000001" step="any" /></label>
          <label>Unidad ejecutada<input name="unit" maxLength={40} placeholder="kg, L…" /></label>
        </> : <>
          <label>Resultado de la verificación<select name="outcome" required defaultValue="">
            <option value="" disabled>Selecciona el resultado</option>
            {Object.entries(treatmentOutcomes).map(([value, label]) => <option value={value} key={value}>{label}</option>)}
          </select></label>
          <label className="inspection-full-row">Observaciones de la verificación<textarea name="notes" required maxLength={4000} /></label>
        </>}
      </>}
      <div className="form-actions inspection-full-row">
        <button type="button" className="button secondary" onClick={() => start(null)} disabled={disabled}>Cancelar</button>
        <button className="button" disabled={disabled}>{saving ? 'Guardando…' : labels[action.kind]}</button>
      </div>
    </form>}
    {error && <p role="alert" className="form-error">{error}</p>}
    {!loading && !loadError && !records.length && <p className="inspection-empty-copy">Sin tratamientos autorizados.</p>}
    {records.map(record => <article className="inspection-treatment" key={record.id} aria-label={`Seguimiento ${record.id}`}>
      <div>
        <strong>{record.appliedProduct ?? (record.product || 'Intervención sin producto')}</strong>
        {record.status === 'AUTHORIZED' ? <Badge tone="gold">Autorizado</Badge>
          : record.status === 'EXECUTED' ? <Badge tone="gold">Pendiente de verificación</Badge>
          : <Badge tone="green">Verificado</Badge>}
      </div>
      <p>{record.description}</p>
      <p>Autorización · {dateAndAuthor(record.authorizedAt, record.authorizedByName)}</p>
      {record.executedAt && <p>Ejecución · {dateAndAuthor(record.executedAt, record.executedByName)}</p>}
      {record.productLot && <p>Lote del producto · {record.productLot}</p>}
      {record.quantity != null && <p>Cantidad ejecutada · {number(record.quantity, 6)} {record.unit}</p>}
      {record.verifiedAt && <p>Verificación · {dateAndAuthor(record.verifiedAt, record.verifiedByName)}</p>}
      {record.outcome && <p>Resultado · {treatmentOutcomes[record.outcome]}</p>}
      {record.verificationNotes && <p>{record.verificationNotes}</p>}
      {writable && record.status === 'AUTHORIZED' && <button type="button" className="text-button" disabled={disabled}
        onClick={() => start({ kind: 'execute', followup: record, operationId: crypto.randomUUID() })}>Registrar ejecución</button>}
      {writable && record.status === 'EXECUTED' && canReview && <button type="button" className="text-button" disabled={disabled}
        onClick={() => start({ kind: 'verify', followup: record })}>Registrar verificación</button>}
    </article>)}
  </section>;
}
