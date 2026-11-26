# Recorrido visible de la finca

El recorrido se puede ejecutar automáticamente en una finca temporal de QA o
de forma manual en una finca de pruebas existente.

## Pruebas automatizadas en Chrome

Ejecuta [el script de QA](../../scripts/run_qa_tests.py) desde la raíz del repositorio.

```bash
python3 scripts/run_qa_tests.py
```

Necesitas Python 3, JDK 17, Node.js 22.18 o posterior, Docker en ejecución y
Google Chrome instalado. Instala las dependencias del frontend con `npm ci`
desde `frontend` antes de la primera ejecución. En macOS el script busca el
JDK 17 instalado si `JAVA_HOME` apunta a otra versión.

1. El script inicia PostGIS en un contenedor temporal. Las pruebas de integración
   usan esa base y las pruebas aisladas de la API crean sus propios esquemas H2
   a través de JPA.
2. Ejecuta las pruebas unitarias y la compilación del frontend.
3. Levanta una API local y abre Chrome para el recorrido de la finca. Registra
   una cuenta temporal, inicia sesión, crea la finca QA y recorre los flujos de
   campo, bloque, surco, riego, fertilización y cosecha. Una tarjeta indica
   cada paso y el recorrido avanza automáticamente.
4. Ejecuta la suite de Playwright en ventanas visibles de Chrome para
   escritorio y móvil. Incluye el alta real de una cuenta y sus primeros
   registros agrícolas contra la API de QA.

Para leer con más calma cada paso, puedes aumentar la pausa. La pausa
predeterminada es de un segundo.

```bash
python3 scripts/run_qa_tests.py --step-delay-ms 2000
```

### Ver despacio y grabar en Chrome

Para grabar, instala el componente de video de Playwright una vez desde
`frontend` con `npx playwright install ffmpeg`. Desde la raíz, ejecuta:

```bash
python3 scripts/run_qa_tests.py --watch --record
```

`--watch` ralentiza las acciones de Chrome y deja seis segundos para leer
cada paso del recorrido. Usa `--step-delay-ms 12000` si prefieres pausas de
doce segundos. La suite completa tarda más en este modo.

`--record` guarda un video WebM por prueba de navegador, incluidas las
aprobadas. Abre el video adjunto a cada prueba en su informe de Playwright
o busca el archivo en `frontend/test-results/<id>/`. Puedes usar cualquiera
de las dos opciones por separado.

El script usa `postgis/postgis:16-3.7` por defecto. Puedes seleccionar otra
imagen de PostGIS con `--postgis-image`. En la primera ejecución se pueden
descargar la imagen y las dependencias de Gradle.

La API y PostgreSQL usan puertos locales separados de los servicios de
desarrollo. El script detiene la API y elimina el contenedor y sus datos de QA
al finalizar, incluso si falla una prueba. Los informes y las capturas quedan
disponibles para revisar el resultado.

| Resultado | Ubicación |
| --- | --- |
| Pruebas de Gradle | `build/reports/tests/test/index.html` |
| Informes de Playwright | `frontend/playwright-report/<id>/browser/` y `frontend/playwright-report/<id>/walkthrough/` |
| Capturas, grabaciones y log de la API | `frontend/test-results/<id>/` |

La terminal muestra el identificador de la ejecución y el resultado de cada
etapa. El comando devuelve un código distinto de cero si alguna etapa falla.
Para revisar los pasos y las capturas del recorrido, ejecuta desde
`frontend` el comando siguiente con ese identificador.

```bash
npx playwright show-report "playwright-report/ID_DE_EJECUCION/walkthrough"
```

### Última ejecución completa verificada

El [informe de resultados de pruebas](../../docs/test-results.md) reúne el corte
actual, el resultado de cada suite y las evidencias por módulo.

### Validación de la migración a JPA

El 25 de noviembre de 2026, la ejecución `agro-qa-20261125-121059-0d708858`
validó la migración a JPA. Se ejecutó con `--record --step-delay-ms 2400`, Chrome
visible y una API conectada a PostGIS temporal.

| Verificación | Resultado | Informe |
| --- | --- | --- |
| Playwright en Chrome, escritorio y móvil | 58 aprobadas, 0 fallidas, 0 omitidas | [Informe completo de navegador](../playwright-report/agro-qa-20261125-121059-0d708858/browser/index.html) |
| Recorrido automatizado de la finca QA | 1 aprobado, desde el inicio de sesión hasta el registro de cosecha | [Informe del recorrido QA](../playwright-report/agro-qa-20261125-121059-0d708858/walkthrough/index.html) · [Grabación WebM](../../docs/qa-evidence/2026-11-25/conectado/recorrido-finca-qa.webm) |
| Backend con Gradle, PostGIS y H2 | 48 aprobadas, 0 fallidas, 0 omitidas | [Informe de Gradle](../../build/reports/tests/test/index.html) |
| Pruebas unitarias del frontend | 11 aprobadas, 0 fallidas | Salida de `npm test` en la terminal |
| Compilación del frontend | Completada | Salida de `npm run build` en la terminal |

Los enlaces apuntan a archivos generados localmente. Cada ejecución guarda
sus informes de Playwright con un identificador propio. Gradle actualiza su
informe en la misma ruta al volver a ejecutar las pruebas.

La ejecución anterior del mismo día verificó 47 pruebas de backend y 58 en
Chrome. [Informe de navegador anterior](../playwright-report/agro-qa-20261125-102610-d61d9aec/browser/index.html)

### Correcciones verificadas

- **Persistencia JPA.** Las pruebas de backend cubren el registro y la sesión,
  los permisos por finca, las transacciones de riego y fertilización y el
  almacenamiento de evidencias. Se añadieron comprobaciones de los totales de
  cosecha en el mapa y la consulta de alertas con y sin filtro de estado.
- **Campos en móvil.** La vista usa todo el ancho disponible y la barra de
  acciones mantiene visible **Nuevo campo**. En modo conectado el plano usa
  las geometrías almacenadas por el servidor.
- **Mapas.** La brújula deja libre el zoom y el panel lateral de escritorio
  queda debajo de la barra de capas. La ficha del bloque se abre al seleccionar
  un bloque y deja accesibles los controles del plano en móvil. Las pruebas
  comprueban el zoom, la comparación de capas en demo y la selección de bloques.
- **Riego e inspecciones.** Las pruebas usan las entradas actuales de
  **Sectores** e **Infraestructura**, verifican el volumen estimado y la
  duración efectiva en la tabla de ejecuciones, y comprueban que la revisión
  de una inspección cambia el estado que muestra el mapa sanitario.
- **Fotos y CSV.** La prueba de fotos usa una respuesta simulada con el
  formato del informe de consumo de agua y comprueba la carga autenticada y
  la vista previa tras recargar. La prueba de exportación verifica la tabla
  de actividades y que el CSV descargado solo contiene la actividad filtrada.

## Pruebas independientes por módulo

Los scripts de `scripts/qa-modulos/` ejecutan un recorrido en Chrome por cada
módulo. Cada recorrido usa una sesión independiente con datos de demostración.
La prueba de Acceso simula el servicio de autenticación. Playwright verifica el
resultado de cada paso, toma una captura y guarda un WebM del recorrido.

Desde la raíz del repositorio, con las dependencias de `frontend` y el componente
de video de Playwright instalados, ejecuta el módulo que quieras revisar.

```bash
scripts/qa-modulos/riego.sh
scripts/qa-modulos/mapas.sh --pause-ms 15000
```

Chrome abre una ventana visible por defecto. Cada paso tiene una pausa de
12 segundos. `--pause-ms` ajusta esa pausa y `--action-ms` controla la demora
entre acciones de Chrome.

| Módulo | Script | Recorrido |
| --- | --- | --- |
| Dashboard | `dashboard.sh` | Indicadores, mapa de humedad y acceso al mapa completo |
| Mi trabajo de hoy | `tareas.sh` | Ejecutar, enviar a revisión y aprobar una tarea |
| Campos y bloques | `campos.sh` | Crear un campo y vincular un bloque |
| Mapas | `mapas.sh` | Humedad, selección, comparación de capas y trazabilidad de potasio |
| Surcos y plantas | `plantas.sh` | Filtrar el inventario y guardar un surco |
| Siembra y ciclos | `siembra.sh` | Crear un ciclo, evaluar el lote y registrar material vegetal |
| Riego | `riego.sh` | Medir humedad, programar, guardar la ejecución y verificar su foto |
| Fertilización | `fertilizacion.sh` | Crear un plan desde una alerta, aprobarlo y registrar una aplicación parcial con evidencia |
| Plagas y enfermedades | `plagas.sh` | Calcular incidencia y conservar tratamiento y evidencia |
| Medidas preventivas | `prevencion.sh` | Crear, asignar y completar una medida con su referencia de evidencia |
| Cosecha | `cosecha.sh` | Consultar y editar un registro y comprobar el detalle guardado |
| Reportes y actividad | `reportes.sh` | Filtrar la actividad y verificar el CSV descargado |
| Centro agronómico | `centro-agronomico.sh` | Buscar una guía y abrir el módulo relacionado |
| Configuración | `configuracion.sh` | Consultar el perfil, gestionar el catálogo y simular permisos |
| Acceso | `acceso.sh` | Iniciar y cerrar una sesión simulada |

Para grabar todos los módulos en segundo plano, usa el mismo ejecutor con `all`.

```bash
python3 -B scripts/run_module_qa.py all --headless --workers 4 --pause-ms 8000
```

Abre `frontend/playwright-report/qa-modulos-<id>/index.html` para elegir el módulo.
Cada ejecución tiene un directorio propio con `videos/<modulo>.webm`, las capturas
en `capturas/<modulo>/` y el informe técnico en `playwright/index.html`. La terminal
imprime la ruta exacta al terminar. El código de salida indica si los recorridos y
la exportación de sus videos se completaron correctamente.

## Recorrido con inicio de sesión manual

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
- Una sesión `ADMIN` o `SUPERVISOR` de la finca. Este recorrido crea y aprueba
  planes de fertilización, cuyas acciones de gestión requieren uno de esos dos
  roles. `AGRONOMIST` puede configurar perfiles y revisar análisis, pero no puede
  crear ni aprobar esos planes por sí solo.
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

Se abrirán el navegador e Inspector de Playwright. Inicia sesión y pulsa
**Resume** en el Inspector. Tras cada etapa el
script vuelve a detenerse, deja una tarjeta verde en la esquina inferior derecha
de la página y te permite revisar exactamente qué creó antes de continuar.
El recorrido manual usa Chromium por defecto. Para usar Chrome instalado,
consulta la opción `PLAYWRIGHT_CHROMIUM_EXECUTABLE` del [README del frontend](../README.md#verificación).

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
