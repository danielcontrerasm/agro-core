import { expect, test } from '@playwright/test';
import { walkthrough } from '../walkthrough';

test('Dashboard', walkthrough(async ({ page, step, button }) => {
  await page.goto('/#dashboard');
  await step('Indicadores de la finca', 'Revisamos los indicadores y la situación de la finca en la vista general.', async () => {
    await expect(page.locator('.environment-bar')).toContainText('Espacio de demostración');
    await expect(page.getByRole('heading', { name: 'Situación de la finca hoy' })).toBeVisible();
    const indicators = page.locator('.dashboard-kpi-grid');
    await expect(indicators).toContainText('ha');
    return indicators;
  });
  await step('Cambiar a humedad', 'El botón de humedad activa la capa y conserva la vista aérea de la finca.', async () => {
    await button('Humedad').click();
    await expect(button('Humedad')).toHaveClass(/active/);
    const map = page.locator('.dashboard-map-stage');
    await expect(map.locator('image')).toHaveAttribute('href', '/images/farm-aerial.png');
    return map;
  });
  await step('Abrir mapa completo', 'Desde el resumen se puede pasar al módulo de Mapas para consultar el terreno.', async () => {
    await button('Abrir mapa completo').click();
    await expect(page).toHaveURL(/#maps$/);
    await expect(page.locator('.farm-map')).toBeVisible();
    return page.getByRole('main').getByRole('heading', { level: 1 });
  });
}));
