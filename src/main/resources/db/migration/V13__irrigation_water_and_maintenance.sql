CREATE TABLE irrigation_water_source (
  id BIGSERIAL PRIMARY KEY,
  farm_id BIGINT NOT NULL REFERENCES farm(id) ON DELETE CASCADE,
  name VARCHAR(150) NOT NULL,
  source_type VARCHAR(40) NOT NULL CHECK (source_type IN ('WELL','RESERVOIR','CANAL','RIVER','RAINWATER','OTHER')),
  latitude NUMERIC(10,7), longitude NUMERIC(10,7),
  capacity_m3 NUMERIC(16,3), active BOOLEAN NOT NULL DEFAULT TRUE,
  notes VARCHAR(2000), version BIGINT NOT NULL DEFAULT 0,
  created_by BIGINT NOT NULL REFERENCES app_user(id), created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_irrigation_water_source_farm ON irrigation_water_source(farm_id);

CREATE TABLE irrigation_water_quality (
  id BIGSERIAL PRIMARY KEY,
  source_id BIGINT NOT NULL REFERENCES irrigation_water_source(id) ON DELETE CASCADE,
  sampled_on DATE NOT NULL, ph NUMERIC(8,3), conductivity_ds_m NUMERIC(12,4),
  salinity_ppm NUMERIC(12,3), suspended_solids_mg_l NUMERIC(12,3),
  laboratory_reference VARCHAR(300), notes VARCHAR(2000), created_by BIGINT NOT NULL REFERENCES app_user(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK (ph IS NULL OR (ph >= 0 AND ph <= 14)),
  CHECK (conductivity_ds_m IS NULL OR conductivity_ds_m >= 0),
  CHECK (salinity_ppm IS NULL OR salinity_ppm >= 0),
  CHECK (suspended_solids_mg_l IS NULL OR suspended_solids_mg_l >= 0)
);
CREATE INDEX idx_irrigation_water_quality_source ON irrigation_water_quality(source_id, sampled_on DESC);

CREATE TABLE irrigation_infrastructure (
  id BIGSERIAL PRIMARY KEY,
  farm_id BIGINT NOT NULL REFERENCES farm(id) ON DELETE CASCADE,
  block_id BIGINT REFERENCES block(id) ON DELETE SET NULL,
  source_id BIGINT REFERENCES irrigation_water_source(id) ON DELETE SET NULL,
  asset_type VARCHAR(40) NOT NULL CHECK (asset_type IN ('PUMP','VALVE','PIPE','FILTER','METER','DRAIN','CANAL','RESERVOIR','OTHER')),
  code VARCHAR(100) NOT NULL, latitude NUMERIC(10,7), longitude NUMERIC(10,7),
  status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','INACTIVE','MAINTENANCE')),
  notes VARCHAR(2000), version BIGINT NOT NULL DEFAULT 0,
  created_by BIGINT NOT NULL REFERENCES app_user(id), created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (farm_id, code)
);
CREATE INDEX idx_irrigation_infrastructure_farm ON irrigation_infrastructure(farm_id);

CREATE TABLE irrigation_water_balance (
  id BIGSERIAL PRIMARY KEY,
  sector_id BIGINT NOT NULL REFERENCES irrigation_sector(id) ON DELETE CASCADE,
  balance_date DATE NOT NULL, rainfall_mm NUMERIC(12,3) NOT NULL DEFAULT 0,
  et0_mm NUMERIC(12,3), crop_coefficient NUMERIC(8,4), root_depth_cm NUMERIC(8,2),
  available_water_mm NUMERIC(12,3), required_volume_m3 NUMERIC(16,6), applied_volume_m3 NUMERIC(16,6),
  deficit_mm NUMERIC(12,3), notes VARCHAR(2000), created_by BIGINT NOT NULL REFERENCES app_user(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (sector_id, balance_date),
  CHECK (rainfall_mm >= 0), CHECK (et0_mm IS NULL OR et0_mm >= 0), CHECK (crop_coefficient IS NULL OR crop_coefficient >= 0),
  CHECK (root_depth_cm IS NULL OR root_depth_cm > 0), CHECK (available_water_mm IS NULL OR available_water_mm >= 0),
  CHECK (required_volume_m3 IS NULL OR required_volume_m3 >= 0), CHECK (applied_volume_m3 IS NULL OR applied_volume_m3 >= 0)
);
CREATE INDEX idx_irrigation_water_balance_sector ON irrigation_water_balance(sector_id, balance_date DESC);

CREATE TABLE irrigation_maintenance (
  id BIGSERIAL PRIMARY KEY,
  sector_id BIGINT REFERENCES irrigation_sector(id) ON DELETE CASCADE,
  infrastructure_id BIGINT REFERENCES irrigation_infrastructure(id) ON DELETE CASCADE,
  maintenance_type VARCHAR(50) NOT NULL CHECK (maintenance_type IN ('FILTER_WASH','PUMP_CHECK','VALVE_CHECK','LEAK_REPAIR','METER_CALIBRATION','DRAIN_CLEANING','OTHER')),
  scheduled_on DATE NOT NULL, completed_on DATE, status VARCHAR(20) NOT NULL DEFAULT 'PLANNED' CHECK (status IN ('PLANNED','IN_PROGRESS','COMPLETED','BLOCKED')),
  pressure_kpa NUMERIC(12,3), flow_m3h NUMERIC(12,3), notes VARCHAR(2000), task_id BIGINT UNIQUE REFERENCES farm_task(id),
  created_by BIGINT NOT NULL REFERENCES app_user(id), created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK (sector_id IS NOT NULL OR infrastructure_id IS NOT NULL), CHECK (pressure_kpa IS NULL OR pressure_kpa >= 0), CHECK (flow_m3h IS NULL OR flow_m3h >= 0)
);
CREATE INDEX idx_irrigation_maintenance_date ON irrigation_maintenance(scheduled_on, status);

CREATE TABLE irrigation_sensor_check (
  id BIGSERIAL PRIMARY KEY,
  sector_id BIGINT NOT NULL REFERENCES irrigation_sector(id) ON DELETE CASCADE,
  sensor_device_id BIGINT NOT NULL REFERENCES sensor_device(id), checked_on DATE NOT NULL,
  calibration_status VARCHAR(20) NOT NULL CHECK (calibration_status IN ('VALID','DUE','FAILED')),
  reference_value NUMERIC(16,6), observed_value NUMERIC(16,6), technician VARCHAR(150), notes VARCHAR(2000),
  created_by BIGINT NOT NULL REFERENCES app_user(id), created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
