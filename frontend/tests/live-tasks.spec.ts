import { test, expect } from '@playwright/test';
import type { Task } from '../src/lib/types';

test('live task creation targets a field, persists across reloads and saves workflow notes', async ({ page }) => {
  const farm = { id: 91, name: 'Guasita' };
  const field = { id: 11, name: 'División 1 [PRUEBA]', farm, areaHa: 10 };
  const tasks: Task[] = [];
  let failUpdate = false;
  const writes: Record<string, unknown>[] = [];
  await page.addInitScript(() => sessionStorage.setItem('agrovision.live', 'true'));
  await page.route('**/api/v1/**', async route => {
    const request = route.request(); const path = new URL(request.url()).pathname;
    let response: unknown = [];
    if (path.endsWith('/csrf')) response = { token: 'task-csrf', headerName: 'X-CSRF-TOKEN' };
    else if (path.endsWith('/me')) response = { user: { id: 42, name: 'Owner', email: 'owner@example.com' }, memberships: [{ farmId: farm.id, farmName: farm.name, role: 'ADMIN' }] };
    else if (path.endsWith('/farms')) response = [farm];
    else if (path.endsWith('/fields')) response = [field];
    else if (path.endsWith('/members')) response = [{ userId: 42, name: 'Owner', email: 'owner@example.com', role: 'ADMIN' }, { userId: 43, name: 'Worker', email: 'worker@example.com', role: 'WORKER' }];
    else if (path.endsWith('/rows/disease')) response = { type: 'FeatureCollection', features: [] };
    else if (path.endsWith('/tasks') && request.method() === 'POST') {
      const payload = request.postDataJSON(); writes.push(payload);
      expect(request.headers()['x-csrf-token']).toBe('task-csrf');
      const saved = { ...payload, id: '1', assignee: 'Worker', status: 'pending', version: 0 };
      tasks.push(saved); response = saved;
    } else if (path.endsWith('/tasks')) response = tasks;
    else if (request.method() === 'PATCH') {
      if (failUpdate) { await route.fulfill({ status: 409, contentType: 'application/json', body: JSON.stringify({ detail: 'La tarea cambió. Actualiza la página antes de continuar.' }) }); return; }
      const payload = request.postDataJSON(); writes.push(payload);
      expect(payload.version).toBe(tasks[0].version);
      Object.assign(tasks[0], { ...payload, version: tasks[0].version! + 1 }); response = tasks[0];
    }
    await route.fulfill({ status: request.method() === 'POST' ? 201 : 200, contentType: 'application/json', body: JSON.stringify(response) });
  });
  await page.goto('/#tasks');
  await page.getByRole('button', { name: 'Nueva tarea', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Nombre de la tarea').fill('Recorrer División 1');
  await dialog.getByLabel('Campo o bloque').selectOption('field:11');
  await dialog.getByRole('combobox', { name: 'Responsable', exact: true }).selectOption('43');
  await dialog.getByLabel('Instrucciones').fill('Inspeccionar linderos y registrar novedades.');
  await dialog.getByRole('button', { name: 'Crear tarea' }).click();
  await expect(dialog).not.toBeVisible();
  await expect(page.locator('.task-card')).toContainText('Recorrer División 1');
  expect(writes[0]).toMatchObject({ farmId: 91, fieldId: 11, assigneeId: 43 });
  expect(writes[0]).not.toHaveProperty('blockId');
  expect(writes[0]).not.toHaveProperty('assignee');
  await page.reload();
  await page.locator('.task-card').click();
  await page.getByRole('button', { name: 'Iniciar tarea' }).click();
  await expect(page.getByRole('button', { name: 'Enviar a revisión' })).toBeVisible();
  failUpdate = true;
  await page.getByRole('button', { name: 'Enviar a revisión' }).click();
  await expect(page.getByRole('alert')).toContainText('La tarea cambió');
  await expect(page.getByRole('button', { name: 'Enviar a revisión' })).toBeVisible();
  failUpdate = false;
  await page.getByLabel('Notas y novedades').fill('Recorrido finalizado.');
  await page.getByRole('button', { name: 'Enviar a revisión' }).click();
  await page.getByRole('button', { name: 'Aprobar trabajo' }).click();
  await expect(page.getByRole('dialog')).toContainText('Trabajo completado y revisado.');
  await page.reload();
  await page.locator('.task-card').click();
  await expect(page.getByLabel('Notas y novedades')).toHaveValue('Recorrido finalizado.');
  await expect(page.getByRole('dialog')).toContainText('Completada');
  const demoTasks = await page.evaluate(() => JSON.parse(localStorage.getItem('agrovision.tasks.v1') || '[]'));
  expect(demoTasks.some((task: Task) => task.title === 'Recorrer División 1')).toBe(false);
});

test('live worker cannot create or approve tasks', async ({ page }) => {
  const farm = { id: 91, name: 'Guasita' };
  const date = new Date();
  const today = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  await page.addInitScript(() => sessionStorage.setItem('agrovision.live', 'true'));
  await page.route('**/api/v1/**', async route => {
    const path = new URL(route.request().url()).pathname;
    let response: unknown = [];
    if (path.endsWith('/me')) response = { user: { id: 43, name: 'Worker', email: 'worker@example.com' }, memberships: [{ farmId: farm.id, farmName: farm.name, role: 'WORKER' }] };
    else if (path.endsWith('/farms')) response = [farm];
    else if (path.endsWith('/fields')) response = [{ id: 11, name: 'División 1', farm }];
    else if (path.endsWith('/tasks')) response = [{ id: '1', farmId: 91, fieldId: 11, assigneeId: 43, assignee: 'Worker', title: 'Inspección', activity: 'scouting', date: today, time: '07:00', priority: 'Media', status: 'review', instructions: 'Inspeccionar el campo.', version: 2 }];
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(response) });
  });
  await page.goto('/#tasks');
  await expect(page.locator('.task-card')).toHaveCount(1);
  await expect(page.getByRole('button', { name: 'Nueva tarea' })).toHaveCount(0);
  await page.locator('.task-card').click();
  await expect(page.getByRole('button', { name: 'Aprobar trabajo' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Devolver a ejecución' })).toHaveCount(0);
  await expect(page.getByLabel('Notas y novedades')).toBeDisabled();
});
