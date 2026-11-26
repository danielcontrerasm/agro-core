# Módulos de AgroVision

Cada guía reúne los requerimientos del módulo, las funciones disponibles, los
casos automatizados que las verifican y las funciones pendientes. El
[informe de resultados](test-results.md) indica qué pasó en cada ejecución. La
[galería de QA](qa-evidence/README.md) reúne los pantallazos y videos por módulo.
El [listado de casos ejecutados](qa-evidence/test-cases.md) enlaza las pruebas
de las suites de navegador, API y dominio.

| Módulo | Requerimientos, funciones y cobertura |
| --- | --- |
| Acceso a la finca y configuración | [Acceso, roles, equipo y catálogos](access-and-settings.md) |
| Dashboard, mapas, tareas, reportes y alertas de sensores | [Operaciones y reportes](operations-and-reporting.md) |
| Campos, bloques, surcos, plantas, siembra y centro agronómico | [Gestión del cultivo](crop-management-requirements.md) |
| Riego, humedad y gestión del agua | [Gestión del agua](water-management.md) |
| Análisis, planes y aplicaciones de fertilizantes | [Fertilización](fertilization.md) |
| Inspecciones, plagas, enfermedades y tratamientos | [Sanidad vegetal](pest-disease-management.md) |
| Medidas preventivas | [Prevención](preventive-management.md) |
| Cosecha y producción | [Cosecha](harvest-management.md) |
| Trabajadores, inventario y costos | [Administración de finca](operations-and-reporting.md#trabajadores-y-cuadrillas) |
| Requisitos transversales | [Requisitos del sistema](system-requirements.md) |

## Funciones pendientes por área

| Área | Funciones pendientes |
| --- | --- |
| Plagas y enfermedades | Georreferenciar focos, registrar la cadena de custodia de muestras, tramitar avisos, asignar visitas vencidas y comparar la incidencia en el tiempo. |
| Prevención | Programación recurrente, asignaciones a partir de riesgos, verificación de eficacia y alertas de vencimiento. |
| Cosecha | Planificar ventanas y cuadrillas, estimar producción, registrar pesaje y clasificación, seguir lotes o racimos hasta despacho y registrar mermas de poscosecha. |
| Siembra y estructura agrícola | Completar el ciclo de vida de los catálogos, registrar auditoría de cambios de ciclo y ofrecer edición de geometrías. |
| Riego | Conectar telemetría de campo, completar la cartografía hidráulica y validar programación con clima y balance hídrico. |
| Fertilización | Validar rangos por método y contexto, ampliar la trazabilidad de laboratorio y vincular aplicaciones aprobadas con movimientos de existencias y costos. |
| Trabajo, mapas y reportes | Asignar tareas a surco, reprogramar y registrar ejecución estructurada. Ampliar el análisis de tendencias y la exportación por módulo. |
| Acceso y configuración | Recuperar contraseñas, verificar correo, revocar membresías y registrar cambios de permisos. |
| Administración de finca | Integrar existencias, asistencia y costos con sus labores agrícolas, completar la trazabilidad y ampliar la cobertura de exportaciones. |

Los detalles de cada requisito y las brechas de validación están en las guías.
El [manual del proyecto](project-handbook/index.html) reúne las mismas guías
para navegación y búsqueda.
