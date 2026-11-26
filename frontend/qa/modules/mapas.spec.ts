import { expect, test } from '@playwright/test';
import { walkthrough } from '../walkthrough';

test('Mapas', walkthrough(async ({ page, step, button }) => {
  await page.goto('/#maps');
  await step('Humedad y detalle del bloque', 'El Bloque B muestra la última lectura de humedad al seleccionarlo.', async () => {
    await button('Humedad del suelo').click();
    await expect(page.locator('main h1')).toHaveText('Mapa de humedad del suelo');
    await button('Cerrar capas').click();
    await button('Seleccionar Bloque B').click();
    const detail = page.locator('.map-popup');
    await expect(detail).toContainText('Bloque B');
    await expect(detail).toContainText('29 %');
    return detail;
  });
  await step('Ampliar y comparar capas', 'La leyenda identifica humedad y nutrientes cuando ambas capas están en la comparación.', async () => {
    await button('Cerrar bloque').click();
    await button('Acercar mapa').click();
    await expect(page.locator('.map-canvas > g')).toHaveAttribute('style', /scale\(1\.2\)/);
    await button('Comparar capas').click();
    const legend = page.locator('.map-compare-legend');
    await expect(legend).toContainText('Humedad del suelo');
    await expect(legend).toContainText('Nutrientes');
    return page.locator('.farm-map');
  });
  await step('Trazabilidad de potasio', 'La tabla del mapa conserva el método y la unidad del resultado de laboratorio.', async () => {
    await button('Comparación activa').click();
    await button('Nutrientes').click();
    await button('Potasio (K)').click();
    const trace = page.locator('.map-traceability').first().getByRole('table');
    await expect(trace).toContainText('cmol(+)/kg');
    await expect(trace).toContainText('Acetato de amonio');
    return trace.locator('tbody tr').first();
  });
}));
