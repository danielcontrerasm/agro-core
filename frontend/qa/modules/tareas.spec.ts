import { expect, test } from '@playwright/test';
import { walkthrough } from '../walkthrough';

test('Mi trabajo de hoy', walkthrough(async ({ page, step, dialog, close }) => {
  const task = page.getByRole('button', { name: /Inspección de síntomas foliares/ });
  const action = (name: string) => dialog.getByRole('button', { name, exact: true });
  const notes = 'Inspección de prueba completada para revisión.';
  await page.goto('/#tasks');

  await step('Abrir tarea y revisar instrucciones', 'Se comprueba la tarea asignada y su acción de inicio.', async () => {
    await task.click();
    await expect(action('Iniciar tarea')).toBeEnabled();
    return dialog;
  });
  await step('Iniciar y registrar novedades', 'La ejecución conserva la nota que se enviará a revisión.', async () => {
    await action('Iniciar tarea').click();
    const input = dialog.getByRole('textbox', { name: 'Notas y novedades' });
    await input.fill(notes);
    await expect(input).toHaveValue(notes);
    return input;
  });
  await step('Enviar a revisión', 'El trabajo pasa a revisión y queda disponible para aprobación.', async () => {
    await action('Enviar a revisión').click();
    await expect(action('Aprobar trabajo')).toBeEnabled();
    return dialog;
  });
  await step('Aprobar y volver a consultar', 'Al recargar, la tarea sigue completada y mantiene su revisión.', async () => {
    await action('Aprobar trabajo').click();
    await expect(dialog).toContainText('Trabajo completado y revisado.');
    await close();
    await page.reload();
    await task.click();
    await expect(dialog).toContainText('Trabajo completado y revisado.');
    return dialog;
  });
}));
