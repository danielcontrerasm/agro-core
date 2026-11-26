import { expect, test, type Locator } from '@playwright/test';
import { createQaFarm, signInAsNewQaUser } from './support/qa-account';

async function setRange(dialog: Locator, nutrient: string, lower: string, upper: string) {
  const range = dialog.getByRole('group', { name: nutrient, exact: true });
  await range.getByLabel('Límite inferior').fill(lower);
  await range.getByLabel('Límite superior').fill(upper);
}

test('connected nutrient diagnosis selects the variety profile and persists technical review', async ({ page }, info) => {
  test.skip(process.env.AGRO_LIVE_TEST !== '1', 'Requires the isolated QA backend.');
  test.setTimeout(90_000);
  await signInAsNewQaUser(page);
  await createQaFarm(page, 'Finca QA de diagnóstico nutricional');
  const api = '/api/v1';
  const [farm] = await (await page.request.get(`${api}/farms`)).json() as { id: number }[];
  const csrf = await (await page.request.get(`${api}/auth/csrf`)).json() as { headerName: string; token: string };
  async function create(resource: string, data: object) {
    const response = await page.request.post(`${api}/${resource}`, { data, headers: { [csrf.headerName]: csrf.token } });
    await expect(response).toBeOK();
    return await response.json() as { id: number };
  }
  const polygon = { coordinates: [[[-74.1, 10.5], [-74.11, 10.5], [-74.11, 10.51], [-74.1, 10.5]]] };
  const field = await create('fields', { farmId: farm.id, name: 'Sector diagnóstico QA', polygon, areaHa: 12 });
  const block = await create('blocks', {
    fieldId: field.id, code: 'Nutrición QA', crop: 'banana', variety: 'Variedad QA', polygon, areaHa: 10,
  });

  await page.goto('/#fertilization');
  await page.reload();
  await page.getByRole('button', { name: 'Análisis', exact: true }).click();
  const openProfile = page.getByRole('button', { name: 'Nuevo perfil', exact: true });
  const dialog = page.getByRole('dialog');
  const specificProfile = 'Perfil específico QA';
  const genericProfile = 'Perfil genérico QA';
  const source = 'Referencia sintética del laboratorio QA';
  async function startProfile(name: string, variety?: string) {
    await openProfile.click();
    await dialog.getByLabel('Nombre del perfil', { exact: true }).fill(name);
    await dialog.getByLabel('Cultivo', { exact: true }).fill('banana');
    if (variety) await dialog.getByLabel('Variedad (opcional)', { exact: true }).fill(variety);
    await dialog.getByLabel('Fuente técnica', { exact: true }).fill(source);
  }
  const saveProfile = dialog.getByRole('button', { name: 'Guardar perfil', exact: true });
  await startProfile(specificProfile, 'Variedad QA');
  await dialog.getByLabel('Versión', { exact: true }).fill('qa-v2');
  await setRange(dialog, 'Boro (B)', '0.4', '0.2');
  await saveProfile.click();
  await expect(dialog.getByRole('alert')).toContainText('el límite superior debe ser mayor');
  await setRange(dialog, 'Boro (B)', '0.2', '0.4');
  await setRange(dialog, 'Fósforo (P)', '5', '15');
  await setRange(dialog, 'Potasio (K)', '2', '4');
  await setRange(dialog, 'pH', '5', '7');
  await saveProfile.click();
  await expect(dialog).toHaveCount(0);
  await startProfile(genericProfile);
  await setRange(dialog, 'Boro (B)', '0.2', '0.8');
  await saveProfile.click();
  await expect(dialog).toHaveCount(0);

  await page.getByRole('button', { name: 'Nuevo análisis', exact: true }).click();
  await dialog.getByRole('combobox', { name: 'Bloque', exact: true }).selectOption(String(block.id));
  await dialog.getByLabel('Laboratorio', { exact: true }).fill('Laboratorio QA');
  const reference = 'DIAGNOSTICO-PERFIL-QA';
  await dialog.getByLabel('Referencia de muestra', { exact: true }).fill(reference);
  for (const [nutrient, value] of [['B', '0.6'], ['P', '0.5'], ['K', '1'], ['PH', '6']]) {
    await dialog.getByLabel(`Valor ${nutrient}`, { exact: true }).fill(value);
    await dialog.getByLabel(`Método ${nutrient}`, { exact: true }).fill('Medición de prueba');
  }
  await dialog.getByRole('combobox', { name: 'Unidad P', exact: true }).selectOption('PERCENT');
  await dialog.getByRole('button', { name: 'Guardar', exact: true }).click();
  const sampleRow = page.getByRole('row').filter({ hasText: reference });
  await expect(sampleRow).toContainText(specificProfile);
  await sampleRow.getByRole('button', { name: /Ver análisis/ }).click();
  await expect(dialog).toContainText(`${specificProfile} · qa-v2. ${source}`);
  await expect(dialog).not.toContainText(genericProfile);
  await expect(dialog.getByRole('row').filter({ hasText: 'Rango de referencia' }).filter({ hasText: 'Boro (B)' })).toContainText('Alto');
  await expect(dialog.getByRole('row').filter({ hasText: 'Rango de referencia' }).filter({ hasText: 'Potasio (K)' })).toContainText('Bajo');
  await expect(dialog.getByRole('row').filter({ hasText: 'Rango de referencia' }).filter({ hasText: 'pH en rango' })).toHaveCount(1);
  await expect(dialog.getByRole('row').filter({ hasText: 'Sin interpretar' }).filter({ hasText: 'Fósforo (P)' }))
    .toContainText('No hay un rango compatible para este nutriente y unidad');
  await info.attach('01 - Interpretación del perfil de la variedad', { body: await dialog.screenshot(), contentType: 'image/png' });

  await dialog.getByRole('button', { name: 'Registrar revisión', exact: true }).click();
  const decision = dialog.getByRole('combobox', { name: 'Decisión', exact: true });
  const notes = dialog.getByRole('textbox', { name: 'Notas técnicas', exact: true });
  const pendingNotes = 'Se solicita verificar el resultado de referencia con otra muestra de prueba.';
  await decision.selectOption('REQUIRES_FOLLOWUP');
  await notes.fill(pendingNotes);
  await dialog.getByRole('button', { name: 'Guardar revisión', exact: true }).click();
  await expect(dialog).toHaveCount(0);

  await page.reload();
  await page.getByRole('button', { name: 'Análisis', exact: true }).click();
  await sampleRow.getByRole('button', { name: /Ver análisis/ }).click();
  await expect(dialog).toContainText(pendingNotes);
  await expect(dialog).toContainText('Requiere seguimiento');
  await dialog.getByRole('button', { name: 'Actualizar revisión', exact: true }).click();
  await expect(decision).toHaveValue('REQUIRES_FOLLOWUP');
  await expect(notes).toHaveValue(pendingNotes);
  const confirmedNotes = 'Interpretación confirmada tras comprobar la muestra sintética.';
  await decision.selectOption('CONFIRMED');
  await notes.fill(confirmedNotes);
  await dialog.getByRole('button', { name: 'Guardar revisión', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await page.reload();
  await page.getByRole('button', { name: 'Análisis', exact: true }).click();
  await sampleRow.getByRole('button', { name: /Ver análisis/ }).click();
  await expect(dialog).toContainText('Revisión confirmada');
  await expect(dialog).toContainText(confirmedNotes);
  await expect(dialog).not.toContainText(pendingNotes);
  await expect(dialog.getByRole('button', { name: 'Actualizar revisión', exact: true })).toBeVisible();
  await info.attach('02 - Revisión confirmada tras recargar', { body: await dialog.screenshot(), contentType: 'image/png' });
});
