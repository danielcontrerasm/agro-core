# Informe de resultados de pruebas de AgroVision

## Laboratorio e historial fitosanitario del 26 de noviembre de 2026

La regresión aprobó **74 pruebas de Gradle**, **30 ejecuciones de Chrome** y
**11 pruebas unitarias del frontend**, sin fallos ni omisiones. Gradle ejecutó
las 21 suites, incluidas siete pruebas de integración con PostGIS. Chrome
ejecutó 15 casos por perfil con datos de demostración y una finca de QA en
PostGIS temporal. En las bases de QA se aplicaron las migraciones V34 y V35.

| Verificación | Aprobadas | Evidencia |
| --- | ---: | --- |
| Gradle con H2 y PostGIS | 74 | [Informe local de Gradle](../frontend/playwright-report/sanidad-laboratorio-e-historial-20261126-113937-d2f0/gradle/index.html) |
| Chrome de escritorio | 15 | [Informe de Playwright](../frontend/playwright-report/sanidad-laboratorio-e-historial-20261126-113937-d2f0/index.html) |
| Chrome móvil | 15 | [Informe de Playwright](../frontend/playwright-report/sanidad-laboratorio-e-historial-20261126-113803-3610/index.html) |
| Pruebas unitarias del frontend | 11 | [Casos de dominio](qa-evidence/test-cases.md#unitarias-del-frontend) |

La compilación de producción completó con un aviso de Vite por el tamaño
del paquete de JavaScript.

Los siete casos nuevos de backend verificaron el vínculo con la inspección,
las fechas y los reintentos de laboratorio, y la edición histórica con
versiones y registro de valores anteriores. Los cuatro casos nuevos de Chrome
pasaron en cada perfil. Los demás casos cubrieron inspecciones, monitoreo,
tratamientos, prevención y fotos. [Casos nuevos](qa-evidence/test-cases.md#laboratorio-y-observaciones-históricas) ·
[Ficha del módulo](pest-disease-management.md#laboratorio-y-observaciones-históricas) ·
[Pantallazos y videos](qa-evidence/README.md#laboratorio-e-historial-fitosanitario)

## Revalidación de Fertilización del 26 de noviembre de 2026

La verificación del módulo aprobó el recorrido grabado de 11 pasos, las 10
ejecuciones de Chrome en escritorio y móvil y las 8 pruebas de API en H2.
El caso conectado con PostGIS comprobó que, al aprobar un plan recurrente,
sus dos tareas se pueden usar de inmediato. Una aplicación parcial mantuvo
el saldo por ocurrencia y registró la salida de inventario y el gasto.
[Desglose por prueba](fertilization.md#revalidación-del-26-de-noviembre-de-2026) ·
[Capturas y video](qa-evidence/README.md#fertilización-ampliada)

A las 10:31 se amplió la verificación de Fertilización a **16 ejecuciones
aprobadas, 0 fallidas y 0 omitidas**. Las seis nuevas cubrieron diagnóstico y
revisión técnica, catálogo y unidades, e informe foliar con Chrome y PostGIS
temporal. [Informe](../frontend/playwright-report/fertilizacion-cobertura-20261126-103132-3c0d/index.html) ·
[Diez pantallazos](qa-evidence/README.md#diagnóstico-catálogo-e-informe-foliar)

A las 10:47 se verificó el flujo de muestra con ubicación y foto, la
reasignación de una tarea pendiente a otro integrante, la foto de la
aplicación y la cobertura por ocurrencia y por bloque. Pasaron **20
ejecuciones de Chrome** en escritorio y móvil y **14 pruebas de API** de
Fertilización y fotos en H2. La integración de Fertilización en PostGIS
aprobó sus dos pruebas, incluida la persistencia de la foto de muestra.
[Informe de Chrome](../frontend/playwright-report/fertilizacion-cobertura-20261126-104728-45e5/index.html) ·
[Capturas y videos](qa-evidence/README.md#ejecución-de-fertilización-por-bloque)

La revalidación del encuadre del mapa pasó en escritorio y móvil. Los 11
pasos del recorrido independiente de demostración también volvieron a pasar.
[Mapa en escritorio y móvil](../frontend/playwright-report/fertilizacion-cobertura-20261126-105142-e955/index.html) ·
[Recorrido independiente](../frontend/playwright-report/qa-modulos-20261126-105037-a49b62/index.html)

## Regresión de sanidad del 26 de noviembre de 2026

**146 ejecuciones aprobadas, 0 fallidas y 0 omitidas** en la regresión iniciada
a las **08:56** de Colombia (UTC−05:00), más el recorrido grabado de sanidad.
Se aplicaron las migraciones V28 y V29 en PostGIS temporal. La compilación de
producción también pasó.

| Verificación | Aprobadas | Evidencia |
| --- | ---: | --- |
| Gradle con H2 y PostGIS | 60 | [Informe de Gradle](../frontend/playwright-report/agro-qa-20261126-085656-001afe3b/gradle/index.html) |
| Unitarias de dominio | 11 | [Casos ejecutados](qa-evidence/test-cases.md#unitarias-del-frontend) |
| Chrome en escritorio y móvil | 74 | [Informe de Playwright](../frontend/playwright-report/agro-qa-20261126-085656-001afe3b/browser/index.html) |
| Recorrido conectado de la finca | 1 | [Informe de Playwright](../frontend/playwright-report/agro-qa-20261126-085656-001afe3b/walkthrough/index.html) |
| Recorrido grabado de sanidad | 1 | [Capturas y video](qa-evidence/README.md#monitoreo-y-tratamientos) |

El backend aprobó los seis casos nuevos de monitoreo, alertas y tratamientos.
Chrome aprobó cuatro ejecuciones nuevas por función, incluyendo escritorio
y móvil en demostración y conectados a PostGIS. Las suites existentes de
inspecciones y fotos también aprobaron. [Ficha del módulo](pest-disease-management.md#funcionalidades-verificadas) ·
[Listado de casos](qa-evidence/test-cases.md)

Una revalidación posterior repitió las ocho pruebas nuevas tras ajustar la
visualización del responsable de la alerta y el control del catálogo activo.
Pasaron las ocho. [Informe de la revalidación](../frontend/playwright-report/sanidad-revalidacion/index.html)

## Regresión anterior del 26 de noviembre de 2026

**132 ejecuciones aprobadas, 0 fallidas y 0 omitidas** sobre una copia fija
del código local con los cambios de Administración. La ejecución empezó a
las **08:21**, hora de Colombia (UTC−05:00), con base en `5cd8583`.
El [listado de casos](qa-evidence/test-cases.md) enlaza los métodos y pruebas
de las suites ejecutadas.

| Verificación | Aprobadas | Evidencia |
| --- | ---: | --- |
| Backend Gradle con H2 y PostGIS | 54 | [Informe de Gradle](../frontend/playwright-report/agro-qa-20261126-082107-c0612773/gradle/index.html) |
| [Unitarias del frontend](../frontend/src/lib/domain.test.ts) | 11 | `npm test` |
| Chrome de escritorio y móvil | 66 | [Informe de Chrome](../frontend/playwright-report/agro-qa-20261126-082107-c0612773/browser/index.html) |
| Recorrido conectado con finca temporal | 1 | [Informe de Playwright](../frontend/playwright-report/agro-qa-20261126-082107-c0612773/walkthrough/index.html) · [Pantallazo final](qa-evidence/2026-11-26/conectado/finca-qa-cosecha.jpg) |

Aprobaron los 33 casos de escritorio y los 33 de móvil, incluida
Administración conectada. También pasó la compilación de producción. El
recorrido de la finca verificó riego, fertilización y cosecha contra PostGIS.
Los 15 recorridos independientes aprobados se registraron en el corte de
las 08:10. [Capturas y videos por módulo](qa-evidence/README.md)

## Verificación del 26 de noviembre de 2026 a las 08:10

Se ejecutó sobre una copia fija del código local a las **08:10**, hora de
Colombia (UTC−05:00), con el commit base `5cd8583` y los cambios de trabajo
presentes al copiarla.

| Verificación | Aprobadas | Fallidas | Omitidas | Evidencia |
| --- | ---: | ---: | ---: | --- |
| Backend con Gradle, H2 y PostGIS | 50 | 2 | 0 | [Informe de Gradle](../frontend/playwright-report/agro-qa-20261126-081104-76cbb5d3/gradle/index.html) |
| [Unitarias de dominio](../frontend/src/lib/domain.test.ts) | 11 | 0 | 0 | `npm test` |
| Chrome de escritorio y móvil | 64 | 2 | 0 | [Informe de navegador](../frontend/playwright-report/agro-qa-20261126-081104-76cbb5d3/browser/index.html) |
| Recorrido conectado con finca temporal | 1 | 0 | 0 | [Informe y capturas](../frontend/playwright-report/agro-qa-20261126-081104-76cbb5d3/walkthrough/index.html) |
| Recorridos independientes por módulo | 15 | 0 | 0 | [Informe, capturas y grabaciones](../frontend/playwright-report/qa-modulos-20261126-081101-35b229/index.html) |

TypeScript y Vite completaron la compilación de producción. El archivo
JavaScript principal quedó en 957,30 kB minificados.

- **API.** Falló un caso de inventario y otro de cuadrillas con
  `EmptyResultDataAccessException`. Los casos de API de Finanzas se añadieron
  después de este corte.
- **Chrome.** Pasaron 32 de 33 casos en escritorio y 32 de 33 en móvil.
  En ambos perfiles, el recorrido de administración creó el producto y
  se detuvo al localizar el selector **Producto** de **Nuevo lote**. Quedaron
  pendientes los movimientos de existencias, los gastos e ingresos, el
  presupuesto, las cuadrillas y la asistencia en esta ejecución.
- **Finca temporal.** El recorrido conectado completó el alta de finca,
  campo, bloque y surco, el registro de riego, la aplicación de fertilizante
  y el registro de cosecha contra PostGIS.
- **Recorridos por módulo.** Pasaron Reportes y Centro agronómico, que habían
  fallado en la ejecución de las 15:51 del día anterior. La configuración
  temporal de ese servidor usó tipografías de respaldo durante parte del
  recorrido. La galería versionada conserva las [grabaciones y capturas
  originales por módulo](qa-evidence/README.md).

Una ejecución previa sobre el árbol de trabajo a las **08:06** registró
5 casos aprobados y 10 fallidos mientras se incorporaban las dependencias
de Administración de finca. El informe de la copia fija es el que permite
comparar los resultados por módulo. [Primer intento del 26 de noviembre](../frontend/playwright-report/qa-modulos-20261126-080638-59d9c8/playwright/index.html)

### Revalidación de Administración de finca

Se actualizó la copia con los cambios de Administración presentes a las
**08:18** y se repitieron las pruebas de los tres módulos, incluyendo la API de
Finanzas añadida después del primer corte.

| Prueba | Aprobadas | Fallidas | Evidencia |
| --- | ---: | ---: | --- |
| [API de Inventario](../src/test/java/com/yourco/agro/InventoryApiTest.java) | 2 | 0 | [Gradle](../frontend/playwright-report/agro-qa-20261126-administracion/gradle/classes/com.yourco.agro.InventoryApiTest.html) |
| [API de Trabajadores](../src/test/java/com/yourco/agro/WorkforceApiTest.java) | 2 | 0 | [Gradle](../frontend/playwright-report/agro-qa-20261126-administracion/gradle/classes/com.yourco.agro.WorkforceApiTest.html) |
| [API de Finanzas](../src/test/java/com/yourco/agro/FinanceApiTest.java) | 2 | 0 | [Gradle](../frontend/playwright-report/agro-qa-20261126-administracion/gradle/classes/com.yourco.agro.FinanceApiTest.html) |
| [Administración conectada en Chrome](../frontend/tests/farm-administration-live.spec.ts) | 2 | 0 | [Playwright](../frontend/playwright-report/agro-qa-20261126-administracion/browser/index.html) · [Pantallazos y videos](qa-evidence/README.md#administración-de-finca) |

En escritorio y móvil se verificaron el saldo de 10 kg tras registrar entradas
y salidas, la persistencia de gastos, ingresos y presupuesto, y la edición de
asistencia a 8 horas para un miembro de la cuadrilla. La grabación usó una copia
del caso automatizado con capturas añadidas.

## Verificación histórica del 25 de noviembre de 2026

La ejecución usó una copia fija de `main` en `2af4d38` con los cambios
locales presentes a las **15:51:30** y finalizó a las **15:58:22**, hora de
Colombia. [Ficha de la ejecución](../frontend/playwright-report/agro-qa-20261125-155129-bcbe583c/ejecucion.json)

| Verificación | Aprobadas | Fallidas | Omitidas | Evidencia |
| --- | ---: | ---: | ---: | --- |
| Backend con Gradle | 48 | 0 | 0 | [Informe de Gradle](../frontend/playwright-report/agro-qa-20261125-155129-bcbe583c/gradle/index.html) |
| Unitarias del frontend | 11 | 0 | 0 | [Salida de npm test](../frontend/playwright-report/agro-qa-20261125-155129-bcbe583c/unitarias-frontend.txt) |
| Suite de Chrome | 55 | 3 | 0 | [Informe de Chrome](../frontend/playwright-report/agro-qa-20261125-155129-bcbe583c/browser/index.html) |
| Recorrido conectado con finca de QA | 0 | 1 | 0 | [Informe del recorrido conectado](../frontend/playwright-report/agro-qa-20261125-155129-bcbe583c/walkthrough/index.html) |
| Recorridos independientes por módulo | 13 | 2 | 0 | [Informe por módulo](../frontend/playwright-report/agro-qa-20261125-155129-bcbe583c/modulos/index.html) |
| **Total de ejecuciones de prueba** | **127** | **6** | **0** | |

En la suite de Chrome pasaron 28 de 29 pruebas en escritorio y 27 de 29
en móvil.

La compilación de producción pasó con TypeScript y Vite. El paquete
JavaScript principal quedó en 916,40 kB minificados, por encima del umbral
de aviso de 500 kB de Vite. [Salida de compilación](../frontend/playwright-report/agro-qa-20261125-155129-bcbe583c/compilacion-frontend.txt)

## Recorridos por módulo del 25 de noviembre

Cada recorrido abre una sesión de demostración independiente en Chrome. La
prueba de Acceso utiliza un servicio de autenticación simulado. Playwright
guardó 47 capturas de pasos aprobados y dos capturas de fallos.
[Todos los pasos y capturas](../frontend/playwright-report/agro-qa-20261125-155129-bcbe583c/modulos/index.html)

| Módulo | Flujo del caso | Resultado | Evidencia |
| --- | --- | --- | --- |
| Acceso | Abrir y cerrar sesión | Aprobado | [Captura](../frontend/playwright-report/agro-qa-20261125-155129-bcbe583c/modulos/data/75968a6a2cc40d4c91a223311325c00bdd22b22c.png) |
| Dashboard | Indicadores, mapa de humedad y acceso al mapa completo | Aprobado | [Captura](../frontend/playwright-report/agro-qa-20261125-155129-bcbe583c/modulos/data/14caa33f3e0aa20f7ef06860bbd7d3d252823a87.png) |
| Mi trabajo de hoy | Ejecutar, enviar a revisión y aprobar una tarea | Aprobado | [Captura](../frontend/playwright-report/agro-qa-20261125-155129-bcbe583c/modulos/data/06bf5d43c0b25290d6e730498c598aa88e6e2d21.png) |
| Campos y bloques | Crear un campo y vincular un bloque | Aprobado | [Captura](../frontend/playwright-report/agro-qa-20261125-155129-bcbe583c/modulos/data/0c1b0c381b0548de5e395ec590a43e0406ba3ea7.png) |
| Mapas | Consultar humedad, comparar capas y revisar el origen del dato de potasio | Aprobado | [Captura](../frontend/playwright-report/agro-qa-20261125-155129-bcbe583c/modulos/data/18c0678a7696f1c940d5908843363ba208396818.png) |
| Surcos y plantas | Filtrar el inventario y guardar un surco | Aprobado | [Captura](../frontend/playwright-report/agro-qa-20261125-155129-bcbe583c/modulos/data/031547030c2595961fd904bd022b8bb2258f08d0.png) |
| Siembra y ciclos | Crear un ciclo, evaluar el lote y registrar material vegetal | Aprobado | [Captura](../frontend/playwright-report/agro-qa-20261125-155129-bcbe583c/modulos/data/4b965030e4844bce2b96ffe1649b0e7d23d95cc4.png) |
| Riego | Medir humedad, programar el riego, registrar la ejecución y comprobar su foto | Aprobado | [Captura](../frontend/playwright-report/agro-qa-20261125-155129-bcbe583c/modulos/data/eebf81d581672200804e7bdcd502338e409336fe.png) |
| Fertilización | Crear y aprobar un plan desde una alerta, registrar una aplicación parcial y comprobar la evidencia | Aprobado | [Captura](../frontend/playwright-report/agro-qa-20261125-155129-bcbe583c/modulos/data/488939db4d5346a139b538fd2d785bb7b6dea0f9.png) |
| Plagas y enfermedades | Calcular incidencia y conservar tratamiento y evidencia | Aprobado | [Captura](../frontend/playwright-report/agro-qa-20261125-155129-bcbe583c/modulos/data/f409526e572af9ee32cd5bd2c463eed816c16999.png) |
| Medidas preventivas | Crear, asignar y completar una medida con su evidencia | Aprobado | [Captura](../frontend/playwright-report/agro-qa-20261125-155129-bcbe583c/modulos/data/a2e097641d5bcf64e0338955cd7b4b9ad2af0f8b.png) |
| Cosecha | Editar un registro y comprobar el dato guardado | Aprobado | [Captura](../frontend/playwright-report/agro-qa-20261125-155129-bcbe583c/modulos/data/de7de726bfbb125fc546e69a5b7ae8643c0bea7e.png) |
| Reportes | Filtrar el historial de actividad y validar el CSV | Fallido | [Captura del fallo](../frontend/playwright-report/agro-qa-20261125-155129-bcbe583c/modulos/data/7c6b1725d8336f3b4feb51c434ee04c3015e4696.png) |
| Centro agronómico | Buscar una guía y abrir el módulo relacionado | Fallido | [Captura del fallo](../frontend/playwright-report/agro-qa-20261125-155129-bcbe583c/modulos/data/b432391e5ff8286a1703875a1d0941dc95d942f8.png) |
| Configuración | Gestionar el catálogo y comprobar permisos simulados | Aprobado | [Captura](../frontend/playwright-report/agro-qa-20261125-155129-bcbe583c/modulos/data/727bd9e5a325f9588272e828ca12f98d4c688ab0.png) |

## Incidencias de la verificación del 25 de noviembre

### Suite de Chrome

- **Alta conectada en escritorio y móvil.** Dos pruebas se detuvieron al
  verificar `R-real`. El identificador apareció en la ficha del surco y
  en la tabla. El selector por texto exigía una coincidencia única.
  [Captura de escritorio](../frontend/playwright-report/agro-qa-20261125-155129-bcbe583c/browser/data/18d36d1d0c07c328d145fac096c273b9523fc86c.png) ·
  [Captura de móvil](../frontend/playwright-report/agro-qa-20261125-155129-bcbe583c/browser/data/976d214669651171d0ac2e8401d8345aa01879b7.png)
- **Inspecciones en móvil.** El caso guardó la inspección y verificó el
  25 % de incidencia tras recargar. En el mapa de salud del cultivo,
  agotó el tiempo de espera del botón **Cerrar capas**. La misma prueba
  pasó en escritorio. [Captura de móvil](../frontend/playwright-report/agro-qa-20261125-155129-bcbe583c/browser/data/62fc0781cde2e66b13c73b8a3104dfcc69227418.png)

### Recorrido conectado

El recorrido creó la cuenta, la finca, el campo y el bloque de QA. Al comprobar
el surco recién guardado, Playwright encontró el mismo identificador en el
encabezado y en la tabla. La comprobación requería una sola coincidencia y
detuvo el recorrido. Quedó pendiente verificar riego, fertilización y cosecha
en esa finca de QA.
[Captura del surco](../frontend/playwright-report/agro-qa-20261125-155129-bcbe583c/walkthrough/data/98d5908489c7b1648ce2c01fd28d81fa80cd2b65.png)

### Recorridos por módulo

- **Reportes.** La prueba esperaba el encabezado **Reportes y actividad**.
  La pantalla mostró **Reportes y analítica**, y el recorrido se detuvo
  antes de aplicar el filtro. La prueba de exportación de CSV filtrado de
  la suite general pasó en escritorio y móvil.
- **Centro agronómico.** La prueba comprobó el encabezado y los accesos a
  los módulos. Se detuvo durante la primera captura porque esperaba un
  contenedor con la clase `.insights-grid`. La búsqueda de la guía y la
  navegación a Fertilización quedaron pendientes en ese recorrido.

## Otras ejecuciones del 25 de noviembre

- **14:07, suite completa y finca QA.** Las 58 pruebas de Chrome y el
  recorrido conectado terminaron sin fallos. [Suite de Chrome](../frontend/playwright-report/agro-qa-20261125-140701-ab730663/browser/index.html) ·
  [Recorrido de la finca QA](../frontend/playwright-report/agro-qa-20261125-140701-ab730663/walkthrough/index.html)
- **15:17–15:26, demostración en vivo.** Los 15 recorridos por módulo pasaron
  en Chrome visible. Playwright guardó 53 capturas en 8 min 51 s.
  [Informe de los recorridos en vivo](../frontend/playwright-report/qa-en-vivo-20261125-151711-493e89/index.html)
- **15:39–15:43, primera revalidación.** Gradle y las unitarias del frontend
  pasaron. La compilación y la carga de la aplicación fallaron por la ausencia
  temporal de `inspections.css`, lo que llevó a interrumpir la suite de Chrome.
  [Error de compilación](../frontend/playwright-report/agro-qa-20261125-153942-7855e95e/compilacion-frontend.txt) ·
  [Informe de Chrome interrumpido](../frontend/playwright-report/agro-qa-20261125-153942-7855e95e/browser/index.html)
- **15:44–15:49, segunda revalidación.** La compilación pasó. Durante la
  ejecución en navegador se modificó el código y Vite registró que no podía
  resolver temporalmente `planting.css`. La suite cerró con 48 aprobadas y 10
  fallidas. El recorrido conectado falló y 13 de 15 recorridos por módulo pasaron.
  [Registro de ejecución](../frontend/playwright-report/agro-qa-20261125-154457-658b14c2/ejecucion.json) ·
  [Salida de Chrome](../frontend/playwright-report/agro-qa-20261125-154457-658b14c2/browser.txt)

## Entorno y evidencias históricas

Las pruebas de backend se ejecutaron con Gradle 8.14 y JDK 17.0.2. Las pruebas
de API usaron H2 y las de integración con PostgreSQL se ejecutaron en un
contenedor temporal de PostGIS 16. El recorrido conectado usó una API local y
una finca de QA desechable. La verificación de navegador utilizó Playwright
1.56.1 y Google Chrome 158.0.8127.89 en segundo plano, con perfiles de
escritorio y móvil para la suite general. Las pruebas unitarias y la
compilación del frontend usaron Node.js 26.13.1.

Los enlaces a informes abren artefactos generados localmente. Las
[capturas y grabaciones por módulo](qa-evidence/README.md) también están
disponibles en el repositorio. Los comandos de reproducción están en la
[guía de pruebas automatizadas](../frontend/tests/manual-agricultural-workflow.md#pruebas-automatizadas-en-chrome).
