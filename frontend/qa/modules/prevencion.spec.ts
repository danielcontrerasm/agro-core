import { expect, test } from '@playwright/test';
import { walkthrough } from '../walkthrough';

test('Medidas preventivas', walkthrough(async ({ page, step, button, dialog }) => {
  const name = 'Monitoreo preventivo QA';
  await page.goto('/#disease');
  await button('Prevención').click();

  await step('Crear una medida preventiva', 'La medida se registra con código, nombre e instrucciones para el equipo.', async () => {
    await expect(page.getByRole('heading', { name: 'Medidas preventivas' })).toBeVisible();
    await button('Nueva medida').click();
    await dialog.getByLabel('Código interno').fill('monitoreo-qa');
    await dialog.getByLabel('Nombre visible').fill(name);
    await dialog.getByLabel('Instrucciones').fill('Registrar cambios visibles en el bloque de prueba.');
    await dialog.getByRole('button', { name: 'Guardar medida', exact: true }).click();
    await expect(dialog).toBeHidden();
    return page.getByRole('heading', { name: 'Medidas preventivas' });
  });
  await step('Asignar la medida a un bloque', 'La asignación queda asociada al Bloque A y se abre desde el historial.', async () => {
    await button('Asignar medida').click();
    await dialog.getByLabel('Medida').selectOption({ label: name });
    await dialog.getByLabel('Bloque').selectOption({ label: 'Bloque A' });
    await dialog.getByRole('button', { name: 'Asignar medida', exact: true }).click();
    await expect(dialog).toBeHidden();
    const row = page.locator('tbody tr').filter({ hasText: name });
    await expect(row).toContainText('Bloque A');
    return row;
  });
  await step('Completar y adjuntar referencia', 'La medida conserva el resultado de cierre y la referencia del archivo de prueba.', async () => {
    await page.locator('tbody tr').filter({ hasText: name }).getByRole('button', { name: /^Ver medida/ }).click();
    await dialog.getByLabel('Estado').selectOption('COMPLETED');
    await dialog.getByLabel('Resultado o notas de cierre').fill('Recorrido de prueba completado.');
    await dialog.getByRole('button', { name: 'Actualizar estado', exact: true }).click();
    await expect(dialog).toContainText('Completada');
    await dialog.getByLabel('Referencia del archivo').fill('prevencion/qa-bloque-a.jpg');
    await dialog.getByLabel('Tipo de contenido').fill('image/jpeg');
    await dialog.getByRole('button', { name: 'Adjuntar evidencia', exact: true }).click();
    await expect(dialog).toContainText('prevencion/qa-bloque-a.jpg');
    return dialog;
  });
}));
