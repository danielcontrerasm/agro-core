import { expect, test } from '@playwright/test';
import { attachDemoPhoto, walkthrough } from '../walkthrough';

test('Plagas y enfermedades', walkthrough(async ({ page, step, button, dialog, close }) => {
  const inspection = page.locator('tbody tr').filter({ hasText: 'Picudos' });
  const detail = () => inspection.getByRole('button', { name: /^Ver inspección/ }).click();
  await page.goto('/#disease');

  await step('Medir incidencia', 'Registramos 5 plantas afectadas entre 20 inspeccionadas y verificamos el cálculo del 25 %.', async () => {
    await button('Nueva inspección').click();
    await dialog.getByRole('combobox', { name: 'Bloque', exact: true }).selectOption('5');
    await dialog.getByLabel('Problema sospechado').selectOption('WEEVILS');
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
  await step('Guardar y abrir la inspección', 'El historial vincula la incidencia y el área afectada con el bloque.', async () => {
    await dialog.getByRole('button', { name: 'Guardar inspección', exact: true }).click();
    await expect(dialog).toBeHidden();
    await expect(inspection).toContainText('25 %');
    await expect(inspection).toContainText('1,25 ha');
    await detail();
    await expect(dialog).toContainText('Picudos');
    return dialog;
  });
  await step('Tratamiento y foto de prueba', 'El detalle conserva el tratamiento de demostración y su evidencia.', async () => {
    await dialog.getByRole('button', { name: 'Registrar tratamiento', exact: true }).click();
    await dialog.getByLabel('Descripción del tratamiento').fill('Verificación de tratamiento en la prueba visual.');
    await dialog.getByRole('button', { name: 'Guardar tratamiento', exact: true }).click();
    await expect(dialog).toContainText('Verificación de tratamiento');
    const gallery = await attachDemoPhoto(page, dialog, 'inspeccion-qa.png', 'Inspección del Bloque E');
    return gallery;
  });
  await step('Comprobar la trazabilidad tras recargar', 'El nuevo registro, su tratamiento y el adjunto se mantienen en el historial local.', async () => {
    await close();
    await page.reload();
    await detail();
    await expect(dialog).toContainText('Verificación de tratamiento');
    const proof = dialog.getByRole('img', { name: 'inspeccion-qa.png', exact: true });
    await expect(proof).toBeVisible();
    return proof;
  });
}));
