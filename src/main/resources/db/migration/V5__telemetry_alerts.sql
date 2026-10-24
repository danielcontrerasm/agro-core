CREATE TABLE IF NOT EXISTS sensor_device (
  id BIGSERIAL PRIMARY KEY,
  farm_id BIGINT NOT NULL REFERENCES farm(id) ON DELETE CASCADE,
  block_id BIGINT REFERENCES block(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  device_key TEXT NOT NULL UNIQUE,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sensor_device_farm ON sensor_device (farm_id);
CREATE INDEX IF NOT EXISTS idx_sensor_device_block ON sensor_device (block_id);

CREATE TABLE IF NOT EXISTS sensor_reading (
  id BIGSERIAL PRIMARY KEY,
  device_id BIGINT NOT NULL REFERENCES sensor_device(id) ON DELETE CASCADE,
  recorded_at TIMESTAMPTZ NOT NULL,
  soil_moisture DOUBLE PRECISION,
  air_humidity DOUBLE PRECISION,
  air_temperature DOUBLE PRECISION,
  soil_temperature DOUBLE PRECISION,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT ck_sensor_reading_value CHECK (
    soil_moisture IS NOT NULL OR air_humidity IS NOT NULL OR
    air_temperature IS NOT NULL OR soil_temperature IS NOT NULL
  )
);

CREATE INDEX IF NOT EXISTS idx_sensor_reading_device_time ON sensor_reading (device_id, recorded_at DESC);

CREATE TABLE IF NOT EXISTS alert_rule (
  id BIGSERIAL PRIMARY KEY,
  farm_id BIGINT NOT NULL REFERENCES farm(id) ON DELETE CASCADE,
  block_id BIGINT REFERENCES block(id) ON DELETE CASCADE,
  metric TEXT NOT NULL CHECK (metric IN ('SOIL_MOISTURE', 'AIR_HUMIDITY', 'AIR_TEMPERATURE', 'SOIL_TEMPERATURE')),
  operator TEXT NOT NULL CHECK (operator IN ('LT', 'LTE', 'GT', 'GTE')),
  threshold DOUBLE PRECISION NOT NULL,
  severity TEXT NOT NULL CHECK (severity IN ('INFO', 'WARNING', 'CRITICAL')),
  message TEXT NOT NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sensor_alert (
  id BIGSERIAL PRIMARY KEY,
  rule_id BIGINT NOT NULL REFERENCES alert_rule(id) ON DELETE CASCADE,
  reading_id BIGINT NOT NULL REFERENCES sensor_reading(id) ON DELETE CASCADE,
  farm_id BIGINT NOT NULL REFERENCES farm(id) ON DELETE CASCADE,
  block_id BIGINT REFERENCES block(id) ON DELETE SET NULL,
  metric TEXT NOT NULL,
  value DOUBLE PRECISION NOT NULL,
  severity TEXT NOT NULL,
  message TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'ACKNOWLEDGED')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_alert_farm_status ON sensor_alert (farm_id, status, created_at DESC);
