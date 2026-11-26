import { expect, test, type Page } from '@playwright/test';
import { createQaFarm, signInAsNewQaUser } from './support/qa-account';

const correction = 'Hallazgo revisado en el recorrido QA.';
const reason = 'Corregir el registro a partir de la bitácora original.';

async function openObservation(page: Page, notes: string, id?: number) {
  await page.getByRole('button', { name: 'Historial anterior y tratamientos', exact: true }).click();
  const row = page.getByRole('row').filter({ hasText: notes });
  await row.getByRole('button', { name: id == null ? /^Ver actividad/ : `Ver actividad ${id}` }).click();
  return page.getByRole('region', { name: 'Observación histórica', exact: true });
}

async function correctObservation(page: Page, original: string, id?: number) {
  const observation = await openObservation(page, original, id);
  const history = observation.getByRole('region', { name: 'Historial de cambios' });
  await expect(history).toContainText('Sin cambios registrados.');
  await observation.getByRole('button', { name: 'Editar observación histórica' }).click();
  const editor = observation.getByRole('form', { name: 'Corregir observación histórica' });
  await editor.getByRole('combobox', { name: 'Problema fitosanitario', exact: true }).selectOption('WEEVILS');
  await editor.getByRole('combobox', { name: 'Severidad observada', exact: true }).selectOption('3');
  await editor.getByRole('textbox', { name: 'Síntomas observados', exact: true }).fill('Síntomas corregidos en la bitácora.');
  await editor.getByRole('textbox', { name: 'Notas de la observación', exact: true }).fill(correction);
  await editor.getByRole('textbox', { name: 'Motivo del cambio', exact: true }).fill(reason);
  await editor.getByRole('button', { name: 'Guardar corrección', exact: true }).click();
  await expect(history).toContainText('Versión 1');
  await expect(history).toContainText(reason);
  await expect(history).toContainText(`Antes: ${original}`);
  await expect(history).toContainText(`Después: ${correction}`);
  await expect(history).toContainText('Después: Picudos');
  await expect(history).toContainText('Después: 3');
  await expect(history).toContainText('Después: Síntomas corregidos en la bitácora.');
  await expect(page.getByRole('dialog').getByRole('button', { name: 'Eliminar actividad', exact: true })).toHaveCount(0);
  await page.reload();
  await openObservation(page, correction, id);
  await expect(history).toContainText(`Antes: ${original}`);
  await expect(history).toContainText(reason);
  return history;
}

test('demo edits a legacy pest observation and retains revisions when reopening', async ({ page }, info) => {
  await page.goto('/#disease');
  const history = await correctObservation(page, 'Seguimiento de síntomas foliares');
  await info.attach('historial-de-observacion-demo', { body: await history.screenshot(), contentType: 'image/png' });
});

test('connected legacy observation keeps its original identity and persistent audit in PostGIS', async ({ page }, info) => {
  test.skip(process.env.AGRO_LIVE_TEST !== '1', 'Requires the isolated QA backend.');
  test.setTimeout(90_000);
  await signInAsNewQaUser(page);
  await createQaFarm(page, 'Finca QA de observaciones históricas');
  const [farm] = await (await page.request.get('/api/v1/farms')).json() as { id: number }[];
  const csrf = await (await page.request.get('/api/v1/auth/csrf')).json() as { headerName: string; token: string };
  const headers = { [csrf.headerName]: csrf.token };
  async function create(resource: string, data: object) {
    const response = await page.request.post(`/api/v1/${resource}`, { headers, data });
    await expect(response).toBeOK();
    return await response.json() as { id: number };
  }
  const polygon = { coordinates: [[[-74.1, 10.5], [-74.11, 10.5], [-74.11, 10.51], [-74.1, 10.5]]] };
  const field = await create('fields', { farmId: farm.id, name: 'Campo de auditoría QA', polygon, areaHa: 12 });
  const block = await create('blocks', { fieldId: field.id, code: 'Bloque de auditoría QA', polygon, areaHa: 10 });
  const original = 'Notas originales del historial conectado.';
  const occurredAt = new Date(Date.now() - 60_000).toISOString();
  const event = await create('events', { eventType: 'SCOUTING_OBSERVATION', blockId: block.id, occurredAt,
    notes: original, observation: { severity: 1, symptoms: 'Síntomas originales QA' } });
  await page.goto('/#disease');
  await page.reload();
  const history = await correctObservation(page, original, event.id);
  await expect(history).toContainText('Antes: 1');
  await expect(history).toContainText('Antes: Síntomas originales QA');
  await expect(history).toContainText('AgroVision QA');
  const current = await page.request.get('/api/v1/events');
  await expect(current).toBeOK();
  expect(await current.json()).toEqual(expect.arrayContaining([
    expect.objectContaining({ id: event.id, notes: correction, block: expect.objectContaining({ id: block.id }) }),
  ]));
  await info.attach('auditoria-persistida-en-postgis', { body: await history.screenshot(), contentType: 'image/png' });
});
