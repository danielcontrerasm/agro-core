\set ON_ERROR_STOP on

BEGIN;

DO $$
DECLARE
  target_farm_id bigint;
  existing_fields integer;
  existing_test_fields integer;
BEGIN
  IF (SELECT count(*) FROM farm WHERE lower(name) = 'guasita') <> 1 THEN
    RAISE EXCEPTION 'Expected exactly one farm named Guasita';
  END IF;

  SELECT id INTO target_farm_id FROM farm WHERE lower(name) = 'guasita' FOR UPDATE;
  SELECT count(*), count(*) FILTER (WHERE name ~ '^División [1-7] \[PRUEBA\]$')
    INTO existing_fields, existing_test_fields FROM field WHERE farm_id = target_farm_id;

  IF existing_fields = 7 AND existing_test_fields = 7 THEN
    RAISE NOTICE 'Guasita test fields already exist; no changes made';
    RETURN;
  END IF;
  IF existing_fields <> 0 THEN
    RAISE EXCEPTION 'Guasita already has fields; inspect them before creating this test plan';
  END IF;

  WITH origin AS (
    SELECT ST_Transform(ST_SetSRID(ST_MakePoint(-74.82109, 10.02539), 4326), 32618) AS center
  ), footprint AS (
    SELECT center, ST_MakeEnvelope(ST_X(center) - 500, ST_Y(center) - 400,
      ST_X(center) + 500, ST_Y(center) + 400, 32618) AS geom FROM origin
  ), dimensions AS (
    SELECT center, sqrt(800000.0 / ST_Area(ST_Transform(geom, 4326)::geography)) AS factor FROM footprint
  ), divisions(division, west, south, east, north, area_ha) AS (
    VALUES (1, -500, 0, -250, 400, 10), (2, -250, 0, 0, 400, 10),
      (3, 0, 0, 250, 400, 10), (4, 250, 0, 500, 400, 10),
      (5, -500, -400, -150, 0, 14), (6, -150, -400, 175, 0, 13),
      (7, 175, -400, 500, 0, 13)
  )
  INSERT INTO field (farm_id, name, geom, area_ha)
  SELECT target_farm_id, format('División %s [PRUEBA]', division),
    ST_Transform(ST_MakePolygon(ST_MakeLine(ARRAY(
      SELECT ST_SetSRID(ST_MakePoint(ST_X(center) + boundary_x * factor,
        ST_Y(center) + boundary_y * factor), 32618)
      FROM (
        SELECT boundary_x, south AS boundary_y, 0 AS edge, boundary_x AS position
        FROM unnest(ARRAY[-500, -250, -150, 0, 175, 250, 500]) AS boundary_x
        WHERE boundary_x BETWEEN west AND east
        UNION ALL
        SELECT boundary_x, north, 1, -boundary_x
        FROM unnest(ARRAY[-500, -250, -150, 0, 175, 250, 500]) AS boundary_x
        WHERE boundary_x BETWEEN west AND east
        UNION ALL
        SELECT west, south, 2, 0
      ) AS ring ORDER BY edge, position
    ))), 4326), area_ha
  FROM divisions CROSS JOIN dimensions ORDER BY division;
END $$;

SELECT name, area_ha, round((ST_Area(geom::geography) / 10000)::numeric, 4) AS geographic_area_ha
FROM field WHERE farm_id = (SELECT id FROM farm WHERE lower(name) = 'guasita') ORDER BY name;

COMMIT;
