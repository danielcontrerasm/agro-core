export interface PhotoTarget { eventId?: number; inspectionId?: number; treatmentId?: number }
export interface Photo extends PhotoTarget {
  id: string; originalName: string; contentType: string; sizeBytes: number;
  createdByUserId: number; createdAt: string;
}
export interface DemoPhoto extends Photo { blob: Blob }
export const maxPhotoBytes = 10 * 1024 * 1024;

export function photoQuery(target: PhotoTarget) {
  const query = new URLSearchParams();
  if (target.eventId != null) query.set('eventId', String(target.eventId));
  if (target.inspectionId != null) query.set('inspectionId', String(target.inspectionId));
  if (target.treatmentId != null) query.set('treatmentId', String(target.treatmentId));
  return query.toString();
}

export async function preparePhoto(file: File): Promise<Blob> {
  if (!['image/jpeg', 'image/png'].includes(file.type)) throw new Error('Selecciona una foto JPEG o PNG.');
  if (!file.size || file.size > maxPhotoBytes) throw new Error('Cada foto debe pesar como máximo 10 MB y no estar vacía.');
  let bitmap: ImageBitmap;
  try { bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' }); }
  catch { throw new Error('No se pudo leer la foto. Selecciona un JPEG o PNG válido.'); }
  try {
    if (bitmap.width * bitmap.height > 24_000_000) throw new Error('La foto debe tener como máximo 24 megapíxeles.');
    const canvas = document.createElement('canvas'); canvas.width = bitmap.width; canvas.height = bitmap.height;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('No se pudo preparar la foto.');
    context.drawImage(bitmap, 0, 0);
    const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(value => value ? resolve(value) : reject(new Error('No se pudo preparar la foto.')), file.type, .92));
    if (blob.size > maxPhotoBytes) throw new Error('La foto procesada supera los 10 MB.');
    return blob;
  } finally { bitmap.close(); }
}

async function photoDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('agrovision-photos', 1);
    request.onupgradeneeded = () => request.result.createObjectStore('photos', { keyPath: 'id' });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(new Error('No se pudo abrir el almacenamiento de fotos de demostración.'));
  });
}

export async function demoPhotoList(target: PhotoTarget): Promise<DemoPhoto[]> {
  const database = await photoDatabase();
  try {
    const photos = await new Promise<DemoPhoto[]>((resolve, reject) => {
      const transaction = database.transaction('photos', 'readonly');
      const request = transaction.objectStore('photos').getAll();
      transaction.oncomplete = () => resolve(request.result);
      transaction.onabort = () => reject(new Error('No se pudieron leer las fotos de demostración.'));
    });
    return photos.filter(photo => target.eventId != null ? photo.eventId === target.eventId : photo.inspectionId === target.inspectionId)
      .filter(photo => target.treatmentId == null || photo.treatmentId === target.treatmentId);
  } finally { database.close(); }
}

export async function saveDemoPhoto(photo: DemoPhoto) {
  const database = await photoDatabase();
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction('photos', 'readwrite');
      transaction.objectStore('photos').add(photo);
      transaction.oncomplete = () => resolve();
      transaction.onabort = () => reject(new Error('No se guardó la foto. Revisa el espacio disponible en el navegador.'));
    });
  } finally { database.close(); }
}

export async function clearDemoPhotos() {
  const database = await photoDatabase();
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction('photos', 'readwrite'); transaction.objectStore('photos').clear();
      transaction.oncomplete = () => resolve();
      transaction.onabort = () => reject(new Error('No se pudieron restablecer las fotos de demostración.'));
    });
  } finally { database.close(); }
}

export async function deleteDemoEventPhotos(eventIds: number[]) {
  if (!eventIds.length) return;
  const database = await photoDatabase();
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction('photos', 'readwrite');
      const cursor = transaction.objectStore('photos').openCursor();
      cursor.onsuccess = () => {
        const item = cursor.result;
        if (!item) return;
        if (eventIds.includes((item.value as DemoPhoto).eventId ?? -1)) item.delete();
        item.continue();
      };
      transaction.oncomplete = () => resolve();
      transaction.onabort = () => reject(new Error('No se pudieron eliminar las fotos del evento.'));
    });
  } finally { database.close(); }
}
