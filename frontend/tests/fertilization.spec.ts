import { test, expect, request as httpRequest } from '@playwright/test';
import type { APIRequestContext, Locator, Page, TestInfo } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { verifyFertilizationEvidenceRecovery } from './support/fertilization-evidence-qa';
import { verifyFertilizationFarmCoverage } from './support/fertilization-map-qa';
import { verifyFertilizationConcurrentSave, verifyFertilizationMonthlySchedule, type ShowFertilizationStep } from './support/fertilization-resilience-qa';
import { attachDemoPhoto, walkthrough } from '../qa/walkthrough';
import type { FertilizationApplication, FertilizationData } from '../src/lib/fertilization';
import { localDate } from '../src/lib/domain';

const day = (daysAgo: number) => new Date(Date.now() - 86_400_000 * daysAgo).toISOString().slice(0, 10);

test('soil results, approved plan, task, partial application, evidence and followup persist', async ({ page }) => {
  await page.goto('/#fertilization');
  await page.getByRole('button', { name: 'Nuevo análisis', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Fecha de muestreo', { exact: true }).fill(day(5));
  await dialog.getByLabel('Laboratorio', { exact: true }).fill('Laboratorio E2E');
  await dialog.getByLabel('Referencia de muestra', { exact: true }).fill('E2E-001');
  await dialog.getByLabel('Valor B', { exact: true }).fill('0.42');
  await dialog.getByLabel('Método B', { exact: true }).fill('Agua caliente');
  await dialog.getByRole('button', { name: 'Guardar', exact: true }).click();
  await expect(dialog).not.toBeVisible();
  await expect(page.getByRole('cell', { name: /E2E-001/ })).toBeVisible();
  await page.getByRole('button', { name: 'Planes', exact: true }).click();
  await page.getByRole('button', { name: 'Nuevo plan', exact: true }).click();
  await dialog.getByRole('combobox', { name: 'Análisis de referencia', exact: true }).selectOption({ index: 1 });
  await dialog.getByLabel('Etapa de crecimiento', { exact: true }).fill('Vegetativo');
  await dialog.getByLabel('Diagnóstico y justificación técnica').fill('Revisión del laboratorio y contexto sanitario; sin diagnóstico automático.');
  await dialog.getByLabel('Objetivo agronómico').fill('Validar el seguimiento nutricional.');
  await dialog.getByLabel('Producto', { exact: true }).fill('Producto E2E');
  await dialog.getByLabel('Composición declarada (N-P-K y otros)').fill('Composición de prueba');
  await dialog.getByLabel('Dosis definida por el técnico').fill('50');
  await dialog.getByRole('combobox', { name: 'Unidad de dosis', exact: true }).selectOption('G_PLANT');
  await dialog.getByLabel('Cobertura (ha o plantas según unidad de dosis)').fill('1000');
  await dialog.getByLabel('Método e instrucciones de aplicación').fill('Manual según revisión');
  await dialog.getByLabel('Fecha programada', { exact: true }).fill(day(4));
  await dialog.getByLabel('Fecha de seguimiento', { exact: true }).fill(day(2));
  await dialog.getByRole('button', { name: 'Guardar', exact: true }).click();
  await expect(dialog).not.toBeVisible();
  const row = page.getByRole('row').filter({ hasText: 'Producto E2E' });
  await expect(row).toContainText('50 / 0 kg');
  await expect(row.getByRole('button', { name: 'Registrar aplicación' })).toHaveCount(0);
  await row.getByRole('button', { name: 'Aprobar', exact: true }).click();
  await dialog.getByLabel('Justificación de la decisión').fill('Revisado por técnico responsable.');
  await dialog.getByRole('button', { name: 'Guardar', exact: true }).click();
  await row.getByRole('button', { name: 'Generar tarea', exact: true }).click();
  await row.getByRole('button', { name: 'Registrar aplicación', exact: true }).click();
  await dialog.getByLabel('Fecha y hora reales').fill(`${day(3)}T08:00`);
  await dialog.getByLabel('Cantidad aplicada (kg)').fill('20');
  await dialog.getByLabel('Cobertura real (plantas)').fill('1000');
  await dialog.getByLabel('Lote del producto').fill('LOTE-E2E');
  await dialog.getByRole('button', { name: 'Guardar', exact: true }).click();
  await expect(dialog.getByRole('region', { name: 'Fotos adjuntas' })).toBeVisible();
  const png = await page.evaluate(() => { const canvas = document.createElement('canvas'); canvas.width = 16; canvas.height = 12; canvas.getContext('2d')!.fillRect(0, 0, 16, 12); return canvas.toDataURL('image/png').split(',')[1]; });
  await dialog.getByLabel('Seleccionar fotos').setInputFiles({ name: 'fertilizacion.png', mimeType: 'image/png', buffer: Buffer.from(png, 'base64') });
  await expect(dialog.getByRole('img', { name: 'fertilizacion.png', exact: true })).toHaveJSProperty('naturalWidth', 16);
  await dialog.getByRole('button', { name: 'Cerrar', exact: true }).click();
  await page.getByRole('button', { name: 'Planes', exact: true }).click();
  await expect(row).toContainText('50 / 20 kg');
  await row.getByRole('button', { name: 'Registrar seguimiento', exact: true }).click();
  await dialog.getByLabel('Observaciones y conclusión técnica').fill('Aplicación parcial registrada; continuar seguimiento.');
  await dialog.getByRole('button', { name: 'Guardar', exact: true }).click();
  await expect(row).toContainText('1 revisiones');
  await page.reload();
  await page.getByRole('button', { name: 'Planes', exact: true }).click();
  await expect(row).toContainText('50 / 20 kg');
  await expect(row).toContainText('1 revisiones');
  await page.getByRole('button', { name: 'Aplicaciones', exact: true }).click();
  await page.getByRole('button', { name: /^Ver aplicación/ }).click();
  await expect(dialog.getByRole('img', { name: 'fertilizacion.png', exact: true })).toHaveJSProperty('naturalWidth', 16);
  await dialog.getByRole('button', { name: 'Cerrar', exact: true }).click();
  await page.goto('/#maps');
  await page.getByRole('button', { name: 'Nutrientes', exact: true }).click();
  await page.getByRole('button', { name: 'Boro (B)', exact: true }).click();
  const nutrientTable = page.locator('.map-traceability').first().getByRole('table');
  await expect(nutrientTable).toContainText('0.42');
  await expect(nutrientTable).toContainText('mg/kg');
  await expect(nutrientTable).toContainText('Agua caliente');
  await expect(nutrientTable).toContainText('E2E-001');
  await page.getByRole('button', { name: 'Calcio (Ca)', exact: true }).click();
  await expect(nutrientTable).toContainText('cmol(+)/kg');
});

test('nutrient map keeps each nutrient distinct and shows provisional interpretation', async ({ page }) => {
  await page.goto('/#maps');
  await page.getByRole('button', { name: 'Nutrientes', exact: true }).click();
  const table = page.locator('.map-traceability').first().getByRole('table');
  await expect(table).toContainText('0.12');
  await page.getByRole('button', { name: 'Fósforo (P)', exact: true }).click();
  await expect(table).toContainText('12');
  await expect(table).toContainText('mg/kg');
  await page.getByRole('button', { name: 'Boro (B)', exact: true }).click();
  await expect(table).toContainText('0.2');
  await expect(table).toContainText('Agua caliente');
  await expect(page.getByText('Bajo', { exact: true }).first()).toBeVisible();
});

test('live workers load analyses without manager-only requests and submit CSRF-protected samples', async ({ page }) => {
  const farm = { id: 1, name: 'Finca conectada' };
  const field = { id: 1, farm, name: 'Norte' };
  const block = { id: 1, field, crop: 'banana', code: 'A', areaHa: 10 };
  const records = { analyses: [] as Record<string, unknown>[], plans: [], applications: [] };
  let saved = false;
  await page.addInitScript(() => sessionStorage.setItem('agrovision.live', 'true'));
  await page.route('**/api/v1/**', async route => {
    const request = route.request(); const path = new URL(request.url()).pathname;
    let body: unknown = [];
    expect(path).not.toContain('/members');
    if (path.endsWith('/auth/me')) body = { user: { id: 1, name: 'Trabajador', email: 'worker@test.local' }, memberships: [{ farmId: 1, farmName: farm.name, role: 'WORKER' }] };
    if (path.endsWith('/auth/csrf')) body = { token: 'fertilizer-token', headerName: 'X-CSRF-TOKEN' };
    if (path.endsWith('/farms')) body = [farm];
    if (path.endsWith('/fields')) body = [field];
    if (path.endsWith('/blocks')) body = [block];
    if (path.endsWith('/fertilization')) body = records;
    if (path.endsWith('/fertilization/analyses')) {
      expect(request.method()).toBe('POST'); expect(request.headers()['x-csrf-token']).toBe('fertilizer-token');
      const payload = request.postDataJSON();
      expect(payload.results).toEqual([{ nutrient: 'B', value: 0.7, unit: 'MG_KG', method: 'Agua caliente' }]);
      body = { ...payload, id: 31, createdBy: 1, hasReport: false }; records.analyses.push(body as Record<string, unknown>); saved = true;
    }
    await route.fulfill({ status: path.endsWith('/fertilization/analyses') ? 201 : 200, contentType: 'application/json', body: JSON.stringify(body) });
  });
  await page.goto('/#fertilization');
  await expect(page.locator('.environment-bar')).toContainText('Conectado a tu finca');
  await page.getByRole('button', { name: 'Nuevo análisis', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Laboratorio', { exact: true }).fill('Lab conectado');
  await dialog.getByLabel('Referencia de muestra', { exact: true }).fill('LIVE-001');
  await dialog.getByLabel('Valor B', { exact: true }).fill('0.7');
  await dialog.getByLabel('Método B', { exact: true }).fill('Agua caliente');
  await dialog.getByRole('button', { name: 'Guardar', exact: true }).click();
  await expect(dialog).not.toBeVisible();
  await expect(page.getByRole('table')).toContainText('LIVE-001');
  await page.getByRole('button', { name: 'Planes', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Nuevo plan', exact: true })).toHaveCount(0);
  expect(saved).toBe(true);
});

async function fillPlan(dialog: Locator, {
  blockId, analysisId, product, scheduledOn, followUpOn,
}: { blockId: string; analysisId: string; product: string; scheduledOn: string; followUpOn: string }) {
  await dialog.getByRole('combobox', { name: 'Bloque', exact: true }).selectOption(blockId);
  await dialog.getByRole('combobox', { name: 'Análisis de referencia', exact: true }).selectOption(analysisId);
  await dialog.getByLabel('Etapa de crecimiento', { exact: true }).fill('Vegetativo');
  await dialog.getByLabel('Diagnóstico y justificación técnica').fill('Registro ficticio para verificar el flujo.');
  await dialog.getByLabel('Objetivo agronómico').fill('Comprobar los controles del plan.');
  await dialog.getByLabel('Producto', { exact: true }).fill(product);
  await dialog.getByLabel('Composición declarada (N-P-K y otros)').fill('Composición de prueba');
  await dialog.getByLabel('Dosis definida por el técnico').fill('10');
  await dialog.getByRole('combobox', { name: 'Unidad de dosis', exact: true }).selectOption('KG_HA');
  await dialog.getByLabel('Cobertura (ha o plantas según unidad de dosis)').fill('1');
  await dialog.getByLabel('Método e instrucciones de aplicación').fill('Método ficticio QA');
  await dialog.getByLabel('Fecha programada', { exact: true }).fill(scheduledOn);
  await dialog.getByLabel('Fecha de seguimiento', { exact: true }).fill(followUpOn);
}

test('canceled plan preserves its reason and appears only in the matching block CSV', async ({ page }) => {
  await page.goto('/#fertilization');
  await page.getByRole('button', { name: 'Planes', exact: true }).click();
  const dialog = page.getByRole('dialog');
  for (const [blockId, product] of [['1', 'Plan anulado QA'], ['2', 'Plan de otro bloque QA']]) {
    await page.getByRole('button', { name: 'Nuevo plan', exact: true }).click();
    await fillPlan(dialog, { blockId, analysisId: blockId, product, scheduledOn: day(3), followUpOn: day(1) });
    await dialog.getByRole('button', { name: 'Guardar', exact: true }).click();
    await expect(dialog).toBeHidden();
  }
  const canceled = page.getByRole('row').filter({ hasText: 'Plan anulado QA' });
  await canceled.getByRole('button', { name: 'Anular', exact: true }).click();
  const reason = 'Cambio de alcance documentado en la prueba.';
  await dialog.getByLabel('Justificación de la decisión').fill(reason);
  await dialog.getByRole('button', { name: 'Guardar', exact: true }).click();
  await expect(canceled).toContainText('Anulado');
  await expect(canceled.getByRole('button', { name: /Aprobar|Generar tarea|Registrar aplicación|Anular/ })).toHaveCount(0);

  await page.reload();
  await page.getByRole('button', { name: 'Planes', exact: true }).click();
  await canceled.getByRole('button', { name: /^Ver plan/ }).click();
  await expect(dialog).toContainText('Justificación de la decisión');
  await expect(dialog).toContainText(reason);
  await dialog.getByRole('button', { name: 'Cerrar', exact: true }).click();
  await page.getByRole('combobox', { name: 'Filtrar bloque', exact: true }).selectOption('1');
  const downloaded = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Exportar planes CSV', exact: true }).click();
  const csv = await readFile((await (await downloaded).path())!, 'utf8');
  expect(csv).toContain('"Plan","Bloque","Estado","Producto","Programado","Aplicado","Unidad","Seguimiento"');
  expect(csv).toContain('"Anulado","Plan anulado QA","10","0","kg"');
  expect(csv).not.toContain('Plan de otro bloque QA');
});

async function csrfHeaders(session: APIRequestContext) {
  const response = await session.get('/api/v1/auth/csrf');
  await expect(response).toBeOK();
  const { headerName, token } = await response.json() as { headerName: string; token: string };
  return { [headerName]: token };
}

async function logIn(session: APIRequestContext, credentials: { email: string; password: string }) {
  const response = await session.post('/api/v1/auth/login', { headers: await csrfHeaders(session), data: credentials });
  await expect(response).toBeOK();
  return await response.json() as { user: { id: number; name: string } };
}

async function workerSession(baseURL: string, credentials: { email: string; password: string }) {
  const session = await httpRequest.newContext({ baseURL });
  try {
    await logIn(session, credentials);
    return session;
  } catch (error) {
    await session.dispose();
    throw error;
  }
}

test('connected recurring fertilization keeps occurrence balances and posts compatible inventory consumption', async ({ page }, info) => {
  test.skip(process.env.AGRO_LIVE_TEST !== '1', 'Requires the isolated QA backend.');
  if (process.env.AGRO_MODULE_CONNECTED === '1') {
    await walkthrough(({ page, step }) => connectedFertilization(page, info,
      (title, explanation, focus) => step(title, explanation, async () => focus)), 'Fertilización en PostGIS')({ page }, info);
    return;
  }
  test.setTimeout(120_000);
  await connectedFertilization(page, info);
});

async function connectedFertilization(page: Page, info: TestInfo, show?: ShowFertilizationStep) {
  const api = '/api/v1';
  const recurrenceEnd = localDate();
  const firstScheduled = new Date(`${recurrenceEnd}T12:00:00Z`);
  firstScheduled.setUTCDate(firstScheduled.getUTCDate() - 7);
  const scheduledOn = firstScheduled.toISOString().slice(0, 10);
  const credentials = { email: `fertilizacion-${randomUUID()}@example.com`, password: randomUUID() };
  await expect(await page.request.post(`${api}/auth/register`, {
    headers: await csrfHeaders(page.request), data: { name: 'AgroVision QA', ...credentials },
  })).toBeOK();
  const { user: admin } = await logIn(page.request, credentials);
  await page.addInitScript(() => sessionStorage.setItem('agrovision.live', 'true'));
  const headers = await csrfHeaders(page.request);
  async function create(resource: string, data: object) {
    const response = await page.request.post(`${api}/${resource}`, { data, headers });
    await expect(response).toBeOK();
    return await response.json() as { id: number };
  }
  const farm = await create('farms', { name: 'Finca QA de fertilización recurrente' });
  async function createWorker(name: string) {
    const credentials = { email: `fertilizacion-${randomUUID()}@example.com`, password: randomUUID() };
    await expect(await page.request.post(`${api}/auth/register`, { headers, data: { name, ...credentials } })).toBeOK();
    const membership = await page.request.put(`${api}/farms/${farm.id}/members`, {
      headers, data: { email: credentials.email, role: 'WORKER' },
    });
    await expect(membership).toBeOK();
    const { userId } = await membership.json() as { userId: number };
    return { name, credentials, userId };
  }
  const worker = await createWorker('Operario fertilización QA');
  const unassigned = await createWorker('Operario sin asignación QA');
  const polygon = { coordinates: [[[-74.1, 10.5], [-74.11, 10.5], [-74.11, 10.51], [-74.1, 10.5]]] };
  const field = await create('fields', { farmId: farm.id, name: 'Campo QA', polygon, areaHa: 12 });
  const block = await create('blocks', { fieldId: field.id, code: 'Bloque QA', polygon, areaHa: 10 });
  const sample = {
    blockId: block.id, sampleType: 'SOIL', sampledOn: day(10), laboratory: 'Laboratorio QA', reference: 'MUESTRA-REC-QA',
    depthCm: 15, results: [{ nutrient: 'B', unit: 'MG_KG', value: 0.4, method: 'Agua caliente' }],
  };
  const followupSample = await create('fertilization/analyses', { ...sample, sampledOn: day(1), reference: 'SEGUIMIENTO-REC-QA' });
  const productName = 'Insumo recurrente QA';
  const product = await create('inventory/products', {
    farmId: farm.id, code: 'FERT-REC-QA', name: productName, category: 'Fertilizantes', unit: 'kg', minimum: 0,
  });
  const stockLot = await create('inventory/lots', { farmId: farm.id, productId: product.id, code: 'LOTE-REC-QA', unitCostCop: 250 });
  const expiredLot = await create('inventory/lots', { farmId: farm.id, productId: product.id, code: 'LOTE-VENCIDO-QA', unitCostCop: 250, expiresOn: day(10) });
  for (const lot of [stockLot, expiredLot]) {
    await create('inventory/movements', { farmId: farm.id, lotId: lot.id, requestId: randomUUID(), direction: 'IN', quantity: 26 });
  }

  await page.goto('/#fertilization');
  await page.reload();
  const dialog = page.getByRole('dialog');
  const save = dialog.getByRole('button', { name: 'Guardar', exact: true });
  const dismiss = dialog.getByRole('button', { name: 'Cerrar', exact: true });
  await page.context().grantPermissions(['geolocation']);
  await page.context().setGeolocation({ latitude: 10.503, longitude: -74.108, accuracy: 8 });
  await page.getByRole('button', { name: 'Análisis', exact: true }).click();
  await page.getByRole('button', { name: 'Nuevo análisis', exact: true }).click();
  await dialog.getByLabel('Fecha de muestreo', { exact: true }).fill(sample.sampledOn);
  await dialog.getByLabel('Laboratorio', { exact: true }).fill(sample.laboratory);
  await dialog.getByLabel('Referencia de muestra', { exact: true }).fill(sample.reference);
  await dialog.getByLabel('Profundidad (cm; 0 para foliar)', { exact: true }).fill(String(sample.depthCm));
  await dialog.getByLabel('Valor B', { exact: true }).fill('0.4');
  await dialog.getByLabel('Método B', { exact: true }).fill('Agua caliente');
  await dialog.getByRole('button', { name: 'Usar ubicación actual', exact: true }).click();
  const latitude = dialog.getByLabel('Latitud (opcional)', { exact: true });
  await expect(latitude).toHaveValue('10.503000');
  await expect(dialog.getByLabel('Longitud (opcional)', { exact: true })).toHaveValue('-74.108000');
  await expect(dialog.getByRole('status')).toContainText('8 m');
  await show?.('Registrar una muestra y capturar su ubicación', 'La muestra de suelo tiene referencia, resultado y un punto capturado por GPS con una precisión de 8 m.', latitude.locator('..'));
  const createdSample = page.waitForResponse(response => new URL(response.url()).pathname === `${api}/fertilization/analyses`
    && response.request().method() === 'POST');
  await dialog.getByRole('button', { name: 'Guardar y adjuntar fotos', exact: true }).click();
  const sampleResponse = await createdSample;
  expect(sampleResponse.ok()).toBe(true);
  const analysis = await sampleResponse.json() as { id: number };
  await attachDemoPhoto(page, dialog, 'muestra-rec-qa.png', 'Muestra georreferenciada');
  await page.reload();
  await page.getByRole('button', { name: 'Análisis', exact: true }).click();
  await page.getByRole('row').filter({ hasText: sample.reference }).getByRole('button', { name: /^Ver análisis/ }).click();
  await expect(dialog).toContainText('10.503, -74.108');
  await expect(dialog.getByRole('region', { name: 'Mapa del punto de toma de la muestra' })).toBeVisible();
  await expect(dialog.getByRole('img', { name: 'muestra-rec-qa.png', exact: true })).toHaveJSProperty('naturalWidth', 540);
  await show?.('Recuperar la foto y el mapa de la muestra', 'El punto y la foto quedan vinculados con la muestra y se recuperan al volver a abrirla.', dialog.getByRole('region', { name: 'Fotos adjuntas' }));
  await dismiss.click();
  await page.getByRole('button', { name: 'Planes', exact: true }).click();
  await page.getByRole('button', { name: 'Nuevo plan', exact: true }).click();
  await fillPlan(dialog, { blockId: String(block.id), analysisId: String(analysis.id), product: productName, scheduledOn, followUpOn: day(1) });
  await dialog.getByRole('combobox', { name: 'Responsable', exact: true }).selectOption(String(admin.id));
  await dialog.getByRole('combobox', { name: 'Frecuencia de aplicación', exact: true }).selectOption('WEEKLY');
  await dialog.getByLabel('Fecha final de recurrencia (opcional)', { exact: true }).fill(recurrenceEnd);
  await save.click();
  const planRow = page.getByRole('row').filter({ hasText: productName });
  await expect(planRow).toContainText('Pendiente de aprobación');
  await show?.('Crear un plan semanal para el bloque', 'El plan usa la muestra recién registrada y queda pendiente de aprobación.', planRow);
  await planRow.getByRole('button', { name: 'Aprobar', exact: true }).click();
  await dialog.getByLabel('Justificación de la decisión').fill('Aprobación de QA para dos ocurrencias semanales.');
  await save.click();
  await expect(planRow).toContainText('20 / 0 kg');
  await expect(planRow.getByRole('button', { name: 'Generar tarea', exact: true })).toHaveCount(0);
  await expect(planRow.getByRole('button', { name: 'Anular', exact: true })).toHaveCount(0);
  await planRow.getByRole('button', { name: /^Ver plan/ }).click();
  await expect(dialog).toContainText(`Semanal · 2 ocurrencias hasta ${recurrenceEnd}`);
  const taskTable = dialog.getByRole('table', { name: 'Tareas de fertilización del plan' });
  await expect(taskTable.getByRole('row')).toHaveCount(3);
  await show?.('Aprobar el plan y generar dos tareas', 'La aprobación genera automáticamente una tarea por cada ocurrencia semanal.', taskTable);
  const assigned = taskTable.getByRole('row').nth(2);
  await assigned.getByRole('combobox', { name: /Reasignar tarea/ }).selectOption(String(worker.userId));
  await assigned.getByRole('button', { name: 'Guardar responsable' }).click();
  await expect(assigned.getByRole('cell', { name: worker.name, exact: true })).toBeVisible();
  await expect(taskTable.getByRole('row').nth(1).getByRole('cell', { name: admin.name, exact: true })).toBeVisible();
  await expect(assigned.getByRole('button', { name: 'Guardar responsable' })).toBeEnabled();
  if (show) await show('Repartir las tareas de fertilización', 'La segunda tarea se reasigna al operario y la primera conserva su responsable.', taskTable);
  else await info.attach('tareas-repartidas-por-ocurrencia', { body: await taskTable.screenshot(), contentType: 'image/png' });
  await dismiss.click();
  await expect(dialog).toBeHidden();

  const fertilizationPath = `${api}/fertilization?farmId=${farm.id}`;
  const savedPlanResponse = await page.request.get(fertilizationPath);
  await expect(savedPlanResponse).toBeOK();
  const savedPlan = (await savedPlanResponse.json() as FertilizationData).plans.find(item => item.product === productName);
  if (!savedPlan || savedPlan.tasks?.length !== 2) throw new Error('Se esperaba el plan semanal con dos tareas.');
  const applicationPath = `${api}/fertilization/plans/${savedPlan.id}/applications`;
  const [firstTask, secondTask] = savedPlan.tasks;

  async function openApplication(applicationDay = day(2)) {
    await planRow.getByRole('button', { name: 'Registrar aplicación', exact: true }).click();
    await dialog.getByLabel('Fecha y hora reales', { exact: true }).fill(`${applicationDay}T08:00`);
    return dialog.getByRole('combobox', { name: 'Ocurrencia de aplicación', exact: true });
  }
  const occurrence = await openApplication();
  await expect(occurrence.getByRole('option')).toHaveCount(3);
  await expect(occurrence.getByRole('option', { name: new RegExp(firstTask.occurrenceOn) })).toHaveCount(1);
  await expect(occurrence.getByRole('option', { name: new RegExp(secondTask.occurrenceOn) })).toHaveCount(1);
  await occurrence.selectOption({ index: 1 });
  const lots = dialog.getByRole('combobox', { name: 'Lote de inventario', exact: true });
  await lots.selectOption(String(stockLot.id));
  await expect(lots.getByRole('option', { name: /LOTE-VENCIDO-QA/ })).toHaveCount(0);
  const quantity = dialog.getByLabel('Cantidad aplicada (kg)', { exact: true });
  await expect(quantity).toHaveAttribute('max', '10');
  await quantity.fill('4');
  await dialog.getByLabel('Cobertura real (ha)', { exact: true }).fill('0.4');
  await show?.('Cargar la aplicación parcial y seleccionar el lote', 'La primera ocurrencia admite hasta 10 kg. Se registran 4 kg en 0,4 ha. El lote vencido queda fuera de la selección.', quantity.locator('..'));
  await save.click();
  await expect(dialog).toContainText('LOTE-REC-QA');
  await expect(dialog).toContainText('Salida de inventario');
  await expect(dialog).toContainText('1.000 COP');
  const applicationPhotos = await attachDemoPhoto(page, dialog, 'aplicacion-qa.png', 'Aplicación parcial de fertilización');
  await show?.('Subir una foto de la aplicación', 'La aplicación de 4 kg conserva su evidencia, la salida de inventario y el costo asociado.', applicationPhotos);
  await dismiss.click();
  await page.getByRole('button', { name: 'Planes', exact: true }).click();
  await expect(planRow).toContainText('20 / 4 kg');
  await openApplication();
  await lots.selectOption(String(stockLot.id));
  await occurrence.selectOption({ index: 1 });
  await expect(quantity).toHaveAttribute('max', '6');
  await occurrence.selectOption({ index: 2 });
  await expect(quantity).toHaveAttribute('max', '10');
  await show?.('Comprobar el saldo de cada recurrencia', 'La primera ocurrencia conserva 6 kg por ejecutar. La segunda tiene sus 10 kg completos pendientes.', occurrence.locator('..'));

  const inventory = await page.request.get(`${api}/inventory?farmId=${farm.id}`);
  await expect(inventory).toBeOK();
  const stock = await inventory.json();
  expect(stock.lots).toContainEqual(expect.objectContaining({ id: stockLot.id, balance: 22 }));
  expect(stock.movements.entries.filter((entry: { direction: string }) => entry.direction === 'OUT'))
    .toEqual([expect.objectContaining({ lotId: stockLot.id, quantity: 4, balanceAfter: 22, costCop: 1000 })]);

  const finances = await page.request.get(`${api}/finances?farmId=${farm.id}&month=${day(2).slice(0, 7)}`);
  await expect(finances).toBeOK();
  expect((await finances.json()).entries).toEqual([
    expect.objectContaining({ category: 'FERTILIZERS', amount: 1000, blockId: block.id }),
  ]);
  await dialog.getByRole('button', { name: 'Cancelar', exact: true }).click();
  await planRow.getByRole('button', { name: 'Registrar seguimiento', exact: true }).click();
  await dialog.getByRole('combobox', { name: 'Nuevo análisis de seguimiento (opcional)', exact: true }).selectOption(String(followupSample.id));
  await dialog.getByLabel('Observaciones y conclusión técnica').fill('Seguimiento QA vinculado a un análisis posterior.');
  await dialog.getByRole('button', { name: 'Guardar', exact: true }).click();
  await expect(planRow).toContainText('1 revisiones');
  await planRow.getByRole('button', { name: /^Ver plan/ }).click();
  await expect(dialog).toContainText('Seguimiento QA vinculado a un análisis posterior.');
  await expect(dialog).toContainText(`Análisis de seguimiento #${followupSample.id}`);
  await show?.('Vincular un análisis de seguimiento', 'La revisión técnica queda en el plan y conserva el vínculo al análisis posterior.', dialog.getByText(`Análisis de seguimiento #${followupSample.id}`, { exact: true }).locator('..'));
  const coverage = dialog.locator('.fertilization-plan-coverage');
  await expect(coverage).toContainText('Mapa de ejecución del plan');
  await coverage.getByRole('combobox', { name: 'Ocurrencia de cobertura' }).selectOption({ index: 1 });
  const totals = coverage.getByLabel('Cobertura y producto del plan');
  await expect(totals.getByText('0,4 ha', { exact: true })).toBeVisible();
  await expect(coverage).toContainText('0,6 ha');
  await expect(coverage).toContainText('6 kg');
  if (show) await show('Consultar el mapa de ejecución del plan', 'La primera recurrencia muestra 0,4 ha ejecutadas, 0,6 ha pendientes y un saldo de producto de 6 kg.', coverage);
  else await info.attach('mapa-del-plan-parcial', { body: await coverage.screenshot(), contentType: 'image/png' });
  await coverage.getByRole('combobox', { name: 'Ocurrencia de cobertura' }).selectOption({ index: 2 });
  await expect(coverage).toContainText('10 kg');
  await expect(coverage).toContainText('Pendiente');
  await dialog.getByRole('button', { name: /Ver aplicación y fotos/ }).click();
  await expect(dialog.getByRole('img', { name: 'aplicacion-qa.png', exact: true })).toHaveJSProperty('naturalWidth', 540);
  if (!show) await info.attach('foto-de-aplicacion', { body: await dialog.getByRole('region', { name: 'Fotos adjuntas' }).screenshot(), contentType: 'image/png' });
  await dismiss.click();
  async function completeApplication(taskId: number, kilograms: number, hectares: number) {
    await occurrence.selectOption(String(taskId));
    await lots.selectOption(String(stockLot.id));
    await expect(quantity).toHaveAttribute('max', String(kilograms));
    await quantity.fill(String(kilograms));
    await dialog.getByLabel('Cobertura real (ha)', { exact: true }).fill(String(hectares));
    const posted = page.waitForResponse(response => new URL(response.url()).pathname === applicationPath
      && response.request().method() === 'POST');
    await save.click();
    const response = await posted;
    expect(response.ok()).toBe(true);
    await expect(dialog).toHaveAccessibleName(/^Aplicación #/);
    const application = await response.json() as FertilizationApplication;
    expect(application).toMatchObject({ taskId, quantity: kilograms, coverage: hectares });
    return application;
  }

  await openApplication();
  const firstCompletion = await completeApplication(firstTask.taskId, 6, 0.6);
  expect(firstCompletion.costCop).toBe(1500);
  await show?.('Completar la primera recurrencia', 'La segunda pasada completa los 10 kg previstos para la primera recurrencia.', dialog.getByText('1.500', { exact: false }).first());
  await dismiss.click();
  await page.getByRole('button', { name: 'Planes', exact: true }).click();
  await expect(planRow).toContainText('20 / 10 kg');

  const baseURL = new URL(page.url()).origin;
  const otherSession = await workerSession(baseURL, unassigned.credentials);
  try {
    const rejected = await otherSession.post(applicationPath, {
      headers: await csrfHeaders(otherSession),
      data: { taskId: secondTask.taskId, occurredAt: `${day(1)}T13:00:00Z`, quantity: 1, coverage: 0.1,
        method: 'Método ficticio QA', inventoryLotId: stockLot.id, operationId: randomUUID() },
    });
    expect(rejected.status()).toBe(403);
  } finally {
    await otherSession.dispose();
  }

  const adminCookies = await page.context().cookies();
  const assignedSession = await workerSession(baseURL, worker.credentials);
  const taskCards = page.locator('.task-card').filter({ hasText: `Fertilización #${savedPlan.id} · ${productName}` });
  const taskDetail = page.getByRole('dialog', { name: 'Detalle de la tarea' });
  try {
    await page.context().clearCookies();
    await page.context().addCookies((await assignedSession.storageState()).cookies);
    await page.goto('/#tasks');
    await page.reload();
    await expect(taskCards).toHaveCount(1);
    await expect(taskCards).toContainText(worker.name);
    await taskCards.click();
    await taskDetail.getByRole('button', { name: 'Iniciar tarea', exact: true }).click();
    await expect(taskDetail.getByRole('button', { name: 'Enviar a revisión', exact: true })).toBeEnabled();
    await show?.('Abrir la tarea de fertilización como operario', 'El operario ve su ocurrencia reasignada. La API rechaza el registro de otro trabajador de la misma finca.', taskDetail.getByRole('heading', { name: /Fertilización #/ }));
    await taskDetail.getByRole('button', { name: 'Cerrar', exact: true }).click();
    await page.goto('/#fertilization');
    await page.getByRole('button', { name: 'Planes', exact: true }).click();
    await openApplication(day(1));
    await expect(occurrence.getByRole('option')).toHaveCount(2);
    await expect(occurrence.getByRole('option', { name: new RegExp(secondTask.occurrenceOn) })).toHaveCount(1);
    const workerApplication = await completeApplication(secondTask.taskId, 10, 1);
    expect(workerApplication.createdBy).toBe(worker.userId);
    expect(workerApplication).not.toHaveProperty('costCop');
    expect(workerApplication).not.toHaveProperty('financialEntryId');
    await expect(dialog.getByText('Costo contabilizado', { exact: true })).toHaveCount(0);
    await show?.('Completar la segunda recurrencia como operario', 'El operario registra 10 kg en su ocurrencia. La aplicación queda vinculada a su cuenta y el costo queda reservado a los roles autorizados.', dialog.getByText('Salida de inventario', { exact: true }));
    await dismiss.click();
    await page.goto('/#tasks');
    await taskCards.click();
    await taskDetail.getByLabel('Notas y novedades').fill('Aplicación de fertilización completada según el plan QA.');
    await taskDetail.getByRole('button', { name: 'Enviar a revisión', exact: true }).click();
    await expect(taskDetail).toContainText('Por revisar');
    await expect(taskDetail.getByRole('button', { name: 'Aprobar trabajo', exact: true })).toHaveCount(0);
    await show?.('Enviar la aplicación de fertilización a revisión', 'El operario envía su tarea a revisión y conserva las notas de ejecución.', taskDetail.getByRole('heading', { name: /Fertilización #/ }));
  } finally {
    await page.context().clearCookies();
    await page.context().addCookies(adminCookies);
    await assignedSession.dispose();
  }

  await page.goto('/#tasks');
  await page.reload();
  for (const name of [admin.name, worker.name]) {
    await taskCards.filter({ hasText: name }).click();
    if (name === admin.name) {
      await taskDetail.getByLabel('Notas y novedades').fill('Primera recurrencia completada en dos aplicaciones.');
      await taskDetail.getByRole('button', { name: 'Enviar a revisión', exact: true }).click();
    }
    await taskDetail.getByRole('button', { name: 'Aprobar trabajo', exact: true }).click();
    await expect(taskDetail).toContainText('Trabajo completado y revisado.');
    await taskDetail.getByRole('button', { name: 'Cerrar', exact: true }).click();
    await expect(taskDetail).toBeHidden();
  }

  await page.goto('/#fertilization');
  await page.reload();
  await page.getByRole('button', { name: 'Planes', exact: true }).click();
  await expect(planRow).toContainText('20 / 20 kg');
  await expect(planRow.getByRole('button', { name: 'Registrar aplicación', exact: true })).toHaveCount(0);
  await planRow.getByRole('button', { name: /^Ver plan/ }).click();
  const completedRows = taskTable.getByRole('row');
  await expect(completedRows).toHaveCount(3);
  for (const taskRow of (await completedRows.all()).slice(1)) {
    await expect(taskRow).toContainText('Completada');
    await expect(taskRow).toContainText('10 / 0 kg');
  }
  const coverageOccurrence = coverage.getByRole('combobox', { name: 'Ocurrencia de cobertura' });
  await coverageOccurrence.selectOption(String(firstTask.taskId));
  await expect(totals.getByText('1 ha', { exact: true })).toHaveCount(2);
  await expect(coverage).toContainText('Si se superponen, una misma zona puede contarse más de una vez.');
  await coverageOccurrence.selectOption(String(secondTask.taskId));
  await expect(coverage.getByText(/Si se superponen/)).toHaveCount(0);

  const finalStock = await page.request.get(`${api}/inventory?farmId=${farm.id}`);
  await expect(finalStock).toBeOK();
  const finalInventory = await finalStock.json();
  expect(finalInventory.lots).toContainEqual(expect.objectContaining({ id: stockLot.id, balance: 6 }));
  const withdrawals = finalInventory.movements.entries.filter((entry: { direction: string }) => entry.direction === 'OUT');
  expect(withdrawals).toHaveLength(3);
  expect(withdrawals).toEqual(expect.arrayContaining([
    expect.objectContaining({ lotId: stockLot.id, quantity: 4, balanceAfter: 22, costCop: 1000 }),
    expect.objectContaining({ lotId: stockLot.id, quantity: 6, balanceAfter: 16, costCop: 1500 }),
    expect.objectContaining({ lotId: stockLot.id, quantity: 10, balanceAfter: 6, costCop: 2500 }),
  ]));
  const expenseRows = await Promise.all([...new Set([day(1), day(2)].map(date => date.slice(0, 7)))].map(async month => {
    const response = await page.request.get(`${api}/finances?farmId=${farm.id}&month=${month}`);
    await expect(response).toBeOK();
    return (await response.json()).entries;
  }));
  const expenses = expenseRows.flat();
  expect(expenses).toHaveLength(3);
  expect(expenses).toEqual(expect.arrayContaining([1000, 1500, 2500].map(amount =>
    expect.objectContaining({ category: 'FERTILIZERS', amount, blockId: block.id, sourceType: 'FERTILIZATION_APPLICATION' }))));
  expect(new Set(expenses.map(entry => entry.sourceId)).size).toBe(3);
  await show?.('Verificar las dos recurrencias cerradas', 'Cada tarea quedó en 10 de 10 kg. Se verificaron tres aplicaciones, tres gastos por 5.000 COP en total y un saldo final de 6 kg en el lote.', taskTable);
  await dismiss.click();
  await verifyFertilizationFarmCoverage(page, show);
  const scenario = { farmId: farm.id, blockId: block.id, analysisId: analysis.id };
  await verifyFertilizationMonthlySchedule(page, scenario, show);
  await verifyFertilizationConcurrentSave(page, scenario, show);
  await verifyFertilizationEvidenceRecovery(page, show);
}
