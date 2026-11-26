import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { summarizeWaterUsage } from '../src/lib/analytics';

async function image(page: Page, name = 'campo.png') {
  const data = await page.evaluate(() => {
    const canvas = document.createElement('canvas'); canvas.width = 16; canvas.height = 12;
    const context = canvas.getContext('2d')!; context.fillStyle = '#69a347'; context.fillRect(0, 0, 16, 12);
    return canvas.toDataURL('image/png').split(',')[1];
  });
  return { name, mimeType: 'image/png', buffer: Buffer.from(data, 'base64') };
}

test('event photos preview, enlarge, download and persist in demo and are removed with the event', async ({ page }) => {
  await page.goto('/#reports');
  await page.getByRole('button', { name: 'Ver actividad 1', exact: true }).click();
  const dialog = page.getByRole('dialog');
  const gallery = dialog.getByRole('region', { name: 'Fotos adjuntas' });
  await expect(gallery.getByLabel('Capturar foto')).toHaveAttribute('capture', 'environment');
  await gallery.getByLabel('Seleccionar fotos').setInputFiles(await image(page));
  await expect(gallery.getByRole('img', { name: 'campo.png', exact: true })).toBeVisible();
  await expect(gallery.getByRole('img', { name: 'campo.png', exact: true })).toHaveJSProperty('naturalWidth', 16);
  await gallery.getByRole('button', { name: 'Ver foto campo.png', exact: true }).click();
  await expect(gallery.getByRole('img', { name: 'Foto ampliada: campo.png', exact: true })).toBeVisible();
  await gallery.getByRole('button', { name: 'Cerrar vista ampliada' }).click();
  const downloadPromise = page.waitForEvent('download');
  await gallery.getByRole('link', { name: 'Descargar foto', exact: true }).click();
  const saved = await downloadPromise;
  const bytes = await readFile((await saved.path())!);
  expect([...bytes.subarray(0, 4)]).toEqual([137, 80, 78, 71]);
  await page.reload();
  await page.getByRole('button', { name: 'Ver actividad 1', exact: true }).click();
  await expect(gallery.getByRole('img', { name: 'campo.png', exact: true })).toHaveJSProperty('naturalWidth', 16);
  await gallery.getByLabel('Seleccionar fotos').setInputFiles({ name: 'falsa.png', mimeType: 'image/png', buffer: Buffer.from('not an image') });
  await expect(gallery.getByRole('alert')).toContainText('No se pudo leer la foto');
  await expect(gallery.locator('.photo-grid img')).toHaveCount(1);
  await dialog.getByRole('button', { name: 'Eliminar actividad', exact: true }).click();
  await dialog.getByRole('button', { name: 'Confirmar eliminación', exact: true }).click();
  await expect(dialog).not.toBeVisible();
  expect(await page.evaluate(() => new Promise<number>((resolve, reject) => {
    const request = indexedDB.open('agrovision-photos', 1);
    request.onsuccess = () => { const database = request.result; const count = database.transaction('photos').objectStore('photos').count(); count.onsuccess = () => { resolve(count.result); database.close(); }; count.onerror = () => reject(count.error); };
  }))).toBe(0);
});

test('inspection photos can target a treatment and remain viewable after annulment', async ({ page }) => {
  await page.goto('/#disease');
  await page.getByRole('button', { name: 'Ver inspección 1', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('button', { name: 'Registrar tratamiento', exact: true }).click();
  await dialog.getByLabel('Descripción del tratamiento').fill('Deshoje documentado con fotos.');
  await dialog.getByRole('button', { name: 'Guardar tratamiento', exact: true }).click();
  const gallery = dialog.getByRole('region', { name: 'Fotos adjuntas' });
  await gallery.getByRole('combobox', { name: 'Asociar fotos a' }).selectOption({ index: 1 });
  await gallery.getByLabel('Seleccionar fotos').setInputFiles(await image(page, 'tratamiento.png'));
  await expect(gallery.getByRole('img', { name: 'tratamiento.png', exact: true })).toHaveJSProperty('naturalWidth', 16);
  await expect(gallery.locator('figcaption')).toContainText('Tratamiento #');
  await gallery.getByRole('combobox', { name: 'Asociar fotos a' }).selectOption('');
  await gallery.getByLabel('Capturar foto').setInputFiles(await image(page, 'inspeccion.png'));
  await expect(gallery.locator('.photo-grid img')).toHaveCount(2);
  await page.reload();
  await page.getByRole('button', { name: 'Ver inspección 1', exact: true }).click();
  await expect(gallery.locator('.photo-grid img')).toHaveCount(2);
  await dialog.getByRole('button', { name: 'Anular inspección', exact: true }).click();
  await dialog.getByLabel('Motivo de anulación').fill('Duplicado, se conserva evidencia.');
  await dialog.getByRole('button', { name: 'Confirmar anulación', exact: true }).click();
  await expect(dialog).toContainText('Anulada: Duplicado');
  await expect(gallery.locator('.photo-grid img')).toHaveCount(2);
  await expect(gallery.getByRole('button', { name: 'Elegir fotos', exact: true })).toHaveCount(0);
  await expect(gallery.getByRole('link', { name: 'Descargar foto', exact: true })).toHaveCount(2);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBeTruthy();
});

test('live photo upload sends multipart with CSRF and previews authenticated content', async ({ page }) => {
  const file = await image(page, 'live.png');
  const farm = { id: 1, name: 'Finca conectada' };
  const field = { id: 1, name: 'Norte', farm };
  const block = { id: 1, code: 'A', field, crop: 'banana' };
  const id = 'c7db1555-991a-4670-aafe-497102a49158';
  const photo = { id, eventId: 1, originalName: 'live.png', contentType: 'image/png', sizeBytes: file.buffer.length, createdByUserId: 1, createdAt: new Date().toISOString() };
  let uploaded = false;
  await page.addInitScript(() => sessionStorage.setItem('agrovision.live', 'true'));
  await page.route('**/api/v1/**', async route => {
    const request = route.request(); const url = new URL(request.url());
    const path = url.pathname; let body: unknown = [];
    if (path.endsWith('/auth/me')) body = { user: { id: 1, name: 'Inspector', email: 'inspector@example.com' }, memberships: [{ farmId: 1, farmName: farm.name, role: 'ADMIN' }] };
    if (path.endsWith('/auth/csrf')) body = { token: 'photo-token', headerName: 'X-CSRF-TOKEN' };
    if (path.endsWith('/farms')) body = [farm];
    if (path.endsWith('/fields')) body = [field];
    if (path.endsWith('/blocks')) body = [block];
    if (path.endsWith('/events')) body = [{ id: 1, eventType: 'IRRIGATION_EVENT', occurredAt: '2026-01-10T12:00:00Z', block, createdByUserId: 1 }];
    if (path.endsWith('/analytics/water-usage')) {
      body = { farmId: farm.id, from: url.searchParams.get('from'), until: url.searchParams.get('until'), sectors: [], summary: summarizeWaterUsage([]) };
    }
    if (path.endsWith('/photos')) {
      expect(url.searchParams.get('eventId')).toBe('1');
      if (request.method() === 'POST') {
        expect(request.headers()['content-type']).toContain('multipart/form-data; boundary=');
        expect(request.headers()['x-csrf-token']).toBe('photo-token');
        expect(request.postDataBuffer()?.toString()).toContain('filename="live.png"');
        uploaded = true; body = photo;
      } else body = uploaded ? [photo] : [];
    }
    if (path.endsWith(`/photos/${id}/content`)) {
      await route.fulfill({ status: 200, contentType: 'image/png', body: file.buffer }); return;
    }
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
  });
  await page.goto('/#reports');
  await page.getByRole('button', { name: 'Ver actividad 1', exact: true }).click();
  const gallery = page.getByRole('dialog').getByRole('region', { name: 'Fotos adjuntas' });
  await gallery.getByLabel('Seleccionar fotos').setInputFiles(file);
  await expect(gallery.getByRole('img', { name: 'live.png', exact: true })).toHaveJSProperty('naturalWidth', 16);
  await page.reload();
  await page.getByRole('button', { name: 'Ver actividad 1', exact: true }).click();
  await expect(gallery.getByRole('img', { name: 'live.png', exact: true })).toHaveJSProperty('naturalWidth', 16);
  expect(uploaded).toBeTruthy();
});
