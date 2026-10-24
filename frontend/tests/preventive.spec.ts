import { expect, test } from '@playwright/test';

test('creates, completes and documents a preventive assignment in demo mode', async ({ page }) => {
  await page.goto('/#disease');
  await page.getByRole('button', { name: 'Prevención', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Medidas preventivas', exact: true })).toBeVisible();

  await page.getByRole('button', { name: 'Nueva medida', exact: true }).click();
  let dialog = page.getByRole('dialog');
  await dialog.getByLabel('Código interno').fill('monitoreo-raiz');
  await dialog.getByLabel('Nombre visible').fill('Monitoreo de raíz');
  await dialog.getByLabel('Instrucciones').fill('Revisar plantas seleccionadas y registrar cambios visibles.');
  await dialog.getByRole('button', { name: 'Guardar medida', exact: true }).click();
  await expect(dialog).not.toBeVisible();

  await page.getByRole('button', { name: 'Asignar medida', exact: true }).click();
  dialog = page.getByRole('dialog');
  await dialog.getByLabel('Medida').selectOption({ label: 'Monitoreo de raíz' });
  await dialog.getByLabel('Bloque').selectOption({ label: 'Bloque A' });
  await dialog.getByRole('button', { name: 'Asignar medida', exact: true }).click();
  await expect(dialog).not.toBeVisible();

  const row = page.locator('tbody tr').filter({ hasText: 'Monitoreo de raíz' });
  await expect(row).toContainText('Bloque A');
  await row.getByRole('button', { name: 'Ver medida 3', exact: true }).click();
  dialog = page.getByRole('dialog');
  await dialog.getByLabel('Estado').selectOption('COMPLETED');
  await dialog.getByLabel('Resultado o notas de cierre').fill('Sin hallazgos y recorrido completado.');
  await dialog.getByRole('button', { name: 'Actualizar estado', exact: true }).click();
  await expect(dialog).toContainText('Completada');

  await dialog.getByLabel('Referencia del archivo').fill('prevencion/bloque-a.jpg');
  await dialog.getByLabel('Tipo de contenido').fill('image/jpeg');
  await dialog.getByRole('button', { name: 'Adjuntar evidencia', exact: true }).click();
  await expect(dialog).toContainText('prevencion/bloque-a.jpg');
});
