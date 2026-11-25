import { randomUUID } from 'node:crypto';
import { expect, type Page } from '@playwright/test';

export async function openFarmLogin(page: Page) {
  await page.goto('/');
  await expect(page.locator('.app-shell')).toBeVisible();
  const menu = page.getByRole('button', { name: 'Abrir menú', exact: true });
  if (await menu.isVisible()) await menu.click();
  await page.getByRole('button', { name: 'Salir de demostración', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Iniciar sesión', exact: true })).toBeVisible();
}

export async function closeFarmMenu(page: Page) {
  const close = page.locator('.sidebar-open').getByRole('button', { name: 'Cerrar menú', exact: true });
  if (await close.isVisible()) await close.click();
}

export async function signInAsNewQaUser(page: Page) {
  const email = `qa-${randomUUID()}@example.com`;
  const password = randomUUID();

  await openFarmLogin(page);
  await page.getByRole('button', { name: 'Crea tu cuenta', exact: true }).click();
  await page.getByLabel('Tu nombre', { exact: true }).fill('AgroVision QA');
  await page.getByLabel('Correo electrónico', { exact: true }).fill(email);
  await page.getByLabel(/^Contraseña/).fill(password);
  await page.getByRole('button', { name: 'Crear mi cuenta', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('Cuenta creada.');

  await page.getByLabel('Correo electrónico', { exact: true }).fill(email);
  await page.getByLabel('Contraseña', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Iniciar sesión', exact: true }).click();
  await expect(page.locator('.environment-bar')).toContainText('Conectado a tu finca');
  await closeFarmMenu(page);
}

export async function createQaFarm(page: Page, name: string) {
  await page.getByRole('button', { name: 'Crear mi primera finca', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Nombre', { exact: true }).fill(name);
  await dialog.getByRole('button', { name: 'Guardar', exact: true }).click();
  await expect(dialog).not.toBeVisible();
  await expect(page.getByLabel('Seleccionar finca').locator('option'))
    .toHaveText([name]);
}
