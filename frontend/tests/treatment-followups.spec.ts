import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';
import { createQaFarm, signInAsNewQaUser } from './support/qa-account';

const description = 'Intervención de verificación QA';
const notes = 'Se observó una reducción parcial en la visita.';

async function openFollowups(page: Page, inspectionId: number) {
  await page.getByRole('button', { name: `Ver inspección ${inspectionId}`, exact: true }).click();
  return page.getByRole('region', { name: 'Seguimiento de tratamientos', exact: true });
}

async function authorize(region: Locator) {
  await region.getByRole('button', { name: 'Autorizar tratamiento', exact: true }).click();
  const form = region.getByRole('form', { name: 'Autorizar tratamiento', exact: true });
  await form.getByLabel('Descripción de la autorización').fill(description);
  await form.getByLabel('Producto autorizado (opcional)').fill('Producto de prueba QA');
  await form.getByRole('button', { name: 'Autorizar tratamiento', exact: true }).click();
  await expect(region.getByText('Autorizado', { exact: true })).toBeVisible();
}

async function execute(region: Locator) {
  await region.getByRole('button', { name: 'Registrar ejecución', exact: true }).click();
  const form = region.getByRole('form', { name: 'Registrar ejecución', exact: true });
  await expect(form.getByLabel('Lote del producto')).toHaveAttribute('required', '');
  await form.getByLabel('Lote del producto').fill('LOTE-SEGUIMIENTO-QA');
  await form.getByLabel('Cantidad ejecutada (opcional)').fill('2');
  await form.getByRole('button', { name: 'Registrar ejecución', exact: true }).click();
  await expect(region.getByRole('alert')).toContainText('Indica cantidad y unidad juntas.');
  await form.getByLabel('Unidad ejecutada').fill('kg');
  await form.getByRole('button', { name: 'Registrar ejecución', exact: true }).click();
  await expect(region.getByText('Pendiente de verificación', { exact: true })).toBeVisible();
  await expect(region.getByText('Lote del producto · LOTE-SEGUIMIENTO-QA')).toBeVisible();
}

async function verify(region: Locator) {
  await region.getByRole('button', { name: 'Registrar verificación', exact: true }).click();
  const form = region.getByRole('form', { name: 'Registrar verificación', exact: true });
  await form.getByLabel('Resultado de la verificación').selectOption('PARTIAL');
  await form.getByLabel('Observaciones de la verificación').fill(notes);
  await form.getByRole('button', { name: 'Registrar verificación', exact: true }).click();
  await expect(region.getByText('Verificado', { exact: true })).toBeVisible();
}

test('demo treatment follow-up persists authorization, worker execution and agronomic verification', async ({ page }) => {
  await page.goto('/#disease');
  await authorize(await openFollowups(page, 1));
  await page.goto('/#settings');
  await page.getByRole('button', { name: 'Trabajador', exact: true }).click();
  await page.goto('/#disease');
  let region = await openFollowups(page, 1);
  await expect(region.getByRole('button', { name: 'Autorizar tratamiento', exact: true })).toHaveCount(0);
  await execute(region);
  await expect(region.getByRole('button', { name: 'Registrar verificación', exact: true })).toHaveCount(0);

  await page.goto('/#settings');
  await page.getByRole('button', { name: 'Administrador', exact: true }).click();
  await page.goto('/#disease');
  await verify(await openFollowups(page, 1));
  await page.reload();
  region = await openFollowups(page, 1);
  await expect(region.getByText(notes, { exact: true })).toBeVisible();
  await expect(region.getByText('Resultado · Parcialmente eficaz', { exact: true })).toBeVisible();
  await expect(region.getByText('Cantidad ejecutada · 2 kg', { exact: true })).toBeVisible();

  const dialog = page.getByRole('dialog');
  await dialog.getByRole('button', { name: 'Registrar evidencia', exact: true }).click();
  await expect(dialog.getByLabel('Asociar evidencia a').getByRole('option', { name: new RegExp(description) })).toHaveCount(1);
});

test('connected treatment follow-up records execution against the original inspection and reloads the outcome', async ({ page }, testInfo) => {
  test.skip(process.env.AGRO_LIVE_TEST !== '1', 'Requires the isolated QA backend.');
  await signInAsNewQaUser(page);
  await createQaFarm(page, 'Finca QA de sanidad');
  const base = '/api/v1';
  const [farm] = await (await page.request.get(`${base}/farms`)).json() as { id: number }[];
  const csrf = await (await page.request.get(`${base}/auth/csrf`)).json() as { headerName: string; token: string };
  const create = async (resource: string, data: object) => {
    const response = await page.request.post(`${base}/${resource}`, { data, headers: { [csrf.headerName]: csrf.token } });
    await expect(response).toBeOK();
    return await response.json() as { id: number };
  };
  const polygon = { coordinates: [[[-74.1, 10.5], [-74.11, 10.5], [-74.11, 10.51], [-74.1, 10.5]]] };
  const field = await create('fields', { farmId: farm.id, name: 'Campo QA', polygon, areaHa: 12 });
  const block = await create('blocks', { fieldId: field.id, code: 'Bloque QA', polygon, areaHa: 10 });
  const inspection = await create('inspections', {
    blockId: block.id, problemCode: 'WEEVILS', inspectedAt: new Date(Date.now() - 60_000).toISOString(),
    inspectedPlants: 20, affectedPlants: 4, affectedAreaHa: 1,
    symptoms: 'Observación de verificación QA', severityPercent: 10, severityMethod: 'Observación de muestra QA',
    nextVisit: new Date(Date.now() + 86_400_000).toISOString().slice(0, 10),
  });

  await page.goto('/#disease');
  let region = await openFollowups(page, inspection.id);
  await authorize(region);
  await execute(region);
  await verify(region);
  await page.reload();
  region = await openFollowups(page, inspection.id);
  await expect(region.getByText(notes, { exact: true })).toBeVisible();
  await expect(region.getByText('Lote del producto · LOTE-SEGUIMIENTO-QA', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Exportar tratamientos CSV', exact: true })).toBeEnabled();
  await testInfo.attach('tratamiento-verificado', { body: await region.screenshot(), contentType: 'image/png' });
});
