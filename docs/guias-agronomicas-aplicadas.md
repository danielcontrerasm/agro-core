# Guías agronómicas aplicadas en Agro Core

Fecha de revisión: **21 de noviembre de 2026**.

## Propósito

Este documento registra de dónde surgieron las principales decisiones agronómicas
del proyecto, cómo se tradujeron a funciones del software y qué partes siguen
pendientes. Su objetivo es conservar trazabilidad entre las fuentes técnicas y la
implementación, no reemplazar el criterio de un ingeniero agrónomo ni los protocolos
vigentes de la autoridad sanitaria.

Las páginas citadas son las **páginas del archivo PDF** mostradas por el visor. Pueden
diferir de la numeración impresa dentro del documento.

## Estados utilizados

| Estado | Significado |
| --- | --- |
| **Implementado** | Existe modelo persistente, API y flujo de interfaz para datos reales. |
| **Parcial** | Existe una parte útil, pero falta trazabilidad, especialización o cobertura del proceso. |
| **Planificado** | La fuente ya fue analizada y existe una propuesta concreta, pero todavía no está implementada. |
| **No adoptado** | La recomendación no se convirtió en regla del sistema por seguridad, vigencia, jurisdicción o falta de validación técnica. |

## Jerarquía de las fuentes

Cuando dos documentos difieren, el proyecto aplica este criterio:

1. Para asuntos fitosanitarios en Colombia se priorizan las instrucciones vigentes
   del ICA y las decisiones de un profesional autorizado.
2. Los manuales de banano de otros países se usan para diseñar procesos, registros
   y trazabilidad, pero no para copiar automáticamente obligaciones legales, dosis,
   umbrales o productos.
3. Las guías técnicas regionales sirven como contexto agronómico. Sus valores deben
   configurarse por cultivo, variedad, suelo, clima y sistema productivo.
4. Los artículos divulgativos se usan únicamente como referencia complementaria y
   nunca como fuente normativa ni como motor de prescripción.

## Fuentes revisadas

### 1. Cartilla fitosanitaria del ICA

**Fuente:** [Manejo fitosanitario del cultivo del plátano (Musa spp.) — Medidas para
la temporada invernal](<../cartilla-platano-ICA-final-BAJA.pdf>), ICA, Colombia,
2012.

**Secciones utilizadas:**

- Páginas PDF 8–10: prevención, monitoreo e intervención dentro del MIPE.
- Página PDF 15: historial del lote, material sano, bioseguridad, sospechas de moko,
  seguimiento y confirmación por el ICA.
- Páginas PDF 29–30: prevención y monitoreo de Sigatoka, incluida la necesidad de
  método de evaluación y georreferenciación.
- Páginas PDF 35–38: observación y conteo de picudos antes de decidir una intervención.
- Páginas PDF 39–41: síntomas que pueden confundirse con deficiencias nutricionales y
  necesidad de análisis de raíz y suelo para nematodos.
- Página PDF 46: formato con fecha, plantas monitoreadas, plantas afectadas,
  incidencia, severidad y observación.

**Aplicación en el proyecto:**

- **Implementado:** inspecciones estructuradas con ubicación, fecha, muestra,
  plantas afectadas, área afectada en hectáreas, incidencia calculada, severidad,
  método, síntomas y próxima visita.
- **Implementado:** separación entre hallazgo sospechado, confirmado o descartado;
  una observación de campo no se presenta como diagnóstico confirmado.
- **Implementado:** revisiones por ADMIN, SUPERVISOR o AGRONOMIST, seguimientos
  enlazados, tratamientos registrados, evidencias, fotografías y conservación de
  registros anulados. Registrar un tratamiento no implica un flujo de aprobación.
- **Implementado:** catálogo compartido de Sigatoka, moko, Fusarium, bacteriosis,
  picudos y nematodos. Los roles de gestión agronómica pueden crear, editar y
  desactivar problemas; las inspecciones conservan la referencia histórica. El
  catálogo no está particionado por finca.
- **Parcial:** la ubicación llega a bloque y surco; todavía no se almacena el punto o
  polígono exacto de cada foco fitosanitario.
- **Planificado:** resultados de laboratorio, cadena de muestras, zonas de contención
  y registro de notificación a la autoridad.
- **No adoptado:** dosis, mezclas, radios de erradicación y tratamientos descritos en
  la cartilla no se convierten en acciones automáticas. El documento es de 2012 y cada
  intervención debe validarse contra el protocolo actual del ICA.

**Evidencia de implementación:**

- [Migración de inspecciones](../src/main/resources/db/migration/V6__phytosanitary_inspections.sql)
- [Tratamientos y evidencias](../src/main/resources/db/migration/V7__inspection_treatments_and_evidence.sql)
- [Fotografías](../src/main/resources/db/migration/V8__photos.sql)
- [Servicio de inspecciones](../src/main/java/com/yourco/agro/inspections/InspectionService.java)
- [Pantalla de inspecciones](../frontend/src/pages/Inspections.tsx)

### 2. Manual técnico colombiano de cultivo de plátano

**Fuente:** [Manual técnico de cultivo de plátano](<../Manual-tecnico-para-el-cultivo-de-platano.pdf>),
IES CINOC, Colombia, primera edición, febrero de 2025.

**Secciones utilizadas:**

- Páginas PDF 8–11: clima, agua, sombra, viento, topografía, drenaje, suelo e
  historial del terreno.
- Páginas PDF 12–17: selección del material, trazado, densidad, ahoyado y momento
  de siembra.
- Páginas PDF 18–20: manejo inicial, deshije y sucesión madre–hija–nieta.
- Páginas PDF 25–27: fertilización basada en análisis de suelo y etapa del cultivo.
- Páginas PDF 28–42: manejo integrado de enfermedades y plagas.
- Página PDF 43: cosecha según edad del racimo y especificación del mercado.

**Aplicación en el proyecto:**

- **Implementado:** análisis de suelo y foliar, planificación de fertilización por
  etapa, registro de aplicaciones y seguimiento posterior.
- **Implementado en primera fase:** catálogos de cultivo/variedad, ciclos por bloque,
  evaluación y aprobación del sitio, lotes de material vegetal, planes y ejecuciones
  de siembra, controles de establecimiento y observaciones fechadas de etapa.
- **Parcial:** la primera fase no cubre todavía sucesión madre–hija–nieta, fenología
  detallada, seguimiento individual de racimos ni un historial unificado del ciclo.
- **No adoptado:** distancias, densidades, calendarios, cantidades de fertilización y
  tratamientos químicos del manual no son valores predeterminados del sistema.
- **No adoptado:** las menciones a clorpirifos, aldicarb y otros tratamientos no se
  ofrecen como recomendaciones. Requieren validación legal, etiqueta vigente y
  aprobación profesional.

**Evidencia de implementación o base actual:**

- [Flujo de ciclos y siembra](../src/main/java/com/yourco/agro/planting/PlantingController.java)
- [Migración del flujo de ciclos productivos](../src/main/resources/db/migration/V12__planting_cycles_workflow.sql)
- [Migración del flujo de producción y cosecha](../src/main/resources/db/migration/V18__production_records_workflow.sql)
- [Pantalla de cosecha y producción](../frontend/src/pages/Operations.tsx)
- [Auditoría de gestión de cultivos](crop-management-requirements.md)
- [Registros genéricos de cultivo](../src/main/resources/db/migration/V4__crop_monitoring_records.sql)
- [Flujo de fertilización](../src/main/java/com/yourco/agro/fertilization/FertilizationService.java)
- [Guía detallada de fertilización](fertilization.md)

### 3. Manual BPA de banano de Bolivia

**Fuente:** [Manual de Buenas Prácticas Agrícolas (BPA) en el cultivo de banano
(Musa AAA)](<../MANUAL DE BUENAS PRACTICAS EN BANANO BOLIVIA.pdf>), Ministerio de
Desarrollo Rural y Tierras y entidades asociadas, Bolivia.

**Secciones utilizadas:**

- Páginas PDF 18–19: procedencia, calidad y protección del agua de riego.
- Páginas PDF 25–29: flujo productivo, historial del terreno, lotes, drenaje,
  material vegetal, plantación, mortalidad, reposición y manejo de población.
- Páginas PDF 30–31: análisis de suelo, análisis foliar, plan de fertilización y
  documentación de aplicaciones.
- Páginas PDF 32–33: protección del racimo, cinta semanal, edad, calibre y cosecha.
- Páginas PDF 33–36: prevención, observación e intervención dentro del MIP.
- Páginas PDF 47–49: cuaderno de campo y trazabilidad hacia atrás, interna y hacia
  adelante.
- Páginas PDF 58–66: ejemplos de registros de labores, Sigatoka, fertilización,
  plaguicidas, racimos y cosecha.

**Aplicación en el proyecto:**

- **Implementado en riego:** sector, sistema, fuente de agua, área, caudal,
  medición de humedad, profundidad, instrumento, lluvia, condición del drenaje,
  programación, responsable y ejecución real.
- **Implementado en riego:** volumen medido por contador o estimado por caudal,
  duración efectiva, interrupciones y justificación de desviaciones.
- **Implementado en fertilización:** muestra, laboratorio, método, plan aprobado,
  producto, composición, dosis, cobertura, lote del producto, aplicación parcial y
  seguimiento.
- **Implementado en sanidad:** inspección, revisión, tratamiento, seguimiento,
  evidencia y autor de cada registro.
- **Implementado transversalmente:** códigos de finca/campo/bloque/surco, autor,
  fechas, tareas y eventos para conservar el historial de campo.
- **Implementado en siembra:** ciclo por bloque, evaluación/aprobación del sitio,
  lote de material vegetal, plan aprobado, tarea, ejecución y controles de
  establecimiento/supervivencia. Las guías sirven como contexto; sus umbrales y
  densidades no se aplican automáticamente.
- **Implementado en cosecha:** registro estructurado vinculado a campo, bloque o
  surco y ciclo, con fecha, área, rendimiento estimado, cantidad, unidad, calidad,
  rechazo y motivo; se puede consultar y editar.
- **Parcial en ciclo/cosecha:** faltan trazabilidad individual de racimos, edad y
  calibre, sucesión y cierre productivo completo.
- **No adoptado:** el umbral de mortalidad del 1 %, las distancias 2,5 × 2,5 m y
  2,7 × 2,7 m, las cuarentenas y las frecuencias del manual se tratarán como
  parámetros configurables, no como reglas universales.
- **No adoptado:** registros, productos y obligaciones propios de SENASAG no se
  presentan como requisitos legales colombianos.

**Evidencia de implementación:**

- [Migración del flujo de riego](../src/main/resources/db/migration/V11__irrigation_workflow.sql)
- [Migración de agua, infraestructura y mantenimiento](../src/main/resources/db/migration/V13__irrigation_water_and_maintenance.sql)
- [Migración de recurrencias de riego](../src/main/resources/db/migration/V17__irrigation_recurring_schedules.sql)
- [Servicio de riego](../src/main/java/com/yourco/agro/irrigation/IrrigationService.java)
- [Pantalla de riego](../frontend/src/pages/Irrigation.tsx)
- [Guía detallada de gestión del agua](water-management.md)
- [Migración del flujo de fertilización](../src/main/resources/db/migration/V9__fertilization_workflow.sql)
- [Pantalla de fertilización](../frontend/src/pages/Fertilization.tsx)

### 4. Guía Banano y Biodiversidad

**Fuente:** [Recomendaciones para mejorar la protección de la biodiversidad en los
cultivos de banano](<../Guía Banano y Biodiversidad 26 11 2024.pdf>), Global Nature
Fund, GIZ, Fundación Humedales, ANDI, Uniban y Fundación Uniban, estado octubre de
2024.

**Secciones utilizadas:**

- Páginas PDF 9–11: línea base, plan de acción, indicadores y mapa de áreas
  productivas, no productivas, linderos, árboles, hábitats y corredores.
- Páginas PDF 14–15: protección de ecosistemas acuáticos, zonas de amortiguación e
  inspección de especies invasoras.
- Páginas PDF 21–25: análisis de suelo, documentación de nutrientes, cobertura,
  erosión, compactación y plan de fertilización.
- Páginas PDF 26–31: MIP, monitoreo, medidas preventivas, material certificado y
  documentación de controles y plaguicidas.
- Páginas PDF 34–36: reducción y trazabilidad del uso de agua, permisos, calidad,
  contador o caudal y mapa de infraestructura hídrica.
- Páginas PDF 38–40: clima y agrobiodiversidad.

**Aplicación en el proyecto:**

- **Implementado:** capa de nutrientes basada en la última muestra de suelo por
  bloque, conservando valor, unidad, método, laboratorio y fecha.
- **Implementado con límite:** la capa muestra una interpretación preliminar
  bajo/en rango/alto con el perfil provisional incorporado para suelo de
  banano/plátano; todavía no usa los perfiles personalizados de cada finca. Cada
  estado exige revisión técnica y no se convierte en una dosis. La pantalla de
  análisis real sí usa el perfil activo configurado en el API.
- **Implementado:** capa de humedad por sector con unidad, profundidad, origen,
  vigencia y límites configurados con fundamento técnico.
- **Implementado:** documentación del consumo real o estimado de agua por ejecución.
- **Implementado:** sensores de humedad y temperatura con alertas configurables;
  los umbrales pertenecen a la finca y no se presentan como universales.
- **Parcial:** existen polígonos de campos y bloques y líneas de surcos, pero todavía
  no hay capas de fuentes de agua, válvulas, drenajes, zonas de amortiguación,
  hábitats o corredores.
- **Parcial:** el flujo de siembra registra evaluación de uso anterior, vecinos, suelo,
  pendiente, drenaje, inundación, viento, contaminación, riesgo fitosanitario y
  restricciones ambientales, con decisión técnica. No calcula riesgo ni aplica
  exclusiones geográficas, evaluación de erosión/compactación o línea base de
  biodiversidad.
- **Parcial:** se guardan fuentes y análisis de calidad de agua, activos hidráulicos,
  balances y mantenimiento. Siguen pendientes permisos, descargas y eficiencia
  hídrica por unidad producida.
- **No adoptado:** porcentajes de hábitat, anchos de amortiguación y listas de
  sustancias no se convierten en cumplimiento legal automático; primero deben
  contrastarse con la norma aplicable y la certificación elegida.

**Evidencia de implementación:**

- [Analítica geoespacial](../src/main/java/com/yourco/agro/analytics/AnalyticsService.java)
- [Mapa y capas](../frontend/src/pages/Maps.tsx)
- [Capa de nutrientes](../frontend/src/components/SoilMapPanel.tsx)
- [Capa de humedad](../frontend/src/components/MoistureMapPanel.tsx)
- [Telemetría y alertas](../src/main/java/com/yourco/agro/telemetry/TelemetryService.java)

### 5. Guía divulgativa de plagas y enfermedades 2026

**Fuente:** [Plagas y enfermedades en el cultivo del banano — Guía 2026](<../Plagas y enfermedades en el cultivo del banano _ Guía 2026.pdf>),
Portal Frutícola, 4 de agosto de 2026.

**Secciones consultadas:**

- Páginas PDF 2–7: Sigatoka, Fusarium/TR4, moko, virosis, picudo, nematodos y
  principios de diagnóstico/MIP.
- Páginas PDF 8–10: prevención, material certificado, monitoreo, cuarentena y
  referencias utilizadas por el artículo.

**Aplicación en el proyecto:**

- **Uso complementario:** sirvió para contrastar que el catálogo inicial cubriera
  problemas relevantes y para reforzar la separación entre observación visual y
  confirmación técnica o de laboratorio.
- **Uso complementario:** reforzó el énfasis en detección temprana, material sano,
  bioseguridad y seguimiento.
- **No adoptado como autoridad:** es una captura de un artículo web, no un protocolo
  oficial. No se toman de allí dosis, frecuencias, umbrales, erradicaciones ni reglas
  automáticas. Ante diferencias, prevalece la autoridad fitosanitaria vigente.

## Aplicación por módulo

### Inspecciones, plagas y enfermedades

| Idea técnica | Fuente principal | Aplicación actual | Estado |
| --- | --- | --- | --- |
| Inspección sistemática | ICA pp. 8 y 46; BPA pp. 33–35 | Fecha, bloque/surco, problema, síntomas, muestra y responsable | Implementado |
| Distinguir incidencia y severidad | ICA pp. 8 y 46 | Incidencia calculada con afectadas/inspeccionadas; severidad y método separados | Implementado |
| No confirmar solo por síntomas | ICA pp. 15 y 39–40; Guía 2026 pp. 7–9 | Estado inicial sospechado y revisión confirmada/descartada | Implementado |
| Seguimiento del mismo hallazgo | ICA p. 15; BPA pp. 33–35 | Próxima visita e inspección hija con misma ubicación/problema | Implementado |
| Registrar la intervención sin borrar la observación | ICA pp. 8–10; BPA pp. 47–49 | Tratamientos vinculados, autor, fecha y cantidad/unidad opcionales | Implementado |
| Evidencia de campo | Principio BPA de trazabilidad, pp. 47–49 | Referencias documentales y fotos JPEG/PNG autenticadas | Implementado |
| Visualización territorial | ICA p. 30 | Estado sanitario por bloque y observaciones históricas por surco | Parcial |
| Punto del foco, laboratorio y aviso oficial | ICA pp. 15–16 y 39–40 | Aún no existe cadena de muestra ni trámite con ICA | Planificado |

El sistema deliberadamente no recomienda tratamientos a partir del nombre de una
plaga. Primero registra evidencia; después una persona autorizada revisa y documenta
la decisión.

### Fertilización

| Idea técnica | Fuente principal | Aplicación actual | Estado |
| --- | --- | --- | --- |
| Basar el plan en análisis | Manual técnico pp. 10 y 25; BPA pp. 30–31; Biodiversidad p. 21 | Muestras de suelo/foliares enlazadas al plan | Implementado |
| Conservar método y trazabilidad | Biodiversidad pp. 21 y 25 | Laboratorio, referencia, profundidad, coordenadas, método e informe PDF | Implementado |
| Considerar etapa y contexto sanitario | ICA pp. 8–9, 29–30 y 39; Manual técnico pp. 25–27 | Etapa del cultivo e inspección opcional del mismo bloque | Implementado |
| Separar plan de aplicación real | BPA pp. 47–49 | Aprobación, tarea y aplicaciones parciales con lote y cobertura | Implementado |
| Verificar el resultado | Biodiversidad pp. 21–25 | Fecha de seguimiento, observaciones y nueva muestra opcional | Implementado |
| Balance anual de nutrientes | Biodiversidad pp. 21 y 25 | No existe cálculo entrada/salida ni extracción por cosecha | Planificado |

El sistema solo convierte una dosis aprobada a cantidad total. El perfil base ayuda
a identificar resultados que requieren revisión, pero no confirma deficiencias, no
calcula necesidades del cultivo y no prescribe mezclas. Los detalles completos
están en [la guía del módulo de fertilización](fertilization.md).

### Riego y humedad del suelo

| Idea técnica | Fuente principal | Aplicación actual | Estado |
| --- | --- | --- | --- |
| Identificar sistema, sector y fuente | BPA p. 18; Biodiversidad p. 35 | Sector con bloque, área, sistema, fuente y caudal opcional | Implementado |
| Medir con contexto | ICA pp. 7–9; Manual técnico pp. 9–11 | Valor, unidad, profundidad, instrumento, lluvia y drenaje | Implementado |
| Usar límites técnicamente sustentados | Biodiversidad p. 36 | Rango configurable, fundamento, vigencia y revisiones versionadas | Implementado |
| Planificar y asignar | BPA pp. 47–49 | Fecha/hora, duración, volumen, responsable, justificación e instrucciones | Implementado |
| Documentar agua utilizada | Biodiversidad p. 35 | Contador o caudal estimado, duración efectiva e interrupciones | Implementado |
| Controlar desviaciones | Principio BPA de trazabilidad | Motivo obligatorio cuando se supera duración o volumen programado | Implementado |
| Integrar sensores | Necesidad de monitoreo continuo | Lecturas asociables a sector, alertas por umbral y registros de verificación/calibración | Implementado en registros; falta conector de campo/IoT |
| Calidad, permisos e infraestructura hídrica | BPA pp. 18–19; Biodiversidad pp. 34–36 | Fuentes, análisis de calidad, activos hidráulicos, coordenadas, balances, mantenimiento y verificaciones de sensores | Implementado en registros operativos; permisos y mapa hidráulico completo pendientes |

Los límites de humedad son definidos por el técnico en la unidad del sector
(`% volumétrico`, `% gravimétrico` o `kPa`). El modo demo contiene valores ficticios
y los identifica expresamente como no agronómicos.

### Mapas, sensores y alertas

Actualmente existen estas capas:

1. **Plano de la finca:** campos, bloques y surcos georreferenciados.
2. **Salud del cultivo:** hallazgos activos, evaluación reciente sin hallazgos o falta
   de evaluación reciente. No equivale a certificar todo el bloque.
3. **Humedad del suelo:** condición de cada sector respecto de sus propios límites.
   Cuando un bloque tiene varios sectores no se inventa un promedio.
4. **Nutrientes:** disponibilidad del resultado de cada nutriente en la última muestra
   de suelo. El color no significa deficiencia ni recomendación de dosis.

Los sensores admiten humedad del suelo, humedad del aire, temperatura del aire y
temperatura del suelo. También hay registros de verificación/calibración. Las reglas
de alerta son comparaciones transparentes contra umbrales configurados. No hay un
conector de campo/IoT incluido, modelo predictivo ni recomendación agronómica automática.

Falta incorporar al mapa:

- puntos o polígonos exactos de inspección y focos;
- fuentes de agua, pozos, depósitos, válvulas, canales y drenajes;
- zonas de amortiguación, exclusión, hábitats y corredores;
- lotes de material vegetal, resiembras y estados del ciclo;
- modelos validados de aptitud, riesgo o predicción.

### Siembra y ciclos productivos

#### Situación actual

Además de los registros genéricos `CROP_CYCLE`, existe un flujo especializado con
catálogo de cultivos y variedades, ciclos por bloque, evaluación/aprobación del
sitio, lotes de material vegetal, planes de siembra, ejecuciones, controles de
establecimiento y observaciones fechadas de etapas. Los planes aprobados pueden
generar tareas de campo. El inventario de endpoints y sus límites está en la
[auditoría de gestión de cultivos](crop-management-requirements.md).

La cosecha también tiene un registro `HARVEST` estructurado y asociado al ciclo.
Su captura y corrección son operativas; no debe confundirse con seguimiento por
racimo ni con cierre automático del ciclo.

#### Flujo de referencia y cobertura actual

| Paso | Información y control de referencia | Cobertura actual en Agro Core | Fuente |
| --- | --- | --- | --- |
| 1. Evaluación del sitio | Historial, cultivos previos, vecinos, contaminación, inundación, pendiente, viento, drenaje y restricciones geográficas | La evaluación guarda el uso anterior, vecinos, análisis de suelo opcional, pendiente, drenaje, riesgos de inundación/viento/contaminación/sanidad, restricciones ambientales y notas. No calcula riesgos ni aplica exclusiones geográficas. | BPA pp. 26–27; Manual técnico pp. 10–11; Biodiversidad pp. 11, 14 y 24 |
| 2. Aprobación del terreno | Análisis de suelo vigente, riesgos, medidas requeridas y decisión versionada del responsable técnico | Una evaluación por ciclo puede aprobarse o rechazarse con motivo y control de versión. No se puede reemplazar ni volver a decidir tras la primera decisión. El análisis de suelo es opcional; el API no exige que esté vigente ni comprueba medidas correctivas. | Manual técnico p. 10; Biodiversidad p. 21 |
| 3. Lote de material vegetal | Cultivo, clon/variedad, tipo, proveedor, origen, certificado, cantidad, inspección sanitaria, decisión y documentos/fotos | El lote guarda tipo, proveedor, referencias de origen/certificado, cantidad recibida e inspección sanitaria en texto; aceptación/rechazo guarda cantidades y motivo. No se adjuntan certificados, fotos ni lotes de reposición al lote. | BPA p. 28; Manual técnico pp. 12–14; ICA pp. 15, 36 y 39 |
| 4. Plan de siembra | Geometría, sistema de trazado, distancia, densidad calculada, población objetivo, ventana, área, responsable y justificación | El plan guarda sistema, distancias, densidad/población objetivo, ventana, área, responsable y fundamento técnico. Usa la ubicación existente del bloque/surco, sin geometría propia; el responsable genera la tarea manualmente. | BPA p. 28; Manual técnico pp. 15–17; Biodiversidad pp. 26–27 |
| 5. Ejecución | Fecha y área reales, lote vegetal usado, plantas sembradas/rechazadas, responsables, clima/humedad y evidencia | Guarda fecha, área, plantas sembradas/rechazadas, ubicación detallada y notas; crea un evento agrícola enlazado. Clima, humedad y evidencia no son campos estructurados de la ejecución. | BPA pp. 28 y 47–49 |
| 6. Establecimiento | Plantas vivas, mortalidad, causas, resiembras, lote de reposición, uniformidad y fotos | Los controles guardan plantas revisadas/vivas/muertas/repuestas, uniformidad, causas y notas. Se valida que vivas + muertas no supere revisadas, pero no se exige que las cantidades cuadren. No hay detalle estructurado de resiembra, enlace a lote de reposición ni adjuntos. | BPA p. 28 |
| 7. Fenología | Observaciones fechadas de establecimiento, vegetativo, floración, llenado, cosecha y renovación | El usuario registra manualmente una etapa del catálogo actual (`PLANNED`, `ESTABLISHMENT`, `VEGETATIVE`, `FLOWERING`, `FILLING`, `HARVEST`, `RENEWAL` o `CLOSED`), fecha y notas, y actualiza el historial. No hay mediciones fenológicas detalladas, adjuntos ni tareas disparadas por etapa. | Manual técnico pp. 8–9 y 43; BPA pp. 32–33 |
| 8. Sucesión | Relación madre–hija–nieta, sucesor seleccionado, deshijes y población efectiva | No implementado; no se guardan sucesores ni relaciones de sucesión. | Manual técnico pp. 19–20; BPA p. 29 |
| 9. Racimo | Fecha/semana de aparición, cinta, embolse, edad, calibre y pronóstico revisable de cosecha | No implementado; los registros de cosecha no siguen racimos individuales, edad, cinta ni calibre. | BPA pp. 32–33 |
| 10. Cierre del ciclo | Producción, calidad, pérdidas, duración real, razones de desviación y decisión de renovación | No hay flujo de cierre de ciclo; los registros estructurados de cosecha se conservan de forma independiente. | BPA pp. 33 y 47–49; Manual técnico p. 43 |

#### Reglas de diseño acordadas

- **Diseño objetivo:** las etapas cambian mediante observaciones reales con fecha,
  responsable y evidencia. Hoy se registran fecha, autor y notas, sin adjunto directo
  a la observación de etapa; una proyección nunca reemplazará una fecha real.
- La densidad geométrica puede calcularse, pero debe identificarse como estimación y
  quedar aprobada por el técnico.
- Distancias, densidades, mortalidad aceptable, frecuencias y ventanas serán parámetros
  configurables por protocolo; no se copiarán como constantes de los manuales.
- **Diseño objetivo:** conservar el historial de ciclos anteriores y corregir con
  revisiones o anulaciones justificadas. Hoy no hay rutas generales de edición o
  cancelación de ciclos ni una auditoría unificada; algunas decisiones sí tienen
  autor, fecha, motivo y control de versión.
- El ciclo ya se relaciona con planes/tareas de siembra y con registros de cosecha;
  su integración completa con inspecciones, fertilización, riego, fotos y cambios
  de ciclo todavía no está resuelta.
- Los mapas mostrarán ciclo, edad, lote vegetal, faltantes y resiembras solo cuando
  exista información real; `Sin dato` será distinto de `Sin problema`.

#### Entidades previstas

El alcance implementado en la primera fase usa:

- `crop_cycle`
- `crop_cycle_site_assessment`
- `planting_material_lot`
- `planting_plan`
- `planting_execution`
- `planting_establishment_check`
- `crop_cycle_stage_history`

La siguiente fase agregará:
- `phenology_observation`
- `production_successor`
- `bunch_tracking`

#### Orden de implementación

1. **Implementado con límites:** ciclo productivo y evaluación/aprobación del sitio;
   no se exige una muestra de suelo para aprobar.
2. **Implementado con límites:** lotes de material vegetal y plan de siembra, sin
   adjuntos documentales al lote ni geometría propia del plan.
3. **Implementado en primera fase:** ejecuciones, generación manual de tareas,
   controles de establecimiento y observaciones fechadas de etapa; falta evidencia
   estructurada en ejecución y seguimiento de resiembra.
4. **Siguiente fase:** fenología detallada y sucesión madre–hija–nieta.
5. **Parcial:** cosecha estructurada y vinculada al ciclo; faltan seguimiento del
   racimo y cierre productivo.
6. **Siguiente fase:** capas del mapa, indicadores y alertas específicas de ciclos.

### Cosecha y producción

La pantalla **Cosecha y producción** guarda registros `HARVEST` estructurados y
asociados a un ciclo. Captura ubicación en campo, bloque o surco, fecha, área,
rendimiento estimado, cantidad cosechada, unidad, calidad, cantidad y motivo del
rechazo, y notas. Los registros se pueden consultar y editar; los totales y la
varianza se presentan por unidad seleccionada. Los antiguos eventos `HARVEST_EVENT`
y otros registros genéricos se conservan para compatibilidad histórica.

Sigue pendiente la trazabilidad por racimo —edad, calibre y pronóstico—, la
clasificación vinculada a una ejecución de corte y el cierre del ciclo con pérdidas,
duración y decisión de renovación. Las fuentes principales para esa siguiente fase
son el BPA de Bolivia, páginas PDF 32–33 y 47–49, y el manual técnico colombiano,
página PDF 43.

## Decisiones que el sistema no debe automatizar

1. Confirmar una enfermedad únicamente por una fotografía o un síntoma visual.
2. Recomendar o autorizar plaguicidas, fertilizantes o desinfectantes por coincidencia
   textual con una guía.
3. Copiar dosis, mezclas, frecuencias, radios de erradicación o cuarentenas antiguas o
   de otra jurisdicción.
4. Clasificar un nutriente como deficiente sin unidad, método, muestra y criterio
   técnico aplicable.
5. Usar un rango universal de humedad para todos los suelos, profundidades,
   instrumentos y etapas.
6. Confundir datos de demostración con mediciones reales.
7. Presentar una proyección de etapa, rendimiento o cosecha como observación real.
8. Interpretar ausencia de datos como ausencia de riesgo.

## Cobertura actual resumida

| Módulo | Cobertura frente a las guías |
| --- | --- |
| Inspecciones fitosanitarias | Alta para observación, revisión, seguimiento y evidencia; falta laboratorio, foco exacto y flujo oficial. |
| Fertilización | Alta para trazabilidad análisis → plan → aprobación → aplicación → seguimiento; falta balance nutricional anual. |
| Riego | Alta para sector → medición → programación → ejecución y volumen; ahora incluye calidad, infraestructura, balance y mantenimiento; faltan permisos y mapa hidráulico completo. |
| Mapas | Media: finca, salud, humedad y nutrientes; faltan biodiversidad, agua, drenaje, focos y siembra/ciclos. |
| Sensores y alertas | Media: ingestión, umbrales transparentes y registros de verificación/calibración; falta un conector IoT de campo y recomendaciones validadas. |
| Siembra y ciclos | Media/alta en la primera fase: catálogo, ciclo, lote, evaluación, aprobación, plan, tarea, ejecución, establecimiento y observaciones de etapa; faltan automatización, fenología avanzada, sucesión y auditabilidad unificada. |
| Cosecha | Parcial: registros estructurados editables y vinculados al ciclo, con calidad, rechazo y varianza; faltan trazabilidad por racimo y cierre productivo completo. |

## Mantenimiento de esta guía

Cada cambio agronómico deberá actualizar este archivo indicando:

1. fuente y página;
2. principio adoptado;
3. decisión de producto;
4. migración, API, pantalla y prueba que lo implementan;
5. límites o partes expresamente no adoptadas;
6. cambio de estado: planificado, parcial o implementado.

Una nueva guía no debe modificar automáticamente reglas existentes. Primero debe
compararse con las fuentes actuales, la normativa aplicable y el criterio técnico;
después se versiona el protocolo y finalmente se implementa.
