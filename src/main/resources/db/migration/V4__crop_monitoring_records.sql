CREATE TABLE IF NOT EXISTS crop_monitoring_record (
  id BIGSERIAL PRIMARY KEY,
  record_type TEXT NOT NULL CHECK (record_type IN (
    'CROP_CYCLE', 'SOIL_SAMPLE', 'FERTILIZER_APPLICATION',
    'IRRIGATION', 'HEALTH_OBSERVATION', 'HARVEST'
  )),
  block_id BIGINT NOT NULL REFERENCES block(id) ON DELETE CASCADE,
  row_id BIGINT REFERENCES row_line(id) ON DELETE SET NULL,
  recorded_at TIMESTAMPTZ NOT NULL,
  created_by_user_id BIGINT NOT NULL,

  crop TEXT,
  variety TEXT,
  planting_date DATE,
  growth_stage TEXT,
  expected_harvest_date DATE,
  actual_harvest_date DATE,

  sample_type TEXT,
  ph DOUBLE PRECISION,
  nitrogen DOUBLE PRECISION,
  phosphorus DOUBLE PRECISION,
  potassium DOUBLE PRECISION,
  nutrient_deficiencies TEXT,

  product TEXT,
  dose DOUBLE PRECISION,
  dose_unit TEXT,
  quantity DOUBLE PRECISION,
  quantity_unit TEXT,

  irrigation_duration_minutes INT,
  water_volume DOUBLE PRECISION,
  water_volume_unit TEXT,
  soil_moisture DOUBLE PRECISION,
  soil_moisture_unit TEXT,

  pest_or_disease TEXT,
  severity INT,
  symptoms TEXT,
  preventive_measure TEXT,
  treatment TEXT,
  follow_up_date DATE,
  resolution_status TEXT,

  estimated_yield DOUBLE PRECISION,
  harvested_quantity DOUBLE PRECISION,
  yield_unit TEXT,
  quality_grade TEXT,
  rejected_quantity DOUBLE PRECISION,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_monitoring_record_block ON crop_monitoring_record (block_id);
CREATE INDEX IF NOT EXISTS idx_monitoring_record_type ON crop_monitoring_record (record_type);
CREATE INDEX IF NOT EXISTS idx_monitoring_record_time ON crop_monitoring_record (recorded_at);
