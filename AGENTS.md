# Agro Core · Reglas para Java

Estas reglas se aplican a los cambios del backend Java y sus pruebas. Para ubicar el módulo y sus contratos, consulta el [índice de documentación](docs/README.md) y la [arquitectura del proyecto](README.md#architecture-diagram).

## Nombres e indentación

- Sigue el vocabulario del módulo y escribe los identificadores nuevos en inglés, como el código existente. Conserva los nombres públicos y los textos del producto cuando formen parte de un contrato.
- Usa `PascalCase` en clases, interfaces, enums y records, `lowerCamelCase` en métodos, variables, campos y parámetros, `UPPER_SNAKE_CASE` en constantes y valores de enum, y minúsculas en paquetes.
- Nombra las clases por su responsabilidad y el concepto de negocio. Usa sufijos como `Controller`, `Service`, `Repository` o `Request` donde correspondan. Prefiere `IrrigationScheduleService` a nombres genéricos como `Manager`, `Helper` o `Utils`.
- Usa paquetes en minúsculas bajo `com.yourco.agro`. Ubica el código en el paquete del módulo dueño del comportamiento, como `irrigation` o `inventory`. Sigue la estructura existente y divide en subpaquetes cuando ayude a navegar el módulo.
- Empieza los métodos con un verbo y nombra su efecto. Usa `findActivePlan` para una búsqueda que admite ausencia, `requireActivePlan` para una que exige un resultado y `approvePlan` para una transición. Usa `calculateAppliedVolume` cuando el método calcule un valor.
- Nombra los booleanos como predicados que se puedan leer en la condición. Usa `isApproved` para estado, `hasAvailableStock` para presencia, `canEdit` para permiso y `shouldNotify` para una decisión. Prefiere nombres afirmativos. Usa `boolean` para dos estados y `Boolean` cuando `null` tenga significado en el contrato.
- Haz explícito qué representa el dato. Prefiere `farmId` a `id` si hay varias entidades, `appliedVolumeM3` a `value` y `recordedAt` a `date` para un instante. Evita abreviaturas ambiguas y nombres genéricos como `data`, `obj` o `process` cuando exista un nombre del dominio.
- Usa `var` en variables locales cuando el inicializador y el nombre hagan evidente el tipo, por ejemplo `var plan = new FertilizationPlan(...)`. Declara el tipo si aporta contexto sobre el resultado de una llamada, los genéricos, una unidad o un tipo numérico. Mantén el alcance de cada variable cerca de su uso.
- Mantén la indentación del archivo. Usa dos espacios, sin tabulaciones, en archivos Java nuevos. Usa llaves en los bloques de control, una instrucción por línea y divide las expresiones largas por unidades de lectura. Limita el formateo al código que cambias.

## Código limpio y lógica simple

- Escribe el flujo principal de arriba abajo. Usa cláusulas de guarda para rechazar entradas inválidas o permisos insuficientes y reducir la anidación.
- Prefiere un bucle, una condición o una consulta sencilla cuando basten. Usa streams, ternarios y encadenamientos cuando sigan siendo fáciles de leer. Da nombre a condiciones complejas y evita decidir la misma regla en varios sitios.
- Pon una regla de negocio en un punto que puedan reutilizar sus consumidores. Reutiliza clases, validaciones y consultas existentes. Extrae un método si nombra una operación, reduce duplicación relevante o aclara una decisión.
- Usa una interfaz cuando represente un contrato que el consumidor necesita, como un repositorio Spring Data, una integración externa o una estrategia con implementaciones intercambiables. Un servicio interno con una sola implementación puede ser una clase concreta. Evita pares `IService` y `ServiceImpl` que solo dupliquen firmas.
- Sobrecarga un método cuando las variantes representen la misma operación y sus llamadas sean inequívocas. Haz que las variantes con valores por defecto deleguen a una implementación común. Usa nombres distintos para comportamientos distintos y evita sobrecargas que vuelvan ambigua una llamada con `null`.
- Haz visibles en el servicio los pasos del caso de uso, como cargar el plan, comprobar permiso y estado, aplicar el cambio y guardar. Evita banderas posicionales como `savePlan(plan, true, false)`. Usa un método con nombre propio o un enum cuando el argumento elija un modo de negocio.
- Añade capas, patrones o dependencias cuando resuelvan una necesidad concreta. Elimina del cambio los métodos, parámetros, imports y estados que queden sin uso.
- Usa comentarios para explicar el motivo de una decisión, una restricción o un caso límite. Deja que el nombre y el código expliquen qué hace la operación.

## Spring y responsabilidades por capa

- Usa Java 17, Spring Boot y el wrapper de Gradle. Organiza el código por módulo de dominio e inyecta dependencias por constructor en campos `final`.
- **Controladores**. Exponen endpoints, reciben parámetros, validan DTOs con `@Valid`, delegan en un servicio y devuelven el estado, las cabeceras y el cuerpo HTTP. Las consultas, las reglas de negocio, la autorización de recursos y las transacciones pertenecen a otras capas.
- **Servicios**. Contienen reglas de negocio y coordinan el caso de uso. Validan permisos mediante `FarmAccess` y comprueban invariantes y transiciones de estado. Trabajan con tipos de dominio o DTOs y delegan la persistencia. Mantén fuera de los servicios el SQL, la construcción de respuestas HTTP y la manipulación de solicitudes o sesiones.
- **Repositorios**. Concentran consultas, escrituras, proyecciones y bloqueos. Devuelven entidades o proyecciones tipadas para que el servicio pueda aplicar las reglas del negocio.
- Coloca `@Transactional` en la operación del servicio que delimita el caso de uso. Usa `readOnly = true` para consultas que requieran transacción. Evita depender de una llamada interna al mismo bean para activar otra transacción mediante el proxy de Spring.

## Persistencia con JPA

- Usa JPA para el acceso a la base de datos. Prefiere repositorios Spring Data JPA, métodos de consulta derivados, JPQL y proyecciones tipadas.
- Si necesitas PostGIS u otra operación específica de PostgreSQL, ejecuta SQL nativo parametrizado mediante un repositorio JPA o el adaptador `JpaSql`, respaldado por `EntityManager`. Mantén la consulta en la capa de persistencia. Conserva el SQL nativo que ya resuelve un requisito concreto al moverlo a esa capa.
- Evita introducir accesos paralelos con JDBC directo, `JdbcTemplate` o `JdbcClient`. Conserva Flyway como mecanismo de evolución del esquema. Para cambiarlo, añade una migración con versión nueva y conserva las migraciones aplicadas.

## Diseño de API REST

- Usa el prefijo versionado `/api/v1`. Nombra las rutas con sustantivos de recursos, colecciones en plural y segmentos en minúsculas con guiones. Anida recursos cuando el padre defina su identidad o su ámbito.
- Usa `GET` para lecturas sin efectos de negocio, `POST` para crear o ejecutar operaciones de negocio, `PUT` para reemplazos idempotentes, `PATCH` para cambios parciales y `DELETE` para eliminar según el contrato. Para transiciones como aprobar o anular, sigue la convención del módulo y define qué pasa si la solicitud se repite.
- En endpoints nuevos, devuelve `201 Created` con `Location` cuando se cree un recurso con URL estable, `200 OK` cuando se devuelva una representación y `204 No Content` para una operación exitosa sin cuerpo. Conserva los estados que ya consumen los clientes.
- Usa DTOs de solicitud y respuesta con tipos explícitos. Prefiere `record` para DTOs inmutables. Evita exponer entidades JPA y respuestas de estructura libre en endpoints nuevos. Documenta campos requeridos, unidades, formatos de fecha y semántica de valores ausentes.
- Expón filtros y paginación mediante parámetros de consulta. Para listas paginadas, usa un límite y un orden estable. Aplica el alcance de la finca antes de consultar, contar o paginar.
- Conserva rutas, nombres de campos y semántica de los endpoints publicados salvo que el cambio de contrato forme parte de la tarea. Actualiza OpenAPI y las pruebas de contrato cuando cambie una API.

## Validación de entradas

- Valida en el servidor todos los datos externos que use el caso de uso, incluidos cuerpo JSON, parámetros de ruta y consulta y archivos. Usa DTOs explícitos y Bean Validation con `@Valid` también en objetos anidados. Define campos requeridos, longitudes, rangos, formatos y tamaños de colecciones según el dominio.
- Distingue campo ausente, `null`, cadena vacía y cero cuando tengan significados distintos. Usa tipos envoltorio como `Long` o `Boolean` cuando debas detectar ausencias. Para actualizaciones parciales, documenta cuándo omitir un campo conserva su valor y cuándo `null` lo borra.
- Normaliza solo cuando el contrato lo permita. Por ejemplo, recorta un código de bloque antes de comprobar su unicidad si esa es la regla del módulo. Rechaza valores inválidos con un mensaje que identifique el campo y la condición esperada. Evita corregir, redondear o sustituir valores silenciosamente.
- Valida en el servicio los cruces entre campos y las reglas que dependen de registros guardados. Comprueba, por ejemplo, que la fecha final sea posterior o igual a la inicial, que la unidad sea compatible y que el surco pertenezca al bloque y a la finca indicados. La validación del cliente complementa la del servidor.
- Cuando el endpoint acepte archivos, limita tamaño y cantidad y verifica el contenido según el formato admitido. Cuando acepte geometrías, valida coordenadas, tipo, validez y SRID conforme al contrato de PostGIS.

## Tipos de datos y entidades JPA

| Dato | Java y PostgreSQL |
| --- | --- |
| Identificadores y conteos | `Long` con `BIGINT` para identificadores numéricos según el esquema. Para conteos enteros, elige `Integer` con `INTEGER` o `Long` con `BIGINT` según el rango. Usa `UUID` con `UUID` cuando el contrato lo requiera. |
| Dinero y medidas decimales exactas | `BigDecimal` con `NUMERIC(precisión, escala)`. Alinea `@Digits` y `@Column(precision = ..., scale = ...)` con el esquema. Define la unidad y aplica redondeo explícito solo cuando lo indique la regla de negocio. |
| Fechas e instantes | `LocalDate` con `DATE` para fechas de negocio. `Instant` u `OffsetDateTime` con `TIMESTAMPTZ` para sucesos. Usa `LocalDateTime` solo cuando el dato represente una hora local sin zona y el contrato especifique cómo interpretarla. |
| Estados y banderas | Usa enums con valores estables y mapeo por nombre con `EnumType.STRING` cuando la columna almacene texto. Usa `boolean` o `Boolean` con `BOOLEAN` según la nulabilidad. |
| Texto y geometrías | Usa `VARCHAR(n)` cuando exista un límite del dominio y alinea `@Size` con `@Column(length = ...)`. Usa `TEXT` para texto libre. En geometrías JTS/PostGIS, alinea el tipo y el SRID del mapeo con la columna. |

- Mantén coherentes la nulabilidad, la longitud, la precisión y las relaciones entre el DTO, el mapeo JPA y la migración. Declara una asociación obligatoria en JPA y en la base cuando el dominio la exija. Si un dato solo es obligatorio en un caso de uso, valida ese caso sin endurecer indebidamente la columna.

## Restricciones y evolución de la base de datos

- Refuerza las invariantes persistentes con `NOT NULL`, `CHECK`, claves foráneas y restricciones `UNIQUE` donde corresponda. Define si la unicidad es global, por finca o por recurso padre. Si la regla depende de varias columnas y vale para toda fila, exprésala con una restricción de tabla.
- Protege la unicidad y la integridad con restricciones de base incluso si el servicio realiza una comprobación previa. Traduce una infracción conocida al error del contrato. Mantén los fallos inesperados como errores de servidor.
- Para endurecer una restricción o cambiar un tipo, comprueba primero que los registros existentes sean compatibles. Si hace falta mover o normalizar datos, hazlo con una migración Flyway y valida el resultado antes de exigir la nueva restricción. Los valores por defecto deben representar una decisión del dominio.

## Manejo de errores y excepciones

- Distingue entradas inválidas, recursos inexistentes, permisos insuficientes, conflictos de estado y fallos inesperados. Conserva el contrato de errores del módulo. Reutiliza su `@RestControllerAdvice`, `ProblemDetail` o `ResponseStatusException` donde ya corresponda.
- Devuelve el estado HTTP que refleje el fallo según el contrato. Usa `400` para entradas inválidas, `401` para falta de autenticación y `409` para conflictos de estado o versión. Para `403` y `404`, conserva el criterio del módulo, incluido el ocultamiento de recursos ajenos.
- Usa excepciones específicas y mensajes claros. Añade una clase de excepción cuando un consumidor necesite distinguir ese fallo. Usa resultados normales, como `Optional` o una colección vacía, cuando la ausencia sea esperada.
- Captura una excepción cuando puedas recuperarte, traducirla al contrato o añadir contexto útil. Conserva la causa original al traducirla. Evita capturas genéricas que silencien errores, devuelvan éxito o puedan impedir el rollback.
- Envía al cliente solo el contexto que pueda usar. Mantén trazas, detalles de SQL, secretos y datos internos en el lado del servidor.

## Inicio de sesión, permisos y logs

- Reutiliza Spring Security y el flujo de sesión existente. Conserva la rotación del identificador de sesión al iniciar sesión, la renovación del token CSRF y la invalidación al cerrar sesión. Mantén la protección CSRF para las operaciones que cambian estado.
- Usa el `PasswordEncoder` configurado para guardar y verificar contraseñas. Da la misma respuesta de credenciales inválidas para una cuenta desconocida y una contraseña incorrecta.
- Obtén la identidad del contexto autenticado. Usa `FarmAccess` para comprobar permisos y pertenencia a la finca, incluidos bloques, lotes y tareas relacionados. Un identificador recibido del cliente sirve para localizar el recurso. El servidor comprueba el permiso.
- Usa SLF4J con parámetros para registrar fallos inesperados y eventos operativos útiles. Registra el fallo una vez en el punto que tenga contexto. Mantén fuera de los logs las contraseñas, tokens, cookies, identificadores de sesión y datos personales innecesarios.

## Datos y contratos

- Conserva los contratos REST, las transiciones de estado y la compatibilidad con los registros ya guardados, salvo los cambios solicitados. Reutiliza las convenciones del módulo para los errores HTTP.
- Mantén juntas las escrituras que deben confirmarse o revertirse como una unidad. Cuando el flujo admite reintentos o cambios simultáneos, conserva el mecanismo de idempotencia, versión o bloqueo que corresponda a la operación.

## Pruebas unitarias y de integración

- Usa JUnit 5 y ubica las pruebas nuevas en `src/test/java`, siguiendo el paquete del código probado y la organización del módulo. Usa `<Clase>Test` para unitarias, `<Modulo>ApiTest` para el contrato HTTP y `<Modulo>PostgresTest` para integración con PostgreSQL/PostGIS, según las convenciones del repositorio.
- Nombra cada caso por la operación, la condición relevante y el resultado observable, por ejemplo `approvePlanRejectsAnAlreadyCanceledPlan`. Organiza el cuerpo en preparación, ejecución y verificación. Usa datos de prueba con nombres del dominio y comprueba el resultado que importa.
- **Unitarias**. Prueba reglas y cálculos instanciando la clase directamente, sin cargar Spring ni conectar una base. Sustituye dependencias externas cuando sea necesario y usa datos y fechas deterministas. Comprueba el comportamiento público. Verifica llamadas a colaboradores cuando sean parte del comportamiento que se quiere garantizar.
- **Integración HTTP**. Usa MockMvc y `@WebMvcTest` cuando el objetivo sea el contrato de la capa web. Comprueba validación, estado HTTP, estructura de respuesta y permisos según el alcance de la prueba. Usa `@SpringBootTest` cuando el caso requiera comprobar la integración de varias capas con el contexto completo.
- **Integración de persistencia**. Usa PostgreSQL/PostGIS de QA para comprobar migraciones, restricciones, consultas nativas, transacciones y geometrías. Aísla los datos por prueba y evita depender del orden de ejecución. Si verificas una escritura, vuelve a leer el estado persistido cuando eso sea lo que el usuario necesita que se garantice.

## Verificación

- Ejecuta primero la prueba del módulo afectado con `./gradlew test --tests 'com.yourco.agro.<ClaseDePrueba>'`. Ejecuta `./gradlew test` con una base de QA desechable para cambios transversales o cuando varios módulos compartan el flujo. La suite completa incluye pruebas PostgreSQL/PostGIS.
- Usa las pruebas aisladas existentes. Añade una prueba cuando cubra una regla nueva o una regresión que la suite actual no detecta. Para validaciones nuevas, cubre los límites, los valores ausentes cuando importen y los casos inválidos relevantes. Para SQL específico de PostgreSQL, geometrías o migraciones, valida también con PostgreSQL/PostGIS en una base de QA desechable.
- Al cerrar un cambio, indica qué pruebas pasaron y qué quedó sin verificar. Conserva las credenciales, los datos reales y la configuración de la finca fuera de las pruebas y de sus salidas.
