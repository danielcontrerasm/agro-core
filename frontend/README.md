# AgroVision frontend

Interfaz en español de Agro Core, construida con React, TypeScript y Vite. El
diseño toma como referencia las imágenes suministradas: tonos verdes, navegación
lateral, tarjetas de información y mapas como centro de la experiencia.

## Inicio rápido

Requiere Node.js 22.18 o superior y npm.

```bash
cd frontend
npm ci
npm run dev
```

Abrir http://127.0.0.1:5173. No se necesita el backend para explorar la demostración.

Para conectar datos reales, iniciar el API según el README principal y seleccionar
**Conectar mi finca**. Primero se puede registrar una cuenta; después, iniciar
sesión y crear una finca o solicitar acceso a su administrador.

El proxy de desarrollo envía `/api` a `http://localhost:8080`. Para otro destino:

```bash
AGRO_API_URL=http://localhost:8081 npm run dev
```

## Pantallas y funciones

| Pantalla | Funciones |
| --- | --- |
| Dashboard | Resumen de área, campos, bloques, plantas estimadas, actividades y acceso al mapa. Indicadores de salud, clima y producción solo en demo. |
| Mi trabajo de hoy | Tareas persistentes por campo o bloque, fecha, miembro responsable, prioridad, instrucciones, notas, bloqueo, ejecución, revisión y aprobación. Vista de tarjetas/lista y filtros. |
| Campos y bloques | **Vista mapa** y **Vista lista**, estructura de la finca, detalle del campo y lista de sus bloques. Formularios con coordenadas JSON, filtros y eliminación con confirmación. En modo real se dibujan las geometrías registradas. |
| Surcos y plantas | Inventario por bloque, longitud, espaciado, plantas estimadas, creación, eliminación y carga incremental de filas en pantalla. |
| Mapas | Bloques seleccionables, zoom, centrado, ampliación y controles de capas. Las vistas de humedad y nutrientes tienen resumen, leyenda, gráficos y tablas de trazabilidad. **Nutrientes** permite consultar N, P, K, pH, materia orgánica, Ca, Mg, S, B y Zn. |
| Siembra y ciclos | Lista de ciclos por lote, información general y seguimiento por ciclo. **Resumen** muestra el bloque, fechas y avance por hitos registrados. **Ver calendario** abre el calendario regional. |
| Riego | **Resumen** con indicadores, mapa y tabla de sectores vinculados por filtros, y alertas por prioridad. El mapa muestra una red ilustrativa en demo y activos con coordenadas en fincas conectadas. **Sectores**, **Programación**, **Ejecuciones**, **Sensores** e **Infraestructura** dan acceso a mediciones, riego recurrente y administración del agua. Un job diario genera las próximas ocurrencias y tareas sin duplicarlas. |
| Fertilización | **Resumen** con mapa de la última muestra de suelo por bloque, alertas nutricionales, avance de planes y aplicaciones recientes. **Análisis**, **Planes** y **Aplicaciones** incluyen indicadores por bloque y acceso a perfiles, productos, aprobación, tareas por ocurrencia, aplicaciones parciales, seguimientos y evidencia. |
| Plagas y enfermedades | Registro de observaciones con síntomas y severidad, historial de eventos y tratamientos. |
| Cosecha | Historial estructurado por campo, bloque o fila y ciclo de cultivo; captura de fecha, área, rendimiento estimado, cantidad cosechada, unidad, calidad, rechazo y motivo; filtros por ciclo y unidad; acciones para ver el detalle y editar registros. |
| Reportes y actividad | Filtros por tipo, bloque y fechas, detalle de evento, exportación CSV, referencias de archivos y eliminación autorizada. |
| Centro agronómico | Orientación de uso y accesos a los registros; sin servicio de IA ni recomendaciones automáticas. |
| Configuración | Perfil, información de finca, creación de otra finca, equipo y asignación/cambio de roles. |
| Acceso | Registro, login, logout, recuperación de sesión y tratamiento de errores de conexión/permisos. |

El inventario completo de endpoints y pantallas de nutrición está en
[docs/fertilization.md](../docs/fertilization.md).

En Fertilización, el técnico define las dosis del plan. Los catálogos de perfiles y
productos admiten altas y consultas. La edición y la desactivación están pendientes.
En Riego se pueden previsualizar y generar ocurrencias, y pausar, reanudar o
cancelar reglas recurrentes.
**Infraestructura** reúne fuentes, calidad, activos, balances, mantenimiento y
verificaciones de sensores. [Guía de Riego](../docs/water-management.md#user-interface)

En modo real, el detalle de Análisis usa el perfil activo configurado para la
finca; la capa **Mapas → Nutrientes** todavía usa un perfil provisional incluido
en el frontend y puede mostrar otra interpretación. La guía de fertilización
explica este límite.

La búsqueda superior filtra el contenido de la vista que la admite: registros,
tareas, comparaciones por bloque y miembros. No es un buscador global del servidor.
Los controles de finca y fecha se muestran en el encabezado de escritorio. En
móvil aparecen sobre el contenido en las vistas que incluyen ese selector. La fecha
seleccionada se usa para la lista de tareas, con pendientes de días anteriores, y
para los indicadores diarios del resumen de Riego.

## Demostración y datos reales

**Demostración:** tiene una franja visible de identificación. Los datos incluyen
una finca, tres campos, cinco bloques, 328 surcos y actividades/tareas de ejemplo.
Las modificaciones se guardan en `localStorage` bajo claves `agrovision.*.v1`.
El rol se puede simular desde Configuración; no altera permisos del servidor.
El flujo de tareas no genera eventos reales ni sincroniza datos.

**Modo real:** usa los endpoints existentes del backend. Los permisos se verifican
en el servidor y la UI oculta las acciones de administración a trabajadores.
Las tareas, sensores, clima, nutrientes, producción estimada e IA no se sustituyen
por valores ficticios en este modo. Los errores del servidor se muestran en pantalla.

En **Mi trabajo de hoy → Nueva tarea**, administradores, supervisores y agrónomos
pueden elegir un campo o bloque y asignar un miembro real de la finca. No es necesario
crear bloques para asignar tareas a los siete campos de Guasita. Los trabajadores
solo consultan y ejecutan sus asignaciones. El flujo es pendiente → en curso →
por revisar → completada; se puede reportar un bloqueo con motivo y retomarlo.
Administradores, supervisores y agrónomos pueden aprobar o devolver tareas en revisión.
Las tareas y notas persisten en PostgreSQL y las actualizaciones simultáneas se
rechazan con un aviso para recargar. La fecha se interpreta según el calendario
del dispositivo; todavía no hay zona horaria configurada por finca.
Completar una tarea no crea un evento agrícola, ni adjunta evidencias. No hay
reprogramación, cancelación o edición de asignaciones en esta primera versión.

Los mapas de demo utilizan una imagen aérea ficticia y polígonos ilustrativos.
La vista real usa Leaflet para colocar los polígonos SRID 4326 de campos y bloques
y las líneas SRID 4326 de los surcos sobre un mapa base. En **Mapas**, **Satélite**
es la vista inicial y usa World Imagery de Esri por defecto. **Plano** usa
OpenStreetMap y **Híbrido** combina ambas fuentes. Para configurar las teselas
satelitales se usan `VITE_MAP_SATELLITE_TILES_URL` y
`VITE_MAP_SATELLITE_ATTRIBUTION`. **Capas del mapa** permite activar o desactivar
campos, bloques y surcos. Las geometrías se pueden seleccionar aunque todavía
no existan observaciones. En **Campos**, **Herramientas** abre los controles de
capas y **Ver bloques del campo** abre la lista correspondiente.
Las geometrías marcadas `[PRUEBA]` se identifican como ficticias en la vista de
mapas. Ver [el plano de prueba de Guasita](../scripts/README.md).

En **Humedad del suelo**, el promedio usa las últimas lecturas que comparten una
unidad. El perfil por profundidad muestra las mediciones del bloque seleccionado.
En **Nutrientes**, la escala agrupa valores observados de muestras comparables y
la trazabilidad conserva el valor, la unidad y la referencia de laboratorio.
**Comparar capas** divide el mapa ilustrativo en demo. En modo real presenta los
dos resúmenes y las dos leyendas junto al plano de la capa activa.

El endpoint de eventos no devuelve los detalles de observación: los síntomas y la
severidad se envían al crear el registro, pero el frontend no inventa esos datos al
consultarlo. Las referencias S3 anteriores se conservan. La sección **Fotos adjuntas**
del detalle de eventos e inspecciones permite elegir JPEG/PNG desde archivos o
cámara, ampliar miniaturas y descargarlas. En inspecciones se pueden asociar a un
tratamiento. Se admiten hasta 10 MB y 24 megapíxeles por foto. Las fotos reales se
guardan en PostgreSQL con sesión y CSRF; las demo se guardan en IndexedDB, persisten
al recargar y se limpian al restablecer la demo. Primero guarda el registro y luego
abre su detalle para adjuntar fotos. No se ofrecen botones de edición para recursos cuyo API
solo admite creación, consulta y eliminación.

La estimación de área utiliza las áreas de campos cuando existen, evitando sumar
también las áreas de sus bloques. Las plantas son estimaciones agregadas por surco.

## Sesión y despliegue

- `api.ts` obtiene el token CSRF antes de una escritura y lo renueva después del
  login. Envía cookies con `credentials: include`.
- Las credenciales y los tokens de autenticación no se guardan en `localStorage`.
  `sessionStorage` conserva únicamente la intención de recuperar una sesión real.
- Las fuentes y la imagen aérea de demostración se incluyen localmente mediante
  Fontsource y `public/images`. El mapa real sí carga teselas externas: OpenStreetMap
  para el mapa base y Esri World Imagery para satélite/híbrido por defecto. Revisa
  atribución y condiciones de uso del proveedor antes de producción; los endpoints
  `VITE_MAP_SATELLITE_TILES_URL` y `VITE_MAP_SATELLITE_ATTRIBUTION` permiten
  configurar las teselas satelitales.
- Para producción, ejecutar `npm run build` y servir `dist/` con un proxy `/api`
  hacia Spring Boot. `AGRO_API_URL` configura el proxy de Vite, no el bundle estático.
- Usar HTTPS, cookies seguras y el frontend/API en el mismo sitio. No publicar
  los valores de base de datos de desarrollo como configuración de producción.
- Las tareas locales no ofrecen sincronización, resolución de conflictos ni
  garantía de persistencia si el navegador elimina sus datos. No es una PWA offline.

## Verificación

Desde la raíz, `python3 scripts/run_qa_tests.py` ejecuta las pruebas de backend y
frontend y el recorrido automatizado de una finca temporal en Chrome. Puedes añadir
`--watch --record` para ver cada acción más despacio y guardar las grabaciones.
[Guía de ejecución](tests/manual-agricultural-workflow.md#pruebas-automatizadas-en-chrome) ·
[Últimos informes y video](tests/manual-agricultural-workflow.md#última-ejecución-completa-verificada)

```bash
npm test
npm run build
npx playwright install chromium
npm run test:e2e
```

Las pruebas unitarias verifican separación por finca, métricas, fecha local,
selección de tareas, transiciones y escape de CSV. Playwright verifica navegación,
mapas, formularios, tareas, permisos de la UI, CSV y el intercambio de login/CSRF
con un API simulado, tanto en escritorio como en móvil.

Para el recorrido contra un API real, usar exclusivamente una base de verificación
aislada: la prueba crea una cuenta, finca, campo, bloque, surco y evento.

```bash
AGRO_LIVE_TEST=1 npm run test:e2e -- --project=desktop --grep 'real server onboarding'
```

El API incluye correcciones de integración para serializar geometrías como
GeoJSON y evitar propiedades internas de proxies Hibernate, mapear el enum de
eventos y los campos JSONB de PostgreSQL, y consultar eventos asociados solo a
bloque o solo a surco con filtros opcionales. Las pruebas del backend cubren ese
recorrido y el registro de observaciones/mapas/referencias de archivos.
Los flujos conectados usan un API con persistencia JPA. Las pruebas de la API
verifican los totales de cosecha del mapa y la consulta de alertas con y sin filtro
de estado. El recorrido de Chrome comprueba la escritura de registros en PostGIS.
[Persistencia JPA](../README.md#jpa-persistence)

También se puede usar Chrome instalado en macOS:

```bash
PLAYWRIGHT_CHROMIUM_EXECUTABLE='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' npm run test:e2e
```

## Organización

```text
src/
  App.tsx                Navegación, sesión, datos y modo demo/real
  context.ts             Estado compartido de la interfaz
  components/            Mapa, formularios, diálogos y gráficos SVG
  lib/                   Cliente API, tipos, datos demo y reglas probadas
  pages/                 Pantallas de cada módulo
  styles.css             Estilos y adaptación responsive
public/images/           Imagen aérea y fotografía ilustrativa de fertilización con sus especificaciones
tests/                   Pruebas de navegador
```
