import { expect, test } from '@playwright/test';
import { attachDemoPhoto, localTimestamp, walkthrough } from '../walkthrough';

test('Riego', walkthrough(async ({ page, step, button, dialog, close }) => {
  const sector = 'Sector QA Goteo';
  const save = () => dialog.getByRole('button', { name: 'Guardar', exact: true }).click();
  const plan = page.getByRole('row').filter({ hasText: sector });
  await page.goto('/#irrigation');

  await step('Mapa y filtro de sectores', 'El filtro del mapa actualiza también la tabla de sectores de riego.', async () => {
    await page.getByRole('combobox', { name: 'Filtrar mapa por campo' }).selectOption({ label: 'Campo Norte' });
    await expect(page.locator('.irrigation-dashboard-table tbody tr')).toHaveCount(2);
    return page.locator('.irrigation-map-card');
  });
  await step('Sector y medición de humedad', 'Registramos una lectura de 27 % volumétrico en el sector de prueba.', async () => {
    await button('Sectores').click();
    await button('Nuevo sector').click();
    await dialog.getByLabel('Nombre del sector', { exact: true }).fill(sector);
    await dialog.getByLabel('Área del sector (ha)', { exact: true }).fill('2');
    await dialog.getByLabel('Sistema de riego', { exact: true }).fill('Goteo');
    await dialog.getByLabel('Fuente de agua', { exact: true }).fill('Reservorio de prueba');
    await dialog.getByLabel('Límite inferior (opcional)', { exact: true }).fill('21');
    await dialog.getByLabel('Límite superior (opcional)', { exact: true }).fill('33');
    await dialog.getByLabel('Fundamento técnico / motivo de configuración').fill('Lectura de prueba.');
    await save();
    await expect(dialog).toBeHidden();
    await button('Nueva medición').click();
    await dialog.getByRole('combobox', { name: 'Sector', exact: true }).selectOption({ label: sector + ' · Bloque A' });
    await dialog.getByLabel('Valor de humedad', { exact: true }).fill('27');
    await dialog.getByLabel('Instrumento o método', { exact: true }).fill('Medidor QA');
    await save();
    await expect(dialog).toBeHidden();
    const row = page.getByRole('row').filter({ hasText: 'Medidor QA' });
    await expect(row).toContainText('27 % volumétrico');
    return row;
  });
  await step('Programar y generar la tarea', 'Se guardan 60 minutos y 12 m³ previstos y se vincula una tarea.', async () => {
    await button('Programación').click();
    await button('Programar riego').click();
    await dialog.getByRole('combobox', { name: 'Sector', exact: true }).selectOption({ label: sector + ' · Bloque A' });
    await dialog.getByLabel('Duración prevista (min)', { exact: true }).fill('60');
    await dialog.getByLabel('Volumen previsto (m³)', { exact: true }).fill('12');
    await dialog.getByLabel('Justificación técnica').fill('Revisión de humedad de prueba.');
    await dialog.getByLabel('Instrucciones de ejecución').fill('Registrar lecturas del contador.');
    await save();
    await expect(dialog).toBeHidden();
    await plan.getByRole('button', { name: 'Generar tarea', exact: true }).click();
    await expect(plan.getByRole('button', { name: 'Registrar ejecución', exact: true })).toBeEnabled();
    return plan;
  });
  await step('Registrar el tiempo y el agua utilizados', 'La diferencia del contador son 6 m³ y el tiempo efectivo son 30 minutos.', async () => {
    await plan.getByRole('button', { name: 'Registrar ejecución', exact: true }).click();
    const end = new Date(Date.now() - 120_000);
    await dialog.getByLabel('Inicio real', { exact: true }).fill(localTimestamp(new Date(end.getTime() - 40 * 60_000)));
    await dialog.getByLabel('Fin real', { exact: true }).fill(localTimestamp(end));
    await dialog.getByLabel('Interrupciones (min)', { exact: true }).fill('10');
    await dialog.getByLabel('Unidad del contador', { exact: true }).selectOption('L');
    await dialog.getByLabel('Lectura inicial del contador', { exact: true }).fill('1000');
    await dialog.getByLabel('Lectura final del contador', { exact: true }).fill('7000');
    await save();
    await expect(dialog).toContainText('6 m³ · Medido por contador · 30 min efectivos');
    return dialog;
  });
  await step('Comprobar la evidencia al recargar', 'La ejecución conserva su foto y la lectura del contador en el historial.', async () => {
    await attachDemoPhoto(page, dialog, 'riego-qa.png', 'Ejecución por contador · 6 m³');
    await close();
    await page.reload();
    await button('Ejecuciones').click();
    await page.getByRole('button', { name: /^Ver ejecución/ }).click();
    const proof = dialog.getByRole('img', { name: 'riego-qa.png', exact: true });
    await expect(proof).toBeVisible();
    return proof;
  });
}));
