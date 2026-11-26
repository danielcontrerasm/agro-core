import { expect, test } from '@playwright/test';
import { attachDemoPhoto, walkthrough } from '../walkthrough';

test('Plagas y enfermedades', walkthrough(async ({ page, step, button, dialog, close }) => {
  const inspection = page.locator('tbody tr').filter({ hasText: 'Picudos' });
  const detail = () => inspection.getByRole('button', { name: /^Ver inspección/ }).click();
  const plan = page.getByRole('list', { name: 'Planes de monitoreo periódico' }).getByRole('listitem');
  const alert = page.getByRole('list', { name: 'Alertas de incidencia' }).getByRole('listitem');
  const followup = dialog.getByRole('region', { name: 'Seguimiento de tratamientos' });
  await page.goto('/#disease');

  await step('Programar monitoreo periódico', 'El Bloque E recibe un plan semanal con umbral de revisión del 25 %.', async () => {
    await button('Monitoreo').click();
    await button('Nuevo plan de monitoreo').click();
    await dialog.getByRole('combobox', { name: 'Bloque', exact: true }).selectOption('5');
    await dialog.getByRole('combobox', { name: 'Problema fitosanitario' }).selectOption('WEEVILS');
    await dialog.getByLabel('Fecha de inicio').fill(new Date(Date.now() - 86_400_000).toISOString().slice(0, 10));
    await dialog.getByLabel('Frecuencia (días)').fill('7');
    await dialog.getByLabel('Umbral de incidencia (%)').fill('25');
    await button('Guardar plan').click();
    await expect(plan).toContainText('Visita vencida');
    return plan;
  });
  await step('Medir incidencia', 'Registramos 5 plantas afectadas entre 20 inspeccionadas y verificamos el cálculo del 25 %.', async () => {
    await button('Registrar visita').click();
    await expect(dialog.getByRole('combobox', { name: 'Bloque', exact: true })).toHaveValue('5');
    await expect(dialog.getByRole('combobox', { name: 'Problema sospechado' })).toHaveValue('WEEVILS');
    await dialog.getByLabel('Plantas inspeccionadas').fill('20');
    await dialog.getByLabel('Plantas afectadas').fill('5');
    await dialog.getByLabel('Área afectada (ha)').fill('1.25');
    await dialog.getByLabel('Síntomas observados').fill('Observación de prueba para seguimiento.');
    await dialog.getByLabel('Severidad del daño (%)').fill('10');
    await dialog.getByLabel('Método de evaluación').fill('Conteo visual simulado.');
    const incidence = dialog.getByRole('status');
    await expect(incidence).toHaveText('Incidencia: 25 %');
    return incidence;
  });
  await step('Revisar la alerta por umbral', 'El valor de 25 % alcanza el umbral. La decisión técnica queda vinculada a la inspección.', async () => {
    await button('Guardar inspección').click();
    await expect(dialog).toBeHidden();
    await expect(plan).not.toContainText('Visita vencida');
    await expect(alert).toContainText('Incidencia de 25 % · Umbral de 25 %');
    await button('Revisar alerta').click();
    await dialog.getByLabel('Decisión técnica').fill('Confirmar en una visita de seguimiento.');
    await button('Guardar decisión').click();
    await expect(alert).toContainText('Revisada');
    return alert;
  });
  await step('Autorizar el tratamiento', 'La autorización guarda la intervención de demostración, quién la registró y el producto de prueba.', async () => {
    await button('Ver inspección de origen').click();
    await expect(dialog).toContainText('1,25 ha');
    await followup.getByRole('button', { name: 'Autorizar tratamiento', exact: true }).click();
    const form = followup.getByRole('form', { name: 'Autorizar tratamiento' });
    await form.getByLabel('Descripción de la autorización').fill('Intervención de verificación visual QA.');
    await form.getByLabel('Producto autorizado (opcional)').fill('Producto de prueba');
    await form.getByRole('button', { name: 'Autorizar tratamiento' }).click();
    await expect(followup.getByText('Autorizado', { exact: true })).toBeVisible();
    return followup.getByRole('article');
  });
  await step('Registrar ejecución, lote y foto', 'La ejecución conserva lote, cantidad, fecha y evidencia asociada al tratamiento.', async () => {
    await followup.getByRole('button', { name: 'Registrar ejecución', exact: true }).click();
    const form = followup.getByRole('form', { name: 'Registrar ejecución' });
    await form.getByLabel('Lote del producto').fill('LOTE-PRUEBA');
    await form.getByLabel('Cantidad ejecutada (opcional)').fill('2');
    await form.getByLabel('Unidad ejecutada').fill('kg');
    await form.getByRole('button', { name: 'Registrar ejecución' }).click();
    await expect(followup).toContainText('Lote del producto · LOTE-PRUEBA');
    await dialog.getByRole('combobox', { name: 'Asociar fotos a' }).selectOption({ index: 1 });
    return attachDemoPhoto(page, dialog, 'inspeccion-qa.png', 'Ejecución en el Bloque E');
  });
  await step('Verificar y recuperar el historial', 'La verificación, el lote y la foto se mantienen al recargar el historial.', async () => {
    await followup.getByRole('button', { name: 'Registrar verificación', exact: true }).click();
    const form = followup.getByRole('form', { name: 'Registrar verificación' });
    await form.getByLabel('Resultado de la verificación').selectOption('PARTIAL');
    await form.getByLabel('Observaciones de la verificación').fill('Resultado parcial observado en la visita.');
    await form.getByRole('button', { name: 'Registrar verificación' }).click();
    await expect(followup.getByText('Verificado', { exact: true })).toBeVisible();
    await close();
    await page.reload();
    await detail();
    await expect(followup).toContainText('Resultado · Parcialmente eficaz');
    await expect(dialog.getByRole('img', { name: 'inspeccion-qa.png', exact: true })).toBeVisible();
    return followup.getByRole('article');
  });
}));
