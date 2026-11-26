import { expect, test } from '@playwright/test';
import type { FertilizationData } from '../src/lib/fertilization';
import type { InventoryOverview } from '../src/lib/inventory';
import type { Profile, Task } from '../src/lib/types';

test('a saved fertilizer application remains open for photos when the farm refresh fails', async ({ page }) => {
  const farm = { id: 1, name: 'Finca QA' };
  const field = { id: 1, farm, name: 'Campo QA' };
  const block = { id: 1, field, code: 'A', crop: 'Banano', areaHa: 3 };
  const profile: Profile = { user: { id: 1, name: 'Admin QA', email: 'admin@example.test' },
    memberships: [{ farmId: farm.id, farmName: farm.name, role: 'ADMIN' }] };
  const sampleDate = '2024-06-11';
  const applicationDate = '2024-06-12';
  const productName = 'Fertilizante QA';
  const task: Task = { id: '3', farmId: farm.id, blockId: block.id, assigneeId: profile.user.id, assignee: profile.user.name,
    activity: 'fertilization', title: 'Aplicar fertilizante', date: applicationDate, time: '08:00', priority: 'Media', status: 'pending', instructions: 'Aplicación manual' };
  const records: FertilizationData = {
    analyses: [{ id: 1, blockId: block.id, sampleType: 'SOIL', sampledOn: sampleDate, laboratory: 'Lab QA', reference: 'QA-01',
      depthCm: 20, results: [], createdBy: profile.user.id }],
    plans: [{ id: 2, blockId: block.id, analysisId: 1, product: productName, growthStage: 'Vegetativo', diagnosis: 'Diagnóstico QA',
      objective: 'Objetivo QA', composition: 'Composición QA', dose: 5, doseUnit: 'KG_HA', coverage: 1, method: 'Manual',
      scheduledOn: applicationDate, scheduledTime: task.time, followUpOn: applicationDate, assigneeId: profile.user.id,
      taskId: 3, totalQuantity: 5, appliedQuantity: 0, status: 'APPROVED', version: 2, createdBy: profile.user.id, followups: [] }],
    applications: [],
  };
  const inventory: InventoryOverview = {
    products: [{ id: 4, code: 'QA', name: productName, category: 'Fertilizantes', unit: 'kg', minimum: 0, balance: 6, available: 6, lowStock: false }],
    lots: [{ id: 5, productId: 4, code: 'LOTE-QA', expiresOn: null, status: 'AVAILABLE', balance: 6, hasUnitCost: true }],
    movements: { entries: [], nextBeforeId: null },
  };
  const responses: Record<string, unknown> = {
    '/auth/me': profile, '/auth/csrf': { token: 'qa-token', headerName: 'X-CSRF-TOKEN' },
    '/farms': [farm], '/fields': [field], '/blocks': [block], '/tasks': [task],
    '/fertilization': records, '/inventory': inventory,
  };

  await page.addInitScript(() => sessionStorage.setItem('agrovision.live', 'true'));
  await page.route('**/api/v1/**', async route => {
    const request = route.request();
    const resource = new URL(request.url()).pathname.slice('/api/v1'.length);
    if (resource === '/fertilization/plans/2/applications' && request.method() === 'POST') {
      const application = { ...request.postDataJSON(), id: 7, planId: 2, eventId: 8, taskId: 3, lot: 'LOTE-QA', createdBy: profile.user.id };
      records.applications.push(application);
      return route.fulfill({ status: 201, json: application });
    }
    if (resource === '/events' && records.applications.length) {
      return route.fulfill({ status: 503, json: { detail: 'Eventos temporalmente no disponibles' } });
    }
    return route.fulfill({ json: responses[resource] ?? [] });
  });

  await page.goto('/#fertilization');
  await page.getByRole('button', { name: 'Planes', exact: true }).click();
  const plan = page.getByRole('row').filter({ hasText: productName });
  await plan.getByRole('button', { name: 'Registrar aplicación', exact: true }).click();
  const editor = page.getByRole('dialog');
  await editor.getByLabel('Fecha y hora reales').fill(`${applicationDate}T08:00`);
  await editor.getByLabel('Lote de inventario').selectOption('5');
  await editor.getByLabel('Cantidad aplicada (kg)').fill('1');
  await editor.getByLabel('Cobertura real (ha)').fill('1');
  await editor.getByRole('button', { name: 'Guardar', exact: true }).click();

  const application = page.getByRole('dialog', { name: 'Aplicación #7', exact: true });
  await expect(application.getByRole('alert')).toContainText('La aplicación se guardó. Actualiza la finca');
  await expect(application.getByRole('region', { name: 'Fotos adjuntas' }).getByRole('button', { name: 'Elegir fotos' })).toBeEnabled();
  expect(records.applications).toHaveLength(1);
});
