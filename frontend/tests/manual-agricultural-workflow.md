# Recorrido manual visible de la finca

La prueba `manual-agricultural-workflow.spec.ts` automatiza el recorrido de una
finca existente después de que tú inicies sesión manualmente. Crea datos reales
marcados como prueba, por lo que se debe usar contra una finca aislada de QA o
una copia de la finca, nunca contra información operativa.

## Qué verifica

1. Inicio de sesión manual en una ventana de Chrome visible.
2. Selección explícita de la finca indicada.
3. Campo, lote/bloque y surco.
4. Sector, medición, programación, tarea y ejecución de riego.
5. Análisis, plan, aprobación, tarea, aplicación y seguimiento de fertilización.
6. Ciclo de cultivo y registro estructurado de cosecha.

La aplicación actual no ofrece un **plan de cosecha** separado. El último paso
comprueba el flujo que sí existe: ciclo de cultivo + registro de cosecha con
rendimiento, calidad y merma.

## Requisitos

- API de Agro Core levantada en `http://localhost:8080`.
- Frontend con dependencias instaladas: `cd frontend && npm ci`.
- Chromium disponible para Playwright: `npx playwright install chromium`.
- Un usuario con permisos de administración/supervisión/agronomía en la finca.
- Al menos un cultivo creado en el catálogo de esa finca; se necesita para crear
  el bloque y el ciclo.
- Una finca de pruebas. La prueba **no borra** sus registros para que puedas
  inspeccionar cada resultado.

## Ejecución paso a paso

Desde la carpeta `frontend`, reemplaza el nombre de la finca por el nombre
exacto que aparece en el selector de la aplicación:

```bash
AGRO_MANUAL_E2E=1 \
AGRO_E2E_ALLOW_WRITES=SI \
AGRO_E2E_FARM_NAME='Finca QA' \
PWDEBUG=1 \
npx playwright test tests/manual-agricultural-workflow.spec.ts --project=desktop --workers=1
```

Se abrirán Chrome y Playwright Inspector. Inicia sesión tú mismo; el script se
queda detenido. Después pulsa **Resume** en el Inspector. Tras cada etapa el
script vuelve a detenerse, deja una tarjeta verde en la esquina inferior derecha
de la página y te permite revisar exactamente qué creó antes de continuar.

Para ejecutar el mismo recorrido visible sin detenerlo en cada etapa:

```bash
AGRO_MANUAL_E2E=1 \
AGRO_E2E_ALLOW_WRITES=SI \
AGRO_E2E_FARM_NAME='Finca QA' \
AGRO_E2E_PAUSE_EVERY_STEP=0 \
AGRO_E2E_STEP_DELAY_MS=1200 \
npx playwright test tests/manual-agricultural-workflow.spec.ts --project=desktop --workers=1 --headed
```

## Seguridad y personalización

- `AGRO_E2E_ALLOW_WRITES=SI` es obligatorio para evitar ejecuciones accidentales.
- `AGRO_E2E_FARM_NAME` es obligatorio: la prueba no elige la primera finca por
  defecto.
- Cada registro lleva `E2E-MANUAL` y una marca de fecha/hora. Puedes cambiar el
  prefijo con `AGRO_E2E_PREFIX='QA-REGRESION'`.
- Por defecto las geometrías se crean alrededor de `-74.1, 10.5`. Para ubicarlas
  en un punto de prueba de tu mapa, define `AGRO_E2E_LONGITUDE` y
  `AGRO_E2E_LATITUDE`.
- Al finalizar, Playwright guarda video, trace, capturas y una captura final en
  `frontend/test-results/`. Puedes abrir un trace con
  `npx playwright show-trace test-results/<carpeta>/trace.zip`.
