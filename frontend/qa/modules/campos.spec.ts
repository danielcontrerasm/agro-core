import { expect, test } from '@playwright/test';
import { walkthrough } from '../walkthrough';

test('Campos y bloques', walkthrough(async ({ page, step, button, dialog }) => {
  const fieldName = 'Campo QA Ladera';
  const blockCode = 'Bloque QA Ladera';
  const tree = page.locator('.fields-tree');
  const outline = '[[[-74.1,10.5],[-74.11,10.5],[-74.11,10.51],[-74.1,10.5]]]';
  await page.goto('/#fields');

  await step('Mapa y estructura de la finca', 'Los campos, bloques y áreas se consultan desde el mapa y el árbol.', async () => {
    await expect(button('Vista mapa')).toHaveAttribute('aria-pressed', 'true');
    await expect(tree).toContainText('Campo Norte');
    await expect(page.getByRole('heading', { name: 'Detalle del campo' })).toBeVisible();
    return tree;
  });
  await step('Crear un campo', 'Guardamos un campo de 12,5 ha con su polígono y lo consultamos en la lista.', async () => {
    await button('Nuevo campo').click();
    await dialog.getByLabel('Nombre', { exact: true }).fill(fieldName);
    await dialog.getByLabel('Área (ha)').fill('12.5');
    await dialog.getByLabel(/Coordenadas/).fill(outline);
    await dialog.getByRole('button', { name: 'Guardar', exact: true }).click();
    await expect(dialog).toBeHidden();
    await button('Vista lista').click();
    const row = page.getByRole('row').filter({ hasText: fieldName });
    await expect(row).toContainText('12,5 ha');
    return row;
  });
  await step('Vincular un bloque al campo', 'Verificamos que el bloque nuevo aparezca bajo su campo en la estructura.', async () => {
    await page.locator('.fields-side-column').getByRole('button', { name: 'Nuevo bloque', exact: true }).click();
    await dialog.getByLabel('Código', { exact: true }).fill(blockCode);
    await dialog.getByRole('combobox', { name: 'Campo', exact: true }).selectOption({ label: fieldName });
    await dialog.getByLabel('Área (ha)').fill('4');
    await dialog.getByLabel(/Coordenadas/).fill(outline);
    await dialog.getByRole('button', { name: 'Guardar', exact: true }).click();
    await expect(dialog).toBeHidden();
    const field = tree.getByRole('button', { name: new RegExp(fieldName) });
    if (await field.getAttribute('aria-expanded') !== 'true') await field.click();
    await tree.getByRole('button', { name: new RegExp(blockCode) }).click();
    const block = page.getByRole('row').filter({ hasText: blockCode });
    await expect(block).toContainText('4 ha');
    return block;
  });
}));
