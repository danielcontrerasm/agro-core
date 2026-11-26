import { expect, test } from '@playwright/test';
import { walkthrough } from '../walkthrough';

test('Centro agronómico', walkthrough(async ({ page, step, button }) => {
  await page.goto('/#insights');

  await step('Consultar las guías del centro', 'El centro reúne accesos directos a riego, fertilización, observaciones y cosecha.', async () => {
    await expect(page.getByRole('heading', { name: 'Centro agronómico' })).toBeVisible();
    await expect(button('Ver registros de riego')).toBeVisible();
    await expect(button('Ver fertilización')).toBeVisible();
    await expect(button('Ver observaciones')).toBeVisible();
    await expect(button('Ver cosechas')).toBeVisible();
    return page.locator('.insights-grid');
  });
  await step('Buscar una guía', 'La búsqueda filtra la orientación agronómica y mantiene el enlace al módulo.', async () => {
    await page.locator('.global-search input').fill('trazabilidad');
    await expect(button('Ver fertilización')).toBeVisible();
    await expect(button('Ver cosechas')).toHaveCount(0);
    return button('Ver fertilización');
  });
  await step('Abrir el módulo recomendado', 'El enlace abre el resumen de Fertilización con su estado nutricional.', async () => {
    await button('Ver fertilización').click();
    await expect(page).toHaveURL(/#fertilization$/);
    const heading = page.getByRole('heading', { name: 'Estado nutricional del cultivo' });
    await expect(heading).toBeVisible();
    return heading;
  });
}));
