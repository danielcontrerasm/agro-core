import { expect, test } from '@playwright/test';

test('connected dashboard and maps reflect backend records and unavailable data', async ({ page }) => {
  const date = '2026-10-15';
  const farm = { id: 91, name: 'Finca Puerto Verde' };
  const field = { id: 11, name: 'El Mirador', farm, areaHa: 38.7 };
  const block = { id: 17, code: 'Bloque 17', field, crop: 'Banano' };
  const row = { id: 31, rowCode: 'Surco 31', block, plantsEstimated: 3, geom: { type: 'LineString', coordinates: [[-74.12, 9.82], [-74.119, 9.82]] } };
  const sample = {
    sampleType: 'SOIL', sampledOn: date, reference: 'LAB-171',
    results: [{ nutrient: 'N', value: 20, unit: 'MG_KG', method: 'Método registrado' }],
    interpretations: [{ nutrient: 'N', status: 'ADEQUATE', label: 'Evaluación del laboratorio', reason: 'Perfil registrado en el servidor' }],
  };
  const analytics = { type: 'FeatureCollection', features: [{ properties: {
    blockId: block.id, crop: block.crop, healthStatus: 'ACTIVE_FINDINGS', soilAnalysis: sample, soilMoisture: 32,
    irrigationSectors: [{ id: 23, name: 'Sector norte', blockId: block.id, condition: 'IN_RANGE', latest: { value: 32, unit: 'KPA', recordedAt: `${date}T10:00:00Z`, sectorId: 23 } }],
  } }] };

  await page.clock.setFixedTime(new Date(`${date}T12:00:00`));
  await page.addInitScript(() => sessionStorage.setItem('agrovision.live', 'true'));
  await page.route('**/api/v1/**', async route => {
    const url = new URL(route.request().url());
    const path = url.pathname;
    let response: unknown = [];
    if (path.endsWith('/me')) response = { user: { id: 42, name: 'Ana', email: 'ana@example.com' }, memberships: [{ farmId: farm.id, farmName: farm.name, role: 'ADMIN' }] };
    else if (path.endsWith('/farms')) response = [farm];
    else if (path.endsWith('/fields')) response = [field];
    else if (path.endsWith('/blocks')) response = [block];
    else if (path.endsWith('/rows')) response = [row];
    else if (path.endsWith('/rows/disease')) response = { type: 'FeatureCollection', features: [] };
    else if (path.endsWith('/analytics/map')) response = analytics;
    else if (path.endsWith('/analytics/dashboard')) {
      await route.fulfill({ status: 503, json: { detail: 'Resumen de alertas no disponible' } });
      return;
    } else if (path.endsWith('/analytics/water-usage')) {
      expect(url.searchParams.get('from')).toBe(date);
      expect(url.searchParams.get('until')).toBe(date);
      response = { summary: { actualVolumeM3: 12, measuredVolumeM3: 8, estimatedVolumeM3: 4 } };
    } else if (path.endsWith('/finances')) {
      expect(url.searchParams.get('month')).toBe(date.slice(0, 7));
      response = { farmId: farm.id, month: date.slice(0, 7), currency: 'COP', totals: { expenses: 45000, income: 0, margin: -45000, entryCount: 1 },
        budget: null, expensesByCategory: [{ category: 'LABOR', amount: 45000 }], blockMargins: [], entries: [] };
    } else if (path.endsWith('/monitoring-records')) {
      response = [
        { id: 1, blockId: block.id, actualHarvestDate: date, harvestedQuantity: 450, yieldUnit: 'kg' },
        { id: 2, rowId: row.id, actualHarvestDate: '2026-10-10', harvestedQuantity: 12, yieldUnit: 'racimos' },
        { id: 3, blockId: block.id, actualHarvestDate: '2026-09-12', harvestedQuantity: 999, yieldUnit: 'kg' },
      ];
    }
    await route.fulfill({ json: response });
  });

  await page.goto('/#dashboard');
  const dashboard = page.locator('.dashboard-screen');
  await expect(dashboard.locator('.dashboard-kpi-grid')).toContainText('450 kg · 12 racimos');
  await expect(dashboard.locator('.dashboard-kpi-grid')).toContainText('8 m³ medidos · 4 m³ estimados');
  await expect(dashboard.locator('.dashboard-attention')).toContainText('Resumen de alertas no disponible');
  await expect(dashboard.locator('.dashboard-costs-card')).toContainText('Mano de obra');
  await expect(dashboard.locator('.dashboard-costs-card')).toContainText('45.000');
  await expect(dashboard.locator('.dashboard-production-card')).not.toContainText('999');
  await expect(dashboard.locator('.dashboard-hero-art')).not.toHaveClass(/dashboard-hero-art-demo/);
  await expect(dashboard).not.toContainText('detectamos 3 acciones prioritarias');

  await dashboard.getByRole('button', { name: 'Abrir mapa completo' }).click();
  await page.getByRole('button', { name: 'Nutrientes', exact: true }).click();
  const interpretation = page.getByRole('heading', { name: 'Nitrógeno (N): interpretación por bloque' }).locator('../..');
  await expect(interpretation).toContainText('Perfil registrado en el servidor');
  await interpretation.getByRole('button', { name: block.code }).click();
  await page.getByRole('button', { name: 'Vista de la finca', exact: true }).click();
  const blockFacts = page.locator('.map-farm-facts');
  await expect(blockFacts).toContainText('Sin registrar');
  await expect(blockFacts).toContainText('32 kPa');
  await expect(page.locator('.map-farm-summary .farm-thumbnail')).toHaveCount(0);

  await page.getByLabel('Filtrar por surco').selectOption(String(row.id));
  await expect(page.getByLabel('Filtrar por planta').locator('option')).toHaveCount(4);
});
