import { expect, test } from '@playwright/test';
import { attachDemoPhoto, localTimestamp, walkthrough } from '../walkthrough';

test('Fertilización', walkthrough(async ({ page, step, button, dialog, close }) => {
  const product = 'Producto QA Nutrición';
  const plan = page.getByRole('row').filter({ hasText: product });
  const save = () => dialog.getByRole('button', { name: 'Guardar', exact: true }).click();
  await page.goto('/#fertilization');

  await step('Mapa de potasio y alerta nutricional', 'La capa y las alertas muestran los resultados de potasio por bloque.', async () => {
    await button('Potasio (K)').click();
    await expect(button('Potasio (K)')).toHaveAttribute('aria-pressed', 'true');
    const alerts = page.locator('.fertilization-alerts');
    await expect(alerts).toContainText('Potasio (K)');
    return alerts;
  });
  await step('Crear un plan desde una alerta', 'El bloque y el análisis se precargan y el plan queda pendiente de aprobación.', async () => {
    await page.locator('.fertilization-alerts').getByRole('button', { name: 'Crear plan', exact: true }).first().click();
    await expect(dialog.getByRole('combobox', { name: 'Análisis de referencia', exact: true })).toHaveValue('1');
    await dialog.getByLabel('Etapa de crecimiento', { exact: true }).fill('Vegetativo');
    await dialog.getByLabel('Diagnóstico y justificación técnica').fill('Validación con un análisis de demostración.');
    await dialog.getByLabel('Objetivo agronómico').fill('Comprobar la trazabilidad del plan.');
    await dialog.getByLabel('Producto', { exact: true }).fill(product);
    await dialog.getByLabel('Composición declarada (N-P-K y otros)').fill('Composición de prueba');
    await dialog.getByLabel('Dosis definida por el técnico').fill('25');
    await dialog.getByRole('combobox', { name: 'Unidad de dosis', exact: true }).selectOption('KG_HA');
    await dialog.getByLabel('Cobertura (ha o plantas según unidad de dosis)').fill('1');
    await dialog.getByLabel('Método e instrucciones de aplicación').fill('Registro simulado.');
    await save();
    await expect(dialog).toBeHidden();
    await expect(plan).toContainText('25 / 0 kg');
    return plan;
  });
  await step('Aprobar y generar la tarea', 'Un plan con aprobación y tarea queda disponible para registrar aplicaciones parciales.', async () => {
    await plan.getByRole('button', { name: 'Aprobar', exact: true }).click();
    await dialog.getByLabel('Justificación de la decisión').fill('Plan revisado para la prueba.');
    await save();
    await expect(dialog).toBeHidden();
    await plan.getByRole('button', { name: 'Generar tarea', exact: true }).click();
    await expect(plan.getByRole('button', { name: 'Registrar aplicación', exact: true })).toBeEnabled();
    return plan;
  });
  await step('Registrar una aplicación parcial', 'Se guardan 5 kg, media hectárea y el número de lote del producto.', async () => {
    await button('Resumen').click();
    await button('Registrar aplicación').click();
    await expect(dialog).toHaveAccessibleName('Registrar aplicación');
    await dialog.getByLabel('Fecha y hora reales', { exact: true }).fill(localTimestamp(new Date(Date.now() - 60_000)));
    await dialog.getByLabel('Cantidad aplicada (kg)', { exact: true }).fill('5');
    await dialog.getByLabel('Cobertura real (ha)', { exact: true }).fill('0.5');
    await dialog.getByLabel('Lote del producto', { exact: true }).fill('LOTE-QA-NUTRIENTE');
    await save();
    await expect(dialog).toHaveAccessibleName(/^Aplicación #/);
    await expect(dialog).toContainText('5 kg');
    await expect(dialog).toContainText('LOTE-QA-NUTRIENTE');
    return dialog.locator('.farm-work-details');
  });
  await step('Evidencia y resumen actualizado', 'Se verifica el adjunto y el resumen muestra la cantidad aplicada y el producto reciente.', async () => {
    await attachDemoPhoto(page, dialog, 'fertilizacion-qa.png', 'Aplicación parcial · lote de prueba');
    await close();
    await button('Resumen').click();
    await expect(page.locator('.fertilization-overview-metrics')).toContainText('5 kg');
    const recent = page.locator('.fertilization-recent-applications');
    await expect(recent).toContainText(product);
    return recent;
  });
}));
