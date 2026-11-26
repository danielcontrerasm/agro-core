import { randomUUID } from 'node:crypto';
import { expect, type Locator, type Page } from '@playwright/test';

type ShowStep = (title: string, description: string, focus: Locator) => Promise<void>;

function rectangle(west: number, south: number, east: number, north: number) {
  return { coordinates: [[[west, south], [east, south], [east, north], [west, north], [west, south]]] };
}

export async function verifyFertilizationFarmCoverage(page: Page, show?: ShowStep) {
  const api = '/api/v1';
  const farmId = Number(await page.getByLabel('Seleccionar finca').inputValue());
  expect(farmId).toBeGreaterThan(0);
  const session = await page.request.get(`${api}/auth/me`);
  await expect(session).toBeOK();
  const { user } = await session.json() as { user: { id: number } };
  const csrfResponse = await page.request.get(`${api}/auth/csrf`);
  await expect(csrfResponse).toBeOK();
  const { headerName, token } = await csrfResponse.json() as { headerName: string; token: string };

  async function create<Result = { id: number }>(resource: string, data: object) {
    const response = await page.request.post(`${api}/${resource}`, { headers: { [headerName]: token }, data });
    await expect(response, `POST ${resource}`).toBeOK();
    return await response.json() as Result;
  }

  const westFieldName = 'Campo QA Cobertura Oeste';
  const northFieldName = 'Campo QA Cobertura Norte';
  const westField = await create('fields', { farmId, name: westFieldName, polygon: rectangle(-74.135, 10.5, -74.115, 10.51) });
  const northField = await create('fields', { farmId, name: northFieldName, polygon: rectangle(-74.135, 10.514, -74.115, 10.524) });
  const blocks = {
    covered: {
      code: 'QA Cobertura Completa', status: 'Cubierto', product: 'Fertilizante QA Cobertura Completa',
      fieldId: westField.id, polygon: rectangle(-74.134, 10.501, -74.126, 10.509),
    },
    pending: {
      code: 'QA Cobertura Pendiente', status: 'Pendiente', product: 'Fertilizante QA Cobertura Pendiente',
      fieldId: westField.id, polygon: rectangle(-74.124, 10.501, -74.116, 10.509),
    },
    partial: {
      code: 'QA Cobertura Parcial', status: 'Parcial', product: 'Fertilizante QA Cobertura Parcial',
      fieldId: northField.id, polygon: rectangle(-74.134, 10.515, -74.126, 10.523),
    },
    withoutPlan: {
      code: 'QA Cobertura Sin plan', status: 'Sin plan',
      fieldId: northField.id, polygon: rectangle(-74.124, 10.515, -74.116, 10.523),
    },
  };

  const now = Date.now();
  const day = (daysAgo: number) => new Date(now - daysAgo * 86_400_000).toISOString().slice(0, 10);
  const scheduled = day(1);

  async function planFor(fixture: typeof blocks.covered, coverage?: number) {
    const block = await create('blocks', { fieldId: fixture.fieldId, code: fixture.code, polygon: fixture.polygon, areaHa: 3 });
    const analysis = await create('fertilization/analyses', {
      blockId: block.id, sampleType: 'SOIL', sampledOn: day(2), laboratory: 'Laboratorio QA Cobertura', reference: fixture.code,
      depthCm: 15, results: [{ nutrient: 'B', unit: 'MG_KG', value: 0.4, method: 'Agua caliente' }],
    });
    const plan = await create<{ id: number; version: number }>('fertilization/plans', {
      blockId: block.id, analysisId: analysis.id, growthStage: 'Vegetativo',
      diagnosis: 'Muestra QA para comprobar el mapa por campo.', objective: 'Verificar la cobertura del plan por bloque.',
      product: fixture.product, composition: 'Composición QA', dose: 10, doseUnit: 'KG_HA', coverage: 1,
      method: 'Aplicación manual', scheduledOn: scheduled, scheduledTime: '08:00', assigneeId: user.id, followUpOn: day(0),
    });
    await create(`fertilization/plans/${plan.id}/approve`, { version: plan.version, reason: 'Aprobación de la prueba de cobertura.' });
    await create(`fertilization/plans/${plan.id}/task`, {});
    if (coverage === undefined) return { blockId: block.id, planId: plan.id };
    const product = await create('inventory/products', {
      farmId, code: `COB-QA-${block.id}`, name: fixture.product, category: 'Fertilizantes', unit: 'kg', minimum: 0,
    });
    const lot = await create('inventory/lots', { farmId, productId: product.id, code: `LOTE-COB-QA-${block.id}`, unitCostCop: 200 });
    await create('inventory/movements', { farmId, lotId: lot.id, requestId: randomUUID(), direction: 'IN', quantity: 15 });
    await create(`fertilization/plans/${plan.id}/applications`, {
      occurredAt: `${scheduled}T13:00:00Z`, quantity: coverage * 10, coverage,
      method: 'Aplicación manual', inventoryLotId: lot.id, operationId: randomUUID(),
    });
    return { blockId: block.id, planId: plan.id };
  }

  const covered = await planFor(blocks.covered, 1);
  await planFor(blocks.pending);
  const partial = await planFor(blocks.partial, 0.4);
  const withoutPlan = await create('blocks', {
    fieldId: blocks.withoutPlan.fieldId, code: blocks.withoutPlan.code, polygon: blocks.withoutPlan.polygon, areaHa: 3,
  });

  await page.goto('/#fertilization');
  await page.reload();
  const map = page.locator('.fertilization-plan-coverage');
  const legend = map.getByRole('list', { name: 'Leyenda de cobertura' });
  const fields = map.getByRole('list', { name: 'Cobertura por campo' });
  const selector = map.getByRole('combobox', { name: 'Bloque en el mapa' });
  const blockPolygon = (code: string) => map.getByRole('button', { name: `Seleccionar ${code}`, exact: true });

  const west = fields.getByRole('listitem').filter({ hasText: westFieldName });
  const north = fields.getByRole('listitem').filter({ hasText: northFieldName });
  for (const count of ['1 cubiertos', '0 parciales', '1 pendientes', '0 sin plan']) {
    await expect(west.getByText(count, { exact: true })).toBeVisible();
  }
  for (const count of ['0 cubiertos', '1 parciales', '0 pendientes', '1 sin plan']) {
    await expect(north.getByText(count, { exact: true })).toBeVisible();
  }
  for (const block of Object.values(blocks)) {
    const legendItem = legend.getByRole('listitem').filter({ hasText: block.status });
    await expect(legendItem).toBeVisible();
    const legendColor = await legendItem.locator('i').evaluate(element => getComputedStyle(element).backgroundColor);
    await expect(blockPolygon(block.code)).toHaveCSS('fill', legendColor);
  }
  await show?.('Comparar la cobertura de dos campos', 'Los colores y los conteos distinguen bloques cubiertos, parciales, pendientes y sin plan.', map);

  await blockPolygon(blocks.covered.code).click();
  await expect(selector).toHaveValue(String(covered.blockId));
  const coveredPlans = map.getByRole('list', { name: `Planes de ${blocks.covered.code}`, exact: true });
  await expect(coveredPlans.getByRole('listitem')).toHaveCount(1);
  await expect(coveredPlans.getByRole('button', { name: `Ver plan #${covered.planId}`, exact: true })).toBeVisible();
  await expect(coveredPlans).toContainText('1 ha registrados · 0 ha pendientes');

  await selector.selectOption(String(withoutPlan.id));
  await expect(map.getByText(`${blocks.withoutPlan.code} · Sin planes vigentes.`, { exact: true })).toBeVisible();
  await expect(coveredPlans).toBeHidden();

  await selector.selectOption(String(partial.blockId));
  const partialPlans = map.getByRole('list', { name: `Planes de ${blocks.partial.code}`, exact: true });
  await expect(partialPlans.getByRole('listitem')).toHaveCount(1);
  await expect(partialPlans.getByRole('button', { name: `Ver plan #${partial.planId}`, exact: true })).toBeVisible();
  await expect(partialPlans).toContainText('0,4 ha registrados · 0,6 ha pendientes');
  await expect(map.getByRole('button', { name: `Ver plan #${covered.planId}`, exact: true })).toHaveCount(0);
  await show?.('Consultar el plan del bloque seleccionado', 'El bloque parcial del Campo Norte conserva su propia cobertura y los planes del Campo Oeste quedan fuera de la selección.', partialPlans);
}
