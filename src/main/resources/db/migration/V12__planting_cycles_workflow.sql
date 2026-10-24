CREATE TABLE crop_cycle (
  id BIGSERIAL PRIMARY KEY,
  block_id BIGINT NOT NULL REFERENCES block(id) ON DELETE CASCADE,
  row_id BIGINT REFERENCES row_line(id) ON DELETE SET NULL,
  code VARCHAR(100) NOT NULL,
  crop VARCHAR(100) NOT NULL,
  variety VARCHAR(150),
  status VARCHAR(20) NOT NULL DEFAULT 'DRAFT'
    CHECK (status IN ('DRAFT', 'PLANNED', 'ESTABLISHING', 'ACTIVE', 'CLOSED', 'CANCELED')),
  current_stage VARCHAR(20) NOT NULL DEFAULT 'PLANNED'
    CHECK (current_stage IN ('PLANNED', 'ESTABLISHMENT', 'VEGETATIVE', 'FLOWERING', 'FILLING', 'HARVEST', 'RENEWAL', 'CLOSED')),
  planned_planting_from DATE,
  planned_planting_to DATE,
  planted_on DATE,
  expected_harvest_on DATE,
  closed_on DATE,
  notes VARCHAR(4000),
  version BIGINT NOT NULL DEFAULT 0,
  created_by BIGINT NOT NULL REFERENCES app_user(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (block_id, code),
  CHECK (planned_planting_to IS NULL OR planned_planting_from IS NULL OR planned_planting_to >= planned_planting_from)
);

CREATE INDEX idx_crop_cycle_block_status ON crop_cycle(block_id, status);

CREATE TABLE crop_cycle_site_assessment (
  id BIGSERIAL PRIMARY KEY,
  cycle_id BIGINT NOT NULL UNIQUE REFERENCES crop_cycle(id) ON DELETE CASCADE,
  previous_use VARCHAR(2000) NOT NULL,
  neighboring_uses VARCHAR(2000),
  soil_analysis_id BIGINT REFERENCES soil_analysis(id),
  slope VARCHAR(100),
  drainage VARCHAR(2000) NOT NULL,
  flooding_risk VARCHAR(100) NOT NULL,
  wind_risk VARCHAR(100),
  contamination_risk VARCHAR(2000),
  phytosanitary_risk VARCHAR(2000),
  environmental_restrictions VARCHAR(2000),
  evidence_notes VARCHAR(4000),
  status VARCHAR(20) NOT NULL DEFAULT 'DRAFT'
    CHECK (status IN ('DRAFT', 'APPROVED', 'REJECTED')),
  version BIGINT NOT NULL DEFAULT 0,
  created_by BIGINT NOT NULL REFERENCES app_user(id),
  approved_by BIGINT REFERENCES app_user(id),
  approved_at TIMESTAMPTZ,
  decision_reason VARCHAR(4000),
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE planting_material_lot (
  id BIGSERIAL PRIMARY KEY,
  farm_id BIGINT NOT NULL REFERENCES farm(id) ON DELETE CASCADE,
  cycle_id BIGINT REFERENCES crop_cycle(id) ON DELETE SET NULL,
  material_type VARCHAR(20) NOT NULL CHECK (material_type IN ('IN_VITRO', 'CORM', 'COLINO', 'OTHER')),
  crop VARCHAR(100) NOT NULL,
  variety VARCHAR(150) NOT NULL,
  supplier VARCHAR(200) NOT NULL,
  source_reference VARCHAR(2000) NOT NULL,
  certification_reference VARCHAR(500),
  quantity_received NUMERIC(16,3) NOT NULL CHECK (quantity_received > 0),
  quantity_accepted NUMERIC(16,3),
  quantity_rejected NUMERIC(16,3),
  health_inspection VARCHAR(4000) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'RECEIVED'
    CHECK (status IN ('RECEIVED', 'ACCEPTED', 'REJECTED')),
  version BIGINT NOT NULL DEFAULT 0,
  created_by BIGINT NOT NULL REFERENCES app_user(id),
  decided_by BIGINT REFERENCES app_user(id),
  decided_at TIMESTAMPTZ,
  decision_reason VARCHAR(4000),
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK (quantity_accepted IS NULL OR quantity_accepted >= 0),
  CHECK (quantity_rejected IS NULL OR quantity_rejected >= 0)
);

CREATE INDEX idx_material_lot_farm ON planting_material_lot(farm_id, created_at DESC);
CREATE INDEX idx_material_lot_cycle ON planting_material_lot(cycle_id);

CREATE TABLE planting_plan (
  id BIGSERIAL PRIMARY KEY,
  cycle_id BIGINT NOT NULL REFERENCES crop_cycle(id) ON DELETE CASCADE,
  material_lot_id BIGINT NOT NULL REFERENCES planting_material_lot(id),
  planned_area_ha NUMERIC(16,6) NOT NULL CHECK (planned_area_ha > 0),
  planting_system VARCHAR(150) NOT NULL,
  row_spacing_m NUMERIC(10,4) NOT NULL CHECK (row_spacing_m > 0),
  plant_spacing_m NUMERIC(10,4) NOT NULL CHECK (plant_spacing_m > 0),
  target_density_ha NUMERIC(16,6) NOT NULL CHECK (target_density_ha > 0),
  target_plants INTEGER NOT NULL CHECK (target_plants > 0),
  window_from DATE NOT NULL,
  window_to DATE NOT NULL,
  responsible_id BIGINT NOT NULL,
  technical_basis VARCHAR(4000) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'DRAFT'
    CHECK (status IN ('DRAFT', 'APPROVED', 'CANCELED')),
  version BIGINT NOT NULL DEFAULT 0,
  task_id BIGINT UNIQUE REFERENCES farm_task(id),
  created_by BIGINT NOT NULL REFERENCES app_user(id),
  approved_by BIGINT REFERENCES app_user(id),
  approved_at TIMESTAMPTZ,
  decision_reason VARCHAR(4000),
  canceled_by BIGINT REFERENCES app_user(id),
  canceled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK (window_to >= window_from)
);

CREATE INDEX idx_planting_plan_cycle ON planting_plan(cycle_id, created_at DESC);

CREATE TABLE planting_execution (
  id BIGSERIAL PRIMARY KEY,
  plan_id BIGINT NOT NULL REFERENCES planting_plan(id) ON DELETE CASCADE,
  event_id BIGINT NOT NULL UNIQUE REFERENCES field_event(id),
  executed_on DATE NOT NULL,
  area_ha NUMERIC(16,6) NOT NULL CHECK (area_ha > 0),
  material_lot_id BIGINT NOT NULL REFERENCES planting_material_lot(id),
  plants_planted INTEGER NOT NULL CHECK (plants_planted > 0),
  plants_rejected INTEGER NOT NULL DEFAULT 0 CHECK (plants_rejected >= 0),
  location_details VARCHAR(2000),
  operator_notes VARCHAR(4000),
  created_by BIGINT NOT NULL REFERENCES app_user(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_planting_execution_plan ON planting_execution(plan_id, executed_on);

CREATE TABLE planting_establishment_check (
  id BIGSERIAL PRIMARY KEY,
  cycle_id BIGINT NOT NULL REFERENCES crop_cycle(id) ON DELETE CASCADE,
  checked_on DATE NOT NULL,
  plants_checked INTEGER NOT NULL CHECK (plants_checked > 0),
  surviving_plants INTEGER NOT NULL CHECK (surviving_plants >= 0 AND surviving_plants <= plants_checked),
  dead_plants INTEGER NOT NULL CHECK (dead_plants >= 0 AND dead_plants <= plants_checked),
  replaced_plants INTEGER NOT NULL DEFAULT 0 CHECK (replaced_plants >= 0),
  uniformity VARCHAR(100),
  causes VARCHAR(2000),
  notes VARCHAR(4000),
  created_by BIGINT NOT NULL REFERENCES app_user(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_establishment_cycle_date ON planting_establishment_check(cycle_id, checked_on DESC);

CREATE TABLE crop_cycle_stage_history (
  id BIGSERIAL PRIMARY KEY,
  cycle_id BIGINT NOT NULL REFERENCES crop_cycle(id) ON DELETE CASCADE,
  stage VARCHAR(20) NOT NULL
    CHECK (stage IN ('PLANNED', 'ESTABLISHMENT', 'VEGETATIVE', 'FLOWERING', 'FILLING', 'HARVEST', 'RENEWAL', 'CLOSED')),
  observed_on DATE NOT NULL,
  notes VARCHAR(4000),
  created_by BIGINT NOT NULL REFERENCES app_user(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_cycle_stage_history ON crop_cycle_stage_history(cycle_id, observed_on DESC, id DESC);
