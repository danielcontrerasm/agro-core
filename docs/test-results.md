# Informe de resultados de pruebas de AgroVision

**25 de noviembre de 2026** · Verificación finalizada a las **15:58:22**,
hora de Colombia (UTC−05:00).

## Resultado de la última verificación

La ejecución usó una copia fija de `main` en `2af4d38` con los cambios
locales presentes a las **15:51:30**. [Ficha de la ejecución](../frontend/playwright-report/agro-qa-20261125-155129-bcbe583c/ejecucion.json)

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

## Recorridos por módulo

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

## Incidencias de la última verificación

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

## Ejecuciones anteriores del mismo día

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

## Entorno y evidencias

Las pruebas de backend se ejecutaron con Gradle 8.14 y JDK 17.0.2. Las pruebas
de API usaron H2 y las de integración con PostgreSQL se ejecutaron en un
contenedor temporal de PostGIS 16. El recorrido conectado usó una API local y
una finca de QA desechable. La verificación de navegador utilizó Playwright
1.56.1 y Google Chrome 158.0.8127.89 en segundo plano, con perfiles de
escritorio y móvil para la suite general. Las pruebas unitarias y la
compilación del frontend usaron Node.js 26.13.1.

Los enlaces a informes y capturas abren los artefactos generados en este
checkout. Los comandos para repetir la ejecución y ver Chrome en vivo están
en la [guía de pruebas automatizadas](../frontend/tests/manual-agricultural-workflow.md#pruebas-automatizadas-en-chrome).
