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
| Campos y bloques | Listas por jerarquía, formularios de creación con coordenadas JSON, filtro por campo y eliminación con confirmación. |
| Surcos y plantas | Inventario por bloque, longitud, espaciado, plantas estimadas, creación, eliminación y carga incremental de filas en pantalla. |
| Mapas | Bloques seleccionables, acercamiento, centrado, pantalla ampliada, controles de capas y comparación. La capa **Nutrientes** permite consultar N, P, K, pH, materia orgánica, Ca, Mg, S, B y Zn por bloque, con trazabilidad e interpretación preliminar. En modo real, representa datos del API. |
| Riego | Sectores, mediciones de humedad, programación y ejecución de riego, consumo de agua, alertas, fuentes, calidad, infraestructura, balances, mantenimiento y verificación de sensores. Las programaciones recurrentes siguen pendientes. |
| Fertilización | Pestañas **Análisis**, **Planes** y **Aplicaciones** para registrar resultados de suelo/foliares, interpretar provisionalmente, aprobar planes, generar tareas, registrar aplicaciones parciales, seguimientos y evidencia; sin prescripción automática. |
| Plagas y enfermedades | Registro de observaciones con síntomas y severidad, historial de eventos y tratamientos. |
| Cosecha | Historial de jornadas y registro de actividades; sin captura estructurada de rendimiento. |
| Reportes y actividad | Filtros por tipo, bloque y fechas, detalle de evento, exportación CSV, referencias de archivos y eliminación autorizada. |
| Centro agronómico | Orientación de uso y accesos a los registros; sin servicio de IA ni recomendaciones automáticas. |
| Configuración | Perfil, información de finca, creación de otra finca, equipo y asignación/cambio de roles. |
| Acceso | Registro, login, logout, recuperación de sesión y tratamiento de errores de conexión/permisos. |

El inventario completo de endpoints y pantallas de nutrición está en
[docs/fertilization.md](../docs/fertilization.md).

La búsqueda superior filtra el contenido de la vista que la admite: registros,
tareas, comparaciones por bloque y miembros. No es un buscador global del servidor.
Los controles de finca y fecha se muestran en el encabezado de escritorio y sobre
el contenido en móvil. La fecha
seleccionada se usa para la lista de tareas, con pendientes de días anteriores.

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

En **Mi trabajo de hoy → Nueva tarea**, administradores y supervisores pueden
elegir un campo o bloque y asignar un miembro real de la finca. No es necesario
crear bloques para asignar tareas a los siete campos de Guasita. Los trabajadores
solo consultan y ejecutan sus asignaciones. El flujo es pendiente → en curso →
por revisar → completada; se puede reportar un bloqueo con motivo y retomarlo.
Solo administradores y supervisores aprueban o devuelven tareas en revisión.
Las tareas y notas persisten en PostgreSQL y las actualizaciones simultáneas se
rechazan con un aviso para recargar. La fecha se interpreta según el calendario
del dispositivo; todavía no hay zona horaria configurada por finca.
Completar una tarea no crea un evento agrícola, ni adjunta evidencias. No hay
reprogramación, cancelación o edición de asignaciones en esta primera versión.

Los mapas de demo utilizan una imagen aérea ficticia y polígonos ilustrativos.
No son cartografía georreferenciada. La vista real representa los polígonos de
campos y bloques y las coordenadas SRID 4326 de los surcos devueltos por
`/map/rows/disease`, sin proveedor de mapa base. Los campos se pueden seleccionar
para consultar su área, aunque todavía no existan surcos u observaciones.
Las geometrías marcadas `[PRUEBA]` se identifican como ficticias en la vista de
mapas. Ver [el plano de prueba de Guasita](../scripts/README.md).

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
- Las fuentes se incluyen como archivos locales mediante Fontsource; la UI no
  necesita Google Fonts ni un proveedor externo de imágenes/mapas en tiempo de uso.
- Para producción, ejecutar `npm run build` y servir `dist/` con un proxy `/api`
  hacia Spring Boot. `AGRO_API_URL` configura el proxy de Vite, no el bundle estático.
- Usar HTTPS, cookies seguras y el frontend/API en el mismo sitio. No publicar
  los valores de base de datos de desarrollo como configuración de producción.
- Las tareas locales no ofrecen sincronización, resolución de conflictos ni
  garantía de persistencia si el navegador elimina sus datos. No es una PWA offline.

## Verificación

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
public/images/           Imagen aérea ilustrativa y su especificación
tests/                   Pruebas de navegador
```
