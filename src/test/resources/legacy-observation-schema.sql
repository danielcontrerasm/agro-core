ALTER TABLE field_event ADD COLUMN event_type TEXT NOT NULL;
ALTER TABLE field_event ADD COLUMN occurred_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE field_event ADD COLUMN created_by_user_id BIGINT NOT NULL;
ALTER TABLE field_event ADD COLUMN notes TEXT;

CREATE TABLE observation_detail (
  event_id BIGINT PRIMARY KEY REFERENCES field_event(id) ON DELETE CASCADE,
  suspected_catalog_id BIGINT,
  severity INTEGER,
  symptoms TEXT,
  ai_diagnosis_json TEXT
);
