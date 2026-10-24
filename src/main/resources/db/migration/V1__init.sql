CREATE EXTENSION IF NOT EXISTS postgis;

CREATE TABLE IF NOT EXISTS farm (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  country TEXT,
  region TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS field (
  id BIGSERIAL PRIMARY KEY,
  farm_id BIGINT NOT NULL REFERENCES farm(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  geom geometry(Polygon, 4326) NOT NULL,
  area_ha DOUBLE PRECISION,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_field_geom ON field USING GIST (geom);
CREATE INDEX IF NOT EXISTS idx_field_farm ON field (farm_id);

CREATE TABLE IF NOT EXISTS block (
  id BIGSERIAL PRIMARY KEY,
  field_id BIGINT NOT NULL REFERENCES field(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  crop TEXT NOT NULL DEFAULT 'banana',
  variety TEXT,
  geom geometry(Polygon, 4326) NOT NULL,
  area_ha DOUBLE PRECISION,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uk_block_field_code UNIQUE (field_id, code)
);

CREATE INDEX IF NOT EXISTS idx_block_geom ON block USING GIST (geom);
CREATE INDEX IF NOT EXISTS idx_block_field ON block (field_id);

CREATE TABLE IF NOT EXISTS row_line (
  id BIGSERIAL PRIMARY KEY,
  block_id BIGINT NOT NULL REFERENCES block(id) ON DELETE CASCADE,
  row_code TEXT NOT NULL,
  geom geometry(LineString, 4326) NOT NULL,
  length_m DOUBLE PRECISION,
  plant_spacing_m DOUBLE PRECISION DEFAULT 2.0,
  plants_estimated INT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uk_row_block_code UNIQUE (block_id, row_code)
);

CREATE INDEX IF NOT EXISTS idx_row_geom ON row_line USING GIST (geom);
CREATE INDEX IF NOT EXISTS idx_row_block ON row_line (block_id);

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'event_type') THEN
    CREATE TYPE event_type AS ENUM (
      'SCOUTING_OBSERVATION',
      'TREATMENT_APPLICATION',
      'FERTILIZER_APPLICATION',
      'IRRIGATION_EVENT',
      'HANDLING_EVENT',
      'SOIL_SAMPLE',
      'HARVEST_EVENT'
    );
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS field_event (
  id BIGSERIAL PRIMARY KEY,
  event_type event_type NOT NULL,
  occurred_at TIMESTAMPTZ NOT NULL,
  created_by_user_id BIGINT NOT NULL,
  block_id BIGINT REFERENCES block(id) ON DELETE SET NULL,
  row_id BIGINT REFERENCES row_line(id) ON DELETE SET NULL,
  plant_index_start INT,
  plant_index_end INT,
  geom geometry(Point, 4326),
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'OPEN',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT ck_target CHECK (block_id IS NOT NULL OR row_id IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_event_block ON field_event (block_id);
CREATE INDEX IF NOT EXISTS idx_event_row ON field_event (row_id);
CREATE INDEX IF NOT EXISTS idx_event_time ON field_event (occurred_at);
CREATE INDEX IF NOT EXISTS idx_event_geom ON field_event USING GIST (geom);

CREATE TABLE IF NOT EXISTS observation_detail (
  event_id BIGINT PRIMARY KEY REFERENCES field_event(id) ON DELETE CASCADE,
  suspected_catalog_id BIGINT,
  severity INT,
  symptoms TEXT,
  ai_diagnosis_json JSONB
);

CREATE TABLE IF NOT EXISTS media_asset (
  id BIGSERIAL PRIMARY KEY,
  event_id BIGINT NOT NULL REFERENCES field_event(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,
  s3_key TEXT NOT NULL,
  content_type TEXT,
  captured_at TIMESTAMPTZ,
  gps_geom geometry(Point, 4326),
  meta JSONB
);

CREATE INDEX IF NOT EXISTS idx_media_event ON media_asset(event_id);
CREATE INDEX IF NOT EXISTS idx_media_gps ON media_asset USING GIST (gps_geom);
