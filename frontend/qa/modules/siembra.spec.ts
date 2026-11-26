import { expect, test } from '@playwright/test';
import { localTimestamp, walkthrough } from '../walkthrough';

test('Siembra y ciclos', walkthrough(async ({ page, step, button, dialog }) => {
  const code = 'CICLO-QA-SIEMBRA';
  const today = localTimestamp().slice(0, 10);
  const cycle = page.locator('.planting-reference-cycle-card').filter({ hasText: code });
  const detail = (name: string) => page.getByRole('tab', { name, exact: true });
  await page.goto('/#planting');

  await step('Crear un ciclo en el lote', 'Guardamos la ventana de siembra del ciclo y comprobamos su presencia en la lista.', async () => {
    await page.locator('.planting-reference-heading').getByRole('button', { name: 'Nuevo ciclo', exact: true }).click();
    await dialog.getByRole('combobox', { name: 'Lote', exact: true }).selectOption('1');
    await dialog.getByLabel('Código del ciclo', { exact: true }).fill(code);
    await dialog.getByLabel('Inicio de siembra', { exact: true }).fill(today);
    await dialog.getByLabel('Fin de siembra', { exact: true }).fill(today);
    await dialog.getByLabel('Fecha estimada de cosecha', { exact: true }).fill(today);
    await dialog.getByRole('button', { name: 'Crear ciclo', exact: true }).click();
    await expect(dialog).toBeHidden();
    await cycle.click();
    await expect(detail('Resumen')).toHaveAttribute('aria-selected', 'true');
    return cycle;
  });
  await step('Evaluar el lote', 'El ciclo conserva uso previo, drenaje y riesgos antes de pasar a la planeación.', async () => {
    await button('Más opciones del ciclo').click();
    await button('Evaluar lote').click();
    await dialog.getByLabel('Uso anterior', { exact: true }).fill('Área de renovación de prueba');
    await dialog.getByLabel('Drenaje', { exact: true }).fill('Canales de prueba revisados');
    await dialog.getByRole('button', { name: 'Guardar evaluación', exact: true }).click();
    await expect(dialog).toBeHidden();
    await button('Más opciones del ciclo').click();
    await expect(button('Aprobar evaluación')).toBeEnabled();
    return button('Aprobar evaluación');
  });
  await step('Registrar material vegetal', 'Aprobamos la evaluación y guardamos un lote de 35 plantas con referencia de origen.', async () => {
    await button('Aprobar evaluación').click();
    await button('Más opciones del ciclo').click();
    await button('Registrar material').click();
    await dialog.getByLabel('Proveedor', { exact: true }).fill('Vivero QA');
    await dialog.getByLabel('Referencia de origen', { exact: true }).fill('LOTE-VEGETAL-QA');
    await dialog.getByLabel('Cantidad recibida', { exact: true }).fill('35');
    await dialog.getByLabel('Inspección sanitaria', { exact: true }).fill('Inspección del material de prueba.');
    await dialog.getByRole('button', { name: 'Registrar lote', exact: true }).click();
    await expect(dialog).toBeHidden();
    await detail('Material vegetal').click();
    const item = page.locator('.planting-record-item').filter({ hasText: 'Vivero QA' });
    await expect(item).toContainText('LOTE-VEGETAL-QA');
    await expect(item).toContainText('35');
    return item;
  });
  await step('Recargar el ciclo y su material', 'Verificamos que el material sigue asociado al ciclo tras recargar la página.', async () => {
    await page.reload();
    await cycle.click();
    await detail('Material vegetal').click();
    const item = page.locator('.planting-record-item').filter({ hasText: 'Vivero QA' });
    await expect(item).toContainText('LOTE-VEGETAL-QA');
    return item;
  });
}));
