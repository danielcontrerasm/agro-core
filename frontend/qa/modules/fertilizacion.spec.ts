import { expect, test } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { attachDemoPhoto, localTimestamp, walkthrough } from '../walkthrough';

test('Fertilización', walkthrough(async ({ page, step, button, dialog, close }) => {
  const product = 'Producto QA Nutrición';
  const plan = page.getByRole('row').filter({ hasText: product });
  const foliar = page.getByRole('row').filter({ hasText: 'QA-FOLIAR-001' });
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
    await expect(plan).toContainText('Pendiente de aprobación');
    await expect(plan.getByRole('button', { name: 'Registrar aplicación' })).toHaveCount(0);
    return plan;
  });
  await step('Aprobar y generar la tarea', 'Un plan con aprobación y tarea queda disponible para registrar aplicaciones parciales.', async () => {
    await plan.getByRole('button', { name: 'Aprobar', exact: true }).click();
    await dialog.getByLabel('Justificación de la decisión').fill('Plan revisado para la prueba.');
    await save();
    await expect(dialog).toBeHidden();
    await expect(plan).toContainText('Aprobado');
    await expect(plan.getByRole('button', { name: 'Registrar aplicación' })).toHaveCount(0);
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
  await step('Registrar seguimiento técnico del plan', 'La revisión queda vinculada al plan con la observación de campo.', async () => {
    await button('Planes').click();
    await expect(plan).toContainText('25 / 5 kg');
    await plan.getByRole('button', { name: 'Registrar seguimiento', exact: true }).click();
    await dialog.getByLabel('Observaciones y conclusión técnica').fill('Aplicación parcial confirmada. Revisar nuevamente al consumir el saldo.');
    await save();
    await expect(plan).toContainText('1 revisiones');
    return plan;
  });
  await step('Rechazar una cantidad que supera el saldo', 'Con 5 kg aplicados, el control admite un máximo de 20 kg.', async () => {
    await plan.getByRole('button', { name: 'Registrar aplicación', exact: true }).click();
    await dialog.getByLabel('Fecha y hora reales', { exact: true }).fill(localTimestamp());
    const quantity = dialog.getByLabel('Cantidad aplicada (kg)', { exact: true });
    await expect(quantity).toHaveAttribute('max', '20');
    await quantity.fill('21');
    await dialog.getByLabel('Cobertura real (ha)', { exact: true }).fill('0.5');
    await dialog.getByLabel('Lote del producto', { exact: true }).fill('LOTE-QA-NUTRIENTE');
    await save();
    await expect(dialog).toHaveAccessibleName('Registrar aplicación');
    expect(await quantity.evaluate((input: HTMLInputElement) => input.validity.rangeOverflow)).toBe(true);
    return quantity.locator('..');
  });
  await step('Completar los 25 kg aprobados', 'El segundo registro consume el saldo. El plan deja de ofrecer nuevas aplicaciones.', async () => {
    await dialog.getByLabel('Cantidad aplicada (kg)', { exact: true }).fill('20');
    await save();
    await expect(dialog).toHaveAccessibleName(/^Aplicación #/);
    await expect(dialog).toContainText('20 kg');
    await close();
    await button('Planes').click();
    await expect(plan).toContainText('25 / 25 kg');
    await expect(plan.getByRole('button', { name: 'Registrar aplicación', exact: true })).toHaveCount(0);
    return plan;
  });
  await step('Preparar una muestra foliar y rechazar un archivo inválido', 'La muestra tiene profundidad 0 cm y el formulario comprueba la firma del archivo.', async () => {
    await button('Análisis').click();
    await button('Nuevo análisis').click();
    await dialog.getByLabel('Tipo de muestra').selectOption('FOLIAR');
    await dialog.getByLabel('Laboratorio', { exact: true }).fill('Laboratorio visual QA');
    await dialog.getByLabel('Referencia de muestra', { exact: true }).fill('QA-FOLIAR-001');
    await dialog.getByLabel('Profundidad (cm; 0 para foliar)', { exact: true }).fill('0');
    await dialog.getByLabel('Valor B', { exact: true }).fill('0.42');
    await dialog.getByLabel('Método B', { exact: true }).fill('Método de demostración');
    await dialog.getByLabel(/Informe de laboratorio PDF/).setInputFiles({
      name: 'informe-invalido.pdf', mimeType: 'application/pdf', buffer: Buffer.from('Archivo de prueba'),
    });
    await save();
    const error = dialog.getByRole('alert');
    await expect(error).toContainText('Adjunta un PDF válido');
    return error;
  });
  await step('Guardar el informe y comprobar la descarga', 'La muestra foliar conserva su resultado, unidad, método y el archivo adjunto tras recargar.', async () => {
    const report = Buffer.from('%PDF-1.4\n% Fixture para verificar el adjunto de laboratorio\n%%EOF\n');
    await dialog.getByLabel(/Informe de laboratorio PDF/).setInputFiles({ name: 'informe-qa.pdf', mimeType: 'application/pdf', buffer: report });
    await save();
    await expect(dialog).toBeHidden();
    await page.reload();
    await button('Análisis').click();
    await foliar.getByRole('button', { name: /^Ver análisis/ }).click();
    await expect(dialog).toContainText('Muestra foliar');
    await expect(dialog).toContainText('0 cm');
    await expect(dialog.getByRole('row').filter({ hasText: 'Método de demostración' })).toContainText('0.42');
    const [download] = await Promise.all([page.waitForEvent('download'), dialog.getByRole('link', { name: 'Descargar informe PDF' }).click()]);
    expect(await readFile((await download.path())!)).toEqual(report);
    return dialog.getByRole('link', { name: 'Descargar informe PDF' });
  });
  await step('Recuperar saldos, seguimiento y foto', 'Tras recargar se conservan los 25 kg, la revisión y la evidencia de la aplicación parcial.', async () => {
    await close();
    await button('Planes').click();
    await expect(plan).toContainText('25 / 25 kg');
    await expect(plan).toContainText('1 revisiones');
    await button('Aplicaciones').click();
    const partial = page.getByRole('row').filter({ hasText: product }).filter({ has: page.getByText('5 kg', { exact: true }) });
    await partial.getByRole('button', { name: /^Ver aplicación/ }).click();
    const photo = dialog.getByRole('img', { name: 'fertilizacion-qa.png', exact: true });
    await expect(photo).toBeVisible();
    return photo;
  });
}));
