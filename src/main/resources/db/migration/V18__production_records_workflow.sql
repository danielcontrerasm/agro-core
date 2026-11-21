ALTER TABLE crop_monitoring_record
  ADD COLUMN IF NOT EXISTS field_id BIGINT REFERENCES field(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS crop_cycle_id BIGINT REFERENCES crop_cycle(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS harvested_area_ha DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS rejected_reason TEXT;

ALTER TABLE crop_monitoring_record ALTER COLUMN block_id DROP NOT NULL;

UPDATE crop_monitoring_record r
SET field_id = b.field_id
FROM block b
WHERE r.block_id = b.id AND r.field_id IS NULL;

WITH unique_cycles AS (
  SELECT r.id, MIN(c.id) AS cycle_id
  FROM crop_monitoring_record r
  JOIN crop_cycle c ON c.block_id = r.block_id
  WHERE r.record_type = 'HARVEST'
    AND r.crop_cycle_id IS NULL
    AND c.status NOT IN ('CANCELED', 'CLOSED')
  GROUP BY r.id
  HAVING COUNT(c.id) = 1
)
UPDATE crop_monitoring_record r
SET crop_cycle_id = unique_cycles.cycle_id
FROM unique_cycles
WHERE r.id = unique_cycles.id;

ALTER TABLE crop_monitoring_record
  ADD CONSTRAINT ck_crop_monitoring_location
    CHECK (field_id IS NOT NULL OR block_id IS NOT NULL OR row_id IS NOT NULL),
  ADD CONSTRAINT ck_crop_monitoring_estimated_yield
    CHECK (estimated_yield IS NULL OR estimated_yield >= 0) NOT VALID,
  ADD CONSTRAINT ck_crop_monitoring_harvested_quantity
    CHECK (harvested_quantity IS NULL OR harvested_quantity >= 0) NOT VALID,
  ADD CONSTRAINT ck_crop_monitoring_rejected_quantity
    CHECK (rejected_quantity IS NULL OR rejected_quantity >= 0) NOT VALID,
  ADD CONSTRAINT ck_crop_monitoring_harvested_area
    CHECK (harvested_area_ha IS NULL OR harvested_area_ha > 0) NOT VALID,
  ADD CONSTRAINT ck_crop_monitoring_yield_unit
    CHECK (yield_unit IS NULL OR lower(trim(yield_unit)) IN ('g', 'kg', 't', 'lb', 'cajas', 'racimos', 'unidades')) NOT VALID,
  ADD CONSTRAINT ck_crop_monitoring_quality_grade
    CHECK (quality_grade IS NULL OR upper(trim(quality_grade)) IN ('PREMIUM', 'A', 'B', 'C', 'REJECTED')) NOT VALID;

CREATE INDEX IF NOT EXISTS idx_monitoring_record_field ON crop_monitoring_record (field_id);
CREATE INDEX IF NOT EXISTS idx_monitoring_record_cycle ON crop_monitoring_record (crop_cycle_id);
