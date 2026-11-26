import { expect, test } from '@playwright/test';
import { createQaFarm, signInAsNewQaUser } from './support/qa-account';

test('harvest does not show demo records when the live harvest request fails', async ({ page }) => {
  const farm = { id: 1, name: 'Finca conectada' };
  const field = { id: 1, name: 'Campo conectado', farm, areaHa: 10 };
  const block = { id: 1, code: 'B1', field, crop: 'Banano' };
  let harvestUnavailable = true;
  await page.addInitScript(() => sessionStorage.setItem('agrovision.live', 'true'));
  await page.route('**/api/v1/**', async route => {
    const path = new URL(route.request().url()).pathname;
    let response: unknown = [];
    if (path.endsWith('/auth/me')) response = { user: { id: 42, name: 'Administrador', email: 'admin@example.com' }, memberships: [{ farmId: farm.id, farmName: farm.name, role: 'ADMIN' }] };
    else if (path.endsWith('/farms')) response = [farm];
    else if (path.endsWith('/fields')) response = [field];
    else if (path.endsWith('/blocks')) response = [block];
    else if (path.endsWith('/planting')) response = { cycles: [] };
    else if (path.endsWith('/monitoring-records') && harvestUnavailable) {
      await route.fulfill({ status: 503, json: { detail: 'Servicio temporalmente no disponible' } });
      return;
    }
    await route.fulfill({ json: response });
  });
  await page.goto('/#harvest');
  await expect(page.getByRole('alert')).toContainText('No se pudieron cargar los registros de cosecha');
  await expect(page.getByRole('heading', { name: 'Historial estructurado de cosechas' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Registrar cosecha' })).toBeDisabled();

  harvestUnavailable = false;
  await page.getByRole('button', { name: 'Reintentar' }).click();
  await expect(page.getByText('Sin cosechas para esta selección', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Registrar cosecha' })).toBeEnabled();
});

test('real server onboarding and agricultural record creation', async ({ page }) => {
  test.skip(process.env.AGRO_LIVE_TEST !== '1', 'Requires an isolated running Agro Core backend.');
  await signInAsNewQaUser(page);
  await createQaFarm(page, 'Finca de verificación');
  await page.evaluate(() => { window.location.hash = 'fields'; });
  await page.getByRole('button', { name: 'Nuevo campo', exact: true }).click();
  let dialog = page.getByRole('dialog');
  await dialog.getByLabel('Nombre', { exact: true }).fill('Campo real');
  await dialog.getByLabel('Área (ha)').fill('10');
  await dialog.getByLabel(/Coordenadas/).fill('[[[-74.1,10.5],[-74.11,10.5],[-74.11,10.51]]]');
  await dialog.getByRole('button', { name: 'Guardar', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Campo real', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Vista lista', exact: true }).click();
  await page.locator('.fields-list-panel').getByRole('button', { name: 'Nuevo bloque', exact: true }).click();
  dialog = page.getByRole('dialog');
  await dialog.getByLabel('Código', { exact: true }).fill('Bloque real');
  await dialog.getByRole('combobox', { name: 'Campo', exact: true }).selectOption({ label: 'Campo real' });
  await dialog.getByRole('combobox', { name: 'Cultivo', exact: true }).selectOption({ label: 'Banano' });
  await dialog.getByLabel('Área (ha)').fill('10');
  await dialog.getByLabel(/Coordenadas/).fill('[[[-74.1,10.5],[-74.105,10.5],[-74.105,10.505]]]');
  await dialog.getByRole('button', { name: 'Guardar', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await page.evaluate(() => { window.location.hash = 'plants'; });
  await page.getByRole('button', { name: 'Nuevo surco', exact: true }).click();
  dialog = page.getByRole('dialog');
  await dialog.getByLabel('Código', { exact: true }).fill('R-real');
  await dialog.getByRole('combobox', { name: 'Bloque', exact: true }).selectOption({ label: 'Bloque real' });
  await dialog.getByLabel('Longitud (m)').fill('100');
  await dialog.getByLabel('Plantas estimadas').fill('50');
  await dialog.getByLabel(/Coordenadas/).fill('[[-74.1,10.5],[-74.101,10.501]]');
  await dialog.getByRole('button', { name: 'Guardar', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.getByRole('table').getByText('R-real', { exact: true })).toBeVisible();
  await page.evaluate(() => { window.location.hash = 'reports'; });
  await page.getByRole('button', { name: 'Registrar actividad', exact: true }).click();
  dialog = page.getByRole('dialog');
  await dialog.getByRole('combobox', { name: 'Tipo de actividad', exact: true }).selectOption('IRRIGATION_EVENT');
  await dialog.getByRole('combobox', { name: 'Bloque', exact: true }).selectOption({ label: 'Bloque real' });
  await dialog.getByLabel('Notas', { exact: true }).fill('Registro real de verificación del frontend.');
  await dialog.getByRole('button', { name: 'Registrar actividad', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.getByText('Registro real de verificación del frontend.', { exact: true })).toBeVisible();
});
