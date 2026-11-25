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

Después, recargar el frontend y abrir **Mapas**. El plano dibuja las geometrías
de campos y bloques almacenadas en el API, aunque no tengan observaciones.
Los campos se pueden seleccionar para ver su área. El script solo crea geometrías
ficticias: no incluye imágenes aéreas ni cartografía propia. La vista real muestra
OpenStreetMap como mapa base y ofrece capas satelital e híbrida de Esri; esas teselas
son independientes de los datos de prueba. Las geometrías pueden sustituirse más
adelante mediante un flujo de edición; el API actual solo permite crear, consultar
y eliminar campos.
