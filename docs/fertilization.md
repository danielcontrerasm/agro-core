# Fertilización: diagnóstico → aprobación → aplicación → seguimiento

Última revisión: **21 de noviembre de 2026**.

La sección **Fertilización** conserva el historial anterior y agrega tres vistas:

- **Análisis**: muestras de suelo o foliares con bloque, fecha, laboratorio,
  referencia, profundidad, coordenadas opcionales y resultados N, P, K, pH,
  materia orgánica, Ca, Mg, S, B y Zn. Cada resultado conserva su unidad y método.
  Los parámetros no medidos permanecen vacíos. Se puede adjuntar un informe PDF
  de hasta 10 MB; la descarga exige acceso a la finca.
- **Planes**: diagnóstico técnico, objetivo, etapa, análisis de referencia,
  inspección sanitaria opcional del mismo bloque, producto y composición,
  dosis, cobertura, método, fecha/hora, responsable y fecha de seguimiento.
  Pueden seleccionar un producto del catálogo, validar su unidad estándar y
  programar una aplicación única, semanal, quincenal o mensual hasta dos años.
  ADMIN/SUPERVISOR registran y aprueban con justificación y control de versión.
  La decisión identifica a quien aprobó; no certifica las credenciales
  profesionales de quien ejecutará la aplicación. No hay edición general de
  análisis o planes; la revisión técnica de un análisis sí se puede actualizar.
  Para corregir datos se registra otro análisis o plan. Un plan único puede
  anularse antes de generar su tarea. Al aprobar un plan recurrente se generan
  sus ocurrencias y tareas de inmediato; después no se anula para preservar su
  trazabilidad.
- **Aplicaciones**: desde un plan aprobado con tarea, el responsable asignado
  o un administrador/supervisor de la finca registra cantidades parciales, fecha
  real, lote de producto, cobertura, método y notas. En planes recurrentes se
  selecciona la ocurrencia concreta; cada ocurrencia conserva su propia cantidad
  aplicada. La aplicación crea un evento agrícola; después se pueden adjuntar
  fotos JPEG/PNG con el módulo existente. En cada ocurrencia, la suma no puede
  superar la cantidad aprobada para esa aplicación.
  La cobertura describe cada pasada y no se suma: dos aplicaciones parciales
  pueden recorrer el mismo bloque. Una aplicación inicia la tarea, pero no la
  completa ni sustituye su revisión habitual.

## Endpoints

La API directa de fertilización usa la base `/api/v1/fertilization` y exige sesión,
pertenencia a la finca y los permisos correspondientes:

| Método | Ruta | Uso |
| --- | --- | --- |
| `GET` | `/fertilization?farmId={id}` | Consulta análisis, planes, aplicaciones y seguimientos de una finca. |
| `POST` | `/fertilization/analyses` | Crea un análisis de suelo o foliar con resultados de nutrientes. |
| `POST` | `/fertilization/analyses/{id}/review` | Registra o actualiza la revisión técnica de un análisis. |
| `POST` | `/fertilization/analyses/{id}/report` | Adjunta el informe de laboratorio en PDF. |
| `GET` | `/fertilization/analyses/{id}/report` | Descarga el informe de laboratorio. |
| `POST` | `/fertilization/plans` | Crea un plan vinculado a un análisis. |
| `POST` | `/fertilization/plans/{id}/approve` | Aprueba un plan con justificación. |
| `POST` | `/fertilization/plans/{id}/cancel` | Anula un plan con justificación. |
| `POST` | `/fertilization/plans/{id}/task` | Genera la tarea o las ocurrencias de campo del plan aprobado. |
| `POST` | `/fertilization/plans/{id}/applications` | Registra una aplicación real, incluso parcial. |
| `POST` | `/fertilization/plans/{id}/followups` | Registra el seguimiento técnico y un análisis posterior opcional. |
| `GET` | `/fertilization/profiles?farmId={id}` | Consulta los perfiles de referencia activos de la finca. |
| `POST` | `/fertilization/profiles` | Crea un perfil por cultivo, variedad, tipo de muestra y rangos de nutrientes. Requiere rol agronómico. |
| `GET` | `/fertilization/products?farmId={id}` | Consulta el catálogo activo de productos fertilizantes de la finca. |
| `POST` | `/fertilization/products` | Crea un producto con código, composición y unidad estándar. Requiere rol agronómico. |

Un plan puede incluir `productId`, `recurrence` (`NONE`, `WEEKLY`, `BIWEEKLY` o
`MONTHLY`) y `recurrenceUntil`. Al aprobar un plan recurrente se crean todas sus
ocurrencias en `fertilization_plan_task`; repetir `POST /plans/{id}/task` es
idempotente. Una aplicación recurrente debe enviar el `taskId` de su ocurrencia.

Endpoints de apoyo:

| Método | Ruta | Uso en nutrición |
| --- | --- | --- |
| `GET` | `/api/v1/analytics/map?farmId={id}` | Devuelve por bloque la última muestra de suelo disponible y sus resultados. |
| `GET` | `/api/v1/analytics/dashboard?farmId={id}` | Incluye cantidades acumuladas de aplicaciones fertilizantes y sus unidades. |
| `GET` | `/api/v1/tasks?farmId={id}` | Lista las tareas generadas desde planes aprobados. |
| `PATCH` | `/api/v1/tasks/{id}` | Actualiza el avance, bloqueo, envío a revisión o finalización de la tarea. |
| `POST` | `/api/v1/photos` | Adjunta fotos de evidencia al evento creado por una aplicación. |
| `GET` | `/api/v1/photos?eventId={id}` | Lista la evidencia de una aplicación. |
| `GET` | `/api/v1/photos/{id}/content` | Consulta o descarga una foto de evidencia. |

## Pantallas

En modo real, estas pantallas consumen los endpoints anteriores; en modo demo,
los datos de fertilización se conservan localmente en el navegador:

- **Fertilización** (`#/fertilization`): módulo principal con las pestañas:
  - **Análisis**: captura N, P, K, pH, materia orgánica, Ca, Mg, S, B y Zn;
    muestra unidades, métodos, laboratorio, muestra, informe e interpretación
    preliminar; permite abrir el detalle y descargar o adjuntar el PDF.
  - **Planes**: crea, consulta, aprueba, anula y convierte planes aprobados en
    tareas; muestra diagnóstico, dosis, cobertura, aplicación acumulada,
    catálogo de productos y frecuencia de aplicación.
  - **Aplicaciones**: registra cantidad, fecha, cobertura, método, lote y notas;
    selecciona la ocurrencia de un plan recurrente, muestra el detalle y permite
    adjuntar fotos de evidencia.
  - **Perfiles y catálogo**: ADMIN, SUPERVISOR y AGRONOMIST pueden crear perfiles
    activos por finca, cultivo, variedad y muestra, y registrar una decisión técnica
    confirmada, pendiente de seguimiento o rechazada desde el detalle del análisis;
    también pueden registrar productos con composición y unidad estándar.
- **Mapas → Nutrientes** (`#/maps`): selecciona el nutriente y muestra valores
  por bloque, promedio, fecha de muestra, unidad, método, laboratorio, trazabilidad
  e interpretación preliminar. También permite comparar nutrientes con humedad.
- **Dashboard → Nutrientes** (`#/dashboard`): capa resumida de nutrientes en el
  mapa principal; al seleccionar el mapa se abre la vista completa de Mapas.
- **Mi trabajo de hoy** (`#/tasks`): muestra las tareas de fertilización generadas
  desde planes aprobados y permite avanzar, bloquear, enviar a revisión o completar
  la ejecución según el rol.
- **Reportes y actividad** (`#/reports`): consulta el evento agrícola creado por
  una aplicación y su historial general.

La interpretación que aparece en Análisis y Mapas es provisional: no confirma por
sí sola una deficiencia ni genera recomendaciones, dosis o prescripciones.

## Cálculos y revisión

Solo se convierte la dosis elegida por el técnico a cantidad total:
`kg/ha × ha`, `L/ha × ha`, `g/planta × plantas ÷ 1000` o
`mL/planta × plantas ÷ 1000`. En la vista real de Análisis, el API selecciona el
perfil activo de la finca por cultivo, variedad opcional y tipo de muestra, y luego
busca rangos por nutriente y unidad. No valida que el método del laboratorio sea
compatible con el perfil. La capa de Mapas usa un perfil provisional incorporado
para suelo de banano/plátano, no los perfiles personalizados de la finca; sus
estados pueden diferir del detalle de Análisis. En demo se usa ese mismo perfil
provisional. Todo estado requiere revisión técnica: no confirma una deficiencia
ni calcula requerimientos, mezclas o dosis.
La composición se transcribe como texto de etiqueta; no se estima absorción.
El técnico debe comprobarla con el informe y el contexto del cultivo.

Generar tareas es idempotente: repetir la solicitud no duplica la tarea de una
aplicación única ni las ocurrencias de un plan recurrente. En un plan recurrente,
el total mostrado después de generar tareas es la suma de las cantidades previstas
por ocurrencia, mientras cada aplicación se valida contra su propia tarea.
Las tareas bloqueadas, en revisión o terminadas no admiten más aplicaciones.
El plan muestra programado/aplicado con unidades separadas, vencimiento de revisión
y seguimientos con autor, fecha, conclusión y nuevo análisis opcional. Los filtros
son por bloque; el CSV exporta planes sin mezclar kg con L.

El mapa utiliza **la última muestra de suelo registrada por bloque**, ordenada por
fecha e ID; no exige que incluya todos los nutrientes. Las muestras foliares no
sustituyen al suelo. Si la muestra más reciente no midió un nutriente, se muestra
«Sin dato» en vez de recuperar silenciosamente un valor antiguo. Se muestran
unidades, método, laboratorio, referencia y fecha, y no se promedian muestras
históricas.

En la vista real de **Análisis**, la interpretación del API usa el perfil activo de
la finca compatible con cultivo, variedad opcional, tipo de muestra, nutriente y
unidad; sin perfil o rango compatible muestra «Sin interpretar». No valida la
compatibilidad por método de laboratorio. El API permite listar y crear perfiles
y productos, pero no editarlos ni desactivarlos; para cambiar un perfil se puede
crear otro, que queda priorizado por especificidad y luego por ID descendente. La capa de
**Mapas → Nutrientes** todavía calcula su interpretación en el frontend con un
perfil provisional incorporado para suelo de banano/plátano. Por eso, esa capa no
debe tomarse como interpretación del perfil personalizado de la finca y puede
mostrar un estado distinto al detalle del análisis. En demo se usa el mismo perfil
provisional. En todos los casos los colores del mapa representan valores relativos,
no una deficiencia ni un óptimo agronómico.

Los registros antiguos de monitoreo permanecen conservados, pero al no tener
suficiente trazabilidad analítica no se convierten en muestras certificadas.

## Relación con la cartilla local

Referencia revisada: `cartilla-platano-ICA-final-BAJA.pdf`, sobre manejo
fitosanitario del **plátano**, no una tabla universal de fertilización de banano.
Las páginas PDF 8–9 integran fertilización, riego y drenaje al manejo preventivo;
las páginas 29–30 mencionan fertilización adecuada en el manejo de sigatoka;
la página 35 relaciona picudos secundarios con desequilibrios nutricionales
(incluidos K y B); la página 39 advierte que algunos síntomas radicales pueden
parecer deficiencias nutricionales y requieren diagnóstico de laboratorio.
Esto motiva conservar contexto sanitario y revisión técnica, no inferir
deficiencias ni recomendar dosis o tratamientos a partir de una plaga.
Las asociaciones se documentan, no se presentan como causalidad demostrada.

## Operación y límites

Flyway aplica las migraciones V9, V10, V19 y V21 al reiniciar el backend. Los
registros, PDF e imágenes se guardan en PostgreSQL; deben incluirse en sus copias
de seguridad. Los perfiles de referencia ya son configurables por finca, cultivo,
variedad y tipo de muestra; su contenido debe ser validado por el responsable técnico.
No hay integración automática con laboratorios, inventario o costos,
análisis foliar comparativo ni correlaciones causales con rendimiento o sanidad.
El catálogo no controla existencias ni compras y sus perfiles/productos no se pueden
editar ni desactivar desde la API actual. Todavía no hay validación específica por
método de laboratorio, niveles de confianza ni recomendaciones automáticas de fertilización.
La fecha de seguimiento se muestra en el módulo, no envía notificaciones externas.
Los permisos se verifican en cada endpoint; archivos PDF se entregan como descarga,
no se ejecutan ni se muestran embebidos. No hay escáner antivirus integrado.

En modo demo, muestras con datos distintos para cada nutriente, planes,
aplicaciones e informes se conservan localmente. Los PDF comparten el límite de
almacenamiento del navegador; un error de cuota se comunica sin afirmar guardado.
Las fotos usan IndexedDB. «Restablecer demostración» elimina estos cambios.

Pruebas aisladas: `./gradlew test --tests '*FertilizationApiTest'`.
Navegador: desde `frontend`, `npx playwright test tests/fertilization.spec.ts`.
