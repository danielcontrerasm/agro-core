import { expect, test } from '@playwright/test';
import type { Page, TestInfo } from '@playwright/test';
import { createQaFarm, signInAsNewQaUser } from './support/qa-account';

async function openMonitoring(page: Page) {
  await page.getByRole('button', { name: 'Monitoreo', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Planes de monitoreo', exact: true })).toBeVisible();
}

async function registerVisit(page: Page, blockId: string, affected: number) {
  await page.getByRole('button', { name: 'Registrar visita', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Nueva inspección fitosanitaria' });
  const block = dialog.getByRole('combobox', { name: 'Bloque', exact: true });
  const problem = dialog.getByRole('combobox', { name: 'Problema sospechado' });
  await expect(block).toHaveValue(blockId);
  await expect(block).toBeDisabled();
  await expect(problem).toHaveValue('WEEVILS');
  await expect(problem).toBeDisabled();
  await dialog.getByLabel('Plantas afectadas').fill(String(affected));
  await dialog.getByLabel('Síntomas observados').fill('Evidencia de observación de la visita de QA.');
  await dialog.getByLabel('Método de evaluación').fill('Conteo de las plantas de la muestra.');
  await dialog.getByRole('button', { name: 'Guardar inspección' }).click();
  await expect(dialog).not.toBeVisible();
}

async function verifyMonitoring({ page, blockName, info }: { page: Page; blockName: string; info: TestInfo }) {
  await openMonitoring(page);
  await page.getByRole('button', { name: 'Nuevo plan de monitoreo', exact: true }).click();
  const dialog = page.getByRole('dialog');
  const blockIds = await dialog.getByRole('combobox', { name: 'Bloque', exact: true }).selectOption({ label: blockName });
  await dialog.getByRole('combobox', { name: 'Problema fitosanitario', exact: true }).selectOption('WEEVILS');
  const day = 86_400_000;
  const start = Date.now() - day;
  const yesterday = new Date(start).toISOString().slice(0, 10);
  await dialog.getByLabel('Fecha de inicio').fill(yesterday);
  await dialog.getByLabel('Frecuencia (días)').fill('7');
  await dialog.getByLabel('Umbral de incidencia (%)').fill('25');
  await dialog.getByRole('button', { name: 'Guardar plan' }).click();
  await expect(dialog).not.toBeVisible();
  const plan = page.getByRole('list', { name: 'Planes de monitoreo periódico' }).getByRole('listitem');
  await expect(plan).toContainText(blockName);
  await expect(plan).toContainText('Visita vencida');
  await expect(plan.locator('p').filter({ hasText: 'Próxima visita:' }).locator('time')).toHaveAttribute('datetime', yesterday);
  await registerVisit(page, blockIds[0], 4);
  await expect(plan).not.toContainText('Visita vencida');
  await expect(plan).toContainText('Última inspección:');
  await expect(plan.locator('p').filter({ hasText: 'Próxima visita:' }).locator('time')).toHaveAttribute('datetime', new Date(start + 7 * day).toISOString().slice(0, 10));
  await expect(page.getByRole('heading', { name: 'Sin alertas por umbral' })).toBeVisible();

  await registerVisit(page, blockIds[0], 5);
  const alerts = page.getByRole('list', { name: 'Alertas de incidencia' });
  const alert = alerts.getByRole('listitem');
  await expect(alert).toContainText('Incidencia de 25 % · Umbral de 25 %');
  await alert.getByRole('button', { name: 'Ver inspección de origen' }).click();
  await expect(page.getByRole('dialog', { name: 'Detalle de inspección' })).toContainText('Evidencia de observación de la visita de QA.');
  await page.keyboard.press('Escape');
  await alert.getByRole('button', { name: 'Revisar alerta' }).click();
  await dialog.getByLabel('Decisión técnica').fill('Programar una visita de verificación del bloque.');
  await dialog.getByRole('button', { name: 'Guardar decisión' }).click();
  await expect(alert).toContainText('Revisada');

  await plan.getByRole('button', { name: 'Editar plan' }).click();
  await dialog.getByLabel('Frecuencia (días)').fill('14');
  await dialog.getByLabel('Umbral de incidencia (%)').fill('35');
  await dialog.getByRole('button', { name: 'Guardar plan' }).click();
  await plan.getByRole('button', { name: 'Pausar plan' }).click();
  await expect(plan).toContainText('Pausado');
  await expect(plan.getByRole('button', { name: 'Registrar visita' })).toHaveCount(0);
  await plan.getByRole('button', { name: 'Reanudar plan' }).click();
  await expect(plan.getByRole('button', { name: 'Registrar visita' })).toBeVisible();

  await page.reload();
  await openMonitoring(page);
  await expect(plan).toContainText('cada 14 días');
  await expect(plan).toContainText('Alerta a partir de 35 %');
  await expect(alert).toContainText('Umbral de 25 %');
  await expect(alert).toContainText('Programar una visita de verificación del bloque.');
  await expect(alert.getByText(/^Revisión:/)).toBeVisible();
  await expect(alert.getByRole('button', { name: 'Revisar alerta' })).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBeTruthy();
  await info.attach('monitoreo-y-alerta-revisada', { body: await page.screenshot({ fullPage: true }), contentType: 'image/png' });
}

test('periodic inspections advance the demo schedule and preserve threshold decisions', async ({ page }, info) => {
  await page.goto('/#disease');
  await verifyMonitoring({ page, blockName: 'Bloque E', info });
});

test('connected monitoring persists schedules and threshold reviews in PostGIS', async ({ page }, info) => {
  test.skip(process.env.AGRO_LIVE_TEST !== '1', 'Requires an isolated running Agro Core backend.');
  test.setTimeout(90_000);
  await signInAsNewQaUser(page);
  await createQaFarm(page, 'Finca de monitoreo fitosanitario QA');
  await page.goto('/#fields');
  await page.getByRole('button', { name: 'Nuevo campo', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Nombre', { exact: true }).fill('Campo de monitoreo');
  await dialog.getByLabel('Área (ha)').fill('10');
  await dialog.getByLabel(/Coordenadas/).fill('[[[-74.1,10.5],[-74.11,10.5],[-74.11,10.51]]]');
  await dialog.getByRole('button', { name: 'Guardar', exact: true }).click();
  await expect(dialog).not.toBeVisible();
  await page.getByRole('button', { name: 'Vista lista', exact: true }).click();
  await page.locator('.fields-list-panel').getByRole('button', { name: 'Nuevo bloque', exact: true }).click();
  await dialog.getByLabel('Código', { exact: true }).fill('Bloque de monitoreo');
  await dialog.getByRole('combobox', { name: 'Campo', exact: true }).selectOption({ label: 'Campo de monitoreo' });
  await dialog.getByRole('combobox', { name: 'Cultivo', exact: true }).selectOption({ label: 'Banano' });
  await dialog.getByLabel('Área (ha)').fill('10');
  await dialog.getByLabel(/Coordenadas/).fill('[[[-74.1,10.5],[-74.105,10.5],[-74.105,10.505]]]');
  await dialog.getByRole('button', { name: 'Guardar', exact: true }).click();
  await expect(dialog).not.toBeVisible();
  await page.goto('/#disease');
  await verifyMonitoring({ page, blockName: 'Bloque de monitoreo', info });
});
