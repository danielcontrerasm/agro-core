# Operaciones, mapas y reportes

Esta ficha recoge los requisitos funcionales y la cobertura de Dashboard, Mapas, Tareas, Reportes, Centro agronómico, Trabajadores, Inventario y Costos. Los resultados y el alcance de cada ejecución se consultan en [evidencia de QA](qa-evidence/README.md) y [resultados históricos](test-results.md).

## Dashboard

| Requisito funcional | Estado actual |
| --- | --- |
| Resumir la finca activa y permitir alternar la vista general y la operativa. | Disponible. Área y plantas estimadas a partir de campos, bloques y surcos. Indicadores de observaciones sanitarias, cosecha, agua aplicada, tareas y alertas según la vista y las fuentes disponibles. |
| Presentar producción y agua con periodo y unidades explícitos. | Disponible. La producción mensual agrupa por unidad y bloque. El agua aplicada del día distingue volumen medido y estimado. Los orígenes de datos se solicitan por finca. |
| Consultar capas temáticas y saltar a las labores de seguimiento. | Disponible. Salud, humedad, nutrientes, enfermedades y producción desde el tablero. Accesos a Mapas, Tareas, Cosecha, Reportes y Centro agronómico. El registro rápido de actividades requiere un bloque. |
| Mostrar los gastos registrados del mes por categoría. | Implementado en código para administradores en la vista operativa, con acceso al módulo de Costos. |
| Integrar el tiempo meteorológico y las previsiones agronómicas. | Pendiente en el tablero conectado. La vista de demostración contiene ejemplos. Falta definir asimismo la zona horaria operativa de cada finca. |

**Funciones probadas**

- Indicadores de la finca en hectáreas, cambio de capa a humedad conservando la imagen aérea y apertura del mapa completo. Aprobado en el informe del 25 de noviembre. [Prueba por módulo](../frontend/qa/modules/dashboard.spec.ts) · [Capturas y video](qa-evidence/README.md#dashboard)
- Producción mensual separada en kg y racimos, exclusión de registros del mes anterior, agua medida y estimada, gasto de mano de obra del mes, aviso cuando la fuente de alertas falla y ausencia de cifras de demostración en el modo conectado. El caso intercepta las respuestas de la API. [Prueba con API simulada](../frontend/tests/live-dashboard-map.spec.ts)
- Restauración de sesión, carga de tareas de la API simulada y conteo de bloqueos en las notificaciones. Las unitarias verifican el alcance de datos por finca, la suma de área sin duplicados y el cálculo de plantas a partir de surcos. [Playwright](../frontend/tests/app.spec.ts) · [Pruebas unitarias](../frontend/src/lib/domain.test.ts)

## Mapas

| Requisito funcional | Estado actual |
| --- | --- |
| Mostrar el plano y permitir localizar campos, bloques y surcos de la finca activa. | Disponible. Selección, zoom, centrado, consulta de geometría y área. El filtro de planta usa el estimado del surco cuando está disponible. |
| Consultar observaciones sanitarias y distinguir estado y vigencia de la muestra. | Disponible. Colores por hallazgo activo, muestra reciente sin hallazgos y evaluación ausente o vencida. El detalle de observaciones conserva el alcance registrado. |
| Mostrar humedad por sector y nutrientes por bloque con trazabilidad. | Disponible. Humedad con unidad, profundidad, origen y fecha. Muestras de suelo por nutriente con unidad, fecha, método, laboratorio y fundamento de interpretación cuando se encuentra registrado. Comparación de capas de humedad y nutrientes. |
| Mapear infraestructura hidráulica y representar tendencias históricas en la finca conectada. | Parcial. Hay últimas lecturas y muestras disponibles. Faltan la geometría completa de la red, series históricas por sector y visualización de riesgo predictivo. |

**Funciones probadas**

- Seleccionar humedad y consultar el 29 % del Bloque B, acercar el mapa, activar o quitar la comparación, y comprobar unidad y método de extracción del potasio. Aprobado en el informe del 25 de noviembre. [Prueba por módulo](../frontend/qa/modules/mapas.spec.ts) · [Controles y comparación](../frontend/tests/app.spec.ts) · [Capturas y video](qa-evidence/README.md#mapas)
- Mostrar siete polígonos de prueba sin observaciones, calcular 80 ha, abrir una ficha con el teclado, señalar los linderos aproximados y cerrar la ficha al centrar. En modo conectado con API simulada se verifica también la interpretación del nitrógeno, la lectura de 32 kPa, el estado de campos sin datos y el filtro de plantas por surco. [Plano de prueba](../frontend/tests/field-map.spec.ts) · [Tablero y mapas](../frontend/tests/live-dashboard-map.spec.ts)
- Serialización GeoJSON de puntos, líneas y polígonos, capa de observaciones autorizada y distinción de inspección ausente, vencida, activa o resuelta. [Geometría](../src/test/java/com/yourco/agro/GeometryJsonTest.java) · [API agrícola](../src/test/java/com/yourco/agro/AgriculturalApiTest.java) · [API de inspecciones](../src/test/java/com/yourco/agro/InspectionApiTest.java)

Implementación de referencia en [Mapas](../frontend/src/pages/Maps.tsx) y [API de analítica](../src/main/java/com/yourco/agro/analytics/AnalyticsController.java).

## Tareas

| Requisito funcional | Estado actual |
| --- | --- |
| Programar una labor con actividad, fecha, hora, prioridad, instrucciones, un responsable de la finca y un campo o bloque. | Disponible para administrador, supervisor y agrónomo. La API valida la pertenencia del responsable y del lugar. |
| Consultar la jornada por fecha, estado, responsable, bloque y texto de búsqueda. | Disponible. La vista incluye las tareas vencidas que siguen pendientes de ejecución. El trabajador consulta sus propias asignaciones. |
| Iniciar, bloquear, retomar y enviar trabajo a revisión. Aprobar o devolver la revisión según el rol. | Disponible. Se guarda la nota, se exige motivo de bloqueo y se comprueba la versión para prevenir sobrescrituras. |
| Cambiar fecha, responsable o ubicación, asignar a una cuadrilla, cancelar, adjuntar evidencia y consultar el historial de transiciones. | Pendiente. Falta también vincular la aprobación a la actividad agrícola correspondiente, registrar cantidades y tiempos de ejecución estructurados y enviar avisos externos de asignación o vencimiento. |

**Funciones probadas**

- Abrir la ficha de la tarea, iniciar, incorporar notas, enviar a revisión, aprobar y verificar la persistencia tras recargar en demostración. Aprobado en el informe del 25 de noviembre. [Prueba por módulo](../frontend/qa/modules/tareas.spec.ts) · [Capturas y video](qa-evidence/README.md#tareas)
- Alta para un campo, envío de responsable por ID y CSRF, manejo de conflicto de versión, persistencia de notas y permisos que ocultan el alta, la aprobación y la devolución al trabajador. El navegador simula las respuestas de la API. [Playwright en modo conectado](../frontend/tests/live-tasks.spec.ts)
- Persistencia de asignaciones de campo o bloque, aislamiento de tareas por trabajador, rechazo de una transición inválida y de una versión obsoleta, controles de permisos y CSRF, validación de ubicación y pertenencia a la finca. Las unitarias verifican la jornada con vencidas, el uso del calendario local, el bloqueo con motivo y su reanudación. [Tres pruebas de API](../src/test/java/com/yourco/agro/TaskApiTest.java) · [Pruebas unitarias](../frontend/src/lib/domain.test.ts)

## Reportes y analítica

| Requisito funcional | Estado actual |
| --- | --- |
| Consultar eventos de la finca por actividad, bloque, rango de fechas y búsqueda. | Disponible. Lista ordenada por fecha, detalle con autor, ubicación, notas, fotos y referencias de archivos. El resumen mensual y la serie de seis meses se calculan con eventos de campo. |
| Exportar el conjunto filtrado. | Disponible en CSV con actividad, fecha, bloque, surco, autor y notas. El escape de celdas protege los prefijos de fórmula. |
| Comparar plan de riego y volumen aplicado por sector, bloque y periodo. | Disponible. Se distinguen volumen medido y estimado, lluvia y déficit de balances registrados, humedad, varianza y cumplimiento. Tiene exportación de consumo independiente. |
| Consolidar reportes de registros estructurados y ofrecer comparaciones históricas reutilizables. | Pendiente. Falta integrar el historial detallado de cosecha, fertilización y sanidad en un reporte combinado, paginar en servidor y guardar filtros para volver a usarlos. |

**Funciones probadas**

- Elegir el evento de riego, comprobar que queda una fila, descargar el CSV y validar únicamente la fila filtrada y el encabezado. La suite general aprobó el filtrado y la exportación en escritorio y móvil el 25 de noviembre. En el recorrido independiente de las 15:58, el encabezado cambió y la prueba se detuvo antes del filtro. La prueba actual busca **Reportes y analítica**. [Prueba por módulo](../frontend/qa/modules/reportes.spec.ts) · [Suite general](../frontend/tests/app.spec.ts) · [Resultados, capturas y video](qa-evidence/README.md#reportes)
- Reconocer el panel de consumo, aplicar filtro por sector y descargar el CSV. La prueba PostgreSQL verifica la comparación planificado/aplicado, el origen del volumen y los datos del balance. La unitaria comprueba el escape de comillas y de prefijos de fórmula. [Consumo en Playwright](../frontend/tests/irrigation.spec.ts) · [Analítica de riego en PostgreSQL](../src/test/java/com/yourco/agro/IrrigationPostgresTest.java) · [Formato CSV](../frontend/src/lib/domain.test.ts)

## Centro agronómico

| Requisito funcional | Estado actual |
| --- | --- |
| Consultar hallazgos sanitarios activos, humedad fuera de rango y disponibilidad de análisis de suelo por bloque. | Disponible. Se puede actualizar el análisis, alternar capas, seleccionar el bloque y abrir los módulos de seguimiento. |
| Buscar guías y abrir sus módulos de destino. | Disponible para riego, fertilización, sanidad y cosecha. [Guías agronómicas aplicadas](guias-agronomicas-aplicadas.md) |
| Configurar guías por cultivo y gestionar el seguimiento y el cierre de recomendaciones. | Pendiente. Falta un flujo que convierta un hallazgo en una recomendación revisada y un trabajo asignable. |

**Funciones probadas**

- Mostrar las cuatro guías, filtrar por «trazabilidad», comprobar que solo permanecen las coincidencias y navegar a Fertilización. El recorrido histórico grabado aprobó los tres pasos. En la revalidación de las 15:58 se verificaron el encabezado y los accesos y falló el selector de la primera captura. [Prueba por módulo](../frontend/qa/modules/centro-agronomico.spec.ts) · [Resultados, capturas y video](qa-evidence/README.md#centro-agronomico)

La implementación de Reportes y Centro agronómico está en [Operaciones](../frontend/src/pages/Operations.tsx).

## Sensores y alertas

| Requisito funcional | Estado actual |
| --- | --- |
| Registrar sensores y consultar lecturas por dispositivo y periodo. | Disponible por API. Se registran humedad del suelo y del aire y temperatura del suelo y del aire, con fecha de medición. |
| Evaluar reglas por umbral y consultar alertas de la finca. | Disponible por API. Se configura métrica, umbral, comparación, severidad y bloque opcional. La API genera alertas por coincidencia, admite filtrar por estado y permite reconocer una alerta. |
| Conectar dispositivos en campo y administrar reglas y tendencias desde la interfaz. | Pendiente. Falta el ingreso automático de telemetría de equipos externos y la gestión de reglas y lecturas de sensor desde una vista dedicada. |

La prueba crea un sensor y una regla de humedad mínima, ingresa una lectura
inferior al umbral, verifica una alerta abierta y comprueba el filtro por
estado. Pasó en Gradle el 26 de noviembre. Queda por cubrir el reconocimiento
de alertas y la consulta de series por rango de fechas.
[API de telemetría](../src/main/java/com/yourco/agro/telemetry/TelemetryController.java) ·
[Prueba de API agrícola](../src/test/java/com/yourco/agro/AgriculturalApiTest.java) ·
[Resultados](test-results.md)

## Trabajadores y cuadrillas

| Requisito funcional | Estado actual |
| --- | --- |
| Consultar personal, asignaciones de la jornada y distribución de labores. | Hay una vista de demostración y una consulta conectada de miembros para administrador y supervisor, con tareas del día. La vista restringida muestra el perfil propio. |
| Crear y editar cuadrillas con integrantes de la finca, registrar asistencia diaria y horas y controlar el acceso. | Implementado en código. Administrador y supervisor pueden crear y editar cuadrillas y registrar o corregir asistencia. La consulta de los demás roles se limita a su propia cuadrilla y asistencia. [Interfaz](../frontend/src/components/ConnectedWorkers.tsx) · [Controlador](../src/main/java/com/yourco/agro/workforce/WorkforceController.java) · [Migración](../src/main/resources/db/migration/V27__workforce.sql) |
| Asignar labores a cuadrillas y usar la asistencia para reportar jornales. | Pendiente. Las tareas se asignan individualmente. Falta el cierre de asistencia, la liquidación o exportación de jornales y su conexión con el costo real. |

**Funciones cubiertas por pruebas**

- Alta y edición de cuadrilla, unicidad de nombre, pertenencia de los integrantes, prevención de doble asignación, aislamiento por finca y conflicto de versión. Asistencia por persona y fecha, registro de horas, validación de estado, edición, permisos y consulta acotada al trabajador. [Pruebas de API](../src/test/java/com/yourco/agro/WorkforceApiTest.java)
- Crear una cuadrilla con el usuario de QA, registrar 7,5 horas, editar a 8 y comprobar la cuadrilla y las horas tras recargar. [Recorrido con la API local](../frontend/tests/farm-administration-live.spec.ts) · [Resultados](test-results.md) · [Pantallazos y video](qa-evidence/README.md#administración-de-finca)

## Inventario de insumos

| Requisito funcional | Estado actual |
| --- | --- |
| Consultar existencias, disponibilidad, lotes, vencimientos y movimientos. | Implementado en código. La vista conectada muestra existencias por producto, lotes, alertas por mínimo y vencimiento, movimientos paginados y exportación de existencias. |
| Registrar productos, lotes y entradas o salidas con cantidades válidas y responsables. | Implementado en código. Administrador y supervisor pueden crear productos, lotes y movimientos desde la interfaz. La API aplica unicidad de códigos, saldo no negativo y trazabilidad de autor y saldo. Para reintentos de la misma operación usa un identificador de solicitud. [Interfaz](../frontend/src/components/ConnectedInventory.tsx) · [Controlador](../src/main/java/com/yourco/agro/inventory/InventoryController.java) · [Servicio](../src/main/java/com/yourco/agro/inventory/InventoryService.java) · [Migración](../src/main/resources/db/migration/V25__inventory.sql) |
| Vincular la salida de insumos con aplicaciones, registrar costos y gestionar almacenes. | Pendiente. Falta asociar consumos y devoluciones con riego, fertilización o tratamientos, definir traslados por almacén, gestionar ajustes y definir reglas de despacho o retiro para lotes vencidos. |

**Funciones cubiertas por pruebas**

- Normalizar código, registrar lotes vencidos o próximos a vencer, distinguir saldo físico y disponible, alertar por mínimo, aceptar reintentos idénticos, rechazar reutilización con datos distintos y aplicar permisos. La prueba concurrente verifica que dos retiros simultáneos respeten el saldo. [Pruebas de API](../src/test/java/com/yourco/agro/InventoryApiTest.java)
- Crear producto y lote, registrar entrada y salida, recargar para verificar saldo de 10 kg y consultar el lote de la salida en el historial. Queda por verificar en navegador la exportación y paginación. [Recorrido con la API local](../frontend/tests/farm-administration-live.spec.ts) · [Resultados](test-results.md) · [Pantallazos y video](qa-evidence/README.md#administración-de-finca)

## Costos y rentabilidad

| Requisito funcional | Estado actual |
| --- | --- |
| Consultar gastos, ingresos, margen por bloque y ejecución del presupuesto mensual. | Implementado en código para el administrador. La vista conectada muestra el resumen mensual en COP, categorías de gasto, presupuesto y margen por bloque. Exporta los movimientos del mes en CSV. |
| Registrar o corregir gastos e ingresos y guardar un presupuesto mensual. | Implementado en código. Los formularios conectados permiten registrar o corregir movimientos y guardar el presupuesto. La API valida categoría y ubicación, identifica el alta para reintentos y controla la versión en ediciones. [Interfaz](../frontend/src/components/ConnectedCosts.tsx) · [Controlador](../src/main/java/com/yourco/agro/finances/FinanceController.java) · [Migración](../src/main/resources/db/migration/V26__farm_finances.sql) |
| Calcular costo por kg o ha con datos conectados y vincularlo con insumos, jornales y cosecha. | Pendiente. Falta imputar consumos y mano de obra, incorporar cantidades de cosecha y habilitar historial de correcciones y cierre mensual sobre datos de la finca. |

**Funciones cubiertas por pruebas**

- Calcular totales mensuales en COP, excluir movimientos de otro mes, obtener el margen por bloque y el gasto por categoría, crear o actualizar presupuesto, repetir un alta sin duplicados, editar con control de versión y rechazar permisos insuficientes, bloque ajeno y categoría incompatible. [Pruebas de API](../src/test/java/com/yourco/agro/FinanceApiTest.java)
- Registrar un gasto de jornal y un ingreso por venta, definir presupuesto mensual y comprobar ambos movimientos y el presupuesto tras recargar. Queda por verificar la exportación en navegador. [Recorrido con la API local](../frontend/tests/farm-administration-live.spec.ts) · [Resultados](test-results.md) · [Pantallazos y video](qa-evidence/README.md#administración-de-finca)
