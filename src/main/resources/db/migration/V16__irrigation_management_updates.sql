ALTER TABLE irrigation_water_quality ADD COLUMN version BIGINT NOT NULL DEFAULT 0;
ALTER TABLE irrigation_water_balance ADD COLUMN version BIGINT NOT NULL DEFAULT 0;
ALTER TABLE irrigation_maintenance ADD COLUMN version BIGINT NOT NULL DEFAULT 0;
ALTER TABLE irrigation_sensor_check ADD COLUMN version BIGINT NOT NULL DEFAULT 0;
