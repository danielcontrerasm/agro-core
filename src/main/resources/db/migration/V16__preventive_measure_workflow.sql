CREATE TABLE preventive_measure_template (
  id BIGSERIAL PRIMARY KEY,
  farm_id BIGINT NOT NULL REFERENCES farm(id) ON DELETE CASCADE,
  code VARCHAR(100) NOT NULL,
  name VARCHAR(180) NOT NULL,
  category VARCHAR(30) NOT NULL CHECK (category IN ('MONITORING', 'SANITATION', 'CULTURAL', 'BIOLOGICAL', 'OTHER')),
  instructions VARCHAR(4000) NOT NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_by_user_id BIGINT NOT NULL REFERENCES app_user(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX uk_preventive_template_farm_code
  ON preventive_measure_template (farm_id, code);
CREATE INDEX idx_preventive_template_farm
  ON preventive_measure_template (farm_id, active, name);

CREATE TABLE preventive_measure_assignment (
  id BIGSERIAL PRIMARY KEY,
  template_id BIGINT NOT NULL REFERENCES preventive_measure_template(id),
  block_id BIGINT NOT NULL REFERENCES block(id) ON DELETE CASCADE,
  scheduled_for DATE NOT NULL,
  assigned_to_user_id BIGINT REFERENCES app_user(id),
  status VARCHAR(20) NOT NULL DEFAULT 'PLANNED'
    CHECK (status IN ('PLANNED', 'IN_PROGRESS', 'COMPLETED')),
  completion_notes VARCHAR(4000),
  completed_at TIMESTAMP WITH TIME ZONE,
  completed_by_user_id BIGINT REFERENCES app_user(id),
  version BIGINT NOT NULL DEFAULT 0,
  created_by_user_id BIGINT NOT NULL REFERENCES app_user(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK (status <> 'COMPLETED' OR completed_at IS NOT NULL),
  CHECK (status <> 'COMPLETED' OR completed_by_user_id IS NOT NULL),
  CHECK (status = 'COMPLETED' OR (completed_at IS NULL AND completed_by_user_id IS NULL))
);

CREATE INDEX idx_preventive_assignment_block_date
  ON preventive_measure_assignment (block_id, scheduled_for DESC);
CREATE INDEX idx_preventive_assignment_template
  ON preventive_measure_assignment (template_id, status);

CREATE TABLE preventive_measure_evidence (
  id BIGSERIAL PRIMARY KEY,
  assignment_id BIGINT NOT NULL REFERENCES preventive_measure_assignment(id) ON DELETE CASCADE,
  kind VARCHAR(20) NOT NULL CHECK (kind IN ('IMAGE', 'DOCUMENT', 'VIDEO')),
  s3_key VARCHAR(1024) NOT NULL,
  content_type VARCHAR(150),
  created_by_user_id BIGINT NOT NULL REFERENCES app_user(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_preventive_evidence_assignment
  ON preventive_measure_evidence (assignment_id, created_at DESC);
