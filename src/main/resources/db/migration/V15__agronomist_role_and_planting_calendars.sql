ALTER TABLE farm_membership DROP CONSTRAINT IF EXISTS farm_membership_role_check;
ALTER TABLE farm_membership ADD CONSTRAINT farm_membership_role_check
  CHECK (role IN ('ADMIN', 'SUPERVISOR', 'AGRONOMIST', 'WORKER'));

CREATE TABLE planting_calendar (
  id BIGSERIAL PRIMARY KEY,
  farm_id BIGINT NOT NULL REFERENCES farm(id) ON DELETE CASCADE,
  region VARCHAR(200) NOT NULL,
  crop_catalog_id BIGINT NOT NULL REFERENCES crop_catalog(id) ON DELETE CASCADE,
  variety_id BIGINT REFERENCES crop_variety(id) ON DELETE SET NULL,
  season_name VARCHAR(150) NOT NULL,
  window_from_month SMALLINT,
  window_from_day SMALLINT,
  window_to_month SMALLINT,
  window_to_day SMALLINT,
  perennial BOOLEAN NOT NULL DEFAULT FALSE,
  preparation_lead_days INTEGER NOT NULL DEFAULT 0 CHECK (preparation_lead_days >= 0),
  notes VARCHAR(4000),
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_by BIGINT NOT NULL REFERENCES app_user(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK (char_length(trim(region)) > 0),
  CHECK (char_length(trim(season_name)) > 0),
  CHECK (window_from_month IS NULL OR window_from_month BETWEEN 1 AND 12),
  CHECK (window_to_month IS NULL OR window_to_month BETWEEN 1 AND 12),
  CHECK (window_from_day IS NULL OR window_from_day BETWEEN 1 AND 31),
  CHECK (window_to_day IS NULL OR window_to_day BETWEEN 1 AND 31),
  CHECK (perennial OR (window_from_month IS NOT NULL AND window_from_day IS NOT NULL
    AND window_to_month IS NOT NULL AND window_to_day IS NOT NULL))
);

CREATE UNIQUE INDEX uk_planting_calendar_rule
  ON planting_calendar (farm_id, lower(region), crop_catalog_id,
    COALESCE(variety_id, 0), lower(season_name));
CREATE INDEX idx_planting_calendar_farm
  ON planting_calendar (farm_id, active, lower(region));
