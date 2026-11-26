import { expect, test, type Page } from '@playwright/test';
import { createQaFarm, signInAsNewQaUser } from './support/qa-account';

async function openDialog(page: Page, button: string, title = button) {
  await page.getByRole('button', { name: button, exact: true }).click();
  return page.getByRole('dialog', { name: title, exact: true });
}

test('connected farm administration saves inventory, finances, crews and attendance', async ({ page }) => {
  test.skip(process.env.AGRO_LIVE_TEST !== '1', 'Requires an isolated running Agro Core backend.');
  test.setTimeout(90_000);
  await signInAsNewQaUser(page);
  await createQaFarm(page, 'Finca administrativa de verificación');

  await page.goto('/#inventory');
  let dialog = await openDialog(page, 'Nuevo producto');
  await dialog.getByLabel('Código', { exact: true }).fill('QA-INS-1');
  await dialog.getByLabel('Nombre', { exact: true }).fill('Insumo de verificación');
  await dialog.getByLabel('Categoría', { exact: true }).fill('Materiales');
  await dialog.getByLabel('Unidad', { exact: true }).fill('kg');
  await dialog.getByLabel('Existencia mínima').fill('5');
  await dialog.getByRole('button', { name: 'Guardar', exact: true }).click();
  await expect(dialog).toHaveCount(0);

  dialog = await openDialog(page, 'Nuevo lote');
  await dialog.getByRole('combobox', { name: 'Producto', exact: true }).selectOption({ label: 'Insumo de verificación · QA-INS-1' });
  await dialog.getByLabel('Código de lote').fill('LOTE-QA-1');
  await dialog.getByRole('button', { name: 'Guardar', exact: true }).click();
  await expect(dialog).toHaveCount(0);

  for (const [direction, quantity] of [['IN', '12.5'], ['OUT', '2.5']]) {
    dialog = await openDialog(page, 'Registrar movimiento');
    await dialog.getByRole('combobox', { name: 'Lote', exact: true }).selectOption({ index: 1 });
    await dialog.getByRole('combobox', { name: 'Tipo de movimiento' }).selectOption(direction);
    await dialog.getByLabel('Cantidad', { exact: true }).fill(quantity);
    await dialog.getByRole('button', { name: 'Guardar', exact: true }).click();
    await expect(dialog).toHaveCount(0);
  }
  await page.reload();
  await expect(page.getByRole('row', { name: /Insumo de verificación/ })).toContainText('10 kg');
  await page.getByRole('button', { name: 'Movimientos', exact: true }).click();
  await expect(page.getByRole('row', { name: /Salida/ })).toContainText('LOTE-QA-1');

  await page.goto('/#costs');
  dialog = await openDialog(page, 'Registrar movimiento');
  await dialog.getByRole('combobox', { name: 'Tipo de movimiento' }).selectOption('EXPENSE');
  await dialog.getByRole('combobox', { name: 'Categoría', exact: true }).selectOption('LABOR');
  await dialog.getByLabel('Valor (COP)', { exact: true }).fill('125000');
  await dialog.getByLabel('Descripción', { exact: true }).fill('Jornal de verificación');
  await dialog.getByRole('button', { name: 'Guardar movimiento' }).click();
  await expect(dialog).toHaveCount(0);

  dialog = await openDialog(page, 'Registrar movimiento');
  await dialog.getByRole('combobox', { name: 'Tipo de movimiento' }).selectOption('INCOME');
  await dialog.getByRole('combobox', { name: 'Categoría', exact: true }).selectOption('CROP_SALE');
  await dialog.getByLabel('Valor (COP)', { exact: true }).fill('200000');
  await dialog.getByLabel('Descripción', { exact: true }).fill('Venta de verificación');
  await dialog.getByRole('button', { name: 'Guardar movimiento' }).click();
  await expect(dialog).toHaveCount(0);

  await page.getByRole('button', { name: 'Presupuesto', exact: true }).click();
  dialog = await openDialog(page, 'Definir presupuesto', 'Presupuesto mensual');
  await dialog.getByLabel('Monto (COP)', { exact: true }).fill('250000');
  await dialog.getByRole('button', { name: 'Guardar presupuesto' }).click();
  await expect(dialog).toHaveCount(0);
  await page.reload();
  await page.getByRole('button', { name: 'Gastos', exact: true }).click();
  await expect(page.getByText('Jornal de verificación', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Ingresos', exact: true }).click();
  await expect(page.getByText('Venta de verificación', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Presupuesto', exact: true }).click();
  dialog = await openDialog(page, 'Editar presupuesto', 'Presupuesto mensual');
  await expect(dialog.getByLabel('Monto (COP)', { exact: true })).toHaveValue('250000');
  await dialog.getByRole('button', { name: 'Cancelar', exact: true }).click();

  await page.goto('/#workers');
  await page.getByRole('button', { name: 'Cuadrillas', exact: true }).click();
  dialog = await openDialog(page, 'Nueva cuadrilla');
  await dialog.getByLabel('Nombre de la cuadrilla').fill('Cuadrilla de verificación');
  await dialog.getByRole('checkbox', { name: 'AgroVision QA', exact: true }).check();
  await dialog.getByRole('button', { name: 'Guardar', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.getByText('Cuadrilla de verificación', { exact: true })).toBeVisible();

  await page.getByRole('button', { name: 'Asistencia', exact: true }).click();
  dialog = await openDialog(page, 'Registrar asistencia de AgroVision QA', 'Registrar asistencia');
  await dialog.getByLabel('Horas trabajadas').fill('7.5');
  await dialog.getByRole('button', { name: 'Guardar', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  dialog = await openDialog(page, 'Editar asistencia de AgroVision QA', 'Editar asistencia');
  await dialog.getByLabel('Horas trabajadas').fill('8');
  await dialog.getByRole('button', { name: 'Guardar', exact: true }).click();
  await expect(dialog).toHaveCount(0);

  await page.reload();
  await page.getByRole('button', { name: 'Asistencia', exact: true }).click();
  const person = page.getByRole('row', { name: /AgroVision QA/ });
  await expect(person).toContainText('Cuadrilla de verificación');
  await expect(person).toContainText('8 h');

  const datePicker = page.getByLabel(test.info().project.name === 'mobile' ? 'Fecha de trabajo en móvil' : 'Fecha de trabajo', { exact: true });
  const recordedDate = await datePicker.inputValue();
  const previousDay = new Date(`${recordedDate}T12:00:00Z`);
  previousDay.setUTCDate(previousDay.getUTCDate() - 1);
  await datePicker.fill(previousDay.toISOString().slice(0, 10));
  await expect(person).toContainText('Sin registrar');
  await datePicker.fill(recordedDate);
  await expect(person).toContainText('8 h');
});
