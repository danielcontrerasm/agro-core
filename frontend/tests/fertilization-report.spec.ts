import { expect, test } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { createQaFarm, signInAsNewQaUser } from './support/qa-account';
import { laboratoryPdf } from './support/fertilization-evidence-qa';

test('connected foliar analysis rejects an invalid report and downloads the persisted PDF', async ({ page }, info) => {
  test.skip(process.env.AGRO_LIVE_TEST !== '1', 'Requires the isolated QA backend.');
  test.setTimeout(90_000);
  await signInAsNewQaUser(page);
  await createQaFarm(page, 'Finca QA de informe foliar');
  const [farm] = await (await page.request.get('/api/v1/farms')).json() as { id: number }[];
  const csrf = await (await page.request.get('/api/v1/auth/csrf')).json() as { headerName: string; token: string };
  const polygon = { coordinates: [[[-74.1, 10.5], [-74.11, 10.5], [-74.11, 10.51], [-74.1, 10.5]]] };
  const field = await page.request.post('/api/v1/fields', {
    headers: { [csrf.headerName]: csrf.token }, data: { farmId: farm.id, name: 'Campo QA', polygon, areaHa: 12 },
  });
  await expect(field).toBeOK();
  const block = await page.request.post('/api/v1/blocks', {
    headers: { [csrf.headerName]: csrf.token },
    data: { fieldId: (await field.json()).id, code: 'Bloque foliar QA', polygon, areaHa: 10 },
  });
  await expect(block).toBeOK();

  await page.goto('/#fertilization');
  await page.reload();
  await page.getByRole('button', { name: 'Nuevo análisis', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('combobox', { name: 'Tipo de muestra', exact: true }).selectOption('FOLIAR');
  await dialog.getByLabel('Laboratorio', { exact: true }).fill('Laboratorio foliar QA');
  await dialog.getByLabel('Referencia de muestra', { exact: true }).fill('FOLIAR-POSTGIS-QA');
  await dialog.getByLabel('Profundidad (cm; 0 para foliar)', { exact: true }).fill('0');
  await dialog.getByLabel('Valor B', { exact: true }).fill('18');
  await dialog.getByLabel('Método B', { exact: true }).fill('Método de laboratorio QA');
  const input = dialog.getByLabel(/Informe de laboratorio PDF/);
  const save = dialog.getByRole('button', { name: 'Guardar', exact: true });
  await input.setInputFiles({ name: 'inválido.pdf', mimeType: 'application/pdf', buffer: Buffer.from('Archivo inválido QA') });
  await save.click();
  await expect(dialog.getByRole('alert')).toContainText('Adjunta un PDF válido');

  const pdf = laboratoryPdf();
  await input.setInputFiles({ name: 'informe-foliar-qa.pdf', mimeType: 'application/pdf', buffer: pdf });
  const upload = page.waitForResponse(response => /\/api\/v1\/fertilization\/analyses\/\d+\/report$/.test(new URL(response.url()).pathname)
    && response.request().method() === 'POST');
  await save.click();
  expect((await upload).ok()).toBe(true);
  await expect(dialog).toBeHidden();

  await page.reload();
  await page.getByRole('button', { name: 'Análisis', exact: true }).click();
  const sample = page.getByRole('row').filter({ hasText: 'FOLIAR-POSTGIS-QA' });
  await sample.getByRole('button', { name: /^Ver análisis/ }).click();
  await expect(dialog).toContainText('Muestra foliar');
  await expect(dialog).toContainText('0 cm');
  const result = dialog.getByRole('row').filter({ hasText: 'Método de laboratorio QA' });
  await expect(result).toContainText('mg/kg');
  await expect(result).toContainText('18');
  const download = page.waitForEvent('download');
  await dialog.getByRole('link', { name: 'Descargar informe PDF' }).click();
  expect(await readFile((await (await download).path())!)).toEqual(pdf);
  await info.attach('informe-foliar-conectado', { body: await dialog.screenshot(), contentType: 'image/png' });
});
