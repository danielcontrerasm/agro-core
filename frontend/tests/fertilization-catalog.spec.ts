import { expect, test } from '@playwright/test';
import { createQaFarm, signInAsNewQaUser } from './support/qa-account';

test('connected fertilizer catalog enforces the standard dose unit and preserves the plan snapshot', async ({ page }, testInfo) => {
  test.skip(process.env.AGRO_LIVE_TEST !== '1', 'Requires the isolated QA backend.');
  test.setTimeout(90_000);
  await signInAsNewQaUser(page);
  await createQaFarm(page, 'Finca QA de catálogo de fertilizantes');

  const api = '/api/v1';
  const [farm] = await (await page.request.get(`${api}/farms`)).json() as { id: number }[];
  const csrf = await (await page.request.get(`${api}/auth/csrf`)).json() as { headerName: string; token: string };
  async function seed(resource: string, data: object) {
    const response = await page.request.post(`${api}/${resource}`, { data, headers: { [csrf.headerName]: csrf.token } });
    await expect(response).toBeOK();
    return await response.json() as { id: number };
  }
  const polygon = { coordinates: [[[-74.1, 10.5], [-74.11, 10.5], [-74.11, 10.51], [-74.1, 10.5]]] };
  const field = await seed('fields', { farmId: farm.id, name: 'Campo catálogo QA', polygon, areaHa: 12 });
  const block = await seed('blocks', { fieldId: field.id, code: 'Bloque catálogo QA', polygon, areaHa: 10 });
  const sampledOn = new Date(Date.now() - 3 * 86_400_000).toISOString().slice(0, 10);
  const analysis = await seed('fertilization/analyses', {
    blockId: block.id, sampleType: 'SOIL', sampledOn, laboratory: 'Laboratorio QA', reference: 'CATALOGO-QA-01',
    depthCm: 15, results: [{ nutrient: 'B', unit: 'MG_KG', value: 0.4, method: 'Agua caliente' }],
  });

  const catalogProduct = 'Fertilizante de catálogo QA';
  const catalogComposition = 'Composición de catálogo QA 10-5-20';
  const ignoredProduct = 'Nombre manual ignorado QA';
  const ignoredComposition = 'Composición manual ignorada QA';
  const dialog = page.getByRole('dialog');
  const save = dialog.getByRole('button', { name: 'Guardar', exact: true });
  await page.goto('/#fertilization');
  await page.reload();
  await page.getByRole('button', { name: 'Análisis', exact: true }).click();
  await page.getByRole('button', { name: 'Nuevo producto', exact: true }).click();
  await dialog.getByLabel('Código interno', { exact: true }).fill('FERT-CAT-QA');
  await dialog.getByLabel('Nombre comercial', { exact: true }).fill(catalogProduct);
  await dialog.getByLabel('Composición declarada (N-P-K y otros)', { exact: true }).fill(catalogComposition);
  await dialog.getByRole('combobox', { name: 'Unidad estándar de dosis', exact: true }).selectOption('L_HA');
  await dialog.getByRole('button', { name: 'Guardar producto', exact: true }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByText('FERT-CAT-QA · ' + catalogProduct, { exact: true })).toBeVisible();

  await page.getByRole('button', { name: 'Planes', exact: true }).click();
  await page.getByRole('button', { name: 'Nuevo plan', exact: true }).click();
  await dialog.getByRole('combobox', { name: 'Bloque', exact: true }).selectOption(String(block.id));
  await dialog.getByRole('combobox', { name: 'Análisis de referencia', exact: true }).selectOption(String(analysis.id));
  await dialog.getByLabel('Etapa de crecimiento', { exact: true }).fill('Vegetativo');
  await dialog.getByLabel('Diagnóstico y justificación técnica').fill('Referencia de muestra para verificar el catálogo.');
  await dialog.getByLabel('Objetivo agronómico').fill('Validar unidad y composición de catálogo.');
  await dialog.getByRole('combobox', { name: 'Producto del catálogo (opcional)', exact: true })
    .selectOption({ label: 'FERT-CAT-QA · ' + catalogProduct + ' · L/ha' });
  await dialog.getByLabel('Producto', { exact: true }).fill(ignoredProduct);
  await dialog.getByLabel('Composición declarada (N-P-K y otros)', { exact: true }).fill(ignoredComposition);
  await dialog.getByLabel('Dosis definida por el técnico', { exact: true }).fill('10');
  await dialog.getByLabel('Cobertura (ha o plantas según unidad de dosis)', { exact: true }).fill('2');
  await dialog.getByLabel('Método e instrucciones de aplicación').fill('Método ficticio QA');
  const unit = dialog.getByRole('combobox', { name: 'Unidad de dosis', exact: true });
  await unit.selectOption('KG_HA');

  const rejected = page.waitForResponse(response => response.url().endsWith('/fertilization/plans') && response.request().method() === 'POST');
  await save.click();
  expect((await rejected).status()).toBe(400);
  await expect(dialog.getByRole('alert')).toContainText('La unidad de dosis no coincide con la unidad estándar del producto');
  await testInfo.attach('unidad-incompatible-rechazada', { body: await dialog.screenshot(), contentType: 'image/png' });

  await unit.selectOption('L_HA');
  await save.click();
  await expect(dialog).toBeHidden();
  await page.reload();
  await page.getByRole('button', { name: 'Planes', exact: true }).click();
  const plan = page.getByRole('row').filter({ hasText: catalogProduct });
  await expect(plan).toHaveCount(1);
  await expect(plan).toContainText('20 / 0 L');
  await plan.getByRole('button', { name: /^Ver plan/ }).click();
  await expect(dialog).toContainText(catalogProduct);
  await expect(dialog).toContainText(catalogComposition);
  await expect(dialog).toContainText('10 L/ha');
  await expect(dialog).not.toContainText(ignoredProduct);
  await expect(dialog).not.toContainText(ignoredComposition);
  await testInfo.attach('plan-con-composición-de-catálogo', { body: await dialog.screenshot(), contentType: 'image/png' });
});
