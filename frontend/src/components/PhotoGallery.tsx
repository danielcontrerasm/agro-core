import { useEffect, useRef, useState } from 'react';
import type { ChangeEvent } from 'react';
import { useApp } from '../context';
import { api } from '../lib/api';
import { demoPhotoList, preparePhoto, saveDemoPhoto } from '../lib/photos';
import type { Photo, PhotoTarget } from '../lib/photos';
import type { InspectionTreatment } from '../lib/inspections';

interface DisplayPhoto extends Photo { url: string }

export default function PhotoGallery({ target, treatments = [], readOnly = false, onBusyChange }: { target: PhotoTarget; treatments?: InspectionTreatment[]; readOnly?: boolean; onBusyChange?: (busy: boolean) => void }) {
  const { mode, profile } = useApp();
  const [photos, setPhotos] = useState<DisplayPhoto[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');
  const [treatmentId, setTreatmentId] = useState('');
  const [enlarged, setEnlarged] = useState<string | null>(null);
  const objectUrls = useRef<string[]>([]);
  const mounted = useRef(true);
  const uploading = useRef(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const cameraInput = useRef<HTMLInputElement>(null);
  useEffect(() => {
    mounted.current = true; let active = true; setLoading(true); setError(''); setPhotos([]); setEnlarged(null); setTreatmentId('');
    const load = mode === 'demo' ? demoPhotoList(target).then(items => items.map(item => {
      const url = URL.createObjectURL(item.blob); objectUrls.current.push(url); return { ...item, url };
    })) : api.photos(target).then(items => items.map(item => ({ ...item, url: `/api/v1/photos/${item.id}/content` })));
    load.then(items => { if (active) setPhotos(items); }).catch(failure => { if (active) setError(failure.message); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; mounted.current = false; objectUrls.current.forEach(url => URL.revokeObjectURL(url)); objectUrls.current = []; };
  }, [mode, target.eventId, target.inspectionId, target.treatmentId]);

  async function upload(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.currentTarget.files ?? []); event.currentTarget.value = '';
    if (!files.length || readOnly || uploading.current) return;
    if (files.length > 10) { setError('Selecciona como máximo 10 fotos por carga.'); return; }
    uploading.current = true; setBusy(true); onBusyChange?.(true); setError(''); setStatus('');
    let savedCount = 0;
    try {
      for (const file of files) {
        const blob = await preparePhoto(file);
        const destination = { ...target, ...(treatmentId ? { treatmentId: Number(treatmentId) } : {}) };
        let saved: DisplayPhoto;
        if (mode === 'demo') {
          const photo = { ...destination, id: crypto.randomUUID(), originalName: file.name, contentType: blob.type, sizeBytes: blob.size, createdByUserId: profile.user.id, createdAt: new Date().toISOString(), blob };
          await saveDemoPhoto(photo);
          const url = URL.createObjectURL(blob); objectUrls.current.push(url); saved = { ...photo, url };
        } else {
          const photo = await api.uploadPhoto(destination, blob, file.name); saved = { ...photo, url: `/api/v1/photos/${photo.id}/content` };
        }
        savedCount++;
        if (mounted.current) setPhotos(previous => [...previous, saved]);
      }
    } catch (failure) { if (mounted.current) setError((savedCount ? `Se guardaron ${savedCount} fotos. ` : '') + (failure instanceof Error ? failure.message : 'No se pudo guardar la foto.')); }
    finally {
      uploading.current = false; onBusyChange?.(false);
      if (mounted.current) { setBusy(false); setStatus(savedCount ? `${savedCount} foto(s) guardada(s).` : ''); }
    }
  }

  const selected = photos.find(photo => photo.id === enlarged);
  return <section className="photo-gallery form-stack" aria-label="Fotos adjuntas">
    <h3>Fotos adjuntas</h3>
    {!readOnly && <>
      {target.inspectionId != null && treatments.length > 0 && <label>Asociar fotos a<select disabled={busy} value={treatmentId} onChange={event => setTreatmentId(event.target.value)}><option value="">Inspección</option>{treatments.map(item => <option key={item.id} value={item.id}>Tratamiento #{item.id}: {item.description}</option>)}</select></label>}
      <p className="muted">JPEG o PNG, hasta 10 MB y 24 megapíxeles por foto.{mode === 'demo' ? ' Las fotos demo se guardan en este navegador.' : ''}</p>
      <div className="photo-actions"><button type="button" className="button secondary small" disabled={busy || loading} onClick={() => fileInput.current?.click()}>Elegir fotos</button><button type="button" className="button secondary small" disabled={busy || loading} onClick={() => cameraInput.current?.click()}>Tomar foto</button></div>
      <input ref={fileInput} type="file" accept="image/jpeg,image/png" multiple hidden aria-label="Seleccionar fotos" disabled={busy} onChange={event => void upload(event)} />
      <input ref={cameraInput} type="file" accept="image/jpeg,image/png" capture="environment" hidden aria-label="Capturar foto" disabled={busy} onChange={event => void upload(event)} />
    </>}
    {loading && <p role="status">Cargando fotos…</p>}{busy && <p role="status">Guardando fotos…</p>}{status && <p role="status">{status}</p>}
    {error && <p className="form-error" role="alert">{error}</p>}
    {!loading && !error && !photos.length && <p>Sin fotos adjuntas.</p>}
    <div className="photo-grid">{photos.map(photo => <figure key={photo.id}><button type="button" className="photo-thumbnail" aria-label={`Ver foto ${photo.originalName}`} onClick={() => setEnlarged(photo.id)}><img src={photo.url} alt={photo.originalName} loading="lazy" onError={() => setError('No se pudo mostrar una foto. Revisa tu sesión o vuelve a abrir el detalle.')} /></button><figcaption>{photo.originalName}{photo.treatmentId && <small>Tratamiento #{photo.treatmentId}</small>}<a href={mode === 'live' ? `${photo.url}?download=true` : photo.url} download={photo.originalName}>Descargar foto</a></figcaption></figure>)}</div>
    {selected && <div className="photo-expanded"><button type="button" className="button secondary small" onClick={() => setEnlarged(null)}>Cerrar vista ampliada</button><img src={selected.url} alt={`Foto ampliada: ${selected.originalName}`} /></div>}
  </section>;
}
