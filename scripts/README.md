# Plano de prueba de Guasita

`guasita-test-map.sql` crea siete campos en la finca existente Guasita: cuatro
de 10 ha y tres de 14, 13 y 13 ha, para un total nominal de 80 ha. Todos se
identifican con `[PRUEBA]`. No se crean cultivos, bloques, surcos ni observaciones.

El centro aproximado es longitud -74.82109, latitud 10.02539, como referencia de
[Tasajera, El Guamo, Bolívar](https://mapcarta.com/es/19680432). La posición de
Guasita, su perímetro y sus divisiones son ficticios; requieren coordenadas reales
para representar la finca. El plano no es un levantamiento topográfico.

Los rectángulos se construyen en UTM 18N y se guardan en WGS84/SRID 4326.
La escala se ajusta con el área geodésica del conjunto para aproximar 80 ha.

Desde la raíz del proyecto, con PostgreSQL iniciado:

```sh
docker compose exec -T db psql -U agro -d agro < scripts/guasita-test-map.sql
```

El script solo trabaja si hay exactamente una finca llamada Guasita y no tiene
campos. Si ya existen los siete campos de prueba, no los duplica. Si hay otros
campos, se detiene. No elimina ni reemplaza datos existentes.

Después, recarga el frontend y abre **Campos → Vista mapa** o **Mapas** con Guasita
seleccionada. Ambos planos dibujan las geometrías de campos almacenadas en el API
aunque todavía no existan observaciones. Selecciona un campo para ver su área.
Las imágenes satelitales provienen del proveedor de teselas configurado. En **Mapas**
se puede elegir **Plano** para usar OpenStreetMap. La edición de geometrías queda
pendiente. El API de campos permite crear, consultar y eliminar registros.

## Pruebas en una finca temporal

Desde la raíz, ejecuta las pruebas de backend, frontend y Chrome con
`python3 scripts/run_qa_tests.py`. El script crea una base PostGIS y una finca
de QA para el recorrido, elimina la base al terminar y conserva los informes
locales. Añade `--watch --record` para ralentizar las acciones y grabar las pruebas.
[Requisitos, comandos e informes de QA](../frontend/tests/manual-agricultural-workflow.md#pruebas-automatizadas-en-chrome)

## Grabar un módulo en Chrome

Ejecuta `scripts/qa-modulos/riego.sh` para ver solo Riego. Cada módulo tiene
su propio script, un recorrido con pausas y un WebM independiente. El ejecutor
también admite `all` para grabar todos los módulos en una sola ejecución.
[Scripts por módulo y ubicación de los videos](../frontend/tests/manual-agricultural-workflow.md#pruebas-independientes-por-módulo)
