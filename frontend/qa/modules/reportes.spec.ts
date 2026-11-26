import { expect, test } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { walkthrough } from '../walkthrough';

test('Reportes y analítica', walkthrough(async ({ page, step, button }) => {
  const filter = page.getByRole('combobox', { name: 'Actividad', exact: true });
  const activityHeader = page.locator('thead th').filter({ hasText: /^Actividad$/ });
  const table = page.locator('table').filter({ has: activityHeader });
  await page.goto('/#reports');

  await step('Historial con filtros', 'El reporte de actividad permite consultar los eventos registrados en la finca.', async () => {
    await expect(page.getByRole('heading', { name: 'Reportes y analítica' })).toBeVisible();
    await expect(table.locator('tbody tr').first()).toBeVisible();
    return filter;
  });
  await step('Filtrar por riego', 'El reporte queda limitado al evento de riego registrado en la demostración.', async () => {
    await filter.selectOption('IRRIGATION_EVENT');
    const label = await filter.locator('option[value="IRRIGATION_EVENT"]').innerText();
    const records = table.locator('tbody tr');
    await expect(records).toHaveCount(1);
    await expect(records).toContainText(label);
    return records;
  });
  await step('Exportar y validar el CSV', 'Se comprueba el archivo descargado y que contiene el encabezado y el evento filtrado.', async () => {
    const downloaded = page.waitForEvent('download');
    await button('Exportar CSV').click();
    const csv = await downloaded;
    expect(csv.suggestedFilename()).toBe('agrovision-demo-reports.csv');
    const rows = (await readFile((await csv.path())!, 'utf8')).trim().split(/\r?\n/);
    expect(rows).toHaveLength(2);
    const label = await filter.locator('option[value="IRRIGATION_EVENT"]').innerText();
    expect(rows[1]).toMatch(/^"[^"]+",/);
    expect(rows[1]).toContain('"' + label + '"');
    return table;
  });
}));
