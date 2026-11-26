import { expect, test } from '@playwright/test';
import { walkthrough } from '../walkthrough';

test('Surcos y plantas', walkthrough(async ({ page, step, button, dialog }) => {
  const code = 'QA-SURCO-042';
  const block = page.getByRole('combobox', { name: 'Filtrar surcos por bloque' });
  const search = page.locator('.global-search input');
  await page.goto('/#plants');

  await step('Inventario por bloque', 'Filtramos los surcos por Bloque A y revisamos la longitud y las plantas estimadas.', async () => {
    await block.selectOption('1');
    await expect(page.getByRole('heading', { name: 'Surcos y plantas' })).toBeVisible();
    const rows = page.locator('tbody tr');
    await expect(rows.first()).toContainText('Bloque A');
    return rows.first();
  });
  await step('Medir y registrar un surco', 'El formulario conserva la distancia entre plantas y la geometría de la línea.', async () => {
    await button('Nuevo surco').click();
    await dialog.getByLabel('Código', { exact: true }).fill(code);
    await dialog.getByRole('combobox', { name: 'Bloque', exact: true }).selectOption({ label: 'Bloque A' });
    await dialog.getByLabel('Longitud (m)', { exact: true }).fill('65');
    await dialog.getByLabel('Distancia entre plantas (m)', { exact: true }).fill('2');
    await dialog.getByLabel('Plantas estimadas', { exact: true }).fill('33');
    await dialog.getByLabel(/Coordenadas de la línea/).fill('[[-74.1,10.5002],[-74.101,10.5004]]');
    await expect(dialog.getByLabel('Plantas estimadas', { exact: true })).toHaveValue('33');
    return dialog;
  });
  await step('Guardar y verificar inventario', 'El surco de prueba persiste después de recargar y se encuentra por su código.', async () => {
    await dialog.getByRole('button', { name: 'Guardar', exact: true }).click();
    await expect(dialog).toBeHidden();
    await page.reload();
    await search.fill(code);
    const row = page.locator('tbody tr').filter({ hasText: code });
    await expect(row).toContainText('65');
    await expect(row).toContainText('33');
    return row;
  });
}));
