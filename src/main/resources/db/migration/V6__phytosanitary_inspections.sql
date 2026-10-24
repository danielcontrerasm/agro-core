CREATE TABLE phytosanitary_problem (
  code VARCHAR(40) PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  category VARCHAR(20) NOT NULL
);

INSERT INTO phytosanitary_problem (code, name, category) VALUES
  ('SIGATOKA', 'Sigatoka negra', 'DISEASE'),
  ('MOKO', 'Moko', 'DISEASE'),
  ('FUSARIUM', 'Marchitez por Fusarium', 'DISEASE'),
  ('BACTERIOSIS', 'Bacteriosis del pseudotallo', 'DISEASE'),
  ('WEEVILS', 'Picudos', 'PEST'),
  ('NEMATODES', 'Nematodos', 'PEST');

CREATE TABLE phytosanitary_inspection (
  id BIGSERIAL PRIMARY KEY,
  block_id BIGINT NOT NULL REFERENCES block(id) ON DELETE CASCADE,
  row_id BIGINT REFERENCES row_line(id) ON DELETE SET NULL,
  problem_code VARCHAR(40) NOT NULL REFERENCES phytosanitary_problem(code),
  inspected_at TIMESTAMP WITH TIME ZONE NOT NULL,
  inspected_plants INT NOT NULL CHECK (inspected_plants > 0),
  affected_plants INT NOT NULL CHECK (affected_plants >= 0 AND affected_plants <= inspected_plants),
  symptoms TEXT NOT NULL,
  severity_percent DOUBLE PRECISION NOT NULL CHECK (severity_percent BETWEEN 0 AND 100),
  severity_method VARCHAR(250) NOT NULL,
  assessment_status VARCHAR(20) NOT NULL DEFAULT 'SUSPECTED'
    CHECK (assessment_status IN ('SUSPECTED', 'CONFIRMED', 'DISCARDED')),
  resolved BOOLEAN NOT NULL DEFAULT FALSE,
  next_visit DATE NOT NULL,
  created_by_user_id BIGINT NOT NULL REFERENCES app_user(id),
  reviewed_by_user_id BIGINT REFERENCES app_user(id),
  review_notes TEXT,
  reviewed_at TIMESTAMP WITH TIME ZONE,
  version BIGINT NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_inspection_block_time ON phytosanitary_inspection(block_id, inspected_at DESC);
CREATE INDEX idx_inspection_problem ON phytosanitary_inspection(problem_code);
