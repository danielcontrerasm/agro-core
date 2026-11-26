import { expect, test } from '@playwright/test';
import { walkthrough } from '../walkthrough';

test('Cosecha', walkthrough(async ({ page, step, dialog, close }) => {
  const headers = page.locator('thead th');
  const table = page.locator('table').filter({ has: headers.filter({ hasText: /^Cosechado$/ }) });
  const open = () => table.locator('tbody tr').first().getByRole('button', { name: /Ver cosecha/ }).click();
  await page.goto('/#harvest');

  await step('Historial de producción', 'La cosecha muestra área, cantidad registrada, calidad y rechazo por ciclo.', async () => {
    await expect(page.getByRole('heading', { name: 'Cosecha y producción' })).toBeVisible();
    await expect(table.locator('thead th').filter({ hasText: /^Rechazado$/ })).toHaveCount(1);
    await expect(table.locator('tbody tr').first()).toBeVisible();
    return table;
  });
  await step('Inspeccionar el detalle', 'El registro conserva la cantidad cosechada y las observaciones de campo.', async () => {
    await open();
    await expect(dialog).toHaveAccessibleName('Detalle de cosecha');
    await expect(dialog).toContainText('Cantidad cosechada');
    await expect(dialog).toContainText('Notas de cosecha');
    return dialog;
  });
  await step('Editar la cantidad y comprobar la persistencia', 'Cambiamos la cantidad a 1.181 kg y comprobamos que se conserva tras recargar.', async () => {
    await dialog.getByRole('button', { name: 'Editar cosecha', exact: true }).click();
    await dialog.getByLabel('Cantidad cosechada', { exact: true }).fill('1181');
    await dialog.getByRole('button', { name: 'Guardar cambios', exact: true }).click();
    await expect(dialog).toBeHidden();
    await page.reload();
    const updated = table.locator('tbody tr').filter({ hasText: '1.181 kg' });
    await expect(updated).toBeVisible();
    await updated.getByRole('button', { name: /Ver cosecha/ }).click();
    await expect(dialog).toContainText('1.181 Kilogramos (kg)');
    await close();
    return updated;
  });
}));
