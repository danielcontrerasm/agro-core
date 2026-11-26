import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';
import { createQaFarm, signInAsNewQaUser } from './support/qa-account';

const reference = 'MUESTRA-LAB-QA-01';
const laboratory = 'Laboratorio de prueba QA';
const report = 'INFORME-QA-001';
const notes = 'Resultado sintético para comprobar la trazabilidad.';
const day = (ago: number) => new Date(Date.now() - ago * 86_400_000).toISOString().slice(0, 10);

async function openLaboratory(page: Page, inspectionId: number) {
  await page.getByRole('button', { name: `Ver inspección ${inspectionId}`, exact: true }).click();
  return page.getByRole('region', { name: 'Resultados de laboratorio', exact: true });
}

async function record(region: Locator) {
  await region.getByRole('button', { name: 'Registrar resultado de laboratorio', exact: true }).click();
  const editor = region.getByRole('form', { name: 'Registrar resultado de laboratorio', exact: true });
  await editor.getByLabel('Referencia de la muestra').fill(reference);
  await editor.getByLabel('Laboratorio', { exact: true }).fill(laboratory);
  await editor.getByLabel('Fecha de toma de muestra').fill(day(1));
  await editor.getByLabel('Fecha del resultado').fill(day(2));
  await editor.getByRole('combobox', { name: 'Resultado informado', exact: true }).selectOption('CONFIRMED');
  await editor.getByLabel('Referencia del informe (opcional)').fill(report);
  await editor.getByRole('textbox', { name: 'Notas del resultado (opcional)', exact: true }).fill(notes);
  const save = editor.getByRole('button', { name: 'Guardar resultado', exact: true });
  await save.click();
  await expect(region.getByRole('alert')).toContainText('La fecha del resultado debe estar entre la toma de la muestra y hoy.');
  await editor.getByLabel('Fecha del resultado').fill(day(0));
  await save.click();
  await expect(editor).toBeHidden();
  await expect(region.getByRole('article')).toHaveCount(1);
  await expect(region.getByText('Confirmado por laboratorio', { exact: true })).toBeVisible();
}

async function expectRecord(region: Locator) {
  const result = region.getByRole('article').filter({ hasText: reference });
  await expect(result).toContainText(laboratory);
  await expect(result).toContainText(report);
  await expect(result).toContainText(notes);
  await expect(result).toContainText('Registrado por');
  await expect(result.locator(`time[datetime="${day(1)}"]`)).toBeVisible();
  await expect(result.locator(`time[datetime="${day(0)}"]`)).toBeVisible();
}

test('demo laboratory evidence persists and stays readable after inspection cancellation', async ({ page }) => {
  await page.goto('/#disease');
  await record(await openLaboratory(page, 1));
  await page.goto('/#settings');
  await page.getByRole('button', { name: 'Trabajador', exact: true }).click();
  await page.goto('/#disease');
  let region = await openLaboratory(page, 1);
  await expectRecord(region);
  await expect(region.getByRole('button', { name: 'Registrar resultado de laboratorio', exact: true })).toHaveCount(0);

  await page.goto('/#settings');
  await page.getByRole('button', { name: 'Administrador', exact: true }).click();
  await page.goto('/#disease');
  await openLaboratory(page, 1);
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('button', { name: 'Anular inspección', exact: true }).click();
  await dialog.getByRole('textbox', { name: 'Motivo de anulación', exact: true }).fill('Anulación de prueba con evidencia que se conserva.');
  await dialog.getByRole('button', { name: 'Confirmar anulación', exact: true }).click();
  await expect(dialog).toContainText('Anulada: Anulación de prueba');
  await page.reload();
  region = await openLaboratory(page, 1);
  await expectRecord(region);
  await expect(region.getByRole('button', { name: 'Registrar resultado de laboratorio', exact: true })).toHaveCount(0);
});

test('connected laboratory evidence links to its inspection and preserves the field assessment', async ({ page }, testInfo) => {
  test.skip(process.env.AGRO_LIVE_TEST !== '1', 'Requires the isolated QA backend.');
  test.setTimeout(60_000);
  await signInAsNewQaUser(page);
  await createQaFarm(page, 'Finca QA de laboratorio');
  const base = '/api/v1';
  const [farm] = await (await page.request.get(`${base}/farms`)).json() as { id: number }[];
  const csrf = await (await page.request.get(`${base}/auth/csrf`)).json() as { headerName: string; token: string };
  async function create(resource: string, data: object) {
    const response = await page.request.post(`${base}/${resource}`, { data, headers: { [csrf.headerName]: csrf.token } });
    await expect(response).toBeOK();
    return await response.json() as { id: number };
  }
  const polygon = { coordinates: [[[-74.1, 10.5], [-74.11, 10.5], [-74.11, 10.51], [-74.1, 10.5]]] };
  const field = await create('fields', { farmId: farm.id, name: 'Campo QA', polygon, areaHa: 12 });
  const block = await create('blocks', { fieldId: field.id, code: 'Bloque QA', polygon, areaHa: 10 });
  const inspection = await create('inspections', {
    blockId: block.id, problemCode: 'WEEVILS', inspectedAt: `${day(1)}T14:00:00Z`,
    inspectedPlants: 20, affectedPlants: 4, affectedAreaHa: 1,
    symptoms: 'Observación sintética de laboratorio QA', severityPercent: 10, severityMethod: 'Observación QA',
    nextVisit: day(0),
  });

  await page.goto('/#disease');
  await record(await openLaboratory(page, inspection.id));
  await page.reload();
  const region = await openLaboratory(page, inspection.id);
  await expectRecord(region);
  await expect(region).toContainText('Registrado por AgroVision QA');
  const result = await page.request.get(`${base}/inspections/${inspection.id}/laboratory-results`);
  await expect(result).toBeOK();
  expect(await result.json()).toEqual([expect.objectContaining({
    inspectionId: inspection.id, sampleReference: reference, outcome: 'CONFIRMED', reportReference: report,
  })]);
  const verification = await page.request.get(`${base}/inspections?farmId=${farm.id}`);
  await expect(verification).toBeOK();
  expect(await verification.json()).toContainEqual(expect.objectContaining({
    id: inspection.id, assessmentStatus: 'SUSPECTED', version: 0,
  }));
  await testInfo.attach('resultado-de-laboratorio-en-la-inspección', { body: await region.screenshot(), contentType: 'image/png' });
});
