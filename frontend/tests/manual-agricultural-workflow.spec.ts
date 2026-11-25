import { expect, test, type Locator, type Page } from '@playwright/test';
import { createQaFarm, openFarmLogin, signInAsNewQaUser } from './support/qa-account';

/*
 * Recorrido E2E para una finca existente o una finca desechable creada por
 * scripts/run_qa_tests.py.
 *
 * Ambos modos exigen habilitación explícita de escritura.
 * Consulta manual-agricultural-workflow.md antes de ejecutarlo.
 */

const automated = process.env.AGRO_QA_WALKTHROUGH === '1';
const enabled = automated || process.env.AGRO_MANUAL_E2E === '1';
const writeConfirmation = process.env.AGRO_E2E_ALLOW_WRITES;
const pauseEveryStep = !automated && process.env.AGRO_E2E_PAUSE_EVERY_STEP !== '0';
const automaticStepDelay = Math.max(0, Number(process.env.AGRO_E2E_STEP_DELAY_MS ?? 0));
const modeLabel = automated ? 'PRUEBA QA' : 'PRUEBA MANUAL';

function requiredNumber(name: string, fallback: number) {
  const value = process.env[name];
  if (value == null || value.trim() === '') return fallback;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) throw new Error(`${name} debe ser un número válido.`);
  return parsed;
}

const longitude = requiredNumber('AGRO_E2E_LONGITUDE', -74.1);
const latitude = requiredNumber('AGRO_E2E_LATITUDE', 10.5);

function localDate(offsetDays = 0) {
  const date = new Date();
  date.setDate(date.getDate() + offsetDays);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function runToken() {
  return new Date().toISOString().replace(/\D/g, '').slice(0, 14);
}

function fieldPolygon() {
  return JSON.stringify([[
    [longitude, latitude],
    [longitude + 0.002, latitude],
    [longitude + 0.002, latitude + 0.002],
    [longitude, latitude + 0.002],
    [longitude, latitude],
  ]]);
}

function blockPolygon() {
  return JSON.stringify([[
    [longitude + 0.00025, latitude + 0.00025],
    [longitude + 0.001, latitude + 0.00025],
    [longitude + 0.001, latitude + 0.001],
    [longitude + 0.00025, latitude + 0.001],
    [longitude + 0.00025, latitude + 0.00025],
  ]]);
}

function rowLine() {
  return JSON.stringify([
    [longitude + 0.00035, latitude + 0.00045],
    [longitude + 0.0009, latitude + 0.00045],
  ]);
}

async function selectOptionContaining(select: Locator, text: string) {
  const option = select.locator('option').filter({ hasText: text }).first();
  await expect(option, `No existe una opción que contenga “${text}”.`).toHaveAttribute('value', /.+/);
  const value = await option.getAttribute('value');
  if (!value) throw new Error(`La opción “${text}” no tiene un valor seleccionable.`);
  await select.selectOption(value);
}

async function ensureOptions(select: Locator, minimum: number, explanation: string) {
  await expect(select).toBeEnabled();
  await expect.poll(async () => select.locator('option').count(), { message: explanation }).toBeGreaterThanOrEqual(minimum);
}

async function renderProgress(page: Page, number: number, title: string, detail: string) {
  await page.evaluate(({ number: stepNumber, title: stepTitle, detail: stepDetail, label }) => {
    const id = 'agro-e2e-manual-progress';
    let root = document.getElementById(id);
    if (!root) {
      root = document.createElement('aside');
      root.id = id;
      Object.assign(root.style, {
        position: 'fixed', right: '20px', bottom: '20px', zIndex: '2147483647', maxWidth: '420px',
        padding: '14px 16px', borderRadius: '12px', background: '#102b1d', color: '#ffffff',
        boxShadow: '0 12px 35px rgba(0,0,0,.32)', fontFamily: 'system-ui, sans-serif', pointerEvents: 'none',
      });
      document.body.append(root);
    }
    root.replaceChildren();
    const eyebrow = document.createElement('small');
    eyebrow.textContent = `${label} · PASO ${String(stepNumber).padStart(2, '0')}`;
    eyebrow.style.cssText = 'display:block;color:#9be5a8;font-size:11px;font-weight:700;letter-spacing:.08em;margin-bottom:5px';
    const heading = document.createElement('strong');
    heading.textContent = stepTitle;
    heading.style.cssText = 'display:block;font-size:15px;margin-bottom:4px';
    const body = document.createElement('span');
    body.textContent = stepDetail;
    body.style.cssText = 'display:block;font-size:12px;line-height:1.45;color:#dbe9de';
    root.append(eyebrow, heading, body);
  }, { number, title, detail, label: modeLabel });
}

async function checkpoint(page: Page, number: number, title: string, detail: string) {
  await renderProgress(page, number, title, detail);
  console.log(`[${modeLabel} · ${String(number).padStart(2, '0')}] ${title}: ${detail}`);
  if (pauseEveryStep) await page.pause();
  else if (automaticStepDelay > 0) await page.waitForTimeout(automaticStepDelay);
}

async function visibleStep(page: Page, number: number, title: string, detail: string, action: () => Promise<void>) {
  await test.step(`${String(number).padStart(2, '0')} · ${title}`, async () => {
    await action();
    await checkpoint(page, number, title, detail);
  });
}

test.use({ screenshot: 'on', trace: automated ? 'off' : 'on', video: automated ? 'off' : 'on' });

test('recorrido manual: finca, lote, riego, fertilización y cosecha', async ({ page }, testInfo) => {
  test.skip(!enabled, 'Usa scripts/run_qa_tests.py o habilita AGRO_MANUAL_E2E=1 para el recorrido manual.');
  test.setTimeout(automated ? 5 * 60 * 1000 : 60 * 60 * 1000);

  if (writeConfirmation !== 'SI') {
    throw new Error('Esta prueba crea datos persistentes. Ejecuta solo con AGRO_E2E_ALLOW_WRITES=SI.');
  }

  const token = runToken();
  const farmName = automated ? `Finca QA ${token}` : process.env.AGRO_E2E_FARM_NAME?.trim();
  if (!farmName) {
    throw new Error('Indica la finca existente con AGRO_E2E_FARM_NAME="Nombre exacto de la finca".');
  }

  const prefix = process.env.AGRO_E2E_PREFIX?.trim() || (automated ? 'E2E-QA' : 'E2E-MANUAL');
  const names = {
    field: `${prefix} Campo ${token}`,
    block: `${prefix}-LOTE-${token}`,
    row: `${prefix}-SURCO-${token}`,
    sector: `${prefix} Sector ${token}`,
    analysis: `${prefix}-AN-${token}`,
    product: `${prefix} Fertilizante ${token}`,
    cycle: `${prefix}-CICLO-${token}`,
  };
  const twoDaysAgo = localDate(-2);
  const yesterday = localDate(-1);
  const now = localDate();

  if (automated) {
    await visibleStep(page, 0, 'Preparar la finca QA', `Cuenta y finca de prueba creadas: ${farmName}.`, async () => {
      await signInAsNewQaUser(page);
      await createQaFarm(page, farmName);
    });
  } else {
    await openFarmLogin(page);
    await checkpoint(
      page,
      0,
      'Inicio de sesión manual',
      'Escribe tus credenciales, inicia sesión y en el Inspector pulsa “Resume” para continuar. La contraseña nunca queda en el script.',
    );
    await expect(page.locator('.environment-bar')).toContainText('Conectado a tu finca');
  }

  await visibleStep(page, 1, 'Seleccionar la finca objetivo', `Se usará únicamente la finca “${farmName}”.`, async () => {
    const picker = page.getByLabel('Seleccionar finca');
    await expect(picker).toBeVisible();
    await expect(picker.locator('option').filter({ hasText: farmName })).toHaveCount(1);
    await picker.selectOption({ label: farmName });
    await expect(picker).toHaveValue(/.+/);
  });

  await visibleStep(page, 2, 'Crear el campo de prueba', `Campo creado: ${names.field}.`, async () => {
    await page.goto('/#fields');
    await expect(page.getByRole('heading', { name: 'Campos de la Finca', exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Nuevo campo', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: 'Nuevo campo', exact: true });
    await dialog.getByLabel('Nombre', { exact: true }).fill(names.field);
    await dialog.getByLabel('Área (ha)', { exact: true }).fill('0.8');
    await dialog.getByLabel(/Coordenadas del polígono/).fill(fieldPolygon());
    await dialog.getByRole('button', { name: 'Guardar', exact: true }).click();
    await expect(dialog).toHaveCount(0);
    await expect(page.locator('.fields-tree').getByText(names.field, { exact: true })).toBeVisible();
  });

  await visibleStep(page, 3, 'Crear el lote o bloque', `Bloque creado: ${names.block}.`, async () => {
    await page.getByRole('button', { name: 'Vista lista', exact: true }).click();
    await page.locator('.fields-list-panel').getByRole('button', { name: 'Nuevo bloque', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: 'Nuevo bloque', exact: true });
    await dialog.getByLabel('Código', { exact: true }).fill(names.block);
    await dialog.getByRole('combobox', { name: 'Campo', exact: true }).selectOption({ label: names.field });
    const crop = dialog.getByRole('combobox', { name: 'Cultivo', exact: true });
    await ensureOptions(crop, 2, 'La finca no tiene cultivos en el catálogo. Configura al menos un cultivo antes de ejecutar la prueba.');
    await crop.selectOption({ index: 1 });
    await dialog.getByLabel('Área (ha)', { exact: true }).fill('0.5');
    await dialog.getByLabel(/Coordenadas del polígono/).fill(blockPolygon());
    const saved = page.waitForResponse(response =>
      response.request().method() === 'POST' && new URL(response.url()).pathname === '/api/v1/blocks');
    await dialog.getByRole('button', { name: 'Guardar', exact: true }).click();
    const response = await saved;
    expect(response.ok(), 'El servidor debe guardar el bloque.').toBe(true);
    expect(await response.json()).toMatchObject({ code: names.block });
    await expect(dialog).toHaveCount(0);
  });

  await visibleStep(page, 4, 'Crear un surco de prueba', `Surco creado: ${names.row}.`, async () => {
    await page.goto('/#plants');
    await expect(page.getByRole('heading', { name: 'Surcos y plantas', exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Nuevo surco', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: 'Nuevo surco', exact: true });
    await dialog.getByLabel('Código', { exact: true }).fill(names.row);
    await selectOptionContaining(dialog.getByRole('combobox', { name: 'Bloque', exact: true }), names.block);
    await dialog.getByLabel('Longitud (m)', { exact: true }).fill('65');
    await dialog.getByLabel('Distancia entre plantas (m)', { exact: true }).fill('2');
    await dialog.getByLabel('Plantas estimadas', { exact: true }).fill('33');
    await dialog.getByLabel(/Coordenadas de la línea/).fill(rowLine());
    await dialog.getByRole('button', { name: 'Guardar', exact: true }).click();
    await expect(dialog).toHaveCount(0);
    await expect(page.getByText(names.row, { exact: true })).toBeVisible();
  });

  await visibleStep(page, 5, 'Crear un sector de riego', `Sector creado: ${names.sector}.`, async () => {
    await page.goto('/#irrigation');
    await page.getByRole('button', { name: 'Sectores', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Nuevo sector', exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Nuevo sector', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: 'Nuevo sector de riego', exact: true });
    await selectOptionContaining(dialog.getByRole('combobox', { name: 'Bloque', exact: true }), names.block);
    await dialog.getByLabel('Nombre del sector', { exact: true }).fill(names.sector);
    await dialog.getByLabel('Área del sector (ha)', { exact: true }).fill('0.5');
    await dialog.getByLabel('Sistema de riego', { exact: true }).fill('Goteo de prueba E2E');
    await dialog.getByLabel('Fuente de agua', { exact: true }).fill('Reservorio de verificación');
    await dialog.getByLabel('Caudal de referencia (m³/h, opcional)', { exact: true }).fill('10');
    await dialog.getByLabel('Límite inferior (opcional)', { exact: true }).fill('20');
    await dialog.getByLabel('Límite superior (opcional)', { exact: true }).fill('35');
    await dialog.getByLabel('Fundamento técnico / motivo de configuración', { exact: true }).fill('Dato de prueba; no constituye una recomendación agronómica.');
    await dialog.getByRole('button', { name: 'Guardar', exact: true }).click();
    await expect(dialog).toHaveCount(0);
    await expect(page.getByRole('row').filter({ hasText: names.sector })).toBeVisible();
  });

  await visibleStep(page, 6, 'Registrar una medición de humedad', 'Se guardó una lectura manual asociada al sector de prueba.', async () => {
    await page.getByRole('button', { name: 'Nueva medición', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: 'Nueva medición de humedad', exact: true });
    await selectOptionContaining(dialog.getByRole('combobox', { name: 'Sector', exact: true }), names.sector);
    await dialog.getByLabel('Fecha y hora de medición', { exact: true }).fill(`${yesterday}T08:00`);
    await dialog.getByLabel('Valor de humedad', { exact: true }).fill('27');
    await dialog.getByLabel('Instrumento o método', { exact: true }).fill('Medidor manual de prueba');
    await dialog.getByLabel('Lluvia registrada (mm, opcional)', { exact: true }).fill('2');
    await dialog.getByLabel('Observación de drenaje', { exact: true }).fill('Drenaje revisado para la prueba.');
    await dialog.getByRole('button', { name: 'Guardar', exact: true }).click();
    await expect(dialog).toHaveCount(0);
    await expect(page.getByRole('row').filter({ hasText: 'Medidor manual de prueba' })).toBeVisible();
  });

  await visibleStep(page, 7, 'Programar el riego', 'Se creó una programación de 30 minutos y 5 m³.', async () => {
    await page.getByRole('button', { name: 'Programación', exact: true }).click();
    await page.getByRole('button', { name: 'Programar riego', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: 'Programar riego', exact: true });
    await selectOptionContaining(dialog.getByRole('combobox', { name: 'Sector', exact: true }), names.sector);
    await dialog.getByLabel('Fecha programada', { exact: true }).fill(yesterday);
    await dialog.getByLabel('Hora programada', { exact: true }).fill('08:00');
    await dialog.getByLabel('Duración prevista (min)', { exact: true }).fill('30');
    await dialog.getByLabel('Volumen previsto (m³)', { exact: true }).fill('5');
    await ensureOptions(dialog.getByRole('combobox', { name: 'Responsable', exact: true }), 1, 'No hay miembros disponibles para asignar el plan de riego.');
    await dialog.getByLabel('Justificación técnica', { exact: true }).fill('Programación de verificación basada en la medición de prueba.');
    await dialog.getByLabel('Instrucciones de ejecución', { exact: true }).fill('Verificar contador, drenaje y registrar la ejecución de prueba.');
    await dialog.getByRole('button', { name: 'Guardar', exact: true }).click();
    await expect(dialog).toHaveCount(0);
    await expect(page.getByRole('row').filter({ hasText: names.sector })).toContainText('Sin tarea');
  });

  await visibleStep(page, 8, 'Generar la tarea de riego', 'La programación queda vinculada a una tarea trazable.', async () => {
    const planRow = page.getByRole('row').filter({ hasText: names.sector });
    await planRow.getByRole('button', { name: 'Generar tarea', exact: true }).click();
    await expect(planRow).toContainText(/Tarea #/);
  });

  await visibleStep(page, 9, 'Registrar la ejecución del riego', 'Se registró una ejecución medida de 5 m³ en 30 minutos.', async () => {
    const planRow = page.getByRole('row').filter({ hasText: names.sector });
    await planRow.getByRole('button', { name: 'Registrar ejecución', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: 'Registrar ejecución de riego', exact: true });
    await dialog.getByLabel('Inicio real', { exact: true }).fill(`${yesterday}T08:00`);
    await dialog.getByLabel('Fin real', { exact: true }).fill(`${yesterday}T08:30`);
    await dialog.getByLabel('Interrupciones (min)', { exact: true }).fill('0');
    await dialog.getByLabel('Lectura inicial del contador', { exact: true }).fill('1000');
    await dialog.getByLabel('Lectura final del contador', { exact: true }).fill('1005');
    await dialog.getByLabel('Novedades y revisión de drenaje', { exact: true }).fill('Ejecución de prueba sin novedades.');
    await dialog.getByRole('button', { name: 'Guardar', exact: true }).click();
    await expect(page.getByRole('dialog', { name: /Ejecución #/ })).toBeVisible();
    await page.getByRole('dialog', { name: /Ejecución #/ }).getByRole('button', { name: 'Cerrar', exact: true }).click();
    await expect(page.getByRole('table')).toContainText('5 m³');
  });

  await visibleStep(page, 10, 'Registrar análisis de fertilización', `Análisis creado: ${names.analysis}.`, async () => {
    await page.goto('/#fertilization');
    await expect(page.getByRole('button', { name: 'Nuevo análisis', exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Nuevo análisis', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: 'Nuevo análisis', exact: true });
    await selectOptionContaining(dialog.getByRole('combobox', { name: 'Bloque', exact: true }), names.block);
    await dialog.getByLabel('Fecha de muestreo', { exact: true }).fill(twoDaysAgo);
    await dialog.getByLabel('Laboratorio', { exact: true }).fill('Laboratorio de verificación');
    await dialog.getByLabel('Referencia de muestra', { exact: true }).fill(names.analysis);
    await dialog.getByLabel('Valor B', { exact: true }).fill('0.42');
    await dialog.getByLabel('Método B', { exact: true }).fill('Agua caliente');
    await dialog.getByLabel('Observaciones', { exact: true }).fill('Análisis creado exclusivamente para verificar el flujo E2E.');
    await dialog.getByRole('button', { name: 'Guardar', exact: true }).click();
    await expect(dialog).toHaveCount(0);
    await expect(page.getByRole('table')).toContainText(names.analysis);
  });

  await visibleStep(page, 11, 'Crear el plan de fertilización', `Plan creado con el producto “${names.product}”.`, async () => {
    await page.getByRole('button', { name: 'Planes', exact: true }).click();
    await page.getByRole('button', { name: 'Nuevo plan', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: 'Nuevo plan de fertilización', exact: true });
    await selectOptionContaining(dialog.getByRole('combobox', { name: 'Bloque', exact: true }), names.block);
    await selectOptionContaining(dialog.getByRole('combobox', { name: 'Análisis de referencia', exact: true }), names.analysis);
    await dialog.getByLabel('Etapa de crecimiento', { exact: true }).fill('Vegetativo');
    await dialog.getByLabel('Diagnóstico y justificación técnica', { exact: true }).fill('Plan de prueba trazable; requiere revisión técnica real antes de aplicarse en producción.');
    await dialog.getByLabel('Objetivo agronómico', { exact: true }).fill('Verificar creación, aprobación, tarea, aplicación y seguimiento.');
    await dialog.getByLabel('Producto', { exact: true }).fill(names.product);
    await dialog.getByLabel('Composición declarada (N-P-K y otros)', { exact: true }).fill('10-10-10 · dato de prueba');
    await dialog.getByLabel('Dosis definida por el técnico', { exact: true }).fill('10');
    await dialog.getByRole('combobox', { name: 'Unidad de dosis', exact: true }).selectOption('KG_HA');
    await dialog.getByLabel('Cobertura (ha o plantas según unidad de dosis)', { exact: true }).fill('0.5');
    await dialog.getByLabel('Método e instrucciones de aplicación', { exact: true }).fill('Aplicación manual simulada para validación E2E.');
    await dialog.getByLabel('Fecha programada', { exact: true }).fill(yesterday);
    await dialog.getByLabel('Hora programada', { exact: true }).fill('08:00');
    await ensureOptions(dialog.getByRole('combobox', { name: 'Responsable', exact: true }), 1, 'No hay miembros disponibles para asignar el plan de fertilización.');
    await dialog.getByLabel('Fecha de seguimiento', { exact: true }).fill(now);
    await dialog.getByRole('button', { name: 'Guardar', exact: true }).click();
    await expect(dialog).toHaveCount(0);
    await expect(page.getByRole('row').filter({ hasText: names.product })).toContainText('Pendiente de aprobación');
  });

  await visibleStep(page, 12, 'Aprobar el plan de fertilización', 'La aprobación deja la justificación y habilita la generación de tarea.', async () => {
    const planRow = page.getByRole('row').filter({ hasText: names.product });
    await planRow.getByRole('button', { name: 'Aprobar', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: 'Aprobar plan', exact: true });
    await dialog.getByLabel('Justificación de la decisión', { exact: true }).fill('Aprobación únicamente para comprobar el flujo automatizado.');
    await dialog.getByRole('button', { name: 'Guardar', exact: true }).click();
    await expect(dialog).toHaveCount(0);
    await expect(planRow).toContainText('Aprobado');
  });

  await visibleStep(page, 13, 'Generar la tarea de fertilización', 'El plan aprobado queda listo para registrar una aplicación.', async () => {
    const planRow = page.getByRole('row').filter({ hasText: names.product });
    const saved = page.waitForResponse(response => response.request().method() === 'POST'
      && /^\/api\/v1\/fertilization\/plans\/\d+\/task$/.test(new URL(response.url()).pathname));
    await planRow.getByRole('button', { name: 'Generar tarea', exact: true }).click();
    const response = await saved;
    expect(response.ok(), 'El servidor debe generar la tarea de fertilización.').toBe(true);
    expect((await response.json()).taskId).toBeGreaterThan(0);
    await expect(planRow.getByRole('button', { name: 'Registrar aplicación', exact: true })).toBeVisible();
  });

  await visibleStep(page, 14, 'Registrar la aplicación de fertilizante', 'Se aplicaron 5 kg sobre 0.5 ha y se registró el lote del producto.', async () => {
    const planRow = page.getByRole('row').filter({ hasText: names.product });
    await planRow.getByRole('button', { name: 'Registrar aplicación', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: 'Registrar aplicación', exact: true });
    await dialog.getByLabel('Fecha y hora reales', { exact: true }).fill(`${yesterday}T08:30`);
    await dialog.getByLabel('Cantidad aplicada (kg)', { exact: true }).fill('5');
    await dialog.getByLabel('Cobertura real (ha)', { exact: true }).fill('0.5');
    await dialog.getByLabel('Método real', { exact: true }).fill('Aplicación manual simulada para E2E.');
    await dialog.getByLabel('Lote del producto', { exact: true }).fill(`LOTE-${token}`);
    await dialog.getByLabel('Observaciones de campo', { exact: true }).fill('Aplicación de prueba, sin uso operativo.');
    await dialog.getByRole('button', { name: 'Guardar', exact: true }).click();
    await expect(page.getByRole('dialog', { name: /Aplicación #/ })).toContainText('5 kg');
  });

  await visibleStep(page, 15, 'Registrar seguimiento de fertilización', 'El plan conserva una revisión técnica posterior a la aplicación.', async () => {
    await page.reload();
    await page.getByRole('button', { name: 'Planes', exact: true }).click();
    const planRow = page.getByRole('row').filter({ hasText: names.product });
    await planRow.getByRole('button', { name: 'Registrar seguimiento', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: 'Seguimiento técnico', exact: true });
    await dialog.getByLabel('Observaciones y conclusión técnica', { exact: true }).fill('Seguimiento E2E registrado; no constituye una conclusión agronómica.');
    await dialog.getByRole('button', { name: 'Guardar', exact: true }).click();
    await expect(dialog).toHaveCount(0);
    await expect(planRow).toContainText('1 revisiones');
  });

  await visibleStep(page, 16, 'Crear el ciclo que habilita la cosecha', `Ciclo creado: ${names.cycle}.`, async () => {
    await page.goto('/#planting');
    await page.locator('.planting-reference-heading').getByRole('button', { name: 'Nuevo ciclo', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: 'Nuevo ciclo de cultivo', exact: true });
    await selectOptionContaining(dialog.getByRole('combobox', { name: 'Lote', exact: true }), names.block);
    await ensureOptions(dialog.getByRole('combobox', { name: 'Cultivo', exact: true }), 1, 'No hay cultivos disponibles para crear el ciclo de cosecha.');
    await dialog.getByLabel('Código del ciclo', { exact: true }).fill(names.cycle);
    const plantingDay = localDate();
    await dialog.getByLabel('Inicio de siembra', { exact: true }).fill(plantingDay);
    await dialog.getByLabel('Fin de siembra', { exact: true }).fill(plantingDay);
    await dialog.getByLabel('Fecha estimada de cosecha', { exact: true }).fill(plantingDay);
    await dialog.getByLabel('Notas del ciclo', { exact: true }).fill('Ciclo creado para habilitar el registro de cosecha E2E.');
    await dialog.getByRole('button', { name: 'Crear ciclo', exact: true }).click();
    await expect(dialog).toHaveCount(0);
    await expect(page.getByText(names.cycle, { exact: true }).first()).toBeVisible();
  });

  await visibleStep(page, 17, 'Registrar la cosecha', 'Se creó un registro de producción con rendimiento, calidad, merma y causa.', async () => {
    await page.goto('/#harvest');
    await page.locator('.page-heading').getByRole('button', { name: 'Registrar cosecha', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: 'Registrar cosecha', exact: true });
    await dialog.getByRole('combobox', { name: 'Registrar en', exact: true }).selectOption('block');
    await selectOptionContaining(dialog.getByRole('combobox', { name: 'Campo', exact: true }), names.field);
    await selectOptionContaining(dialog.getByRole('combobox', { name: 'Bloque', exact: true }), names.block);
    await selectOptionContaining(dialog.getByRole('combobox', { name: 'Ciclo de cultivo', exact: true }), names.cycle);
    await dialog.getByLabel('Fecha de cosecha', { exact: true }).fill(localDate());
    await dialog.getByLabel('Área cosechada (ha)', { exact: true }).fill('0.5');
    await dialog.getByLabel('Rendimiento estimado', { exact: true }).fill('500');
    await dialog.getByLabel('Cantidad cosechada', { exact: true }).fill('450');
    await dialog.getByRole('combobox', { name: 'Unidad', exact: true }).selectOption('kg');
    await dialog.getByRole('combobox', { name: 'Calidad o grado', exact: true }).selectOption('A');
    await dialog.getByLabel('Cantidad rechazada o dañada', { exact: true }).fill('50');
    await dialog.getByLabel('Motivo del rechazo', { exact: true }).fill('Merma registrada para validar el formulario E2E.');
    await dialog.getByLabel('Notas de cosecha', { exact: true }).fill('Cosecha de prueba para confirmar trazabilidad del flujo.');
    await dialog.getByRole('button', { name: 'Guardar cosecha', exact: true }).click();
    await expect(dialog).toHaveCount(0);
    const harvestRow = page.getByRole('row').filter({ hasText: names.cycle });
    await expect(harvestRow).toContainText('450 kg');
    await harvestRow.getByRole('button', { name: /Ver cosecha/ }).click();
    const detail = page.getByRole('dialog', { name: 'Detalle de cosecha', exact: true });
    await expect(detail.getByText('450 Kilogramos (kg)', { exact: true })).toBeVisible();
    await expect(detail.getByText('50 Kilogramos (kg)', { exact: true })).toBeVisible();
    await expect(detail.getByText('Grado A', { exact: true })).toBeVisible();
    await detail.locator('.form-actions').getByRole('button', { name: 'Cerrar', exact: true }).click();
  });

  await page.screenshot({ path: testInfo.outputPath(automated ? 'recorrido-qa-final.png' : 'recorrido-manual-final.png'), fullPage: true });
  await checkpoint(
    page,
    18,
    'Recorrido completado',
    automated
      ? 'Consulta la captura y el informe para revisar el recorrido. La base temporal se elimina al terminar.'
      : `Los datos de prueba se conservaron con el prefijo “${prefix}” y el identificador ${token}. Verifica los resultados antes de eliminarlos manualmente.`,
  );
});
