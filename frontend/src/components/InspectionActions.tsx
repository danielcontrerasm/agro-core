import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { useApp } from '../context';
import { api } from '../lib/api';
import { csvCell, localDate, number } from '../lib/domain';
import type { Inspection, InspectionEvidence, InspectionTreatment, NewEvidence, NewTreatment } from '../lib/inspections';
import PhotoGallery from './PhotoGallery';

export default function InspectionActions({ inspection, related, onOpen, onUpdate, onFollowUp, onBusyChange }: { inspection: Inspection; related: Inspection[]; onOpen: (id: number) => void; onUpdate: (record: Inspection) => void; onFollowUp: () => void; onBusyChange: (busy: boolean) => void }) {
  const { mode, role, profile } = useApp();
  const [treatments, setTreatments] = useState<InspectionTreatment[]>([]);
  const [evidence, setEvidence] = useState<InspectionEvidence[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [action, setAction] = useState<'treatment' | 'evidence' | 'cancel' | null>(null);
  useEffect(() => {
    let active = true; setError(''); setLoading(true);
    if (mode === 'demo') { setTreatments(inspection.treatments ?? []); setEvidence(inspection.evidence ?? []); setLoading(false); return; }
    Promise.all([api.inspectionTreatments(inspection.id), api.inspectionEvidence(inspection.id)])
      .then(([savedTreatments, savedEvidence]) => { if (active) { setTreatments(savedTreatments); setEvidence(savedEvidence); } })
      .catch(failure => { if (active) setError(failure.message); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [inspection.id, mode]);
  const now = new Date();
  const localTime = `${localDate(now)}T${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

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

  return <section className="form-stack">
    {inspection.parentInspectionId && <p>Seguimiento de inspección #{inspection.parentInspectionId}{related.some(item => item.id === inspection.parentInspectionId) && <button className="text-button" disabled={busy} onClick={() => onOpen(inspection.parentInspectionId!)}>Ver inspección de origen</button>}</p>}
    {related.filter(item => item.parentInspectionId === inspection.id).map(item => <button className="text-button" disabled={busy} key={item.id} onClick={() => onOpen(item.id)}>Ver seguimiento #{item.id}{item.canceledAt ? ' · Anulado' : ''}</button>)}
    {inspection.canceledAt && <p role="status">Anulada: {inspection.cancellationReason} · {new Date(inspection.canceledAt).toLocaleString('es-CO')} · Usuario #{inspection.canceledByUserId}</p>}
    <h3>Tratamientos realizados</h3>
    <button className="text-button" disabled={loading || !treatments.length} onClick={exportTreatments}>Exportar tratamientos CSV</button>
    {loading ? <p role="status">Cargando tratamientos y evidencias…</p> : !treatments.length && <p>Sin tratamientos registrados.</p>}
    {treatments.map(item => <article className="instructions" key={item.id}><h4>Tratamiento #{item.id}</h4><p>{item.description}</p><p>{item.product}{item.quantity != null ? ` · ${number(item.quantity, 2)} ${item.unit}` : ''}</p><small>{new Date(item.occurredAt).toLocaleString('es-CO')} · {item.authorName}</small></article>)}
    <PhotoGallery target={{ inspectionId: inspection.id }} treatments={treatments} readOnly={!!inspection.canceledAt} onBusyChange={value => { setBusy(value); onBusyChange(value); }} />
    <h3>Referencias de evidencia</h3><p className="muted">Aquí se conservan las referencias externas de archivos registradas previamente.</p>
    {!loading && !evidence.length && <p>Sin evidencias registradas.</p>}
    {evidence.map(item => <div className="media-record" key={item.id}><div><strong>{item.s3Key}</strong><small>{item.kind} · {item.contentType || 'Sin tipo'} · {item.treatmentId ? `Tratamiento #${item.treatmentId}` : 'Inspección'} · {item.authorName}</small></div></div>)}
    {!inspection.canceledAt && !loading && <div className="heading-buttons"><button className="button secondary small" disabled={busy} onClick={() => { setError(''); setAction('treatment'); }}>Registrar tratamiento</button><button className="button secondary small" disabled={busy} onClick={() => { setError(''); setAction('evidence'); }}>Registrar evidencia</button><button className="button secondary small" disabled={busy} onClick={onFollowUp}>Registrar seguimiento</button></div>}
    {action && !inspection.canceledAt && <form className="form-stack inline-form" onSubmit={submit}>
      {action === 'treatment' && <><p>Registra lo ejecutado según el plan aprobado por el responsable técnico.</p><label>Fecha del tratamiento<input name="occurredAt" type="datetime-local" required defaultValue={localTime} max={localTime} /></label><label>Descripción del tratamiento<textarea name="description" required maxLength={4000} /></label><label>Producto utilizado (opcional)<input name="product" maxLength={250} /></label><div className="form-grid"><label>Cantidad aplicada (opcional)<input name="quantity" type="number" min="0.000001" step="any" /></label><label>Unidad de cantidad<input name="unit" maxLength={40} placeholder="kg, L…" /></label></div></>}
      {action === 'evidence' && <><label>Asociar evidencia a<select name="treatmentId"><option value="">Inspección</option>{treatments.map(item => <option key={item.id} value={item.id}>Tratamiento #{item.id}: {item.description}</option>)}</select></label><label>Tipo de evidencia<select name="kind"><option value="IMAGE">Imagen</option><option value="DOCUMENT">Documento</option><option value="VIDEO">Video</option></select></label><label>Referencia S3<input name="s3Key" required maxLength={1024} /></label><label>Tipo de contenido<input name="contentType" maxLength={150} placeholder="image/jpeg" /></label></>}
      {action === 'cancel' && <><p>La inspección y sus tratamientos se conservarán en el historial. Dejará de participar en la capa de salud.</p><label>Motivo de anulación<textarea name="reason" required maxLength={4000} /></label></>}
      <div className="form-actions"><button type="button" className="button secondary" disabled={busy} onClick={() => setAction(null)}>Cancelar</button><button className="button" disabled={busy}>{busy ? 'Guardando…' : action === 'cancel' ? 'Confirmar anulación' : action === 'evidence' ? 'Guardar evidencia' : 'Guardar tratamiento'}</button></div>
    </form>}
    {error && <p className="form-error" role="alert">{error}</p>}
    {!inspection.canceledAt && role !== 'WORKER' && <button className="text-button text-red" disabled={busy} onClick={() => { setError(''); setAction('cancel'); }}>Anular inspección</button>}
  </section>;
}
