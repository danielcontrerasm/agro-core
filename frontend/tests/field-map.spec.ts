import { test, expect } from '@playwright/test';

test('live map displays seven fields without observations and identifies the test plan', async ({ page }) => {
  const farm = { id: 91, name: 'Guasita', region: 'Tasajera, El Guamo, Bolívar' };
  const areas = [10, 10, 10, 10, 14, 13, 13];
  const fields = areas.map((areaHa, index) => {
    const west = -74.825 + index * .001;
    return { id: index + 1, name: `División ${index + 1} [PRUEBA]`, farm, areaHa, geom: { type: 'Polygon', coordinates: [[[west, 10.02], [west + .001, 10.02], [west + .001, 10.025], [west, 10.025], [west, 10.02]]] } };
  });
  await page.addInitScript(() => sessionStorage.setItem('agrovision.live', 'true'));
  await page.route('**/api/v1/**', async route => {
    const path = new URL(route.request().url()).pathname;
    let response: unknown = [];
    if (path.endsWith('/me')) response = { user: { id: 42, name: 'Usuario', email: 'user@example.com' }, memberships: [{ farmId: farm.id, farmName: farm.name, role: 'ADMIN' }] };
    else if (path.endsWith('/farms')) response = [farm];
    else if (path.endsWith('/fields')) response = fields;
    else if (path.endsWith('/rows/disease')) response = { type: 'FeatureCollection', features: [] };
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(response) });
  });
  await page.goto('/#maps');
  await expect(page.getByRole('heading', { name: 'Plano de la finca' })).toBeVisible();
  await expect(page.getByText('Plano de prueba:', { exact: false })).toBeVisible();
  await expect(page.locator('.map-canvas [role="button"]')).toHaveCount(7);
  await expect(page.locator('.map-empty')).toHaveCount(0);
  await expect(page.locator('.detail-list')).toContainText('80');
  const paths = await page.locator('.map-canvas path[d^="M"]').evaluateAll(elements => elements.map(element => element.getAttribute('d')));
  expect(paths.join(' ')).not.toMatch(/NaN|Infinity/);
  await page.getByRole('button', { name: 'Seleccionar campo División 5 [PRUEBA]', exact: true }).focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('.map-popup')).toContainText('14 ha');
  await expect(page.locator('.map-popup')).toContainText('Ubicación y linderos aproximados');
  await page.getByRole('button', { name: 'Centrar mapa' }).click();
  await expect(page.locator('.map-popup')).toHaveCount(0);
});
