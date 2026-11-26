# Cosecha y producción

La pantalla **Cosecha y producción** registra cortes y resultados productivos asociados a su ubicación y ciclo de cultivo. El ciclo se administra en [Gestión del cultivo](crop-management-requirements.md).

![Mockup · Mapa de producción y resumen de calidad](<mockups/13_Cosecha_y_produccion.png>)

## Requerimientos funcionales y estado

| ID | Requerimiento | Estado y funcionalidad disponible |
| --- | --- | --- |
| COS-01 | Registrar una cosecha en el campo, bloque o surco donde ocurrió. | Implementado. La pantalla exige seleccionar un ciclo compatible con la ubicación y registra fecha, cultivo, variedad y área. |
| COS-02 | Registrar producción, calidad y merma de cada corte. | Implementado. Se guardan estimado, cantidad cosechada, unidad, grado de calidad, cantidad rechazada, motivo si hay rechazo y notas. Se admiten `g`, `kg`, `t`, `lb`, `cajas`, `racimos` y `unidades`. |
| COS-03 | Consultar y corregir registros de cosecha. | Implementado. El historial permite abrir el detalle y editar el registro. La API valida ubicación, ciclo, fecha y cantidades y aplica permisos por finca. |
| COS-04 | Filtrar producción y comparar el estimado con el resultado. | Implementado. Se puede filtrar por bloque, ciclo y unidad y buscar por texto. La tabla calcula la variación por registro como `cosechado + rechazado − estimado`. Los totales usan una sola unidad a la vez. |
| COS-05 | Consultar producción por bloque y distribución de calidades. | Implementado. El mapa muestra la cantidad cosechada por bloque para la unidad del resumen. La distribución de calidades cuenta registros por grado. |
| COS-06 | Mostrar próximos cortes programados. | Parcial. La pantalla lista tareas de cosecha próximas y enlaza a **Tareas**. Falta relacionar cada corte realizado con la tarea que lo originó y conciliar estimado, ejecución y entregas. |
| COS-07 | Conservar la trazabilidad histórica. | Parcial. Los registros `HARVEST` admiten correcciones y los eventos históricos `HARVEST_EVENT` siguen disponibles en los flujos de actividad. Falta un historial de correcciones por corte con autor, fecha y motivo. |

[Pantalla y formulario de cosecha](../frontend/src/pages/Operations.tsx) · [API de registros productivos](../src/main/java/com/yourco/agro/monitoring/CropMonitoringRecordController.java) · [Validaciones de producción](../src/main/java/com/yourco/agro/monitoring/CropMonitoringRecordService.java) · [Criterios de las guías agronómicas](guias-agronomicas-aplicadas.md#cosecha-y-producción)

## Funcionalidades verificadas

| Prueba automatizada | Comprobaciones | Resultado registrado |
| --- | --- | --- |
| [Recorrido del módulo](../frontend/qa/modules/cosecha.spec.ts) | Consultar el historial y la columna de rechazo, abrir el detalle con cantidad y notas, editar la cantidad a 1.181 kg y comprobar el dato en el historial y el detalle tras recargar. | 1 de 1 aprobada el 25 de noviembre de 2026, con datos de demostración. |
| [Historial de cosecha en navegador](../frontend/tests/app.spec.ts) | Abrir el detalle desde el historial, editar la cosecha y verificar que el cambio persiste tras recargar. | 2 de 2 aprobadas el 25 de noviembre, en escritorio y móvil. |
| [API agrícola](../src/test/java/com/yourco/agro/AgriculturalApiTest.java) | Crear y consultar registros `HARVEST` a nivel de campo y de surco, filtrar por ciclo y verificar los datos de calidad y rechazo. Editar estimado, área y cantidad y verificar la cantidad y el estimado actualizados en la capa geográfica. | Aprobado el caso que incluye cosecha, en el informe Gradle del 25 de noviembre. |
| [Recorrido con API local](../frontend/tests/manual-agricultural-workflow.spec.ts) | Crear un ciclo y registrar una cosecha de bloque con 450 kg cosechados, 50 kg rechazados y grado A. Verificar los datos en el historial y el detalle. | Aprobado el 25 de noviembre a las 14:07 y el 26 de noviembre. La ejecución del 25 a las 15:51 se detuvo al verificar el surco. |
| [Prueba de recuperación ante error de API](../frontend/tests/live-api.spec.ts) | Simular una respuesta 503, comprobar que la vista muestra el error y deshabilita el registro, y recuperar la pantalla mediante **Reintentar**. | 2 de 2 aprobadas el 26 de noviembre, en escritorio y móvil. |

[Informe consolidado de resultados](test-results.md) · [Capturas por paso y video del recorrido](qa-evidence/README.md#cosecha)

![Captura de QA · Detalle de una cosecha abierta desde el historial · 25 nov 2026](<qa-evidence/2026-11-25/cosecha/02.jpg>)
![Captura de QA · Historial de cosecha en PostGIS de QA · 26 nov 2026](<qa-evidence/2026-11-26/conectado/finca-qa-cosecha.jpg>)

## Funcionalidades pendientes

| ID | Requerimiento pendiente | Criterio de aceptación propuesto |
| --- | --- | --- |
| COS-08 | Identificar racimos y registrar su evolución hasta el corte. | Asignar una identificación por racimo, relacionarla con planta o surco y conservar aparición, cinta, embolse, edad, calibre, fecha prevista y fecha real de corte. |
| COS-09 | Planificar y conciliar cortes. | Relacionar la tarea programada con una o más ejecuciones, responsables, fecha efectiva, cantidades pesadas y diferencias frente al estimado. |
| COS-10 | Clasificar y dar trazabilidad a la producción después del corte. | Registrar lotes de cosecha, cantidades por grado, mermas y motivos, y conservar la relación con el corte de origen hasta el empaque o despacho cuando se use ese flujo. |
| COS-11 | Cerrar un ciclo con su balance productivo. | Consolidar producción, merma, calidad, duración y desviaciones, guardar la decisión de renovación o cierre y preservar los registros originales. |
| COS-12 | Auditar las correcciones y anexar evidencia al corte. | Mostrar usuario, fecha, motivo y cambios de cada edición y permitir adjuntar comprobantes de pesaje o fotos al registro de producción. |

Queda por ampliar la verificación en navegador a registros nuevos en campo y surco, filtros por ciclo y unidad, sumas con unidades distintas y permisos de corrección.
