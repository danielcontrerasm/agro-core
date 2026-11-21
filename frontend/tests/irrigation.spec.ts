import { test, expect } from '@playwright/test';

test('sector, manual reading, programming, measured partial execution, photos and followup persist', async ({ page }) => {
  await page.goto('/#irrigation');
  await page.getByRole('button', { name: 'Nuevo sector', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Nombre del sector', { exact: true }).fill('Sector E2E');
  await dialog.getByLabel('Área del sector (ha)', { exact: true }).fill('2');
  await dialog.getByLabel('Sistema de riego', { exact: true }).fill('Goteo');
  await dialog.getByLabel('Fuente de agua', { exact: true }).fill('Reservorio de prueba');
  await dialog.getByLabel('Caudal de referencia (m³/h, opcional)', { exact: true }).fill('12');
  await dialog.getByLabel('Límite inferior (opcional)', { exact: true }).fill('21');
  await dialog.getByLabel('Límite superior (opcional)', { exact: true }).fill('33');
  await dialog.getByLabel('Fundamento técnico / motivo de configuración').fill('Configuración de prueba validada.');
  await dialog.getByRole('button', { name: 'Guardar', exact: true }).click();
  await expect(dialog).not.toBeVisible();
  await page.getByRole('button', { name: 'Nueva medición', exact: true }).click();
  await dialog.getByRole('combobox', { name: 'Sector', exact: true }).selectOption({ label: 'Sector E2E · Bloque A' });
  await dialog.getByLabel('Valor de humedad', { exact: true }).fill('27');
  await dialog.getByLabel('Instrumento o método', { exact: true }).fill('Instrumento E2E');
  await dialog.getByLabel('Lluvia registrada (mm, opcional)', { exact: true }).fill('3');
  await dialog.getByLabel('Observación de drenaje').fill('Canales revisados.');
  await dialog.getByRole('button', { name: 'Guardar', exact: true }).click();
  await expect(dialog).not.toBeVisible();
  await expect(page.getByRole('row').filter({ hasText: 'Instrumento E2E' })).toContainText('27 % volumétrico');
  await page.getByRole('button', { name: 'Programación', exact: true }).click();
  await page.getByRole('button', { name: 'Programar riego', exact: true }).click();
  await dialog.getByRole('combobox', { name: 'Sector', exact: true }).selectOption({ label: 'Sector E2E · Bloque A' });
  await dialog.getByLabel('Duración prevista (min)', { exact: true }).fill('60');
  await dialog.getByLabel('Volumen previsto (m³)', { exact: true }).fill('12');
  await dialog.getByLabel('Justificación técnica').fill('Revisión de humedad, lluvia y drenaje.');
  await dialog.getByLabel('Instrucciones de ejecución').fill('Registrar lecturas del contador.');
  await dialog.getByRole('button', { name: 'Guardar', exact: true }).click();
  await expect(dialog).not.toBeVisible();
  const row = page.getByRole('row').filter({ hasText: 'Sector E2E' });
  await expect(row).toContainText('12 / 0');
  await row.getByRole('button', { name: 'Generar tarea', exact: true }).click();
  await row.getByRole('button', { name: 'Registrar ejecución', exact: true }).click();
  await dialog.getByLabel('Inicio real', { exact: true }).fill('2026-01-10T08:00');
  await dialog.getByLabel('Fin real', { exact: true }).fill('2026-01-10T08:40');
  await dialog.getByLabel('Interrupciones (min)', { exact: true }).fill('10');
  await dialog.getByRole('combobox', { name: 'Unidad del contador', exact: true }).selectOption('L');
  await dialog.getByLabel('Lectura inicial del contador', { exact: true }).fill('1000');
  await dialog.getByLabel('Lectura final del contador', { exact: true }).fill('7000');
  await dialog.getByRole('button', { name: 'Guardar', exact: true }).click();
  await expect(dialog).toContainText('6 m³ · Medido por contador · 30 min efectivos');
  const png = await page.evaluate(() => { const canvas = document.createElement('canvas'); canvas.width = 16; canvas.height = 12; canvas.getContext('2d')!.fillRect(0, 0, 16, 12); return canvas.toDataURL('image/png').split(',')[1]; });
  await dialog.getByLabel('Seleccionar fotos').setInputFiles({ name: 'riego.png', mimeType: 'image/png', buffer: Buffer.from(png, 'base64') });
  await expect(dialog.getByRole('img', { name: 'riego.png', exact: true })).toHaveJSProperty('naturalWidth', 16);
  await dialog.getByRole('button', { name: 'Cerrar', exact: true }).click();
  await page.getByRole('button', { name: 'Programación', exact: true }).click();
  await expect(row).toContainText('12 / 6');
  await page.reload();
  await page.getByRole('button', { name: 'Ejecuciones', exact: true }).click();
  await page.getByRole('button', { name: /^Ver ejecución/ }).click();
  await expect(dialog.getByRole('img', { name: 'riego.png', exact: true })).toHaveJSProperty('naturalWidth', 16);
  await dialog.getByRole('button', { name: 'Cerrar', exact: true }).click();
  await page.goto('/#maps');
  await page.getByRole('button', { name: 'Humedad del suelo', exact: true }).click();
  await expect(page.getByRole('table')).toContainText('Sector E2E');
  await expect(page.getByRole('row').filter({ hasText: 'Sector E2E' })).toContainText('Dentro del rango configurado');
  await expect(page.getByRole('table')).toContainText('Medición antigua');
  await expect(page.getByRole('table')).toContainText('kPa (tensión)');
});

test('estimated executions subtract interruptions and require explanation for overruns', async ({ page }) => {
  await page.goto('/#irrigation');
  await page.getByRole('button', { name: 'Programación', exact: true }).click();
  await page.getByRole('button', { name: 'Generar tarea', exact: true }).click();
  await page.getByRole('button', { name: 'Registrar ejecución', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Inicio real', { exact: true }).fill('2026-01-10T08:00');
  await dialog.getByLabel('Fin real', { exact: true }).fill('2026-01-10T10:00');
  await dialog.getByLabel('Interrupciones (min)', { exact: true }).fill('30');
  await dialog.getByRole('combobox', { name: 'Origen del volumen', exact: true }).selectOption('FLOW');
  await dialog.getByLabel('Caudal utilizado para estimación (m³/h)', { exact: true }).fill('12');
  await dialog.getByRole('button', { name: 'Guardar', exact: true }).click();
  await expect(dialog.getByRole('alert')).toContainText('Documenta la razón');
  await dialog.getByLabel('Justificación de desviación (obligatoria si supera lo previsto)').fill('Tiempo adicional documentado por operador.');
  await dialog.getByRole('button', { name: 'Guardar', exact: true }).click();
  await expect(dialog).toContainText('18 m³ · Estimado por caudal · 90 min efectivos');
  await dialog.getByRole('button', { name: 'Cerrar', exact: true }).click();
  await expect(page.getByText('Consumo medido:', { exact: false })).toContainText('0.000 m³');
  await expect(page.getByText('Consumo medido:', { exact: false })).toContainText('18.000 m³');
});

test('water management records can be edited from each management table', async ({ page }) => {
  await page.goto('/#irrigation');
  await page.getByRole('button', { name: 'Administración de agua', exact: true }).click();
  const managementTables = page.locator('.water-management-grid table');

  let row = managementTables.nth(0).getByRole('row').filter({ hasText: 'Reservorio principal' });
  await row.getByRole('button', { name: 'Editar', exact: true }).click();
  let dialog = page.getByRole('dialog');
  await dialog.getByLabel('Nombre de la fuente', { exact: true }).fill('Reservorio actualizado');
  await dialog.getByRole('button', { name: 'Guardar', exact: true }).click();
  await expect(managementTables.nth(0).getByRole('row').filter({ hasText: 'Reservorio actualizado' })).toBeVisible();

  row = managementTables.nth(1).getByRole('row').filter({ hasText: 'LAB-DEMO-001' });
  await row.getByRole('button', { name: 'Editar', exact: true }).click();
  dialog = page.getByRole('dialog');
  await dialog.getByLabel('pH', { exact: true }).fill('7');
  await dialog.getByRole('button', { name: 'Guardar', exact: true }).click();
  await expect(managementTables.nth(1).getByRole('row').filter({ hasText: '7' })).toBeVisible();

  row = managementTables.nth(2).getByRole('row').filter({ hasText: 'FIL-N-01' });
  await row.getByRole('button', { name: 'Editar', exact: true }).click();
  dialog = page.getByRole('dialog');
  await dialog.getByLabel('Código del activo', { exact: true }).fill('FIL-N-02');
  await dialog.getByRole('button', { name: 'Guardar', exact: true }).click();
  await expect(managementTables.nth(2).getByRole('row').filter({ hasText: 'FIL-N-02' })).toBeVisible();

  row = managementTables.nth(3).getByRole('row').filter({ hasText: 'Sector demo 1' });
  await row.getByRole('button', { name: 'Editar', exact: true }).click();
  dialog = page.getByRole('dialog');
  await dialog.getByLabel('Lluvia (mm)', { exact: true }).fill('6');
  await dialog.getByRole('button', { name: 'Guardar', exact: true }).click();
  await expect(managementTables.nth(3).getByRole('row').filter({ hasText: '6 mm' })).toBeVisible();

  row = managementTables.nth(4).getByRole('row').filter({ hasText: 'Lavado de filtro' });
  await row.getByRole('button', { name: 'Editar', exact: true }).click();
  dialog = page.getByRole('dialog');
  await dialog.getByRole('combobox', { name: 'Estado', exact: true }).selectOption('COMPLETED');
  await dialog.getByLabel('Fecha de finalización (opcional)', { exact: true }).fill('2026-01-11');
  await dialog.getByRole('button', { name: 'Guardar', exact: true }).click();
  await expect(managementTables.nth(4).getByRole('row').filter({ hasText: 'Completado' })).toBeVisible();

  row = managementTables.nth(5).getByRole('row').filter({ hasText: 'Sensor #1' });
  await row.getByRole('button', { name: 'Editar', exact: true }).click();
  dialog = page.getByRole('dialog');
  await dialog.getByLabel('Técnico', { exact: true }).fill('Técnico actualizado');
  await dialog.getByRole('button', { name: 'Guardar', exact: true }).click();
  row = managementTables.nth(5).getByRole('row').filter({ hasText: 'Sensor #1' });
  await expect(row).toContainText('Vigente');
  await row.getByRole('button', { name: 'Editar', exact: true }).click();
  dialog = page.getByRole('dialog');
  await expect(dialog.getByLabel('Técnico', { exact: true })).toHaveValue('Técnico actualizado');
  await dialog.getByRole('button', { name: 'Cancelar', exact: true }).click();
});

test('recurring irrigation schedules generate occurrences and can be paused and resumed', async ({ page }) => {
  await page.goto('/#irrigation');
  await page.getByRole('button', { name: 'Programación', exact: true }).click();
  await page.getByRole('button', { name: 'Nueva recurrencia', exact: true }).click();
  const dialog = page.getByRole('dialog');
  const today = new Date(); const dateValue = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  await dialog.getByRole('combobox', { name: 'Sector', exact: true }).selectOption({ index: 0 });
  await dialog.getByLabel('Fecha de inicio', { exact: true }).fill(dateValue(today));
  await dialog.getByLabel('Fecha final', { exact: true }).fill(dateValue(new Date(today.getTime() + 4 * 86400000)));
  await dialog.getByLabel('Hora programada', { exact: true }).fill('08:00');
  await dialog.getByLabel('Frecuencia', { exact: true }).selectOption('DAILY');
  await dialog.getByLabel('Cada cuántos días o semanas', { exact: true }).fill('2');
  await dialog.getByLabel('Duración por ocurrencia (min)', { exact: true }).fill('45');
  await dialog.getByLabel('Volumen por ocurrencia (m³)', { exact: true }).fill('9');
  await dialog.getByRole('combobox', { name: 'Responsable', exact: true }).selectOption({ index: 0 });
  await dialog.getByLabel('Justificación técnica', { exact: true }).fill('Turno recurrente documentado.');
  await dialog.getByLabel('Instrucciones de ejecución', { exact: true }).fill('Registrar el contador en cada ocurrencia.');
  await dialog.getByRole('button', { name: 'Guardar', exact: true }).click();
  await expect(dialog).not.toBeVisible();
  const schedulePanel = page.locator('.panel').filter({ hasText: 'Programaciones recurrentes' });
  const row = schedulePanel.getByRole('row').filter({ hasText: 'Sector demo 1' });
  await expect(row).toContainText('2 días');
  await expect(row).toContainText('planes');
  await row.getByRole('button', { name: 'Pausar', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Guardar', exact: true }).click();
  await expect(row).toContainText('Pausada');
  await row.getByRole('button', { name: 'Reanudar', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Guardar', exact: true }).click();
  await expect(row).toContainText('Activa');
});

test('water usage report compares plans, execution origins, rainfall and deficits', async ({ page }) => {
  await page.goto('/#reports');
  const report = page.locator('.water-analytics-panel');
  await expect(report).toContainText('Consumo y balance de agua');
  await expect(report.getByRole('row').filter({ hasText: 'Sector demo 1' })).toContainText('12 m³');
  await expect(report).toContainText('Lluvia acumulada');
  await report.getByRole('combobox', { name: 'Filtrar sector o bloque' }).selectOption('sector:1');
  await expect(report.getByRole('row').filter({ hasText: 'Sector demo 1' })).toBeVisible();
  await expect(report.getByRole('row')).toHaveCount(2);
  const downloadPromise = page.waitForEvent('download');
  await report.getByRole('button', { name: 'Exportar consumo', exact: true }).click();
  await expect((await downloadPromise).suggestedFilename()).toContain('consumo-agua');
});

test('live worker records a unit-aware reading without requesting management permissions', async ({ page }) => {
  const farm = { id: 1, name: 'Finca conectada' }; const field = { id: 1, farm, name: 'Norte' }; const block = { id: 1, field, crop: 'banana', code: 'A' };
  const sector = { id: 9, blockId: 1, name: 'Sector conectado', areaHa: 2, system: 'Goteo', waterSource: 'Reservorio', unit: 'KPA', depthCm: 30, maxAgeHours: 24, technicalBasis: 'Calibración', version: 0, condition: 'NO_DATA', createdBy: 2, createdAt: '2026-01-01T12:00:00Z' };
  const records = { sectors: [sector], measurements: [] as unknown[], plans: [], executions: [] }; let saved = false;
  await page.addInitScript(() => sessionStorage.setItem('agrovision.live', 'true'));
  await page.route('**/api/v1/**', async route => {
    const request = route.request(); const path = new URL(request.url()).pathname; let body: unknown = [];
    expect(path).not.toContain('/members');
    if (path.endsWith('/auth/me')) body = { user: { id: 1, name: 'Trabajador', email: 'worker@test.local' }, memberships: [{ farmId: 1, farmName: farm.name, role: 'WORKER' }] };
    if (path.endsWith('/auth/csrf')) body = { token: 'irrigation-token', headerName: 'X-CSRF-TOKEN' };
    if (path.endsWith('/farms')) body = [farm]; if (path.endsWith('/fields')) body = [field]; if (path.endsWith('/blocks')) body = [block];
    if (path.endsWith('/irrigation')) body = records;
    if (path.endsWith('/irrigation/measurements')) {
      expect(request.headers()['x-csrf-token']).toBe('irrigation-token'); const payload = request.postDataJSON(); expect(payload.unit).toBe('KPA'); expect(payload.depthCm).toBe(30); expect(payload.value).toBe(17);
      body = { ...payload, id: 31, source: 'MANUAL', createdBy: 1 }; records.measurements.push(body); saved = true;
    }
    await route.fulfill({ status: path.endsWith('/irrigation/measurements') ? 201 : 200, contentType: 'application/json', body: JSON.stringify(body) });
  });
  await page.goto('/#irrigation');
  await expect(page.locator('.environment-bar')).toContainText('Conectado a tu finca');
  await expect(page.getByRole('button', { name: 'Nuevo sector', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Nueva medición', exact: true }).click();
  const dialog = page.getByRole('dialog'); await dialog.getByLabel('Valor de humedad', { exact: true }).fill('17'); await dialog.getByLabel('Instrumento o método', { exact: true }).fill('Tensiómetro conectado');
  await dialog.getByRole('button', { name: 'Guardar', exact: true }).click(); await expect(dialog).not.toBeVisible();
  await expect(page.getByRole('row').filter({ hasText: 'Tensiómetro conectado' })).toContainText('17 kPa (tensión)'); expect(saved).toBe(true);
});
