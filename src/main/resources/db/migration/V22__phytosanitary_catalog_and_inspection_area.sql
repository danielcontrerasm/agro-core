ALTER TABLE phytosanitary_problem
  ADD COLUMN IF NOT EXISTS active BOOLEAN NOT NULL DEFAULT TRUE;

ALTER TABLE phytosanitary_inspection
  ADD COLUMN IF NOT EXISTS affected_area_ha DOUBLE PRECISION;

ALTER TABLE phytosanitary_inspection
  ADD CONSTRAINT ck_phytosanitary_inspection_affected_area
    CHECK (affected_area_ha IS NULL OR affected_area_ha >= 0);

CREATE INDEX IF NOT EXISTS idx_phytosanitary_problem_active
  ON phytosanitary_problem (active, name);
