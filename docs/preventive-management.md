# Medidas preventivas

La pestaña **Prevención** de Plagas y enfermedades convierte las medidas de monitoreo, saneamiento y manejo en trabajo programado por bloque. Los hallazgos y las intervenciones se documentan en [Manejo de plagas y enfermedades](pest-disease-management.md).

## Requerimientos funcionales y estado

| ID | Requerimiento | Estado y funcionalidad disponible |
| --- | --- | --- |
| PRE-01 | Mantener una biblioteca de medidas reutilizables por finca. | Implementado para el alta. Un rol agronómico puede crear plantillas con código único, nombre, categoría e instrucciones. La API admite desactivación. Falta gestionar cambios y desactivación desde la pantalla. |
| PRE-02 | Programar una medida para un bloque y un responsable. | Parcial. La pantalla registra plantilla, bloque y fecha, y asigna la medida a quien la crea. La API valida que la plantilla y el responsable pertenezcan a la finca. Falta elegir o cambiar el responsable desde la pantalla. |
| PRE-03 | Registrar el progreso y el resultado de cada asignación. | Implementado. Los estados son Programada, En curso y Completada. Completar exige notas y conserva autor y fecha de cierre. La API aplica control de versión y evita reabrir una asignación completada. |
| PRE-04 | Conservar evidencia de ejecución. | Parcial. Se guardan tipo, referencia externa, tipo de contenido, autor y fecha. Falta subir el archivo y consultarlo desde el detalle. |
| PRE-05 | Consultar y exportar el trabajo preventivo. | Implementado. Se muestran indicadores por estado, historial filtrable, detalle con instrucciones y responsables y descarga CSV del conjunto filtrado. |

[Pantalla y flujos de prevención](../frontend/src/pages/PreventiveMeasures.tsx) · [API y permisos](../src/main/java/com/yourco/agro/preventive/PreventiveMeasureService.java)

## Funcionalidades verificadas

| Prueba automatizada | Comprobaciones | Resultado registrado el 25 de noviembre de 2026 |
| --- | --- | --- |
| [Recorrido del módulo](../frontend/qa/modules/prevencion.spec.ts) | Crear una medida con código, nombre e instrucciones. Asignarla al Bloque A, abrir el detalle, completarla con notas y registrar una referencia a una imagen. | 1 de 1 aprobada en Chrome con datos de demostración. |
| [Prevención en navegador](../frontend/tests/preventive.spec.ts) | Crear una plantilla, asignarla por bloque, consultar la asignación, marcarla completada y verificar que aparece la referencia registrada como evidencia. | 2 de 2 aprobadas, una en escritorio y una en móvil. |
| [API de medidas preventivas](../src/test/java/com/yourco/agro/PreventiveMeasureApiTest.java) | Normalizar el código, listar plantillas, crear y asignar una medida, cerrar con autor y filtrar completadas. Asociar evidencia. Rechazar una edición con versión vencida, una plantilla de otra finca, un cierre sin notas y el alta de plantillas por un operario. | 2 de 2 aprobadas. |

[Informe consolidado de resultados](test-results.md) · [Capturas por paso y video del recorrido](qa-evidence/README.md#prevencion)

![Captura de QA · Medida ejecutada con referencia adjunta · 25 nov 2026](<qa-evidence/2026-11-25/prevencion/03.jpg>)

## Funcionalidades pendientes

| ID | Requerimiento pendiente | Criterio de aceptación propuesto |
| --- | --- | --- |
| PRE-06 | Administrar la vigencia de las plantillas desde la interfaz. | Cambiar instrucciones y desactivar plantillas con el rol autorizado. Las asignaciones anteriores deben conservar las instrucciones aplicables a su ejecución. |
| PRE-07 | Asignar y reasignar responsables. | Elegir entre integrantes activos de la finca y registrar quién cambió la asignación, cuándo y a quién. |
| PRE-08 | Planificar medidas recurrentes y dar seguimiento a vencimientos. | Configurar frecuencia, generar asignaciones individuales por fecha y bloque, y mostrar vencimientos y responsables en la planificación operativa. |
| PRE-09 | Incorporar evidencia directamente desde campo. | Permitir subir, abrir y descargar archivos con acceso por finca y conservar autor y fecha. |
| PRE-10 | Relacionar la medida con su resultado fitosanitario. | Enlazar una asignación con inspecciones, hallazgos y tareas, y consultar la secuencia de observación, acción y verificación. |

Queda por verificar la desactivación de plantillas, la vista **En curso**, el filtro y la exportación CSV en navegador, y el recorrido completo con API local.
