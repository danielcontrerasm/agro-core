ALTER TABLE farm
  ADD COLUMN IF NOT EXISTS geom geometry(Polygon, 4326);

CREATE INDEX IF NOT EXISTS idx_farm_geom ON farm USING GIST (geom);
