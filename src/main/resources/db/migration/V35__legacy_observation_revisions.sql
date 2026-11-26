ALTER TABLE field_event
  ADD COLUMN legacy_observation_version BIGINT NOT NULL DEFAULT 0;

ALTER TABLE observation_detail
  ADD COLUMN problem_code VARCHAR(40) REFERENCES phytosanitary_problem(code);

CREATE TABLE legacy_observation_revision (
  event_id BIGINT NOT NULL REFERENCES field_event(id) ON DELETE RESTRICT,
  version BIGINT NOT NULL CHECK (version > 0),
  edited_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  edited_by_user_id BIGINT NOT NULL REFERENCES app_user(id),
  reason TEXT NOT NULL,
  before_notes TEXT,
  before_symptoms TEXT,
  before_severity INTEGER,
  before_problem_code VARCHAR(40),
  after_notes TEXT,
  after_symptoms TEXT,
  after_severity INTEGER,
  after_problem_code VARCHAR(40),
  PRIMARY KEY (event_id, version)
);
