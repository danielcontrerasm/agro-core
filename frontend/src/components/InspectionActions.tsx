import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { Download, FileText, Plus } from 'lucide-react';
import { useApp } from '../context';
import { api } from '../lib/api';
import { csvCell, localDate, number } from '../lib/domain';
import type { Inspection, InspectionEvidence, InspectionTreatment, NewEvidence, NewTreatment } from '../lib/inspections';
import type { TreatmentFollowup } from '../lib/treatment-followups';
import PhotoGallery from './PhotoGallery';
import TreatmentFollowups from './TreatmentFollowups';

export default function InspectionActions({ inspection, related, onOpen, onUpdate, onFollowUp, onBusyChange }: { inspection: Inspection; related: Inspection[]; onOpen: (id: number) => void; onUpdate: (record: Inspection) => void; onFollowUp: () => void; onBusyChange: (busy: boolean) => void }) {
  const { mode, role, profile } = useApp();
  const [treatments, setTreatments] = useState<InspectionTreatment[]>([]);
  const [evidence, setEvidence] = useState<InspectionEvidence[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [action, setAction] = useState<'treatment' | 'evidence' | 'cancel' | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (action) formRef.current?.querySelector<HTMLElement>('input, select, textarea')?.focus();
  }, [action]);
  useEffect(() => {
    let active = true; setLoadError(''); setError(''); setLoading(true);
    if (mode === 'demo') { setTreatments(inspection.treatments ?? []); setEvidence(inspection.evidence ?? []); setLoading(false); return; }
    Promise.all([api.inspectionTreatments(inspection.id), api.inspectionEvidence(inspection.id)])
      .then(([savedTreatments, savedEvidence]) => { if (active) { setTreatments(savedTreatments); setEvidence(savedEvidence); } })
      .catch(failure => { if (active) setLoadError(failure instanceof Error ? failure.message : 'No se pudieron cargar los tratamientos y las evidencias.'); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [inspection.id, mode]);
  const now = new Date();
  const localTime = `${localDate(now)}T${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

  function saveFollowups(records: TreatmentFollowup[], executed?: TreatmentFollowup) {
    let nextTreatments = treatments;
    if (executed?.treatmentId && executed.executedAt && executed.executedByUserId != null) {
      const treatment: InspectionTreatment = {
        id: executed.treatmentId, inspectionId: inspection.id, occurredAt: executed.executedAt,
        description: executed.description, product: executed.product, quantity: executed.quantity,
        unit: executed.unit, createdByUserId: executed.executedByUserId, authorName: executed.executedByName ?? '',
      };
      nextTreatments = [treatment, ...treatments.filter(item => item.id !== treatment.id)];
    }
    if (mode === 'demo') onUpdate({ ...inspection, treatments: nextTreatments, evidence, treatmentFollowups: records });
    if (executed) setTreatments(nextTreatments);
  }

  function exportTreatments() {
    const rows = [['Inspección ID', 'Tratamiento ID', 'Fecha UTC', 'Descripción', 'Producto', 'Cantidad', 'Unidad', 'Responsable', 'Referencias de evidencia', 'Motivo de anulación de inspección'],
      ...treatments.map(item => [inspection.id, item.id, item.occurredAt, item.description, item.product, item.quantity, item.unit, item.authorName, evidence.filter(file => file.treatmentId === item.id).map(file => file.s3Key).join('; '), inspection.cancellationReason])];
    const content = '\uFEFF' + rows.map(row => row.map(csvCell).join(',')).join('\r\n');
    const url = URL.createObjectURL(new Blob([content], { type: 'text/csv;charset=utf-8;' }));
    const anchor = document.createElement('a'); anchor.href = url; anchor.download = `tratamientos-inspeccion-${inspection.id}-${mode}.csv`;
    document.body.appendChild(anchor); anchor.click(); anchor.remove(); window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (busy) return;
    const form = event.currentTarget;
    const fields = new FormData(form); setError(''); setBusy(true); onBusyChange(true);
    try {
      if (action === 'treatment') {
        const quantityText = String(fields.get('quantity') ?? '').trim();
        const unit = String(fields.get('unit') ?? '').trim();
        if (Boolean(quantityText) !== Boolean(unit)) throw new Error('Indica cantidad y unidad juntas.');
        const payload: NewTreatment = { occurredAt: new Date(String(fields.get('occurredAt'))).toISOString(), description: String(fields.get('description')).trim(), product: String(fields.get('product')).trim() || null, quantity: quantityText ? Number(quantityText) : null, unit: unit || null };
        if (payload.occurredAt < inspection.inspectedAt) throw new Error('El tratamiento no puede ser anterior a la inspección.');
        const saved = mode === 'live' ? await api.addInspectionTreatment(inspection.id, payload) : { ...payload, id: Date.now(), inspectionId: inspection.id, createdByUserId: profile.user.id, authorName: profile.user.name };
        const next = [saved, ...treatments];
        if (mode === 'demo') onUpdate({ ...inspection, treatments: next, evidence });
        setTreatments(next);
      } else if (action === 'evidence') {
        const payload: NewEvidence = { treatmentId: fields.get('treatmentId') ? Number(fields.get('treatmentId')) : null, kind: String(fields.get('kind')) as NewEvidence['kind'], s3Key: String(fields.get('s3Key')).trim(), contentType: String(fields.get('contentType')).trim() || null };
        const saved = mode === 'live' ? await api.addInspectionEvidence(inspection.id, payload) : { ...payload, id: Date.now(), inspectionId: inspection.id, createdByUserId: profile.user.id, authorName: profile.user.name, createdAt: new Date().toISOString() };
        const next = [saved, ...evidence];
        if (mode === 'demo') onUpdate({ ...inspection, treatments, evidence: next });
        setEvidence(next);
      } else if (action === 'cancel') {
        const reason = String(fields.get('reason')).trim();
        if (!reason) throw new Error('Debes justificar la anulación.');
        const saved = mode === 'live' ? await api.cancelInspection(inspection.id, reason, inspection.version) : { ...inspection, treatments, evidence, canceledAt: new Date().toISOString(), canceledByUserId: profile.user.id, cancellationReason: reason, version: inspection.version + 1 };
        onUpdate(saved);
      }
      setAction(null);
    } catch (failure) { setError(failure instanceof Error ? failure.message : 'No se pudo guardar.'); } finally { setBusy(false); onBusyChange(false); }
  }

  const followUps = related.filter(item => item.parentInspectionId === inspection.id);
  const writable = !inspection.canceledAt && !loading && !loadError;
  const chooseAction = (next: typeof action) => { setError(''); setAction(next); };
  const actionFooter = (label: string) => <>
    {error && <p className="form-error inspection-full-row" role="alert">{error}</p>}
    <div className="form-actions inspection-full-row">
      <button type="button" className="button secondary" disabled={busy} onClick={() => chooseAction(null)}>Cancelar</button>
      <button className="button" disabled={busy}>{busy ? 'Guardando…' : label}</button>
    </div>
  </>;
  return <>
    {inspection.canceledAt && <p className="inspection-cancellation" role="status"><strong>Anulada: {inspection.cancellationReason}</strong><span>{new Date(inspection.canceledAt).toLocaleString('es-CO')} · Usuario #{inspection.canceledByUserId}</span></p>}
    <section className="inspection-detail-section">
      <div className="inspection-section-heading">
        <h3>Tratamientos realizados</h3>
        {writable && <button className="button secondary" disabled={busy} onClick={() => chooseAction('treatment')}><Plus size={16} />Registrar tratamiento</button>}
      </div>
      {action === 'treatment' && writable && <form ref={formRef} className="inspection-form-grid inspection-action-form" onSubmit={submit}>
        <label>Fecha del tratamiento<input name="occurredAt" type="datetime-local" required defaultValue={localTime} max={localTime} /></label>
        <label>Producto utilizado (opcional)<input name="product" maxLength={250} /></label>
        <label>Cantidad aplicada (opcional)<input name="quantity" type="number" min="0.000001" step="any" /></label>
        <label>Unidad de cantidad<input name="unit" maxLength={40} placeholder="kg, L…" /></label>
        <label className="inspection-full-row">Descripción del tratamiento<textarea name="description" required maxLength={4000} /></label>
        {actionFooter('Guardar tratamiento')}
      </form>}
      {loading ? <p role="status">Cargando tratamientos y evidencias…</p> : loadError ? <p className="form-error" role="alert">{loadError}</p> : !treatments.length && <p className="inspection-empty-copy">Sin tratamientos registrados.</p>}
      {treatments.map(item => <article className="inspection-treatment" key={item.id}>
        <div><strong>{item.product || 'Tratamiento aplicado'}</strong>{item.quantity != null && <span>{number(item.quantity, 2)} {item.unit}</span>}</div>
        <p>{item.description}</p>
        <small>{new Date(item.occurredAt).toLocaleString('es-CO')} · {item.authorName}</small>
      </article>)}
      {treatments.length > 0 && <button className="text-button" onClick={exportTreatments}><Download size={15} />Exportar tratamientos CSV</button>}
    </section>
    <TreatmentFollowups inspection={inspection} disabled={busy || loading} onSaved={saveFollowups} onBusyChange={value => {
      setBusy(value);
      onBusyChange(value);
    }} />
    <section className="inspection-detail-section">
      <PhotoGallery target={{ inspectionId: inspection.id }} treatments={treatments} readOnly={!!inspection.canceledAt} onBusyChange={value => { setBusy(value); onBusyChange(value); }} />
    </section>
    <section className="inspection-detail-section">
      <div className="inspection-section-heading">
        <h3>Referencias de evidencia</h3>
        {writable && <button className="button secondary" disabled={busy} onClick={() => chooseAction('evidence')}><Plus size={16} />Registrar evidencia</button>}
      </div>
      {action === 'evidence' && writable && <form ref={formRef} className="inspection-form-grid inspection-action-form" onSubmit={submit}>
        <label>Asociar evidencia a<select name="treatmentId"><option value="">Inspección</option>{treatments.map(item => <option key={item.id} value={item.id}>Tratamiento #{item.id}: {item.description}</option>)}</select></label>
        <label>Tipo de evidencia<select name="kind"><option value="IMAGE">Imagen</option><option value="DOCUMENT">Documento</option><option value="VIDEO">Video</option></select></label>
        <label>Referencia S3<input name="s3Key" required maxLength={1024} /></label>
        <label>Tipo de contenido<input name="contentType" maxLength={150} placeholder="image/jpeg" /></label>
        {actionFooter('Guardar evidencia')}
      </form>}
      {!loading && !loadError && !evidence.length && <p className="inspection-empty-copy">Sin evidencias registradas.</p>}
      {evidence.map(item => <div className="inspection-evidence" key={item.id}><FileText size={20} /><div><strong>{item.s3Key}</strong><small>{item.contentType || item.kind} · {item.treatmentId ? `Tratamiento #${item.treatmentId}` : 'Inspección'} · {item.authorName}</small></div></div>)}
    </section>
    {(writable || inspection.parentInspectionId || followUps.length > 0) && <section className="inspection-detail-section">
      <div className="inspection-section-heading">
        <h3>Seguimiento</h3>
        {writable && <button className="button secondary" disabled={busy} onClick={onFollowUp}><Plus size={16} />Registrar seguimiento</button>}
      </div>
      {inspection.parentInspectionId && <div className="inspection-follow-up"><p>Seguimiento de inspección #{inspection.parentInspectionId}</p>{related.some(item => item.id === inspection.parentInspectionId) && <button className="text-button" disabled={busy} onClick={() => onOpen(inspection.parentInspectionId!)}>Ver inspección de origen</button>}</div>}
      {followUps.map(item => <button className="text-button" disabled={busy} key={item.id} onClick={() => onOpen(item.id)}>Ver seguimiento #{item.id}{item.canceledAt ? ' · Anulado' : ''}</button>)}
      {!inspection.parentInspectionId && !followUps.length && <p className="inspection-empty-copy">Sin inspecciones de seguimiento registradas.</p>}
    </section>}
    {error && !action && <p className="form-error" role="alert">{error}</p>}
    {!inspection.canceledAt && role !== 'WORKER' && <section className="inspection-detail-section">
      <button className="text-button text-red" disabled={busy} onClick={() => chooseAction('cancel')}>Anular inspección</button>
      {action === 'cancel' && <form ref={formRef} className="inspection-form-grid inspection-action-form" onSubmit={submit}>
        <p className="inspection-full-row">La inspección y sus tratamientos se conservarán en el historial. Dejará de participar en la capa de salud.</p>
        <label className="inspection-full-row">Motivo de anulación<textarea name="reason" required maxLength={4000} /></label>
        {actionFooter('Confirmar anulación')}
      </form>}
    </section>}
  </>;
}
