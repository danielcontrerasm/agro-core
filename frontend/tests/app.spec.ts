import { expect, test } from '@playwright/test';

test('all dashboard views render without script errors or horizontal page overflow', async ({ page }, testInfo) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  for (const route of ['dashboard', 'maps', 'tasks', 'fields', 'plants', 'irrigation', 'fertilization', 'disease', 'harvest', 'reports', 'insights', 'settings']) {
    await page.goto(`/#${route}`);
    await expect(page.locator('main h1')).toBeVisible();
    await expect(page.locator('.environment-bar')).toContainText('Espacio de demostración');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBeTruthy();
  }
  await page.goto('/#dashboard');
  await expect(page.locator('.farm-map image')).toHaveAttribute('href', '/images/farm-aerial.png');
  await page.screenshot({ path: `test-results/dashboard-${testInfo.project.name}.png`, fullPage: true });
  expect(errors).toEqual([]);
});

test('map controls, block selection and layer comparison are interactive', async ({ page }, testInfo) => {
  await page.goto('/#maps');
  await page.getByRole('button', { name: 'Humedad del suelo', exact: true }).click();
  await expect(page.locator('main h1')).toHaveText('Mapa de humedad del suelo');
  await page.getByRole('button', { name: 'Seleccionar Bloque B', exact: true }).click();
  await expect(page.locator('.map-popup')).toContainText('Bloque B');
  await expect(page.locator('.map-popup')).toContainText('18 %');
  await page.getByRole('button', { name: 'Acercar mapa' }).click();
  await page.getByRole('button', { name: 'Comparar capas', exact: true }).click();
  await expect(page.locator('.farm-map')).toHaveCount(2);
  await page.getByRole('button', { name: 'Cerrar comparación', exact: true }).click();
  await expect(page.locator('.farm-map')).toHaveCount(1);
  await page.screenshot({ path: `test-results/map-${testInfo.project.name}.png`, fullPage: true });
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
  await expect(page.getByRole('heading', { name: 'Campo de prueba', exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Campo de prueba', exact: true })).toBeVisible();
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

test('report export includes only the filtered events', async ({ page }) => {
  await page.goto('/#reports');
  await page.getByRole('combobox', { name: 'Actividad', exact: true }).selectOption('IRRIGATION_EVENT');
  await expect(page.locator('tbody tr')).toHaveCount(1);
  const downloaded = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Exportar CSV' }).click();
  expect((await downloaded).suggestedFilename()).toBe('agrovision-demo-reports.csv');
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
  await page.goto('/');
  await page.getByRole('button', { name: 'Conectar mi finca', exact: true }).click();
  await page.getByLabel('Correo electrónico', { exact: true }).fill('real@example.com');
  await page.getByLabel('Contraseña', { exact: true }).fill('test-password-123');
  await page.getByRole('button', { name: 'Iniciar sesión', exact: true }).click();
  await expect(page.locator('.environment-bar')).toContainText('Conectado a tu finca');
  await expect(page.locator('main h1')).toContainText('Trabajador');
  await page.evaluate(() => { window.location.hash = 'tasks'; });
  await expect(page.getByRole('heading', { name: 'Mi trabajo de hoy.' })).toBeVisible();
  await expect(page.locator('.task-card')).toHaveCount(0);
  if (test.info().project.name === 'mobile') await page.getByRole('button', { name: 'Abrir menú' }).click();
  await page.getByRole('button', { name: 'Cerrar sesión', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Qué bueno verte de nuevo.' })).toBeVisible();
  expect(writes).toEqual([{ path: '/api/v1/auth/login', csrf: 'csrf-1' }, { path: '/api/v1/auth/logout', csrf: 'csrf-2' }]);
});
