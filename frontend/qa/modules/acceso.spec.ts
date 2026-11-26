import { expect, test } from '@playwright/test';
import { openFarmLogin } from '../../tests/support/qa-account';
import { walkthrough } from '../walkthrough';

test('Acceso a la finca', walkthrough(async ({ page, step, button }) => {
  const writes: { path: string; csrf: string | undefined }[] = [];
  const profile = {
    user: { id: 42, name: 'Trabajador QA', email: 'qa@example.invalid' },
    memberships: [{ farmId: 91, farmName: 'Finca de prueba', role: 'WORKER' }],
  };
  let csrf = 0;
  await page.route('**/api/v1/**', async route => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (request.method() !== 'GET') writes.push({ path, csrf: request.headers()['x-csrf-token'] });
    if (path.endsWith('/logout')) {
      await route.fulfill({ status: 204 });
      return;
    }
    let data: unknown = [];
    if (path.endsWith('/csrf')) data = { token: 'csrf-qa-' + ++csrf, headerName: 'X-CSRF-TOKEN' };
    if (path.endsWith('/me') || path.endsWith('/login')) data = profile;
    if (path.endsWith('/farms')) data = [{ id: 91, name: 'Finca de prueba' }];
    if (path.endsWith('/rows/disease')) data = { type: 'FeatureCollection', features: [] };
    await route.fulfill({ json: data });
  });

  await step('Abrir el acceso', 'Se abre el formulario de AgroVision para usar una cuenta simulada durante la prueba.', async () => {
    await openFarmLogin(page);
    await expect(page.getByLabel('Correo electrónico', { exact: true })).toBeVisible();
    return page.getByLabel('Correo electrónico', { exact: true });
  });
  await step('Iniciar sesión y consultar la finca', 'La sesión de prueba muestra la finca asociada y el rol de trabajador.', async () => {
    await page.getByLabel('Correo electrónico', { exact: true }).fill(profile.user.email);
    await page.getByLabel('Contraseña', { exact: true }).fill('prueba-visual-qa');
    await button('Iniciar sesión').click();
    await expect(page.locator('.environment-bar')).toContainText('Conectado a tu finca');
    const farm = page.getByLabel('Seleccionar finca');
    await expect(farm).toContainText('Finca de prueba');
    await expect(page.locator('main h1')).toContainText('Trabajador');
    return farm;
  });
  await step('Cerrar sesión', 'Volvemos al formulario de acceso y verificamos la protección de las operaciones de sesión.', async () => {
    await button('Cerrar sesión').click();
    await expect(page.getByRole('heading', { name: 'Qué bueno verte de nuevo.' })).toBeVisible();
    expect(writes).toEqual([
      { path: '/api/v1/auth/login', csrf: 'csrf-qa-1' },
      { path: '/api/v1/auth/logout', csrf: 'csrf-qa-2' },
    ]);
    return button('Iniciar sesión');
  });
}));
