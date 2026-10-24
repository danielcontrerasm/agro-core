CREATE TABLE irrigation_sector (
  id BIGSERIAL PRIMARY KEY,
  block_id BIGINT NOT NULL REFERENCES block(id) ON DELETE CASCADE,
  sensor_device_id BIGINT UNIQUE REFERENCES sensor_device(id),
  details TEXT NOT NULL,
  version BIGINT NOT NULL DEFAULT 0,
  created_by BIGINT NOT NULL REFERENCES app_user(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_irrigation_sector_block ON irrigation_sector(block_id);
CREATE TABLE irrigation_sector_revision (
  id BIGSERIAL PRIMARY KEY,
  sector_id BIGINT NOT NULL REFERENCES irrigation_sector(id) ON DELETE CASCADE,
  details TEXT NOT NULL,
  reason VARCHAR(2000) NOT NULL,
  created_by BIGINT NOT NULL REFERENCES app_user(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE irrigation_measurement (
  id BIGSERIAL PRIMARY KEY,
  sector_id BIGINT NOT NULL REFERENCES irrigation_sector(id) ON DELETE CASCADE,
  recorded_at TIMESTAMP WITH TIME ZONE NOT NULL,
  details TEXT NOT NULL,
  created_by BIGINT NOT NULL REFERENCES app_user(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_irrigation_measurement_time ON irrigation_measurement(sector_id,recorded_at DESC,id DESC);
CREATE TABLE irrigation_plan (
  id BIGSERIAL PRIMARY KEY,
  sector_id BIGINT NOT NULL REFERENCES irrigation_sector(id),
  details TEXT NOT NULL,
  task_id BIGINT UNIQUE REFERENCES farm_task(id),
  status VARCHAR(20) NOT NULL DEFAULT 'SCHEDULED' CHECK(status IN ('SCHEDULED','CANCELED')),
  version BIGINT NOT NULL DEFAULT 0,
  created_by BIGINT NOT NULL REFERENCES app_user(id),
  canceled_by BIGINT REFERENCES app_user(id),
  cancel_reason VARCHAR(2000),
  canceled_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE irrigation_execution (
  id BIGSERIAL PRIMARY KEY,
  plan_id BIGINT NOT NULL REFERENCES irrigation_plan(id),
  event_id BIGINT NOT NULL UNIQUE REFERENCES field_event(id),
  started_at TIMESTAMP WITH TIME ZONE NOT NULL,
  ended_at TIMESTAMP WITH TIME ZONE NOT NULL,
  volume_m3 NUMERIC(16,6) NOT NULL CHECK(volume_m3 >= 0),
  duration_minutes NUMERIC(16,6) NOT NULL CHECK(duration_minutes > 0),
  volume_mode VARCHAR(10) NOT NULL CHECK(volume_mode IN ('METER','FLOW')),
  details TEXT NOT NULL,
  created_by BIGINT NOT NULL REFERENCES app_user(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK(ended_at > started_at)
);
CREATE INDEX idx_irrigation_execution_plan ON irrigation_execution(plan_id);
