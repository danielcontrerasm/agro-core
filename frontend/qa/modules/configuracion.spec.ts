import { expect, test } from '@playwright/test';
import { walkthrough } from '../walkthrough';

test('Configuración', walkthrough(async ({ page, step, button, dialog }) => {
  await page.goto('/#settings');

  await step('Perfil y acceso de administración', 'La configuración muestra el usuario de prueba y el acceso al equipo de la finca.', async () => {
    await expect(page.getByRole('heading', { name: 'Configuración', exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Información de tu cuenta' })).toBeVisible();
    await expect(button('Equipo y permisos')).toBeVisible();
    return page.locator('.profile-summary');
  });
  await step('Agregar un problema al catálogo', 'El administrador puede inscribir un problema fitosanitario de prueba.', async () => {
    await button('Catálogo fitosanitario').click();
    await button('Nuevo problema').click();
    await dialog.getByLabel('Código interno').fill('PROBLEMA-QA');
    await dialog.getByLabel('Nombre visible').fill('Problema fitosanitario QA');
    await dialog.getByLabel('Tipo').selectOption('PEST');
    await dialog.getByRole('button', { name: 'Guardar', exact: true }).click();
    await expect(dialog).toBeHidden();
    const card = page.locator('.list-card').filter({ hasText: 'Problema fitosanitario QA' });
    await expect(card).toBeVisible();
    return card;
  });
  await step('Desactivar el registro de prueba', 'El catálogo conserva el problema y marca su estado como inactivo.', async () => {
    const card = page.locator('.list-card').filter({ hasText: 'Problema fitosanitario QA' });
    await card.getByRole('button', { name: 'Desactivar', exact: true }).click();
    await expect(card.getByText('Inactivo', { exact: true })).toBeVisible();
    return card;
  });
  await step('Simular el rol de trabajador', 'La vista de trabajador aplica permisos de consulta y trabajo asignado.', async () => {
    await button('Mi perfil').click();
    await button('Trabajador').click();
    await expect(button('Equipo y permisos')).toHaveCount(0);
    await expect(page.locator('.profile-summary')).toContainText('Trabajador');
    return page.locator('.demo-role-panel');
  });
}));
