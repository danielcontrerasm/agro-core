import { expect, type Locator, type Page, type Route } from '@playwright/test';

type ShowFertilizationStep = (title: string, description: string, focus: Locator) => Promise<void>;

export function laboratoryPdf() {
  let document = '%PDF-1.4\n';
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 200 200] >>',
  ];
  const offsets = objects.map((object, index) => {
    const offset = document.length;
    document += `${index + 1} 0 obj\n${object}\nendobj\n`;
    return offset;
  });
  const xref = document.length;
  document += 'xref\n0 4\n0000000000 65535 f \n';
  for (const offset of offsets) document += `${String(offset).padStart(10, '0')} 00000 n \n`;
  return Buffer.from(document + `trailer\n<< /Size 4 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`);
}

async function failNextUpload(page: Page, matches: (url: URL) => boolean, message: string) {
  let rejected = false;
  async function rejectUpload(route: Route) {
    if (rejected || route.request().method() !== 'POST') return route.fallback();
    rejected = true;
    await route.fulfill({ status: 503, json: { detail: message } });
    await page.unroute(matches, rejectUpload);
  }
  await page.route(matches, rejectUpload);
}

export async function verifyFertilizationEvidenceRecovery(page: Page, show?: ShowFertilizationStep) {
  const dialog = page.getByRole('dialog');
  const analysesTab = page.getByRole('button', { name: 'Análisis', exact: true });
  const samplePath = '/api/v1/fertilization/analyses';
  const reference = 'MUESTRA-RECUPERACION-QA';
  const laboratory = 'Laboratorio de recuperación QA';
  const method = 'Método de recuperación QA';
  const notes = 'Conservar los resultados durante el reintento de los adjuntos.';
  const location = { latitude: 10.5042, longitude: -74.1086, accuracy: 8 };
  const pdf = { name: 'informe-recuperacion-qa.pdf', mimeType: 'application/pdf', buffer: laboratoryPdf() };
  const pdfFailure = 'El informe PDF no está disponible para carga en este momento.';
  const photoFailure = 'Las fotos no están disponibles para carga en este momento.';
  await page.context().grantPermissions(['geolocation']);
  await page.context().setGeolocation(location);
  await analysesTab.click();
  await page.getByRole('button', { name: 'Nuevo análisis', exact: true }).click();
  await dialog.getByLabel('Laboratorio', { exact: true }).fill(laboratory);
  await dialog.getByLabel('Referencia de muestra', { exact: true }).fill(reference);
  await dialog.getByLabel('Valor B', { exact: true }).fill('0.42');
  await dialog.getByLabel('Método B', { exact: true }).fill(method);
  await dialog.getByLabel('Observaciones', { exact: true }).fill(notes);
  await dialog.getByRole('button', { name: 'Usar ubicación actual', exact: true }).click();
  await expect(dialog.getByLabel('Latitud (opcional)', { exact: true })).toHaveValue(location.latitude.toFixed(6));
  await expect(dialog.getByLabel('Longitud (opcional)', { exact: true })).toHaveValue(location.longitude.toFixed(6));
  await dialog.getByLabel(/Informe de laboratorio PDF/).setInputFiles(pdf);
  await failNextUpload(page, url => /^\/api\/v1\/fertilization\/analyses\/\d+\/report$/.test(url.pathname), pdfFailure);
  const saved = page.waitForResponse(response => new URL(response.url()).pathname === samplePath && response.request().method() === 'POST');
  await dialog.getByRole('button', { name: 'Guardar y adjuntar fotos', exact: true }).click();
  const sampleResponse = await saved;
  expect(sampleResponse.ok()).toBe(true);
  const { id } = await sampleResponse.json() as { id: number };
  await expect(dialog).toBeHidden();
  await expect(page.getByRole('alert')).toContainText(`El análisis #${id} quedó guardado, pero falló el PDF`);
  await expect(page.getByRole('alert')).toContainText(pdfFailure);

  const sample = page.getByRole('row').filter({ hasText: reference });
  const openSample = sample.getByRole('button', { name: `Ver análisis ${id}`, exact: true });
  await expect(sample).toHaveCount(1);
  await openSample.click();
  await expect(dialog).toContainText(`${location.latitude}, ${location.longitude}`);
  await expect(dialog).toContainText(notes);
  const reportPath = `${samplePath}/${id}/report`;
  const reportInput = dialog.getByLabel('Adjuntar informe PDF', { exact: true });
  await failNextUpload(page, url => url.pathname === reportPath, pdfFailure);
  await reportInput.setInputFiles(pdf);
  await expect(dialog.getByRole('alert')).toContainText(pdfFailure);
  await expect(reportInput).toBeEnabled();
  await expect(reportInput).toHaveValue('');
  await reportInput.setInputFiles(pdf);
  const report = dialog.getByRole('link', { name: 'Descargar informe PDF', exact: true });
  await expect(report).toHaveAttribute('href', reportPath);

  const photoPath = `/api/v1/photos?analysisId=${id}`;
  const gallery = dialog.getByRole('region', { name: 'Fotos adjuntas' });
  const photoInput = gallery.getByLabel('Seleccionar fotos', { exact: true });
  const image = await page.evaluate(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 16;
    canvas.height = 12;
    const brush = canvas.getContext('2d')!;
    brush.fillStyle = '#69a347';
    brush.fillRect(0, 0, 16, 12);
    return canvas.toDataURL('image/png').split(',')[1];
  });
  const photo = { name: 'foto-recuperacion-qa.png', mimeType: 'image/png', buffer: Buffer.from(image, 'base64') };
  const thumbnail = gallery.getByRole('img', { name: photo.name, exact: true });
  await expect(gallery.getByRole('button', { name: 'Elegir fotos', exact: true })).toBeEnabled();
  await failNextUpload(page, url => url.pathname === '/api/v1/photos' && url.searchParams.get('analysisId') === String(id), photoFailure);
  await photoInput.setInputFiles(photo);
  await expect(gallery.getByRole('alert')).toContainText(photoFailure);
  await expect(thumbnail).toHaveCount(0);
  await expect(photoInput).toBeEnabled();
  await photoInput.setInputFiles(photo);
  await expect(thumbnail).toHaveJSProperty('naturalWidth', 16);
  await expect(gallery.getByRole('alert')).toHaveCount(0);

  await page.reload();
  await analysesTab.click();
  await expect(sample).toHaveCount(1);
  await openSample.click();
  await expect(dialog).toContainText(`${location.latitude}, ${location.longitude}`);
  await expect(dialog).toContainText(laboratory);
  await expect(dialog).toContainText(notes);
  const result = dialog.getByRole('row').filter({ hasText: method });
  await expect(result).toContainText('0.42');
  await expect(result).toContainText('mg/kg');
  await expect(dialog.getByRole('region', { name: 'Mapa del punto de toma de la muestra' })).toBeVisible();
  await expect(report).toHaveAttribute('href', reportPath);
  const persistedReport = await page.request.get(reportPath);
  await expect(persistedReport).toBeOK();
  expect(await persistedReport.body()).toEqual(pdf.buffer);
  const persistedPhotos = await page.request.get(photoPath);
  await expect(persistedPhotos).toBeOK();
  expect(await persistedPhotos.json()).toEqual([expect.objectContaining({ analysisId: id, originalName: photo.name })]);
  await expect(thumbnail).toHaveJSProperty('naturalWidth', 16);
  await show?.('Recuperar el PDF y la foto tras un fallo de carga', `Los reintentos guardaron ambos archivos en la misma muestra #${id}. Al reabrirla, conserva sus coordenadas y resultados.`, gallery);
  await dialog.getByRole('button', { name: 'Cerrar', exact: true }).click();
}
