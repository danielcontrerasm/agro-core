import { randomUUID } from 'node:crypto';
import { expect, type APIResponse, type Locator, type Page } from '@playwright/test';
import type { FinanceMonth } from '../../src/lib/costs';
import type { FertilizationApplication, FertilizationData, FertilizationPlan } from '../../src/lib/fertilization';
import type { InventoryLot, InventoryOverview, InventoryProduct } from '../../src/lib/inventory';
import type { FieldEvent, Profile } from '../../src/lib/types';

export type ShowFertilizationStep = (title: string, detail: string, focus: Locator) => Promise<void>;

type Scenario = { farmId: number; blockId: number; analysisId: number };

const api = '/api/v1';
const kilogramsPerOccurrence = 12;

async function readJson<T>(response: APIResponse, status = 200): Promise<T> {
  expect(response.status(), new URL(response.url()).pathname).toBe(status);
  return await response.json() as T;
}

async function fixtureApi(page: Page) {
  const [profileResponse, csrfResponse] = await Promise.all([
    page.request.get(`${api}/auth/me`),
    page.request.get(`${api}/auth/csrf`),
  ]);
  const profile = await readJson<Profile>(profileResponse);
  const csrf = await readJson<{ headerName: string; token: string }>(csrfResponse);
  const headers = { [csrf.headerName]: csrf.token };
  return {
    assigneeId: profile.user.id,
    post: (resource: string, data: object) => page.request.post(`${api}/${resource}`, { data, headers }),
  };
}

async function approvePlan(fixture: Awaited<ReturnType<typeof fixtureApi>>, scenario: Scenario, plan: {
  product: string; scheduledOn: string; recurrenceUntil: string; recurrence: 'WEEKLY' | 'MONTHLY';
}) {
  const draft = await readJson<FertilizationPlan>(await fixture.post('fertilization/plans', {
    blockId: scenario.blockId, analysisId: scenario.analysisId, ...plan,
    growthStage: 'Vegetativo', diagnosis: 'Registro sintético QA.', objective: 'Verificar la ejecución del plan.',
    composition: 'Composición de prueba', dose: 1000, doseUnit: 'G_PLANT', coverage: kilogramsPerOccurrence,
    method: 'Simulación QA', scheduledTime: '08:00', assigneeId: fixture.assigneeId, followUpOn: plan.recurrenceUntil,
  }), 201);
  return readJson<FertilizationPlan>(await fixture.post(`fertilization/plans/${draft.id}/approve`, {
    version: draft.version, reason: 'Aprobación del escenario de QA.',
  }));
}

async function openFertilizationTab(page: Page, tab: 'Planes' | 'Aplicaciones') {
  await page.goto('/#fertilization');
  await page.reload();
  await page.getByRole('button', { name: tab, exact: true }).click();
}

export async function verifyFertilizationConcurrentSave(page: Page, scenario: Scenario, show?: ShowFertilizationStep) {
  const { farmId, blockId } = scenario;
  const fixture = await fixtureApi(page);
  const token = randomUUID();
  const productName = `Fertilizante QA concurrencia ${token}`;
  const lotCode = `FERT-QA-${token.toUpperCase()}`;
  const unitCost = 250;
  const product = await readJson<InventoryProduct>(await fixture.post('inventory/products', {
    farmId, code: lotCode, name: productName, category: 'Fertilizantes', unit: 'kg', minimum: 0,
  }), 201);
  const lot = await readJson<InventoryLot>(await fixture.post('inventory/lots', {
    farmId, productId: product.id, code: lotCode, unitCostCop: unitCost,
  }), 201);
  const stock = 10;
  const applied = 6;
  const balance = stock - applied;
  const cost = applied * unitCost;
  const receipt = await readJson<{ id: number; balanceAfter: number }>(await fixture.post('inventory/movements', {
    farmId, lotId: lot.id, requestId: randomUUID(), direction: 'IN', quantity: stock,
  }), 201);
  expect(receipt.balanceAfter).toBe(stock);

  const occurredAt = new Date().toISOString();
  const date = occurredAt.slice(0, 10);
  const nextWeek = new Date(Date.parse(date) + 7 * 86_400_000).toISOString().slice(0, 10);
  const plan = await approvePlan(fixture, scenario, {
    product: productName, scheduledOn: date, recurrenceUntil: nextWeek, recurrence: 'WEEKLY',
  });
  expect(plan.tasks?.map(task => task.occurrenceOn)).toEqual([date, nextWeek]);
  expect(plan.totalQuantity).toBe(2 * kilogramsPerOccurrence);
  const taskId = plan.tasks![0].taskId;
  const endpoint = `fertilization/plans/${plan.id}/applications`;
  const requests = [randomUUID(), randomUUID()].map((operationId, index) => ({
    operationId, taskId, occurredAt, inventoryLotId: lot.id, quantity: applied, coverage: applied,
    method: 'Simulación QA', notes: `Intento simultáneo ${index + 1} del plan de prueba`,
  }));
  const responses = await Promise.all(requests.map(data => fixture.post(endpoint, data)));
  expect(responses.map(response => response.status()).sort()).toEqual([201, 409]);
  const winnerIndex = responses.findIndex(response => response.status() === 201);
  const rejected = await readJson<{ detail: string }>(responses[1 - winnerIndex], 409);
  expect(rejected.detail).toContain('La cantidad supera las existencias del lote.');

  const winner = requests[winnerIndex];
  const application = await readJson<FertilizationApplication>(responses[winnerIndex], 201);
  expect(application).toMatchObject({
    planId: plan.id, taskId, inventoryLotId: lot.id, operationId: winner.operationId,
    quantity: applied, lot: lotCode, costCop: cost,
  });
  const replay = await readJson<FertilizationApplication>(await fixture.post(endpoint, winner), 201);
  expect(replay).toEqual(application);

  const month = date.slice(0, 7);
  const [fertilizationResponse, inventoryResponse, financeResponse, eventsResponse] = await Promise.all([
    page.request.get(`${api}/fertilization?farmId=${farmId}`),
    page.request.get(`${api}/inventory?farmId=${farmId}`),
    page.request.get(`${api}/finances?farmId=${farmId}&month=${month}`),
    page.request.get(`${api}/events?farmId=${farmId}&blockId=${blockId}&eventType=FERTILIZER_APPLICATION`),
  ]);
  const fertilization = await readJson<FertilizationData>(fertilizationResponse);
  expect(fertilization.plans.find(entry => entry.id === plan.id)).toMatchObject({ appliedQuantity: applied });
  expect(fertilization.applications.filter(entry => entry.planId === plan.id)).toEqual([application]);

  const inventory = await readJson<InventoryOverview>(inventoryResponse);
  expect(inventory.lots.find(entry => entry.id === lot.id)).toMatchObject({ code: lotCode, balance });
  const movements = inventory.movements.entries.filter(entry => entry.lotId === lot.id);
  expect(movements).toEqual([
    expect.objectContaining({ id: application.inventoryMovementId, direction: 'OUT', quantity: applied, balanceAfter: balance, costCop: cost }),
    expect.objectContaining({ id: receipt.id, direction: 'IN', quantity: stock, balanceAfter: stock }),
  ]);

  const finances = await readJson<FinanceMonth>(financeResponse);
  expect(finances.entries.filter(entry => entry.sourceType === 'FERTILIZATION_APPLICATION'
    && (entry.sourceId === application.id || entry.description.endsWith(`· lote ${lotCode}`))))
    .toEqual([expect.objectContaining({
      id: application.financialEntryId, sourceType: 'FERTILIZATION_APPLICATION', sourceId: application.id,
      type: 'EXPENSE', category: 'FERTILIZERS', entryDate: date, amount: cost, blockId,
    })]);
  const events = await readJson<FieldEvent[]>(eventsResponse);
  expect(events.filter(event => event.notes?.startsWith(`Plan #${plan.id} ·`))).toEqual([expect.objectContaining({
    id: application.eventId, eventType: 'FERTILIZER_APPLICATION', block: expect.objectContaining({ id: blockId }),
    notes: expect.stringContaining(winner.notes),
  })]);

  if (show) {
    await openFertilizationTab(page, 'Aplicaciones');
    const row = page.getByRole('row').filter({ hasText: lotCode });
    await expect(row).toHaveCount(1);
    await row.getByRole('button', { name: `Ver aplicación ${application.id}`, exact: true }).click();
    const detail = page.getByRole('dialog', { name: `Aplicación #${application.id}`, exact: true });
    await expect(detail).toContainText(`${applied} kg`);
    await expect(detail).toContainText(lotCode);
    await expect(detail).toContainText('Costo contabilizado');
    await expect(detail).toContainText(winner.notes);
    await show('Guardado simultáneo y reintento', `De ${stock} kg quedaron ${balance} kg. Se registró una aplicación de ${applied} kg con una salida, un gasto de ${cost} COP y un evento. El reintento recuperó el mismo registro.`, detail.locator('.fertilization-record-detail'));
    await detail.getByRole('button', { name: 'Cerrar', exact: true }).click();
  }
}

export async function verifyFertilizationMonthlySchedule(page: Page, scenario: Scenario, show?: ShowFertilizationStep) {
  const fixture = await fixtureApi(page);
  const year = new Date().getUTCFullYear() + 1;
  const scheduledOn = `${year}-01-31`;
  const endOfFebruary = new Date(Date.UTC(year, 2, 0)).getUTCDate();
  const expectedDates = [scheduledOn, `${year}-02-${endOfFebruary}`, `${year}-03-${endOfFebruary}`];
  const recurrenceUntil = `${year}-03-31`;
  const plan = await approvePlan(fixture, scenario, {
    product: `Fertilizante QA calendario ${randomUUID()}`, scheduledOn, recurrenceUntil, recurrence: 'MONTHLY',
  });
  expect(plan.recurrenceUntil).toBe(recurrenceUntil);
  expect(plan.tasks?.map(task => task.occurrenceOn)).toEqual(expectedDates);
  expect(new Set(plan.tasks?.map(task => task.taskId)).size).toBe(expectedDates.length);
  expect(plan.totalQuantity).toBe(kilogramsPerOccurrence * expectedDates.length);
  const regenerated = await readJson<FertilizationPlan>(await fixture.post(`fertilization/plans/${plan.id}/task`, {}));
  expect(regenerated.tasks).toEqual(plan.tasks);

  if (show) {
    await openFertilizationTab(page, 'Planes');
    await page.getByRole('button', { name: `Ver plan ${plan.id}`, exact: true }).click();
    const detail = page.getByRole('dialog', { name: `Plan #${plan.id}`, exact: true });
    const table = detail.getByRole('table', { name: 'Tareas de fertilización del plan', exact: true });
    const rows = table.getByRole('rowgroup').last().getByRole('row');
    await expect(rows).toHaveCount(expectedDates.length);
    await expect(rows).toContainText(expectedDates.map(date => new Date(`${date}T00:00:00Z`).toLocaleDateString('es-CO', {
      timeZone: 'UTC', day: 'numeric', month: 'short', year: 'numeric',
    })));
    await show('Calendario mensual desde el 31', `El calendario generó tareas el 31 de enero, el ${endOfFebruary} de febrero y el ${endOfFebruary} de marzo. La fecha límite es el 31 de marzo.`, table);
    await detail.getByRole('button', { name: 'Cerrar', exact: true }).click();
  }
}
