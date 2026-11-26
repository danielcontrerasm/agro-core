import { expect, test, type Page, type TestInfo } from '@playwright/test';
import { createQaFarm, signInAsNewQaUser } from './support/qa-account';

const location = { latitude: 10.5042, longitude: -74.1086, accuracy: 8 };
const photoName = 'muestra-ubicada-qa.png';

test.use({ geolocation: location, permissions: ['geolocation'] });

async function recordSample(page: Page, info: TestInfo, reference: string, connected: boolean) {
  await page.getByRole('button', { name: 'Nuevo análisis', exact: true }).click();
  const dialog = page.getByRole('dialog');
  const latitude = dialog.getByLabel('Latitud (opcional)', { exact: true });
  const longitude = dialog.getByLabel('Longitud (opcional)', { exact: true });
  await dialog.getByLabel('Laboratorio', { exact: true }).fill('Laboratorio de muestra QA');
  await dialog.getByLabel('Referencia de muestra', { exact: true }).fill(reference);
  await dialog.getByLabel('Valor B', { exact: true }).fill('0.42');
  await dialog.getByLabel('Método B', { exact: true }).fill('Método de registro QA');
  await dialog.getByRole('button', { name: 'Guardar y adjuntar fotos', exact: true }).click();
  await expect(dialog.getByRole('alert')).toContainText('Marca la ubicación de la muestra');
  if (connected) {
    await dialog.getByRole('region', { name: 'Seleccionar el punto de toma de la muestra en el mapa' }).click();
    await expect(latitude).toHaveValue(/^10\.5\d+/);
    await expect(longitude).toHaveValue(/^-74\.10\d+/);
  }
  await dialog.getByRole('button', { name: 'Usar ubicación actual', exact: true }).click();
  await expect(latitude).toHaveValue(location.latitude.toFixed(6));
  await expect(longitude).toHaveValue(location.longitude.toFixed(6));
  await expect(dialog.getByRole('status')).toContainText('8 m');
  await info.attach('ubicación capturada al registrar la muestra', { body: await dialog.screenshot(), contentType: 'image/png' });

  await dialog.getByRole('button', { name: 'Guardar y adjuntar fotos', exact: true }).click();
  const gallery = dialog.getByRole('region', { name: 'Fotos adjuntas' });
  await expect(gallery).toBeVisible();
  await expect(dialog.getByRole('region', { name: 'Mapa del punto de toma de la muestra' })).toBeVisible();
  const image = await page.evaluate(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 16;
    canvas.height = 12;
    const brush = canvas.getContext('2d')!;
    brush.fillStyle = '#69a347';
    brush.fillRect(0, 0, 16, 12);
    return canvas.toDataURL('image/png').split(',')[1];
  });
  const uploaded = connected ? page.waitForResponse(response =>
    new URL(response.url()).searchParams.has('analysisId') && response.request().method() === 'POST'
      && new URL(response.url()).pathname === '/api/v1/photos') : undefined;
  await gallery.getByLabel('Seleccionar fotos').setInputFiles({ name: photoName, mimeType: 'image/png', buffer: Buffer.from(image, 'base64') });
  if (uploaded) {
    const response = await uploaded;
    expect(response.ok()).toBe(true);
    expect((await response.json()).analysisId).toEqual(Number(new URL(response.url()).searchParams.get('analysisId')));
  }
  await expect(gallery.getByRole('img', { name: photoName, exact: true })).toHaveJSProperty('naturalWidth', 16);

  await page.reload();
  await page.getByRole('button', { name: 'Análisis', exact: true }).click();
  await page.getByRole('row').filter({ hasText: reference }).getByRole('button', { name: /^Ver análisis/ }).click();
  await expect(dialog).toContainText(`${location.latitude}, ${location.longitude}`);
  await expect(dialog.getByRole('region', { name: 'Mapa del punto de toma de la muestra' })).toBeVisible();
  await expect(gallery.getByRole('img', { name: photoName, exact: true })).toHaveJSProperty('naturalWidth', 16);
  await info.attach('muestra georreferenciada con foto tras recargar', { body: await dialog.screenshot(), contentType: 'image/png' });
}

test('demo fertilization sample retains its GPS point and photo', async ({ page }, info) => {
  await page.goto('/#fertilization');
  await recordSample(page, info, 'MUESTRA-UBICADA-DEMO', false);
});

test('connected fertilization sample retains its map point and authenticated photo', async ({ page }, info) => {
  test.skip(process.env.AGRO_LIVE_TEST !== '1', 'Requires the isolated QA backend.');
  test.setTimeout(90_000);
  await signInAsNewQaUser(page);
  await createQaFarm(page, 'Finca QA de muestra georreferenciada');
  const [farm] = await (await page.request.get('/api/v1/farms')).json() as { id: number }[];
  const csrf = await (await page.request.get('/api/v1/auth/csrf')).json() as { headerName: string; token: string };
  const headers = { [csrf.headerName]: csrf.token };
  const polygon = { coordinates: [[[-74.11, 10.5], [-74.10, 10.5], [-74.10, 10.51], [-74.11, 10.51], [-74.11, 10.5]]] };
  const field = await page.request.post('/api/v1/fields', {
    headers, data: { farmId: farm.id, name: 'Campo QA', polygon, areaHa: 12 },
  });
  await expect(field).toBeOK();
  const block = await page.request.post('/api/v1/blocks', {
    headers, data: { fieldId: (await field.json()).id, code: 'Bloque QA de muestra', polygon, areaHa: 10 },
  });
  await expect(block).toBeOK();
  await page.goto('/#fertilization');
  await page.reload();
  await recordSample(page, info, 'MUESTRA-UBICADA-LIVE', true);
});
