import { expect, test } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { closeFarmMenu, openFarmLogin } from './support/qa-account';

test('all dashboard views render without script errors or horizontal page overflow', async ({ page }, testInfo) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  for (const route of ['dashboard', 'maps', 'tasks', 'fields', 'plants', 'irrigation', 'fertilization', 'disease', 'harvest', 'reports', 'insights', 'settings']) {
    await page.goto(`/#${route}`);
    await expect(page.getByRole('main').getByRole('heading').first()).toBeVisible();
    await expect(page.locator('.environment-bar')).toContainText('Espacio de demostración');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBeTruthy();
  }
  await page.goto('/#dashboard');
  await expect(page.locator('.farm-map image')).toHaveAttribute('href', '/images/farm-aerial.png');
  await page.screenshot({ path: testInfo.outputPath('dashboard.png'), fullPage: true });
  expect(errors).toEqual([]);
});

test('harvest records can be viewed and edited from the history', async ({ page }) => {
  await page.goto('/#harvest');
  const firstRow = page.locator('tbody tr').first();
  await firstRow.getByRole('button', { name: /Ver cosecha/ }).click();
  const detail = page.getByRole('dialog', { name: 'Detalle de cosecha' });
  await expect(detail).toContainText('Cantidad cosechada');
  await expect(detail).toContainText('Notas de cosecha');
  await detail.getByRole('button', { name: 'Editar cosecha' }).click();
  const editor = page.getByRole('dialog', { name: 'Editar cosecha' });
  await editor.getByLabel('Cantidad cosechada').fill('1181');
  await editor.getByRole('button', { name: 'Guardar cambios' }).click();
  await expect(editor).not.toBeVisible();
  await expect(page.locator('tbody')).toContainText('1.181 kg');
});

test('map controls, block selection and layer comparison are interactive', async ({ page }, testInfo) => {
  await page.goto('/#maps');
  await page.getByRole('button', { name: 'Humedad del suelo', exact: true }).click();
  await expect(page.locator('main h1')).toHaveText('Mapa de humedad del suelo');
  await page.getByRole('button', { name: 'Cerrar capas', exact: true }).click();
  await page.getByRole('button', { name: 'Seleccionar Bloque B', exact: true }).click();
  await expect(page.locator('.map-popup')).toContainText('Bloque B');
  await expect(page.locator('.map-popup')).toContainText('29 %');
  await page.getByRole('button', { name: 'Cerrar bloque', exact: true }).click();
  await page.getByRole('button', { name: 'Acercar mapa' }).click();
  await expect(page.locator('.map-canvas > g')).toHaveAttribute('style', /scale\(1\.2\)/);
  await page.getByRole('button', { name: 'Comparar capas', exact: true }).click();
  const legend = page.locator('.map-compare-legend');
  await expect(legend).toContainText('Humedad del suelo');
  await expect(legend).toContainText('Nutrientes');
  await page.getByRole('button', { name: 'Comparación activa', exact: true }).click();
  await expect(legend).toHaveCount(0);
  await expect(page.locator('.farm-map')).toHaveCount(1);
  await page.screenshot({ path: testInfo.outputPath('map.png'), fullPage: true });
});

test('demo task goes through execution, review and approval and persists after reload', async ({ page }) => {
  await page.goto('/#tasks');
  await page.getByRole('button', { name: /Inspección de síntomas foliares/ }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('button', { name: 'Iniciar tarea', exact: true }).click();
  await dialog.getByRole('textbox', { name: 'Notas y novedades' }).fill('Recorrido de prueba completado.');
  await dialog.getByRole('button', { name: 'Enviar a revisión' }).click();
  await dialog.getByRole('button', { name: 'Aprobar trabajo' }).click();
  await expect(dialog).toContainText('Trabajo completado y revisado.');
  await page.keyboard.press('Escape');
  await page.reload();
  await page.getByRole('button', { name: /Inspección de síntomas foliares/ }).click();
  await expect(page.getByRole('dialog')).toContainText('Trabajo completado y revisado.');
});

test('new demo field is validated and saved locally', async ({ page }) => {
  await page.goto('/#fields');
  await page.getByRole('button', { name: 'Nuevo campo', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Nombre', { exact: true }).fill('Campo de prueba');
  await dialog.getByLabel('Área (ha)').fill('12.5');
  await dialog.getByLabel(/Coordenadas/).fill('[[[-74.1,10.5],[-74.11,10.5],[-74.11,10.51]]]');
  await dialog.getByRole('button', { name: 'Guardar', exact: true }).click();
  await expect(dialog).not.toBeVisible();
  const field = page.locator('.fields-tree').getByText('Campo de prueba', { exact: true });
  await expect(field).toBeVisible();
  await page.reload();
  await expect(field).toBeVisible();
});

test('worker role hides management controls and narrows daily tasks', async ({ page }) => {
  await page.goto('/#settings');
  await page.getByRole('button', { name: 'Trabajador', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Equipo y permisos' })).toHaveCount(0);
  await page.evaluate(() => { window.location.hash = 'tasks'; });
  await expect(page.locator('main h1')).toHaveText('Mi trabajo de hoy.');
  await expect(page.getByRole('button', { name: 'Nueva tarea', exact: true })).toHaveCount(0);
  await expect(page.locator('.task-card')).toHaveCount(3);
});

test('sanitary catalog can add, edit and deactivate a problem', async ({ page }) => {
  await page.goto('/#settings');
  await page.getByRole('button', { name: 'Catálogo fitosanitario', exact: true }).click();
  await page.getByRole('button', { name: 'Nuevo problema', exact: true }).click();
  let dialog = page.getByRole('dialog');
  await dialog.getByLabel('Código interno').fill('TRIPS');
  await dialog.getByLabel('Nombre visible').fill('Trips de prueba');
  await dialog.getByLabel('Tipo').selectOption('PEST');
  await dialog.getByRole('button', { name: 'Guardar', exact: true }).click();
  const problemCard = page.locator('.list-card').filter({ hasText: 'Trips de prueba' });
  await expect(problemCard).toBeVisible();
  await problemCard.getByRole('button', { name: 'Desactivar', exact: true }).click();
  await expect(problemCard.getByText('Inactivo', { exact: true })).toBeVisible();
  await page.goto('/#disease');
  await page.getByRole('button', { name: 'Nueva inspección', exact: true }).click();
  dialog = page.getByRole('dialog');
  await expect(dialog.getByLabel('Problema sospechado').locator('option', { hasText: 'Trips de prueba' })).toHaveCount(0);
});

test('report export includes only the filtered events', async ({ page }) => {
  await page.goto('/#reports');
  const filter = page.getByRole('combobox', { name: 'Actividad', exact: true });
  const label = await filter.locator('option[value="IRRIGATION_EVENT"]').innerText();
  await filter.selectOption('IRRIGATION_EVENT');
  const activityHeader = page.locator('thead th').filter({ hasText: /^Actividad$/ });
  const activities = page.locator('table').filter({ has: activityHeader });
  await expect(activities.locator('tbody tr')).toHaveCount(1);
  await expect(activities.locator('tbody tr')).toContainText(label);
  const downloaded = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Exportar CSV' }).click();
  const csv = await downloaded;
  expect(csv.suggestedFilename()).toBe('agrovision-demo-reports.csv');
  const lines = (await readFile((await csv.path())!, 'utf8')).trim().split(/\r?\n/);
  expect(lines).toHaveLength(2);
  expect(lines[1].startsWith(`"${label}",`)).toBe(true);
});

test('real login refreshes CSRF, loads API data and never substitutes demo tasks', async ({ page }) => {
  const writes: { path: string; csrf: string | undefined }[] = [];
  let csrfNumber = 0;
  await page.route('**/api/v1/**', async route => {
    const request = route.request(); const path = new URL(request.url()).pathname;
    if (request.method() !== 'GET') writes.push({ path, csrf: request.headers()['x-csrf-token'] });
    const profile = { user: { id: 42, name: 'Trabajador Real', email: 'real@example.com' }, memberships: [{ farmId: 91, farmName: 'Finca Real', role: 'WORKER' }] };
    let response: unknown = [];
    if (path.endsWith('/csrf')) response = { token: `csrf-${++csrfNumber}`, headerName: 'X-CSRF-TOKEN' };
    else if (path.endsWith('/login') || path.endsWith('/me')) response = profile;
    else if (path.endsWith('/farms')) response = [{ id: 91, name: 'Finca Real' }];
    else if (path.endsWith('/rows/disease')) response = { type: 'FeatureCollection', features: [] };
    else if (path.endsWith('/logout')) { await route.fulfill({ status: 204 }); return; }
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(response) });
  });
  await openFarmLogin(page);
  await page.getByLabel('Correo electrónico', { exact: true }).fill('real@example.com');
  await page.getByLabel('Contraseña', { exact: true }).fill('test-password-123');
  await page.getByRole('button', { name: 'Iniciar sesión', exact: true }).click();
  await expect(page.locator('.environment-bar')).toContainText('Conectado a tu finca');
  await closeFarmMenu(page);
  await expect(page.locator('main h1')).toContainText('Trabajador');
  await page.evaluate(() => { window.location.hash = 'tasks'; });
  await expect(page.getByRole('heading', { name: 'Mi trabajo de hoy.' })).toBeVisible();
  await expect(page.locator('.task-card')).toHaveCount(0);
  if (test.info().project.name === 'mobile') await page.getByRole('button', { name: 'Abrir menú' }).click();
  await page.getByRole('button', { name: 'Cerrar sesión', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Qué bueno verte de nuevo.' })).toBeVisible();
  expect(writes).toEqual([{ path: '/api/v1/auth/login', csrf: 'csrf-1' }, { path: '/api/v1/auth/logout', csrf: 'csrf-2' }]);
});
